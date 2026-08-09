# DOMIKNOW Design System
**Version:** 1.0  
**Mode:** Light + Dark  
**Product type:** Cloud-based rental property operations platform  
**Design target:** Enterprise-grade web application, responsive desktop/tablet/mobile  
**Primary users:** Public users, tenants, landlords, maintenance personnel, administrators

---

## 1. Design Direction

DOMIKNOW should feel:

- **Trustworthy** — appropriate for rental records, documents, payments, reports, and administrative actions.
- **Clear** — users should understand status, next action, ownership, and progress without guessing.
- **Operational** — dashboards and workflows should prioritize tasks, records, exceptions, and status.
- **Accessible** — color, contrast, typography, focus, and touch targets must support inclusive use.
- **Consistent** — the same component, status, spacing, and color role should behave the same everywhere.
- **Calm, not decorative** — branding is visible through navy/blue accents, not through excessive gradients, saturated backgrounds, or visual effects.

### Core rule
Use **neutral surfaces for most of the interface** and reserve the DOMIKNOW brand colors for hierarchy, actions, navigation, and important emphasis.

---

# 2. Brand Identity

## 2.1 Primary logo structure

The current DOMIKNOW logo should follow these assignments:

| Logo part | Color |
|---|---|
| Domino/house outline | Deep Navy `#042458` |
| Internal divider line | Deep Navy `#042458` |
| Upper domino dot | Electric Blue `#0355F3` |
| Lower two domino dots | Deep Navy `#042458` |
| `DOMI` wordmark | Deep Navy `#042458` |
| `KNOW` wordmark | Electric Blue `#0355F3` |
| Logo interior | Transparent |

The roof/house implication should remain subtle so the symbol reads primarily as a domino.

## 2.2 Logo usage

### Preferred
- Use the primary logo on Cloud White or Surface White.
- Preserve transparent interior.
- Keep clear space around the logo equal to at least the diameter of one domino dot.
- Use the full logo in headers, login screens, official pages, and documentation.
- Use the icon-only version for favicons, compact sidebars, and app shortcuts.

### Avoid
- Do not add gradients, glows, drop shadows, bevels, or 3D effects to the logo.
- Do not recolor individual dots arbitrarily.
- Do not stretch or compress the logo.
- Do not place the primary dark logo on visually noisy imagery.
- Do not use Electric Blue for large bodies of text.

## 2.3 Dark-background logo variant

For dark surfaces:
- Domino/house outline: Cloud White `#F8FAFC`
- Divider: Cloud White `#F8FAFC`
- Upper dot: Dark-mode Accent `#5B84FF`
- Lower dots: Cloud White `#F8FAFC`
- `DOMI`: Cloud White `#F8FAFC`
- `KNOW`: Dark-mode Accent `#5B84FF`

---

# 3. Core Brand Palette

These are the **four main light-mode brand/UI colors**.

| Token | Name | Hex | Primary role |
|---|---|---|---|
| `brand.canvas` | Cloud White | `#F8FAFC` | Main application background |
| `brand.surface` | Surface White | `#FFFFFF` | Cards, forms, tables, modals |
| `brand.navy` | Deep Navy | `#042458` | Brand structure, headings, logo, strong text |
| `brand.blue` | Electric Blue | `#0355F3` | Primary actions, active states, links, emphasis |

### Recommended visual distribution
- Cloud White: **50–55%**
- Surface White: **25–30%**
- Deep Navy: **10–15%**
- Electric Blue: **5–10%**

Electric Blue is an **accent/action color**, not a page-background color.

---

# 4. Neutral Color Scale

The four core colors define the brand, but an enterprise interface needs a neutral scale for borders, secondary text, disabled states, layers, and tables.

| Token | Hex | Typical use |
|---|---|---|
| `neutral.0` | `#FFFFFF` | Elevated surface |
| `neutral.25` | `#F8FAFC` | App canvas |
| `neutral.50` | `#F1F5F9` | Secondary surface |
| `neutral.100` | `#E2E8F0` | Dividers, strong borders |
| `neutral.200` | `#CBD5E1` | Input borders, disabled borders |
| `neutral.300` | `#94A3B8` | Placeholder, muted icon |
| `neutral.400` | `#64748B` | Secondary text |
| `neutral.500` | `#475569` | Strong secondary text |
| `neutral.600` | `#334155` | Body text |
| `neutral.700` | `#1E293B` | High-emphasis text |
| `neutral.800` | `#0F172A` | Maximum-emphasis text |

### Default text hierarchy
- Primary text: `#0F172A`
- Secondary text: `#475569`
- Muted/supporting text: `#64748B`
- Placeholder: `#94A3B8`
- Brand heading: `#042458`

Do not use light gray text on a white background when the contrast becomes too low.

---

# 5. Light Mode Theme

## 5.1 Surface tokens

| Token | Hex | Use |
|---|---|---|
| `bg.canvas` | `#F8FAFC` | Main app background |
| `bg.surface` | `#FFFFFF` | Cards, panels, forms |
| `bg.subtle` | `#F1F5F9` | Filters, grouped controls, table headers |
| `bg.hover` | `#F1F5F9` | Neutral hover state |
| `bg.selected` | `#EAF0FF` | Selected row/card/navigation item |
| `border.default` | `#DCE3EC` | Default component border |
| `border.strong` | `#CBD5E1` | Strong separation |
| `divider` | `#E2E8F0` | Table/list dividers |

## 5.2 Brand/action tokens

| Token | Hex | Use |
|---|---|---|
| `action.primary` | `#0355F3` | Primary buttons |
| `action.primary.hover` | `#0247D1` | Hover |
| `action.primary.pressed` | `#023CB1` | Pressed |
| `action.primary.subtle` | `#EAF0FF` | Selected backgrounds |
| `action.primary.focus` | `#7EA2FF` | Focus ring |
| `link.default` | `#0355F3` | Links |
| `link.hover` | `#0247D1` | Link hover |
| `brand.strong` | `#042458` | Brand/nav/heading emphasis |

### Primary button
- Fill: `#0355F3`
- Text: `#FFFFFF`
- Hover: `#0247D1`
- Pressed: `#023CB1`
- Focus ring: `2px #7EA2FF` with `2px` outer offset

---

# 6. Dark Mode Theme

Dark mode should not be a simple inversion of light mode. Surfaces must retain visible hierarchy.

## 6.1 Main dark palette

| Token | Name | Hex | Role |
|---|---|---|---|
| `dark.canvas` | Midnight Canvas | `#0B1220` | Main background |
| `dark.surface` | Navy Slate | `#111827` | Cards and primary panels |
| `dark.surface.elevated` | Elevated Slate | `#172033` | Modals, dropdowns, raised areas |
| `dark.text.primary` | Cloud Text | `#F8FAFC` | Main text |
| `dark.text.secondary` | Slate Text | `#CBD5E1` | Secondary text |
| `dark.border` | Slate Border | `#263449` | Borders/dividers |
| `dark.action` | Action Blue | `#1F6BFF` | Filled primary action |
| `dark.accent` | Accent Blue | `#5B84FF` | Links, icons, selected indicators |

## 6.2 Dark action behavior

| State | Hex |
|---|---|
| Default filled action | `#1F6BFF` |
| Hover | `#2F75FF` |
| Pressed | `#1557D8` |
| Link/accent | `#5B84FF` |
| Focus ring | `#8AA7FF` |

Use `#FFFFFF` text on `#1F6BFF` filled buttons.

Do not use the original Deep Navy `#042458` as a large dark-mode surface because it becomes visually indistinguishable from other dark layers and weakens elevation hierarchy.

---

# 7. Semantic Status Colors

Semantic colors are functional support tokens. They are **not part of the four main brand colors**.

## 7.1 Light mode

| State | Text/Icon | Background | Border |
|---|---|---|---|
| Success | `#166534` | `#F0FDF4` | `#BBF7D0` |
| Warning | `#92400E` | `#FFFBEB` | `#FDE68A` |
| Error | `#991B1B` | `#FEF2F2` | `#FECACA` |
| Information | `#1E40AF` | `#EFF6FF` | `#BFDBFE` |

## 7.2 Dark mode

| State | Text/Icon | Background | Border |
|---|---|---|---|
| Success | `#86EFAC` | `#052E16` | `#166534` |
| Warning | `#FDE68A` | `#451A03` | `#92400E` |
| Error | `#FCA5A5` | `#450A0A` | `#991B1B` |
| Information | `#93C5FD` | `#172554` | `#1E40AF` |

### Status rule
Never communicate success, warning, error, payment state, application state, or maintenance state using color alone. Always pair color with:
- text label,
- icon,
- or both.

---

# 8. Rental Workflow Status System

Use standardized labels across tables, cards, dashboards, notifications, and detail pages.

## Property
- Draft
- Submitted
- Under Review
- Approved
- Rejected
- Inactive

## Rental application
- Draft
- Submitted
- Under Review
- Approved
- Rejected
- Withdrawn

## Reservation
- Pending
- Confirmed
- Cancelled
- Expired

## Billing/payment
- Upcoming
- Due
- Overdue
- Pending Verification
- Verified
- Rejected

## Maintenance
- Submitted
- Acknowledged
- Assigned
- In Progress
- For Verification
- Completed
- Cancelled

## Complaint/report
- Submitted
- Under Review
- Action Required
- Resolved
- Dismissed

### Badge guidance
Use subtle background fills with strong readable foreground text. Avoid solid saturated status badges for every row in a dense table.

---

# 9. Typography

## 9.1 Recommended UI typeface

**Primary:** Inter  
**Fallback:** `Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

Reasons:
- highly legible at small UI sizes,
- neutral enterprise appearance,
- strong numeric readability,
- works well in dashboards, tables, forms, and responsive layouts.

## 9.2 Type scale

| Style | Size | Line height | Weight | Typical use |
|---|---:|---:|---:|---|
| Display | 40px | 48px | 700 | Marketing/landing hero only |
| H1 | 32px | 40px | 700 | Page title |
| H2 | 24px | 32px | 700 | Major section |
| H3 | 20px | 28px | 600 | Card/section title |
| H4 | 18px | 26px | 600 | Subsection |
| Body L | 16px | 24px | 400 | Main readable content |
| Body M | 14px | 20px | 400 | Default enterprise UI |
| Body S | 13px | 18px | 400 | Supporting information |
| Label M | 14px | 20px | 600 | Form labels/buttons |
| Label S | 12px | 16px | 600 | Badges/table metadata |
| Caption | 12px | 16px | 400 | Secondary metadata |

### Minimums
- Main body text: **14px minimum**
- Form labels: **14px recommended**
- Avoid important text below **12px**

## 9.3 Numeric data
Use tabular numerals where possible for:
- rent,
- billing,
- dates,
- analytics,
- occupancy,
- payments,
- tables.

---

# 10. Spacing System

Use a **4px base unit**.

| Token | Value |
|---|---:|
| `space.0` | 0 |
| `space.1` | 4px |
| `space.2` | 8px |
| `space.3` | 12px |
| `space.4` | 16px |
| `space.5` | 20px |
| `space.6` | 24px |
| `space.8` | 32px |
| `space.10` | 40px |
| `space.12` | 48px |
| `space.16` | 64px |
| `space.20` | 80px |

### Default spacing rules
- Icon to label: 8px
- Label to input: 8px
- Related form controls: 16px
- Card internal padding: 20–24px
- Section spacing: 32px
- Major page sections: 40–48px

Do not use arbitrary spacing values such as 17px, 23px, or 37px unless technically necessary.

---

# 11. Layout and Grid

## Desktop
- 12-column grid
- Max content width: **1440px**
- Page gutter: **32px**
- Dashboard side navigation: **240–272px**
- Compact collapsed nav: **72–80px**

## Tablet
- 8-column grid
- Gutter: **24px**

## Mobile
- 4-column grid
- Gutter: **16px**

## Recommended breakpoints

| Name | Width |
|---|---:|
| Small mobile | `< 480px` |
| Mobile | `480–767px` |
| Tablet | `768–1023px` |
| Desktop | `1024–1439px` |
| Large desktop | `≥ 1440px` |

### Page pattern
1. Breadcrumb or context
2. Page title + primary action
3. Optional summary/KPI strip
4. Filter/search controls
5. Main table/card/workflow content
6. Secondary details

---

# 12. Border Radius

Use restrained radii for an enterprise appearance.

| Token | Value | Use |
|---|---:|---|
| `radius.sm` | 6px | Small controls/badges |
| `radius.md` | 8px | Inputs/buttons |
| `radius.lg` | 12px | Cards/dropdowns |
| `radius.xl` | 16px | Large panels/modals |
| `radius.full` | 999px | Pills/avatars only |

Avoid excessive “bubble” styling.

---

# 13. Borders and Elevation

## Borders
- Default: `1px solid #DCE3EC`
- Strong: `1px solid #CBD5E1`
- Focus: use focus ring rather than simply changing border color

## Shadows

### Light
- Card: `0 1px 2px rgba(15, 23, 42, 0.06)`
- Dropdown: `0 8px 24px rgba(15, 23, 42, 0.12)`
- Modal: `0 20px 48px rgba(15, 23, 42, 0.18)`

### Dark
Use subtle shadows plus border contrast; do not depend on shadows alone.

### Rule
Prefer **borders + surface hierarchy** over large decorative shadows.

---

# 14. Iconography

Recommended style:
- outline icons,
- 1.5–2px stroke,
- rounded joins,
- consistent visual weight.

Standard sizes:
- 16px inline
- 20px controls
- 24px navigation
- 32px empty-state support

Do not mix filled, outlined, 3D, and illustration-style icons within the same functional area.

---

# 15. Buttons

## 15.1 Primary
- Background: Electric Blue
- Text: White
- Height: 40px standard / 44px comfortable
- Radius: 8px
- Horizontal padding: 16px
- Use for one principal action per section

Examples:
- Add Property
- Submit Application
- Save Changes
- Verify Payment
- Assign Maintenance

## 15.2 Secondary
- Background: White
- Border: `#DCE3EC`
- Text: `#042458`

## 15.3 Tertiary
- Transparent
- Text: `#0355F3`
- No permanent border

## 15.4 Destructive
- Use semantic error color
- Require confirmation for irreversible actions

## Button states
Every interactive button must define:
- default,
- hover,
- pressed,
- focus-visible,
- disabled,
- loading.

Do not disable a button without explaining why when the missing requirement is not obvious.

---

# 16. Form Controls

Standard input height: **40–44px**

Required structure:
1. Label
2. Optional/required indicator
3. Input
4. Supporting text or validation message

## Input states
- Default
- Hover
- Focus
- Filled
- Disabled
- Read-only
- Error
- Success where meaningful

### Error behavior
- Show error directly below the affected field.
- Describe the correction required.
- Do not clear valid user input after validation failure.

Example:
> **Property permit number is required.** Enter the permit/reference number shown on the uploaded document.

---

# 17. Cards and Panels

Use cards for meaningful grouping, not for every piece of content.

### Standard card
- Surface: White
- Border: `#DCE3EC`
- Radius: 12px
- Padding: 20–24px

### Dashboard KPI card
Contains:
- short label,
- primary number,
- optional comparison,
- status/context.

Do not rely on oversized decorative icons to communicate KPI meaning.

---

# 18. Tables

Tables are a primary enterprise pattern for:
- properties,
- applications,
- tenants,
- payments,
- maintenance,
- complaints,
- audit logs.

## Table rules
- Sticky header for long tables
- Left-align text
- Right-align currency/numeric values
- Keep status in dedicated column
- Row actions go at far right
- Support search/filter/sort where data volume warrants it
- Use pagination or virtualized loading for large datasets
- Keep row height approximately 48–56px

### Mobile
Do not force a wide desktop table into a narrow viewport. Convert to:
- responsive cards,
- prioritized columns,
- or horizontal scrolling only when necessary.

---

# 19. Navigation

## Public site
Top navigation:
- Properties
- Map
- How It Works
- Login
- Register

## Authenticated application
Use:
- persistent left sidebar on desktop,
- collapsible side navigation on tablet,
- drawer/bottom strategy on mobile where appropriate.

### Navigation hierarchy
- Active module uses subtle blue background + strong label
- Do not use bright solid-blue blocks for every navigation item
- Keep badges for actionable counts only

---

# 20. Role-Specific Experience

## Public User
Priority:
- discover properties,
- understand amenities/rules,
- view location,
- see authenticated feedback,
- register easily.

## Tenant
Priority:
- application status,
- billing/payment status,
- maintenance status,
- notifications,
- lease/policy information.

## Landlord
Priority:
- property status,
- applicants,
- occupancy,
- billing/payments,
- maintenance,
- reports,
- analytics.

## Maintenance Personnel
Priority:
- assigned task,
- urgency,
- property/unit,
- work status,
- completion evidence.

## Administrator
Priority:
- pending verification,
- reports/complaints,
- property approvals,
- user regulation,
- audit logs,
- platform health.

The interface may emphasize different information by role, but the underlying components and design tokens must remain consistent.

---

# 21. GIS / Map UI

The GIS module requires dedicated design rules.

## Map controls
- Search
- Location
- Property type
- Price range
- Availability
- Tenant preference criteria
- Rating/reliability criteria where approved

## Property marker states
- Default
- Hover
- Selected
- Unavailable/disabled

Do not use only marker color to distinguish important states; also use shape, icon, label, or selected outline.

## Map + list pattern
Desktop:
- map and property list may appear side by side.

Mobile:
- provide a clear toggle between **Map** and **List**.

Selected map property and selected list card must stay synchronized.

---

# 22. Recommendation UI

The recommendation component is **decision support**, not autonomous approval.

Recommended presentation:
- “Recommended for you”
- Match explanation
- Relevant criteria
- Clear link to full property details

Avoid:
- fake precision such as `97.438% compatible` unless the computation genuinely supports it.
- claims such as “Best property” without transparent criteria.

Prefer:
> **Strong match**  
> Matches your preferred location, budget range, and property type.

---

# 23. Billing and Payment UI

Separate the concepts visually:

## Billing
What is owed:
- item,
- amount,
- due date,
- billing period.

## Payment tracking
What happened to a specific payment:
- submitted,
- pending verification,
- verified,
- rejected,
- reference/proof.

## Payment monitoring
Aggregate landlord/admin view:
- paid,
- unpaid,
- overdue,
- pending verification,
- total collected.

Currency values should use consistent formatting and tabular numerals.

---

# 24. Utilities Monitoring UI

Utilities monitoring is record-based unless actual utility-provider integration is implemented.

Recommended fields:
- utility type,
- billing period,
- previous/current reading if manually recorded,
- charge,
- due date,
- payment status,
- attachment/reference if applicable.

Never imply live utility-provider data if the platform only stores landlord-entered records.

---

# 25. Maintenance Workflow UI

Recommended timeline:

`Submitted → Acknowledged → Assigned → In Progress → For Verification → Completed`

Maintenance card should show:
- category,
- urgency,
- description,
- property/unit,
- date submitted,
- assigned personnel,
- current status,
- latest update.

Urgency and status are separate concepts.

---

# 26. Ratings, Feedback, Reports, and Complaints

Keep these concepts distinct.

## Rating
Structured numeric/scale assessment.

## Feedback
Written comment linked to an authenticated rental experience where applicable.

## Report/Complaint
Actionable concern requiring review.

### UI rule
Do not place “feedback” and “report” under one ambiguous action.

Use:
- **Leave Rating & Feedback**
- **Report an Issue**

---

# 27. Audit Log Design

Audit logs are administrative records.

Recommended columns:
- Date/Time
- Actor
- Role
- Action
- Module
- Record ID
- Result/Status

Optional:
- IP/device metadata only if necessary, lawful, and actually implemented.

Audit logs should be searchable/filterable but not casually editable.

---

# 28. Analytics and Data Visualization

## Principle
Analytics should summarize actual stored records. Do not imply prediction unless predictive functionality exists.

Recommended analytics:
- occupancy summary,
- application status,
- billing/payment status,
- maintenance frequency,
- property status,
- feedback/report summary.

## Chart palette

Use brand blue first, then accessible supporting hues.

| Series | Hex |
|---|---|
| Primary | `#0355F3` |
| Navy | `#042458` |
| Cyan | `#0891B2` |
| Teal | `#0F766E` |
| Violet | `#7C3AED` |
| Amber | `#B45309` |

Do not assign semantic red/green randomly to neutral categories.

### Chart accessibility
- include legend,
- direct labels where possible,
- distinguish series through line style/marker in addition to color,
- provide table/export equivalent for important data.

---

# 29. Empty, Loading, and Error States

Every data-heavy page must define:

## Empty state
Explain:
- why it is empty,
- what the user can do next.

Example:
> **No maintenance requests yet**  
> New tenant requests will appear here.

## Loading
Use:
- skeleton for content structure,
- spinner for short isolated actions,
- progress indicator for multi-step upload/process.

## Error
Explain:
- what failed,
- whether user data was saved,
- next action.

Avoid:
> “Something went wrong.”

Prefer:
> **Payment proof could not be uploaded.** Your form data is saved. Check your connection and try the upload again.

---

# 30. Notifications

Use notifications for meaningful state changes.

Examples:
- Application submitted
- Application approved/rejected
- Property approved
- Payment awaiting verification
- Payment verified
- Maintenance assigned
- Maintenance completed
- Report resolved

Avoid notification overload for low-value events.

Provide:
- timestamp,
- context,
- action link,
- read/unread state.

---

# 31. Accessibility Standard

Target **WCAG 2.2 AA** for production UI.

Minimum principles:
- Normal text contrast: at least **4.5:1**
- Large text: at least **3:1**
- Interactive/non-text boundaries: target **3:1** where required
- Keyboard-accessible controls
- Visible focus state
- Semantic headings
- Proper labels for inputs
- Error messages associated with their fields
- Do not use color as the only signal
- Touch target: target at least **44 × 44px** for comfortable mobile interaction
- Support browser zoom without layout failure
- Respect reduced-motion preference

---

# 32. Motion

Motion should explain state change, not decorate.

Recommended:
- Hover: 100–150ms
- Dropdown/dialog: 150–200ms
- Page-level transitions: ≤250ms

Use standard easing:
`cubic-bezier(0.2, 0, 0, 1)`

Avoid:
- bouncing buttons,
- continuous logo animation,
- decorative parallax inside operational dashboards.

---

# 33. Responsive Behavior

## Desktop
Optimize for dense operational workflows.

## Tablet
Collapse secondary columns and side navigation where appropriate.

## Mobile
Prioritize:
- status,
- primary task,
- key record information,
- one clear primary action.

Do not simply shrink desktop components.

Forms should normally become single-column on narrow screens.

---

# 34. Content and Microcopy

Use direct, action-oriented labels.

Prefer:
- `Submit Application`
- `Verify Payment`
- `Assign Personnel`
- `Mark as Completed`
- `Review Report`

Avoid:
- `Proceed`
- `Do Action`
- `Process`
- unclear icon-only critical actions.

### Confirmation
Use confirmation only when an action:
- is destructive,
- affects another user,
- changes a verified status,
- or is difficult to reverse.

---

# 35. Data and Privacy UI

Because DOMIKNOW handles rental records:

- show only data relevant to the user's role;
- mask sensitive information where full display is unnecessary;
- clearly label document-review status;
- indicate who can view uploaded records;
- provide logout/session-expiration behavior;
- do not expose administrative identifiers unnecessarily.

---

# 36. Component State Matrix

Every reusable interactive component should support the following where applicable:

| State | Required |
|---|---|
| Default | Yes |
| Hover | Yes on pointer devices |
| Focus-visible | Yes |
| Active/Pressed | Yes |
| Selected | When applicable |
| Disabled | When applicable |
| Loading | For async action |
| Error | For invalid/failed state |
| Success | When persistent confirmation is useful |
| Read-only | For protected data |

---

# 37. Design Token Naming

Recommended convention:

```text
color.brand.navy
color.brand.blue
color.bg.canvas
color.bg.surface
color.text.primary
color.text.secondary
color.border.default
color.action.primary
color.action.primary.hover
color.status.success.text
space.4
radius.md
shadow.modal
font.body.md
```

Use semantic names in components instead of raw color names whenever possible.

Bad:
```css
background: #0355F3;
```

Better:
```css
background: var(--color-action-primary);
```

---

# 38. CSS Token Starter

```css
:root {
  /* Brand */
  --brand-navy: #042458;
  --brand-blue: #0355F3;

  /* Light surfaces */
  --color-bg-canvas: #F8FAFC;
  --color-bg-surface: #FFFFFF;
  --color-bg-subtle: #F1F5F9;

  /* Text */
  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;
  --color-text-muted: #64748B;
  --color-text-brand: #042458;

  /* Border */
  --color-border-default: #DCE3EC;
  --color-border-strong: #CBD5E1;

  /* Action */
  --color-action-primary: #0355F3;
  --color-action-hover: #0247D1;
  --color-action-pressed: #023CB1;
  --color-action-focus: #7EA2FF;

  /* Status */
  --color-success: #166534;
  --color-warning: #92400E;
  --color-error: #991B1B;
  --color-info: #1E40AF;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
}

[data-theme="dark"] {
  --color-bg-canvas: #0B1220;
  --color-bg-surface: #111827;
  --color-bg-subtle: #172033;

  --color-text-primary: #F8FAFC;
  --color-text-secondary: #CBD5E1;
  --color-text-muted: #94A3B8;
  --color-text-brand: #F8FAFC;

  --color-border-default: #263449;
  --color-border-strong: #334155;

  --color-action-primary: #1F6BFF;
  --color-action-hover: #2F75FF;
  --color-action-pressed: #1557D8;
  --color-action-focus: #8AA7FF;
}
```

---

# 39. Suggested Component Inventory

## Foundation
- Logo
- Typography
- Color tokens
- Icons
- Spacing
- Grid
- Elevation

## Inputs
- Text input
- Textarea
- Select
- Search
- Date picker
- Checkbox
- Radio
- Toggle
- File upload
- Price/currency input
- Address/GIS input

## Actions
- Button
- Icon button
- Split action
- Menu

## Navigation
- Topbar
- Sidebar
- Breadcrumb
- Tabs
- Pagination
- Mobile navigation

## Data display
- Card
- Property card
- KPI card
- Table
- Badge
- Avatar
- Tooltip
- Timeline
- Audit-log row
- Rating
- Empty state

## Feedback
- Alert
- Toast
- Inline validation
- Modal
- Confirmation dialog
- Progress indicator
- Skeleton loader

## Domain-specific
- Property map
- Recommendation card
- Rental application stepper
- Payment status panel
- Utility record
- Maintenance task card
- Complaint/report panel
- Document verification panel
- Analytics dashboard
- Notification center

---

# 40. Figma / Design File Structure

Recommended enterprise file structure:

```text
00 — Cover & Governance
01 — Foundations
02 — Color & Themes
03 — Typography
04 — Grid & Spacing
05 — Icons
06 — Components
07 — Patterns
08 — Public Pages
09 — Tenant
10 — Landlord
11 — Maintenance
12 — Admin
13 — Responsive
14 — Prototypes
15 — Archive
```

Component naming:

```text
Button / Primary / Default
Button / Primary / Hover
Input / Text / Error
Badge / Payment / Verified
Card / Property / Default
Nav / Sidebar / Active
Modal / Confirmation / Destructive
```

---

# 41. Enterprise UI/UX Quality Checklist

Before approving a DOMIKNOW screen:

### Visual consistency
- [ ] Uses approved color tokens
- [ ] Uses approved spacing scale
- [ ] Uses approved typography
- [ ] Uses correct component states
- [ ] Avoids unnecessary gradients/effects

### Accessibility
- [ ] Text contrast is sufficient
- [ ] Focus state is visible
- [ ] Controls have accessible labels
- [ ] Color is not the only state indicator
- [ ] Keyboard workflow is possible
- [ ] Mobile touch targets are adequate

### Workflow
- [ ] User knows current status
- [ ] User knows next action
- [ ] Primary action is visually clear
- [ ] Destructive actions require appropriate confirmation
- [ ] Loading/error/empty states exist

### Domain consistency
- [ ] Billing and payment are not conflated
- [ ] Feedback and reports are distinct
- [ ] Recommendation is presented as decision support
- [ ] Utilities do not imply unsupported live integration
- [ ] Audit logs are traceable and protected
- [ ] Role-based information is respected

### Responsive
- [ ] Desktop layout works
- [ ] Tablet layout works
- [ ] Mobile layout prioritizes essential information
- [ ] Tables have a defined small-screen behavior
- [ ] Map/list experience works on mobile

---

# 42. Final DOMIKNOW Visual Standard

The recommended visual language is:

**Light mode**  
Cloud White canvas + Surface White components + Deep Navy hierarchy + Electric Blue actions.

**Dark mode**  
Midnight Canvas + layered slate surfaces + Cloud White text + accessible blue interaction tokens.

**Brand character**  
Modern, trustworthy, structured, technical, and restrained.

**Primary design principle**  
DOMIKNOW should look like an enterprise rental operations system—not a tourism marketplace, gaming dashboard, or decorative real-estate landing page.

**Consistency rule**  
When a component already exists in the design system, reuse it. Do not redesign the same interaction independently for tenant, landlord, maintenance, and administrator modules.

---

## 43. Palette Summary

### Light Mode — Main Four
```text
Cloud White     #F8FAFC
Surface White   #FFFFFF
Deep Navy       #042458
Electric Blue   #0355F3
```

### Dark Mode — Core
```text
Midnight Canvas #0B1220
Navy Slate      #111827
Elevated Slate  #172033
Cloud Text      #F8FAFC
Action Blue     #1F6BFF
Accent Blue     #5B84FF
Slate Border    #263449
```

### Supporting Border
```text
Light Border    #DCE3EC
```

---

**End of DOMIKNOW Design System v1.0**
