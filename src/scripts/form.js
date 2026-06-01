// ============================================================
// Census Alert · Lógica del formulario
// ============================================================
import {
  APPS_SCRIPT_URL,
  MAX_RUCS_ADICIONALES,
  MAX_EMAILS_ADICIONALES,
} from "../config.js";

const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

// RUC (13) o CI (10): solo dígitos
const RE_RUC_CI = /^[0-9]{10}(?:[0-9]{3})?$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- helpers de error ----------
function showErr(field) {
  const el = document.querySelector(`.err-msg[data-for="${field}"]`);
  if (el) el.classList.add("show");
  const input = document.getElementById(field);
  if (input) input.classList.add("error");
}
function hideErr(field) {
  const el = document.querySelector(`.err-msg[data-for="${field}"]`);
  if (el) el.classList.remove("show");
  const input = document.getElementById(field);
  if (input) input.classList.remove("error");
}

// ============================================================
// Init — se ejecuta cuando el form existe en el DOM
// ============================================================
export function initCensusForm() {
  const form = $("#census-form");
  if (!form) return;

  // ---------- RUCs/CI dinámicos ----------
  let rucCounter = 0;
  const rucsContainer = $("#rucs-adicionales");
  const btnAddRuc = $("#btn-add-ruc");
  const hintMaxRuc = $("#hint-max");

  function refreshRucNumbers() {
    $$("#rucs-adicionales .ruc-block").forEach((blk, idx) => {
      const lbl = blk.parentElement.querySelector(".ruc-label");
      if (lbl) lbl.textContent = `RUC/CI adicional ${idx + 1}`;
    });
  }
  function actualizarBotonRuc() {
    const count = $$("#rucs-adicionales .ruc-block").length;
    if (count >= MAX_RUCS_ADICIONALES) {
      btnAddRuc.disabled = true;
      hintMaxRuc.style.display = "block";
    } else {
      btnAddRuc.disabled = false;
      hintMaxRuc.style.display = "none";
    }
  }
  function agregarRuc() {
    if ($$("#rucs-adicionales .ruc-block").length >= MAX_RUCS_ADICIONALES) return;
    rucCounter++;
    const id = `ruc_add_${rucCounter}`;
    const aliasId = `alias_add_${rucCounter}`;
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `
      <label class="lbl ruc-label" for="${id}">RUC/CI adicional</label>
      <div class="ruc-block">
        <div class="ruc-col">
          <input type="text" id="${id}" class="ruc-add" required
                 maxlength="13" inputmode="numeric" placeholder="RUC o CI" />
        </div>
        <div class="alias-col">
          <input type="text" id="${aliasId}" class="alias-add"
                 placeholder="Razón Social / Nombre y Apellido (Opcional)" />
        </div>
        <div class="rm-col">
          <button type="button" class="btn-remove" title="Eliminar">✕</button>
        </div>
      </div>
      <div class="err-msg" data-for="${id}">Debe ser un número de 10 dígitos (CI) o 13 dígitos (RUC).</div>
    `;
    wrap.querySelector(".btn-remove").addEventListener("click", () => {
      wrap.remove();
      refreshRucNumbers();
      actualizarBotonRuc();
    });
    rucsContainer.appendChild(wrap);
    refreshRucNumbers();
    actualizarBotonRuc();
  }
  btnAddRuc.addEventListener("click", agregarRuc);

  // ---------- Emails adicionales ----------
  let emailCounter = 0;
  const emailsContainer = $("#emails-adicionales");
  const emailsWrap = $("#emails-add-wrap");
  const btnAddEmail = $("#btn-add-email");
  const hintMaxEmails = $("#hint-max-emails");

  function actualizarBotonEmail() {
    const count = $$("#emails-adicionales .email-row").length;
    if (count >= MAX_EMAILS_ADICIONALES) {
      btnAddEmail.disabled = true;
      hintMaxEmails.style.display = "block";
    } else {
      btnAddEmail.disabled = false;
      hintMaxEmails.style.display = "none";
    }
    if (count > 0) emailsWrap.classList.add("show");
    else emailsWrap.classList.remove("show");
  }
  function agregarEmail() {
    if ($$("#emails-adicionales .email-row").length >= MAX_EMAILS_ADICIONALES) return;
    emailCounter++;
    const id = `email_add_${emailCounter}`;
    const row = document.createElement("div");
    row.className = "email-row";
    row.innerHTML = `
      <input type="email" id="${id}" class="email-add" placeholder="ejemplo@empresa.com" />
      <div class="rm-col">
        <button type="button" class="btn-remove" title="Eliminar correo">✕</button>
      </div>
    `;
    row.querySelector(".btn-remove").addEventListener("click", () => {
      row.remove();
      actualizarBotonEmail();
    });
    emailsContainer.appendChild(row);
    actualizarBotonEmail();
  }
  btnAddEmail.addEventListener("click", agregarEmail);

  // ---------- limpieza errores on input/change ----------
  document.addEventListener("input", (e) => {
    if (e.target.id) hideErr(e.target.id);
  });
  document.addEventListener("change", (e) => {
    if (e.target.name === "fuentes") hideErr("fuentes");
    if (["acepto_tyc", "acepto_lopdp"].includes(e.target.name)) hideErr("legales");
  });

  // ---------- validación ----------
  function validar() {
    let ok = true;
    let firstErrorEl = null;
    const marcar = (field) => {
      showErr(field);
      if (!firstErrorEl) {
        firstErrorEl =
          document.querySelector(`.err-msg[data-for="${field}"]`) ||
          document.getElementById(field);
      }
      ok = false;
    };

    if ($("#nombre").value.trim().length < 3) marcar("nombre");
    if ($("#cargo").value.trim().length < 2) marcar("cargo");
    if ($("#empresa").value.trim().length < 2) marcar("empresa");
    if (!RE_EMAIL.test($("#email").value.trim())) marcar("email");

    const telDigits = $("#telefono").value.replace(/\D/g, "");
    if (telDigits.length < 7) marcar("telefono");

    if (!RE_RUC_CI.test($("#ruc_principal").value.trim())) marcar("ruc_principal");

    $$(".ruc-add").forEach((inp) => {
      const v = inp.value.trim();
      if (!RE_RUC_CI.test(v)) {
        inp.classList.add("error");
        const em = document.querySelector(`.err-msg[data-for="${inp.id}"]`);
        if (em) em.classList.add("show");
        if (!firstErrorEl) firstErrorEl = inp;
        ok = false;
      } else {
        inp.classList.remove("error");
        const em = document.querySelector(`.err-msg[data-for="${inp.id}"]`);
        if (em) em.classList.remove("show");
      }
    });

    const fuentes = $$('input[name="fuentes"]:checked').map((c) => c.value);
    if (fuentes.length === 0) marcar("fuentes");

    if (!RE_EMAIL.test($("#correo_principal").value.trim())) marcar("correo_principal");

    $$(".email-add").forEach((inp) => {
      const v = inp.value.trim();
      if (v && !RE_EMAIL.test(v)) {
        inp.classList.add("error");
        if (!firstErrorEl) firstErrorEl = inp;
        ok = false;
      } else {
        inp.classList.remove("error");
      }
    });

    const tyc = $("#acepto_tyc").checked;
    const lopdp = $("#acepto_lopdp").checked;
    if (!(tyc && lopdp)) {
      const el = document.querySelector('.err-msg[data-for="legales"]');
      if (el) el.classList.add("show");
      if (!firstErrorEl) firstErrorEl = el;
      ok = false;
    }

    if (!ok && firstErrorEl) {
      firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return ok;
  }

  // ---------- payload ----------
  function construirPayload() {
    const rucs_adicionales = $$("#rucs-adicionales .ruc-block").map((blk) => ({
      ruc: blk.querySelector(".ruc-add").value.trim(),
      alias: blk.querySelector(".alias-add").value.trim(),
    }));
    const correos_adicionales = $$(".email-add")
      .map((i) => i.value.trim())
      .filter(Boolean);
    const correos_alertas = [$("#correo_principal").value.trim(), ...correos_adicionales]
      .filter(Boolean)
      .join(", ");

    return {
      nombre: $("#nombre").value.trim(),
      cargo: $("#cargo").value.trim(),
      empresa: $("#empresa").value.trim(),
      email: $("#email").value.trim(),
      telefono: $("#telefono").value.trim(),
      ruc_principal: $("#ruc_principal").value.trim(),
      razon_social_principal: $("#alias_principal").value.trim(),
      rucs_adicionales,
      fuentes: $$('input[name="fuentes"]:checked').map((c) => c.value),
      correo_principal: $("#correo_principal").value.trim(),
      correos_adicionales,
      correos_alertas,
      acepto_tyc: $("#acepto_tyc").checked,
      acepto_lopdp: $("#acepto_lopdp").checked,
      website: $("#hp-website").value,
    };
  }

  async function enviar(payload) {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || "Error desconocido");
    return json;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validar()) return;

    const btn = $("#btn-submit");
    btn.disabled = true;
    const labelOriginal = btn.textContent;
    btn.textContent = "Enviando…";

    try {
      await enviar(construirPayload());
      $("#form-container").style.display = "none";
      $("#final-ok").style.display = "block";
      $("#final-ok").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error("Error envío:", err);
      $("#final-err").style.display = "block";
      $("#final-err").scrollIntoView({ behavior: "smooth", block: "start" });
      btn.disabled = false;
      btn.textContent = labelOriginal;
    }
  });
}
