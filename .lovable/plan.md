

# Production Readiness Audit — Top 5 Critical Fixes

After reviewing all pages (Dashboard, People, PersonProfile, Upload, Processed, Review, TransactionDetailModal), here are the most impactful missing pieces:

---

## 1. Loading States (Skeleton Loaders)

**Problem:** Most pages show nothing or a bare "Loading..." text while data fetches. The Dashboard, People list, Processed table, Review queue, and Person Profile all render empty/blank until queries resolve — this feels broken on slower connections.

**Fix:** Add skeleton loaders using the existing `Skeleton` component to Dashboard metric cards, People table rows, Person Profile header + metrics, Processed table, and Review queue cards. Use `isLoading` from `useQuery` to toggle between skeleton and real content.

---

## 2. Empty States with Guidance

**Problem:** Several screens lack helpful empty states:
- Person Profile shows an empty table with headers but no message when a person has zero transactions
- Person Profile shows "No identifiers" but no action prompt
- Dashboard "Recent Activity" has an empty state but People Directory doesn't guide well

**Fix:** Add friendly empty-state messages with action links (e.g., "No transactions yet — upload screenshots to get started") to Person Profile transactions table, and improve the identifiers empty state to suggest editing the person.

---

## 3. Form Validation (Phone Numbers & Required Fields)

**Problem:** The Add/Edit Person forms accept any text in phone fields — no character restrictions, no format validation feedback. Users can submit gibberish or incomplete numbers. The `normalizePhone` function handles normalization server-side but users get no client-side feedback about invalid entries.

**Fix:** Add inline validation to phone inputs:
- Restrict to digits only (strip non-numeric on input or show error)
- Show a warning badge if the normalized result isn't a valid 11-digit Egyptian number
- Prevent form submission if the name field is empty (already partially done) or all phone numbers are invalid
- Add validation to the manual phone/amount fields in TransactionDetailModal

---

## 4. Mobile Responsiveness

**Problem:** 
- The 6-column metric grid on Person Profile (`lg:grid-cols-6`) will stack but cards may be too narrow on tablet
- Tables (People, Processed) use `overflow-x-auto` but column widths aren't optimized for mobile — some columns could be hidden
- The TransactionDetailModal uses `max-w-4xl` with a 2-column grid that collapses on mobile but the image + form can be very long
- The Dashboard 5-column grid needs better intermediate breakpoints

**Fix:** 
- Adjust grid breakpoints: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` for Dashboard, `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` for Profile
- Add `min-w-[640px]` to table wrappers for horizontal scroll on mobile
- Make TransactionDetailModal responsive: single column on mobile, image constrained to reasonable height
- Hide less-critical table columns (Confidence, Filename) on small screens using responsive utility classes

---

## 5. Toast Notifications for All Mutations

**Problem:** Most mutations already have toast notifications (add/edit/delete person, approve/reject). However:
- The Upload page shows toast on error but not on individual success
- Manual extraction save in TransactionDetailModal shows generic "Updated" — could be more descriptive
- No confirmation dialog before destructive actions (delete person)

**Fix:**
- Add success toasts with transaction codes on upload completion
- Improve toast messages to be more descriptive (e.g., "Approved TX-20260412-003 for 5,000 EGP")
- Add a confirmation dialog before deleting a person (using AlertDialog component)

---

## Technical Summary

| # | Area | Files to Edit |
|---|------|--------------|
| 1 | Skeleton loaders | Index.tsx, PeoplePage.tsx, PersonProfile.tsx, ProcessedPage.tsx, ReviewPage.tsx |
| 2 | Empty states | PersonProfile.tsx |
| 3 | Form validation | PeoplePage.tsx, TransactionDetailModal.tsx |
| 4 | Mobile responsiveness | Index.tsx, PersonProfile.tsx, ProcessedPage.tsx, PeoplePage.tsx, TransactionDetailModal.tsx |
| 5 | Toast & confirmations | UploadPage.tsx, TransactionDetailModal.tsx, PeoplePage.tsx |

No database changes required. No new dependencies needed — all components (Skeleton, AlertDialog, toast) already exist in the project.

