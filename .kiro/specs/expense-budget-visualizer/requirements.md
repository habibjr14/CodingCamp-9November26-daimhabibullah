# Requirements Document

## Introduction

The Expense & Budget Visualizer is a mobile-friendly client-side web application that helps users track their daily spending. It allows users to add, view, and delete transactions, view a running total balance, and visualize spending distribution across categories via a pie chart. The app is built with vanilla HTML, CSS, and JavaScript, persists data in the browser's Local Storage, and requires no backend server or build tools.

## Glossary

- **App**: The Expense & Budget Visualizer single-page web application.
- **Transaction**: A single spending record consisting of an item name, a monetary amount, and a category.
- **Category**: A classification label for a transaction. Valid values are: Food, Transport, Fun.
- **Transaction_List**: The scrollable on-screen list that displays all saved transactions.
- **Balance_Display**: The UI element at the top of the App that shows the total sum of all transaction amounts.
- **Chart**: The pie chart that visualizes spending distribution across categories.
- **Input_Form**: The HTML form through which users enter new transaction data.
- **Storage**: The browser's Local Storage API used to persist transaction data client-side.
- **Validator**: The client-side logic that checks Input_Form fields before a transaction is saved.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to enter a transaction with a name, amount, and category, so that I can record my spending.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for the item name accepting up to 100 characters, a numeric field for the amount accepting values from 0.01 to 999,999,999.99, and a dropdown selector with the options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields correctly filled, THE App SHALL add the transaction to the Transaction_List and persist it to Storage.
3. IF the user submits the Input_Form with one or more fields that are empty or contain only whitespace, THEN THE Validator SHALL prevent submission and display an inline error message identifying the missing field(s).
4. IF the user enters a value in the amount field that is non-numeric, less than 0.01, or greater than 999,999,999.99, THEN THE Validator SHALL prevent submission and display an error message indicating that the amount must be a number between 0.01 and 999,999,999.99.
5. WHEN a transaction is successfully submitted, THE Input_Form SHALL reset all fields to their default empty/unselected state.
6. IF Storage is unavailable when the user submits the Input_Form, THEN THE App SHALL prevent the transaction from being added to the Transaction_List and display an error message indicating that the transaction could not be saved.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see a scrollable history of all my transactions, so that I can review my past spending.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored transactions, each showing the item name, the amount formatted with a currency symbol and two decimal places (e.g., $10.00), and the category.
2. WHILE transactions exist in Storage, THE Transaction_List SHALL present them in reverse-chronological order (most recent first), with transactions sharing the same timestamp displayed in reverse insertion order.
3. WHEN the number of transactions exceeds the visible viewport area, THE Transaction_List SHALL become scrollable to allow access to all entries.
4. IF Storage contains no transactions, THEN THE Transaction_List SHALL display a message indicating that no transactions have been recorded.
5. WHEN the user clicks the delete control on a transaction entry, THE App SHALL remove that transaction from Storage and update THE Transaction_List to no longer display that entry.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total amount spent at the top of the page, so that I always know my current spending total.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts as a numeric value prefixed with the local currency symbol, with exactly 2 decimal places and thousands separators (e.g., $1,500.00).
2. WHEN a new transaction is added, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.
3. WHEN a transaction is deleted, THE Balance_Display SHALL update to reflect the revised total without requiring a page reload.
4. WHILE no transactions exist, THE Balance_Display SHALL show a value of zero formatted as the local currency symbol followed by "0.00" (e.g., $0.00).

---

### Requirement 4: Spending Distribution Chart

**User Story:** As a user, I want to see a visual breakdown of my spending by category, so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Chart SHALL render as a pie chart where each slice represents one category, labeled with the category name and its percentage of total spending rounded to the nearest whole number.
2. THE Chart SHALL display a distinct color for each of the three categories (Food, Transport, Fun), and SHALL render only the slices for categories that have at least one transaction, omitting categories with zero spending.
3. WHEN a transaction is added or deleted, THE Chart SHALL update to reflect the current spending distribution within 500 milliseconds without requiring a page reload.
4. WHILE no transactions exist, THE Chart SHALL display a text message indicating no spending data is available in place of the pie chart.
5. WHERE Chart.js is included as an external library, THE App SHALL load it from a CDN and render the pie chart using the Chart.js API.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between sessions, so that I do not lose my spending history when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN a transaction is added, THE App SHALL write the updated transaction list to Storage under the key "transactions" as a JSON-serialized string.
2. WHEN a transaction is deleted, THE App SHALL write the updated transaction list to Storage under the key "transactions" as a JSON-serialized string.
3. WHEN the App initializes, THE App SHALL read all transactions from Storage under the key "transactions" and populate the Transaction_List, Balance_Display, and Chart with the persisted data.
4. IF Storage is unavailable or the value stored under "transactions" is not valid JSON, THEN THE App SHALL initialize with an empty transaction list and display a non-blocking warning message visible to the user for at least 3 seconds without preventing interaction.
5. THE App SHALL serialize and deserialize each transaction such that the round-trip (JSON.stringify then JSON.parse) preserves the transaction's id, name, amount, category, and timestamp fields with identical values.

---

### Requirement 6: Responsive and Mobile-Friendly Layout

**User Story:** As a user on a mobile device, I want the app to display correctly on a small screen, so that I can use it comfortably on my phone.

#### Acceptance Criteria

1. THE App SHALL use a single-column layout on screens with a viewport width of 480 px or less.
2. WHILE the viewport width is greater than 480 px, THE App SHALL display content in a multi-column layout with at least two columns to utilize the additional horizontal space.
3. THE App SHALL render without horizontal scrollbars on viewports with a width of 320 px or greater.
4. THE App SHALL ensure all interactive elements (buttons, links, and form inputs) have a tap target size of at least 44 x 44 px on touch-enabled devices.
5. THE App SHALL be navigable by touch input, such that all interactive elements are reachable and activatable without requiring a mouse or keyboard.

---

### Requirement 7: Browser Compatibility

**User Story:** As a user, I want the app to work in any modern browser, so that I am not restricted to a specific browser.

#### Acceptance Criteria

1. THE App SHALL render all UI components and complete all core user workflows - including viewing, creating, updating, and deleting records - without visual breakage or JavaScript errors in the latest stable release of Chrome, Firefox, Edge, and Safari at the time of deployment.
2. THE App SHALL use only standard Web APIs (DOM, Local Storage, Fetch, ES2015-ES2022) without relying on browser-vendor-specific non-standard features or prefixed APIs.
3. WHEN the App initializes, THE App SHALL check for the availability of each required Web API (DOM, Local Storage, Fetch) before use.
4. IF a required Web API is unavailable in the user's browser, THEN THE App SHALL display a compatibility warning message visible in the main viewport without throwing uncaught JavaScript errors, and SHALL prevent execution of any code path that depends on the missing API.

---

### Requirement 8: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or by category, so that I can quickly find and compare related spending entries.

#### Acceptance Criteria

1. THE Transaction_List SHALL provide a sort control that allows the user to select one of the following sort orders: default (reverse-chronological), amount ascending, amount descending, and category (alphabetical A–Z).
2. WHEN the user selects a sort order, THE App SHALL re-render THE Transaction_List in the chosen order within 300 milliseconds without requiring a page reload.
3. WHEN a new transaction is added or deleted, THE Transaction_List SHALL maintain the currently selected sort order after re-rendering.
4. WHILE the default sort order (reverse-chronological) is selected, THE Transaction_List SHALL present transactions in reverse-chronological order consistent with Requirement 2.2.
5. THE App SHALL apply the selected sort order exclusively to the display of THE Transaction_List and SHALL NOT alter the order in which transactions are stored in Storage.

---

### Requirement 9: Spending Limit Highlight

**User Story:** As a user, I want to set a spending limit and see a visual highlight when my total or individual transactions exceed it, so that I can stay aware of my budget.

#### Acceptance Criteria

1. THE Input_Form SHALL include a numeric field for the user to enter a spending limit accepting values from 0.01 to 999,999,999.99, and a control to clear the spending limit.
2. IF the user enters a spending limit value that is non-numeric, less than 0.01, or greater than 999,999,999.99, THEN THE Validator SHALL prevent saving the limit and display an error message indicating the valid range.
3. WHEN the user sets a valid spending limit, THE App SHALL persist the limit to Storage under the key "spendingLimit" as a JSON-serialized number and retain it across sessions.
4. WHILE a spending limit is set and the total balance exceeds the spending limit, THE Balance_Display SHALL apply a distinct visual highlight (e.g., a warning color) to indicate the threshold has been exceeded.
5. WHILE a spending limit is set and an individual transaction's amount exceeds the spending limit, THE Transaction_List SHALL apply a distinct visual highlight to that transaction entry.
6. WHEN the user clears the spending limit, THE App SHALL remove the "spendingLimit" key from Storage and THE Balance_Display and Transaction_List SHALL revert to their default visual appearance without requiring a page reload.
7. WHEN a transaction is added or deleted, THE App SHALL re-evaluate all spending limit highlights and update the visual state of THE Balance_Display and Transaction_List within 300 milliseconds without requiring a page reload.
8. WHILE a spending limit is set and the total balance exceeds the spending limit, THE App SHALL display a persistent, explicit text warning message near THE Balance_Display stating that total spending has exceeded the spending limit, including both the current total and the limit value.
9. WHEN the total balance no longer exceeds the spending limit, or the spending limit is cleared, THE App SHALL hide the text warning message described in Acceptance Criterion 8 without requiring a page reload.

---

### Requirement 10: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light color themes, so that I can use the app comfortably in different lighting conditions and according to my personal preference.

#### Acceptance Criteria

1. THE App SHALL provide a toggle control, located in the navigation bar described in Requirement 11, that switches the color theme between light mode and dark mode.
2. WHEN the user activates the toggle, THE App SHALL apply the selected theme to all visible UI elements within 200 milliseconds without requiring a page reload.
3. WHEN the user sets a theme preference, THE App SHALL persist the selection to Storage under the key "colorTheme" as either the string "dark" or the string "light" and retain it across sessions.
4. WHEN THE App initializes, THE App SHALL read the "colorTheme" value from Storage and apply the corresponding theme before rendering any UI elements, preventing a flash of the opposite theme.
5. IF Storage contains no "colorTheme" value on initialization, THEN THE App SHALL apply the light theme as the default.
6. THE App SHALL implement both themes exclusively through CSS classes applied to the root element, and SHALL NOT use inline styles for theme-related color or background properties.
7. WHILE dark mode is active, THE App SHALL ensure all text, icons, borders, and interactive element states meet a minimum contrast ratio of 4.5:1 against their respective background colors.
8. THE App SHALL implement light mode and dark mode as two visually distinct palettes (light mode using light background and surface colors, dark mode using dark background and surface colors), such that the two themes are readily distinguishable from one another at a glance.

---

### Requirement 11: Navigation Bar and Hero Section

**User Story:** As a user, I want a clear navigation bar and an introductory hero section when I open the App, so that I immediately understand what the App is for and can see my total spending front and center.

#### Acceptance Criteria

1. THE App SHALL display a navigation bar fixed to the top of the viewport, containing the App's name/brand and the theme toggle control described in Requirement 10.
2. WHEN the user scrolls the page, THE navigation bar SHALL remain visible (sticky positioning) above the main content.
3. THE App SHALL display a hero section directly below the navigation bar, containing an introductory heading, a short descriptive subtext, and the Balance_Display.
4. THE hero section and navigation bar SHALL be rendered using only standard Web APIs and CSS, consistent with Requirement 7.2, and SHALL NOT require any additional external library beyond what is already used by the App.
5. All text displayed by the App, including the navigation bar, hero section, form labels, buttons, messages, and placeholder text, SHALL be in English.