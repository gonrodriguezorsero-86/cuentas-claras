// RN Consultorio · análisis de fotos con IA (Supabase Edge Function "ia")
// Desplegar con "Verify JWT" apagado: la función valida al usuario por su cuenta.
// Necesita el secreto ANTHROPIC_API_KEY (lo carga el dueño en Supabase → Edge Functions → Secrets).
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
function claveServidor(): string {
  try {
    const d = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const v = d.default ?? Object.values(d)[0];
    if (typeof v === "string" && v) return v;
  } catch (_) { /* sigue */ }
  return Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
const db = createClient(SB_URL, claveServidor(), { auth: { persistSession: false, autoRefreshToken: false } });
const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODELO = Deno.env.get("IA_MODELO") ?? "claude-sonnet-5-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SISTEMA = `Sos un asistente para odontólogos en Argentina. Analizás una foto clínica intraoral (o una radiografía) y sugerís marcas para un odontograma con numeración FDI.
Reglas:
- Solo marcá lo que se ve con claridad. Si no estás seguro, bajá la confianza o no lo marques.
- Si no podés identificar con seguridad qué pieza es, poné "diente": null y explicalo en "descripcion".
- Tipos de hallazgo por cara: "caries", "restauracion", "sellante" (con "caras": lista de O, I, M, D, V, P, L).
- Tipos por pieza: "ausente", "corona", "implante", "endodoncia", "perno", "protesis", "fractura", "extraccion".
- "modo": "r" si es algo a realizar (caries, fractura, extracción indicada) y "e" si es algo existente (restauraciones, coronas, ausencias, implantes).
- No es un diagnóstico: el profesional lo revisa.
Respondé SOLO con JSON válido, sin texto extra, con esta forma:
{"vista":"frontal|oclusal superior|oclusal inferior|lateral derecha|lateral izquierda|radiografía|otra","calidad":"buena|regular|mala","hallazgos":[{"diente":"16","tipo":"caries","caras":["O"],"modo":"r","descripcion":"lesión oscura en fosa central","confianza":0.7}],"observaciones":"texto corto"}`;

async function usuario(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) throw [401, "Falta la sesión."];
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) throw [401, "La sesión venció. Volvé a ingresar."];
  const { data: p } = await db.from("personal").select("user_id, activo").eq("user_id", data.user.id).maybeSingle();
  if (!p || !p.activo) throw [403, "Tu usuario no está habilitado."];
  return p;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
    await usuario(req);
    const b = await req.json().catch(() => ({}));
    if (!API_KEY) return json({ error: "Falta activar la IA: hay que cargar la clave ANTHROPIC_API_KEY en Supabase (Edge Functions → Secrets)." }, 503);
    const img = String(b.imagen || "");
    if (!img || img.length > 7_000_000) return json({ error: "La foto no llegó o es demasiado grande." }, 400);
    const media = ["image/jpeg", "image/png", "image/webp"].includes(b.media_type) ? b.media_type : "image/jpeg";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELO, max_tokens: 1500, system: SISTEMA,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: media, data: img } },
          { type: "text", text: `Dentición: ${b.denticion === "nino" ? "temporaria (niño)" : "permanente (adulto)"}. Analizá la foto y devolvé el JSON.` },
        ] }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return json({ error: "La IA respondió con un error: " + (j?.error?.message || r.status) }, 502);
    const txt = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    const m = txt.match(/\{[\s\S]*\}/);
    let out: any = {};
    try { out = JSON.parse(m ? m[0] : txt); } catch (_) { return json({ error: "No pude leer la respuesta de la IA. Probá con otra foto." }, 502); }
    out.hallazgos = Array.isArray(out.hallazgos) ? out.hallazgos.slice(0, 40).map((h: any) => ({
      diente: h.diente == null ? null : String(h.diente), tipo: String(h.tipo || ""), caras: Array.isArray(h.caras) ? h.caras.map(String) : [],
      modo: h.modo === "r" ? "r" : h.modo === "e" ? "e" : undefined, descripcion: String(h.descripcion || "").slice(0, 300), confianza: Math.max(0, Math.min(1, +h.confianza || 0)),
    })) : [];
    return json(out);
  } catch (e) {
    if (Array.isArray(e)) return json({ error: e[1] }, e[0]);
    return json({ error: (e as Error).message }, 500);
  }
}

if (!Deno.env.get("IA_TEST")) Deno.serve(handler);
