# Requirements Document

## Introduction

Zouq Cafe ke liye ek Loyalty Points / Rewards System banana hai jo customers ko har order complete hone par points award kare. Admin control kar sakta hai kitne points milenge (per-rupee ya fixed per order). Customer apna points balance dekhe aur checkout par points redeem karke discount le sake. Points kabhi expire nahi honge aur sirf admin hi points rate set kar sakta hai.

Yeh system existing AppConfig model (key-value store), existing Order workflow (DELIVERED status on completion), aur existing PromoCode discount pattern ke saath integrate hoga.

---

## Glossary

- **Loyalty_System**: The complete loyalty points feature including earning, balance tracking, and redemption
- **Points_Engine**: The backend service responsible for calculating and awarding loyalty points
- **Points_Balance**: The total non-negative integer count of unredeemed loyalty points held by a Customer
- **Points_Transaction**: An immutable record of a points earn or redeem event linked to an order
- **Earn_Rate**: The admin-configurable rule that determines how many points a customer earns per order — either per-rupee (e.g., 1 point per Rs. 100) or a fixed amount per order
- **Redeem_Rate**: The admin-configurable monetary value of one redeemed point (e.g., 1 point = Rs. 1 discount)
- **Customer**: A registered user with role CUSTOMER
- **Admin**: A registered user with role ADMIN who can configure and manage the Loyalty_System
- **AppConfig**: Existing database model storing system-wide key-value configuration pairs
- **Order**: An existing model representing a customer's food order with a lifecycle status (PENDING → DELIVERED / REJECTED)
- **Checkout**: The frontend page where a Customer reviews their cart, applies discounts, and places an order
- **Points_Redemption**: The act of a Customer converting Points_Balance into a monetary discount on a current order at Checkout

---

## Requirements

### Requirement 1: Points Earning on Order Completion

**User Story:** As a Customer, I want to automatically earn loyalty points when my order is delivered, so that I am rewarded for my purchases without any extra action.

#### Acceptance Criteria

1. WHEN an Admin marks an Order status as `DELIVERED`, THE Points_Engine SHALL calculate and award loyalty points to the Customer who placed that order, creating a Points_Transaction record even when the calculated points amount is zero.
2. WHEN the Points_Engine awards points, THE Loyalty_System SHALL create a Points_Transaction record of type `EARN` linked to that Order, the Customer's user ID, and the points amount awarded.
3. WHEN the Points_Engine awards points, THE Loyalty_System SHALL increment the Customer's Points_Balance by the calculated points amount.
4. IF an Order is marked `REJECTED` or `CANCELLED`, THEN THE Points_Engine SHALL NOT award any loyalty points for that order.
5. IF an Order has already triggered a points award (a Points_Transaction of type `EARN` already exists for that order), THEN THE Points_Engine SHALL NOT award points a second time for the same order.
6. WHEN an Order that previously triggered a points award is subsequently marked `REJECTED`, THE Loyalty_System SHALL revoke the previously awarded points by deducting them from the Customer's Points_Balance and creating a Points_Transaction of type `REVOKE` linked to that Order.

---

### Requirement 2: Admin-Configurable Points Earn Rate

**User Story:** As an Admin, I want to configure how many points customers earn per order, so that I can control the loyalty reward value and adjust it over time.

#### Acceptance Criteria

1. THE Admin SHALL be able to set the Earn_Rate mode to either `PER_RUPEE` (points earned per Rs. 100 spent, rounded down) or `FIXED` (a fixed number of points per delivered order).
2. WHEN an Admin updates the Earn_Rate configuration, THE Loyalty_System SHALL store the new Earn_Rate in AppConfig with key `loyalty_earn_mode` (value: `PER_RUPEE` or `FIXED`) and `loyalty_earn_value` (value: positive integer).
3. WHEN the Points_Engine calculates points for a new DELIVERED order, THE Points_Engine SHALL use the Earn_Rate values active in AppConfig at the time of delivery.
4. THE Admin SHALL be able to set the Redeem_Rate by updating `loyalty_redeem_value` in AppConfig (value: positive integer representing Rs. value per point, e.g., `1` means 1 point = Rs. 1).
5. IF an Admin attempts to set an Earn_Rate value less than 1 or a non-integer, THEN THE Loyalty_System SHALL reject the entire update without storing any value and SHALL return a descriptive validation error.
6. WHEN a non-Admin user attempts to call any loyalty configuration endpoint, THE Loyalty_System SHALL reject the request with a 403 Forbidden error before processing any configuration change.

---

### Requirement 3: Customer Points Balance Visibility

**User Story:** As a Customer, I want to see my total loyalty points balance on my profile and checkout pages, so that I know how many points I have available to redeem.

#### Acceptance Criteria

1. WHEN a Customer views their profile page, THE Loyalty_System SHALL display the Customer's current Points_Balance.
2. WHEN a Customer opens the Checkout page, THE Loyalty_System SHALL display the Customer's current Points_Balance alongside the monetary value it represents (based on the current Redeem_Rate).
3. WHEN the `GET /api/auth/me` endpoint is called, THE Loyalty_System SHALL include the `pointsBalance` field in the user response.
4. WHEN the `GET /api/loyalty/balance` endpoint is called by an authenticated Customer, THE Loyalty_System SHALL return the Customer's current Points_Balance and the current Redeem_Rate.

---

### Requirement 4: Points Redemption at Checkout

**User Story:** As a Customer, I want to choose how many points to redeem at checkout for a discount, so that I can use my earned rewards on my orders.

#### Acceptance Criteria

1. WHEN a Customer is on the Checkout page and has a Points_Balance greater than 0, THE Loyalty_System SHALL display a points redemption option showing available balance and potential discount.
2. WHEN a Customer enters a points redemption amount, THE Loyalty_System SHALL calculate and display the corresponding discount in Rupees (points × Redeem_Rate).
3. WHEN a Customer submits an order with a points redemption amount, THE Loyalty_System SHALL validate that the redemption amount does not exceed the Customer's current Points_Balance.
4. WHEN a Customer submits an order with a valid points redemption amount, THE Points_Engine SHALL deduct the redeemed points from the Customer's Points_Balance within the same database transaction as order creation.
5. WHEN a Customer redeems points on an order, THE Loyalty_System SHALL create a Points_Transaction record of type `REDEEM` linked to the order and the points amount deducted.
6. WHEN points are redeemed on an order, THE Loyalty_System SHALL apply the monetary discount (redeemed points × Redeem_Rate) to the order's total amount before finalizing the order.
7. IF a Customer attempts to redeem more points than their current Points_Balance, THEN THE Loyalty_System SHALL reject the order with a descriptive error message.
8. IF a Customer enters a redemption amount that fails validation (exceeds balance or is invalid), THEN THE Loyalty_System SHALL place the order normally without any points redemption, treating the failed redemption as 0 points.
9. WHEN a Customer redeems points on an order, THE Loyalty_System SHALL NOT award earn points for the portion of the order covered by the points discount — points are earned on the net amount paid after redemption deduction.

---

### Requirement 5: Points Transaction History

**User Story:** As a Customer, I want to see my points earn and redeem history, so that I can track how I've accumulated and used my rewards.

#### Acceptance Criteria

1. WHEN a Customer calls `GET /api/loyalty/history`, THE Loyalty_System SHALL return a paginated list of the Customer's Points_Transaction records ordered by most recent first.
2. WHEN returning transaction history, THE Loyalty_System SHALL include for each record: transaction type (`EARN` or `REDEEM`), points amount, associated order ID, and timestamp.
3. IF a Customer has no Points_Transaction records, THEN THE Loyalty_System SHALL return an empty list without an error.

---

### Requirement 6: Admin Points Management

**User Story:** As an Admin, I want to view customer loyalty point balances and transaction history, and manually adjust points when needed, so that I can handle disputes and support customers effectively.

#### Acceptance Criteria

1. WHEN an Admin calls `GET /api/admin/loyalty/customers`, THE Loyalty_System SHALL return a paginated list of customers with their Points_Balance included.
2. WHEN an Admin calls `GET /api/admin/loyalty/customers/:id/history`, THE Loyalty_System SHALL return the full Points_Transaction history for that customer.
3. WHEN an Admin submits a manual adjustment via `POST /api/admin/loyalty/customers/:id/adjust`, THE Loyalty_System SHALL create a Points_Transaction of type `MANUAL` with the specified amount (positive to add, negative to deduct) and update the Customer's Points_Balance accordingly.
4. IF a manual deduction would bring a Customer's Points_Balance below 0, THEN THE Loyalty_System SHALL reject the adjustment with a descriptive error.
5. WHEN the `GET /api/admin/loyalty/config` endpoint is called, THE Loyalty_System SHALL return the current Earn_Rate and Redeem_Rate configuration.
6. WHEN the `PATCH /api/admin/loyalty/config` endpoint is called with valid parameters, THE Loyalty_System SHALL update the Earn_Rate and/or Redeem_Rate in AppConfig and return the updated configuration.

---

### Requirement 7: Points Permanence

**User Story:** As a Customer, I want my loyalty points to never expire, so that I can accumulate them over time and redeem whenever I choose.

#### Acceptance Criteria

1. THE Loyalty_System SHALL NOT have any expiry date or time-based invalidation logic for Points_Balance.
2. THE Loyalty_System SHALL retain all Points_Transaction records indefinitely and SHALL NOT delete or archive them automatically, as these records form the audit trail supporting permanent Points_Balance integrity.
3. WHILE a Customer's account is active, THE Loyalty_System SHALL preserve the Customer's full Points_Balance regardless of time elapsed since the last order.
