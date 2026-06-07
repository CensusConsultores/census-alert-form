// ============================================================
// Configuración global del cliente Census Alert
// ------------------------------------------------------------
// SUBMIT_URL es relativo: el form hace POST al endpoint API route
// del mismo dominio Vercel (src/pages/api/submit.ts), que escribe
// directo en la BD de census-tracking-web (Render).
// Reemplaza el flujo anterior vía Google Apps Script + Sheet.
// ============================================================

export const SUBMIT_URL = '/api/submit';

export const MAX_RUCS_ADICIONALES = 10;
export const MAX_EMAILS_ADICIONALES = 5;

export const SOURCES_EMAIL_LOPDP = 'info@censusconsultores.com.ec';
