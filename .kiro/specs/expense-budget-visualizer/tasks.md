# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a single-page vanilla JS expense tracker with transaction management, balance display, Chart.js pie chart, and Local Storage persistence. The implementation follows the flat file layout (`index.html`, `css/styles.css`, `js/app.js`) with no build tools or frameworks.

## Tasks

- [x] 1. Scaffold project structure and static markup
  - Create `index.html` with semantic HTML: header (balance display), main (form + transaction list + chart container), CDN `<script>` tag for Chart.js, and `<link>` tags for `css/styles.css` and `js/app.js`
  - Create `css/styles.css` as an empty file with a base reset and CSS custom properties for category colors (`#FF6384`, `#36A2EB`, `#FFCE56`)
  - Create `js/app.js` with the module-level `state` object (`{ transactions: [] }`) and a `DOMContentLoaded` listener stub
  - _Requirements: 1.1, 4.5, 7.2_

- [x] 2. Implement storage and API-availability modules
  - [x] 2.1 Implement `checkApiAvailability`, `checkStorageAvailable`, `loadFromStorage`, and `saveToStorage` in `js/app.js`
    - `checkApiAvailability` checks `localStorage`, `crypto`, and `fetch`; returns `{ ok, missing }`
    - `checkStorageAvailable` performs a probe write/read/delete; returns boolean
    - `loadFromStorage` reads `"transactions"` key, parses JSON, validates shape; returns `[]` on failure and calls `showStorageWarning`
    - `saveToStorage` serializes to JSON, writes to `"transactions"`, returns `true` on success or `false` if `setItem` throws
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.3, 7.4_

  - [ ]* 2.2 Write property test for Transaction serialization round-trip
    - **Property 1: Transaction serialization round-trip**
    - Generate arbitrary valid Transaction objects; assert `JSON.parse(JSON.stringify(t))` deep-equals `t` for all five fields (`id`, `name`, `amount`, `category`, `timestamp`)
    - Run ≥ 100 iterations using fast-check (ESM CDN build in a test HTML file)
    - **Validates: Requirements 5.5**

- [x] 3. Implement validation module
  - [x] 3.1 Implement `isValidName`, `isValidAmount`, `isValidCategory`, and `validateForm` in `js/app.js`
    - `isValidName`: non-empty after trim, max 100 chars
    - `isValidAmount`: numeric string, parsed value in `[0.01, 999999999.99]`
    - `isValidCategory`: one of `"Food"`, `"Transport"`, `"Fun"`
    - `validateForm`: accepts a `FormData` object, returns `{ valid, errors: { name?, amount?, category? } }`
    - _Requirements: 1.1, 1.3, 1.4_

  - [ ]* 3.2 Write property test for empty-input validation (Property 2)
    - **Property 2: Empty-input validation always rejects**
    - Generate arbitrary whitespace-only strings; assert `isValidName` returns `false` for all
    - Run ≥ 100 iterations
    - **Validates: Requirements 1.3**

  - [ ]* 3.3 Write property test for amount boundary validation (Property 3)
    - **Property 3: Amount boundary validation**
    - Generate arbitrary numbers inside and outside `[0.01, 999999999.99]`; assert `isValidAmount` matches expected boolean
    - Run ≥ 100 iterations
    - **Validates: Requirements 1.4**

- [x] 4. Implement transaction and ID modules
  - [x] 4.1 Implement `generateId`, `addTransaction`, and `deleteTransaction` in `js/app.js`
    - `generateId`: uses `crypto.randomUUID()` with fallback to `Date.now() + Math.random()`
    - `addTransaction(name, amount, category)`: creates Transaction with generated `id` and `Date.now()` timestamp, pushes to `state.transactions`, calls `saveToStorage`, then `renderAll`
    - `deleteTransaction(id)`: filters out matching entry from `state.transactions`, calls `saveToStorage`, then `renderAll`; no-op if `id` not found
    - _Requirements: 1.2, 2.5, 5.1, 5.2_

  - [ ]* 4.2 Write property test for delete removes exactly one entry (Property 6)
    - **Property 6: Delete removes exactly one entry**
    - Generate transaction arrays and a random valid id from them; call `deleteTransaction`; assert count is `n - 1` and id is absent
    - Run ≥ 100 iterations
    - **Validates: Requirements 2.5, 3.3**

- [x] 5. Implement rendering — transaction list and balance
  - [x] 5.1 Implement `formatCurrency`, `renderTransactionList`, and `renderBalance` in `js/app.js`
    - `formatCurrency(n)`: returns locale-formatted string like `"$1,500.00"` via `toLocaleString`
    - `renderTransactionList`: rebuilds the `<ul>` from `state.transactions` sorted in descending timestamp order; each `<li>` shows name, formatted amount, category, and a delete button with `data-id`; shows empty-state message when list is empty
    - `renderBalance`: sums all `amount` fields from `state.transactions` and sets the balance element's text via `formatCurrency`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.2 Write property test for balance equals sum (Property 4)
    - **Property 4: Balance equals sum of all transaction amounts**
    - Extract `computeBalance` logic (pure function) and generate arbitrary transaction arrays; assert result equals arithmetic sum formatted to 2 decimal places
    - Run ≥ 100 iterations
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 5.3 Write property test for transaction list ordering invariant (Property 5)
    - **Property 5: Transaction list ordering invariant**
    - Extract `sortByTimestampDesc` logic (pure function) and generate shuffled arrays with distinct timestamps; assert result is strictly descending
    - Run ≥ 100 iterations
    - **Validates: Requirements 2.2**

- [x] 6. Checkpoint — Ensure core logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement rendering — Chart.js pie chart
  - [x] 7.1 Implement `renderChart` in `js/app.js`
    - Declare module-level `chartInstance` variable
    - `renderChart`: destroy existing `chartInstance` if present, compute per-category totals from `state.transactions`, if all totals are zero show no-data placeholder text and return, otherwise create a new `Chart` with `type: "pie"`, only include slices for categories with total > 0, use `CATEGORY_COLORS` map, set `responsive: true`, legend at `"bottom"`, tooltips enabled
    - Define `CATEGORY_COLORS = { Food: "#FF6384", Transport: "#36A2EB", Fun: "#FFCE56" }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 7.2 Write property test for chart slices match non-zero categories (Property 7)
    - **Property 7: Chart slices match non-zero categories only**
    - Extract `computeCategoryTotals` as a pure function; generate arbitrary transaction arrays; assert the returned keys exactly match the set of category names whose total is > 0
    - Run ≥ 100 iterations
    - **Validates: Requirements 4.2**

- [x] 8. Implement event handlers and wire everything together
  - [x] 8.1 Implement `handleFormSubmit` and `handleDeleteClick` and wire all event listeners in `js/app.js`
    - `handleFormSubmit`: calls `event.preventDefault()`, reads `FormData`, calls `validateForm`, if invalid calls `showFieldErrors`, if valid calls `addTransaction` then resets the form
    - `handleDeleteClick`: delegated listener on the transaction list; extracts `data-id` from click target, calls `deleteTransaction`
    - Wire `DOMContentLoaded` handler: call `checkApiAvailability`, if APIs missing call `showCompatibilityWarning` and halt, otherwise call `loadFromStorage` to populate `state.transactions` then call `renderAll`
    - Attach `handleFormSubmit` to the form's `submit` event and `handleDeleteClick` to the transaction list's `click` event
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 2.5, 5.3, 7.3, 7.4_

  - [x] 8.2 Implement all user-facing error/warning display functions
    - `showFieldErrors(errors)`: renders per-field inline error messages next to the relevant form inputs
    - `showStorageWarning()`: displays a non-blocking warning message visible for at least 3 seconds without preventing interaction
    - `showStorageError()`: displays an inline error when storage write fails on submit
    - `showCompatibilityWarning(missing)`: renders a compatibility warning in the main viewport and blocks dependent code paths
    - _Requirements: 1.3, 1.4, 1.6, 5.4, 7.4_

- [x] 9. Implement CSS — layout, components, and responsive design
  - [x] 9.1 Write all styles in `css/styles.css`
    - Single-column layout on viewports ≤ 480 px; multi-column (at least 2 columns) layout above 480 px
    - No horizontal scrollbar at 320 px viewport width
    - All interactive elements (buttons, inputs, select) with a minimum tap target of 44 × 44 px
    - Scrollable transaction list when it overflows the visible area
    - Style balance display, form, transaction list items (name, amount, category, delete button), chart container, empty-state messages, and error/warning messages
    - _Requirements: 2.3, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Implement `renderAll` and perform final integration
  - [x] 10.1 Implement `renderAll` in `js/app.js` and confirm all call sites are connected
    - `renderAll` calls `renderTransactionList`, `renderBalance`, and `renderChart` in sequence
    - Verify `addTransaction`, `deleteTransaction`, and `loadFromStorage` all invoke `renderAll` after state changes
    - _Requirements: 1.2, 2.5, 3.2, 3.3, 4.3, 5.3_

  - [ ]* 10.2 Write integration tests covering add → persist → reload → delete flow
    - Simulate adding a transaction, verify Storage key is written, reload state from Storage, verify Transaction_List, Balance_Display, and Chart reflect the data, then delete and verify all three update
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement sort transactions feature
  - [x] 12.1 Add sort control markup to `index.html` and extend `state` in `js/app.js`
    - Add a `<select>` sort control to the transaction list section in `index.html` with four `<option>` values: `"default"` (reverse-chronological), `"amount-asc"` (amount ascending), `"amount-desc"` (amount descending), `"category-asc"` (category A–Z)
    - Extend the module-level `state` object with `sortOrder: "default"`; sort order is session-only and NOT persisted to Storage
    - _Requirements: 8.1_

  - [x] 12.2 Implement `sortTransactions` pure function and `handleSortChange` event handler in `js/app.js`
    - `sortTransactions(transactions, order)`: pure function that returns a new sorted array without mutating input; `"default"` → descending `timestamp`; `"amount-asc"` → ascending `amount`; `"amount-desc"` → descending `amount`; `"category-asc"` → alphabetical `category`
    - Update `renderTransactionList` to call `sortTransactions(state.transactions, state.sortOrder)` before rebuilding the `<ul>`, ensuring the currently selected sort order is applied on every add, delete, and re-render
    - `handleSortChange`: reads selected value from the sort `<select>`, sets `state.sortOrder`, calls `renderTransactionList`; does NOT call `saveToStorage`
    - Attach `handleSortChange` to the sort control's `change` event inside the `DOMContentLoaded` handler
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 12.3 Write property test for sort order correctness (Property 8)
    - **Property 8: Sort order correctness**
    - Generate arbitrary transaction arrays and a random `SortOrder` value; call `sortTransactions(transactions, order)`; assert the returned array contains exactly the same elements as input, satisfies the ordering predicate for that sort order, and that the original input array is not mutated
    - Run ≥ 100 iterations
    - **Validates: Requirements 8.2, 8.3, 8.4**

  - [ ]* 12.4 Write property test for sort does not affect Storage order (Property 9)
    - **Property 9: Sort does not affect Storage order**
    - Generate arbitrary transaction arrays and a random `SortOrder`; call `sortTransactions` and `renderTransactionList`; assert `state.transactions` (the array written to Storage via `saveToStorage`) remains in its original insertion order unchanged
    - Run ≥ 100 iterations
    - **Validates: Requirements 8.5**

- [ ] 13. Implement spending limit highlight feature
  - [x] 13.1 Add spending limit markup to `index.html` and extend `state` in `js/app.js`
    - Add a spending limit section to `index.html`: numeric input for the limit value, a save/set button, and a clear-limit button
    - Extend the module-level `state` object with `spendingLimit: null` (`number | null`)
    - _Requirements: 9.1_

  - [x] 13.2 Implement spending limit storage functions in `js/app.js`
    - `loadSpendingLimit()`: reads `"spendingLimit"` from `localStorage`, parses JSON, validates it is a finite number in `[0.01, 999999999.99]`; returns `null` on failure or absence
    - `saveSpendingLimit(value)`: serializes the limit as a JSON number, writes to `"spendingLimit"` in `localStorage`; returns `true` on success, `false` on error
    - `removeSpendingLimit()`: calls `localStorage.removeItem("spendingLimit")` and sets `state.spendingLimit = null`
    - Call `loadSpendingLimit` in the `DOMContentLoaded` handler after `loadFromStorage` to restore the persisted limit into `state.spendingLimit`
    - _Requirements: 9.3, 9.6_

  - [ ]* 13.3 Write property test for spending limit Storage round-trip (Property 11)
    - **Property 11: Spending limit Storage round-trip**
    - Generate arbitrary valid limit values in `[0.01, 999999999.99]`; call `saveSpendingLimit(v)` then `loadSpendingLimit()`; assert the returned value equals `v`
    - Run ≥ 100 iterations
    - **Validates: Requirements 9.3**

  - [x] 13.4 Implement `validateSpendingLimit`, `handleSpendingLimitSubmit`, and `handleClearLimit` in `js/app.js`
    - `validateSpendingLimit(str)`: returns `true` if the input is numeric and the parsed value is in `[0.01, 999999999.99]`; returns `false` for non-numeric, out-of-range, or empty input
    - `handleSpendingLimitSubmit`: reads the limit input value, calls `validateSpendingLimit`; on valid input sets `state.spendingLimit`, calls `saveSpendingLimit`, then `renderAll`; on invalid input shows inline error indicating the valid range `[0.01, 999,999,999.99]`
    - `handleClearLimit`: calls `removeSpendingLimit`, then `renderAll`
    - Attach both handlers inside the `DOMContentLoaded` handler
    - _Requirements: 9.1, 9.2, 9.6_

  - [x] 13.5 Implement spending limit CSS highlight classes and update rendering functions
    - Add `.over-limit` styles to `css/styles.css`: distinct warning color (e.g., red/orange) applied to `Balance_Display` when total exceeds the limit
    - Add `.item-over-limit` styles to `css/styles.css`: distinct visual highlight on `<li>` transaction entries that individually exceed the limit
    - Update `renderBalance`: apply `over-limit` CSS class to `Balance_Display` when `state.spendingLimit !== null && total > state.spendingLimit`; remove it otherwise
    - Update `renderTransactionList`: apply `item-over-limit` CSS class to each `<li>` when `state.spendingLimit !== null && transaction.amount > state.spendingLimit`; remove it otherwise
    - _Requirements: 9.4, 9.5, 9.7_

  - [ ]* 13.6 Write property test for spending limit highlight consistency (Property 10)
    - **Property 10: Spending limit highlight consistency**
    - Generate arbitrary transaction arrays and a random valid spending limit `L`; after `renderAll`, assert the `over-limit` CSS class on `Balance_Display` is present if and only if `sum(amounts) > L`, and the `item-over-limit` CSS class on each `<li>` is present if and only if that transaction's `amount > L`
    - Run ≥ 100 iterations
    - **Validates: Requirements 9.4, 9.5**

- [x] 14. Implement dark/light mode toggle feature
  - [x] 14.1 Add theme toggle markup to `index.html` and extend `state` in `js/app.js`
    - Add a theme toggle button to the header/nav area in `index.html` (e.g., a button with a sun/moon icon or label)
    - Extend the module-level `state` object with `colorTheme: "light"` (`"light" | "dark"`)
    - _Requirements: 10.1_

  - [x] 14.2 Implement theme storage and application functions in `js/app.js`
    - `loadTheme()`: reads `"colorTheme"` from `localStorage`; returns `"dark"` or `"light"` if the stored value is one of those strings; returns `"light"` for missing or invalid values
    - `saveTheme(theme)`: writes the theme string to `localStorage` under key `"colorTheme"`; on storage failure applies the theme to the current session only without showing an error
    - `applyTheme(theme)`: toggles the `dark-mode` CSS class on `<html>`; adds the class for `"dark"`, removes it for `"light"`; updates `state.colorTheme`; uses only CSS classes, no inline styles
    - `toggleTheme()`: flips `state.colorTheme` between `"light"` and `"dark"`, calls `applyTheme`, then calls `saveTheme`
    - In the `DOMContentLoaded` handler, call `loadTheme` and immediately call `applyTheme` with the result **before** calling `renderAll` to prevent a flash of the wrong theme
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 14.3 Implement `handleThemeToggle` and write dark-mode CSS in `css/styles.css`
    - `handleThemeToggle`: calls `toggleTheme`; attach to the theme toggle button's `click` event inside the `DOMContentLoaded` handler
    - Add `html.dark-mode` CSS ruleset to `css/styles.css` using CSS custom properties: override background, text, border, and interactive element colors for dark mode exclusively via CSS classes on `<html>` with no inline styles
    - Ensure all dark-mode text, icons, borders, and interactive element states meet a minimum contrast ratio of 4.5:1 against their respective backgrounds
    - _Requirements: 10.1, 10.2, 10.6, 10.7_

  - [ ]* 14.4 Write property test for theme persistence round-trip (Property 12)
    - **Property 12: Theme persistence round-trip**
    - For each value in `["light", "dark"]`, call `saveTheme(theme)` then `loadTheme()`; assert the returned value equals the input (exhaustive over the two valid values, minimum 2 iterations)
    - **Validates: Requirements 10.3**

- [x] 15. Visual redesign — navigation bar, hero section, and distinct light/dark palettes
  - [x] 15.1 Add sticky navbar and hero section markup to `index.html`
    - Add `<nav class="navbar">` containing the app brand and the existing `#theme-toggle` button (relocated from the old plain header, `id` and `onclick` unchanged)
    - Add `<header class="app-header">` as a hero section directly below the navbar, containing a heading, subtext, and the existing `.balance-container` (with `#balance-display`, `id` unchanged)
    - All new copy (heading, subtext, brand name) written in English
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 15.2 Rework `css/styles.css` with a genuinely distinct light theme and a dark/neon theme
    - Redefine `:root` custom properties as a real light palette (light `--clr-bg`/`--clr-surface`, dark `--clr-text`) rather than a dark palette mislabeled as default
    - Redefine `html.dark-mode` as a visually distinct dark/neon palette (near-black background, violet/cyan accents) satisfying the ≥ 4.5:1 contrast requirement
    - Style `.navbar` (sticky, backdrop blur) and `.app-header`/`.hero-inner` (hero heading, subtext, enlarged `.balance-amount`)
    - _Requirements: 10.6, 10.7, 10.8, 11.1, 11.2, 11.3_

  - [x] 15.3 Fix chart container sizing across responsive breakpoint changes
    - Give `.chart-container` a fixed `aspect-ratio: 1 / 1` and absolutely position `#spending-chart` to fill it (`inset: 0`), so the canvas no longer distorts after the layout crosses the 480 px breakpoint more than once
    - No changes to `renderChart` or its Chart.js options
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 15.4 Add persistent spending-limit text warning
    - Add `<p id="limit-warning" role="alert" aria-live="polite" hidden>` inside `.balance-container` in `index.html`
    - Update `renderBalance` in `js/app.js` to set `#limit-warning`'s text content (English message naming the current total and the limit) and un-hide it when `state.spendingLimit !== null && total > state.spendingLimit`; hide and clear it otherwise
    - Add `.limit-warning` styling to `css/styles.css`, visually consistent with the existing warning-color tokens
    - _Requirements: 9.8, 9.9_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check loaded via ESM CDN — no bundler required
- Pure helper functions (`computeBalance`, `sortByTimestampDesc`, `computeCategoryTotals`) should be extracted from rendering functions to make them independently testable
- Checkpoints ensure incremental validation at logical boundaries
- Tasks 12, 13, and 14 are independent of each other and can be developed in parallel after the core (Tasks 1–11) is complete
- Task 15 (visual redesign) depends on Tasks 13 and 14 being complete, since it restyles the spending-limit and theme-toggle markup it builds on

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "4.1"] },
    { "id": 3, "tasks": ["4.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "7.1"] },
    { "id": 5, "tasks": ["7.2", "8.1"] },
    { "id": 6, "tasks": ["8.2", "9.1"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["10.2", "12.1", "13.1", "14.1"] },
    { "id": 9, "tasks": ["12.2", "13.2", "14.2"] },
    { "id": 10, "tasks": ["12.3", "12.4", "13.3", "13.4", "14.3"] },
    { "id": 11, "tasks": ["13.5", "13.6", "14.4"] },
    { "id": 12, "tasks": ["15.1", "15.2", "15.3", "15.4"] }
  ]
}
```