# Kelaniya Pradeshiya Sabha — Planning Approval System
# Backend Setup Guide

## Stack
Node.js 18+ | Express | Sequelize | MySQL 8 | Socket.io | PDFKit | PayHere | node-cron

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create MySQL database
mysql -u root -p -e "CREATE DATABASE pradeshiya_sabha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Configure environment
cp .env.example .env
# Edit .env — minimum required fields below

# 4. Start server (auto-creates all 44 tables)
npm run dev

# 5. Seed initial data (run once)
npm run seed
```

---

## Minimum .env for Development

```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_NAME=pradeshiya_sabha
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=any_long_random_string_32_chars_minimum
JWT_REFRESH_SECRET=another_long_random_string_different
FRONTEND_URL=http://localhost:3000
BASE_URL=http://localhost:5000
```

---

## All Fixes Applied (Complete List)

| # | Fix | Files Changed |
|---|-----|---------------|
| 1 | Sinhala PDFs — approval cert + COC in Sinhala with KPS branding, QR, seal | utils/pdfGenerator.js |
| 2 | TrackingNode model — added COMPLAINT, TIME_EXTENSION, PHI, FURTHER_REVIEW_RETURN, COR_PHI_INSPECTION node types | models/trackingNode.model.js |
| 3 | TrackingNode model — added sequence_number, label, is_visible_to_applicant, metadata fields | models/trackingNode.model.js |
| 4 | TrackingLine-TrackingNode association — added 'nodes' and 'trackingLine' aliases | models/index.js |
| 5 | PlanType-Application association — added 'PlanType' alias for eager loading | models/index.js |
| 6 | Chairman OTP verification on approval certificate sign endpoint | controllers/approvalCertificate.controller.js |
| 7 | Chairman OTP verification on COR certificate sign endpoint | controllers/corCertificate.controller.js |
| 8 | Post-approval 5-hour complaint → COMPLAINT tracking node + instant SW/TO/Chairman notify | controllers/complaint.controller.js |
| 9 | 6th cron job — 30-min urgent reminder loop for post-approval complaints | utils/reminderScheduler.js |
| 10 | is_post_approval field on Complaint model | models/complaint.model.js |
| 11 | Payment model — added order_id, pso_verified_by/at, rejection_note, BANK_SLIP/PAYHERE/CHEQUE methods | models/payment.model.js |
| 12 | POST /payments/initiate-payhere — full PayHere checkout params for frontend | controllers/payment.controller.js |
| 13 | POST /payments/:id/verify-slip — PSO verifies bank slip + auto-advances application status | controllers/payment.controller.js |
| 14 | Webhook auto-advances application status + notifies applicant on payment success | controllers/payment.controller.js |
| 15 | Socket.io real-time push — JWT auth, user rooms, role rooms | utils/socketServer.js, app.js |
| 16 | Multi-provider SMS (Notify.lk, SMS.lk, Dialog, generic) via SMS_PROVIDER env var | utils/notificationDispatcher.js |
| 17 | Bank slip upload instantly notifies PSO via IN_APP + Socket.io | controllers/document.controller.js |
| 18 | Application state machine — added missing transitions, forceTransition for webhooks | services/application.service.js |
| 19 | generateReferenceNumber — fixed wrong query (was WHERE ref=null), added plan type prefix KPS-BP/PL/BW-YEAR-SEQ | controllers/application.controller.js, utils/referenceGenerator.js |
| 20 | trackingLine.service — uses sequence_number, label, is_visible_to_applicant, updates current_node_id | services/trackingLine.service.js |
| 21 | Upload directories auto-created on startup | app.js |
| 22 | Type-prefixed reference numbers KPS-BP/PL/BW-YEAR-SEQ | utils/referenceGenerator.js |
| 23 | Validation schemas for initiate-payhere and verify-slip | middleware/validate.js |
| 24 | Database seeder — all officer accounts, plan types, fee configs, queues | seeders/seed.js |
| 25 | Assets directories with README for Sinhala fonts and KPS logo | assets/fonts/, assets/images/ |

---

## Sinhala Certificates Setup

```bash
# Download Noto Serif Sinhala from Google Fonts
# https://fonts.google.com/noto/specimen/Noto+Serif+Sinhala

# Place files here:
assets/fonts/NotoSerifSinhala-Regular.ttf
assets/fonts/NotoSerifSinhala-Bold.ttf

# Place KPS logo here:
assets/images/kps_logo.png  (200x200px PNG, transparent background preferred)
```

Without font files, certificates fall back to English automatically.

---

## Payment Gateway Setup

### PayHere
```env
PAYHERE_MERCHANT_ID=your_merchant_id
PAYHERE_SECRET=your_merchant_secret
PAYHERE_URL=https://sandbox.payhere.lk/pay/checkout
# Production: https://www.payhere.lk/pay/checkout
```

Set Notify URL in PayHere merchant portal to:
`https://yourdomain.lk/api/v1/payments/webhook`

### Frontend PayHere flow (React)
```javascript
// 1. Get checkout params from backend
const res = await api.post('/payments/initiate-payhere', {
  reference_number, amount, payment_type,
  first_name, last_name, email, phone
});
const { payment_url, params } = res.data.data;

// 2. Submit hidden form to PayHere
const form = document.createElement('form');
form.method = 'POST';
form.action = payment_url;
Object.entries(params).forEach(([k, v]) => {
  const input = document.createElement('input');
  input.type = 'hidden'; input.name = k; input.value = v;
  form.appendChild(input);
});
document.body.appendChild(form);
form.submit();
// → PayHere webhook fires automatically on payment success
```

### Bank Slip flow
```
POST /api/v1/documents/upload  { category: "BANK_SLIP" }
→ PSO notified instantly (IN_APP + Socket.io push)
POST /api/v1/payments/:id/verify-slip  { verified: true }
→ Payment COMPLETED → applicant notified via IN_APP + SMS → application auto-advances
```

---

## Email (SMTP) Setup
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16_char_app_password  # Google Account → Security → App Passwords
EMAIL_FROM=noreply@pradeshiyasabha.lk
```

---

## SMS Setup

| Provider | SMS_PROVIDER value | Notes |
|----------|-------------------|-------|
| Notify.lk | `notify_lk` | Most common in Sri Lanka |
| SMS.lk | `sms_lk` | |
| Dialog Axiata | `dialog` | Requires x-ibm-client-id |
| Any REST | `generic` | Default |

```env
SMS_PROVIDER=notify_lk
SMS_API_KEY=your_api_key
SMS_USER_ID=your_user_id     # Notify.lk only
SMS_SENDER=PSABHA
```

---

## Real-time Notifications (Socket.io)

### Frontend connection
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('accessToken') }
});

// Listen for notifications
socket.on('notification', (data) => {
  // data: { title, body, reference_number, event_type, received_at }
  showBellNotification(data);
});

// Ping/pong health check
socket.emit('ping');
socket.on('pong', ({ timestamp }) => console.log('Socket alive', timestamp));
```

User automatically joins:
- `user:{user_id}` — personal notifications
- `role:{ROLE}` — role-based broadcasts (e.g. all PSOs, all TOs)

---

## Officer 2FA Login Flow

All officer roles (PSO, SW, TO, PHI, HO, RDA, GJS, UDA, CHAIRMAN, ADMIN) use OTP 2FA:

```
POST /auth/login  { email, password }
→ { requiresOTP: true, email }   (OTP sent to registered email/phone)

POST /auth/verify-otp  { otp: "123456", email }
→ { accessToken, refreshToken, role, user_id }
```

In development mode, OTP is also returned in the login response for testing.

---

## Chairman Signing Flow (e-Signature)

```
# Step 1: Request OTP
POST /auth/generate-otp
→ OTP sent to Chairman's registered email

# Step 2: Sign certificate
PUT /api/v1/approval-certificates/:id/sign
Body: { otp_code: "123456" }
→ RSA signature affixed, certificate locked (is_immutable = true)
→ OTP consumed (one-time use)

# Same flow for COR certificates:
PUT /api/v1/cor-certificates/:id/sign
Body: { otp_code: "123456" }
```

---

## API Reference (Key Endpoints)

### Auth
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /auth/register | Public | Register applicant |
| POST | /auth/login | Public | Login (officers get OTP) |
| POST | /auth/verify-otp | Public | Submit OTP for officers |
| POST | /auth/generate-otp | Any | Generate signing OTP |
| GET | /auth/me | Any | Current user profile |

### Applications
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /applications | Applicant | Create application |
| GET | /applications/my | Applicant | My applications |
| GET | /applications/pso/queue | PSO | PSO review queue |
| GET | /applications/sw/assigned | SW | SW task queue |
| GET | /applications/to/assigned | TO | TO task queue |
| POST | /applications/:ref/generate-ref | PSO | Generate reference number |
| POST | /applications/:ref/forward-to-sw | PSO | Forward to SW |

### Payments
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /payments/initiate-payhere | Applicant/PSO | Get PayHere checkout params |
| POST | /payments/webhook | PayHere | IPN callback (no auth) |
| POST | /payments/:id/verify-slip | PSO | Verify bank slip |
| POST | /payments/manual | PSO | Record counter payment |
| GET | /payments/ref/:ref | Officers | Payment history |

### Tracking
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | /tracking/ref/:ref | Any | Full tracking line |
| GET | /tracking/ref/:ref/applicant | Applicant | Applicant view (filtered) |
| GET | /tracking/ref/:ref/officer | Officers | Officer view (full minutes) |

### Certificates
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /approval-certificates/generate | PSO | Generate approval cert PDF |
| PUT | /approval-certificates/:id/sign | Chairman | Sign with OTP |
| POST | /approval-certificates/:id/issue | PSO | Issue to applicant |
| POST | /cor-certificates/generate | PSO | Generate COC PDF |
| PUT | /cor-certificates/:id/sign | Chairman/PSO | Sign COC with OTP |

### Complaints
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /complaints/public | Public | Submit public complaint |
| GET | /complaints/pending | Officers | All pending complaints |
| PUT | /complaints/:id/resolve | SW/TO/PSO | Resolve with minute |

---

## Cron Jobs (6 total)

| Schedule | Job | Description |
|----------|-----|-------------|
| Daily 00:00 | Expiry flags | Mark EXPIRED applications |
| Daily 08:00 | 6-month reminder | Email applicants approaching expiry |
| Daily 08:01 | 3-month reminder | Email + push |
| Daily 08:02 | 1-month reminder | Email + SMS + push (urgent) |
| Monday 08:00 | Weekly complaint | Remind all officers of open complaints |
| Every 30 min | Post-approval | Urgent reminder for fresh post-approval complaints |

---

## Graceful Skips (won't crash in development)
- SMTP not set → emails logged to console
- SMS_API_KEY not set → SMS logged to console
- PayHere not set → webhook validation skipped
- RSA keys not found → HMAC fallback for signatures
- Sinhala fonts not found → English fallback for PDFs
