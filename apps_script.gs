// ============================================================
// Census Alert · Backend Apps Script
// ------------------------------------------------------------
// 1. doPost(e)         → recibe POST del formulario y agrega fila en la Sheet
// 2. enviarResumen()   → corre 4 veces/día (09:00, 12:00, 15:00, 18:00 hora EC)
//                        y manda UN correo con resumen de solicitudes nuevas
// 3. instalarTriggers() → CORRER UNA SOLA VEZ desde el editor para crear los
//                         disparadores temporales
// ============================================================

// ===== CONFIG =====
const DESTINATARIO = 'a.vasconez@censusconsultores.com.ec';   // ← cambiar / agregar separados por coma
const TZ = 'America/Guayaquil';
const COL_PROCESADO = 14;  // columna N (1-indexed) — header "procesado" en N1

// ============================================================
// 1) doPost — recibe el formulario
// ============================================================
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);

    // Honeypot anti-bot: si vino lleno, descartar pero responder ok
    if (data.website) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    sheet.appendRow([
      new Date(),                                                       // A · fecha_envio
      data.nombre || '',                                                // B · nombre
      data.cargo || '',                                                 // C · cargo
      data.empresa || '',                                               // D · empresa
      data.email || '',                                                 // E · email
      data.telefono || '',                                              // F · telefono
      data.ruc_principal || '',                                         // G · ruc_principal
      data.razon_social_principal || '',                                // H · razon_social_principal
      (data.rucs_adicionales || [])
        .map(r => `${r.ruc}:${r.alias || ''}`).join('; '),              // I · rucs_adicionales
      (data.fuentes || []).join(', '),                                  // J · fuentes
      data.correos_alertas || data.correo_principal || '',              // K · correos_alertas (CSV)
      data.acepto_tyc ? 'SÍ' : 'NO',                                    // L · acepto_tyc
      data.acepto_lopdp ? 'SÍ' : 'NO',                                  // M · acepto_lopdp
      ''                                                                // N · procesado (vacío hasta el digest)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// 2) enviarResumen — digest 4 veces al día
// ============================================================
function enviarResumen() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const range = sheet.getRange(2, 1, lastRow - 1, COL_PROCESADO);
  const values = range.getValues();

  // Filtrar filas pendientes (columna procesado vacía)
  const pendientes = [];
  values.forEach((row, idx) => {
    if (!row[COL_PROCESADO - 1]) {
      pendientes.push({ rowNum: idx + 2, data: row });
    }
  });

  if (pendientes.length === 0) {
    Logger.log('Sin solicitudes nuevas — no se envía resumen.');
    return;
  }

  const ahora = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();

  let filasHtml = '';
  pendientes.forEach(p => {
    const r = p.data;
    const fecha = Utilities.formatDate(new Date(r[0]), TZ, 'dd/MM HH:mm');
    filasHtml += `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${fecha}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r[3])}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r[1])}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r[4])}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r[6])}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r[9])}</td>
      </tr>`;
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:760px;">
      <div style="background:#1a1a0e;padding:14px 20px;color:#C9A84C;">
        <strong style="font-size:16px;letter-spacing:1px;">CENSUS ALERT · RESUMEN DE SOLICITUDES</strong>
      </div>
      <div style="height:3px;background:linear-gradient(90deg,#C9A84C,#8B6914);"></div>
      <div style="padding:20px;">
        <p>Resumen al <strong>${ahora}</strong> (hora Ecuador)</p>
        <p><strong>${pendientes.length}</strong>
           ${pendientes.length === 1 ? 'solicitud nueva' : 'solicitudes nuevas'}
           desde el último envío.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;">
          <thead>
            <tr style="background:#f5efdc;">
              <th style="padding:8px 10px;text-align:left;">Fecha</th>
              <th style="padding:8px 10px;text-align:left;">Empresa</th>
              <th style="padding:8px 10px;text-align:left;">Contacto</th>
              <th style="padding:8px 10px;text-align:left;">Email</th>
              <th style="padding:8px 10px;text-align:left;">RUC/CI</th>
              <th style="padding:8px 10px;text-align:left;">Fuentes</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
        <p style="margin-top:18px;">
          <a href="${sheetUrl}"
             style="background:#C9A84C;color:#1a1a0e;padding:9px 18px;
                    text-decoration:none;border-radius:4px;font-weight:bold;">
            Ver detalle completo en la Sheet
          </a>
        </p>
      </div>
    </div>`;

  MailApp.sendEmail({
    to: DESTINATARIO,
    subject: `[Census Alert] ${pendientes.length} solicitud${pendientes.length === 1 ? '' : 'es'} nueva${pendientes.length === 1 ? '' : 's'} · ${ahora}`,
    htmlBody: html,
  });

  // Marcar filas como procesadas
  const marca = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
  pendientes.forEach(p => {
    sheet.getRange(p.rowNum, COL_PROCESADO).setValue(marca);
  });

  Logger.log(`Resumen enviado: ${pendientes.length} solicitudes procesadas.`);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// 3) instalarTriggers — correr UNA SOLA VEZ desde el editor
// ============================================================
function instalarTriggers() {
  // Borrar disparadores previos de enviarResumen (para no duplicar)
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'enviarResumen') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 4 ventanas diarias: 09:00, 12:00, 15:00, 18:00 hora Ecuador
  [9, 12, 15, 18].forEach(hora => {
    ScriptApp.newTrigger('enviarResumen')
      .timeBased()
      .everyDays(1)
      .atHour(hora)
      .inTimezone(TZ)
      .create();
  });

  Logger.log('Triggers instalados: 09:00, 12:00, 15:00, 18:00 hora Ecuador.');
}
