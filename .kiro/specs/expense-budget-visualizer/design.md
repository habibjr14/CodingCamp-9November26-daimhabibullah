# Design Document

## Overview

The Expense & Budget Visualizer is a single-page application (SPA) built entirely with vanilla HTML, CSS, and JavaScript — no frameworks, no build tools, and no backend. All state lives in the browser's Local Storage, and the UI re-renders synchronously on every mutation.

The application has five primary concerns:

1. **Transaction management** — add and delete spending records.
2. **Balance display** — always-current running total, presented inside a hero section below a sticky navigation bar.
3. **Spending chart** — a Chart.js pie chart that reflects live data.
4. **Persistence** — read/write to Local Storage under the keys `"transactions"`, `"spendingLimit"`, and `"colorTheme"`.
5. **Budget awareness** — visual highlighting plus an explicit text warning when spending exceeds a user-set limit, and a light/dark theme toggle for comfortable viewing.

Because there is exactly one HTML file, one CSS file, and one JavaScript file, the architecture is intentionally flat. Complexity is managed through clear module-level separation inside `js/app.js` using plain functions and a single in-memory state object rather than classes or ES modules.

---

## Architecture

### File Layout

```
index.html          ← markup, CDN script tag for Chart.js, links to css/styles.css and js/app.js
css/
  styles.css        ← all styling and responsive media queries
js/
  app.js            ← all application logic (state, storage, rendering, event handlers)
```

No other files are created. No bundler, no transpiler, no package.json.

### Page Structure (`index.html`)

```
<nav class="navbar">          ← sticky top bar: brand + #theme-toggle (Req 11.1, 11.2)
<header class="app-header">   ← hero section: heading, subtext, .balance-container
  <div class="balance-container">
    #balance-display          ← existing element, unchanged id
    #limit-warning            ← new: persistent English over-limit text warning
<main class="app-main">
  <section class="form-section">   ← transaction form + spending-limit controls
  <section class="list-section">   ← sort control + #transaction-list
  <section class="chart-section">  ← .chart-container (fixed aspect-ratio) + #spending-chart
```

All element `id`s referenced by `js/app.js` are preserved exactly; the navbar/hero introduction only relocates `#theme-toggle` and `#balance-display` into new wrapper markup and adds the new `#limit-warning` element.

### Execution Flow

```mermaid
flowchart TD
    A[DOMContentLoaded] --> B[checkApiAvailability]
    B -->|APIs ok| C[loadFromStorage]
    B -->|API missing| D[showCompatibilityWarning & halt]
    C -->|valid JSON| E[state.transactions = parsed]
    C -->|invalid/empty| F[state.transactions = [] + showStorageWarning]
    E --> G1[loadTheme]
    F --> G1
    G1 --> G2[loadSpendingLimit]
    G2 --> G[renderAll]
    G --> H[renderTransactionList]
    G --> I[renderBalance]
    G --> J[renderChart]
    H --> K[Idle — awaiting user events]
    I --> K
    J --> K
    K -->|form submit| L[validateForm]
    L -->|valid| M[addTransaction]
    L -->|invalid| N[showFieldErrors]
    M --> O[saveToStorage]
    O -->|ok| P[renderAll]
    O -->|fail| Q[showStorageError & rollback]
    K -->|delete click| R[deleteTransaction]
    R --> S[saveToStorage]
    S --> P
    K -->|sort change| T[state.sortOrder = selected]
    T --> H
    K -->|spending limit submit| U[validateSpendingLimit]
    U -->|valid| V[state.spendingLimit = value & saveSpendingLimit]
    U -->|invalid| W[showLimitError]
    V --> P
    K -->|clear limit click| X[state.spendingLimit = null & removeSpendingLimit]
    X --> P
    K -->|theme toggle| Y[toggleTheme]
    Y --> Z[applyTheme & saveTheme]
    Z --> P
```

### Design Decisions

- **Single state object**: `state.transactions` is the single source of truth. Every render reads from this array.
- **Full re-render on mutation**: After any add or delete, `renderAll()` rebuilds the transaction list DOM, recalculates the balance, and updates the chart. This keeps logic simple and correct at the cost of trivial DOM thrashing on small data sets.
- **Chart instance lifecycle**: A module-level `chartInstance` variable holds the Chart.js object. Before every re-render of the chart, the existing instance is destroyed with `chartInstance.destroy()` and recreated, avoiding the "canvas already in use" error.
- **No ES modules**: The file is a classic script. All functions and the state object are in the same scope. This is intentional — no module system means no import/export, keeping the file runnable without a server in a plain `file://` context.
- **Sort order not persisted**: `state.sortOrder` is session-only. Resetting to default on page load is intentional to keep Storage footprint minimal and behaviour predictable.
- **Spending limit persisted separately**: The limit is written to `"spendingLimit"` as a bare JSON number (not embedded in the transactions array) so reads/writes are independent.
- **Theme applied before first render**: `applyTheme` is called immediately after reading Storage, before `renderAll`, to prevent a flash of the wrong theme. The `dark-mode` class is toggled on `<html>` so CSS custom properties cascade to every element automatically.
- **Highlight via CSS classes only**: Over-limit states are indicated by adding/removing CSS classes (`over-limit`, `item-over-limit`). No inline styles are used for theme or highlight colors.
- **Over-limit text warning alongside the highlight**: In addition to the `over-limit` class on `Balance_Display`, `renderBalance` writes/clears the text content of a dedicated `#limit-warning` element and toggles its `hidden` attribute. This keeps the highlight (color-only) and the warning (explicit text, for users who cannot rely on color alone) in a single render pass with no extra function call sites.
- **Navbar + hero as presentation only**: The sticky navigation bar and hero section introduced for the visual redesign are pure markup/CSS additions. They introduce no new state, no new Storage keys, and relocate existing elements (`#theme-toggle`, `#balance-display`) into new containers without changing their `id`, so no JS function signature changes as a result of the redesign itself.
- **Genuinely distinct light/dark palettes**: The CSS custom properties under `:root` define a real light theme (light backgrounds, dark text) as the default, and `html.dark-mode` overrides them with a dark, higher-contrast "neon-accented" palette. This satisfies Requirement 10.8 — the two themes must be visually distinguishable, not two shades of the same dark palette.
- **Chart container uses a fixed aspect ratio**: `.chart-container` is given `aspect-ratio: 1 / 1` and the `<canvas>` is absolutely positioned to fill it (`inset: 0`), rather than relying solely on Chart.js's `responsive` resize observer against a flexible parent. This avoids the canvas becoming visually distorted ("flattened") after the container crosses a responsive breakpoint more than once (e.g. desktop → tablet → desktop). No change to `renderChart`'s Chart.js options was needed.

---

## Components and Interfaces

All components are plain functions. There are no classes. The interfaces below describe function signatures and their contracts.

### State

```js
// Module-level singleton — the only mutable state
const state = {
  transactions: [],   // Transaction[]
  sortOrder:    "default",  // "default" | "amount-asc" | "amount-desc" | "category-asc"
  spendingLimit: null,      // number | null  — persisted to Storage; null means unset
  colorTheme:   "light"     // "light" | "dark" — persisted to Storage
};
```

### Storage Module

| Function | Signature | Description |
|---|---|---|
| `loadFromStorage` | `() → Transaction[]` | Reads `"transactions"` key from `localStorage`, parses JSON, validates shape. Returns `[]` on failure. |
| `saveToStorage` | `(Transaction[]) → boolean` | Serializes array to JSON and writes to `"transactions"`. Returns `true` on success, `false` if `localStorage.setItem` throws. |
| `checkStorageAvailable` | `() → boolean` | Attempts a probe write/read/delete; returns `true` if Local Storage is accessible. |
| `loadSpendingLimit` | `() → number \| null` | Reads `"spendingLimit"` from `localStorage`, parses JSON, validates it is a number in [0.01, 999999999.99]. Returns `null` on failure or absence. |
| `saveSpendingLimit` | `(number) → boolean` | Serializes the limit as a JSON number and writes to `"spendingLimit"`. Returns `true` on success, `false` on error. |
| `removeSpendingLimit` | `() → void` | Calls `localStorage.removeItem("spendingLimit")` and sets `state.spendingLimit = null`. |
| `loadTheme` | `() → "light" \| "dark"` | Reads `"colorTheme"` from `localStorage`. Returns the stored value if it is `"dark"` or `"light"`, otherwise returns `"light"`. |
| `saveTheme` | `("light" \| "dark") → void` | Writes the theme string to `localStorage` under key `"colorTheme"`. |

### Validation Module

| Function | Signature | Description |
|---|---|---|
| `validateForm` | `(FormData) → ValidationResult` | Returns `{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }`. |
| `isValidName` | `(string) → boolean` | Non-empty after trim, max 100 chars. |
| `isValidAmount` | `(string) → boolean` | Numeric, in range [0.01, 999999999.99]. |
| `isValidCategory` | `(string) → boolean` | One of `"Food"`, `"Transport"`, `"Fun"`. |
| `validateSpendingLimit` | `(string) → boolean` | Numeric, in range [0.01, 999999999.99]. Returns `false` for non-numeric, out-of-range, or empty input. Same range rules as `isValidAmount`. |

### Transaction Module

| Function | Signature | Description |
|---|---|---|
| `addTransaction` | `(name: string, amount: number, category: string) → Transaction` | Creates a new `Transaction` with a generated `id` and `timestamp`, pushes to `state.transactions`, persists, then calls `renderAll`. |
| `deleteTransaction` | `(id: string) → void` | Removes the matching entry from `state.transactions`, persists, then calls `renderAll`. |
| `generateId` | `() → string` | Returns a unique string (crypto.randomUUID with fallback to Date.now + Math.random). |

### Rendering Module

| Function | Signature | Description |
|---|---|---|
| `renderAll` | `() → void` | Calls `renderTransactionList`, `renderBalance`, and `renderChart` in sequence. |
| `renderTransactionList` | `() → void` | Sorts `state.transactions` via `sortTransactions(state.transactions, state.sortOrder)`, then rebuilds the `<ul>`. Applies `item-over-limit` class to entries where `state.spendingLimit !== null && transaction.amount > state.spendingLimit`. Shows empty-state message when list is empty. |
| `renderBalance` | `() → void` | Sums all amounts and updates the balance element's text content using `formatCurrency`. Applies `over-limit` class to `Balance_Display` when `state.spendingLimit !== null && total > state.spendingLimit`; removes it otherwise. Also sets the text content of `#limit-warning` to an English message naming the current total and the limit, and un-hides it, when over limit; hides and clears it otherwise. |
| `renderChart` | `() → void` | Destroys existing Chart.js instance if present, then recreates with current category totals, or displays no-data message. |
| `formatCurrency` | `(number) → string` | Returns a string like `"$1,500.00"` using `toLocaleString`. |
| `sortTransactions` | `(Transaction[], SortOrder) → Transaction[]` | Pure function. Returns a new sorted array without mutating the input. Sort orders: `"default"` → descending `timestamp`; `"amount-asc"` → ascending `amount`; `"amount-desc"` → descending `amount`; `"category-asc"` → alphabetical `category`. |
| `applyTheme` | `("light" \| "dark") → void` | Toggles the `dark-mode` CSS class on `<html>`. Adds the class for `"dark"`, removes it for `"light"`. Updates `state.colorTheme`. |
| `toggleTheme` | `() → void` | Flips `state.colorTheme` between `"light"` and `"dark"`, calls `applyTheme`, then calls `saveTheme`. |

### UI / Event Handlers

| Handler | Trigger | Action |
|---|---|---|
| `handleFormSubmit` | `form` `submit` event | Validates input, calls `addTransaction` or shows errors. |
| `handleDeleteClick` | delegated `click` on transaction list | Extracts `data-id`, calls `deleteTransaction`. |
| `handleSortChange` | `change` event on sort control | Updates `state.sortOrder` to the selected value, calls `renderTransactionList`. Does not call `saveToStorage` (sort order is not persisted). |
| `handleSpendingLimitSubmit` | `submit` or `click` on spending limit form | Calls `validateSpendingLimit`; on valid input sets `state.spendingLimit`, calls `saveSpendingLimit`, then `renderAll`. On invalid input shows inline error. |
| `handleClearLimit` | `click` on clear-limit button | Calls `removeSpendingLimit`, then `renderAll`. |
| `handleThemeToggle` | `click` on theme toggle button | Calls `toggleTheme`. |

### API Availability Check

```js
// Called once at DOMContentLoaded
function checkApiAvailability() {
  const required = {
    localStorage: typeof localStorage !== 'undefined',
    crypto: typeof crypto !== 'undefined',
    // Fetch is listed in requirements but not used in this offline SPA;
    // still checked and warned about if missing
    fetch: typeof fetch !== 'undefined'
  };
  const missing = Object.entries(required)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  return { ok: missing.length === 0, missing };
}
```

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string}  id        - Unique identifier (UUID or fallback string)
 * @property {string}  name      - Item name (1–100 chars, trimmed)
 * @property {number}  amount    - Monetary value (0.01 – 999,999,999.99)
 * @property {string}  category  - One of: "Food" | "Transport" | "Fun"
 * @property {number}  timestamp - Unix ms timestamp (Date.now() at creation)
 */
```

### ValidationResult

```js
/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {{ name?: string, amount?: string, category?: string }} errors
 */
```

### Storage Schema

The `"transactions"` key in Local Storage holds a JSON string that deserializes to a `Transaction[]`. All five fields (`id`, `name`, `amount`, `category`, `timestamp`) must survive a `JSON.stringify → JSON.parse` round-trip with identical values (numbers remain numbers, strings remain strings).

```
localStorage["transactions"] = JSON.stringify([
  { id: "abc-123", name: "Coffee", amount: 4.50, category: "Food", timestamp: 1700000000000 },
  ...
])
```

### Category Color Map

```js
const CATEGORY_COLORS = {
  Food:      "#FF6384",
  Transport: "#36A2EB",
  Fun:       "#FFCE56"
};
```

### SortOrder

```js
/**
 * @typedef {"default" | "amount-asc" | "amount-desc" | "category-asc"} SortOrder
 *
 * "default"      — reverse-chronological (descending timestamp)
 * "amount-asc"   — ascending amount
 * "amount-desc"  — descending amount
 * "category-asc" — alphabetical category name (A–Z)
 *
 * Not persisted to Storage. Resets to "default" on every page load.
 */
```

### SpendingLimit

```js
/**
 * state.spendingLimit: number | null
 *
 * Persisted to Storage under the key "spendingLimit" as a bare JSON number:
 *   localStorage["spendingLimit"] = JSON.stringify(500)   // → "500"
 *
 * null means no limit is set. The key is absent from Storage when unset.
 * Valid range: [0.01, 999,999,999.99] — same rules as transaction amounts.
 *
 * CSS classes applied when limit is active:
 *   "over-limit"      → added to Balance_Display when total > spendingLimit
 *   "item-over-limit" → added to individual <li> when transaction.amount > spendingLimit
 *
 * Text warning:
 *   #limit-warning (a <p> inside .balance-container) is un-hidden and its
 *   textContent set to an English message (e.g. "Warning: your total
 *   spending ($X) has exceeded your spending limit of ($Y).") whenever
 *   total > spendingLimit; hidden and cleared otherwise. Updated by
 *   renderBalance in the same pass as the "over-limit" class.
 */
```

### ColorTheme

```js
/**
 * state.colorTheme: "light" | "dark"
 *
 * Persisted to Storage under the key "colorTheme" as a JSON string:
 *   localStorage["colorTheme"] = '"dark"'   // → JSON string
 *
 * Default: "light" when Storage contains no value.
 * Applied via CSS class on the root <html> element:
 *   dark  → <html class="dark-mode">
 *   light → <html>  (no class)
 *
 * applyTheme is called before renderAll on initialization to prevent
 * a flash of the wrong theme.
 */
```

### Chart.js Configuration Shape

```js
{
  type: "pie",
  data: {
    labels: ["Food", "Transport", "Fun"],   // only categories with amount > 0
    datasets: [{
      data: [/* totals */],
      backgroundColor: [/* colors from CATEGORY_COLORS */]
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: "bottom" },
      tooltip: { enabled: true }
    }
  }
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction serialization round-trip

*For any* valid Transaction object (with id, name, amount, category, and timestamp fields), serializing it to JSON and immediately deserializing it SHALL produce an object with identical values for all five fields.

**Validates: Requirements 5.5**

---

### Property 2: Empty-input validation always rejects

*For any* string composed entirely of whitespace characters (including the empty string), passing it as the `name` field to `isValidName` SHALL return `false` and prevent transaction creation.

**Validates: Requirements 1.3**

---

### Property 3: Amount boundary validation

*For any* numeric string, `isValidAmount` SHALL return `true` if and only if the parsed value is a finite number in the closed interval [0.01, 999,999,999.99]; all other inputs (non-numeric strings, values outside the range, negative values) SHALL return `false`.

**Validates: Requirements 1.4**

---

### Property 4: Balance equals sum of all transaction amounts

*For any* non-empty list of transactions, the value displayed by `renderBalance` SHALL equal the arithmetic sum of all `amount` fields in `state.transactions`, formatted to exactly two decimal places.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 5: Transaction list ordering invariant

*For any* list of transactions with distinct timestamps, `renderTransactionList` SHALL display them in strictly descending timestamp order (most recent first).

**Validates: Requirements 2.2**

---

### Property 6: Delete removes exactly one entry

*For any* transaction list and any transaction id present in that list, calling `deleteTransaction(id)` SHALL result in `state.transactions` containing exactly one fewer element, and no element with the matching id SHALL remain.

**Validates: Requirements 2.5, 3.3**

---

### Property 7: Chart slices match non-zero categories only

*For any* transaction list, `renderChart` SHALL produce a pie chart whose slice labels are exactly the set of category names whose total spending is greater than zero — no more, no fewer.

**Validates: Requirements 4.2**

---

### Property 8: Sort order correctness

*For any* array of transactions and any valid `SortOrder` value, `sortTransactions(transactions, order)` SHALL return a new array containing exactly the same elements as the input, ordered according to the predicate for that sort order: descending `timestamp` for `"default"`, ascending `amount` for `"amount-asc"`, descending `amount` for `"amount-desc"`, and alphabetical `category` for `"category-asc"`. The input array SHALL remain unmodified.

**Validates: Requirements 8.2, 8.3, 8.4**

---

### Property 9: Sort does not affect Storage order

*For any* transaction list and any `SortOrder`, after `renderTransactionList` applies `sortTransactions` and re-renders the display, the array serialized to Storage SHALL remain in the original insertion order, unchanged by the display sort.

**Validates: Requirements 8.5**

---

### Property 10: Spending limit highlight consistency

*For any* transaction list and any spending limit value `L` (where `L` is a number in [0.01, 999999999.99]), after `renderAll`:
- the `over-limit` CSS class SHALL be present on `Balance_Display` if and only if the sum of all transaction amounts is strictly greater than `L`;
- the `item-over-limit` CSS class SHALL be present on a transaction list entry if and only if that transaction's `amount` is strictly greater than `L`.

**Validates: Requirements 9.4, 9.5**

---

### Property 11: Spending limit Storage round-trip

*For any* valid spending limit value `v` in [0.01, 999999999.99], calling `saveSpendingLimit(v)` and then `loadSpendingLimit()` SHALL return a number equal to `v` (i.e., `JSON.parse(JSON.stringify(v)) === v`).

**Validates: Requirements 9.3**

---

### Property 12: Theme persistence round-trip

*For any* theme value in `["light", "dark"]`, calling `saveTheme(theme)` and then `loadTheme()` SHALL return the same theme string.

**Validates: Requirements 10.3**

## Error Handling

| Scenario | Behavior |
|---|---|
| Storage unavailable on submit | Block add, show inline error, do not mutate `state.transactions` |
| Storage unavailable on init | Initialize with `[]`, show non-blocking warning for ≥ 3 s, app remains interactive |
| Invalid JSON in storage | Treat same as unavailable storage — start with empty list, show warning |
| Required Web API missing | Show compatibility warning in main viewport, halt all code paths that depend on the missing API |
| Form submitted with invalid fields | Prevent default, display per-field inline error messages, do not create transaction |
| Chart.js CDN unavailable | The chart container shows the no-data placeholder text; no uncaught JS error |
| `deleteTransaction` called with unknown id | No-op; `state.transactions` is unchanged |
| Invalid spending limit input | Show inline error indicating valid range [0.01, 999,999,999.99]; do not update `state.spendingLimit` or Storage |
| Storage unavailable when saving spending limit | Show inline error; `state.spendingLimit` is not updated (remain consistent with Storage) |
| `"spendingLimit"` key contains invalid JSON on init | Treat as absent; `state.spendingLimit = null`; no error shown (non-critical) |
| `"colorTheme"` key contains unexpected value on init | Treat as absent; fall back to `"light"` default |
| Storage unavailable when saving theme | Apply theme to current session via `state.colorTheme` and CSS class; preference will not persist — no error message shown (non-critical) |

---

## Testing Strategy

This is a UI-centric vanilla JS application. The testing approach combines:

### Unit Tests (example-based)

Use a lightweight test runner (e.g., [QUnit](https://qunitjs.com/) or plain `console.assert` scripts) to verify:

- `isValidName`: empty string, whitespace-only, max-length boundary, valid input.
- `isValidAmount`: below range, above range, non-numeric, boundary values (0.01, 999999999.99), valid mid-range.
- `isValidCategory`: all three valid values, invalid string, empty string.
- `formatCurrency`: zero, integer, two-decimal, thousands separator.
- `loadFromStorage`: valid JSON, invalid JSON, missing key, corrupted data.
- `saveToStorage`: success path, quota-exceeded simulation via mock.
- `deleteTransaction`: removes correct entry, leaves others intact, no-op for unknown id.
- `sortTransactions`: each of the four sort orders with a small fixture array; verify stable output; verify input array is not mutated.
- `validateSpendingLimit`: boundary values (0.01, 999999999.99), out-of-range, non-numeric, empty string.
- `loadSpendingLimit` / `saveSpendingLimit`: valid number round-trip, missing key returns `null`, invalid JSON returns `null`.
- `removeSpendingLimit`: key is absent from Storage and `state.spendingLimit` is `null` after call.
- `applyTheme`: `"dark"` adds `dark-mode` class to `<html>`; `"light"` removes it; no inline styles are set.
- `loadTheme`: returns `"dark"` or `"light"` for valid stored values; returns `"light"` for missing/invalid key.
- Balance highlight: `over-limit` class present when total > limit, absent when total ≤ limit or limit is null.
- Item highlight: `item-over-limit` class present on the correct `<li>` elements and absent on others.
- Theme toggle: calling `toggleTheme` twice returns to the original theme and original Storage value.

### Property-Based Tests

Use [fast-check](https://github.com/dubzzz/fast-check) (loadable from CDN, no bundler required via ESM build):

- **Property 1 (Serialization round-trip)**: Generate arbitrary valid Transaction objects, assert `JSON.parse(JSON.stringify(t))` deep-equals `t` for all five fields. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 1: Transaction serialization round-trip`
- **Property 2 (Empty-input rejection)**: Generate arbitrary whitespace-only strings, assert `isValidName` returns `false` for all. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 2: Empty-input validation always rejects`
- **Property 3 (Amount boundary)**: Generate arbitrary numbers inside and outside [0.01, 999999999.99], assert `isValidAmount` matches expected boolean. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 3: Amount boundary validation`
- **Property 4 (Balance equals sum)**: Generate arbitrary transaction arrays, assert `computeBalance(transactions)` equals the arithmetic sum. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 4: Balance equals sum of all transaction amounts`
- **Property 5 (Ordering invariant)**: Generate shuffled transaction arrays with distinct timestamps, assert `sortByTimestampDesc(transactions)` is strictly descending. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 5: Transaction list ordering invariant`
- **Property 6 (Delete removes exactly one)**: Generate transaction arrays and a random valid id from them, call `deleteTransaction`, assert count is `n - 1` and id is absent. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 6: Delete removes exactly one entry`
- **Property 7 (Chart slices match non-zero categories)**: Generate transaction arrays, assert `computeCategoryTotals` returns keys that match only categories with total > 0. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 7: Chart slices match non-zero categories only`
- **Property 8 (Sort order correctness)**: Generate arbitrary transaction arrays and a random `SortOrder`. Assert `sortTransactions(transactions, order)` contains the same elements, satisfies the ordering predicate, and does not mutate the input array. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 8: Sort order correctness`
- **Property 9 (Sort does not affect Storage order)**: Generate arbitrary transaction arrays and a random `SortOrder`. Call `sortTransactions`, then verify `state.transactions` (the array written to Storage) remains in its original insertion order. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 9: Sort does not affect Storage order`
- **Property 10 (Spending limit highlight consistency)**: Generate arbitrary transaction arrays and a random valid spending limit `L`. After `renderAll`, assert `over-limit` class on `Balance_Display` matches `(sum > L)` and `item-over-limit` class on each list item matches `(transaction.amount > L)`. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 10: Spending limit highlight consistency`
- **Property 11 (Spending limit Storage round-trip)**: Generate arbitrary valid limit values in [0.01, 999999999.99]. Call `saveSpendingLimit(v)` then `loadSpendingLimit()`. Assert the returned value equals `v`. Run ≥ 100 iterations.
  - *Tag*: `Feature: expense-budget-visualizer, Property 11: Spending limit Storage round-trip`
- **Property 12 (Theme persistence round-trip)**: For each value in `["light", "dark"]`, call `saveTheme(theme)` then `loadTheme()`. Assert the returned value equals the input. (Two values only — exhaustive, not randomized.)
  - *Tag*: `Feature: expense-budget-visualizer, Property 12: Theme persistence round-trip`

### Integration / Manual Tests

- Verify pie chart renders correctly in Chrome, Firefox, Edge, and Safari (Requirement 7.1).
- Verify responsive layout at 320 px, 480 px, and desktop widths (Requirement 6.1–6.3).
- Verify Local Storage persistence across page reload.
- Verify tap target sizes on a real mobile device or DevTools emulation (Requirement 6.4).