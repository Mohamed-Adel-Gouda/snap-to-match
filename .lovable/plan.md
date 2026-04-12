

# What's Missing for Production — TransferMatch

After reviewing all pages, auth, edge functions, database schema, and RLS policies, here are the top items ranked by criticality:

---

## 1. Password Reset Flow (Critical — Auth Gap)

The login page has no "Forgot Password" link. If a user forgets their password, they're locked out with no recovery path.

**Fix:** Add a "Forgot Password" button on the Login page that calls `supabase.auth.resetPasswordForEmail()`, and create a `/reset-password` page that handles the recovery token and lets the user set a new password.

---

## 2. Settings Page is Non-Functional (High)

The Settings page is purely cosmetic — the confidence threshold slider doesn't persist anywhere (it's local `useState`), and it says "Claude Vision" as the extraction engine when you're actually using Gemini Flash via Lovable AI Gateway. No settings are saved to the database.

**Fix:** Either persist the threshold to a `settings` table and use it during auto-matching, or remove the Settings page to avoid confusion. Update the engine label to "Gemini 2.5 Flash".

---

## 3. Pagination on Processed & Review Pages (High)

All queries fetch every row with no limit. Once you have 1,000+ transactions, you'll hit the Supabase default 1,000-row limit silently, and performance will degrade.

**Fix:** Add cursor-based or offset pagination to the Processed table and Review queue. Show page controls and fetch in batches of 50-100.

---

## 4. Date Range Filtering (Medium)

Dashboard volumes and the Processed table have no date filtering. In production, users need to see "this week's volume" or "this month's transactions" — not all-time totals mixed together.

**Fix:** Add a date range picker (today / this week / this month / custom) to the Dashboard and Processed page that filters the queries.

---

## 5. Logout Doesn't Clear Query Cache (Medium)

When a user logs out and another logs in, the React Query cache may still hold the previous user's data until queries refetch.

**Fix:** Call `queryClient.clear()` on logout before navigating to `/login`.

---

## Technical Summary

| # | Item | Files to Create/Edit | DB Changes |
|---|------|---------------------|------------|
| 1 | Password reset | Login.tsx (edit), ResetPassword.tsx (new), App.tsx (add route) | None |
| 2 | Fix Settings | SettingsPage.tsx (edit or remove) | Optional: `app_settings` table |
| 3 | Pagination | ProcessedPage.tsx, ReviewPage.tsx | None |
| 4 | Date filtering | Index.tsx, ProcessedPage.tsx | None |
| 5 | Logout cache clear | AppSidebar.tsx | None |

