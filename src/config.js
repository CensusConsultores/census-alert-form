// ============================================================
// Configuración global del cliente Census Alert
// ------------------------------------------------------------
// La URL del Apps Script se lee de la env var PUBLIC_APPS_SCRIPT_URL
// (definida en .env localmente y en Vercel → Settings → Env Variables).
// Si no está definida, falla el build con error claro.
// ============================================================

const url = import.meta.env.PUBLIC_APPS_SCRIPT_URL;
if (!url) {
  throw new Error(
    "Falta la env var PUBLIC_APPS_SCRIPT_URL. " +
    "Definila en .env (local) o en Vercel → Settings → Environment Variables."
  );
}

export const APPS_SCRIPT_URL = url;

export const MAX_RUCS_ADICIONALES = 10;
export const MAX_EMAILS_ADICIONALES = 5;

export const SOURCES_EMAIL_LOPDP = 'comercial@censusconsultores.com.ec';
