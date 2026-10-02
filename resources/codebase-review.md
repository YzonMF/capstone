# EDNP — Codebase & Architecture Review

Reviewed: 2026-10-01 (second pass, same day — previous pass kept below as a changelog note)
Scope: full repository (`clergy/`, `registrar/`, `ednp/`, templates, static assets, settings)

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend framework | Django 4.2.30 | Function-based views throughout; no DRF/API layer |
| Database | MySQL (`mysqlclient` 2.2.8) | Credentials now via `.env` (`DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`), fixed since last pass |
| Secrets | `python-dotenv` 1.2.3 | `.env` → `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, and now the DB credentials too |
| PDF generation | **WeasyPrint 70.0** | Switched again since last pass — `reports.py` and `clergy/views.py:download_own_record` both render an existing HTML template to PDF via `HTML(string=html).write_pdf()`, lazily imported. No more reportlab/xhtml2pdf anywhere. |
| Frontend | Vanilla JS, no framework | Unchanged |
| CSS | Hand-written, no framework | Unchanged |
| Icons | Font Awesome 6.5.1 via cdnjs | Unchanged, full coverage |
| Auth | `django.contrib.auth` | Unchanged |
| Version control | Still none | Unchanged — the user's own call, deferred until "everything is done" |

---

## 2. What Changed Since the Last Pass (same day)

- PDF pipeline finished its migration to WeasyPrint for both Generate Report and the clergy's own "Print Own Records" (new `download_own_record` view + URL).
- Quick-print buttons added to every document card in both portals (`quickPrintFile()` opens the file in a new tab and calls `.print()`).
- `view_generated_report` / `download_generated_report` / `download_backup_archive` all now consistently use `FileResponse` — the inconsistent file-serving pattern flagged in the first pass is resolved.
- `MAILERS` dead setting removed from `ednp/settings.py`.

These are all solid and verified working. The issue below is new, and it's a direct side effect of the HTML/CSS PDF pivot — it didn't exist back when reports were built with reportlab's drawing API, because that approach had no template string to mark "safe" in the first place.

---

## 3. Issues & Recommendations (priority order)

### 1. Stored XSS in Generate Reports — clergy can inject markup that runs in the Registrar's browser

`registrar/templates/registrar/report_pdf.html` line 64:

```django
<tr>{% for cell in row %}<td>{{ cell|safe }}</td>{% endfor %}</tr>
```

Every cell of every report is marked `|safe`, not just the one cell that's intentionally built as HTML (`_build_clerical_directory()`'s `name_cell = f'<b>{r.name}</b>...'`). `_build_status_report`, `_build_per_deanery_report`, and `_build_ordination_documents_report` all pass plain field values — including `r.name` — straight into the same `{{ cell|safe }}` slot, so Django's normal auto-escaping is switched off for all of them too.

`r.name` is clergy-editable: `clergy/forms.py:ClergyRecordSelfServiceForm` includes `name`, and `clergy/views.py:my_profile` saves it straight through. So a clergy user — the lowest-privileged account type in the system — can set their own name to something like `<img src=x onerror="...">` from their own profile page, and the payload sits on `ClergyRecord.name` waiting for the Registrar to generate or preview *any* of the four report types.

Two separate consequences once that happens:
- `registrar:preview_generated_report` renders this template as an ordinary HTML page served to the Registrar's authenticated browser session (not inside a sandboxed PDF viewer) — so the payload executes with the Registrar's session and CSRF token available to it. This is a real low-privilege → staff privilege-escalation path, not just a cosmetic glitch.
- `reports.render_pdf()` feeds the same HTML string into WeasyPrint server-side. WeasyPrint doesn't execute `<script>`, but it does fetch external resources referenced in markup (e.g. an `<img src="http://...">`), so a crafted name can also make the Django server itself issue an outbound request at report-generation time — worth knowing even if it's lower severity than the browser-side XSS.

**Fix:** stop blanket-marking cells safe in the template. Only `_build_clerical_directory()`'s `name_cell` is genuinely built as HTML — wrap just that one with `django.utils.safestring.mark_safe()` at construction time in `reports.py`, and drop `|safe` from the template so `{{ cell }}` auto-escapes everything else by default (a `SafeString` still renders unescaped without needing the filter).

### 2. `json.dumps` piped through `|safe` into inline `<script>` blocks — breakout risk

`registrar/templates/registrar/record-detail.html:149-150` and `clergy-records.html:79`:

```django
<script id="deaneries-data" type="application/json">{{ deaneries_json|safe }}</script>
```

`deaneries_json`/`record_json` are built with plain `json.dumps()` in `views.py`, which does not escape `</script>`. If any `Deanery`/`Parish` name ever contained that substring, it would close the script block early and let whatever follows it be parsed as HTML. Lower severity than #1 since Deanery/Parish names are registrar/admin-entered, not reachable by a clergy account — but it's the same category of bug, and Django has a purpose-built fix: the `{{ value|json_script:"id" }}` template filter escapes exactly this case correctly and is a drop-in replacement for the current `json.dumps()` + `|safe` pattern.

### 3. Backup Records exports every user's password hash in a plain downloadable file

`registrar/backups.py:build_database_dump()` runs `dumpdata auth.user clergy registrar` and `views.py:download_database_backup` serves the result as an unencrypted `.json` download to any registrar. `auth.user`'s dump includes the `password` field (hashed, but still a full offline-crackable export of every login in the system — clergy and registrar alike) sitting in a file that can land in email, a shared drive, or a laptop Downloads folder. Worth excluding the password field from the dump (or excluding `auth.user` from the automatic export and reconstructing just usernames/names if that's what backups actually need) so a backup file leak doesn't double as a credential leak.

### 4. Carried forward, unchanged since the first pass today

- **Zero automated tests** — both `tests.py` files are still the 3-line default stub. This matters more now than it did this morning: the WeasyPrint rendering pipeline, the clergy/registrar document-upload split, and the rank-gated checklist have all been refactored today with nothing but manual URL checks behind them.
- **Validation failures silently discard user input** across every form in both portals (`create_record`, `link_account`, `record_detail`, `my_profile`) — not touched today, still open.
- **N+1 queries** in `clergy_records`, `record_detail`, and `documents_overview` (`document_summary()`/`document_checklist_grouped()` per record, in a loop).
- **No document catalog management UI** — `DocumentType.uploaded_by`, rank-gating, and validity periods are still only editable via direct DB access or a migration.
- **No pagination** anywhere records/reports/archives are listed.
- **Two independently-styled letterhead templates** (`report_pdf.html` for Registrar reports, `print-record.html` for the clergy's own copy) that still need to be kept in sync by hand if the diocese's letterhead format changes — the reportlab-vs-CSS duplication from the first pass is gone, but the underlying "two templates, one visual identity" duplication persists in a new form.
- **No version control** — the user's own explicit call, deferred until the rest of the work is done. Not re-flagged as actionable, just noted for completeness.

---

## What's Genuinely Solid (everything from the first pass still holds, plus)

- File-serving is now fully consistent — every document/report/backup download goes through `FileResponse`.
- DB credentials are out of source and into `.env`, matching how `SECRET_KEY` was already handled.
- The WeasyPrint pipeline reuses one template per feature (`report_pdf.html`, `print-record.html`) for both the live HTML view and the generated PDF, so there's no drift between what a Registrar sees on screen and what gets downloaded.
- `_can_access_document` ownership checks, password validation coverage, and login throttling are all unchanged and still correct.
