// ============================================================
// Census Alert · Lógica del formulario
// ============================================================
import {
  APPS_SCRIPT_URL,
  MAX_RUCS_ADICIONALES,
  MAX_EMAILS_ADICIONALES,
} from "../config.js";
import {
  AsYouType,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
} from "libphonenumber-js/min";

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
    const tipoId = `tipo_add_${rucCounter}`;
    const fechaId = `fecha_nac_add_${rucCounter}`;
    const fechaRowId = `fecha_nac_add_row_${rucCounter}`;
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `
      <label class="lbl ruc-label" for="${id}">RUC/CI adicional</label>
      <div class="ruc-block">
        <div class="tipo-col">
          <select id="${tipoId}" class="tipo-doc tipo-add" data-target="${id}" aria-label="Tipo de documento">
            <option value="RUC" selected>RUC</option>
            <option value="CI">CI</option>
          </select>
        </div>
        <div class="ruc-col">
          <input type="text" id="${id}" class="ruc-add" required
                 maxlength="13" inputmode="numeric" placeholder="Número" />
        </div>
        <div class="alias-col">
          <input type="text" id="${aliasId}" class="alias-add"
                 placeholder="Razón Social / Nombre y Apellido (Opcional)" />
        </div>
        <div class="rm-col">
          <button type="button" class="btn-remove" title="Eliminar">✕</button>
        </div>
      </div>
      <div class="err-msg" data-for="${id}">El RUC debe tener 13 dígitos. La CI debe tener 10 dígitos.</div>
      <div class="fecha-nac-row" id="${fechaRowId}" hidden>
        <label class="lbl" for="${fechaId}">Fecha de nacimiento <span class="req">*</span></label>
        <input type="date" id="${fechaId}" class="fecha-nac fecha-nac-add" data-target="${id}" />
        <div class="err-msg" data-for="${fechaId}">Ingrese la fecha de nacimiento.</div>
      </div>
    `;
    wrap.querySelector(".btn-remove").addEventListener("click", () => {
      wrap.remove();
      refreshRucNumbers();
      actualizarBotonRuc();
    });
    // Hook del tipo selector → toggle fecha + maxlength del número
    const tipoSel = wrap.querySelector(".tipo-doc");
    const numInput = wrap.querySelector(".ruc-add");
    const fechaRow = wrap.querySelector(".fecha-nac-row");
    const fechaInp = wrap.querySelector(".fecha-nac-add");
    tipoSel.addEventListener("change", () =>
      aplicarTipoDoc(tipoSel, numInput, fechaRow, fechaInp)
    );
    aplicarTipoDoc(tipoSel, numInput, fechaRow, fechaInp);
    rucsContainer.appendChild(wrap);
    refreshRucNumbers();
    actualizarBotonRuc();
  }

  // Helper compartido: aplica reglas según tipo (RUC | CI)
  function aplicarTipoDoc(tipoSel, numInput, fechaRow, fechaInput) {
    const isCI = tipoSel.value === "CI";
    fechaRow.hidden = !isCI;
    fechaInput.required = isCI;
    if (!isCI) fechaInput.value = "";
    numInput.maxLength = isCI ? 10 : 13;
    // Set max=hoy a la fecha de nacimiento (no permite fechas futuras)
    if (isCI && !fechaInput.max) {
      fechaInput.max = new Date().toISOString().split("T")[0];
    }
  }
  btnAddRuc.addEventListener("click", agregarRuc);

  // --- Selector tipo (RUC/CI) del bloque principal ---
  const tipoPrincipal = $("#tipo_principal");
  const rucPrincipalInput = $("#ruc_principal");
  const fechaPrincipalRow = $("#fecha_nac_principal_row");
  const fechaPrincipalInput = $("#fecha_nac_principal");
  fechaPrincipalInput.max = new Date().toISOString().split("T")[0];
  tipoPrincipal.addEventListener("change", () =>
    aplicarTipoDoc(tipoPrincipal, rucPrincipalInput, fechaPrincipalRow, fechaPrincipalInput)
  );

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

  // ---------- Teléfono: selector país buscable + formato as-you-type ----------
  const telInput = $("#telefono");
  const telCountry = $("#phone-country");

  function formatearTelefono() {
    const country = telCountry.value;
    const digits = telInput.value.replace(/[^\d]/g, "").replace(/^0+/, "");
    if (!digits) {
      telInput.value = "";
      return;
    }
    const formatted = new AsYouType(country).input(digits);
    telInput.value = formatted.replace(/^0\s*/, "");
  }

  telInput.addEventListener("input", formatearTelefono);
  telCountry.addEventListener("change", () => {
    formatearTelefono();
    telInput.focus();
  });

  // --- Dropdown custom buscable ---
  initPhoneCountrySelect(telCountry);

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

    const telVal = telInput.value.trim();
    const telCountryVal = telCountry.value;
    if (!telVal || !isValidPhoneNumber(telVal, telCountryVal)) {
      marcar("telefono");
    }

    // RUC/CI principal — regex según tipo elegido
    const tipoP = $("#tipo_principal").value;
    const numP = $("#ruc_principal").value.trim();
    const reP = tipoP === "CI" ? /^[0-9]{10}$/ : /^[0-9]{13}$/;
    if (!reP.test(numP)) marcar("ruc_principal");
    if (tipoP === "CI") {
      const fechaP = $("#fecha_nac_principal").value;
      if (!fechaP || isNaN(new Date(fechaP).getTime())) {
        marcar("fecha_nac_principal");
      }
    }

    // RUC/CI adicionales — regex según tipo + fecha si CI
    $$("#rucs-adicionales .ruc-block").forEach((blk) => {
      const tipo = blk.querySelector(".tipo-doc").value;
      const numInp = blk.querySelector(".ruc-add");
      const re = tipo === "CI" ? /^[0-9]{10}$/ : /^[0-9]{13}$/;
      if (!re.test(numInp.value.trim())) {
        numInp.classList.add("error");
        const em = document.querySelector(`.err-msg[data-for="${numInp.id}"]`);
        if (em) em.classList.add("show");
        if (!firstErrorEl) firstErrorEl = numInp;
        ok = false;
      } else {
        numInp.classList.remove("error");
        const em = document.querySelector(`.err-msg[data-for="${numInp.id}"]`);
        if (em) em.classList.remove("show");
      }
      if (tipo === "CI") {
        const fechaInp = blk.parentElement.querySelector(".fecha-nac-add");
        if (fechaInp && (!fechaInp.value || isNaN(new Date(fechaInp.value).getTime()))) {
          fechaInp.classList.add("error");
          const em = document.querySelector(`.err-msg[data-for="${fechaInp.id}"]`);
          if (em) em.classList.add("show");
          if (!firstErrorEl) firstErrorEl = fechaInp;
          ok = false;
        } else if (fechaInp) {
          fechaInp.classList.remove("error");
          const em = document.querySelector(`.err-msg[data-for="${fechaInp.id}"]`);
          if (em) em.classList.remove("show");
        }
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
    const rucs_adicionales = $$("#rucs-adicionales .ruc-block").map((blk) => {
      const tipo = blk.querySelector(".tipo-doc").value;
      const fechaInp = blk.parentElement.querySelector(".fecha-nac-add");
      return {
        ruc: blk.querySelector(".ruc-add").value.trim(),
        alias: blk.querySelector(".alias-add").value.trim(),
        tipo,
        fecha_nacimiento: tipo === "CI" && fechaInp ? fechaInp.value : "",
      };
    });
    const correos_adicionales = $$(".email-add")
      .map((i) => i.value.trim())
      .filter(Boolean);
    const correos_alertas = [$("#correo_principal").value.trim(), ...correos_adicionales]
      .filter(Boolean)
      .join(", ");

    // Teléfono: parsear y guardar en formato E.164 (ej. +593960511029, sin espacios)
    const telParsed = parsePhoneNumberFromString(
      $("#telefono").value.trim(),
      $("#phone-country").value
    );
    const telefonoFinal = telParsed
      ? telParsed.number   // formato E.164: "+593960511029"
      : $("#telefono").value.trim();

    return {
      nombre: $("#nombre").value.trim(),
      cargo: $("#cargo").value.trim(),
      empresa: $("#empresa").value.trim(),
      email: $("#email").value.trim(),
      telefono: telefonoFinal,
      ruc_principal: $("#ruc_principal").value.trim(),
      tipo_doc_principal: $("#tipo_principal").value,
      fecha_nac_principal:
        $("#tipo_principal").value === "CI"
          ? $("#fecha_nac_principal").value
          : "",
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

// ============================================================
// Selector de país buscable (custom dropdown)
// ============================================================
function isoToFlag(iso) {
  // Convierte "EC" → "🇪🇨" usando los Regional Indicator Symbols Unicode
  if (!iso || iso.length !== 2) return "🌐";
  return iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function buildCountryList() {
  // Nombres en español sin depender de paquetes — API nativa del browser
  let regionNames;
  try {
    regionNames = new Intl.DisplayNames(["es"], { type: "region" });
  } catch {
    regionNames = null;
  }

  const list = getCountries()
    .map((iso) => {
      let dial = "";
      try {
        dial = "+" + getCountryCallingCode(iso);
      } catch {
        return null;
      }
      let name = iso;
      if (regionNames) {
        try { name = regionNames.of(iso) || iso; } catch { /* ignore */ }
      }
      return {
        iso,
        name,
        dial,
        flag: isoToFlag(iso),
        // string normalizado para búsqueda: sin acentos, lowercase
        searchKey: (name + " " + iso + " " + dial + " " + dial.replace("+", ""))
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, ""),
      };
    })
    .filter(Boolean);

  // Ordenar alfabéticamente por nombre, locale-aware
  list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return list;
}

function initPhoneCountrySelect(hiddenInput) {
  const trigger = document.getElementById("phone-trigger");
  const popup = document.getElementById("phone-popup");
  const search = document.getElementById("phone-search");
  const listEl = document.getElementById("phone-list");
  const emptyEl = document.getElementById("phone-empty");
  const flagSpan = document.getElementById("phone-flag");
  const dialSpan = document.getElementById("phone-dial");
  if (!trigger) return;

  const countries = buildCountryList();
  let filtered = countries;
  let highlightIdx = -1;

  function setCountry(iso, dispatch = true) {
    const c = countries.find((x) => x.iso === iso);
    if (!c) return;
    hiddenInput.value = iso;
    flagSpan.textContent = c.flag;
    dialSpan.textContent = c.dial;
    if (dispatch) {
      hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function renderList(filter = "") {
    const q = filter
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    filtered = q
      ? countries.filter((c) => c.searchKey.includes(q))
      : countries;
    highlightIdx = -1;
    if (filtered.length === 0) {
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    const selectedIso = hiddenInput.value;
    listEl.innerHTML = filtered
      .map(
        (c, i) => `
        <div class="phone-item${c.iso === selectedIso ? " selected" : ""}"
             role="option" data-iso="${c.iso}" data-i="${i}">
          <span class="item-flag">${c.flag}</span>
          <span class="item-name">${c.name}</span>
          <span class="item-dial">${c.dial}</span>
        </div>`
      )
      .join("");
  }

  function highlight(idx) {
    const items = listEl.querySelectorAll(".phone-item");
    items.forEach((it) => it.classList.remove("highlighted"));
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add("highlighted");
      items[idx].scrollIntoView({ block: "nearest" });
      highlightIdx = idx;
    }
  }

  function openPopup() {
    popup.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    search.value = "";
    renderList();
    setTimeout(() => search.focus(), 0);
  }
  function closePopup() {
    popup.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }
  function togglePopup() {
    if (popup.hidden) openPopup();
    else closePopup();
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePopup();
  });
  search.addEventListener("input", (e) => renderList(e.target.value));
  search.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlight(Math.min(highlightIdx + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlight(Math.max(highlightIdx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[highlightIdx] || filtered[0];
      if (target) {
        setCountry(target.iso);
        closePopup();
      }
    } else if (e.key === "Escape") {
      closePopup();
      trigger.focus();
    }
  });
  listEl.addEventListener("click", (e) => {
    const item = e.target.closest(".phone-item");
    if (item) {
      setCountry(item.dataset.iso);
      closePopup();
      document.getElementById("telefono").focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!popup.hidden && !document.getElementById("phone-select").contains(e.target)) {
      closePopup();
    }
  });

  // Inicializar con Ecuador (o lo que ya tenga el hidden input)
  setCountry(hiddenInput.value || "EC", false);
}
