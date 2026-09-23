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

// ============================================================
// Cifras del catálogo. Una sola fuente de verdad.
// ------------------------------------------------------------
// Son 31 CONSULTAS repartidas en 21 INSTITUCIONES: varias fuentes
// pertenecen al mismo organismo (el SRI se consulta por deuda firme,
// por estado del RUC y por contribuyente fantasma, etc.). Las dos
// cifras son ciertas y miden cosas distintas, así que se nombran
// siempre juntas: «31 fuentes en 21 instituciones».
//
// Antes cada sección traía su propio número escrito a mano y la página
// llegó a declarar 12, 19, 21, 29 y 31 a la vez. Si cambia el catálogo,
// se cambia aquí y en el array PORTALES de la portada. En ningún otro
// sitio.
// ============================================================

export const FUENTES = 31;
export const INSTITUCIONES = 21;

// ============================================================
// WhatsApp: el único canal de contacto.
// ------------------------------------------------------------
// Estaba escrito a mano en la portada. Las guías necesitan el mismo
// número y el mismo formato de mensaje, así que vive aquí.
// ============================================================

export const WHATSAPP = '593978863448';
export const DESDE_WEB = 'Hola, les escribo desde censusalert.com.';

export const wa = (mensaje) =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`${DESDE_WEB} ${mensaje}`)}`;

// Precios de entrada, para citarlos en el copy de las guías sin
// duplicar la tabla de tarifas de la portada (que manda).
export const PRECIO_INFORME_DESDE = '2,99';
export const PRECIO_VIGILANCIA_DESDE = '1,99';
