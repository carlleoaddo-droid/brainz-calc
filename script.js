(() => {
  "use strict";

  const UNITS = [
    { id: "km", name: "Kilometre", symbol: "km", metres: 1000 },
    { id: "m", name: "Metre", symbol: "m", metres: 1 },
    { id: "cm", name: "Centimetre", symbol: "cm", metres: 0.01 },
    { id: "mm", name: "Millimetre", symbol: "mm", metres: 0.001 },
    { id: "um", name: "Micrometre", symbol: "μm", metres: 0.000001 },
    { id: "nm", name: "Nanometre", symbol: "nm", metres: 0.000000001 },
    { id: "mi", name: "Mile", symbol: "mi", metres: 1609.344 },
    { id: "yd", name: "Yard", symbol: "yd", metres: 0.9144 },
    { id: "ft", name: "Foot", symbol: "ft", metres: 0.3048 },
    { id: "in", name: "Inch", symbol: "in", metres: 0.0254 },
    { id: "nmi", name: "Nautical mile", symbol: "nmi", metres: 1852 }
  ];
  const UNIT_BY_ID = new Map(UNITS.map((unit) => [unit.id, unit]));
  const HISTORY_KEY = "brainz-calc-history-v1";
  const SETTINGS_KEY = "brainz-calc-settings-v1";
  const MAX_HISTORY = 50;
  const DEFAULT_SETTINGS = { theme: "light", precision: "auto", from: "m", to: "km" };
  const PRINT_RATE = {
    flexy: 2.5,
    sav: 2.3,
    "one-way-vision": 7,
    "transparent-sticker": 4
  };

  const elements = {
    from: document.querySelector("#from-unit"),
    to: document.querySelector("#to-unit"),
    value: document.querySelector("#value-input"),
    result: document.querySelector("#result-value"),
    resultUnit: document.querySelector("#result-unit"),
    resultDetail: document.querySelector("#result-detail"),
    feedback: document.querySelector("#input-feedback"),
    copy: document.querySelector("#copy-button"),
    clear: document.querySelector("#clear-button"),
    swap: document.querySelector("#swap-button"),
    theme: document.querySelector("#theme-select"),
    precision: document.querySelector("#precision-select"),
    defaultFrom: document.querySelector("#default-from"),
    defaultTo: document.querySelector("#default-to"),
    historyList: document.querySelector("#history-list"),
    historyEmpty: document.querySelector("#history-empty"),
    historyCount: document.querySelector("#history-count"),
    toast: document.querySelector("#toast"),
    connection: document.querySelector("#connection-status"),
    connectionLabel: document.querySelector("#connection-label"),
    printWidth: document.querySelector("#print-width"),
    printHeight: document.querySelector("#print-height"),
    printUnit: document.querySelector("#print-unit"),
    printMaterial: document.querySelector("#print-material"),
    printCost: document.querySelector("#print-cost"),
    printDetail: document.querySelector("#print-detail"),
    printCopy: document.querySelector("#print-copy-button"),
    widthFeedback: document.querySelector("#width-feedback"),
    heightFeedback: document.querySelector("#height-feedback")
  };

  let settings = readSettings();
  let history = readHistory();
  let currentResult = null;
  let printCostValue = null;
  let toastTimeout;
  let lastToast = "";

  function readStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.error(`Unable to read ${key} from local storage.`, error);
      showToast("Saved data could not be read. The app will keep working for this visit.");
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Unable to save ${key} to local storage.`, error);
      showToast("Could not save changes on this device. Check your browser storage settings.");
      return false;
    }
  }

  function readSettings() {
    const saved = readStorage(SETTINGS_KEY, {});
    return {
      theme: saved.theme === "dark" ? "dark" : "light",
      precision: ["auto", "2", "4", "6"].includes(saved.precision) ? saved.precision : DEFAULT_SETTINGS.precision,
      from: UNIT_BY_ID.has(saved.from) ? saved.from : DEFAULT_SETTINGS.from,
      to: UNIT_BY_ID.has(saved.to) ? saved.to : DEFAULT_SETTINGS.to
    };
  }

  function readHistory() {
    const saved = readStorage(HISTORY_KEY, []);
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) =>
      item &&
      typeof item.value === "string" &&
      Number.isFinite(Number(item.value)) &&
      UNIT_BY_ID.has(item.from) &&
      UNIT_BY_ID.has(item.to)
    ).slice(0, MAX_HISTORY);
  }

  function showToast(message) {
    clearTimeout(toastTimeout);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimeout = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
    lastToast = message;
  }

  function addUnitOptions(select) {
    for (const unit of UNITS) {
      const option = document.createElement("option");
      option.value = unit.id;
      option.textContent = `${unit.name} (${unit.symbol})`;
      select.append(option);
    }
  }

  function applyTheme() {
    document.documentElement.dataset.theme = settings.theme;
    document.querySelector('meta[name="theme-color"]').content = settings.theme === "dark" ? "#101a1b" : "#f5faf9";
    elements.theme.value = settings.theme;
  }

  function persistSettings() {
    writeStorage(SETTINGS_KEY, settings);
  }

  function formatValue(value) {
    if (!Number.isFinite(value)) return null;
    if (settings.precision === "auto") {
      return new Intl.NumberFormat(undefined, {
        maximumSignificantDigits: 12,
        useGrouping: true
      }).format(value);
    }
    const decimals = Number(settings.precision);
    if (Math.abs(value) >= 1e21 || (value !== 0 && Math.abs(value) < 1e-7)) {
      return value.toExponential(decimals);
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true
    });
  }

  function parseInput(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return { state: "empty" };
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) {
      return { state: "invalid" };
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return { state: "invalid" };
    return { state: "valid", value };
  }

  function convertToMetres(value, unit) {
    const unitMeta = UNIT_BY_ID.get(unit);
    return unitMeta ? value * unitMeta.metres : Number.NaN;
  }

  function convertFromMetres(value, unit) {
    const unitMeta = UNIT_BY_ID.get(unit);
    return unitMeta ? value / unitMeta.metres : Number.NaN;
  }

  function calculateLengthConversion(value, fromId, toId) {
    const metres = convertToMetres(value, fromId);
    return convertFromMetres(metres, toId);
  }

  function renderResult() {
    const from = UNIT_BY_ID.get(elements.from.value);
    const to = UNIT_BY_ID.get(elements.to.value);
    const parsed = parseInput(elements.value.value);
    elements.resultUnit.textContent = "";
    elements.copy.disabled = true;
    currentResult = null;

    if (parsed.state === "empty") {
      elements.result.textContent = "—";
      elements.resultDetail.textContent = "Your conversion will appear here.";
      elements.feedback.textContent = "";
      elements.value.removeAttribute("aria-invalid");
      return;
    }

    if (parsed.state === "invalid") {
      elements.result.textContent = "—";
      elements.resultDetail.textContent = "Enter a valid number to convert.";
      elements.feedback.textContent = "Use a number, with only one decimal point.";
      elements.value.setAttribute("aria-invalid", "true");
      return;
    }

    const result = calculateLengthConversion(parsed.value, from.id, to.id);
    const formatted = formatValue(result);
    const original = formatValue(parsed.value);
    elements.value.removeAttribute("aria-invalid");
    elements.feedback.textContent = "";

    if (formatted === null) {
      elements.result.textContent = "Out of range";
      elements.resultDetail.textContent = "This result is outside the range JavaScript can represent.";
      return;
    }

    elements.result.textContent = formatted;
    elements.resultUnit.textContent = to.symbol;
    elements.resultDetail.textContent = `${original} ${from.symbol} = ${formatted} ${to.symbol}`;
    elements.copy.disabled = false;
    currentResult = { value: parsed.value, result, formatted, from, to };
    addHistoryEntry(parsed.value, from.id, to.id, result);
  }

  function addHistoryEntry(value, from, to, result) {
    const entry = { value: String(value), from, to, result: String(result), timestamp: Date.now() };
    const previous = history[0];
    if (previous && Number(previous.value) === value && previous.from === from && previous.to === to) return;
    history = [entry, ...history].slice(0, MAX_HISTORY);
    writeStorage(HISTORY_KEY, history);
    renderHistory();
  }

  function renderHistory() {
    elements.historyList.replaceChildren();
    elements.historyEmpty.hidden = history.length > 0;
    elements.historyCount.textContent = history.length === 0
      ? "No conversions yet"
      : `${history.length} ${history.length === 1 ? "conversion" : "conversions"}`;

    for (const item of history) {
      const from = UNIT_BY_ID.get(item.from);
      const to = UNIT_BY_ID.get(item.to);
      const button = document.createElement("button");
      button.className = "history-item";
      button.type = "button";
      button.dataset.value = item.value;
      button.dataset.from = item.from;
      button.dataset.to = item.to;

      const conversion = document.createElement("span");
      conversion.className = "history-conversion";
      const source = document.createElement("span");
      source.className = "history-source";
      source.textContent = `${formatValue(Number(item.value)) ?? item.value} ${from.symbol}`;
      const arrow = document.createElement("span");
      arrow.className = "history-arrow";
      arrow.textContent = "→";
      const target = document.createElement("span");
      target.className = "history-target";
      target.textContent = `${formatValue(Number(item.result)) ?? item.result} ${to.symbol}`;
      conversion.append(source, arrow, target);

      const time = document.createElement("span");
      time.className = "history-time";
      time.textContent = new Date(item.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      button.append(conversion, time);
      elements.historyList.append(button);
    }
  }

  function changeSection(sectionName) {
    const sections = document.querySelectorAll(".page-section");
    for (const section of sections) {
      const active = section.id === `section-${sectionName}`;
      section.hidden = !active;
      section.classList.toggle("is-visible", active);
    }

    for (const link of document.querySelectorAll(".nav-link[data-section]")) {
      const active = link.dataset.section === sectionName;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }

    if (sectionName === "history") renderHistory();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearHistory() {
    if (history.length === 0) {
      showToast("Your history is already empty.");
      return;
    }
    history = [];
    writeStorage(HISTORY_KEY, history);
    renderHistory();
    showToast("Conversion history cleared.");
  }

  async function copyResult() {
    if (!currentResult) return;
    const text = `${currentResult.formatted} ${currentResult.to.symbol}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API unavailable.");
      }
      showToast("Result copied to clipboard.");
    } catch (error) {
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.append(temporary);
      temporary.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } finally {
        temporary.remove();
      }
      if (copied) showToast("Result copied to clipboard.");
      else showToast("Could not copy automatically. Select the result and copy it instead.");
    }
  }

  function getPrintUnitFactor(unit) {
    const factors = {
      ft: 1,
      m: 3.280839895,
      cm: 0.03280839895,
      in: 1 / 12
    };
    return factors[unit] ?? 1;
  }

  function calculatePrintCost() {
    const widthText = elements.printWidth.value.trim();
    const heightText = elements.printHeight.value.trim();
    const material = elements.printMaterial.value;
    const unit = elements.printUnit.value;

    elements.widthFeedback.textContent = "";
    elements.heightFeedback.textContent = "";
    elements.printCopy.disabled = true;
    printCostValue = null;

    if (!widthText && !heightText) {
      elements.printCost.textContent = "0.00";
      elements.printDetail.textContent = "Fill in dimensions to calculate.";
      return;
    }

    const widthParsed = parseInput(widthText);
    const heightParsed = parseInput(heightText);

    if (widthText && widthParsed.state === "invalid") {
      elements.widthFeedback.textContent = "Enter a valid width.";
    }
    if (heightText && heightParsed.state === "invalid") {
      elements.heightFeedback.textContent = "Enter a valid height.";
    }

    if (widthText && widthParsed.state !== "valid") return;
    if (heightText && heightParsed.state !== "valid") return;

    if (widthParsed.state === "empty" || heightParsed.state === "empty") {
      elements.printCost.textContent = "0.00";
      elements.printDetail.textContent = "Both dimensions are required for a total.";
      return;
    }

    const widthFt = Number(widthParsed.value) * getPrintUnitFactor(unit);
    const heightFt = Number(heightParsed.value) * getPrintUnitFactor(unit);
    const totalSquareFeet = widthFt * heightFt;
    const rate = PRINT_RATE[material] ?? 2.5;
    const cost = totalSquareFeet * rate;

    printCostValue = cost;
    elements.printCost.textContent = new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(cost);
    elements.printDetail.textContent = `${formatValue(totalSquareFeet)} sq ft × GHS ${rate.toFixed(2)}/sq ft = ${new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cost)}`;
    elements.printCopy.disabled = false;
  }

  async function copyPrintCost() {
    if (printCostValue === null) return;
    const text = new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(printCostValue);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API unavailable.");
      }
      showToast("Print cost copied.");
    } catch (error) {
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.append(temporary);
      temporary.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } finally {
        temporary.remove();
      }
      if (copied) showToast("Print cost copied.");
      else showToast("Could not copy automatically. Try again later.");
    }
  }

  function updateConnectionStatus() {
    const online = navigator.onLine;
    elements.connection.classList.toggle("is-offline", !online);
    elements.connectionLabel.textContent = online ? "Online" : "Offline";
  }

  for (const select of [elements.from, elements.to, elements.defaultFrom, elements.defaultTo]) {
    addUnitOptions(select);
  }

  elements.from.value = settings.from;
  elements.to.value = settings.to;
  elements.defaultFrom.value = settings.from;
  elements.defaultTo.value = settings.to;
  elements.precision.value = settings.precision;
  applyTheme();
  renderHistory();
  updateConnectionStatus();
  renderResult();
  calculatePrintCost();

  document.querySelectorAll(".nav-link[data-section]").forEach((button) => {
    button.addEventListener("click", () => changeSection(button.dataset.section));
  });

  document.querySelector("[data-home]").addEventListener("click", (event) => {
    event.preventDefault();
    changeSection("converter");
  });

  elements.value.addEventListener("input", renderResult);
  elements.from.addEventListener("change", renderResult);
  elements.to.addEventListener("change", renderResult);
  elements.clear.addEventListener("click", () => {
    elements.value.value = "";
    renderResult();
    elements.value.focus();
  });
  elements.swap.addEventListener("click", () => {
    const previousFrom = elements.from.value;
    elements.from.value = elements.to.value;
    elements.to.value = previousFrom;
    elements.swap.classList.remove("is-swapping");
    void elements.swap.offsetWidth;
    elements.swap.classList.add("is-swapping");
    window.setTimeout(() => elements.swap.classList.remove("is-swapping"), 260);
    renderResult();
  });
  elements.copy.addEventListener("click", copyResult);
  elements.theme.addEventListener("change", () => {
    settings.theme = elements.theme.value;
    applyTheme();
    persistSettings();
  });
  elements.precision.addEventListener("change", () => {
    settings.precision = elements.precision.value;
    persistSettings();
    renderResult();
    renderHistory();
  });
  elements.defaultFrom.addEventListener("change", () => {
    settings.from = elements.defaultFrom.value;
    persistSettings();
  });
  elements.defaultTo.addEventListener("change", () => {
    settings.to = elements.defaultTo.value;
    persistSettings();
  });

  elements.historyList.addEventListener("click", (event) => {
    const item = event.target.closest(".history-item");
    if (!item) return;
    elements.value.value = item.dataset.value;
    elements.from.value = item.dataset.from;
    elements.to.value = item.dataset.to;
    renderResult();
    changeSection("converter");
  });

  document.querySelectorAll("[data-clear-history]").forEach((button) => {
    button.addEventListener("click", clearHistory);
  });

  elements.printWidth.addEventListener("input", calculatePrintCost);
  elements.printHeight.addEventListener("input", calculatePrintCost);
  elements.printUnit.addEventListener("change", calculatePrintCost);
  elements.printMaterial.addEventListener("change", calculatePrintCost);
  elements.printCopy.addEventListener("click", copyPrintCost);

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.error("Service worker registration failed.", error);
      });
    });
  }
})();