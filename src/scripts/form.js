// ============================================================
// Census Alert · Lógica del formulario
// ============================================================
import {
  SUBMIT_URL,
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

  // ---------- RUCs/CI dinámicos (lista unificada, primero obligatorio) ----------
  // El primer doc se crea al cargar el form y no tiene botón ✕.
  // Los siguientes se agregan/eliminan con los botones. Máximo MAX_RUCS_ADICIONALES + 1.
  let rucCounter = 0;
  const rucsContainer = $("#rucs-adicionales");
  const btnAddRuc = $("#btn-add-ruc");
  const hintMaxRuc = $("#hint-max");

  function refreshRucNumbers() {
    $$("#rucs-adicionales .ruc-block").forEach((blk, idx) => {
      const lbl = blk.parentElement.querySelector(".ruc-label");
      if (lbl) {
        // El primero es obligatorio → asterisco; los demás opcionales.
        lbl.innerHTML =
          idx === 0
            ? `RUC/CI 1 <span class="req">*</span>`
            : `RUC/CI ${idx + 1}`;
      }
    });
  }
  function actualizarBotonRuc() {
    // Hay 1 obligatorio + hasta MAX_RUCS_ADICIONALES adicionales = MAX+1 totales.
    const count = $$("#rucs-adicionales .ruc-block").length;
    if (count >= MAX_RUCS_ADICIONALES + 1) {
      btnAddRuc.disabled = true;
      hintMaxRuc.style.display = "block";
    } else {
      btnAddRuc.disabled = false;
      hintMaxRuc.style.display = "none";
    }
  }
  // esPrimero: la primera fila no tiene botón eliminar (es obligatoria).
  function agregarRuc(esPrimero = false) {
    if ($$("#rucs-adicionales .ruc-block").length >= MAX_RUCS_ADICIONALES + 1) return;
    rucCounter++;
    const id = `ruc_doc_${rucCounter}`;
    const aliasId = `alias_doc_${rucCounter}`;
    const tipoId = `tipo_doc_${rucCounter}`;
    const fechaId = `fecha_nac_doc_${rucCounter}`;
    const fechaRowId = `fecha_nac_doc_row_${rucCounter}`;
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `
      <label class="lbl ruc-label" for="${id}"></label>
      <div class="ruc-block">
        <div class="tipo-col">
          <select id="${tipoId}" class="tipo-doc" data-target="${id}" aria-label="Tipo de persona">
            <option value="JURIDICO" selected>Jurídica</option>
            <option value="NATURAL">Natural</option>
          </select>
        </div>
        <div class="ruc-col">
          <input type="text" id="${id}" class="ruc-add" ${esPrimero ? "required" : ""}
                 maxlength="13" inputmode="numeric" placeholder="Número"
                 autocomplete="off" data-1p-ignore data-lpignore="true" />
        </div>
        <div class="alias-col">
          <input type="text" id="${aliasId}" class="alias-add"
                 placeholder="Razón Social / Nombre y Apellido (Opcional)"
                 autocomplete="off" data-1p-ignore data-lpignore="true" />
        </div>
        ${
          esPrimero
            ? ""
            : `<div class="rm-col">
                 <button type="button" class="btn-remove" title="Eliminar">✕</button>
               </div>`
        }
      </div>
      <div class="err-msg" data-for="${id}">Persona Jurídica: 13 dígitos. Persona Natural: 10 (cédula) o 13 dígitos (RUC).</div>
      <div class="fecha-nac-row" id="${fechaRowId}" hidden>
        <label class="lbl" for="${fechaId}">Fecha de nacimiento <span class="req">*</span></label>
        <input type="date" id="${fechaId}" class="fecha-nac fecha-nac-add" data-target="${id}" />
        <div class="err-msg" data-for="${fechaId}">Ingrese la fecha de nacimiento.</div>
      </div>
    `;
    const btnRm = wrap.querySelector(".btn-remove");
    if (btnRm) {
      btnRm.addEventListener("click", () => {
        wrap.remove();
        refreshRucNumbers();
        actualizarBotonRuc();
      });
    }
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

  // Helper compartido: aplica reglas según tipo (NATURAL | JURIDICO).
  // NATURAL: puede tener cédula (10 dig) o RUC de persona natural (13 dig) → exige fecha.
  // JURIDICO: RUC de sociedad (13 dig) → no exige fecha.
  function aplicarTipoDoc(tipoSel, numInput, fechaRow, fechaInput) {
    const isNatural = tipoSel.value === "NATURAL";
    fechaRow.hidden = !isNatural;
    fechaInput.required = isNatural;
    if (!isNatural) fechaInput.value = "";
    // En ambos casos el input acepta hasta 13 dígitos (NATURAL puede ser 10 o 13).
    numInput.maxLength = 13;
    if (isNatural && !fechaInput.max) {
      fechaInput.max = new Date().toISOString().split("T")[0];
    }
  }

  // Devuelve { ok: bool, code: '', tipoReal: 'NATURAL'|'JURIDICO'|null }
  // Reglas de Ecuador: el 3er dígito determina el tipo.
  //   0..5 → persona natural   |   6..9 → persona jurídica
  // Trabajamos siempre con el string crudo (NUNCA Number/parseInt sobre el
  // número completo, para no perder el 0 inicial de cédulas como 0953...).
  function validarTipoVsNumero(tipo, numero) {
    if (!/^[0-9]+$/.test(numero) || numero.length < 3) {
      return { ok: false, code: "FORMATO_INVALIDO", tipoReal: null };
    }
    const tercer = numero.charAt(2); // char en posición índice 2 (3er dígito real)
    const tipoReal = "012345".includes(tercer) ? "NATURAL" : "JURIDICO";
    if (tipo === "NATURAL") {
      if (numero.length !== 10 && numero.length !== 13) {
        return { ok: false, code: "LARGO_INVALIDO_NATURAL", tipoReal };
      }
    } else if (tipo === "JURIDICO") {
      if (numero.length !== 13) {
        return { ok: false, code: "LARGO_INVALIDO_JURIDICO", tipoReal };
      }
    }
    if (tipo !== tipoReal) {
      return { ok: false, code: "TIPO_MISMATCH", tipoReal };
    }
    return { ok: true, code: "", tipoReal };
  }

  // Cambia el texto del .err-msg de un input a un mensaje específico.
  function setErrMsg(field, texto) {
    const el = document.querySelector(`.err-msg[data-for="${field}"]`);
    if (el) el.textContent = texto;
  }
  const ERR_MSG_DEFAULT =
    "Persona Jurídica: 13 dígitos. Persona Natural: 10 (cédula) o 13 dígitos (RUC).";
  function mensajeError(code, tipoReal) {
    if (code === "TIPO_MISMATCH") {
      return tipoReal === "JURIDICO"
        ? "El número ingresado corresponde a una persona jurídica. Cambie el tipo."
        : "El número ingresado corresponde a una persona natural. Cambie el tipo.";
    }
    if (code === "LARGO_INVALIDO_NATURAL") {
      return "Para persona natural ingrese 10 dígitos (cédula) o 13 dígitos (RUC).";
    }
    if (code === "LARGO_INVALIDO_JURIDICO") {
      return "Para persona jurídica ingrese 13 dígitos (RUC).";
    }
    return ERR_MSG_DEFAULT;
  }
  btnAddRuc.addEventListener("click", () => agregarRuc(false));

  // Crear la primera fila al cargar (obligatoria, sin botón ✕).
  agregarRuc(true);

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
    if ($("#nombre_grupo").value.trim().length < 2) marcar("nombre_grupo");

    const telVal = telInput.value.trim();
    const telCountryVal = telCountry.value;
    if (!telVal || !isValidPhoneNumber(telVal, telCountryVal)) {
      marcar("telefono");
    }

    // Validación unificada de TODOS los RUCs/CIs.
    // - El primero (idx 0) es obligatorio: si está vacío → error.
    // - Los demás son opcionales: si están vacíos se ignoran, si tienen algo se validan.
    const bloques = $$("#rucs-adicionales .ruc-block");
    bloques.forEach((blk, idx) => {
      const tipo = blk.querySelector(".tipo-doc").value;
      const numInp = blk.querySelector(".ruc-add");
      const valor = numInp.value.trim();
      const em = document.querySelector(`.err-msg[data-for="${numInp.id}"]`);

      // Adicional vacío → ignorar (no es error)
      if (idx > 0 && valor === "") {
        numInp.classList.remove("error");
        if (em) em.classList.remove("show");
        const fechaInp = blk.parentElement.querySelector(".fecha-nac-add");
        if (fechaInp) {
          fechaInp.classList.remove("error");
          const emF = document.querySelector(`.err-msg[data-for="${fechaInp.id}"]`);
          if (emF) emF.classList.remove("show");
        }
        return;
      }

      const res = validarTipoVsNumero(tipo, valor);
      if (!res.ok) {
        if (em) em.textContent = mensajeError(res.code, res.tipoReal);
        numInp.classList.add("error");
        if (em) em.classList.add("show");
        if (!firstErrorEl) firstErrorEl = numInp;
        ok = false;
      } else {
        if (em) em.textContent = ERR_MSG_DEFAULT;
        numInp.classList.remove("error");
        if (em) em.classList.remove("show");
      }
      if (tipo === "NATURAL") {
        const fechaInp = blk.parentElement.querySelector(".fecha-nac-add");
        if (fechaInp && (!fechaInp.value || isNaN(new Date(fechaInp.value).getTime()))) {
          fechaInp.classList.add("error");
          const emF = document.querySelector(`.err-msg[data-for="${fechaInp.id}"]`);
          if (emF) emF.classList.add("show");
          if (!firstErrorEl) firstErrorEl = fechaInp;
          ok = false;
        } else if (fechaInp) {
          fechaInp.classList.remove("error");
          const emF = document.querySelector(`.err-msg[data-for="${fechaInp.id}"]`);
          if (emF) emF.classList.remove("show");
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
    // Todos los docs en una sola lista. Los vacíos (adicionales sin llenar) se omiten.
    const docs_alertas = $$("#rucs-adicionales .ruc-block")
      .map((blk) => {
        const tipo = blk.querySelector(".tipo-doc").value;
        const fechaInp = blk.parentElement.querySelector(".fecha-nac-add");
        return {
          ruc: blk.querySelector(".ruc-add").value.trim(),
          alias: blk.querySelector(".alias-add").value.trim(),
          tipo,
          fecha_nacimiento: tipo === "NATURAL" && fechaInp ? fechaInp.value : "",
        };
      })
      .filter((d) => d.ruc.length > 0);

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
      nombre_grupo: $("#nombre_grupo").value.trim(),
      docs_alertas,
      fuentes: $$('input[name="fuentes"]:checked').map((c) => c.value),
      correo_principal: $("#correo_principal").value.trim(),
      correos_adicionales,
      correos_alertas,
      acepto_tyc: $("#acepto_tyc").checked,
      acepto_lopdp: $("#acepto_lopdp").checked,
      website: $("#hp-website").value,
    };
  }

  // Reintenta hasta 10 veces con backoff lineal capeado a 2s entre intentos.
  // Cubre blips transitorios y la ventana de redeploy de la API route en Vercel.
  // Tiempo máximo aproximado en el peor caso: ~20s.
  async function enviar(payload) {
    const MAX_ATTEMPTS = 10;
    const MAX_BACKOFF_MS = 2000;
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const resp = await fetch(SUBMIT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        const json = await resp.json();
        if (!json.ok) throw new Error(json.error || "El servidor devolvió ok=false");
        return json;
      } catch (err) {
        lastError = err;
        console.warn(`[Census Alert] Intento ${attempt}/${MAX_ATTEMPTS} falló:`, err.message);
        if (attempt < MAX_ATTEMPTS) {
          const waitMs = Math.min(attempt * 500, MAX_BACKOFF_MS);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }
    throw lastError;
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
