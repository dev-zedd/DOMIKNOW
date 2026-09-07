# DOMIKNOW UI/UX and workflow audit

Date: 2026-09-07. Changes are local and have not been deployed.

## Fixes implemented

- Replaced hardcoded role-page colors with shared semantic theme tokens across tenant, landlord, administrator, and maintenance screens. Fixed dark billing cards, headings, active tabs, links, and button hover contrast. Added automated contrast checks for the shared small-text link and primary-button states.
- Standardized role sidebar and content-width tokens. Restored tenant scrollbars, wrapped application remarks, exposed page headings on mobile, and corrected the property recommendation page marker.
- Made theme controls use one shared API, synchronize their labels, and recover when browser storage is unavailable. Prevented the shared UI mutation observer from repeatedly reacting to its own enhancements.
- Replaced the custom dashboard page loader with native document navigation to prevent page scripts, styles, and event handlers from leaking between routes. Preserved sidebar scroll position by role and login return destinations. Temporary profile-service failures no longer sign users out.
- Improved account-menu keyboard navigation and modal visibility/accessibility during opening animations. Hidden filtered rows now remain hidden even when responsive table styles use grid display.
- Replaced missing or unsafe document links with explicit unavailable-file labels. Escaped document labels and metadata.
- Renamed the administrator payment destination to Payment Monitoring to match its permissions.
- Calculated invoice balances from all verified payments using integer centavos. Tenant outstanding totals, statements, and payment defaults now reflect the remaining balance. Landlord revenue includes verified partial payments; overdue handling includes partially paid invoices.
- Payment verification now preserves earlier instalments when a later proof is rejected, rejects repeated reviews, and checks the pending status during the update. Invalid payment amounts are rejected before database or upload work.

## Verification performed

`node --test --test-reporter=dot test/*.test.js`: **96 passing tests**. `git diff --check`: passed (Git emitted line-ending notices only).

The automated suite includes theme persistence and storage failures, role dashboard startup and expired-session behavior, role authorization on ten workflow routes, payment reconciliation and amount validation, maintenance state transitions and ownership, safe document rendering, and browser-script parsing. Asset checks cover the local references and CSS token definitions across the application's 62 HTML files, 19 stylesheets, and 19 browser JavaScript files.

| Role | Browser checks | Automated workflow coverage |
| --- | --- | --- |
| Tenant | Property discovery; applications, details, unavailable documents and browser Back; light/dark billing statement; partial balance and payment-dialog default; Escape dismissal | Application and lease-acceptance route permissions; payment submission validation; dashboard/session behavior; maintenance confirmation and rework |
| Landlord | Property registration required-field validation; application search and responsive rows; light/dark role shell | Lease creation and payment-verification route permissions; cumulative payments, rejection and duplicate review; maintenance approval/assignment |
| Administrator | Role shell, filters, account-menu keyboard focus and theme switching | Approval-route permissions and dashboard/session behavior |
| Maintenance | Role shell, light/dark task list, offer filter and empty state | Ownership checks, ordered progress transitions, invalid transition rejection, completion/rework flow |

Browser checks used both an existing tenant session for read-only navigation and an isolated four-role fixture server (`test/support/ui-audit-server.js`). The fixture rejects write requests and does not connect to the production database. Desktop, mobile, and tablet layouts were sampled; the landlord application list measured no document overflow at effective widths of 434 and 853 CSS pixels. This is representative coverage, not a screenshot review of every page and state.

A read-only database query confirmed the billing-to-payment relationship used by the new balance query. No live payment, approval, lease, upload, notification, or maintenance mutation was performed.

## Remaining integration limits

- Full workflows involving actual uploads, email delivery, live approvals, and persisted records still need an end-to-end run with dedicated test accounts and data. Mocked route/controller/model tests do not establish those integrations work in production.
- Payment review and invoice reconciliation remain separate database writes in the existing architecture. A database transaction or RPC is still needed to guarantee atomic reconciliation during failures or concurrent reviews of different payments on one invoice. The pending-status check protects repeated review of the same payment, not that wider transaction boundary.
- The contrast assertions cover shared token states, not every rendered color combination. This audit is not a complete accessibility certification.

The isolated browser fixture can be started with `node test/support/ui-audit-server.js`; its four role entry points use loopback ports 3101 through 3104. Use fixture pages for repeatable UI checks without changing live records.

## Follow-up: icon consistency and Earth journey

Implemented after the request to eliminate emoji and replace the public mock map.

- Rescanned all public, authentication, tenant, landlord, administrator, and maintenance HTML/JS/CSS, plus notification-producing controllers. System-authored emoji and pictographic text symbols now use shared SVG icons. Native rating options retain readable text labels. Notification rendering removes legacy decorative pictographs from stored titles/messages while retaining the category SVG; stored records are unchanged.
- Theme buttons use SVG sun/moon icons. Rating controls and displays use SVG stars, accessible score labels, and selection states. Registration role choices and the maintenance sidebar note now use corresponding icons. Icon enhancement preserves caller classes and IDs rather than losing sizing and presentation attributes.
- Fixed additional link-color token usage, restored discoverable horizontal scrollbars on role filter strips, and removed the administrator's premature clipboard message from the accessibility tree.
- Replaced the public mock-map preview and illustrative prices with a locally rendered three-dimensional Earth. Its camera rotates toward the Philippines and zooms to the existing Siniloan center. The navy/blue geographic illustration includes Philippine coastlines and regional lakes, including Laguna de Bay. The live rental-discovery link remains available beside it.
- Added pause/resume and replay controls, lazy geographic-data loading, capped rendering resolution, off-screen/background suspension, reduced-motion behavior, and a readable fallback when canvas/data is unavailable. Reduced motion shows the destination without animating, including on replay.
- Geographic data is compacted from public-domain Natural Earth sources; attribution and provenance are in `public/images/EARTH_DATA_LICENSE.md`. No map key or geolocation request is needed for the illustration.

Validation: **100 automated tests pass**, including new no-emoji source checks and Earth animation/fallback behavior. Browser checks covered the public Earth and final zoom, both themes, mobile registration role selection and progression, tenant report/maintenance empty states, landlord registration and policy selection, administrator payment filters/empty state, and maintenance tasks/theme switching. Sampled screens reported no document overflow at 390 CSS pixels and no rendered emoji. `git diff --check` passed.

The globe is a geographic discovery illustration, not a building-level model or a replacement for the live rental map. No live account submission or production workflow mutation was performed during this follow-up. Changes remain local and undeployed.

## Follow-up: public CTA and expanded role workflows

The public hero primary CTA had a white `!important` background that bypassed the shared theme. It now uses the primary action tokens for default, hover, and pressed states. The closing CTA now has a dark surface in dark mode, and its secondary button pairs a semantic surface with readable semantic text in both themes. Browser computed styles and a rendered dark-mode screenshot confirmed the correction; a source regression check protects these overrides.

Additional workflow bugs fixed:

- Application decisions now require a pending application and preserve landlord ownership at mutation time. Approval conditionally reserves only available inventory; a competing approval receives a conflict. Rejecting a pending application no longer releases inventory belonging to another applicant or tenant. Failed application updates attempt to release the reservation made by that request.
- Lease edits, signatures, rejections, and status changes compare the previously read state during the update. Stale/repeated actions return a conflict rather than silently overwriting a decision. Creation and revision reject invalid calendar dates, reversed terms, malformed/negative amounts, fractional day values, and invalid occupant counts.
- Maintenance completion reports reject invalid costs and quantities before uploads/writes, calculate material totals in centavos, retain zero-cost materials, and clear stale material rows on resubmission.
- Feedback rejects fractional and malformed ratings instead of silently truncating them.

Final local validation: **173 passing tests**, no failed/skipped tests, and `git diff --check` passed.

| Coverage | What was exercised |
| --- | --- |
| Mounted APIs | 54 real Express route contracts in application mount order, each checked as public, tenant, landlord, administrator, and maintenance; real JWT/role middleware; invalid and expired tokens rejected. Business controllers are stubbed in this routing test. |
| Client connections | 140 literal browser `fetch` paths/methods resolve to mounted server endpoints. Dynamically constructed URLs beyond this pattern are not covered by this scan. |
| Account access | Tenant/landlord registration and verification, landlord approval gate, duplicate registration, restricted public roles, four-role login/disabled-account behavior, and password recovery/code consumption. Email and persistence are mocked. |
| Rental lifecycle | Administrator publication, tenant application/duplicate rejection, landlord approval and lease drafting, tenant signature, initial billing creation, landlord closure, and inventory release. Real controllers and core application/lease model logic use an in-memory database adapter. |
| Decision integrity | Competing approvals, rejection without releasing occupied inventory, repeated decisions/signatures, ownership, lease decline/revision, invalid terms, and required property evidence. |
| Maintenance | Assignment, worker acceptance/decline, ordered work progression, completion/material report, landlord verification, tenant closure, rework, and invalid-cost rejection. Persistence/uploads/notifications are mocked. |
| Feedback | Lease eligibility, duplicate prevention, administrator visibility decisions, public output without tenant identifiers, and malformed rating rejection. Persistence is mocked. |
| Existing regression suite | Payment balances/review, session recovery, shared themes/icons/assets, responsive UI contracts, property recommendations, storage helpers, and Earth journey behavior. |

These checks provide local workflow evidence, not exhaustive production end-to-end certification. Live storage uploads, delivered email, database permissions/triggers, and real persisted multi-role submissions still require a dedicated integration environment. Multi-table operations remain nontransactional: conditional updates and reservation compensation improve normal/concurrent request handling but cannot guarantee recovery from a process crash or every database/network failure. No schema changes or production records were written in this pass.


### Maintenance role alignment follow-up
- Unified account dropdown styles across all four roles; maintenance now exposes profile, theme, guide and logout in the shared menu.
- Replaced maintenance profile placeholder with API-backed work counts and a queue shortcut; removed repeated workflow strip from overview and queue.
- Added task search, priority selection, refresh and result counts. Verified reports remain in Completed until tenant closure; Closed now contains only closed requests. Escaped task text and encoded detail links.
- Checked populated isolated maintenance queue and overview in browser, including search, status filters, account menu, theme switching and mobile overflow. No live records were modified.
- Automated suite: 173 passing tests after these changes (including maintenance lifecycle and cross-role authorization). Task-detail mutations remain covered by controller tests; no live end-to-end mutation was attempted.


### Admin descriptive analytics
Added Admin > Command Center > Descriptive Analytics with six existing admin-authorized data sources, current status distributions, counts, monthly creation tables, inclusive Philippine-time date filters, refresh and record links. Unavailable sources remain distinct from empty results. Counts describe returned list records, not a guaranteed full-database aggregate; current API row limits still apply. No revenue or historical status claims are inferred from payment submissions. Browser checked navigation, populated/empty source results, filtering/reset, themes and mobile sizing using isolated fixtures. Automated suite: 175 passing tests. No production mutations or deployment.
