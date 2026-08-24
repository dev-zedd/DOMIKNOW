---
title: "DomiKnow Multi-Criteria Property Recommendation — Canonical Computation Specification"
version: "1.0.0"
status: "OFFICIAL WORKING SPECIFICATION"
system: "DomiKnow"
module: "GIS-Enabled Property Discovery and Multi-Criteria Property Recommendation"
objective_alignment: "Specific Objective 2"
method: "Multi-Criteria Decision Analysis (MCDA) using the Weighted Sum Model (WSM)"
last_updated: "2026-08-19"
---

# DomiKnow Multi-Criteria Property Recommendation

## 1. Purpose

This document is the **canonical technical specification** for implementing the Multi-Criteria Property Recommendation component of **DomiKnow**.

It is intended to be used by:

- the system-development team;
- coding agents or AI coding assistants;
- software testers;
- documentation writers; and
- researchers preparing the Chapter III technical description.

The recommendation module is a **transparent decision-support mechanism**. It does **not** automatically choose a rental property for a tenant, approve an application, or make a consequential decision on behalf of a user.

The system must:

1. identify which properties are eligible to be recommended;
2. compute normalized criterion scores;
3. use tenant-defined criterion importance;
4. compute a final Property Suitability Score using the **Weighted Sum Model (WSM)**;
5. rank eligible properties deterministically;
6. explain the score using only actual computed data; and
7. preserve a reproducible snapshot of the recommendation run.

The system must **not** describe the score as an AI prediction, probability, or guaranteed tenant choice.

---

# 2. Research and Design Basis

The current DomiKnow study defines the recommendation component as a **GIS-enabled, multi-criteria, transparent decision-support feature**. Its purpose is to go beyond a basic property filter by combining spatial information, tenant preferences, property characteristics, authenticated feedback, and operational reliability.

The technical approach is based on:

- **Multi-Criteria Decision Analysis (MCDA)** for evaluating alternatives across multiple factors;
- the **Weighted Sum Model (WSM)** for combining normalized criterion scores and criterion weights; and
- GIS-based real-estate recommendation principles where location and property/user information are combined to improve recommendation relevance.

The implementation must remain explainable and reproducible.

### Supporting peer-reviewed studies

1. Troussas et al. (2021) implemented an MCDA-based recommender system using the **Weighted Sum Model** to combine multiple user and content characteristics.
2. Mubarak et al. (2022) demonstrated the relevance of combining **location, user interests, and property information** in a map-based real-estate recommendation system.

These studies support the technical direction, but the exact DomiKnow criteria and formulas in this document are the **project-specific operationalization** of the study requirements.

---

# 3. Canonical Terminology

Use the following terms consistently in code, diagrams, documentation, test cases, and the manuscript.

| Required Term | Meaning |
|---|---|
| **Multi-Criteria Property Recommendation** | The complete recommendation mechanism |
| **Property Suitability Score** | Final weighted score from 0 to 100 |
| **Eligibility Filtering** | Mandatory pre-ranking checks |
| **Tenant Preference Match** | Score for selected non-spatial tenant preferences |
| **Location Suitability** | GIS-derived spatial score |
| **Property Attribute and Amenity Match** | Match score for desired property amenities/features |
| **Authenticated Rating Score** | Adjusted score derived from authenticated ratings |
| **Rental Operations Reliability** | Score derived from maintenance and verified issue-resolution records |
| **Tenant-Defined Criterion Weight** | Normalized importance value derived from the tenant's 0–5 rating |
| **Recommendation Run** | One reproducible execution of the recommendation engine |

### Terms to avoid

Do **not** use the following as official computation terms:

- AI recommendation
- AI match
- trust score
- smart score
- probability of renting
- acceptance probability
- tenant success prediction
- automated property decision

Verification-related information is primarily an **eligibility condition**, not a weighted "trust score."

---

# 4. High-Level Recommendation Flow

The canonical process is:

```text
Tenant Preferences
        ↓
Input Validation
        ↓
Eligibility Filtering
        ↓
Criterion Scoring
        ↓
Tenant Weight Normalization
        ↓
Weighted Sum Model
        ↓
Property Suitability Score
        ↓
Deterministic Ranking
        ↓
Explainable Recommendation Output
        ↓
Recommendation Run Snapshot / Audit Record
```

The five required computation stages are:

1. **Eligibility Filtering**
2. **Criterion Scoring**
3. **Preference Weighting**
4. **Suitability Score Computation**
5. **Ranking and Explanation**

---

# 5. Constants and Numerical Rules

Use the following canonical constants unless a future approved manuscript revision changes them.

```text
SCORE_MIN = 0
SCORE_MAX = 100

RATING_MIN = 1
RATING_MAX = 5
RATING_NEUTRAL = 3.0

WEIGHT_MIN = 0
WEIGHT_MAX = 5

EARTH_RADIUS_KM = 6371.0088

DISPLAY_DECIMAL_PLACES = 2
FLOAT_EPSILON = 1e-9

FORMULA_VERSION = "MC-REC-v1.0"
```

## Numerical requirements

- All internal computations must use floating-point precision sufficient for at least 6 decimal places.
- Do **not** round individual criterion scores before the final weighted sum.
- Ranking must use the **unrounded** final score.
- Displayed scores must be rounded to **2 decimal places**.
- Every score must be clamped to `[0, 100]`.
- Every normalized criterion weight must be in `[0, 1]`.
- Active normalized weights must sum to `1.0`, allowing a floating-point tolerance of `1e-9`.

---

# 6. Required Data

## 6.1 Tenant Recommendation Profile

A recommendation run may use the following tenant inputs.

```yaml
tenant_id: string

reference_location:
  latitude: number | null
  longitude: number | null

distance:
  ideal_distance_km: number | null
  maximum_distance_km: number | null
  maximum_distance_is_required: boolean

budget:
  comfortable_monthly_budget: number | null
  hard_maximum_monthly_budget: number | null

preferred_property_types:
  values: string[]
  required: boolean

occupant_count: integer

desired_amenities: string[]
required_amenities: string[]

soft_policy_preferences:
  - key: string
    desired_value: any

required_policy_preferences:
  - key: string
    required_value: any

criterion_importance:
  tenant_preference_match: integer      # 0..5
  location_suitability: integer         # 0..5
  amenity_match: integer                # 0..5
  authenticated_rating: integer         # 0..5
  operations_reliability: integer       # 0..5
```

## 6.2 Property Data

Every property considered for recommendation must provide or derive:

```yaml
property_id: string
landlord_id: string

status:
  property_active: boolean
  property_approved: boolean
  landlord_verified: boolean
  suspended: boolean
  long_term_residential_eligible: boolean

documents:
  required_documents_complete: boolean
  required_documents_valid: boolean

availability:
  available_units: integer

location:
  latitude: number
  longitude: number

rental:
  monthly_rent: number
  property_type: string
  maximum_occupants: integer

amenities: string[]

policies:
  key_value_pairs: object

ratings:
  valid_authenticated_review_count: integer
  valid_authenticated_star_sum: number

operations:
  valid_maintenance_request_count: integer
  completed_maintenance_request_count: integer
  timely_completed_maintenance_request_count: integer
  verified_issue_count: integer
  resolved_verified_issue_count: integer

verification:
  last_verified_at: timestamp
```

---

# 7. Eligibility Filtering

Eligibility filtering occurs **before scoring**.

A property that fails an eligibility requirement receives **no Property Suitability Score**.

It must be excluded from the ranked recommendation list.

## 7.1 Base Eligibility Conditions

A property is eligible only if all of the following are true:

```text
property_active == true
property_approved == true
landlord_verified == true
suspended == false
long_term_residential_eligible == true
required_documents_complete == true
required_documents_valid == true
available_units > 0
```

## 7.2 Occupancy Capacity

If:

```text
property.maximum_occupants < tenant.occupant_count
```

then the property is **ineligible**.

Reason code:

```text
OCCUPANCY_CAPACITY_NOT_MET
```

## 7.3 Required Amenities

Every item in:

```text
tenant.required_amenities
```

must exist in:

```text
property.amenities
```

If at least one required amenity is absent, exclude the property.

Reason code:

```text
REQUIRED_AMENITY_NOT_MET
```

## 7.4 Required Property Type

If:

```text
preferred_property_types.required == true
```

then:

```text
property.property_type
```

must be present in:

```text
preferred_property_types.values
```

Otherwise exclude.

Reason code:

```text
REQUIRED_PROPERTY_TYPE_NOT_MET
```

## 7.5 Hard Maximum Budget

If a hard maximum monthly budget is supplied:

```text
hard_maximum_monthly_budget != null
```

and:

```text
property.monthly_rent > hard_maximum_monthly_budget
```

the property is excluded.

Reason code:

```text
HARD_BUDGET_LIMIT_EXCEEDED
```

## 7.6 Required Maximum Distance

If the tenant declares the maximum distance as mandatory:

```text
maximum_distance_is_required == true
```

and:

```text
distance_km > maximum_distance_km
```

the property is excluded.

Reason code:

```text
MAXIMUM_DISTANCE_EXCEEDED
```

## 7.7 Required Policy Preferences

Every required policy preference must match the property's stored policy value.

If any required policy does not match:

```text
REQUIRED_POLICY_NOT_MET
```

## 7.8 Incomplete Recommendation Data

A property must contain the data necessary to compute every active non-historical criterion.

Examples:

- missing coordinates while Location Suitability is active;
- missing monthly rent while budget matching is active;
- missing amenity information while Amenity Match is active.

Do **not** reward missing data by redistributing weights on a property-by-property basis.

If required computational data are unexpectedly missing, exclude the property from that recommendation run and record:

```text
INCOMPLETE_RECOMMENDATION_DATA
```

Historical rating and reliability data are handled through neutral/global priors and therefore do not require exclusion.

---

# 8. Criterion Overview

Eligible properties are scored on up to five criteria.

| Code | Criterion | Range |
|---|---|---:|
| C1 | Tenant Preference Match (`PM`) | 0–100 |
| C2 | Location Suitability (`L`) | 0–100 |
| C3 | Property Attribute and Amenity Match (`A`) | 0–100 |
| C4 | Authenticated Rating Score (`R*`) | 0–100 |
| C5 | Rental Operations Reliability (`RR`) | 0–100 |

A criterion is **active** only when:

1. the tenant assigns it an importance value greater than `0`; and
2. its required tenant-side configuration is available.

Historical criteria C4 and C5 can remain active even when a specific property has no history because neutral/global priors are used.

---

# 9. Criterion 1 — Tenant Preference Match

## 9.1 Definition

Tenant Preference Match evaluates selected **non-spatial, non-amenity** tenant preferences.

It may contain the following active subcomponents:

- Monthly Price Suitability
- Preferred Property Type Match
- Soft Policy Preference Match
- other future approved standardized soft preferences

Mandatory preferences are handled during **Eligibility Filtering** and must not be double-counted as ranking advantages unless explicitly configured as soft preferences.

## 9.2 Monthly Price Suitability

Let:

- `r_i` = monthly rent of property `i`
- `B_pref` = tenant's comfortable monthly budget
- `B_max` = tenant's hard maximum monthly budget

### Case A — Comfortable budget and hard maximum are both provided

Validation:

```text
B_pref > 0
B_max >= B_pref
```

Score:

```math
PS_i =
\begin{cases}
100, & r_i \leq B_{pref} \\
100 \left(\frac{B_{max}-r_i}{B_{max}-B_{pref}}\right),
& B_{pref} < r_i < B_{max} \\
0, & r_i \geq B_{max}
\end{cases}
```

A property above `B_max` should already have been removed during eligibility filtering.

### Case B — Only hard maximum is provided

```math
PS_i =
\begin{cases}
100, & r_i \leq B_{max} \\
0, & r_i > B_{max}
\end{cases}
```

Again, a property above the hard maximum is excluded before scoring.

### Case C — No budget preference

Price Suitability is **inactive** inside C1.

## 9.3 Preferred Property Type Match

When preferred property types are configured as **soft preferences**:

```math
PT_i =
\begin{cases}
100, & type_i \in PreferredTypes \\
0, & otherwise
\end{cases}
```

When property type is marked as required, it is an eligibility condition instead.

## 9.4 Soft Policy Preference Match

Let:

- `P` = number of active soft policy preferences
- `matched_i` = number of those preferences matched by property `i`

If `P > 0`:

```math
POL_i = 100 \left(\frac{matched_i}{P}\right)
```

If `P = 0`, this subcomponent is inactive.

## 9.5 Final Tenant Preference Match

Let `S_i` be the set of active C1 subcomponent scores for property `i`.

```math
PM_i = \frac{\sum_{s \in S_i}s}{|S_i|}
```

If there are no active C1 subcomponents, C1 is inactive and must not receive a weight.

### Example

```text
Price Suitability = 75
Property Type Match = 100
Soft Policy Match = 75

PM = (75 + 100 + 75) / 3
PM = 83.333333
```

---

# 10. Criterion 2 — Location Suitability

## 10.1 Canonical Distance Method

The ranking engine must use **geodesic straight-line distance** calculated from latitude and longitude using the **Haversine formula**.

Do not mix straight-line distance and road-network/travel-time distance within the same formula version.

If a routing provider is introduced in a future approved system version, it must use a new formula version.

## 10.2 Haversine Distance

Let:

- `lat1`, `lon1` = tenant reference coordinates
- `lat2`, `lon2` = property coordinates
- `R = 6371.0088 km`
- angles expressed in radians

```math
\Delta\phi = \phi_2 - \phi_1
```

```math
\Delta\lambda = \lambda_2 - \lambda_1
```

```math
a =
\sin^2\left(\frac{\Delta\phi}{2}\right)
+
\cos(\phi_1)\cos(\phi_2)
\sin^2\left(\frac{\Delta\lambda}{2}\right)
```

```math
c = 2\arctan2(\sqrt{a},\sqrt{1-a})
```

```math
d_i = Rc
```

## 10.3 Location Score

Let:

- `d_i` = Haversine distance in kilometers
- `D_ideal` = tenant's ideal distance
- `D_max` = tenant's maximum acceptable distance

Validation:

```text
D_ideal >= 0
D_max > 0
D_ideal < D_max
```

Score:

```math
L_i =
\begin{cases}
100, & d_i \leq D_{ideal} \\
100\left(\frac{D_{max}-d_i}{D_{max}-D_{ideal}}\right),
& D_{ideal} < d_i < D_{max} \\
0, & d_i \geq D_{max}
\end{cases}
```

If `maximum_distance_is_required == true`, a property beyond `D_max` is excluded instead of merely receiving `0`.

### If ideal distance is omitted

Set:

```text
D_ideal = 0
```

This produces a linear decay from the tenant's reference point to `D_max`.

---

# 11. Criterion 3 — Property Attribute and Amenity Match

## 11.1 Definition

This criterion measures the percentage of the tenant's **desired, non-mandatory** amenities/features that are present in the property.

Required amenities are already handled by eligibility filtering.

Let:

- `A_total` = number of desired amenities selected by the tenant
- `A_match_i` = number of desired amenities available in property `i`

If `A_total > 0`:

```math
A_i =
100\left(\frac{A_{match_i}}{A_{total}}\right)
```

If `A_total = 0`, C3 is inactive.

### Example

Tenant desires:

```text
Wi-Fi
Parking
CCTV
Private bathroom
Kitchen access
Air conditioning
```

Property provides 5 of 6:

```math
A_i = 100(5/6) = 83.333333
```

---

# 12. Criterion 4 — Authenticated Rating Score

## 12.1 Authentication Rule

A rating is valid for recommendation only when:

- the reviewer is an authenticated tenant;
- the reviewer has or had an approved rental/occupancy record linked to the property;
- the rating is not deleted, invalidated, or administratively rejected;
- one effective rating record is used per tenant-rental relationship according to the finalized rating policy.

Ratings without a verified rental relationship must not affect recommendation computation.

## 12.2 Why an Adjusted Rating Is Required

A raw average can overvalue a property with very few reviews.

Example:

```text
Property A = 5.0 stars from 1 rating
Property B = 4.8 stars from 30 ratings
```

The algorithm therefore uses a shrinkage/adjusted rating so that properties with limited rating evidence are pulled toward the platform-wide rating mean.

## 12.3 Platform Rating Prior

At recommendation-run time calculate:

### Global Mean Rating

```math
C =
\frac{\text{sum of all valid authenticated stars}}
{\text{number of all valid authenticated ratings}}
```

If no authenticated ratings exist anywhere in the platform:

```text
C = 3.0
```

### Rating-Count Prior

Let:

```text
m = median valid authenticated rating count
    among active approved properties having at least 1 valid rating
```

If no rated property exists:

```text
m = 1
```

Always enforce:

```text
m >= 1
```

The values of `C` and `m` used in a recommendation run must be stored in the run snapshot.

## 12.4 Property Adjusted Rating

Let:

- `R_i` = raw mean authenticated rating for property `i`
- `v_i` = valid authenticated rating count
- `C` = global mean rating
- `m` = rating-count prior

When `v_i > 0`:

```math
AR_i =
\left(\frac{v_i}{v_i+m}\right)R_i
+
\left(\frac{m}{v_i+m}\right)C
```

When `v_i = 0`:

```math
AR_i = C
```

## 12.5 Normalize 1–5 Stars to 0–100

```math
R_i^* =
100\left(\frac{AR_i-1}{4}\right)
```

Clamp:

```text
R_i* = clamp(R_i*, 0, 100)
```

## 12.6 Rating History Disclosure

If `v_i == 0`, display:

```text
No authenticated rating history yet
```

If `v_i > 0`, display the count.

Never imply that the prior-adjusted score represents more reviews than actually exist.

---

# 13. Criterion 5 — Rental Operations Reliability

## 13.1 Definition

**Rental Operations Reliability** is the documented consistency with which operational concerns associated with a rental property are handled through DomiKnow.

It is based only on system-recorded, valid events.

It does not infer personality, legal character, or generalized landlord trustworthiness.

## 13.2 Reliability Components

Three submetrics are used.

### A. Maintenance Completion Rate

Let:

- `VM_i` = total valid maintenance requests
- `CM_i` = completed valid maintenance requests

When `VM_i > 0`:

```math
MCR_i = \frac{CM_i}{VM_i}
```

### B. Timely Maintenance Completion Rate

A maintenance task is timely when:

```text
completed_at <= due_at
```

The `due_at` value must be established when the maintenance request is accepted/assigned and changes must be audit logged.

Let:

- `CM_i` = completed valid maintenance requests
- `TM_i` = completed valid maintenance requests completed on or before `due_at`

When `CM_i > 0`:

```math
TMR_i = \frac{TM_i}{CM_i}
```

### C. Verified Issue Resolution Rate

Only reports/complaints verified as legitimate within the platform are included.

Let:

- `VI_i` = total verified issues/reports
- `RI_i` = resolved verified issues/reports

When `VI_i > 0`:

```math
IRR_i = \frac{RI_i}{VI_i}
```

## 13.3 Missing-History Priors

A property must not automatically receive `0` or `100` because it has no historical records.

For each reliability component, compute a platform-wide fallback rate from properties that have valid data for that component.

Example:

```math
GlobalMCR =
\frac{\sum CompletedValidMaintenance}
{\sum ValidMaintenance}
```

Equivalent formulas apply to `GlobalTMR` and `GlobalIRR`.

If the platform has no valid data for a component, use the neutral fallback:

```text
0.50
```

Therefore:

```text
MCR_i = property MCR if denominator > 0
        otherwise GlobalMCR
        otherwise 0.50

TMR_i = property TMR if denominator > 0
        otherwise GlobalTMR
        otherwise 0.50

IRR_i = property IRR if denominator > 0
        otherwise GlobalIRR
        otherwise 0.50
```

Record which components used fallback values.

## 13.4 Final Reliability Score

```math
RR_i =
100\left(
\frac{MCR_i + TMR_i + IRR_i}{3}
\right)
```

The three reliability components receive equal internal contribution in version `MC-REC-v1.0`.

Do not assign unsupported arbitrary internal percentages.

## 13.5 Reliability Disclosure

If any reliability component uses a fallback, show:

```text
Limited operational history
```

If all three components use property-specific data, show the actual relevant event counts.

---

# 14. Tenant-Defined Criterion Importance

## 14.1 Importance Scale

The tenant assigns an importance value to each active recommendation criterion.

| Raw Value | Meaning |
|---:|---|
| 5 | Very High |
| 4 | High |
| 3 | Moderate |
| 2 | Low |
| 1 | Very Low |
| 0 | Not Considered |

The raw values are **not percentages**.

## 14.2 Active Criteria

A criterion is active if:

```text
raw_importance > 0
```

and its required tenant configuration exists.

Examples:

- C2 cannot be active without a valid reference location and `D_max`.
- C3 cannot be active if no desired amenities are selected.
- C1 cannot be active if no soft preference subcomponent is configured.

The UI should disable or explain unavailable criterion controls.

## 14.3 Weight Normalization

Let:

- `q_j` = tenant-assigned raw importance for criterion `j`
- `J` = set of active criteria

Then:

```math
w_j =
\frac{q_j}
{\sum_{k \in J}q_k}
```

Required property:

```math
\sum_{j \in J} w_j = 1
```

If the sum of active raw importance values is `0`, do not compute recommendations.

Return:

```text
NO_ACTIVE_RECOMMENDATION_CRITERIA
```

The frontend should normally initialize usable criteria to `3 = Moderate`, but the backend must still enforce this validation.

---

# 15. Final Property Suitability Score

For property `i`, let the active criterion scores be:

- `PM_i`
- `L_i`
- `A_i`
- `R_i*`
- `RR_i`

and normalized tenant-defined weights:

- `w1`
- `w2`
- `w3`
- `w4`
- `w5`

The canonical Weighted Sum Model is:

```math
S_i =
w_1PM_i
+
w_2L_i
+
w_3A_i
+
w_4R_i^*
+
w_5RR_i
```

Only active criteria appear in the sum.

Because:

```math
0 \leq criterion \leq 100
```

and:

```math
\sum w_j = 1
```

then:

```math
0 \leq S_i \leq 100
```

## 15.1 Interpretation

`S_i` is a **Property Suitability Score**.

It is **not**:

- a probability;
- a prediction that the tenant will rent the property;
- a probability of application approval;
- a quality certification; or
- an AI confidence score.

Correct display:

```text
Property Suitability Score: 84.68 / 100
```

Incorrect display:

```text
84.68% chance you will rent this property
```

---

# 16. Ranking

Eligible properties must be sorted by:

```text
1. final_raw_suitability_score DESC
```

The raw unrounded score is used for ranking.

## 16.1 Deterministic Tie-Breaking

If final scores are equal within:

```text
FLOAT_EPSILON = 1e-9
```

apply the following tie-break order:

1. higher `Tenant Preference Match`
2. higher `Location Suitability`
3. higher `Amenity Match`
4. higher `Authenticated Rating Score`
5. higher `Rental Operations Reliability`
6. more recent `last_verified_at`
7. lexicographically smaller `property_id`

This guarantees deterministic results.

---

# 17. Explanation Generation

The explanation must be **template-based and data-grounded**.

Do not ask a language model to invent reasons for the ranking.

## 17.1 Weighted Contribution

For each active criterion:

```math
Contribution_{ij} = w_j \times Score_{ij}
```

Sort criterion contributions descending.

The top contributing criteria may be shown as the principal reasons for the ranking.

## 17.2 Required Explanation Data

The UI should be able to display:

```yaml
property_suitability_score: 84.68

criterion_breakdown:
  tenant_preference_match:
    score: 87.50
    weight: 0.25
    weighted_contribution: 21.875

  location_suitability:
    score: 80.00
    weight: 0.25
    weighted_contribution: 20.000

  amenity_match:
    score: 83.33
    weight: 0.20
    weighted_contribution: 16.667

  authenticated_rating:
    score: 86.92
    weight: 0.15
    weighted_contribution: 13.038

  operations_reliability:
    score: 87.33
    weight: 0.15
    weighted_contribution: 13.100
```

## 17.3 Example User-Facing Explanation

```text
Suitability Score: 84.68 / 100

Why this property ranked highly:
• Strong match with your selected rental preferences.
• Located within your preferred distance range.
• Matches 5 of your 6 desired amenities.
• Authenticated rating history contributed positively to the score.
• Available operational records indicate generally completed maintenance and issue handling.

Verification:
• Property approved
• Landlord verified
• Required property records valid
```

The explanation must only mention facts present in the score breakdown or eligibility record.

---

# 18. Canonical Worked Example

## 18.1 Tenant Configuration

Assume the following active criterion importance values:

```text
C1 Tenant Preference Match = 5
C2 Location Suitability = 5
C3 Amenity Match = 4
C4 Authenticated Rating = 3
C5 Operations Reliability = 3
```

Total raw importance:

```text
5 + 5 + 4 + 3 + 3 = 20
```

Normalized weights:

```text
w1 = 5/20 = 0.25
w2 = 5/20 = 0.25
w3 = 4/20 = 0.20
w4 = 3/20 = 0.15
w5 = 3/20 = 0.15
```

## 18.2 Tenant Preference Match

Assume the active C1 subcomponents produce:

```text
Price Suitability = 75
Property Type Match = 100
Soft Policy Match = 87.5
```

Then:

```math
PM =
\frac{75 + 100 + 87.5}{3}
=
87.5
```

## 18.3 Location Suitability

Assume:

```text
d = 1.8 km
D_ideal = 1.0 km
D_max = 5.0 km
```

Because:

```text
1.0 < 1.8 < 5.0
```

then:

```math
L =
100\left(\frac{5.0-1.8}{5.0-1.0}\right)
=
80
```

## 18.4 Amenity Match

Assume:

```text
Desired amenities = 6
Matched amenities = 5
```

Then:

```math
A =
100(5/6)
=
83.333333
```

## 18.5 Authenticated Rating

Assume:

```text
Property raw mean rating R = 4.6
Property valid rating count v = 18
Platform mean rating C = 4.2
Median rating-count prior m = 8
```

Adjusted rating:

```math
AR =
\left(\frac{18}{26}\right)(4.6)
+
\left(\frac{8}{26}\right)(4.2)
=
4.476923
```

Normalized:

```math
R^* =
100\left(\frac{4.476923-1}{4}\right)
=
86.923077
```

## 18.6 Rental Operations Reliability

Assume:

```text
MCR = 0.92
TMR = 0.80
IRR = 0.90
```

Then:

```math
RR =
100\left(\frac{0.92+0.80+0.90}{3}\right)
=
87.333333
```

## 18.7 Final Suitability

```math
S =
(0.25)(87.5)
+
(0.25)(80)
+
(0.20)(83.333333)
+
(0.15)(86.923077)
+
(0.15)(87.333333)
```

```math
S = 84.680128
```

Display:

```text
Property Suitability Score = 84.68 / 100
```

Ranking uses:

```text
84.680128...
```

not the rounded `84.68`.

---

# 19. Recommendation Run Snapshot

For reproducibility, every generated recommendation result should have a stored snapshot.

Recommended structure:

```yaml
recommendation_run:
  run_id: uuid
  formula_version: "MC-REC-v1.0"
  tenant_id: string
  generated_at: timestamp

  tenant_input_snapshot:
    # copy of relevant preference inputs

  active_criteria:
    - C1
    - C2
    - C3
    - C4
    - C5

  raw_importance:
    C1: 5
    C2: 5
    C3: 4
    C4: 3
    C5: 3

  normalized_weights:
    C1: 0.25
    C2: 0.25
    C3: 0.20
    C4: 0.15
    C5: 0.15

  platform_priors:
    rating_global_mean: 4.2
    rating_count_median: 8
    global_mcr: 0.81
    global_tmr: 0.74
    global_irr: 0.79

  candidate_count: integer
  eligible_count: integer
  excluded_count: integer

  results:
    - property_id: string
      rank: 1
      eligibility_passed: true
      raw_score: 84.6801282051
      display_score: 84.68
      criterion_scores:
        PM: 87.5
        L: 80.0
        A: 83.333333
        R: 86.923077
        RR: 87.333333
      fallback_flags:
        rating_prior_used: false
        mcr_prior_used: false
        tmr_prior_used: false
        irr_prior_used: false
```

Excluded properties should also record reason codes where appropriate.

---

# 20. Language-Agnostic Reference Algorithm

```text
function recommendProperties(tenantProfile, properties, platformData, now):

    validateTenantProfile(tenantProfile)

    ratingPrior = computeRatingPrior(platformData)
    reliabilityPriors = computeReliabilityPriors(platformData)

    activeCriteria = determineActiveCriteria(tenantProfile)

    if activeCriteria is empty:
        throw NO_ACTIVE_RECOMMENDATION_CRITERIA

    weights = normalizeWeights(
        tenantProfile.criterionImportance,
        activeCriteria
    )

    candidates = []

    for property in properties:

        eligibility = evaluateEligibility(
            tenantProfile,
            property
        )

        if eligibility.failed:
            recordExclusion(property.id, eligibility.reasonCodes)
            continue

        scores = {}

        if C1 active:
            scores.PM = computeTenantPreferenceMatch(
                tenantProfile,
                property
            )

        if C2 active:
            distance = haversineDistance(
                tenantProfile.referenceLocation,
                property.location
            )

            scores.L = computeLocationSuitability(
                distance,
                tenantProfile.idealDistance,
                tenantProfile.maximumDistance
            )

        if C3 active:
            scores.A = computeAmenityMatch(
                tenantProfile.desiredAmenities,
                property.amenities
            )

        if C4 active:
            scores.R = computeAuthenticatedRatingScore(
                property,
                ratingPrior
            )

        if C5 active:
            scores.RR = computeRentalOperationsReliability(
                property,
                reliabilityPriors
            )

        assert every score in [0,100]

        rawScore = 0

        for criterion in activeCriteria:
            rawScore += weights[criterion] * scores[criterion]

        rawScore = clamp(rawScore, 0, 100)

        explanationData = buildExplanationData(
            property,
            scores,
            weights,
            eligibility
        )

        candidates.append({
            property,
            scores,
            weights,
            rawScore,
            explanationData
        })

    sort candidates using canonical comparator

    assign ranks starting at 1

    persistRecommendationRunSnapshot(...)

    return candidates
```

---

# 21. TypeScript-Oriented Function Contracts

The coding agent may implement equivalent functions.

```ts
type Score = number; // runtime-enforced 0..100

type CriterionCode = "C1" | "C2" | "C3" | "C4" | "C5";

interface CriterionWeights {
  C1?: number;
  C2?: number;
  C3?: number;
  C4?: number;
  C5?: number;
}

interface CriterionScores {
  C1?: Score;
  C2?: Score;
  C3?: Score;
  C4?: Score;
  C5?: Score;
}

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number;

function computeLocationSuitability(
  distanceKm: number,
  idealDistanceKm: number,
  maxDistanceKm: number
): Score;

function computeTenantPreferenceMatch(
  tenant: TenantRecommendationProfile,
  property: PropertyRecommendationRecord
): Score | null;

function computeAmenityMatch(
  desiredAmenities: string[],
  propertyAmenities: string[]
): Score | null;

function computeAuthenticatedRatingScore(
  propertyMean: number | null,
  reviewCount: number,
  globalMean: number,
  ratingCountPrior: number
): Score;

function computeRentalOperationsReliability(
  propertyOps: PropertyOperationsMetrics,
  platformPriors: ReliabilityPriors
): ReliabilityResult;

function normalizeCriterionWeights(
  rawImportance: Record<CriterionCode, number>,
  activeCriteria: CriterionCode[]
): CriterionWeights;

function computeSuitabilityScore(
  scores: CriterionScores,
  weights: CriterionWeights
): Score;
```

---

# 22. Validation Rules

## 22.1 Tenant Inputs

Reject invalid input when:

```text
latitude outside [-90, 90]
longitude outside [-180, 180]
ideal_distance_km < 0
maximum_distance_km <= 0
ideal_distance_km >= maximum_distance_km
comfortable_budget <= 0 when provided
hard_maximum_budget <= 0 when provided
comfortable_budget > hard_maximum_budget
occupant_count <= 0
criterion importance outside 0..5
sum of active criterion importance == 0
```

## 22.2 Property Inputs

A scored property must satisfy:

```text
valid latitude and longitude when C2 active
monthly_rent > 0 when price preference is active
maximum_occupants > 0
available_units > 0
review stars only in [1,5]
review count >= 0
maintenance counts >= 0
completed maintenance <= valid maintenance
timely completed maintenance <= completed maintenance
resolved verified issues <= verified issues
```

Invalid system data must be logged.

Do not silently coerce logically impossible counts.

---

# 23. Required Test Cases

At minimum, implement the following automated tests.

| ID | Test | Required Result |
|---|---|---|
| REC-001 | Unverified landlord | Property excluded |
| REC-002 | Unapproved property | Property excluded |
| REC-003 | Suspended property | Property excluded |
| REC-004 | No available unit | Property excluded |
| REC-005 | Occupancy exceeds capacity | Property excluded |
| REC-006 | Required amenity missing | Property excluded |
| REC-007 | Hard budget exceeded | Property excluded |
| REC-008 | Required max distance exceeded | Property excluded |
| REC-009 | Haversine known-coordinate test | Distance within tolerance |
| REC-010 | Inside ideal distance | Location score = 100 |
| REC-011 | At maximum distance | Location score = 0 |
| REC-012 | Mid-range distance | Piecewise score correct |
| REC-013 | All desired amenities matched | Amenity score = 100 |
| REC-014 | No desired amenities | C3 inactive |
| REC-015 | Property with no ratings | Rating uses global prior |
| REC-016 | Property with ratings | Adjusted rating matches manual computation |
| REC-017 | No platform ratings | C = 3.0, m = 1 |
| REC-018 | No property maintenance history | Reliability uses platform/neutral priors |
| REC-019 | Complete operational history | RR matches manual computation |
| REC-020 | Weight normalization | Active weights total 1 |
| REC-021 | All criterion importance = 0 | Validation error |
| REC-022 | Final WSM calculation | Matches manual result |
| REC-023 | Ranking | Descending raw score |
| REC-024 | Exact tie | Canonical tie-break applied |
| REC-025 | Explanation | Uses only actual computed factors |
| REC-026 | Incomplete coordinates with C2 active | Property excluded/logged |
| REC-027 | Re-run same snapshot and priors | Same score and rank |
| REC-028 | Display rounding | Raw score preserved, display has 2 decimals |

---

# 24. Canonical Unit Test Vector

The following test vector must reproduce approximately:

```text
PM = 87.500000
L = 80.000000
A = 83.333333
R = 86.923077
RR = 87.333333

weights:
C1 = 0.25
C2 = 0.25
C3 = 0.20
C4 = 0.15
C5 = 0.15

raw final score ≈ 84.6801282051
display score = 84.68
```

Accepted floating-point tolerance:

```text
± 0.000001
```

---

# 25. Security, Fairness, and Responsible Use

The recommendation mechanism must not use protected or irrelevant personal characteristics to rank properties.

Do not use fields such as:

- sex;
- gender;
- religion;
- ethnicity;
- disability;
- political belief;
- unrelated health information; or
- other characteristics unrelated to legitimate property suitability requirements.

The property-recommendation engine must recommend **properties to tenants**, not rank tenants by protected personal traits.

Tenant Screening Decision Support is a separate module and must not be mixed into this property recommendation score.

---

# 26. Separation from Tenant Screening Decision Support

The following distinction is mandatory.

## Property Recommendation

```text
Tenant → system evaluates eligible properties → ranked property alternatives
```

## Tenant Screening Decision Support

```text
Landlord → system organizes relevant applicant information → landlord reviews applicant
```

Do not reuse a tenant-screening result as a property recommendation criterion.

Do not let landlord preferences secretly change a tenant's suitability score.

---

# 27. Separation from GIS Property Discovery

GIS Property Discovery and Multi-Criteria Property Recommendation are related but separate.

## GIS Property Discovery

Answers:

```text
Where are available rental properties located?
```

May include:

- map markers;
- location search;
- area filters;
- property browsing.

## Multi-Criteria Property Recommendation

Answers:

```text
Among eligible properties, which options best match this tenant's stated priorities?
```

It uses GIS distance as only **one** criterion.

A property can appear in GIS discovery without necessarily appearing in the personalized recommendation list if it fails recommendation eligibility or mandatory tenant requirements.

---

# 28. Database / Audit Recommendations

Recommended tables or equivalent structures:

```text
tenant_recommendation_profile
tenant_recommendation_preference
recommendation_run
recommendation_run_weight
recommendation_candidate
recommendation_score_breakdown
recommendation_exclusion
property_authenticated_rating
property_operations_metrics
```

A recommendation result should remain reproducible even if property records later change.

Therefore, snapshot the values used at computation time rather than storing only a pointer to mutable live records.

---

# 29. Versioning Rule

Any change to one of the following requires a new `FORMULA_VERSION`:

- eligibility conditions;
- scoring formula;
- scoring range;
- location distance method;
- rating prior method;
- reliability formula;
- criterion set;
- weight normalization;
- tie-break order.

Example:

```text
MC-REC-v1.0
MC-REC-v1.1
MC-REC-v2.0
```

Historical recommendation runs must retain their original formula version.

---

# 30. Agent Implementation Rules

A coding agent implementing this specification MUST follow these rules:

1. **Do not invent new criterion weights.**
2. **Do not hard-code researcher-defined percentages** such as 30% location or 20% rating.
3. Criterion importance comes from the tenant's 0–5 values and is normalized.
4. **Do not calculate a "trust score."**
5. Verification is primarily an eligibility gate.
6. Do not include an unverified, inactive, suspended, unavailable, or out-of-scope property.
7. Do not call the recommendation result a probability.
8. Do not use an LLM-generated score.
9. Do not allow an LLM to change mathematical outputs.
10. Explanation text must be derived from the exact score breakdown.
11. Preserve full-precision scores internally.
12. Use 2 decimal places only for display.
13. Use the Haversine distance method for `MC-REC-v1.0`.
14. Do not mix road distance and Haversine distance.
15. Historical missing data must use the defined priors; it must not automatically become 0 or 100.
16. Missing required non-historical property data must cause exclusion/logging.
17. All scoring and prior inputs must be snapshot for reproducibility.
18. All formula changes must update the formula version.
19. Every formula must have unit tests.
20. The recommendation remains advisory; the tenant retains final property choice.

---

# 31. Acceptance Criteria for the Module

The module is implementation-ready only when:

- [ ] eligibility filtering is implemented;
- [ ] Haversine distance is tested;
- [ ] C1 Tenant Preference Match is tested;
- [ ] C2 Location Suitability is tested;
- [ ] C3 Amenity Match is tested;
- [ ] C4 Authenticated Rating is tested;
- [ ] C5 Operations Reliability is tested;
- [ ] tenant raw importance is normalized;
- [ ] final WSM score is tested against manual calculations;
- [ ] deterministic tie-breaking is implemented;
- [ ] explanation output uses actual criterion values;
- [ ] historical priors are reproducible;
- [ ] formula version is stored;
- [ ] recommendation-run snapshots are stored;
- [ ] excluded-property reason codes are stored;
- [ ] no prohibited personal attributes affect scores;
- [ ] frontend does not describe suitability as probability;
- [ ] integration tests cover GIS discovery → recommendation → property details;
- [ ] the final Chapter III description matches the implemented algorithm.

---

# 32. Manuscript-Ready Summary

The following concise paragraph may be used as the technical summary in Chapter III:

> The Multi-Criteria Property Recommendation component of DomiKnow will use a transparent Multi-Criteria Decision Analysis approach based on the Weighted Sum Model. Before scoring, the system will apply eligibility conditions involving property and landlord verification, document validity, availability, long-term residential eligibility, and mandatory tenant requirements. Eligible properties will be evaluated using normalized criteria for Tenant Preference Match, Location Suitability, Property Attribute and Amenity Match, Authenticated Rating Score, and Rental Operations Reliability. Tenants will assign the relative importance of the active criteria using a 0–5 scale, and the values will be normalized into weights whose sum equals one. The final Property Suitability Score will be computed as the weighted sum of the active criterion scores and will range from 0 to 100. Properties will be ranked in descending order of their unrounded Suitability Scores, while the interface will present a rounded score and an explanation based only on the actual criterion results. The score represents relative property suitability and will not be interpreted as a probability of tenant selection. Final property selection, reservation, and application decisions remain with the tenant.

---

# 33. References

Troussas, C., Krouska, A., & Sgouropoulou, C. (2021). Enhancing human-computer interaction in digital repositories through a MCDA-based recommender system. *Advances in Human-Computer Interaction, 2021*, 7213246. https://doi.org/10.1155/2021/7213246

Mubarak, M., Tahir, A., Waqar, F., Haneef, I., McArdle, G., Bertolotto, M., & Saeed, M. T. (2022). A map-based recommendation system and house price prediction model for real estate. *ISPRS International Journal of Geo-Information, 11*(3), 178. https://doi.org/10.3390/ijgi11030178

---

# 34. Final Canonical Formula

For implementation reference:

```math
S_i =
w_1PM_i +
w_2L_i +
w_3A_i +
w_4R_i^* +
w_5RR_i
```

subject to:

```math
0 \leq PM_i,L_i,A_i,R_i^*,RR_i \leq 100
```

```math
w_j \geq 0
```

```math
\sum_j w_j = 1
```

and only after the property passes all applicable eligibility checks.

**Canonical implementation sequence:**

```text
ELIGIBILITY
→ SCORE C1–C5
→ NORMALIZE TENANT WEIGHTS
→ WSM
→ RANK
→ EXPLAIN
→ SNAPSHOT
```
