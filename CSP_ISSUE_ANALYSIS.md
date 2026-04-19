# Content Security Policy (CSP) Error Analysis

## Problems Identified

### 1. **Inline Event Handlers in Mock PayHere Checkout**
**File:** [backend/routes/mockPayhere.routes.js](backend/routes/mockPayhere.routes.js#L253-L254)

Lines 253-254 have inline event handlers:
```html
<button class="btn-pay" id="payBtn" onclick="doPayment()">
  🔒 Pay Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
</button>
<button class="btn-cancel" onclick="doCancel()">Cancel Payment</button>
```

**Error:** `script-src-attr 'none'` - inline event handlers are blocked

### 2. **Inline <script> Block**
**File:** [backend/routes/mockPayhere.routes.js](backend/routes/mockPayhere.routes.js#L260)

The `<script>` tag starting at line 260 contains inline JavaScript code:
```javascript
<script>
  const ORDER_ID = ...;
  async function doPayment() { ... }
  function doCancel() { ... }
</script>
```

**Error:** `script-src 'self'` - inline scripts are blocked

---

## Current CSP Configuration

**File:** [backend/app.js](backend/app.js#L35-L45)

```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],  // ❌ Blocks inline scripts
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    // ❌ script-src-attr not defined, defaults to 'none' (blocks inline event handlers)
  },
},
```

---

## Solutions

### Option A: Update CSP (Quick Fix - Development Only)
Add to `app.js` contentSecurityPolicy.directives:
```javascript
scriptSrc: ["'self'", "'unsafe-inline'"],
scriptSrcAttr: ["'unsafe-inline'"],
```

⚠️ **Not recommended for production** — unsafe-inline defeats CSP purpose

### Option B: Remove Inline Event Handlers (Recommended)
Remove `onclick` attributes from HTML and use event listeners instead.

---

## Affected Code Locations

1. **Inline event handlers:** [mockPayhere.routes.js L253-254](backend/routes/mockPayhere.routes.js#L253-L254)
2. **Inline script:** [mockPayhere.routes.js L260-310](backend/routes/mockPayhere.routes.js#L260-L310)
3. **CSP config:** [app.js L35-45](backend/app.js#L35-L45)
