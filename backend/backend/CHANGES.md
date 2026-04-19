# Backend Patch Notes — KPS Flow Compliance Fixes

All fixes made to `backend_fixed` to fully comply with the KPS building permit system flow specification.

---

## Fix 1 — Chairman Batch Signing (`POST /approval-certificates/batch-sign`)

**File:** `controllers/approvalCertificate.controller.js`, `routes/approvalCertificate.routes.js`

**Problem:** Spec requires Chairman to select multiple certificates and sign all with one OTP. Only per-certificate signing existed (`PUT /:id/sign`).

**Fix:** Added `exports.batchSign` endpoint and `POST /batch-sign` route (CHAIRMAN only).
- Validates OTP once against the Chairman's hashed OTP
- Loops through `certificate_ids[]`, affixes RSA/HMAC signature + locks each cert
- Consumes OTP after the loop (one-time use regardless of batch size)
- Returns per-cert success/failure so frontend can show partial results

---

## Fix 2 — Certificate Download Payment Gate (`GET /approval-certificates/ref/:ref/download`)

**File:** `controllers/approvalCertificate.controller.js`, `routes/approvalCertificate.routes.js`

**Problem:** Spec says "allowing to download the application only when payment is done." No download endpoint existed — the view-only endpoint always returned `can_download: false`.

**Fix:** Added `exports.downloadCertificate` and `GET /ref/:ref/download` route.
- Gate 1: certificate must be digitally signed
- Gate 2: certificate must be issued (`is_issued = true`)
- Gate 3: a `Payment` record with `payment_type = APPROVAL_FEE` and `payment_status = PAID` must exist for the reference number
- Returns `pdf_path` and `can_download: true` only when all three gates pass

---

## Fix 3 — Appeal Submit → Auto-Escalate to TO

**File:** `controllers/appeal.controller.js`

**Problem:** `submitAppeal()` only set status to `SUBMITTED`. Spec says "it will escalate to TO dashboard directly when submit" — no `TaskAssignment` was created and no tracking nodes were generated on submission.

**Fix:** `submitAppeal()` now auto-escalates in `setImmediate`:
1. Finds the original TO via `TaskAssignment` (type `TO_INSPECTION`, earliest record)
2. Creates a new `TaskAssignment` (type `TO_INSPECTION`, priority `HIGH`) in that TO's workload
3. Calls `appealWorkflow.createAppealNodes()` to add the appeal tracking nodes
4. Notifies the TO by push notification
5. Falls back to notifying SW if no original TO is found (manual assignment required)

---

## Fix 4 — COR Request → TO TaskAssignment Creation

**File:** `controllers/corApplication.controller.js`

**Problem:** `createCORApplication()` emitted `COR_REQUESTED` notification but never created a `TaskAssignment` in the original TO's workload. Spec: "TO is the one who did previous inspection will only notify and escalate to his workload."

**Fix:** Inside the `setImmediate` block, after resolving the original TO via `corWorkflow.getOriginalTO()`, a `TaskAssignment` with `task_type = COR_INSPECTION` is now created before the notification is dispatched.

---

## Fix 5 — TO Minute Edit History with Tracking Snapshot (`PUT /inspection-minutes/:id/edit-submitted`)

**File:** `controllers/inspectionMinute.controller.js`, `routes/inspectionMinute.routes.js`

**Problem:** Spec requires that editing a submitted inspection minute records the previous version in the tracking line (labeled "edited"), with the diff visible on node extraction. No such endpoint or snapshot logic existed.

**Fix:** Added `exports.editSubmittedMinute` and `PUT /:id/edit-submitted` route (TO roles only).
- Detects which fields actually changed (compares incoming values against stored values)
- Snapshots `{ previous, updated, edited_by, edited_at }` as a `MINUTE_EDITED` tracking node on the application's tracking line before applying the update
- Rejects requests with no detected changes
- Rejects already-locked (`is_immutable`) minutes

---

## Fix 6 — Late COR Fine Default Rate (never returns 0)

**Files:** `services/fineCalculator.service.js`, `seeders/seed.js`, `models/feeConfiguration.model.js`

**Problem:** `calculateLateCORFine()` returned `0` if no `LATE_COR` row existed in `FeeConfiguration`, silently swallowing the fine on a fresh database.

**Fix (two parts):**
1. **Seed:** Added a `LATE_COR` `FeeConfiguration` row (global, `plan_type_id = null`, daily rate Rs. 50) via `FeeConfiguration.findOrCreate()` at the end of `seeders/seed.js`.
2. **Service:** `calculateLateCORFine()` now uses `Op.is: null` to correctly query the global row, and falls back to `DEFAULT_DAILY_RATE = 50` if no config row is found, so the fine calculation never silently returns 0.

---

## Fix 7 — Name Mismatch Post-Edit Auto-Escalation to SW

**File:** `controllers/application.controller.js`

**Problem:** After PSO edited an application's details in the Name Mismatch queue, there was no transition logic — the application stayed in `NAME_MISMATCH` queue with no path to SW. Spec implies it should proceed to SW after the mismatch is resolved.

**Fix:** `psoEditApplication()` now runs a `setImmediate` block after saving:
1. Marks the active `NAME_MISMATCH` queue assignment as `RESOLVED`
2. Transitions application status to `ASSIGNED_TO_SW` via `application.service.transition()`
3. Adds a `PSO_VERIFIED` tracking node labeled "Name mismatch resolved by PSO"
4. Notifies the applicant that the mismatch is resolved
5. Notifies SW that a new application is awaiting TO assignment

---

## Summary of New Endpoints

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| `POST` | `/approval-certificates/batch-sign` | CHAIRMAN | Sign multiple certs with one OTP |
| `GET` | `/approval-certificates/ref/:ref/download` | All auth | Payment-gated cert download |
| `PUT` | `/inspection-minutes/:id/edit-submitted` | TO/PHI/ADMIN | Edit submitted minute with tracking snapshot |
