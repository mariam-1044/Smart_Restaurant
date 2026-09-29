# Quickstart: Verify the Six New Frontend Pages

This is the **manual acceptance script** for Feature 003. Each section maps to one page and one user story. Run them in order; the seeding done in §0 is reused by all sections.

Automated tests are explicitly P5 scope per the source plan; this quickstart is the verification surface for this feature.

---

## 0. Prerequisites and seeding

```bash
# from repo root
cd Server
npm install
node scripts/seed.js          # if a seed script exists; otherwise see "manual seed" below
npm run dev                   # starts the API on http://localhost:8080

# in another terminal
cd Client
npm install
npm run dev                   # starts Vite on http://localhost:5173
```

**Manual seed (if no seed script)**: through the existing `/register` and admin pages, create:
- 1 admin user (`admin@test.local` / `Passw0rd!`)
- 1 staff user (`staff@test.local` / `Passw0rd!`)
- 1 pending staff user (register, then leave status as `pending`)
- 5 dishes across at least 2 categories
- 10 ingredients with varying expiry dates (some within 3 days)
- 6 customers, with at least 3 having multiple orders, and at least 1 with no order in the last 60 days

Sign in as `admin@test.local` for §1–§4 and §6. Sign in as `staff@test.local` for §5 verification of staff-accessible behavior.

---

## 1. Menu Management — `/admin/menu`

Maps to: User Story 1, SC-001, SC-003.

1. Click **Menu** in the sidebar — page opens at `/admin/menu`.
2. Verify the table lists every dish from seeding with name, category, price, an availability toggle, and ingredient count. ⇒ AS1.1 ✓
3. Click **New dish**. Fill in name, category, price, image URL, and link two ingredients with quantities. Save. ⇒ AS1.2 ✓ — new row appears.
4. Edit the new dish, change the price, save. Open the dish's pricing-history view; the new entry is the most recent. ⇒ AS1.3 ✓
5. Toggle availability off. Open `/order` (Ordering System) in another tab; the dish is no longer orderable. ⇒ AS1.4 ✓
6. Sign out. Sign in as `staff@test.local`. Navigate manually to `/admin/menu`. You are redirected; no menu UI renders. ⇒ AS1.5 ✓
7. **Concurrency test**: open the menu page in two browser windows, both as admin. In window A, edit a dish and save. In window B, edit the same dish (without refreshing) and try to save. Window B receives the "record changed by another admin — refresh to see the latest version" toast and the modal closes with the edit discarded. ⇒ FR-035 ✓

**Pass when**: all six steps succeed and SC-001 (≤90 s end-to-end create) is met during step 3.

---

## 2. User & Staff Management — `/admin/users`

Maps to: User Story 4, SC-004.

1. Click **Users** in the sidebar — page opens at `/admin/users`.
2. The table lists all users with status badges (active=green, pending=amber, inactive=red). ⇒ AS4.1 ✓
3. Click the **Pending** filter pill. Only the pending user(s) appear, each with Approve / Reject controls. ⇒ AS4.2 ✓
4. Click **Approve**. Status changes to active; controls disappear; user moves out of the Pending filter. ⇒ AS4.3 ✓
5. Find an existing staff user; change their role to admin via the inline dropdown. Their role badge updates immediately. ⇒ AS4.4 ✓
6. Sign out. Sign in as a non-admin. Navigate to `/admin/users`. Redirect happens. ⇒ AS4.5 ✓

**Pass when**: time-from-arrival to "approve" completes in ≤30 s (SC-004) and step 6 redirects.

---

## 3. Demand Forecast — `/ai/forecast`

Maps to: User Story 2, SC-006, SC-010.

1. Click **Forecast** in the sidebar — page opens at `/ai/forecast`.
2. Pick a dish in the dropdown; pick **7 days**. The chart renders with a predicted-quantity line and a confidence band. ⇒ AS2.1 ✓
3. Toggle to **30 days** without leaving the page. Chart and table refresh. ⇒ AS2.2 ✓
4. The data table is visible and exportable. Click **Export CSV** — a file `forecast-{dish}-7d-{date}.csv` downloads with `date,predictedQuantity,lowerBound,upperBound` columns. ⇒ FR-007 ✓
5. Verify the staffing card appears for the busiest day if `staffingSuggestion.suggestedAddedStaff > 0`. ⇒ AS2.4 ✓
6. **Spike alert**: pick a dish whose seeded order history has a recent spike. The page shows the alert banner naming the dish and the projected ratio. ⇒ AS2.3 ✓
7. **Insufficient history**: pick a dish that has only a couple of days of orders. The page renders an "insufficient history for spike detection" note and suppresses the spike banner. ⇒ Edge case ✓
8. **AI failure**: stop the ML service (`Ctrl-C` on the FastAPI process). Trigger another forecast. Page shows the "AI forecast service unavailable" `ErrorState`; **no numbers appear**. ⇒ AS2.5 / SC-010 ✓
9. SC-006: from arriving at the page to identifying the busiest day, ≤10 s.

**Pass when**: every step succeeds and the AI failure path shows no fabricated values.

---

## 4. Dynamic Pricing — `/ai/pricing`

Maps to: User Story 3, SC-005.

1. Click **Pricing** in the sidebar — page opens at `/ai/pricing`.
2. Cards render for each dish with current price, suggested price, direction icon, demand score, confidence. ⇒ AS3.1 ✓
3. Click **Apply** on one card. Confirmation modal appears with projected revenue impact. Confirm. The dish's price updates and the pricing-history panel for that dish shows the new entry as most recent. ⇒ AS3.2 ✓ / SC-005 (≤15 s) ✓
4. Click the **Suggested increase** filter pill. Only increase recommendations remain. Click **Apply all**. Confirmation modal says "Apply N suggested increases to currently displayed dishes?" with the right count. Confirm. Verify in the menu page that *only* those dishes' prices changed; recommendations excluded by the filter are unchanged. ⇒ AS3.3 ✓
5. Open Pricing in two tabs as admin. Tab A applies a recommendation. Tab B (still showing old `__version`) tries to apply the same recommendation. Tab B receives a per-item conflict in the response and shows a "record changed" toast for that dish; the page refetches that recommendation. ⇒ FR-035 partial (per-item conflict bucket) ✓
6. **AI failure**: stop the AI service. Reload `/ai/pricing`. Page shows an `ErrorState`; no fabricated suggestions. ⇒ FR-032 / SC-010 ✓

**Pass when**: bulk apply demonstrably affects only filtered dishes (verifiable on the menu page).

---

## 5. Customer Management — `/customers`

Maps to: User Story 5, SC-007.

Sign in as `staff@test.local` for steps 1–4 (page is staff-accessible), then sign in as `admin@test.local` for step 5.

1. Click **Customers** in the sidebar — page opens at `/customers`.
2. Table renders with name/phone, order count, total spend, last-order date, favorites count. ⇒ AS5.1 ✓
3. Click any customer row to open the detail drawer. Drawer shows: header with `tags` badges, order-history timeline, favorite dishes, and AI recommendations. ⇒ AS5.2 ✓
4. Pick a customer who has no order in the last 60 days but previously had ≥3 orders in 90 days; verify the **At Risk** tag appears. ⇒ AS5.3 ✓
5. SC-007: locate any specific customer and view their recommendations in ≤20 s.
6. **AI failure**: stop the recommendation service. Reopen a customer's drawer. The order-history and favorites regions still render; only the recommendations region shows the unavailable state. ⇒ AS5.4 / FR-025 ✓
7. **Cold-start customer**: pick a customer with no orders. The drawer renders without errors; order-history shows an empty state; recommendations show a cold-start message.

**Pass when**: every region degrades independently and step 6 keeps history visible.

---

## 6. Waste Management — `/waste`

Maps to: User Story 6, SC-008.

Sign in as admin.

1. Click **Waste** in the sidebar — page opens at `/waste`.
2. Summary cards show total waste this month, monetary value, and reduction-vs-last-month percentage. ⇒ AS6.1 ✓
3. Three charts render: by ingredient (bar), trend (line), by category (pie). ⇒ AS6.2 ✓
4. Near-expiry table lists all ingredients within 3 days of expiry with a "Use in Recipe" button. ⇒ AS6.3 ✓
5. Click **Use in Recipe** on a near-expiry row. Modal opens, calls `POST /api/ai/recipe`, and renders a recipe with name, ingredients (the near-expiry one highlighted), and steps. ⇒ AS6.4 / SC-008 (≤30 s end-to-end) ✓
6. **AI failure**: stop the AI service; click "Use in Recipe" again. Modal shows the unavailable state; the rest of the page stays usable. ⇒ FR-029 / FR-032 ✓

**Pass when**: every chart region degrades independently and recipe generation degrades inside the modal only.

---

## 7. Cross-cutting checks (all six pages)

Run these once across the feature, picking any one page for each check.

1. **Loading state visible** — refresh a page on a slow connection (Chrome DevTools → Network → Slow 3G); the shared `LoadingState` is visible during fetch.
2. **Empty state visible** — pick a page where the underlying data set is empty (e.g. fresh DB after seeding only an admin user); the shared `EmptyState` renders without errors.
3. **Error state visible** — kill the backend; refresh any page; the shared `ErrorState` renders with a working Retry button.
4. **Route guard before render** — open DevTools → Network. As a non-admin, navigate directly to `/admin/menu`. Verify *no* requests to `/api/menu` are made before the redirect happens. ⇒ FR-030 ✓
5. **Navigation entries** — log in as staff and confirm `/admin/menu`, `/admin/users`, `/ai/forecast`, `/ai/pricing`, `/waste` are *not* in the sidebar; `/customers` *is*. Log in as admin and confirm all six are present. ⇒ FR-034 ✓
6. **No fabricated data** — across all six pages, with backend or AI services down, scan every visible card, chart, and table; nothing should display a number, list, or shape that isn't sourced from a successful response. ⇒ FR-032 / SC-010 ✓
7. **Visual consistency** — switch between an existing page (e.g. `/dashboard`) and a new page; sidebar, navbar, fonts, spacing, and color palette are visually identical. ⇒ FR-033 ✓

**The feature is acceptance-complete when every numbered step in §1–§7 passes.**
