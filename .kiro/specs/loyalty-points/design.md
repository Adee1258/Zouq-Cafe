# Design Document: Loyalty Points System — Zouq Cafe

## Overview

The Loyalty Points system rewards customers for completed orders and lets them redeem accumulated points for discounts at checkout. It plugs into three existing extension points: the `DELIVERED` transition in `order.controller.js` (earn), the order-creation transaction in the same controller (redeem), and the `AppConfig` key-value store (configuration). No new top-level route prefixes are needed beyond `/api/loyalty` (customer) and `/api/admin/loyalty` (admin), both of which follow the patterns already used in the codebase.

The system is designed to be **atomic** (earn/redeem happen inside Prisma transactions), **idempotent** (double-delivery cannot double-earn), and **auditable** (every balance change is backed by an immutable `PointsTransaction` record).

---

## Architecture

The feature sits entirely within the existing Express + Prisma + PostgreSQL stack. No new infrastructure is introduced.

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                    │
│  CheckoutPage  │  ProfilePage  │  Admin/LoyaltyPage     │
└────────┬───────┴───────┬───────┴──────────┬─────────────┘
         │               │                  │
         ▼               ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                  Express API (Node.js)                  │
│                                                         │
│  /api/loyalty/*          /api/admin/loyalty/*           │
│  loyalty.controller.js   loyalty.controller.js          │
│                                                         │
│  order.controller.js  ◄──── points hook on DELIVERED    │
│                                                         │
│  src/utils/pointsUtils.js  (pure calc functions)        │
└────────────────────────┬────────────────────────────────┘
                         │ Prisma ORM
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    PostgreSQL                           │
│  User (+ pointsBalance)  │  PointsTransaction          │
│  AppConfig (earn/redeem config keys)                    │
└─────────────────────────────────────────────────────────┘
```

### Data Flow: Points Earning

```
Admin sets order → DELIVERED
        │
        ▼
updateOrderStatus() in order.controller.js
        │
        ├─ check: EARN transaction already exists for this orderId? → skip (idempotent)
        │
        ├─ fetch AppConfig: loyalty_earn_mode, loyalty_earn_value
        │
        ├─ calcEarnedPoints(orderNetAmount, earnMode, earnValue)  ← pointsUtils.js
        │
        └─ prisma.$transaction([
               create PointsTransaction(EARN),
               update User.pointsBalance += earned
           ])
```

### Data Flow: Points Redemption

```
Customer submits order with pointsToRedeem: N
        │
        ▼
createOrder() in order.controller.js
        │
        ├─ fetch User.pointsBalance
        ├─ validate: N ≤ pointsBalance
        ├─ fetch loyalty_redeem_value from AppConfig
        ├─ pointsDiscount = N × redeem_value
        │
        └─ prisma.$transaction([
               create Order (totalAmount reduced by pointsDiscount),
               create PointsTransaction(REDEEM, N),
               update User.pointsBalance -= N,
               create Payment,
               (optional) PromoUsage
           ])
```

---

## Components and Interfaces

### Backend

#### 1. `src/utils/pointsUtils.js` (new — pure functions, no DB)

```js
/**
 * Calculate points earned for an order.
 * @param {number} netAmount  - order total after all discounts (rupees)
 * @param {string} earnMode   - 'PER_RUPEE' | 'FIXED'
 * @param {number} earnValue  - points per Rs.100 (PER_RUPEE) or flat points (FIXED)
 * @returns {number} non-negative integer
 */
function calcEarnedPoints(netAmount, earnMode, earnValue) { ... }

/**
 * Calculate monetary discount from points redemption.
 * @param {number} pointsToRedeem
 * @param {number} redeemValue  - Rs. per point
 * @returns {number}
 */
function calcRedeemDiscount(pointsToRedeem, redeemValue) { ... }

/**
 * Read loyalty config from AppConfig rows.
 * Returns defaults if keys are missing.
 * @param {PrismaClient} prisma
 * @returns {Promise<{ earnMode, earnValue, redeemValue }>}
 */
async function getLoyaltyConfig(prisma) { ... }
```

#### 2. `src/controllers/loyalty.controller.js` (new)

Handles all loyalty-specific HTTP handlers:

| Handler | Route | Auth |
|---|---|---|
| `getBalance` | `GET /api/loyalty/balance` | `protect` |
| `getHistory` | `GET /api/loyalty/history` | `protect` |
| `getConfig` | `GET /api/admin/loyalty/config` | `protect, adminOnly` |
| `updateConfig` | `PATCH /api/admin/loyalty/config` | `protect, adminOnly` |
| `getCustomersWithPoints` | `GET /api/admin/loyalty/customers` | `protect, adminOnly` |
| `getCustomerHistory` | `GET /api/admin/loyalty/customers/:id/history` | `protect, adminOnly` |
| `adjustPoints` | `POST /api/admin/loyalty/customers/:id/adjust` | `protect, adminOnly` |

#### 3. `src/routes/loyalty.routes.js` (new)

Customer-facing routes (authenticated):

```
GET  /api/loyalty/balance
GET  /api/loyalty/history?page=1&limit=20
```

#### 4. Modifications to existing files

**`src/controllers/order.controller.js`**:
- `updateOrderStatus`: after updating status to `DELIVERED`, trigger points earn inside a separate `$transaction`. On transition to `REJECTED`, check for existing EARN transaction and issue REVOKE if found.
- `createOrder`: accept optional `pointsToRedeem` in request body. Validate and include points deduction inside the existing `$transaction`.

**`src/routes/admin.routes.js`**:
- Add loyalty sub-routes under `/api/admin/loyalty/*` via `require('./loyalty.routes')` or inline imports.

**`src/app.js`**:
- Register `require('./routes/loyalty.routes')` at `/api/loyalty`.

**`prisma/schema.prisma`**:
- Add `pointsBalance Int @default(0)` field to `User` model.
- Add `PointsTransaction` model (see Data Models below).
- Add `TransactionType` enum.

**`src/controllers/auth.controller.js`** (minor):
- The `/api/auth/me` handler's `select` clause must include `pointsBalance`.

---

## Data Models

### Prisma Schema Additions

```prisma
enum TransactionType {
  EARN
  REDEEM
  REVOKE
  MANUAL
}

model PointsTransaction {
  id        Int             @id @default(autoincrement())
  userId    Int             @map("user_id")
  orderId   Int?            @map("order_id")      // null for MANUAL adjustments
  type      TransactionType
  amount    Int                                    // positive for EARN/MANUAL(add), negative for REDEEM/REVOKE/MANUAL(deduct)
  note      String?                               // admin reason for MANUAL
  createdAt DateTime        @default(now())       @map("created_at")
  user      User            @relation(fields: [userId], references: [id])
  order     Order?          @relation(fields: [orderId], references: [id])

  @@index([userId, createdAt])
  @@index([orderId])
  @@map("points_transactions")
}
```

### User model addition

```prisma
model User {
  // ... existing fields ...
  pointsBalance     Int                @default(0)     @map("points_balance")
  pointsTransactions PointsTransaction[]
}
```

### Order model addition

```prisma
model Order {
  // ... existing fields ...
  pointsRedeemed     Int                @default(0)     @map("points_redeemed")
  pointsTransactions PointsTransaction[]
}
```

### AppConfig Keys

| Key | Type | Example Value | Description |
|---|---|---|---|
| `loyalty_earn_mode` | `string` | `"PER_RUPEE"` | `PER_RUPEE` or `FIXED` |
| `loyalty_earn_value` | `string` | `"1"` | Points per Rs.100 (PER_RUPEE) or flat per order (FIXED) |
| `loyalty_redeem_value` | `string` | `"1"` | Rs. value of 1 point |

Default values if keys are absent: `PER_RUPEE`, `1`, `1`.

### Points Calculation Rules

**PER_RUPEE mode:**
```
earned = floor(netAmount / 100) × earnValue
```

**FIXED mode:**
```
earned = earnValue  (regardless of order amount)
```

**Redemption discount:**
```
pointsDiscount = min(pointsToRedeem × redeemValue, netAmountBeforeRedemption)
netAmountAfterRedemption = max(0, netAmount - pointsDiscount)
```

**Net earning after redemption:**
```
earnBase = netAmountAfterRedemption  // never gross amount
```

---

## API Specifications

### Customer Endpoints

#### `GET /api/loyalty/balance`
**Response:**
```json
{
  "success": true,
  "data": {
    "pointsBalance": 150,
    "redeemValue": 1,
    "monetaryValue": 150
  }
}
```

#### `GET /api/loyalty/history?page=1&limit=20`
**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 12,
        "type": "EARN",
        "amount": 5,
        "orderId": 88,
        "createdAt": "2025-07-01T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

### Admin Endpoints

#### `GET /api/admin/loyalty/config`
**Response:**
```json
{
  "success": true,
  "data": {
    "earnMode": "PER_RUPEE",
    "earnValue": 1,
    "redeemValue": 1
  }
}
```

#### `PATCH /api/admin/loyalty/config`
**Request body** (all fields optional, at least one required):
```json
{
  "earnMode": "PER_RUPEE",
  "earnValue": 2,
  "redeemValue": 1
}
```
Validation: `earnValue` and `redeemValue` must be positive integers ≥ 1. `earnMode` must be `PER_RUPEE` or `FIXED`.

#### `GET /api/admin/loyalty/customers?page=1&limit=20`
Returns paginated user list with `pointsBalance` field included on each user object.

#### `GET /api/admin/loyalty/customers/:id/history`
Returns full `PointsTransaction` list for the specified customer, ordered by `createdAt desc`.

#### `POST /api/admin/loyalty/customers/:id/adjust`
**Request body:**
```json
{
  "amount": -50,
  "note": "Correction for duplicate earn"
}
```
- `amount`: non-zero integer (positive = add, negative = deduct)
- `note`: required string
- Validation: resulting balance must not go below 0

### Order Creation — Extended Payload

```json
{
  "items": [...],
  "address": "...",
  "paymentType": "COD",
  "promoCode": "SAVE10",
  "pointsToRedeem": 100
}
```

`pointsToRedeem` is optional and defaults to 0. If omitted or 0, no redemption occurs.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Points earning creates a transaction and updates balance

*For any* delivered order with any earn-rate configuration, the system SHALL create exactly one EARN PointsTransaction for that order AND increment the customer's pointsBalance by the earned amount.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Rejected orders never earn points

*For any* order that is marked REJECTED (whether directly or after previous approval), the system SHALL NOT have an EARN PointsTransaction for that order (or, if one previously existed, a corresponding REVOKE transaction SHALL have been created and the net balance change SHALL be zero).

**Validates: Requirements 1.4, 1.6**

### Property 3: Points earning is idempotent

*For any* order that has already triggered a points award, triggering the delivery status transition a second time SHALL result in exactly one EARN PointsTransaction for that order — never two.

**Validates: Requirements 1.5**

### Property 4: Earn-then-revoke is a balance round-trip

*For any* customer with any starting balance, earning points on an order and then revoking those points (via REJECTED transition) SHALL restore the balance to exactly the pre-earn value.

**Validates: Requirements 1.6**

### Property 5: Config write-read round-trip

*For any* valid combination of earnMode (`PER_RUPEE` or `FIXED`), earnValue (positive integer ≥ 1), and redeemValue (positive integer ≥ 1), writing these values via `PATCH /api/admin/loyalty/config` and then reading via `GET /api/admin/loyalty/config` SHALL return the same values.

**Validates: Requirements 2.2, 2.4, 6.5, 6.6**

### Property 6: Points calc uses active config

*For any* delivered order and any valid earn config set immediately before delivery, the number of points recorded in the EARN transaction SHALL equal the result of applying the earn formula (PER_RUPEE: `floor(netAmount/100) × earnValue`; FIXED: `earnValue`) to the order's net amount.

**Validates: Requirements 2.3**

### Property 7: Invalid config values are always rejected

*For any* earnValue or redeemValue that is less than 1, non-integer, or non-numeric, a `PATCH /api/admin/loyalty/config` request SHALL be rejected with HTTP 4xx and the stored config SHALL remain unchanged.

**Validates: Requirements 2.5**

### Property 8: Non-admin config access is always forbidden

*For any* request to `/api/admin/loyalty/config` made without ADMIN credentials, the system SHALL return HTTP 403 before executing any business logic.

**Validates: Requirements 2.6**

### Property 9: /auth/me always includes pointsBalance

*For any* authenticated customer, calling `GET /api/auth/me` SHALL return a response with a `pointsBalance` field of type integer (≥ 0).

**Validates: Requirements 3.3**

### Property 10: Balance endpoint returns consistent value

*For any* customer, `GET /api/loyalty/balance` SHALL return a `pointsBalance` equal to the sum of all EARN and MANUAL-positive transactions minus the sum of all REDEEM, REVOKE, and MANUAL-negative transactions in that customer's PointsTransaction history.

**Validates: Requirements 3.4**

### Property 11: Redemption discount calculation is exact

*For any* valid `pointsToRedeem` amount and `redeemValue`, the discount applied to the order SHALL equal exactly `pointsToRedeem × redeemValue` (capped at the order total).

**Validates: Requirements 4.2, 4.6**

### Property 12: Redemption enforces balance ceiling

*For any* customer, attempting to redeem more points than their current `pointsBalance` SHALL be rejected and the order SHALL NOT be created.

**Validates: Requirements 4.3, 4.7**

### Property 13: Redemption atomically decrements balance

*For any* successfully placed order with `pointsToRedeem > 0`, the customer's `pointsBalance` after order creation SHALL equal the pre-order balance minus `pointsToRedeem`, and a REDEEM transaction SHALL exist for that orderId.

**Validates: Requirements 4.4, 4.5**

### Property 14: Earning is based on net amount after redemption

*For any* order where points are redeemed, the EARN transaction amount created on delivery SHALL equal `calcEarnedPoints(orderTotal - pointsDiscount)` — never `calcEarnedPoints(orderTotal)`.

**Validates: Requirements 4.9**

### Property 15: Transaction history is sorted most-recent-first

*For any* customer with two or more PointsTransaction records, the list returned by `GET /api/loyalty/history` SHALL have each record's `createdAt` ≥ the `createdAt` of the next record in the list.

**Validates: Requirements 5.1**

### Property 16: Transaction history records contain all required fields

*For any* PointsTransaction record returned in history responses, the record SHALL contain `type`, `amount`, `orderId` (may be null for MANUAL), and `createdAt` fields.

**Validates: Requirements 5.2**

### Property 17: Manual adjustment updates balance by exact delta

*For any* valid adjustment amount (positive or negative, resulting balance ≥ 0), `POST /api/admin/loyalty/customers/:id/adjust` SHALL create a MANUAL PointsTransaction with that amount AND the customer's `pointsBalance` SHALL change by exactly that amount.

**Validates: Requirements 6.3**

### Property 18: Balance never goes negative via manual deduction

*For any* customer and any deduction amount that would result in a negative balance, `POST /api/admin/loyalty/customers/:id/adjust` SHALL be rejected with HTTP 4xx and the balance SHALL remain unchanged.

**Validates: Requirements 6.4**

---

## Error Handling

### Backend Error Scenarios

| Scenario | HTTP Status | Error Message |
|---|---|---|
| `pointsToRedeem` > `pointsBalance` | 400 | `"Insufficient points balance. You have X points available."` |
| `pointsToRedeem` is negative | 400 | `"Points to redeem must be a non-negative integer."` |
| `earnValue` or `redeemValue` < 1 | 400 | `"Earn/redeem values must be positive integers (≥ 1)."` |
| Invalid `earnMode` value | 400 | `"earnMode must be 'PER_RUPEE' or 'FIXED'."` |
| Manual adjust would make balance negative | 400 | `"Adjustment would result in negative balance. Customer has X points."` |
| Non-admin accesses admin loyalty routes | 403 | `"Access denied. Admins only."` (existing `adminOnly` middleware) |
| Customer ID not found in admin endpoint | 404 | `"Customer not found."` |
| DB error during earn/redeem transaction | 500 | `"Failed to process points. Please try again."` |

### Idempotency Guard

Before awarding points on delivery, the system checks:

```js
const existing = await tx.pointsTransaction.findFirst({
  where: { orderId: order.id, type: 'EARN' }
});
if (existing) return; // already earned — skip silently
```

This prevents double-earning if the status is somehow set to DELIVERED twice.

### Graceful Degradation on Invalid Redemption

Per Requirement 4.8, if `pointsToRedeem` is provided but fails validation (bad type, exceeds balance), the order is placed normally with `pointsToRedeem` treated as 0. This is handled with a try-catch around the redemption validation block — a validation failure sets `pointsToRedeem = 0` and continues.

### Transaction Atomicity

All balance-modifying operations use `prisma.$transaction([...])`. If any step fails (e.g., DB constraint violation, concurrent update), the entire transaction rolls back, leaving balance and transaction records in a consistent state.

---

## Testing Strategy

### Unit Tests

Focus on pure utility functions in `pointsUtils.js`:

- `calcEarnedPoints` with PER_RUPEE mode (various order amounts, including amounts < Rs.100 → 0 points)
- `calcEarnedPoints` with FIXED mode (should always return `earnValue`)
- `calcRedeemDiscount` (discount capped at order total)
- `getLoyaltyConfig` with missing AppConfig keys (defaults)

### Integration Tests (example-based)

- Full earn flow: create order → mark DELIVERED → verify PointsTransaction and balance
- Redeem flow: set balance → place order with `pointsToRedeem` → verify deduction and REDEEM record
- Revoke flow: earn → mark REJECTED → verify REVOKE record and balance restored
- Admin config update and read-back
- Admin manual adjust (add and deduct)
- 403 on non-admin config access
- Empty transaction history returns `[]`

### Property-Based Tests

Uses **fast-check** (JavaScript PBT library, well-suited to the existing Node.js stack).

Each property test runs a minimum of **100 iterations**.

Tag format per test: `// Feature: loyalty-points, Property N: <property text>`

**Targeted properties (subset most valuable for PBT):**

| Property | What varies | PBT value |
|---|---|---|
| P1: Earn creates transaction + updates balance | order total, earn mode, earn value | Catches off-by-one in floor division, edge at Rs.99 |
| P4: Earn-then-revoke round-trip | starting balance, earn amounts | Catches balance drift bugs |
| P5: Config write-read round-trip | any valid earn/redeem config values | Catches serialization or key-name bugs |
| P6: Points calc matches formula | order amounts (0 to 100,000), earn configs | Catches rounding errors |
| P7: Invalid config always rejected | values < 1, floats, strings | Catches validation gaps |
| P10: Balance = sum of transactions | arbitrary sequences of earn/redeem/manual | Catches denormalization bugs |
| P11: Redemption discount exact | random points + rate combinations | Catches multiplication edge cases |
| P12: Redemption ceiling enforced | redeem > balance scenarios | Catches off-by-one on limit check |
| P13: Redemption atomically decrements | concurrent-safe balance delta | Catches transaction isolation issues |
| P14: Earn on net amount | orders with redemption + varied configs | Catches gross-vs-net earning bug |
| P15: History sorted desc | N random transactions with varying timestamps | Catches sort order bugs |
| P17: Manual adjust exact delta | positive and negative adjustments | Catches signed-integer handling bugs |
| P18: Balance never negative | deductions exceeding balance | Catches boundary condition |

### Frontend Testing

- Unit test `calcRedeemDiscount` helper if extracted to frontend utility
- Example tests on `CheckoutPage` to verify:
  - Points section renders when `pointsBalance > 0`
  - Discount line appears in order summary when points are applied
  - Error shown when user enters more points than balance
- Example test on `ProfilePage` to verify `pointsBalance` is displayed

### Test Configuration

```js
// fast-check property test example shape
import * as fc from 'fast-check';
import { calcEarnedPoints } from '../src/utils/pointsUtils';

// Feature: loyalty-points, Property 6: Points calc uses active config
test('PER_RUPEE earn matches floor formula', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 100000 }),  // netAmount
      fc.integer({ min: 1, max: 100 }),     // earnValue
      (netAmount, earnValue) => {
        const result = calcEarnedPoints(netAmount, 'PER_RUPEE', earnValue);
        return result === Math.floor(netAmount / 100) * earnValue;
      }
    ),
    { numRuns: 100 }
  );
});
```
