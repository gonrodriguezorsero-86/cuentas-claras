// RN Consultorio · conexión con Google Calendar (Supabase Edge Function "gcal")
// Desplegar con "Verify JWT" apagado: la función valida al usuario por su cuenta
// y además recibe la vuelta de Google, que no trae sesión.
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
const SB_KEY = claveServidor();
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://gonrodriguezorsero-86.github.io/cuentas-claras/consultorio/";
const REDIRECT = SB_URL + "/functions/v1/gcal";
const TZ = "America/Argentina/Buenos_Aires";
const API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar";

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-region",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
class Err extends Error { constructor(public status: number, msg: string) { super(msg); } }

type Personal = { user_id: string; rol: string; sedes: string[]; profesional_id: string | null; activo: boolean };
type Cuenta = { profesional_id: string; user_id: string; email: string; refresh_token: string; cal_turnos: string | null; cal_familia: string | null; compartido_con: string };

// ---------- Google ----------
async function tokenDesde(body: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Err(r.status === 400 ? 409 : 502, "Google rechazó la conexión (" + (j.error || r.status) + "). Volvé a conectar Google Calendar.");
  return j as { access_token: string; refresh_token?: string };
}
const accessToken = async (c: Cuenta) => (await tokenDesde({ grant_type: "refresh_token", refresh_token: c.refresh_token })).access_token;

async function g(at: string, method: string, path: string, body?: unknown) {
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 204) return null;
  const t = await r.text();
  if (!r.ok) { const e = new Err(r.status, "Google Calendar respondió " + r.status + ": " + t.slice(0, 200)); throw e; }
  return t ? JSON.parse(t) : null;
}
async function existe(at: string, calId: string | null) {
  if (!calId) return false;
  try { await g(at, "GET", "/calendars/" + encodeURIComponent(calId)); return true; } catch (_) { return false; }
}
async function asegurarCalendarios(at: string, c: Partial<Cuenta>) {
  let { cal_turnos, cal_familia } = c;
  if (!(await existe(at, cal_turnos ?? null))) cal_turnos = (await g(at, "POST", "/calendars", { summary: "RN · Turnos", description: "Turnos del consultorio (sin datos de pacientes). Lo actualiza RN Consultorio.", timeZone: TZ })).id;
  if (!(await existe(at, cal_familia ?? null))) cal_familia = (await g(at, "POST", "/calendars", { summary: "RN · Familia", description: "Fechas importantes: lo que se carga acá bloquea la agenda del consultorio.", timeZone: TZ })).id;
  return { cal_turnos: cal_turnos!, cal_familia: cal_familia! };
}
const eventoId = (turnoId: string) => "rn" + turnoId.replace(/-/g, "").toLowerCase();

// ---------- permisos ----------
async function usuario(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) throw new Err(401, "Falta la sesión.");
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) throw new Err(401, "La sesión venció. Volvé a ingresar.");
  const { data: p } = await db.from("personal").select("*").eq("user_id", data.user.id).maybeSingle();
  if (!p || !p.activo) throw new Err(403, "Tu usuario no está habilitado.");
  return p as Personal;
}
const puedeSede = (p: Personal, sede: string) => p.rol === "admin" || (p.sedes || []).includes(sede);
async function profesional(id: string) {
  const { data } = await db.from("profesionales").select("*").eq("id", id).maybeSingle();
  if (!data) throw new Err(404, "No encuentro ese profesional.");
  return data as { id: string; nombre: string; sede_id: string };
}
async function puedeGestionar(p: Personal, profId: string) {
  if (p.profesional_id === profId) return true;
  if (p.rol !== "admin") return false;
  return true;
}
async function cuenta(profId: string) {
  const { data } = await db.from("google_cuentas").select("*").eq("profesional_id", profId).maybeSingle();
  return data as Cuenta | null;
}

// ---------- acciones ----------
async function conectar(p: Personal, b: any) {
  const profId = b.profesional_id || p.profesional_id;
  if (!profId) throw new Err(400, "Tu usuario no tiene una agenda propia asignada.");
  if (!(await puedeGestionar(p, profId))) throw new Err(403, "Solo podés conectar tu propia agenda.");
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Err(500, "Falta configurar Google (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Supabase).");
  const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await db.from("google_estado").delete().lt("creado", new Date(Date.now() - 3600e3).toISOString());
  const { error } = await db.from("google_estado").insert({ state, user_id: p.user_id, profesional_id: profId });
  if (error) throw new Err(500, error.message);
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state }).toString();
  return { url: u.toString() };
}

async function vuelta(url: URL) {
  const back = (estado: string, msg = "") => Response.redirect(APP_URL + "?gcal=" + estado + (msg ? "&msg=" + encodeURIComponent(msg) : ""), 302);
  try {
    if (url.searchParams.get("error")) return back("cancelado");
    const state = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
    const { data: st } = await db.from("google_estado").select("*").eq("state", state).maybeSingle();
    if (!st || Date.now() - new Date(st.creado).getTime() > 3600e3) return back("error", "El enlace venció. Probá conectar de nuevo.");
    await db.from("google_estado").delete().eq("state", state);
    const tk = await tokenDesde({ grant_type: "authorization_code", code, redirect_uri: REDIRECT });
    const previa = await cuenta(st.profesional_id);
    const refresh = tk.refresh_token || previa?.refresh_token;
    if (!refresh) return back("error", "Google no dio permiso permanente. Quitá el acceso de la app en tu cuenta de Google y conectá de nuevo.");
    const prim = await g(tk.access_token, "GET", "/users/me/calendarList/primary");
    const cals = await asegurarCalendarios(tk.access_token, previa || {});
    const { error } = await db.from("google_cuentas").upsert({
      profesional_id: st.profesional_id, user_id: st.user_id, email: prim?.id || "", refresh_token: refresh,
      ...cals, compartido_con: previa?.compartido_con || "", actualizado: new Date().toISOString(),
    });
    if (error) throw new Err(500, error.message);
    // copiar los turnos que ya están cargados de acá en adelante
    try { await syncDesdeHoy(st.profesional_id); } catch (_) { /* se copian al guardar */ }
    return back("ok");
  } catch (e) {
    return back("error", (e as Error).message);
  }
}

async function estado(p: Personal, b: any) {
  const ids: string[] = Array.isArray(b.profesional_ids) ? b.profesional_ids : [b.profesional_id || p.profesional_id].filter(Boolean);
  const out: Record<string, unknown> = {};
  for (const id of ids) {
    if (!(await puedeGestionar(p, id))) continue;
    const c = await cuenta(id);
    out[id] = c ? { conectado: true, email: c.email, compartido_con: c.compartido_con } : { conectado: false };
  }
  return { estado: out, configurado: !!(CLIENT_ID && CLIENT_SECRET) };
}

async function compartir(p: Personal, b: any) {
  const profId = b.profesional_id || p.profesional_id;
  const email = String(b.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Err(400, "Revisá el email.");
  if (!(await puedeGestionar(p, profId))) throw new Err(403, "Solo podés compartir tu propia agenda.");
  const c = await cuenta(profId);
  if (!c) throw new Err(400, "Primero conectá Google Calendar.");
  const at = await accessToken(c);
  const cals = await asegurarCalendarios(at, c);
  await g(at, "POST", "/calendars/" + encodeURIComponent(cals.cal_turnos) + "/acl?sendNotifications=true", { role: "reader", scope: { type: "user", value: email } });
  await g(at, "POST", "/calendars/" + encodeURIComponent(cals.cal_familia) + "/acl?sendNotifications=true", { role: "writer", scope: { type: "user", value: email } });
  const lista = [...new Set([...(c.compartido_con ? c.compartido_con.split(",") : []), email])].join(",");
  await db.from("google_cuentas").update({ ...cals, compartido_con: lista, actualizado: new Date().toISOString() }).eq("profesional_id", profId);
  return { ok: true, compartido_con: lista };
}

async function dejarDeCompartir(p: Personal, b: any) {
  const profId = b.profesional_id || p.profesional_id;
  const email = String(b.email || "").trim().toLowerCase();
  if (!(await puedeGestionar(p, profId))) throw new Err(403, "Solo podés cambiar tu propia agenda.");
  const c = await cuenta(profId);
  if (!c) return { ok: true };
  const at = await accessToken(c);
  for (const cal of [c.cal_turnos, c.cal_familia]) {
    if (!cal) continue;
    try { await g(at, "DELETE", "/calendars/" + encodeURIComponent(cal) + "/acl/" + encodeURIComponent("user:" + email)); } catch (_) { /* ya no estaba */ }
  }
  const lista = (c.compartido_con || "").split(",").filter((x) => x && x !== email).join(",");
  await db.from("google_cuentas").update({ compartido_con: lista }).eq("profesional_id", profId);
  return { ok: true, compartido_con: lista };
}

async function escribirTurno(at: string, c: Cuenta, t: any, sedes: Map<string, any>) {
  const id = eventoId(t.id);
  const cal = encodeURIComponent(c.cal_turnos!);
  if (t.estado === "cancelado") {
    try { await g(at, "DELETE", `/calendars/${cal}/events/${id}`); } catch (e) { if (![404, 410].includes((e as Err).status)) throw e; }
    return "borrado";
  }
  const se = sedes.get(t.sede_id) || {};
  const ev = {
    id, status: "confirmed", summary: "Ocupado – consultorio" + (se.nombre ? " " + se.nombre : ""),
    location: se.direccion || undefined, description: "Turno en RN Odontología.",
    start: { dateTime: new Date(t.inicio).toISOString(), timeZone: TZ },
    end: { dateTime: new Date(t.fin).toISOString(), timeZone: TZ },
    transparency: "opaque", reminders: { useDefault: false },
  };
  try { await g(at, "PUT", `/calendars/${cal}/events/${id}`, ev); }
  catch (e) { if ((e as Err).status === 404) await g(at, "POST", `/calendars/${cal}/events`, ev); else throw e; }
  return "ok";
}
async function mapaSedes() {
  const { data } = await db.from("sedes").select("*");
  return new Map((data || []).map((s: any) => [s.id, s]));
}

async function sync(p: Personal, b: any) {
  if (b.turno_id) {
    const { data: t } = await db.from("turnos").select("*").eq("id", b.turno_id).maybeSingle();
    if (!t) return { ok: true, nada: true };
    if (!puedeSede(p, t.sede_id)) throw new Err(403, "Sin acceso a esa sede.");
    if (!t.profesional_id) return { ok: true, nada: true };
    const c = await cuenta(t.profesional_id);
    if (!c || !c.cal_turnos) return { ok: true, sinGoogle: true };
    return { ok: true, resultado: await escribirTurno(await accessToken(c), c, t, await mapaSedes()) };
  }
  if (b.borrado && b.borrado.id && b.borrado.profesional_id) {
    const pr = await profesional(b.borrado.profesional_id);
    if (!puedeSede(p, pr.sede_id)) throw new Err(403, "Sin acceso a esa sede.");
    const c = await cuenta(pr.id);
    if (!c || !c.cal_turnos) return { ok: true, sinGoogle: true };
    const { data: sigue } = await db.from("turnos").select("id,profesional_id").eq("id", b.borrado.id).maybeSingle();
    if (sigue && sigue.profesional_id === b.borrado.profesional_id) return { ok: true, nada: true };
    return { ok: true, resultado: await escribirTurno(await accessToken(c), c, { id: b.borrado.id, estado: "cancelado" }, new Map()) };
  }
  if (b.todo) {
    const profId = b.profesional_id || p.profesional_id;
    if (!(await puedeGestionar(p, profId))) throw new Err(403, "Solo podés sincronizar tu propia agenda.");
    return { ok: true, copiados: await syncDesdeHoy(profId) };
  }
  throw new Err(400, "Nada para sincronizar.");
}
async function syncDesdeHoy(profId: string) {
  const c = await cuenta(profId);
  if (!c || !c.cal_turnos) return 0;
  const at = await accessToken(c);
  const sedes = await mapaSedes();
  const desde = new Date(); desde.setHours(0, 0, 0, 0);
  const { data } = await db.from("turnos").select("*").eq("profesional_id", profId).gte("inicio", desde.toISOString()).order("inicio").limit(500);
  let n = 0;
  for (const t of data || []) { await escribirTurno(at, c, t, sedes); n++; }
  return n;
}

function aIso(x: any, fin: boolean) {
  if (x.dateTime) return new Date(x.dateTime).toISOString();
  // evento de día completo: 00:00 hora Argentina
  return new Date(x.date + "T00:00:00-03:00").toISOString();
}
async function familia(p: Personal, b: any) {
  const ids: string[] = Array.isArray(b.profesional_ids) ? b.profesional_ids.slice(0, 20) : [];
  const desde = new Date(b.desde), hasta = new Date(b.hasta);
  if (isNaN(+desde) || isNaN(+hasta)) throw new Err(400, "Fechas inválidas.");
  const out: any[] = [];
  for (const id of ids) {
    let pr; try { pr = await profesional(id); } catch (_) { continue; }
    if (!puedeSede(p, pr.sede_id)) continue;
    const c = await cuenta(id);
    if (!c || !c.cal_familia) continue;
    const verTitulo = p.rol === "admin" || p.profesional_id === id;
    try {
      const at = await accessToken(c);
      const q = new URLSearchParams({ timeMin: desde.toISOString(), timeMax: hasta.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
      const r = await g(at, "GET", "/calendars/" + encodeURIComponent(c.cal_familia) + "/events?" + q.toString());
      for (const e of r?.items || []) {
        if (e.status === "cancelled" || !e.start || !e.end) continue;
        out.push({ profesional_id: id, titulo: verTitulo ? (e.summary || "Fecha familiar") : "No disponible", inicio: aIso(e.start, false), fin: aIso(e.end, true), todo_el_dia: !e.start.dateTime });
      }
    } catch (_) { /* si Google falla, la agenda sigue andando */ }
  }
  return { eventos: out };
}

async function desconectar(p: Personal, b: any) {
  const profId = b.profesional_id || p.profesional_id;
  if (!(await puedeGestionar(p, profId))) throw new Err(403, "Solo podés desconectar tu propia agenda.");
  const c = await cuenta(profId);
  if (c) {
    try { await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(c.refresh_token), { method: "POST" }); } catch (_) { /* igual se borra */ }
    await db.from("google_cuentas").delete().eq("profesional_id", profId);
  }
  return { ok: true };
}

const ACCIONES: Record<string, (p: Personal, b: any) => Promise<unknown>> = { conectar, estado, compartir, dejar_de_compartir: dejarDeCompartir, sync, familia, desconectar };

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("error"))) return await vuelta(url);
    if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
    const b = await req.json().catch(() => ({}));
    const fn = ACCIONES[b.accion];
    if (!fn) return json({ error: "Acción desconocida" }, 400);
    const p = await usuario(req);
    return json(await fn(p, b));
  } catch (e) {
    const st = e instanceof Err ? e.status : 500;
    return json({ error: (e as Error).message }, st >= 400 && st < 600 ? st : 500);
  }
}

if (!Deno.env.get("GCAL_TEST")) Deno.serve(handler);
