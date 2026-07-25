# Implementation Plan: Loyalty Points System — Zouq Cafe

## Overview

Implement the full loyalty points feature on top of the existing Express + Prisma + PostgreSQL stack.
The work is split into five phases: schema & config, pure utility functions, backend API, order controller
integration, and frontend UI. Each phase builds on the previous one, and tests are placed close to the
code they verify so errors are caught early.

No new infrastructure is required; the feature plugs into existing extension points (AppConfig,
`order.controller.js`, `admin.routes.js`, `app.js`, and existing React pages).

---

## Tasks

- [ ] 1. Prisma schema: add loyalty models and migrate
  - [ ] 1.1 Add `TransactionType` enum and `PointsTransaction` model to `prisma/schema.prisma`
    - Add `PointsTxType` enum with values `EARN`, `REDEEM`, `REVOKE`, `MANUAL`
    - Add `PointsTransaction` model with fields: `id`, `userId`, `orderId?`, `type`, `points`, `note?`, `createdAt`
    - Add relations back to `User` and `Order`
    - Add `@@index([userId])`, `@@index([orderId])`, `@@map("points_transactions")`
    - _Requirements: 1.2, 4.5, 5.2, 6.2, 6.3_

  - [ ] 1.2 Extend `User` model with `pointsBalance` and `Order` model with `pointsRedeemed`
    - Add `pointsBalance Int @default(0) @map("points_balance")` to `User`
    - Add `pointsRedeemed Int @default(0) @map("points_redeemed")` to `Order`
    - Add `pointsTransactions PointsTransaction[]` relation to both `User` and `Order`
    - _Requirements: 1.3, 3.3, 4.4, 4.6_

  - [ ] 1.3 Run Prisma migration and regenerate client
    - Run `npx prisma migrate dev --name add_loyalty_points` inside `backend/`
    - Run `npx prisma generate` to update the Prisma client
    - _Requirements: 1.1_

- [ ] 2. Backend utility layer: `src/utils/pointsUtils.js`
  - [ ] 2.1 Implement `calcEarnedPoints(netAmount, earnMode, earnValue)` pure function
    - `PER_RUPEE` mode: return `Math.floor(netAmount / 100) * earnValue`
    - `FIXED` mode: return `earnValue`
    - Always return a non-negative integer; return 0 for any invalid input
    - Export from `src/utils/pointsUtils.js`
    - _Requirements: 2.1, 2.3_

  - [ ]* 2.2 Write property-based tests for `calcEarnedPoints` using fast-check
    - Install `fast-check` and `jest` (or `vitest`) as dev dependencies in `backend/`
    - Create `backend/tests/pointsUtils.test.js`
    - **Property 6: Points calc uses active config** — for any `netAmount ∈ [0, 100000]` and `earnValue ∈ [1, 100]`, `calcEarnedPoints(netAmount, 'PER_RUPEE', earnValue)` must equal `Math.floor(netAmount / 100) * earnValue`
    - **Property 6 (FIXED branch)** — `calcEarnedPoints(any, 'FIXED', earnValue)` must always equal `earnValue`
    - **Validates: Requirements 2.3**

  - [ ] 2.3 Implement `calcRedeemDiscount(pointsToRedeem, redeemValue)` pure function
    - Return `pointsToRedeem * redeemValue`
    - Export alongside `calcEarnedPoints`
    - _Requirements: 4.2, 4.6_

  - [ ]* 2.4 Write property-based tests for `calcRedeemDiscount` using fast-check
    - **Property 11: Redemption discount calculation is exact** — for any `pointsToRedeem ∈ [0, 10000]` and `redeemValue ∈ [1, 10]`, result must equal `pointsToRedeem * redeemValue`
    - **Validates: Requirements 4.2, 4.6**

  - [ ] 2.5 Implement `getLoyaltyConfig(prisma)` async function
    - Query `AppConfig` for keys `loyalty_earn_mode`, `loyalty_earn_value`, `loyalty_redeem_value`
    - Return `{ earnMode, earnValue, redeemValue }` with defaults `'PER_RUPEE'`, `1`, `1` if keys are absent
    - Export alongside the other utilities
    - _Requirements: 2.3, 2.4_

  - [ ]* 2.6 Write unit tests for `getLoyaltyConfig`
    - Test with all three keys present in AppConfig
    - Test with all three keys absent (defaults returned)
    - Test with partial keys (mix of present/absent)
    - _Requirements: 2.3_

- [ ] 3. Checkpoint — utility layer complete
  - Ensure `backend/tests/pointsUtils.test.js` passes all tests before proceeding.
  - Ask the user if any questions arise.

- [ ] 4. Backend: `src/controllers/loyalty.controller.js` and `src/routes/loyalty.routes.js`
  - [ ] 4.1 Implement `getBalance` handler — `GET /api/loyalty/balance`
    - Fetch `user.pointsBalance` from DB for the authenticated customer
    - Fetch `redeemValue` via `getLoyaltyConfig`
    - Return `{ pointsBalance, redeemValue, monetaryValue: pointsBalance * redeemValue }`
    - _Requirements: 3.4_

  - [ ]* 4.2 Write property-based test for balance consistency (Property 10)
    - **Property 10: Balance endpoint returns consistent value** — for a seeded set of EARN, REDEEM, REVOKE, and MANUAL transactions, `GET /api/loyalty/balance` must return a `pointsBalance` equal to the algebraic sum of all transaction `points` values
    - Use fast-check to generate arbitrary sequences of valid transaction types
    - **Validates: Requirements 3.4**

  - [ ] 4.3 Implement `getHistory` handler — `GET /api/loyalty/history?page&limit`
    - Query `PointsTransaction` for the authenticated user, ordered by `createdAt desc`
    - Paginate with `page` (default 1) and `limit` (default 20)
    - Return `{ transactions, total, page, limit }`; return empty array if no records
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 4.4 Write property-based test for history sort order (Property 15)
    - **Property 15: Transaction history is sorted most-recent-first** — for any set of N ≥ 2 transactions with distinct `createdAt` values, each record's `createdAt` must be ≥ the next record's `createdAt` in the returned list
    - **Validates: Requirements 5.1**

  - [ ] 4.5 Implement `getConfig` handler — `GET /api/admin/loyalty/config`
    - Call `getLoyaltyConfig(prisma)` and return the config object
    - Protected by `protect, adminOnly` middleware
    - _Requirements: 6.5_

  - [ ] 4.6 Implement `updateConfig` handler — `PATCH /api/admin/loyalty/config`
    - Accept optional `earnMode`, `earnValue`, `redeemValue` in request body
    - Validate: `earnMode` must be `'PER_RUPEE'` or `'FIXED'`; `earnValue` and `redeemValue` must be positive integers ≥ 1
    - Upsert each provided key in `AppConfig` using `prisma.appConfig.upsert`
    - Return updated config; reject with 400 and descriptive message on validation failure
    - Return 403 if caller is not ADMIN (handled by `adminOnly` middleware)
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 6.6_

  - [ ]* 4.7 Write property-based test for config write-read round-trip (Property 5)
    - **Property 5: Config write-read round-trip** — for any valid `{ earnMode, earnValue, redeemValue }`, writing via `updateConfig` logic and then reading via `getConfig` logic must return identical values
    - **Validates: Requirements 2.2, 2.4, 6.5, 6.6**

  - [ ]* 4.8 Write property-based test for invalid config rejection (Property 7)
    - **Property 7: Invalid config values are always rejected** — for any `earnValue` or `redeemValue` less than 1, non-integer, or non-numeric, `updateConfig` must throw/return a 400 error and leave AppConfig unchanged
    - Use fast-check to generate invalid numeric inputs (0, negatives, floats, NaN, strings)
    - **Validates: Requirements 2.5**

  - [ ] 4.9 Implement `getCustomersWithPoints` handler — `GET /api/admin/loyalty/customers?page&limit`
    - Query `User` with `role: 'CUSTOMER'`, selecting `id`, `name`, `email`, `phone`, `pointsBalance`
    - Paginate and return `{ customers, total, page, limit }`
    - _Requirements: 6.1_

  - [ ] 4.10 Implement `getCustomerHistory` handler — `GET /api/admin/loyalty/customers/:id/history`
    - Validate customer exists and has role CUSTOMER; return 404 if not found
    - Return full `PointsTransaction` list for that customer ordered by `createdAt desc`
    - _Requirements: 6.2_

  - [ ] 4.11 Implement `adjustPoints` handler — `POST /api/admin/loyalty/customers/:id/adjust`
    - Accept `{ amount, note }` in request body; `amount` must be a non-zero integer; `note` must be a non-empty string
    - Validate that `user.pointsBalance + amount >= 0`; return 400 with descriptive message otherwise
    - In a `prisma.$transaction`: create `PointsTransaction(type: MANUAL, points: amount, note)` and update `user.pointsBalance += amount`
    - _Requirements: 6.3, 6.4_

  - [ ]* 4.12 Write property-based test for manual adjust exact delta (Property 17)
    - **Property 17: Manual adjustment updates balance by exact delta** — for any valid `amount` where `balance + amount >= 0`, the resulting `pointsBalance` must equal `priorBalance + amount`
    - **Validates: Requirements 6.3**

  - [ ]* 4.13 Write property-based test for balance never going negative (Property 18)
    - **Property 18: Balance never goes negative via manual deduction** — for any `amount` where `balance + amount < 0`, `adjustPoints` must reject with HTTP 4xx and leave the balance unchanged
    - **Validates: Requirements 6.4**

  - [ ] 4.14 Create `src/routes/loyalty.routes.js`
    - Mount `GET /balance` → `getBalance` (protected)
    - Mount `GET /history` → `getHistory` (protected)
    - Export the router
    - _Requirements: 3.4, 5.1_

  - [ ] 4.15 Register loyalty routes and admin loyalty sub-routes in existing files
    - In `src/app.js`: add `app.use('/api/loyalty', require('./routes/loyalty.routes'))`
    - In `src/routes/admin.routes.js`: import loyalty handlers and mount:
      - `GET /loyalty/config` → `getConfig`
      - `PATCH /loyalty/config` → `updateConfig`
      - `GET /loyalty/customers` → `getCustomersWithPoints`
      - `GET /loyalty/customers/:id/history` → `getCustomerHistory`
      - `POST /loyalty/customers/:id/adjust` → `adjustPoints`
    - _Requirements: 2.6, 6.1–6.6_

- [ ] 5. Checkpoint — API layer complete
  - Run all tests. Verify routes respond correctly via a REST client or automated integration test.
  - Ask the user if any questions arise.

- [ ] 6. Update `auth.controller.js` to expose `pointsBalance` in `/api/auth/me`
  - [ ] 6.1 Add `pointsBalance` to the `select` clause in `getMe`
    - In the `prisma.user.findUnique` call inside `getMe`, add `pointsBalance: true` to `select`
    - _Requirements: 3.3_

  - [ ]* 6.2 Write property-based test for `/auth/me` always including `pointsBalance` (Property 9)
    - **Property 9: /auth/me always includes pointsBalance** — for any authenticated customer, the response must contain `pointsBalance` as a non-negative integer
    - Use fast-check to generate arbitrary customer states (zero, large balance)
    - **Validates: Requirements 3.3**

- [ ] 7. Update `order.controller.js` — points earn hook on DELIVERED + revoke on REJECTED
  - [ ] 7.1 Add earn hook inside `updateOrderStatus` when transitioning to `DELIVERED`
    - After the existing `payment.updateMany` call, add a separate `prisma.$transaction` block:
      1. Check for existing `PointsTransaction { orderId, type: 'EARN' }` — skip if found (idempotency guard)
      2. Fetch `getLoyaltyConfig(prisma)` for current earn settings
      3. Determine `earnBase = Number(order.totalAmount) - (order.pointsRedeemed * redeemValue)` to compute net amount
      4. Call `calcEarnedPoints(earnBase, earnMode, earnValue)`
      5. Create `PointsTransaction(type: EARN, userId: order.userId, orderId, points: earned)`
      6. Increment `user.pointsBalance += earned`
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 4.9_

  - [ ]* 7.2 Write property-based test for earn idempotency (Property 3)
    - **Property 3: Points earning is idempotent** — calling the earn logic twice for the same `orderId` must result in exactly one `EARN` PointsTransaction for that order
    - **Validates: Requirements 1.5**

  - [ ]* 7.3 Write property-based test for earn creating transaction and updating balance (Property 1)
    - **Property 1: Points earning creates a transaction and updates balance** — for any `netAmount ∈ [0, 100000]` and any valid earn config, the resulting `pointsBalance` delta must equal the value returned by `calcEarnedPoints(netAmount, earnMode, earnValue)`
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ] 7.4 Add revoke hook inside `updateOrderStatus` when transitioning to `REJECTED`
    - Check for an existing `PointsTransaction { orderId, type: 'EARN' }` for this order
    - If found, in a `prisma.$transaction`:
      1. Create `PointsTransaction(type: REVOKE, userId, orderId, points: -(earnTx.points))`
      2. Decrement `user.pointsBalance -= earnTx.points`
    - If not found, skip (order was never delivered — no points to revoke)
    - _Requirements: 1.4, 1.6_

  - [ ]* 7.5 Write property-based test for earn-then-revoke round-trip (Property 4)
    - **Property 4: Earn-then-revoke is a balance round-trip** — for any starting balance and any earn amount, earning points on an order and then revoking them must restore `pointsBalance` to exactly the pre-earn value
    - **Validates: Requirements 1.6**

  - [ ]* 7.6 Write property-based test for rejected orders never earning points (Property 2)
    - **Property 2: Rejected orders never earn points** — for any order that transitions directly to REJECTED (without first being DELIVERED), no `EARN` PointsTransaction must exist for that order
    - **Validates: Requirements 1.4**

- [ ] 8. Update `order.controller.js` — points redemption inside `createOrder`
  - [ ] 8.1 Accept `pointsToRedeem` from request body and validate it
    - Extract `pointsToRedeem = Number(req.body.pointsToRedeem) || 0`
    - Validate: must be a non-negative integer; if invalid, set to 0 (graceful degradation per Req 4.8)
    - Fetch `user.pointsBalance` and `getLoyaltyConfig` to get `redeemValue`
    - If `pointsToRedeem > 0` and `pointsToRedeem > user.pointsBalance`, return `error(res, 'Insufficient points balance...', 400)`
    - _Requirements: 4.3, 4.7, 4.8_

  - [ ] 8.2 Apply points discount and store redemption inside the existing `prisma.$transaction`
    - Compute `pointsDiscount = calcRedeemDiscount(pointsToRedeem, redeemValue)`
    - Cap `pointsDiscount` at `totalAmount` (cannot discount more than the order total)
    - Reduce `totalAmount -= pointsDiscount` before creating the order
    - Store `pointsRedeemed: pointsToRedeem` on the Order record
    - Inside the same transaction, if `pointsToRedeem > 0`:
      1. Create `PointsTransaction(type: REDEEM, userId, orderId, points: -pointsToRedeem)`
      2. Update `user.pointsBalance -= pointsToRedeem`
    - _Requirements: 4.4, 4.5, 4.6_

  - [ ]* 8.3 Write property-based test for redemption enforcing balance ceiling (Property 12)
    - **Property 12: Redemption enforces balance ceiling** — for any `pointsToRedeem > pointsBalance`, `createOrder` must return 400 and no order must be created
    - **Validates: Requirements 4.3, 4.7**

  - [ ]* 8.4 Write property-based test for redemption atomically decrementing balance (Property 13)
    - **Property 13: Redemption atomically decrements balance** — for any successful order with `pointsToRedeem > 0`, `pointsBalance` after order creation must equal `priorBalance - pointsToRedeem`, and a REDEEM transaction must exist for that `orderId`
    - **Validates: Requirements 4.4, 4.5**

  - [ ]* 8.5 Write property-based test for redemption discount exact calculation (Property 11 — integration)
    - **Property 11: Redemption discount calculation is exact** — for any valid `pointsToRedeem` and `redeemValue`, `order.totalAmount` must reflect the exact discount `pointsToRedeem × redeemValue` (capped at order total)
    - **Validates: Requirements 4.2, 4.6**

  - [ ]* 8.6 Write property-based test for earning on net amount after redemption (Property 14)
    - **Property 14: Earning is based on net amount after redemption** — when an order with `pointsRedeemed > 0` is marked DELIVERED, the EARN transaction amount must equal `calcEarnedPoints(order.totalAmount, earnMode, earnValue)` — where `totalAmount` is already the net-after-discount value stored in the order
    - **Validates: Requirements 4.9**

- [ ] 9. Checkpoint — backend integration complete
  - Run the full backend test suite. All 18 property tests and unit tests must pass.
  - Ask the user if any questions arise.

- [ ] 10. Frontend: customer-facing points UI
  - [ ] 10.1 Display `pointsBalance` on `ProfilePage` — new "Loyalty Points" section
    - In the existing `RewardsTab` (or add a new sub-section at the top of `RewardsTab`), fetch `GET /api/loyalty/balance` on mount
    - Display a summary card showing: current points balance, monetary value (balance × redeemValue), and a brief description
    - Below the summary, fetch `GET /api/loyalty/history?limit=20` and render a scrollable list of transactions — each showing type badge (EARN/REDEEM/REVOKE/MANUAL), points amount (with +/- sign), linked order ID (if present), and formatted date
    - Show a spinner while loading; show an empty-state message if no transactions exist
    - _Requirements: 3.1, 5.1, 5.2, 5.3_

  - [ ] 10.2 Add points redemption section to `CheckoutPage`
    - After the Promo Code section, add a new "Loyalty Points" card
    - Fetch `GET /api/loyalty/balance` on mount; only render the card if `user` is authenticated and `pointsBalance > 0`
    - Display available balance and its monetary value (e.g. "150 pts = Rs. 150 discount")
    - Provide a number input for the customer to enter how many points to redeem (0 to pointsBalance)
    - Show live discount preview: `pointsToRedeem × redeemValue` rupees off
    - Validate that entered amount does not exceed `pointsBalance`; show inline error if it does
    - Include the `pointsToRedeem` field in the order payload sent to `POST /api/orders`
    - Recompute `finalTotal` to reflect both promo discount and points discount in Order Summary
    - _Requirements: 3.2, 4.1, 4.2, 4.3, 4.7, 4.8_

  - [ ] 10.3 Update `authStore` to persist `pointsBalance` from `/api/auth/me` response
    - In the Zustand auth store, update the `fetchMe` action to store `user.pointsBalance`
    - Ensure `pointsBalance` is included in the user object available to all components
    - _Requirements: 3.3_

- [ ] 11. Frontend: admin loyalty management page
  - [ ] 11.1 Create `frontend/src/pages/admin/LoyaltyPage.jsx`
    - Build a tabbed or sectioned page with three sections:
      1. **Config** — fetch `GET /api/admin/loyalty/config`, display current `earnMode`, `earnValue`, `redeemValue`; provide a form to update them via `PATCH /api/admin/loyalty/config`; show success/error toasts
      2. **Customers** — fetch `GET /api/admin/loyalty/customers?page=1&limit=20` with pagination; display a table/list with customer name, email, phone, and `pointsBalance`; clicking a customer opens their transaction history
      3. **Adjust Points** — when a customer row is selected, show a modal/panel with a form to submit `POST /api/admin/loyalty/customers/:id/adjust`; accept `amount` (integer, positive or negative) and `note` (required); show result toast
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ] 11.2 Register `LoyaltyPage` in `App.jsx` and `AdminLayout.jsx`
    - In `App.jsx`: add `const AdminLoyaltyPage = lazy(() => import('./pages/admin/LoyaltyPage'))` and a `<Route path="loyalty" element={<AdminLoyaltyPage />} />` under the `/admin` route
    - In `AdminLayout.jsx`: add `{ to: '/admin/loyalty', label: 'Loyalty', icon: Trophy }` to the `navItems` array (import `Trophy` from `lucide-react`)
    - _Requirements: 6.1, 6.5, 6.6_

- [ ] 12. Final checkpoint — full feature complete
  - Run the full backend test suite and verify all property-based and unit tests pass.
  - Manually verify the frontend flows: points displayed on profile, redemption widget on checkout, admin loyalty page config + adjust.
  - Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP delivery.
- All 18 correctness properties from the design are covered by property tests in tasks 2.2, 2.4, 4.2, 4.4, 4.7, 4.8, 4.12, 4.13, 6.2, 7.2, 7.3, 7.5, 7.6, 8.3, 8.4, 8.5, 8.6.
- `fast-check` must be installed in `backend/` as a dev dependency (`npm install --save-dev fast-check`) before running property tests.
- A Jest-compatible test runner (jest or vitest) is also required in `backend/` — add `jest` or configure `vitest` as a dev dependency.
- `pointsRedeemed` on Order stores the raw points count, not the monetary value; the monetary discount is already baked into `totalAmount` at order creation.
- Earn points are calculated on `order.totalAmount` (net after all discounts) at delivery time — this field already reflects the post-redemption value.
- The idempotency guard in task 7.1 protects against double-earn if `DELIVERED` is set twice.
- Graceful degradation (Req 4.8): if `pointsToRedeem` is invalid (bad type, exceeds balance), the order is placed with `pointsToRedeem = 0` — only an explicit over-balance error returns a 400 (Req 4.7).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2.1", "2.3", "2.5"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.6"] },
    { "id": 4, "tasks": ["4.1", "4.3", "4.5", "4.6", "4.9", "4.10", "4.11", "4.14"] },
    { "id": 5, "tasks": ["4.2", "4.4", "4.7", "4.8", "4.12", "4.13", "4.15", "6.1"] },
    { "id": 6, "tasks": ["6.2", "7.1", "7.4"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.5", "7.6", "8.1"] },
    { "id": 8, "tasks": ["8.2"] },
    { "id": 9, "tasks": ["8.3", "8.4", "8.5", "8.6"] },
    { "id": 10, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 11, "tasks": ["11.1"] },
    { "id": 12, "tasks": ["11.2"] }
  ]
}
```
