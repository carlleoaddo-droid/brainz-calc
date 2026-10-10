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
  const CALCULATOR_HISTORY_KEY = "brainz-calc-calculator-history-v1";
  const SETTINGS_KEY = "brainz-calc-settings-v1";
  const MAX_HISTORY = 50;
  const MAX_CALCULATOR_HISTORY = 30;
  const DEFAULT_SETTINGS = { theme: "light", precision: "auto", from: "m", to: "km", name: "", photo: "" };
  const DEFAULT_PRINT_RATES = {
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
    brandName: document.querySelector("#brand-name"),
    profileName: document.querySelector("#profile-name"),
    profilePhoto: document.querySelector("#profile-photo"),
    profilePhotoDisplay: document.querySelector("#profile-photo-display"),
    brandMarkIcon: document.querySelector("#brand-mark-icon"),
    removeProfilePhoto: document.querySelector("#remove-profile-photo"),
    rates: document.querySelectorAll(".material-rate"),
    rateFeedback: document.querySelector("#rate-feedback"),
    defaultFrom: document.querySelector("#default-from"),
    defaultTo: document.querySelector("#default-to"),
    historyList: document.querySelector("#history-list"),
    historyEmpty: document.querySelector("#history-empty"),
    historyCount: document.querySelector("#history-count"),
    toast: document.querySelector("#toast"),
    calculatorKeypad: document.querySelector("#calculator-keypad"),
    calculatorResult: document.querySelector("#calculator-result"),
    calculatorExpression: document.querySelector("#calculator-expression"),
    calculatorHistoryList: document.querySelector("#calculator-history-list"),
    calculatorHistoryEmpty: document.querySelector("#calculator-history-empty"),
    calculatorHistoryCount: document.querySelector("#calculator-history-count"),
    printWidth: document.querySelector("#print-width"),
    printHeight: document.querySelector("#print-height"),
    printQuantity: document.querySelector("#print-quantity"),
    printUnit: document.querySelector("#print-unit"),
    printMaterial: document.querySelector("#print-material"),
    printCost: document.querySelector("#print-cost"),
    printDetail: document.querySelector("#print-detail"),
    printCopy: document.querySelector("#print-copy-button"),
    widthFeedback: document.querySelector("#width-feedback"),
    heightFeedback: document.querySelector("#height-feedback"),
    quantityFeedback: document.querySelector("#quantity-feedback")
  };

  let settings = readSettings();
  let history = readHistory();
  let calculatorHistory = readCalculatorHistory();
  let currentResult = null;
  let printCostValue = null;
  let calculatorInput = "0";
  let calculatorValue = 0;
  let calculatorStoredValue = null;
  let calculatorOperator = null;
  let calculatorAwaitingInput = false;
  let calculatorLastOperator = null;
  let calculatorLastOperand = null;
  let calculatorError = false;
  let toastTimeout;
  let lastToast = "";
  let scrollIdleTimeout;

  const CALCULATOR_OPERATORS = {
    add: { symbol: "+", calculate: (left, right) => left + right },
    subtract: { symbol: "−", calculate: (left, right) => left - right },
    multiply: { symbol: "×", calculate: (left, right) => left * right },
    divide: { symbol: "÷", calculate: (left, right) => left / right }
  };

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
    const stored = readStorage(SETTINGS_KEY, {});
    const saved = stored && typeof stored === "object" ? stored : {};
    const savedRates = saved.rates && typeof saved.rates === "object" ? saved.rates : {};
    return {
      theme: saved.theme === "dark" ? "dark" : "light",
      precision: ["auto", "2", "4", "6"].includes(saved.precision) ? saved.precision : DEFAULT_SETTINGS.precision,
      from: UNIT_BY_ID.has(saved.from) ? saved.from : DEFAULT_SETTINGS.from,
      to: UNIT_BY_ID.has(saved.to) ? saved.to : DEFAULT_SETTINGS.to,
      name: typeof saved.name === "string" ? saved.name.trim().slice(0, 40) : DEFAULT_SETTINGS.name,
      photo: typeof saved.photo === "string" && /^data:image\/jpeg;base64,/.test(saved.photo) && saved.photo.length <= 200000
        ? saved.photo
        : DEFAULT_SETTINGS.photo,
      rates: Object.fromEntries(Object.keys(DEFAULT_PRINT_RATES).map((material) => {
        const rate = savedRates[material];
        return [material, typeof rate === "number" && Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_PRINT_RATES[material]];
      }))
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

  function readCalculatorHistory() {
    const saved = readStorage(CALCULATOR_HISTORY_KEY, []);
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) =>
      item &&
      typeof item.expression === "string" &&
      item.expression.length <= 120 &&
      typeof item.result === "string" &&
      item.result.length <= 80 &&
      Number.isFinite(item.timestamp)
    ).slice(0, MAX_CALCULATOR_HISTORY);
  }

  function showToast(message) {
    clearTimeout(toastTimeout);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimeout = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
    lastToast = message;
  }

  function formatCalculatorValue(value) {
    return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 12 }).format(value);
  }

  function renderCalculator() {
    elements.calculatorResult.textContent = calculatorError
      ? calculatorInput
      : calculatorAwaitingInput ? formatCalculatorValue(calculatorValue) : calculatorInput;
    elements.calculatorExpression.textContent = calculatorOperator && calculatorStoredValue !== null
      ? `${formatCalculatorValue(calculatorStoredValue)} ${CALCULATOR_OPERATORS[calculatorOperator].symbol}`
      : "";
    elements.calculatorKeypad.querySelectorAll("[data-calc-operator]").forEach((button) => {
      const active = button.dataset.calcOperator === calculatorOperator;
      button.classList.toggle("is-selected", active);
      if (active) button.setAttribute("aria-pressed", "true");
      else button.removeAttribute("aria-pressed");
    });
  }

  function resetCalculator() {
    calculatorInput = "0";
    calculatorValue = 0;
    calculatorStoredValue = null;
    calculatorOperator = null;
    calculatorAwaitingInput = false;
    calculatorLastOperator = null;
    calculatorLastOperand = null;
    calculatorError = false;
    renderCalculator();
  }

  function enterCalculatorDigit(digit) {
    if (calculatorError) resetCalculator();
    if (calculatorAwaitingInput) {
      calculatorInput = digit;
      calculatorAwaitingInput = false;
    } else if (calculatorInput.replace(/[-.]/g, "").length < 16) {
      calculatorInput = calculatorInput === "0" ? digit : `${calculatorInput}${digit}`;
    }
    calculatorValue = Number(calculatorInput);
    calculatorLastOperator = null;
    calculatorLastOperand = null;
    renderCalculator();
  }

  function enterCalculatorDecimal() {
    if (calculatorError) resetCalculator();
    if (calculatorAwaitingInput) {
      calculatorInput = "0.";
      calculatorAwaitingInput = false;
    } else if (!calculatorInput.includes(".")) {
      calculatorInput += ".";
    }
    calculatorValue = Number(calculatorInput);
    calculatorLastOperator = null;
    calculatorLastOperand = null;
    renderCalculator();
  }

  function calculate(left, operator, right) {
    if (operator === "divide" && right === 0) {
      calculatorInput = "Cannot divide by zero";
      calculatorError = true;
      calculatorStoredValue = null;
      calculatorOperator = null;
      calculatorAwaitingInput = true;
      renderCalculator();
      return null;
    }
    const result = CALCULATOR_OPERATORS[operator].calculate(left, right);
    if (!Number.isFinite(result)) {
      calculatorInput = "Result out of range";
      calculatorError = true;
      calculatorStoredValue = null;
      calculatorOperator = null;
      calculatorAwaitingInput = true;
      renderCalculator();
      return null;
    }
    return result;
  }

  function chooseCalculatorOperator(operator) {
    if (calculatorError) return;
    if (calculatorOperator && !calculatorAwaitingInput && calculatorStoredValue !== null) {
      const result = calculate(calculatorStoredValue, calculatorOperator, calculatorValue);
      if (result === null) return;
      calculatorValue = result;
      calculatorInput = String(result);
      calculatorStoredValue = result;
    } else if (calculatorStoredValue === null || !calculatorOperator) {
      calculatorStoredValue = calculatorValue;
    }
    calculatorOperator = operator;
    calculatorAwaitingInput = true;
    calculatorLastOperator = null;
    calculatorLastOperand = null;
    renderCalculator();
  }

  function evaluateCalculator() {
    if (calculatorError) return;
    if (calculatorOperator && calculatorStoredValue !== null) {
      const operand = calculatorAwaitingInput ? calculatorStoredValue : calculatorValue;
      const operator = calculatorOperator;
      const left = calculatorStoredValue;
      const result = calculate(calculatorStoredValue, operator, operand);
      if (result === null) return;
      addCalculatorHistory(left, operator, operand, result);
      calculatorValue = result;
      calculatorInput = String(result);
      calculatorStoredValue = null;
      calculatorOperator = null;
      calculatorAwaitingInput = true;
      calculatorLastOperator = operator;
      calculatorLastOperand = operand;
    } else if (calculatorLastOperator && calculatorLastOperand !== null) {
      const left = calculatorValue;
      const result = calculate(calculatorValue, calculatorLastOperator, calculatorLastOperand);
      if (result === null) return;
      addCalculatorHistory(left, calculatorLastOperator, calculatorLastOperand, result);
      calculatorValue = result;
      calculatorInput = String(result);
      calculatorAwaitingInput = true;
    }
    renderCalculator();
  }

  function addCalculatorHistory(left, operator, right, result) {
    const expression = `${formatCalculatorValue(left)} ${CALCULATOR_OPERATORS[operator].symbol} ${formatCalculatorValue(right)}`;
    calculatorHistory = [{
      expression,
      result: formatCalculatorValue(result),
      timestamp: Date.now()
    }, ...calculatorHistory].slice(0, MAX_CALCULATOR_HISTORY);
    writeStorage(CALCULATOR_HISTORY_KEY, calculatorHistory);
    renderCalculatorHistory();
  }

  function renderCalculatorHistory() {
    elements.calculatorHistoryList.replaceChildren();
    elements.calculatorHistoryEmpty.hidden = calculatorHistory.length > 0;
    elements.calculatorHistoryCount.textContent = calculatorHistory.length === 0
      ? "No calculations yet"
      : `${calculatorHistory.length} ${calculatorHistory.length === 1 ? "calculation" : "calculations"}`;

    for (const item of calculatorHistory) {
      const entry = document.createElement("li");
      entry.className = "calculator-history-entry";

      const summary = document.createElement("div");
      summary.className = "calculator-history-summary";
      const expression = document.createElement("span");
      expression.className = "calculator-history-expression";
      expression.textContent = item.expression;
      const result = document.createElement("span");
      result.className = "calculator-history-result";
      result.textContent = `= ${item.result}`;
      summary.append(expression, result);

      const time = document.createElement("span");
      time.className = "calculator-history-time";
      time.textContent = new Date(item.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      entry.append(summary, time);
      elements.calculatorHistoryList.append(entry);
    }
  }

  function clearCalculatorHistory() {
    if (calculatorHistory.length === 0) {
      showToast("Your calculator history is already empty.");
      return;
    }
    calculatorHistory = [];
    writeStorage(CALCULATOR_HISTORY_KEY, calculatorHistory);
    renderCalculatorHistory();
    showToast("Calculator history cleared.");
  }

  function applyCalculatorAction(action) {
    if (action === "clear") {
      resetCalculator();
      return;
    }
    if (action === "equals") {
      evaluateCalculator();
      return;
    }
    if (calculatorError) return;
    if (action === "decimal") {
      enterCalculatorDecimal();
    } else if (action === "sign") {
      if (calculatorValue !== 0) {
        calculatorValue *= -1;
        calculatorInput = String(calculatorValue);
        calculatorAwaitingInput = false;
        renderCalculator();
      }
    } else if (action === "percent") {
      calculatorValue /= 100;
      calculatorInput = String(calculatorValue);
      calculatorAwaitingInput = false;
      calculatorLastOperator = null;
      calculatorLastOperand = null;
      renderCalculator();
    } else if (action === "backspace" && !calculatorAwaitingInput) {
      calculatorInput = calculatorInput.length > 1 ? calculatorInput.slice(0, -1) : "0";
      if (calculatorInput === "-") calculatorInput = "0";
      calculatorValue = Number(calculatorInput);
      renderCalculator();
    }
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

  function applyProfile() {
    const name = settings.name || "NexNum";
    elements.brandName.textContent = name;
    elements.profileName.value = settings.name;
    document.querySelector("[data-home]").setAttribute("aria-label", `${name} home`);
    const hasPhoto = Boolean(settings.photo);
    elements.profilePhotoDisplay.hidden = !hasPhoto;
    elements.profilePhotoDisplay.src = hasPhoto ? settings.photo : "";
    elements.brandMarkIcon.hidden = hasPhoto;
    elements.removeProfilePhoto.hidden = !hasPhoto;
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
    const quantityText = elements.printQuantity.value.trim();
    const material = elements.printMaterial.value;
    const unit = elements.printUnit.value;

    elements.widthFeedback.textContent = "";
    elements.heightFeedback.textContent = "";
    elements.quantityFeedback.textContent = "";
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

    const quantity = Number(quantityText);
    if (!/^\d+$/.test(quantityText) || !Number.isSafeInteger(quantity) || quantity < 1) {
      elements.quantityFeedback.textContent = "Enter a whole number greater than zero.";
      return;
    }

    const widthFt = Number(widthParsed.value) * getPrintUnitFactor(unit);
    const heightFt = Number(heightParsed.value) * getPrintUnitFactor(unit);
    const totalSquareFeet = widthFt * heightFt;
    const rate = settings.rates[material] ?? DEFAULT_PRINT_RATES[material];
    const cost = totalSquareFeet * rate * quantity;

    printCostValue = cost;
    elements.printCost.textContent = new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(cost);
    elements.printDetail.textContent = `${formatValue(totalSquareFeet)} sq ft × GHS ${rate.toFixed(2)}/sq ft × ${quantity} ${quantity === 1 ? "copy" : "copies"} = ${new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cost)}`;
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

  for (const select of [elements.from, elements.to, elements.defaultFrom, elements.defaultTo]) {
    addUnitOptions(select);
  }

  elements.from.value = settings.from;
  elements.to.value = settings.to;
  elements.defaultFrom.value = settings.from;
  elements.defaultTo.value = settings.to;
  elements.precision.value = settings.precision;
  for (const input of elements.rates) {
    input.value = String(settings.rates[input.dataset.material]);
  }
  applyTheme();
  applyProfile();
  renderHistory();
  renderCalculatorHistory();
  renderCalculator();
  renderResult();
  calculatePrintCost();

  window.addEventListener("scroll", () => {
    document.documentElement.classList.add("is-scrolling");
    window.clearTimeout(scrollIdleTimeout);
    scrollIdleTimeout = window.setTimeout(() => {
      document.documentElement.classList.remove("is-scrolling");
    }, 700);
  }, { passive: true });

  document.querySelectorAll(".nav-link[data-section]").forEach((button) => {
    button.addEventListener("click", () => changeSection(button.dataset.section));
  });

  document.querySelector("[data-home]").addEventListener("click", (event) => {
    event.preventDefault();
    changeSection("converter");
  });

  elements.calculatorKeypad.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.calcDigit !== undefined) {
      enterCalculatorDigit(button.dataset.calcDigit);
    } else if (button.dataset.calcOperator) {
      chooseCalculatorOperator(button.dataset.calcOperator);
    } else if (button.dataset.calcAction) {
      applyCalculatorAction(button.dataset.calcAction);
    }
  });
  document.querySelector("[data-clear-calculator-history]").addEventListener("click", clearCalculatorHistory);
  document.addEventListener("keydown", (event) => {
    if (document.querySelector("#section-calculator").hidden) return;
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      enterCalculatorDigit(event.key);
    } else if (event.key === ".") {
      event.preventDefault();
      enterCalculatorDecimal();
    } else if (event.key === "+") {
      event.preventDefault();
      chooseCalculatorOperator("add");
    } else if (event.key === "-") {
      event.preventDefault();
      chooseCalculatorOperator("subtract");
    } else if (event.key === "*") {
      event.preventDefault();
      chooseCalculatorOperator("multiply");
    } else if (event.key === "/") {
      event.preventDefault();
      chooseCalculatorOperator("divide");
    } else if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      evaluateCalculator();
    } else if (event.key === "Escape") {
      event.preventDefault();
      resetCalculator();
    } else if (event.key === "Backspace") {
      event.preventDefault();
      applyCalculatorAction("backspace");
    } else if (event.key === "%") {
      event.preventDefault();
      applyCalculatorAction("percent");
    }
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
  elements.profileName.addEventListener("input", () => {
    settings.name = elements.profileName.value.trim().slice(0, 40);
    elements.brandName.textContent = settings.name || "NexNum";
    document.querySelector("[data-home]").setAttribute("aria-label", `${settings.name || "NexNum"} home`);
    persistSettings();
  });
  elements.profilePhoto.addEventListener("change", async () => {
    const file = elements.profilePhoto.files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
      elements.profilePhoto.value = "";
      showToast("Choose a PNG, JPEG, WebP, or GIF image under 8 MB.");
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.src = imageUrl;
    try {
      await image.decode();
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      settings.photo = canvas.toDataURL("image/jpeg", 0.82);
      persistSettings();
      applyProfile();
    } catch (error) {
      console.error("Unable to process profile photo.", error);
      showToast("Could not load that photo. Try another image.");
    } finally {
      URL.revokeObjectURL(imageUrl);
      elements.profilePhoto.value = "";
    }
  });
  elements.removeProfilePhoto.addEventListener("click", () => {
    settings.photo = "";
    persistSettings();
    applyProfile();
  });
  elements.rates.forEach((input) => {
    input.addEventListener("input", () => {
      const material = input.dataset.material;
      const rate = input.valueAsNumber;
      if (!material || !input.value || !input.validity.valid || !Number.isFinite(rate) || rate < 0) {
        elements.rateFeedback.textContent = "Enter a valid non-negative rate with up to two decimal places.";
        return;
      }
      settings.rates[material] = rate;
      elements.rateFeedback.textContent = "";
      persistSettings();
      calculatePrintCost();
    });
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
  elements.printQuantity.addEventListener("input", calculatePrintCost);
  elements.printUnit.addEventListener("change", calculatePrintCost);
  elements.printMaterial.addEventListener("change", calculatePrintCost);
  elements.printCopy.addEventListener("click", copyPrintCost);

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.error("Service worker registration failed.", error);
      });
    });
  }
})();
