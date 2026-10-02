# EDNP Clergy Records System — Code Explanation

This project contains **two standalone, self-contained HTML files**. There is no server, no database, no build step, and no shared backend between them — each file is a complete prototype (HTML + CSS + JavaScript all inline in one `<html>` document) that runs entirely in the browser.

| File | Role | Data persistence |
|---|---|---|
| `EDNP_Clergy_Records_admin_dashboard_FINAL2.html` | **Registrar/Admin dashboard** — manage all clergy records, documents, contracts, and reports | In-memory JS array only (resets on page refresh) |
| `user 2.html` | **Clergy self-service portal** — a single clergy member logs in and views/edits their own info | `localStorage` (survives refresh, persists in the browser) |

They are not wired together — each simulates its own side of the system independently with hardcoded sample data. Login credentials, record IDs, and data formats differ between the two files, confirming they were built/prototyped separately.

---

## 1. `EDNP_Clergy_Records_admin_dashboard_FINAL2.html`

### 1.1 Document head
- Standard `<meta charset>` + responsive viewport tag.
- Title: "EDNP — Clergy Records Management System".
- **All CSS is inline in a single `<style>` block** (no external stylesheet).

### 1.2 CSS breakdown
- `:root` defines a small design-token palette as CSS custom properties: `--navy`, `--blue`, `--light`, `--green`, `--amber`, `--red`, `--muted`, `--border`, `--white`. These are reused throughout for buttons, badges, and status colors instead of repeating hex codes.
- `.app` / `.sidebar` / `main`: a classic fixed-sidebar layout. The sidebar is `position:fixed` at 245px wide; `main` is offset with `margin-left:245px`.
- `.nav button`: sidebar navigation buttons, styled to look like a menu list, with `.active`/`:hover` highlighting.
- `.page` / `.page.active`: **only the section with class `active` is visible** (`display:none` by default). This is how page switching is done — not real routing, just toggling a class (see `showPage()` in JS).
- `.cards` / `.stat`: the dashboard's KPI tiles (grid of stat boxes).
- `.grid2` / `.panel`: two-column layout used for "Recent Records" + "Quick Actions".
- `table`, `th`, `td`, `.badge`: table styling plus colored status pill badges (`.active-b`, `.abroad-b`, `.retired-b`, `.inactive-b`, `.pending-b`) mapped to clergy status values.
- `.btn` and variants (`.secondary`, `.danger`, `.small`): reusable button styles.
- `.toolbar`, `.search`, `.select`: the search box + status filter dropdown above the records table.
- `.action-grid` / `.action`: the clickable "Quick Actions" tiles on the dashboard.
- `.modal-bg` / `.modal`: a full-screen dimmed overlay (`position:fixed;inset:0`) that centers a modal card; toggled via a `.show` class.
- `.form-grid` / `.field`: two-column form layout used inside modals.
- `.kpi`, `.toast`, `.info-grid` / `.info`, `.edit-grid` / `.edit-field`: smaller supporting components — a KPI row, a bottom-right toast notification, read-only info tiles (personal info view), and the two-column edit form used in the "Personal Information" modal.
- `@media` queries at two breakpoints (1000px, 700px) collapse the multi-column grids down to fewer columns / single column and turn the fixed sidebar into a normal stacked block on mobile.

### 1.3 HTML body structure
- `.sidebar`: brand logo (a `<div class="brand-icon">` containing an embedded **base64 PNG image** — this is the huge single-line `<img src="data:image/png;base64,...">`, which is why the raw file has one enormous line), then nav buttons that call `showPage('dashboard'|'records'|'documents'|'contracts'|'reports', this)`.
- `<main>`: contains a topbar (page title + fake "Registrar" user chip) and five `<section>` "pages", only one visible at a time:
  1. **`#dashboard`** — stat cards (`statTotal`, `statActive`, `statExpiry`), a "Recent Clergy Records" table (`#recentRecords`), and a "Quick Actions" panel (create record, go to contracts, go to reports, go to documents, "Backup Records" which just shows a toast).
  2. **`#records`** — full clergy records table (`#recordsTable`) with a search input and status filter `<select>`, plus a "+ New Record" button that opens the create-record modal.
  3. **`#documents`** — table of generated/stored documents (`#documentsTable`), with a "+ Generate Certified Document" button.
  4. **`#contracts`** — table of clergy whose contracts are nearing expiry (`#contractsTable`), with a "Record Decision" button per row.
  5. **`#reports`** — quarterly report stats + a static table of 3 example reports (hardcoded HTML rows, not driven by JS array) and a "Compile Submitted Reports" button.
- **Modals** (all `display:none` until `.show` is toggled on):
  - `#recordModal` — form to create a new clergy record (name, ID, assignment, status, baptism/confirmation/contract dates, notes).
  - `#docModal` — form to generate a certified document for a selected clergy member.
  - `#personalInfoModal` — a larger modal split into "Personal Information" and "Clergy Information" edit sections, plus a static list of 4 "Documents" rows (Biodata, Baptismal Certificate, Confirmation Certificate, Ordination Certificate) with "View" buttons that just show a toast.
- `#toast`: a fixed bottom-right notification box.

### 1.4 JavaScript breakdown

**Data (in-memory only):**
- `records[]` — an array of 6 hardcoded clergy objects (`id`, `name`, `dob`, `baptism`, `confirmation`, `gender`, `phone`, `email`, `address`, `ordination`, `assignment`, `status`, `contract`, and sometimes `retirement`). This is the single source of truth for the whole admin app — every table renders from this array.
  - ⚠️ **Note:** the record `CLG-005` has the `retirement` key written twice (`retirement:"2018-12-31",retirement:"2019-12-31"`); JavaScript silently keeps only the second value, so this is redundant/likely a copy-paste leftover, not a functional bug.
- `docs[]` — an array of 3 hardcoded document metadata objects (`name`, `clergy`, `type`, `date`) backing the Documents page.

**Functions:**
- `showPage(id, btn)` — hides all `.page` sections, shows the one matching `id`, updates the active nav button, sets the page `<h1>` title from a lookup table, and re-renders the target page's table (`renderRecords`, `renderContracts`, or `renderDocuments`) so data is always fresh when you navigate to it.
- `badge(status)` — returns an HTML `<span class="badge ...">` string, picking the CSS class based on the status string (`Active`, `Assigned Abroad`, `Retired`, `Inactive`, else falls back to the "pending" style).
- `renderRecords()` — reads the search box and status filter, filters `records[]` by name/assignment/ID text match and exact status match, and rebuilds both `#recordsTable` (full records page) and `#recentRecords` (dashboard preview, capped to first 5). Each row has "Personal Information" and "View / Edit" buttons. Calls `updateStats()` at the end.
- `renderContracts()` — computes days remaining until each record's `contract` date relative to a **hardcoded "today" of `2026-08-15`** (not the real current date — this is a fixed demo anchor date), and renders the contracts-review table with a days-left column and a "Record Decision" button.
- `renderDocuments()` — renders the `#documentsTable` from `docs[]`, and also populates the `#docClergy` `<select>` in the "Generate Document" modal from `records[]`.
- `updateStats()` — recalculates the three dashboard stat tiles: total record count, count of `Active` status, and count of records with a contract date before `2026-12-31`.
- `createRecord(e)` — form submit handler for the "New Record" modal; pushes a new object onto `records[]` from the form fields, closes the modal, resets the form, re-renders, switches to the Records page, and shows a success toast.
- `processRequest(i)` and the `renderRequests()` call at the bottom of the script — ⚠️ **dead/broken code**: `processRequest` references a `requests` array that is **never declared anywhere** in this file, and `renderRequests()` is called on load but is **never defined**. This throws a `ReferenceError` at page load (visible in the browser console), which silently aborts the rest of that line — meaning `renderContracts()`, `renderDocuments()`, and the initial `updateStats()` call right after it never run on first load. In practice this is masked because `showPage()` re-runs those renders whenever you click into a page, but the dashboard's stat numbers on first load are just whatever is hardcoded in the HTML (`6`, `3`, `2`), not freshly computed. This looks like leftover code from a removed "Requests" feature.
- `contractDecision(id)` — just shows a toast (no real workflow implemented; a UI stub).
- `generateDocument(e)` — form submit handler for "Generate Certified Document"; adds a new entry to `docs[]` with today's real date (`new Date().toISOString()`), closes the modal, re-renders, and toasts.
- `compileReports()` — hardcodes the "Compiled" stat to `8` and shows a toast (not driven by real data).
- `viewRecord(id)` — just shows a toast naming the record (no real detail view wired up; the "Personal Information" button is the one that actually opens a real modal, via `viewPersonalInfoById`).
- `openModal(id)` / `closeModal(id)` — add/remove the `.show` class on a modal by ID. `openModal` also re-renders the Documents dropdown if opening `docModal`.
- `showToast(msg)` — sets the toast text, shows it, and hides it again after 2.6 seconds via `setTimeout`.
- A `document.querySelectorAll('.modal-bg').forEach(...)` listener closes any modal when you click its dark background (outside the modal card).
- Bottom of script: initial render calls — `renderRecords(); renderRequests(); renderContracts(); renderDocuments(); updateStats();` (see the dead-code note above — the last three of these don't actually execute on load because of the `renderRequests` crash).
- **Personal Information edit feature** (added later, functions grouped at the bottom):
  - `personalEditIndex` — tracks which index in `records[]` is currently open in the edit modal.
  - `formatDateForInput(v)` — normalizes a date value to `YYYY-MM-DD` (what an `<input type="date">` needs), or empty string if it's missing/invalid/the placeholder `"—"`.
  - `fillPersonalEditForm(r)` — populates every field in the `#personalInfoModal` form from a record object.
  - `viewPersonalInfoById(id)` — looks up a record by ID and opens the personal info modal for it.
  - `viewPersonalInfo(i)` — sets `personalEditIndex`, fills the form, and shows the modal.
  - `savePersonalEdit(e)` — form submit handler; writes every edited field back onto the record object in `records[]` (mutating it in place), sets `retirement` only if status is `Retired`, then re-renders, updates stats, closes the modal, and toasts success.

---

## 2. `user 2.html` (Clergy Self-Service Portal)

### 2.1 Document head
Same pattern: single `<title>`, one inline `<style>` block, no external CSS/JS/images (no embedded logo image here — the "logo" is just a styled `<div>` with the text "ED").

### 2.2 CSS breakdown
- `:root` design tokens: a broader palette than the admin file — navy/blue for branding, semantic colors for green/amber/red (each with a matching light "bg" variant, e.g. `--green` + `--greenbg`) used consistently for badges and notice boxes.
- `.login` / `.login-card` / `.brand-login`: full-screen gradient background with a centered white card — the sign-in screen.
- `.field`, `input/select/textarea` base styles: shared form field styling for both the login form and the profile form.
- `.btn` + variants (`.secondary`, `.green`, `.danger`, `:disabled`): button styles, same idea as the admin file but with a distinct "green" variant used for the "Save Profile" button.
- `.app`, `.sidebar`, `.brand`, `.nav-title`, `.nav button`: same fixed-sidebar app shell pattern as the admin dashboard, styled with the portal's own nav items.
- `.side-foot`: small "Clergy User / Self-Service Access / EDNP v1.0" footer text pinned to the bottom of the sidebar.
- `main`, `.top`, `.sub`, `.profile`, `.avatar`: top bar showing the page title and a profile chip (avatar initials + name + Logout button).
- `.page` / `.page.active`: identical show/hide pattern to the admin file.
- `.welcome`: the gradient banner greeting the logged-in clergy member by name on the dashboard.
- `.cards`, `.stat`: dashboard KPI tiles (Record Status, Contract End).
- `.grid`, `.panel`, `.panel-head`: two-column dashboard content layout (My Clergy Record + Quick Services).
- `.info-grid` / `.info`: read-only labeled data tiles (used on both the Dashboard and My Record pages).
- `.quick`: vertical list of clickable "quick service" buttons (currently only "Quarterly Report").
- `.badge` + color variants (`.green`, `.amber`, `.blue`, `.red`): status pill styling, reused across dashboard, record, and notification pages.
- `.notice` / `.success`: colored inline banners for warnings/info vs. success messages.
- `table`, `th`, `td`: styling for the quarterly reports table.
- `.form-grid`, `.full`, `.actions`: two-column profile-editing form layout, with `.full` spanning both columns (used for address/education/other-info textareas) and `.actions` right-aligning the Cancel/Save buttons.
- `.modal-bg` / `.modal` / `.modal-head` / `.close`: same overlay-modal pattern as the admin file, used for the Visa modal and the Report Upload modal.
- `.toast` / `.toast.show`: bottom-right toast notification, identical pattern to the admin file.
- `@media` breakpoints at 1000px and 650px: shrink the sidebar width, then fully collapse to a single-column mobile layout (sidebar becomes static/full-width, grids become one column).
- `.save-profile-btn`: extra styling (`min-width`, bold green) specifically for the profile save button, with a darker hover state.
- `input[readonly]`: greys out and disables the cursor on read-only fields (Record ID, Clergy Status, Report's Clergy field).

### 2.3 HTML body structure
- **`#login`** — the sign-in screen: username/password form calling `login(event)`, plus a "Demo" hint box showing the demo credentials (`clergy` / `password`).
- **`#app`** (hidden until login succeeds):
  - **Sidebar** — brand block + nav buttons for Dashboard, My Profile, My Record, Quarterly Reports, Notifications (each calls `showPage(id, this)`).
  - **Top bar** — page title (`#pageTitle`), and a profile chip showing the logged-in user's initials/name and a Logout button.
  - **`#dashboard` page** — welcome banner (personalized by name), two stat cards (status badge, contract end date + `#contractMessage`), a "My Clergy Record" read-only info panel (`dashName`, `dashRecordId`, `dashAssignment`, `dashStatus`, `dashContract`, `dashVerification`), and a "Quick Services" panel with a single "Quarterly Report" button that opens the upload modal.
  - **`#profile` page** — a large editable form (`#profileForm`) split into three sections:
    - *Personal Information*: first/middle/last/suffix name, DOB, place of birth, gender, civil status, baptism date/place, confirmation date/place, address, contact number, email.
    - *Clergy Information*: ordination date/place, current/previous assignment, education, other info.
    - *Account*: username, new password (optional, min 6 chars), and two **read-only** fields (Record ID, Clergy Status) that only the Registrar can change.
    - Buttons: "Cancel Changes" (reloads the form from saved data, discarding edits) and "Save Profile" (submits the form).
  - **`#record` page** — a read-only info-grid summary of the clergy member's own record (name, ID, assignment, status, contract start/end, years of service, last verified — several of these, like "Contract Start", "Years of Service", and "Last Verified", are **hardcoded static text**, not computed from `user` data).
  - **`#reports` page** — an "Upload Report" button opening the report modal, an explanatory success-styled notice, and a table (`#reportsTable`) rendered from the `reports[]` array.
  - **`#notifications` page** — an `#expiryNotice` box (hidden/shown by `checkContractNotice()`), a static "Account verified" success notice, and a static "Privacy restriction" notice explaining the self-service scope.
- **`#visaModal`** — explicitly commented in the HTML as *"KEPT IN CODE BUT NO LONGER AVAILABLE FROM QUICK SERVICES ON THE DASHBOARD"* — i.e., this is a deliberately disabled/hidden feature, left in the code for potential future use but with no button anywhere in the UI that opens it (`openVisa()` is defined in JS but nothing calls it). It conditionally shows either an eligible form (if status is `Assigned Abroad`) or a "blocked" message (any other status).
- **`#reportModal`** — form to upload a quarterly report file: a quarter/period `<select>`, a read-only clergy name field, and a `<input type="file">` restricted via `accept` to `.pdf,.doc,.docx,.xls,.xlsx`.
- **`#toast`** — same bottom-right notification pattern as the admin file.

### 2.4 JavaScript breakdown

**Data & persistence:**
- `user` — loaded once at the top via `JSON.parse(localStorage.getItem("ednpClergyUser") || "null")`. This is the **single logged-in clergy member's profile object**, persisted in the browser's `localStorage` so it survives page refreshes (unlike the admin dashboard's in-memory-only `records[]`).
- `reports[]` — hardcoded starter array of 2 example submitted quarterly reports (period, file name, date, status). Not persisted to `localStorage` — new uploads only last until refresh.

**Functions:**
- `login(e)` — prevents default form submit, reads username/password fields, and compares against either the **previously saved account** (from `localStorage`) or, if none exists yet, a large hardcoded default demo account object (`clergy`/`password`, full profile for "Rev. Fr. Juan Dela Cruz"). On match: sets `user`, saves it to `localStorage`, hides the login screen, shows the app, and calls `updateUserUI()` + `renderAll()`. On mismatch: shows an "Invalid username or password" toast.
  - ⚠️ Note: the password is stored and compared in **plain text** in `localStorage`. This is acceptable for a static prototype/demo but would need real authentication (hashed passwords, server-side session) before handling real personal data.
- `logout()` — hides the app, shows the login screen, and clears the password input (does **not** clear `localStorage`, so the saved account persists and the username stays pre-filled next time).
- `showPage(id, btn)` — identical pattern to the admin dashboard: toggles `.active` on the target `.page` section and nav button, and updates the page `<h1>` from a `titles` lookup object.
- `updateUserUI()` — after login (or on load), pushes the `user` object's data into every relevant part of the UI: computes initials from the name for all `.avatar` elements, sets the welcome banner text, fills in all the Dashboard's `.info` fields and the My Record page's fields via the `setText` helper, sets the read-only Report modal's clergy name field, and calls `loadProfileForm()` to populate the editable profile form.
- `setText(id, value)` — small helper: sets `textContent` on an element by ID if it exists, defaulting to empty string.
- `loadProfileForm()` — populates every input/select/textarea in the `#profile` form from the `user` object via an inline `set(id, value)` helper; always clears the password field (so it never displays the stored password back to the user).
- `saveProfile(e)` — form submit handler: validates the new password (if provided) is ≥6 characters, reads every profile field, rebuilds `user.name` by joining first/middle/last/suffix, writes all fields back onto the `user` object, updates the password only if a new one was typed, persists the whole object back to `localStorage`, refreshes the UI via `updateUserUI()`, and shows a success toast.
- `renderAll()` — calls `renderReports()` and `checkContractNotice()`; run once right after a successful login.
- `renderReports()` — rebuilds the `#reportsTable` rows from the `reports[]` array, each with a "View" button calling `viewReport(index)`.
- `openReport()` — shows the `#reportModal`.
- `submitReport(e)` — form submit handler for report upload: validates a period was selected and a file was chosen, checks the file extension against an allow-list (`pdf, doc, docx, xls, xlsx`), and if valid, unshifts a new entry onto `reports[]` with a **hardcoded date string** (`"August 18, 2026"` — not the real current date), closes the modal, re-renders the table, shows a success toast, and resets the form. Note: the actual file is never read or uploaded anywhere — only its `name` is stored, since this is a front-end-only prototype with no backend to receive the file.
- `viewReport(index)` — just shows a toast naming the file (no real file viewer).
- `openVisa()` — (unused/dead in the current UI, see the HTML note above) shows the visa modal and toggles between the "allowed" and "blocked" sections depending on whether `user.status === "Assigned Abroad"`.
- `submitVisa(e)` — form handler for the visa request; re-checks the status server-side-style (client-side only) before allowing submission, otherwise blocks with a toast. Also currently unreachable from the UI since no button calls `openVisa()`.
- `closeModal(id)` — removes the `.show` class from a modal by ID (shared by both modals).
- `checkContractNotice()` — intended to show/hide an expiry warning on the Notifications page and update the dashboard's contract message, but as currently written it **always hides the notice and always sets the message to "No expiry notice yet"** — i.e., this is a stub that doesn't actually compute anything from the contract date. It looks like a placeholder for logic that was never finished (compare to the admin dashboard's `renderContracts()`, which *does* do real date-math).
- `toast(message)` — same show/hide-after-2.6s pattern as the admin dashboard's `showToast`.
- A `document.querySelectorAll('.modal-bg').forEach(...)` listener closes any modal on outside-click, same as the admin file.
- **Auto-login IIFE** (runs immediately on page load): tries to load a previously saved `user` from `localStorage` (catching and logging a JSON parse error if the stored value is corrupted), always shows the login screen and hides the app (i.e., it does **not** auto-log-in even if a saved user exists — the comment above it calls this a "direct login system"), and if a saved user exists, pre-fills the username field for convenience.

---

## 3. Cross-cutting observations

- **No real backend or database anywhere** — everything is static HTML/CSS/JS. "Persistence" in the admin file is just a JS array that resets on refresh; in the user portal it's `localStorage`, which is per-browser and not shared with the admin dashboard or any server.
- **Both files independently reimplement the same UI patterns** (sidebar app shell, page-toggle navigation via `.active` class, modal overlay + `.show` toggle, bottom-right toast, badge pill styling) with slightly different CSS class names and slightly different token palettes — they were clearly built as separate prototypes rather than sharing a common component library.
- **Hardcoded "current date" anchors** appear in both files instead of using `new Date()`: the admin dashboard's contract countdown uses a fixed `2026-08-15`, and the user portal's report-submission timestamp is hardcoded to the string `"August 18, 2026"`. This means date-dependent behavior (like "days left" on a contract) will not update as real time passes — useful for a stable demo screenshot, but not production behavior.
- **Dead/incomplete code** exists in both files: the admin dashboard's `renderRequests`/`processRequest`/`requests` code is broken (references something that doesn't exist), and the user portal's visa-request feature and `checkContractNotice()` function are present but effectively disconnected or non-functional stubs.
- **Record ID formats differ** between the two files (`CLG-001` style in the admin dashboard vs. `CLG-000001` style in the user portal's demo account), reinforcing that the two are not actually sharing data — they're separate mockups of what each role's screen would look like.
