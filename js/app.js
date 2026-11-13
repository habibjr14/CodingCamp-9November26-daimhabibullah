/**
 * Expense & Budget Visualizer
 * Vanilla JS — no frameworks, no build tools.
 * All state lives in `state.transactions`; Local Storage is the persistence layer.
 */

/* =============================================================
   State — single source of truth
   ============================================================= */

/** @type {{ transactions: Transaction[], sortOrder: string, spendingLimit: number|null }} */
const state = {
  transactions: [],
  // Session-only — not persisted to Storage (Requirement 8.5)
  sortOrder: 'default',
  // Persisted to Storage under "spendingLimit" (Requirement 9.3); null = no limit set
  spendingLimit: null,
  // Persisted to Storage under "colorTheme" (Requirement 10.3)
  colorTheme: 'light'
};

/* =============================================================
   Validation Module
   ============================================================= */

/**
 * Returns true if `value` is a non-empty string (after trim) of at most 100 characters.
 * @param {string} value
 * @returns {boolean}
 */
function isValidName(value) {
  const trimmed = String(value).trim();
  return trimmed.length > 0 && trimmed.length <= 100;
}

/**
 * Returns true if `value` is a numeric string whose parsed value is in [0.01, 999999999.99].
 * @param {string} value
 * @returns {boolean}
 */
function isValidAmount(value) {
  const num = Number(value);
  if (!isFinite(num) || isNaN(num)) return false;
  return num >= 0.01 && num <= 999999999.99;
}

/**
 * Returns true only if `value` is exactly one of the three valid category strings.
 * @param {string} value
 * @returns {boolean}
 */
function isValidCategory(value) {
  return value === 'Food' || value === 'Transport' || value === 'Fun';
}

/**
 * Validates all fields from a FormData object.
 * @param {FormData} formData
 * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
 */
function validateForm(formData) {
  const errors = {};

  const name = formData.get('name') || '';
  if (!isValidName(name)) {
    errors.name = 'Item name is required and must be at most 100 characters.';
  }

  const amount = formData.get('amount') || '';
  if (!isValidAmount(amount)) {
    errors.amount = 'Amount must be a number between 0.01 and 999,999,999.99.';
  }

  const category = formData.get('category') || '';
  if (!isValidCategory(category)) {
    errors.category = 'Please select a valid category: Food, Transport, or Fun.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Returns true if `value` is a numeric string whose parsed value is in [0.01, 999999999.99].
 * Returns false for non-numeric, out-of-range, or empty input.
 * Same range rules as isValidAmount.
 * Requirements: 9.2
 * @param {string} value
 * @returns {boolean}
 */
function validateSpendingLimit(value) {
  // Empty input is invalid
  if (!value || String(value).trim() === '') {
    return false;
  }

  const num = Number(value);
  if (!isFinite(num) || isNaN(num)) return false;
  return num >= 0.01 && num <= 999999999.99;
}

/* =============================================================
   API Availability Module
   ============================================================= */

/**
 * Checks whether the browser exposes the Web APIs the app depends on.
 * @returns {{ ok: boolean, missing: string[] }}
 */
function checkApiAvailability() {
  const required = {
    localStorage: typeof localStorage !== 'undefined',
    crypto:       typeof crypto !== 'undefined',
    // Fetch is listed in requirements but not used in this offline SPA;
    // still checked and warned about if missing.
    fetch:        typeof fetch !== 'undefined'
  };
  const missing = Object.entries(required)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  return { ok: missing.length === 0, missing };
}

/* =============================================================
   Storage Module
   ============================================================= */

/**
 * Probe-tests Local Storage with a temporary write/read/delete cycle.
 * Returns true if all three operations succeed without throwing.
 * @returns {boolean}
 */
function checkStorageAvailable() {
  try {
    const probe = '__probe__';
    localStorage.setItem(probe, '1');
    const readBack = localStorage.getItem(probe);
    localStorage.removeItem(probe);
    return readBack === '1';
  } catch (e) {
    return false;
  }
}

/**
 * Reads and validates the persisted transaction list from Local Storage.
 * Returns an empty array if the key is absent, the JSON is malformed,
 * or any element fails the Transaction shape check.
 * Calls showStorageWarning() on parse or validation failure.
 * @returns {Transaction[]}
 */
function loadFromStorage() {
  const raw = localStorage.getItem('transactions');

  // First run — nothing stored yet, no warning needed.
  if (raw === null || raw === undefined) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    showStorageWarning();
    return [];
  }

  // Must be an array of Transaction objects.
  if (!Array.isArray(parsed)) {
    showStorageWarning();
    return [];
  }

  const validCategories = new Set(['Food', 'Transport', 'Fun']);
  const isValidTransaction = (t) =>
    t !== null &&
    typeof t === 'object' &&
    typeof t.id        === 'string' &&
    typeof t.name      === 'string' &&
    typeof t.amount    === 'number' &&
    validCategories.has(t.category) &&
    typeof t.timestamp === 'number';

  if (!parsed.every(isValidTransaction)) {
    showStorageWarning();
    return [];
  }

  return parsed;
}

/**
 * Serializes `transactions` to JSON and writes it to Local Storage under "transactions".
 * Returns true on success, false if setItem throws (e.g. QuotaExceededError).
 * @param {Transaction[]} transactions
 * @returns {boolean}
 */
function saveToStorage(transactions) {
  try {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Reads the persisted spending limit from Local Storage under "spendingLimit".
 * Parses the JSON value and validates it is a finite number in [0.01, 999999999.99].
 * Returns null if the key is absent, the JSON is malformed, or the value is out of range.
 * Requirements: 9.3, 9.6
 * @returns {number|null}
 */
function loadSpendingLimit() {
  var raw = localStorage.getItem('spendingLimit');
  if (raw === null || raw === undefined) {
    return null;
  }

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return null;
  }

  if (typeof parsed !== 'number' || !isFinite(parsed) || isNaN(parsed)) {
    return null;
  }

  if (parsed < 0.01 || parsed > 999999999.99) {
    return null;
  }

  return parsed;
}

/**
 * Serializes `value` as a JSON number and writes it to Local Storage under "spendingLimit".
 * Returns true on success, false if setItem throws (e.g. QuotaExceededError).
 * Requirements: 9.3
 * @param {number} value
 * @returns {boolean}
 */
function saveSpendingLimit(value) {
  try {
    localStorage.setItem('spendingLimit', JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Removes the "spendingLimit" key from Local Storage and resets state.spendingLimit to null.
 * Requirements: 9.6
 * @returns {void}
 */
function removeSpendingLimit() {
  localStorage.removeItem('spendingLimit');
  state.spendingLimit = null;
}
/* =============================================================
   Theme Module (Requirements 10.1 – 10.6)
   ============================================================= */

/**
 * Reads the persisted color theme from Local Storage under "colorTheme".
 * Returns "dark" or "light" for valid stored values; "light" otherwise.
 * @returns {"light" | "dark"}
 */
function loadTheme() {
  try {
    var stored = localStorage.getItem('colorTheme');
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch (e) {
    // Storage unavailable — fall through to default
  }
  return 'light';
}

/**
 * Persists the theme string under "colorTheme".
 * Failure is silent — the theme still applies to the current session.
 * @param {"light" | "dark"} theme
 */
function saveTheme(theme) {
  try {
    localStorage.setItem('colorTheme', theme);
  } catch (e) {
    // Non-critical — preference will not persist across reloads
  }
}

/**
 * Applies the given theme by toggling the "dark-mode" class on <html>.
 * Also updates the toggle button icon + aria-label. No inline styles used.
 * Requirements: 10.2, 10.4, 10.5, 10.6
 * @param {"light" | "dark"} theme
 */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark-mode');
  } else {
    document.documentElement.classList.remove('dark-mode');
  }
  state.colorTheme = theme;

  var btn = document.getElementById('theme-toggle');
  if (btn) {
    if (theme === 'dark') {
      btn.textContent = '☀️';
      btn.setAttribute('aria-label', 'Switch to light mode');
    } else {
      btn.textContent = '🌙';
      btn.setAttribute('aria-label', 'Switch to dark mode');
    }
  }
}

/**
 * Flips between light and dark, applies, then persists.
 * Requirements: 10.2, 10.3
 */
function toggleTheme() {
  var next = state.colorTheme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
}

/**
 * Click handler for the theme toggle button.
 */
function handleThemeToggle() {
  toggleTheme();
}
/* =============================================================
   Transaction Module
   ============================================================= */

/**
 * Generates a unique string ID.
 * Uses crypto.randomUUID() when available; falls back to Date.now + Math.random.
 * @returns {string}
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Creates a new transaction, persists it, and re-renders the UI.
 * If storage write fails, rolls back the addition and shows an error.
 * @param {string} name     - Item name (will be trimmed)
 * @param {number|string} amount - Monetary value (will be parsed as float)
 * @param {string} category - One of "Food" | "Transport" | "Fun"
 * @returns {void}
 * Requirements: 1.2, 5.1
 */
function addTransaction(name, amount, category) {
  /** @type {Transaction} */
  const transaction = {
    id:        generateId(),
    name:      String(name).trim(),
    amount:    parseFloat(amount),
    category:  category,
    timestamp: Date.now()
  };

  state.transactions.push(transaction);

  const saved = saveToStorage(state.transactions);
  if (!saved) {
    // Rollback — remove the transaction we just added
    state.transactions.pop();
    showStorageError();
    return;
  }

  renderAll();
}

/**
 * Removes the transaction with the given `id` from state, persists the change,
 * and re-renders the UI. Does nothing if the id is not found.
 * @param {string} id
 * @returns {void}
 * Requirements: 2.5, 5.2
 */
function deleteTransaction(id) {
  const index = state.transactions.findIndex(function (t) { return t.id === id; });

  // No-op if the id doesn't exist in the list
  if (index === -1) {
    return;
  }

  state.transactions = state.transactions.filter(function (t) { return t.id !== id; });

  saveToStorage(state.transactions);
  renderAll();
}

/* =============================================================
   Chart Module — constants and module-level instance
   ============================================================= */

/** @type {{ Food: string, Transport: string, Fun: string }} */
const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56'
};

/**
 * Module-level reference to the active Chart.js instance.
 * Must be destroyed before a new instance is created on the same canvas.
 * @type {import('chart.js').Chart | null}
 */
let chartInstance = null;

/**
 * Computes the total spending per category for the given transactions.
 * Returns an object whose keys are the category names that have a total > 0.
 * Categories with no matching transactions are omitted entirely.
 * @param {Transaction[]} transactions
 * @returns {{ [category: string]: number }}
 */
function computeCategoryTotals(transactions) {
  const totals = {};
  transactions.forEach(function (t) {
    if (!totals[t.category]) {
      totals[t.category] = 0;
    }
    totals[t.category] += t.amount;
  });

  // Remove categories whose total is zero (guards against floating-point edge cases)
  Object.keys(totals).forEach(function (key) {
    if (totals[key] <= 0) {
      delete totals[key];
    }
  });

  return totals;
}

/**
 * Destroys the existing Chart.js instance (if any), then either:
 *  - Shows the no-data placeholder when no category has spending > 0, OR
 *  - Creates a fresh pie chart with one slice per non-zero category.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 * @returns {void}
 */
function renderChart() {
  const canvas    = document.getElementById('spending-chart');
  const noDataEl  = document.getElementById('chart-no-data');

  if (!canvas || !noDataEl) return;

  // Destroy the existing instance so the canvas can be reused without errors.
  if (chartInstance !== null) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const totals     = computeCategoryTotals(state.transactions);
  const categories = Object.keys(totals);

  if (categories.length === 0) {
    // No spending data — hide canvas, show placeholder text.
    canvas.hidden  = true;
    noDataEl.hidden = false;
    return;
  }

  // Guard: if Chart.js CDN failed to load, show no-data placeholder instead
  // of throwing an uncaught ReferenceError (Requirement 4.4 error handling).
  if (typeof Chart === 'undefined') {
    canvas.hidden  = true;
    noDataEl.hidden = false;
    noDataEl.textContent = 'Chart could not be loaded. Please check your internet connection.';
    return;
  }

  // Spending exists — show canvas, hide placeholder.
  canvas.hidden  = false;
  noDataEl.hidden = true;

  const labels          = categories;
  const data            = categories.map(function (c) { return totals[c]; });
  const backgroundColors = categories.map(function (c) { return CATEGORY_COLORS[c]; });

  chartInstance = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data:            data,
        backgroundColor: backgroundColors
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          enabled: true
        }
      }
    }
  });
}

/* =============================================================
   Rendering Helpers — pure functions (independently testable)
   ============================================================= */

/**
 * Formats a number as a USD currency string with thousands separators and
 * exactly two decimal places, e.g. 1500 → "$1,500.00".
 * @param {number} n
 * @returns {string}
 */
function formatCurrency(n) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Returns the arithmetic sum of all `amount` fields in the given array.
 * Returns 0 for an empty array.
 * @param {Transaction[]} transactions
 * @returns {number}
 */
function computeBalance(transactions) {
  return transactions.reduce(function (sum, t) { return sum + t.amount; }, 0);
}

/**
 * Returns a NEW array sorted in strictly descending timestamp order
 * (most recent first). The original array is not mutated.
 * @param {Transaction[]} transactions
 * @returns {Transaction[]}
 */
function sortByTimestampDesc(transactions) {
  return transactions.slice().sort(function (a, b) { return b.timestamp - a.timestamp; });
}

/**
 * Pure function. Returns a new array of transactions sorted according to
 * `order`. The input array is never mutated.
 *
 * Sort orders:
 *  "default"      — descending timestamp (most recent first)
 *  "amount-asc"   — ascending amount (lowest first)
 *  "amount-desc"  — descending amount (highest first)
 *  "category-asc" — alphabetical category name (A–Z)
 *
 * Requirements: 8.2, 8.3, 8.4, 8.5
 *
 * @param {Transaction[]} transactions
 * @param {string} order - One of "default" | "amount-asc" | "amount-desc" | "category-asc"
 * @returns {Transaction[]}
 */
function sortTransactions(transactions, order) {
  var copy = transactions.slice();
  if (order === 'amount-asc') {
    copy.sort(function (a, b) { return a.amount - b.amount; });
  } else if (order === 'amount-desc') {
    copy.sort(function (a, b) { return b.amount - a.amount; });
  } else if (order === 'category-asc') {
    copy.sort(function (a, b) {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return 0;
    });
  } else {
    // "default" — reverse-chronological (descending timestamp)
    copy.sort(function (a, b) { return b.timestamp - a.timestamp; });
  }
  return copy;
}

/* =============================================================
   Rendering Module
   ============================================================= */

/**
 * Rebuilds the transaction list `<ul>` from `state.transactions`.
 * Items are displayed in reverse-chronological order (most recent first).
 * Shows an empty-state message when there are no transactions.
 * Requirements: 2.1, 2.2, 2.3, 2.4
 * @returns {void}
 */
function renderTransactionList() {
  const list = document.getElementById('transaction-list');
  const emptyState = document.getElementById('empty-state');

  if (!list) return;

  // Remove all existing transaction items (keep the empty-state li in the DOM)
  Array.from(list.querySelectorAll('.transaction-item')).forEach(function (el) {
    el.remove();
  });

  if (state.transactions.length === 0) {
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (emptyState) emptyState.hidden = true;

  const sorted = sortTransactions(state.transactions, state.sortOrder);

  sorted.forEach(function (t) {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.dataset.id = t.id;

    if (state.spendingLimit !== null && t.amount > state.spendingLimit) {
      li.classList.add('item-over-limit');
    }

    // Build category badge modifier class (lowercase key)
    const badgeClass = 'category-badge--' + t.category.toLowerCase();

    li.innerHTML =
      '<div class="transaction-info">' +
        '<span class="transaction-name">' + escapeHtml(t.name) + '</span>' +
        '<span class="transaction-meta">' +
          '<span class="category-badge ' + badgeClass + '">' + escapeHtml(t.category) + '</span>' +
        '</span>' +
      '</div>' +
      '<span class="transaction-amount">' + formatCurrency(t.amount) + '</span>' +
      '<button class="btn-delete" data-id="' + escapeHtml(t.id) + '" ' +
        'aria-label="Delete ' + escapeHtml(t.name) + '">' +
        '&#x2715;' +
      '</button>';

    list.appendChild(li);
  });
}

/**
 * Sums all transaction amounts and updates the balance display element.
 * Shows "$0.00" when there are no transactions.
 * Requirements: 3.1, 3.2, 3.3, 3.4
 * @returns {void}
 */
function renderBalance() {
  const balanceEl = document.getElementById('balance-display');
  if (!balanceEl) return;

  const total = computeBalance(state.transactions);
  balanceEl.textContent = formatCurrency(total);

  const isOverLimit = state.spendingLimit !== null && total > state.spendingLimit;

  if (isOverLimit) {
    balanceEl.classList.add('over-limit');
  } else {
    balanceEl.classList.remove('over-limit');
  }

  // Persistent text warning shown while the total exceeds the spending
  // limit. Complements the visual highlight (Req 9.4) with an explicit
  // message; updates in sync with the balance, no separate render pass.
  const limitWarningEl = document.getElementById('limit-warning');
  if (limitWarningEl) {
    if (isOverLimit) {
      limitWarningEl.textContent =
        'Warning: your total spending (' + formatCurrency(total) + ') has exceeded ' +
        'your spending limit of ' + formatCurrency(state.spendingLimit) + '.';
      limitWarningEl.hidden = false;
    } else {
      limitWarningEl.hidden = true;
      limitWarningEl.textContent = '';
    }
  }
}

/**
 * Minimal HTML-escape helper to prevent XSS when inserting user-supplied
 * strings via innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* =============================================================
   UI Warning / Error Display Functions (task 8.2)
   ============================================================= */

/**
 * Renders per-field inline validation error messages next to the relevant
 * form inputs.  Any field whose key is absent from `errors` has its message
 * cleared so stale errors don't linger after re-validation.
 * Requirements: 1.3, 1.4
 *
 * @param {{ name?: string, amount?: string, category?: string }} errors
 */
function showFieldErrors(errors) {
  var fields = ['name', 'amount', 'category'];
  fields.forEach(function (field) {
    var errorEl = document.getElementById('error-' + field);
    if (!errorEl) return;

    var message = errors[field] || '';
    errorEl.textContent = message;

    // Toggle a CSS modifier so the span takes up visible space only when
    // there is an actual error (avoids layout shift for empty spans).
    if (message) {
      errorEl.classList.add('field-error--visible');
      // Point the matching input at this error for assistive technology.
      var inputEl = document.querySelector('[name="' + field + '"]');
      if (inputEl) {
        inputEl.setAttribute('aria-invalid', 'true');
        inputEl.setAttribute('aria-describedby', errorEl.id);
      }
    } else {
      errorEl.classList.remove('field-error--visible');
      var inputEl2 = document.querySelector('[name="' + field + '"]');
      if (inputEl2) {
        inputEl2.removeAttribute('aria-invalid');
        inputEl2.removeAttribute('aria-describedby');
      }
    }
  });
}

/**
 * Clears all field-level inline error messages from the form and removes
 * aria-invalid attributes so the form returns to a neutral state.
 */
function clearFieldErrors() {
  var fields = ['name', 'amount', 'category'];
  fields.forEach(function (field) {
    var errorEl = document.getElementById('error-' + field);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('field-error--visible');
    }
    var inputEl = document.querySelector('[name="' + field + '"]');
    if (inputEl) {
      inputEl.removeAttribute('aria-invalid');
      inputEl.removeAttribute('aria-describedby');
    }
  });
}

/**
 * Displays a non-blocking warning banner in the `#app-warning` element
 * when Local Storage is unavailable or contains invalid data on app init.
 * The banner auto-dismisses after 4 seconds (≥ 3 s as required) and
 * never blocks user interaction.
 * Requirements: 5.4
 */
function showStorageWarning() {
  var warningEl = document.getElementById('app-warning');
  if (!warningEl) {
    console.warn('Storage warning: Local Storage is unavailable or contains invalid data.');
    return;
  }

  warningEl.textContent =
    'Warning: your transaction history could not be loaded. ' +
    'Local Storage may be unavailable or contain invalid data. ' +
    'Starting with an empty list.';
  warningEl.hidden = false;
  warningEl.classList.add('app-warning--visible');

  // Auto-dismiss after 4 000 ms (satisfies the ≥ 3 s requirement)
  setTimeout(function () {
    warningEl.classList.remove('app-warning--visible');
    // Keep the element in the DOM but hide it after the fade-out transition
    // (300 ms is the CSS transition duration; fall back gracefully if none).
    setTimeout(function () {
      warningEl.hidden = true;
      warningEl.textContent = '';
    }, 350);
  }, 4000);
}

/**
 * Displays an inline error message inside the form when a storage write
 * fails during a transaction add attempt (Requirement 1.6).
 * The error is shown in the `#storage-error` div that lives just below the
 * submit button.  It auto-clears the next time the form is submitted.
 * Requirements: 1.6
 */
function showStorageError() {
  var errorEl = document.getElementById('storage-error');
  if (!errorEl) {
    console.error('Storage error: the transaction could not be saved.');
    return;
  }

  errorEl.textContent =
    'The transaction could not be saved because storage is unavailable. ' +
    'Please check your browser settings and try again.';
  errorEl.hidden = false;
  errorEl.classList.add('storage-error--visible');
}

/**
 * Hides the storage-error banner.  Called at the start of handleFormSubmit
 * to clear any error left over from a previous attempt.
 */
function clearStorageError() {
  var errorEl = document.getElementById('storage-error');
  if (!errorEl) return;
  errorEl.hidden = true;
  errorEl.textContent = '';
  errorEl.classList.remove('storage-error--visible');
}

/**
 * Displays an inline error message below the spending limit input.
 * Requirements: 9.2
 * @param {string} message
 */
function showSpendingLimitError(message) {
  var errorEl = document.getElementById('error-spending-limit');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.add('field-error--visible');
  var inputEl = document.getElementById('spending-limit-input');
  if (inputEl) {
    inputEl.setAttribute('aria-invalid', 'true');
    inputEl.setAttribute('aria-describedby', 'error-spending-limit');
  }
}

/**
 * Clears the spending limit inline error message.
 */
function clearSpendingLimitError() {
  var errorEl = document.getElementById('error-spending-limit');
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.classList.remove('field-error--visible');
  var inputEl = document.getElementById('spending-limit-input');
  if (inputEl) {
    inputEl.removeAttribute('aria-invalid');
    inputEl.removeAttribute('aria-describedby');
  }
}

/**
 * Renders a full-viewport compatibility warning when one or more required
 * Web APIs are absent.  The warning is injected into `<main>` before all
 * other content so it is immediately visible.  The calling code is
 * responsible for halting any code paths that depend on the missing APIs
 * (achieved by returning early after this call in the DOMContentLoaded handler).
 * Requirements: 7.4
 *
 * @param {string[]} missing - Names of the missing Web APIs, e.g. ["localStorage", "fetch"]
 */
function showCompatibilityWarning(missing) {
  var main = document.querySelector('main');
  if (!main) {
    // Fallback: use document.body when <main> isn't reachable yet
    main = document.body || document.documentElement;
  }

  // Build the warning element
  var warning = document.createElement('div');
  warning.className = 'compat-warning';
  warning.setAttribute('role', 'alert');
  warning.setAttribute('aria-live', 'assertive');

  // Heading
  var heading = document.createElement('h2');
  heading.className = 'compat-warning__title';
  heading.textContent = 'Browser Not Supported';

  // Body copy
  var body = document.createElement('p');
  body.className = 'compat-warning__body';
  body.textContent =
    'This app requires features that are not available in your browser. ' +
    'Please upgrade to a modern browser (Chrome, Firefox, Edge, or Safari) ' +
    'to use the Expense & Budget Visualizer.';

  // Missing API list
  var list = document.createElement('ul');
  list.className = 'compat-warning__list';
  missing.forEach(function (api) {
    var item = document.createElement('li');
    item.textContent = 'Missing API: ' + api;
    list.appendChild(item);
  });

  warning.appendChild(heading);
  warning.appendChild(body);
  warning.appendChild(list);

  // Prepend so it appears above all other content
  main.prepend(warning);

  // Disable all interactive elements inside main so the app cannot be
  // partially used in an unsupported environment (code paths are halted
  // by the caller, but this prevents accidental tab/click access).
  var interactives = main.querySelectorAll('button, input, select, textarea, a[href]');
  interactives.forEach(function (el) {
    el.setAttribute('disabled', 'disabled');
    el.setAttribute('aria-disabled', 'true');
    el.setAttribute('tabindex', '-1');
  });
}

/**
 * Calls renderTransactionList, renderBalance, and renderChart in sequence.
 */
function renderAll() {
  renderTransactionList();
  renderBalance();
  renderChart();
}

/* =============================================================
   Event Handlers
   ============================================================= */

/**
 * Handles change events on the sort-order `<select>`.
 * Updates `state.sortOrder` to the newly selected value and re-renders the
 * transaction list to reflect the chosen order.  Sort order is session-only
 * and is intentionally NOT written to Storage (Requirement 8.5).
 * Requirements: 8.2, 8.5
 * @param {Event} event
 */
function handleSortChange(event) {
  state.sortOrder = event.target.value;
  renderTransactionList();
}

/**
 * Handles the form's submit event.
 * Prevents default browser submission, reads FormData, validates all fields,
 * shows inline errors on failure, or creates the transaction and resets the
 * form on success.
 * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6
 * @param {Event} event
 */
function handleFormSubmit(event) {
  event.preventDefault();

  // Clear any previous field errors and storage error before re-validating
  clearFieldErrors();
  clearStorageError();

  var form = event.target;
  var formData = new FormData(form);
  var result = validateForm(formData);

  if (!result.valid) {
    showFieldErrors(result.errors);
    return;
  }

  // Check storage availability before attempting to persist
  if (!checkStorageAvailable()) {
    showStorageError();
    return;
  }

  var name     = formData.get('name');
  var amount   = formData.get('amount');  // addTransaction handles parseFloat internally
  var category = formData.get('category');

  addTransaction(name, amount, category);

  // Requirement 1.5 — reset the form after successful submission
  form.reset();

  // Clear any stale field errors that might remain after reset
  clearFieldErrors();
}

/**
 * Delegated click handler for the transaction list.
 * Checks whether the clicked element (or its closest ancestor within the list)
 * is a delete button with a `data-id` attribute, then calls deleteTransaction.
 * Requirements: 2.5
 * @param {MouseEvent} event
 */
function handleDeleteClick(event) {
  // Walk up from the actual click target to find a .btn-delete button
  var btn = event.target.closest('.btn-delete');
  if (!btn) return;

  var id = btn.dataset.id;
  if (id) {
    deleteTransaction(id);
  }
}

/**
 * Handles the spending limit set/save button click.
 * Reads the limit input value, validates it, sets state.spendingLimit and persists
 * on success; shows inline error on failure.
 * Requirements: 9.1, 9.2, 9.3
 * @returns {void}
 */
function handleSpendingLimitSubmit() {
  clearSpendingLimitError();

  var inputEl = document.getElementById('spending-limit-input');
  if (!inputEl) return;

  var value = inputEl.value;

  if (!validateSpendingLimit(value)) {
    showSpendingLimitError('Please enter a valid amount between 0.01 and 999,999,999.99.');
    return;
  }

  var limitValue = parseFloat(value);

  var saved = saveSpendingLimit(limitValue);
  if (!saved) {
    showSpendingLimitError('The spending limit could not be saved. Storage may be unavailable.');
    return;
  }

  state.spendingLimit = limitValue;
  renderAll();
}

/**
 * Handles the clear spending limit button click.
 * Removes the spending limit from Storage and state, then re-renders.
 * Requirements: 9.6
 * @returns {void}
 */
function handleClearLimit() {
  clearSpendingLimitError();
  removeSpendingLimit();
  renderAll();
}

/* =============================================================
   DOMContentLoaded — application entry point
   ============================================================= */

document.addEventListener('DOMContentLoaded', function () {
  // Requirements 7.3, 7.4 — check for required Web APIs before doing anything else
  var apiCheck = checkApiAvailability();
  if (!apiCheck.ok) {
    showCompatibilityWarning(apiCheck.missing);
    // Halt all code paths that depend on the missing APIs
    return;
  }

  // Requirement 5.3 — read persisted transactions from Storage on init
  state.transactions = loadFromStorage();

  // Requirement 9.3 — restore persisted spending limit from Storage on init
  state.spendingLimit = loadSpendingLimit();

  // Requirement 10.4 — apply persisted theme BEFORE first render to
  // prevent a flash of the wrong theme
  state.colorTheme = loadTheme();
  applyTheme(state.colorTheme);

  // Initial render — populate Transaction_List, Balance_Display, and Chart
  renderAll();

  // Wire up event listeners
  var form = document.getElementById('transaction-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  var list = document.getElementById('transaction-list');
  if (list) {
    list.addEventListener('click', handleDeleteClick);
  }

  var sortSelect = document.getElementById('sort-order');
  if (sortSelect) {
    sortSelect.addEventListener('change', handleSortChange);
  }

  // Requirements 9.1, 9.2, 9.6 — spending limit set and clear handlers
  var btnSetLimit = document.getElementById('btn-set-limit');
  if (btnSetLimit) {
    btnSetLimit.addEventListener('click', handleSpendingLimitSubmit);
  }

  var btnClearLimit = document.getElementById('btn-clear-limit');
  if (btnClearLimit) {
    btnClearLimit.addEventListener('click', handleClearLimit);
  }
});