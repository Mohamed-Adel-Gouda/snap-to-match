

# Retroactive Data-Linking for New Phone Numbers

## What

When a person is created or edited with phone numbers, automatically find all `transfer_screenshots` records that have a matching `extracted_phone_normalized` but no `matched_person_id`, link them to this person, and show a toast summarizing how many were linked.

## How

### 1. Create a reusable linking function

Add a helper function (in `PeoplePage.tsx` or a shared util) that:
- Takes a `person_id` and array of normalized phone numbers
- Queries `transfer_screenshots` where `extracted_phone_normalized` is in the phone list AND `matched_person_id` is null
- Batch updates those rows to set `matched_person_id`, `match_type = 'retroactive'`, `auto_matched = true`
- Returns the count of linked records

### 2. Integrate into Add Person flow

After the person and identifiers are inserted successfully (in `addPerson.onSuccess` or end of `mutationFn`):
- Call the linking function with the new person's ID and their normalized phones
- Show toast: "Person saved! X previous uploads were automatically assigned." (or just the standard toast if 0 linked)

### 3. Integrate into Edit Person flow

After the person's identifiers are updated (in `updatePerson.mutationFn`):
- Call the same linking function with the person's ID and their new normalized phones
- Show appropriate toast in `onSuccess`

### 4. No DB migration needed

The `transfer_screenshots` table already has `matched_person_id`, `match_type`, and `auto_matched` columns. We just need to update rows client-side via the Supabase SDK. RLS already allows authenticated users to update screenshots.

## Files

| Action | File |
|--------|------|
| Edit | `src/pages/PeoplePage.tsx` — add linking logic to both add and edit mutations |

