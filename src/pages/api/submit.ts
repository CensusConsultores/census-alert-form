/**
 * POST /api/submit
 * ================
 * Recibe el payload del form de Census Alert y lo persiste en la BD de
 * census-tracking (tabla solicitudes_census_alert).
 *
 * Server-side: corre como Vercel serverless function. La env var
 * DATABASE_URL queda en el servidor, nunca llega al cliente.
 *
 * Mismo dominio que el form → sin CORS necesario.
 *
 * Reemplaza el flujo previo: form → Apps Script → Sheet → manual sync.
 */
import type { APIRoute } from 'astro';
import pg from 'pg';

export const prerender = false;

// Pool de conexiones reutilizable entre invocaciones tibias del Vercel function.
// Vercel mantiene el módulo cargado entre requests cercanos en el tiempo.
let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = import.meta.env.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta env var DATABASE_URL');
  }
  pool = new pg.Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
    max: 3, // Vercel hobby: pocas funciones concurrentes; suficiente para 10/día
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  return pool;
}

interface DocAlerta {
  ruc: string;
  tipo: 'NATURAL' | 'JURIDICO' | string;
  fecha_nacimiento?: string;
  alias?: string;
}

interface SubmitPayload {
  nombre?: string;
  cargo?: string;
  empresa?: string;
  email?: string;
  telefono?: string;
  nombre_grupo?: string;
  // Formato nuevo unificado:
  docs_alertas?: DocAlerta[];
  // Formato legacy (se transforma a docs_alertas internamente):
  ruc_principal?: string;
  tipo_doc_principal?: string;
  fecha_nac_principal?: string;
  razon_social_principal?: string;
  rucs_adicionales?: DocAlerta[];
  fuentes?: string[];
  correo_principal?: string;
  correos_adicionales?: string[];
  correos_alertas?: string;
  acepto_tyc?: boolean;
  acepto_lopdp?: boolean;
  website?: string; // honeypot anti-bot
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// Normaliza el payload a la forma canónica { docs_alertas: [...] }.
// Si llega el formato legacy (ruc_principal por separado + rucs_adicionales),
// lo convierte. Si llega el formato nuevo, lo usa tal cual.
function normalizarDocs(p: SubmitPayload): DocAlerta[] {
  if (Array.isArray(p.docs_alertas) && p.docs_alertas.length > 0) {
    return p.docs_alertas;
  }
  const out: DocAlerta[] = [];
  if (p.ruc_principal) {
    out.push({
      ruc: String(p.ruc_principal).trim(),
      tipo: (p.tipo_doc_principal || 'JURIDICO').toUpperCase(),
      fecha_nacimiento: p.fecha_nac_principal || '',
      alias: p.razon_social_principal || '',
    });
  }
  for (const a of p.rucs_adicionales || []) {
    if (a && a.ruc) out.push(a);
  }
  return out;
}

// Lista deduplicada de correos: principal + adicionales. Si vino correos_alertas
// pre-armado por el form actual, lo respeta también.
function normalizarCorreos(p: SubmitPayload): string[] {
  const todos: string[] = [];
  if (p.correo_principal) todos.push(p.correo_principal);
  for (const c of p.correos_adicionales || []) todos.push(c);
  if (p.correos_alertas) {
    for (const c of String(p.correos_alertas).split(',')) todos.push(c);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of todos) {
    const e = String(raw).trim().toLowerCase();
    if (e && RE_EMAIL.test(e) && !seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  }
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  let payload: SubmitPayload;
  try {
    payload = (await request.json()) as SubmitPayload;
  } catch {
    return jsonResponse({ ok: false, error: 'JSON inválido' }, 400);
  }

  // Honeypot anti-bot: si vino lleno, responder ok sin guardar nada.
  if (payload.website) {
    return jsonResponse({ ok: true });
  }

  // Validación mínima de shape (lo grueso lo hace el form, esto es defensa).
  const nombre = (payload.nombre || '').trim();
  const email = (payload.email || '').trim();
  const nombre_grupo = (payload.nombre_grupo || '').trim();
  if (!nombre || !RE_EMAIL.test(email) || !nombre_grupo) {
    return jsonResponse({ ok: false, error: 'Faltan campos obligatorios o email inválido' }, 400);
  }

  const docs = normalizarDocs(payload);
  if (docs.length === 0) {
    return jsonResponse({ ok: false, error: 'docs_alertas vacío' }, 400);
  }

  const fuentes = Array.isArray(payload.fuentes) ? payload.fuentes : [];
  if (fuentes.length === 0) {
    return jsonResponse({ ok: false, error: 'fuentes vacío' }, 400);
  }

  const correos = normalizarCorreos(payload);

  // Auditoría: IP y UA (Vercel los pone en headers).
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
  const ua = request.headers.get('user-agent') || '';

  try {
    const client = await getPool().connect();
    try {
      const result = await client.query(
        `INSERT INTO solicitudes_census_alert
           (nombre, cargo, empresa, email, telefono, nombre_grupo,
            docs_alertas, fuentes, correos_alertas,
            acepto_tyc, acepto_lopdp, ip_origen, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13)
         RETURNING id`,
        [
          nombre,
          (payload.cargo || '').trim(),
          (payload.empresa || '').trim(),
          email,
          (payload.telefono || '').trim(),
          nombre_grupo,
          JSON.stringify(docs),
          JSON.stringify(fuentes),
          JSON.stringify(correos),
          !!payload.acepto_tyc,
          !!payload.acepto_lopdp,
          ip,
          ua,
        ]
      );
      return jsonResponse({ ok: true, id: result.rows[0].id });
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/submit] DB error:', msg);
    return jsonResponse({ ok: false, error: 'Error guardando solicitud' }, 503);
  }
};
