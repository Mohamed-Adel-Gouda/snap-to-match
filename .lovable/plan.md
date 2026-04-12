

# Add Auto-Approve Toggle to Settings

## What

Add a Switch toggle to the Settings page that controls whether high-confidence auto-matched transactions are automatically approved (status set to "approved") or left as "pending" for manual review.

## How

### 1. Create `app_settings` table (migration)
- Single-row settings table: `id` (uuid, PK), `key` (text, unique), `value` (jsonb), `updated_at` (timestamptz)
- Seed with `auto_approve_enabled = false`
- RLS: authenticated can SELECT; only admins can UPDATE

### 2. Update Settings page (`SettingsPage.tsx`)
- Fetch the `auto_approve_enabled` setting from the `app_settings` table
- Add a Switch component with label "Auto-Approve" and description explaining that transactions with 80%+ confidence will be automatically approved
- On toggle, update the setting in the database and show a toast confirmation

### 3. Update edge function (`extract-transfer/index.ts`)
- After auto-matching, check the `auto_approve_enabled` setting from `app_settings`
- If enabled and `match_confidence >= 80`, set `accounting_status = 'approved'` and `approved_amount = extracted_amount`
- If disabled, leave status as `pending` (current behavior)

## Files

| Action | File |
|--------|------|
| Migration | New: `app_settings` table + seed row |
| Edit | `src/pages/SettingsPage.tsx` — add Switch + fetch/update logic |
| Edit | `supabase/functions/extract-transfer/index.ts` — read setting, conditionally auto-approve |

