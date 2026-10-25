# DOMIKNOW DATABASE DATA DICTIONARY
**Standard Table Format:** Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship

## 1. User Authentication & Identity Management

### `users`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `full_name` | `varchar(255)` | text | 255 | Full legal name of the user | `Juan Dela Cruz` | - |
| `email` | `varchar(255)` | email | 255 | Unique email address for authentication | `juan.delacruz@gmail.com` | - |
| `password_hash` | `varchar(255)` | hashed password | 255 | Bcrypt hashed password | `$2a$12$K8yR2uK4...` | - |
| `role` | `varchar(50)` | text | 50 | User system role (tenant, landlord, maintenance, admin) | `tenant` | - |
| `contact_number` | `varchar(50)` | string | 50 | Mobile contact number | `09171234567` | - |
| `address` | `text` | text | - | Physical home or billing address | `123 Rizal St., Dagupan City` | - |
| `profile_image_url` | `text` | URL | - | Cloud URL for user profile picture | `https://storage.../profiles/user1.png` | - |
| `is_verified` | `boolean` | boolean | 1 byte | Whether user email has been verified | `true` | - |
| `account_status` | `varchar(50)` | text | 50 | Account standing (pending, active, disabled, rejected) | `active` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |
| `landlord_average_rating` | `varchar(255)` | decimal | 255 | Average rating score of landlord | `4.85` | - |
| `landlord_rating_count` | `varchar(255)` | integer | 255 | Total number of ratings received | `24` | - |
| `landlord_trust_score` | `varchar(255)` | integer | 255 | Calculated platform trust score (0-100) | `95` | - |
| `suspension_lifted_at` | `varchar(255)` | text | 255 | Field storing suspension lifted at for users | `Sample value` | - |
| `created_by_landlord_id` | `uuid` | UUID | 16 bytes | Landlord who created this worker account | `a12e3456-...` | FK (users.id) |

---

### `email_verifications`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `user_id` | `uuid` | UUID | 16 bytes | Field storing user id for email_verifications | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `email` | `varchar(255)` | email | 255 | Unique email address for authentication | `juan.delacruz@gmail.com` | - |
| `verification_code` | `varchar(10)` | text | 10 | Field storing verification code for email_verifications | `Sample value` | - |
| `expires_at` | `timestamptz` | timestamp | - | Field storing expires at for email_verifications | `2026-10-13 08:30:00` | - |
| `is_used` | `boolean` | boolean | 1 byte | Field storing is used for email_verifications | `false` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

### `audit_logs`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `user_id` | `uuid` | UUID | 16 bytes | Field storing user id for audit_logs | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `action` | `varchar(255)` | text | 255 | Field storing action for audit_logs | `Sample value` | - |
| `description` | `text` | text | - | Detailed description of the property or request | `Spacious student dorm near university` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

## 2. Property & Unit Inventory Management

### `properties`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for properties | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_name` | `varchar(255)` | text | 255 | Listing title or boarding house name | `Villa Milagros Dormitory` | - |
| `property_type` | `varchar(50)` | text | 50 | Type of property (apartment, boarding_house, etc.) | `boarding_house` | - |
| `description` | `text` | text | - | Detailed description of the property or request | `Spacious student dorm near university` | - |
| `address` | `text` | text | - | Physical home or billing address | `123 Rizal St., Dagupan City` | - |
| `barangay` | `varchar(100)` | text | 100 | Barangay location | `Poblacion` | - |
| `municipality` | `varchar(100)` | text | 100 | City or municipality location | `Dagupan City` | - |
| `province` | `varchar(100)` | text | 100 | Province location | `Pangasinan` | - |
| `latitude` | `decimal(10, 8)` | decimal | 10, 8 | GPS latitude coordinate | `16.04330000` | - |
| `longitude` | `decimal(11, 8)` | decimal | 11, 8 | GPS longitude coordinate | `120.33330000` | - |
| `monthly_rent` | `decimal(10, 2)` | currency | 10, 2 | Monthly rental price in PHP | `3500.00` | - |
| `max_occupants` | `integer` | integer | 4 bytes | Maximum allowable occupants | `4` | - |
| `tenant_type_suitability` | `varchar(50)` | text | 50 | Target demographic (student, worker, family, general) | `student` | - |
| `house_rules` | `text` | text | - | Rules and regulations for residents | `Curfew at 10:00 PM, no smoking` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |
| `average_rating` | `decimal(3, 2)` | decimal | 3, 2 | Overall average rating score | `4.80` | - |
| `feedback_count` | `integer` | integer | 4 bytes | Field storing feedback count for properties | `1` | - |
| `main_image_url` | `text` | URL | - | Cover photo URL of property listing | `https://storage.../prop1_main.jpg` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |
| `admin_reviewed_by` | `varchar(255)` | text | 255 | Field storing admin reviewed by for properties | `Sample value` | - |
| `admin_reviewed_at` | `varchar(255)` | text | 255 | Field storing admin reviewed at for properties | `Sample value` | - |
| `rejection_reason` | `varchar(255)` | text | 255 | Field storing rejection reason for properties | `Sample value` | - |
| `unit_number` | `varchar(255)` | text | 255 | Designated room or unit identifier | `Room 204` | - |
| `rating_count` | `varchar(255)` | integer | 255 | Total ratings submitted | `18` | - |
| `total_floors` | `varchar(255)` | integer | 255 | Total building floors | `3` | - |
| `total_capacity` | `varchar(255)` | integer | 255 | Total bed or tenant capacity | `24` | - |
| `landmark` | `varchar(255)` | text | 255 | Nearest prominent landmark | `Near University Main Gate` | - |

---

### `property_amenities`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for property_amenities | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `amenity_name` | `varchar(100)` | text | 100 | Field storing amenity name for property_amenities | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

### `property_documents`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for property_documents | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for property_documents | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `document_type` | `varchar(50)` | text | 50 | Field storing document type for property_documents | `Sample value` | - |
| `file_name` | `varchar(255)` | text | 255 | Field storing file name for property_documents | `Sample value` | - |
| `file_url` | `text` | text | - | Field storing file url for property_documents | `Sample value` | - |
| `file_path` | `text` | text | - | Field storing file path for property_documents | `Sample value` | - |
| `mime_type` | `varchar(100)` | text | 100 | Field storing mime type for property_documents | `Sample value` | - |
| `file_size` | `integer` | integer | 4 bytes | Field storing file size for property_documents | `1` | - |
| `uploaded_at` | `timestamptz` | timestamp | - | Field storing uploaded at for property_documents | `2026-10-13 08:30:00` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |

---

### `property_images`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for property_images | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `image_url` | `text` | text | - | Field storing image url for property_images | `Sample value` | - |
| `image_path` | `text` | text | - | Field storing image path for property_images | `Sample value` | - |
| `is_main` | `boolean` | boolean | 1 byte | Field storing is main for property_images | `false` | - |
| `uploaded_at` | `timestamptz` | timestamp | - | Field storing uploaded at for property_images | `2026-10-13 08:30:00` | - |

---

### `property_reservations`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for property_reservations | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for property_reservations | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `reservation_date` | `date` | date | - | Field storing reservation date for property_reservations | `2026-10-13 08:30:00` | - |
| `move_in_date` | `date` | date | - | Field storing move in date for property_reservations | `2026-10-13 08:30:00` | - |
| `message` | `text` | text | - | Field storing message for property_reservations | `Sample value` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

### `property_units`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for property_units | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `unit_number` | `varchar(100)` | text | 100 | Designated room or unit identifier | `Room 204` | - |
| `unit_type` | `varchar(50)` | text | 50 | Field storing unit type for property_units | `Sample value` | - |
| `monthly_rent` | `decimal(10, 2)` | currency | 10, 2 | Monthly rental price in PHP | `3500.00` | - |
| `security_deposit` | `decimal(10, 2)` | currency | 10, 2 | Required advance security deposit in PHP | `7000.00` | - |
| `capacity` | `integer` | integer | 4 bytes | Field storing capacity for property_units | `1` | - |
| `bedrooms` | `integer` | integer | 4 bytes | Field storing bedrooms for property_units | `1` | - |
| `bathrooms` | `integer` | integer | 4 bytes | Field storing bathrooms for property_units | `1` | - |
| `floor_area_sqm` | `decimal(6, 2)` | decimal | 6, 2 | Field storing floor area sqm for property_units | `5000.00` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |
| `main_image_url` | `text` | URL | - | Cover photo URL of property listing | `https://storage.../prop1_main.jpg` | - |
| `description` | `text` | text | - | Detailed description of the property or request | `Spacious student dorm near university` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |
| `floor` | `varchar(255)` | text | 255 | Building floor level | `2nd Floor` | - |
| `gender_restriction` | `varchar(255)` | text | 255 | Gender exclusivity (female_only, male_only, mixed) | `female_only` | - |
| `rental_style` | `varchar(255)` | text | 255 | Rental arrangement (bedspace, whole_room) | `bedspace` | - |
| `room_name` | `varchar(255)` | text | 255 | Room label or custom name | `Deluxe Quad Room` | - |

---

### `unit_amenities`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `unit_id` | `uuid` | UUID | 16 bytes | Field storing unit id for unit_amenities | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (property_units.id) |
| `amenity_name` | `varchar(100)` | text | 100 | Field storing amenity name for unit_amenities | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

### `unit_images`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `unit_id` | `uuid` | UUID | 16 bytes | Field storing unit id for unit_images | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (property_units.id) |
| `image_url` | `text` | text | - | Field storing image url for unit_images | `Sample value` | - |
| `image_path` | `text` | text | - | Field storing image path for unit_images | `Sample value` | - |
| `is_main` | `boolean` | boolean | 1 byte | Field storing is main for unit_images | `false` | - |
| `uploaded_at` | `timestamptz` | timestamp | - | Field storing uploaded at for unit_images | `2026-10-13 08:30:00` | - |

---

### `unit_beds`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `unit_id` | `uuid` | UUID | 16 bytes | Field storing unit id for unit_beds | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (property_units.id) |
| `bed_number` | `integer` | text | 4 bytes | Specific bed designation inside unit | `Bed 2-B` | - |
| `bed_label` | `text` | text | - | Field storing bed label for unit_beds | `Sample value` | - |
| `status` | `text` | text | - | Current workflow or availability status | `approved` | - |
| `monthly_rent` | `numeric(10, 2)` | currency | 10, 2 | Monthly rental price in PHP | `3500.00` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

## 3. TOPSIS Multi-Criteria Recommendation Engine

### `recommendation_runs`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `formula_version` | `varchar(40)` | text | 40 | Field storing formula version for recommendation_runs | `Sample value` | - |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for recommendation_runs | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `generated_at` | `timestamptz` | timestamp | - | Field storing generated at for recommendation_runs | `2026-10-13 08:30:00` | - |
| `tenant_input_snapshot` | `jsonb` | JSON | - | Field storing tenant input snapshot for recommendation_runs | `{"key": "value"}` | - |
| `active_criteria` | `text` | text | - | Field storing active criteria for recommendation_runs | `Sample value` | - |
| `raw_importance` | `jsonb` | JSON | - | Field storing raw importance for recommendation_runs | `{"key": "value"}` | - |
| `normalized_weights` | `jsonb` | JSON | - | Field storing normalized weights for recommendation_runs | `{"key": "value"}` | - |
| `platform_priors` | `jsonb` | JSON | - | Field storing platform priors for recommendation_runs | `{"key": "value"}` | - |
| `candidate_count` | `integer` | integer | 4 bytes | Field storing candidate count for recommendation_runs | `1` | - |
| `eligible_count` | `integer` | integer | 4 bytes | Field storing eligible count for recommendation_runs | `1` | - |
| `excluded_count` | `integer` | integer | 4 bytes | Field storing excluded count for recommendation_runs | `1` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

### `recommendation_candidates`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `recommendation_run_id` | `uuid` | UUID | 16 bytes | Field storing recommendation run id for recommendation_candidates | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for recommendation_candidates | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `rank` | `integer` | integer | 4 bytes | Field storing rank for recommendation_candidates | `1` | - |
| `eligibility_passed` | `boolean` | boolean | 1 byte | Field storing eligibility passed for recommendation_candidates | `false` | - |
| `raw_score` | `double` | text | 255 | Field storing raw score for recommendation_candidates | `Sample value` | - |
| `display_score` | `numeric(5, 2)` | decimal | 5, 2 | Field storing display score for recommendation_candidates | `5000.00` | - |
| `criterion_scores` | `jsonb` | JSON | - | Field storing criterion scores for recommendation_candidates | `{"key": "value"}` | - |
| `fallback_flags` | `jsonb` | JSON | - | Field storing fallback flags for recommendation_candidates | `{"key": "value"}` | - |
| `property_input_snapshot` | `jsonb` | JSON | - | Field storing property input snapshot for recommendation_candidates | `{"key": "value"}` | - |
| `explanation_snapshot` | `jsonb` | JSON | - | Field storing explanation snapshot for recommendation_candidates | `{"key": "value"}` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

### `recommendation_exclusions`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `recommendation_run_id` | `uuid` | UUID | 16 bytes | Field storing recommendation run id for recommendation_exclusions | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for recommendation_exclusions | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `reason_codes` | `text` | text | - | Field storing reason codes for recommendation_exclusions | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

## 4. Tenant Screening & Rental Applications

### `tenant_applications`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for tenant_applications | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for tenant_applications | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for tenant_applications | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `reservation_id` | `uuid` | UUID | 16 bytes | Field storing reservation id for tenant_applications | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `application_message` | `text` | text | - | Field storing application message for tenant_applications | `Sample value` | - |
| `desired_move_in_date` | `date` | date | - | Field storing desired move in date for tenant_applications | `2026-10-13 08:30:00` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |
| `landlord_remarks` | `text` | text | - | Field storing landlord remarks for tenant_applications | `Sample value` | - |
| `submitted_at` | `timestamptz` | timestamp | - | Field storing submitted at for tenant_applications | `2026-10-13 08:30:00` | - |
| `reviewed_at` | `timestamptz` | timestamp | - | Field storing reviewed at for tenant_applications | `2026-10-13 08:30:00` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |
| `unit_id` | `uuid` | UUID | 16 bytes | Field storing unit id for tenant_applications | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (property_units.id) |
| `bed_id` | `uuid` | UUID | 16 bytes | Field storing bed id for tenant_applications | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (unit_beds.id) |

---

### `tenant_application_documents`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `application_id` | `uuid` | UUID | 16 bytes | Field storing application id for tenant_application_documents | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (tenant_applications.id) |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for tenant_application_documents | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `document_type` | `varchar(50)` | text | 50 | Field storing document type for tenant_application_documents | `Sample value` | - |
| `file_name` | `varchar(255)` | text | 255 | Field storing file name for tenant_application_documents | `Sample value` | - |
| `file_url` | `text` | text | - | Field storing file url for tenant_application_documents | `Sample value` | - |
| `file_path` | `text` | text | - | Field storing file path for tenant_application_documents | `Sample value` | - |
| `mime_type` | `varchar(100)` | text | 100 | Field storing mime type for tenant_application_documents | `Sample value` | - |
| `file_size` | `integer` | integer | 4 bytes | Field storing file size for tenant_application_documents | `1` | - |
| `uploaded_at` | `timestamptz` | timestamp | - | Field storing uploaded at for tenant_application_documents | `2026-10-13 08:30:00` | - |

---

### `tenant_screening`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for tenant_screening | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `application_id` | `uuid` | UUID | 16 bytes | Field storing application id for tenant_screening | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (tenant_applications.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for tenant_screening | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for tenant_screening | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `monthly_income` | `decimal(12, 2)` | decimal | 12, 2 | Field storing monthly income for tenant_screening | `5000.00` | - |
| `employment_status` | `varchar(50)` | text | 50 | Field storing employment status for tenant_screening | `Sample value` | - |
| `employment_details` | `text` | text | - | Field storing employment details for tenant_screening | `Sample value` | - |
| `payment_behavior_score` | `integer` | integer | 4 bytes | Field storing payment behavior score for tenant_screening | `1` | - |
| `previous_rental_history` | `varchar(50)` | text | 50 | Field storing previous rental history for tenant_screening | `Sample value` | - |
| `rental_conduct_notes` | `varchar(50)` | text | 50 | Field storing rental conduct notes for tenant_screening | `Sample value` | - |
| `screening_score` | `integer` | integer | 4 bytes | Field storing screening score for tenant_screening | `1` | - |
| `screening_result_label` | `varchar(50)` | text | 50 | Field storing screening result label for tenant_screening | `Sample value` | - |
| `screening_remarks` | `text` | text | - | Field storing screening remarks for tenant_screening | `Sample value` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

## 5. Digital Lease Contract Management

### `lease_records`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `application_id` | `uuid` | UUID | 16 bytes | Field storing application id for lease_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (tenant_applications.id) |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for lease_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for lease_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for lease_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `lease_start_date` | `date` | date | - | Field storing lease start date for lease_records | `2026-10-13 08:30:00` | - |
| `lease_end_date` | `date` | date | - | Field storing lease end date for lease_records | `2026-10-13 08:30:00` | - |
| `monthly_rent` | `decimal(10, 2)` | currency | 10, 2 | Monthly rental price in PHP | `3500.00` | - |
| `security_deposit` | `decimal(10, 2)` | currency | 10, 2 | Required advance security deposit in PHP | `7000.00` | - |
| `lease_status` | `varchar(50)` | text | 50 | Lease state (pending_tenant_acceptance, active, etc.) | `active` | - |
| `terms_and_conditions` | `text` | text | - | Field storing terms and conditions for lease_records | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |
| `lease_number` | `varchar(255)` | text | 255 | Unique legal contract reference number | `LEASE-2026-0042` | - |
| `advance_payment` | `varchar(255)` | currency | 255 | Advance rental payment credited | `3500.00` | - |
| `payment_due_day` | `varchar(255)` | integer | 255 | Calendar day of month rent is due | `5` | - |
| `utilities_covered` | `varchar(255)` | JSON | 255 | JSON list of utilities covered in rent | `["water", "wifi"]` | - |
| `utilities_other` | `varchar(255)` | text | 255 | Field storing utilities other for lease_records | `Sample value` | - |
| `max_occupants` | `varchar(255)` | integer | 255 | Maximum allowable occupants | `4` | - |
| `pet_policy` | `varchar(255)` | text | 255 | Field storing pet policy for lease_records | `Sample value` | - |
| `pet_conditions` | `varchar(255)` | text | 255 | Field storing pet conditions for lease_records | `Sample value` | - |
| `smoking_policy` | `varchar(255)` | text | 255 | Field storing smoking policy for lease_records | `Sample value` | - |
| `parking_policy` | `varchar(255)` | text | 255 | Field storing parking policy for lease_records | `Sample value` | - |
| `parking_slot_number` | `varchar(255)` | text | 255 | Field storing parking slot number for lease_records | `Sample value` | - |
| `house_rules` | `varchar(255)` | text | 255 | Rules and regulations for residents | `Curfew at 10:00 PM, no smoking` | - |
| `landlord_responsibilities` | `varchar(255)` | text | 255 | Field storing landlord responsibilities for lease_records | `Sample value` | - |
| `tenant_responsibilities` | `varchar(255)` | text | 255 | Field storing tenant responsibilities for lease_records | `Sample value` | - |
| `late_fee_amount` | `varchar(255)` | text | 255 | Field storing late fee amount for lease_records | `Sample value` | - |
| `grace_period` | `varchar(255)` | text | 255 | Field storing grace period for lease_records | `Sample value` | - |
| `termination_policy` | `varchar(255)` | text | 255 | Field storing termination policy for lease_records | `Sample value` | - |
| `additional_terms` | `varchar(255)` | text | 255 | Field storing additional terms for lease_records | `Sample value` | - |
| `landlord_signature_name` | `varchar(255)` | text | 255 | Electronic signer name for landlord | `Juan Dela Cruz` | - |
| `landlord_signature_date` | `varchar(255)` | text | 255 | Field storing landlord signature date for lease_records | `Sample value` | - |
| `tenant_signature_name` | `varchar(255)` | text | 255 | Electronic signer name for tenant | `Maria Santos` | - |
| `tenant_signature_date` | `varchar(255)` | text | 255 | Field storing tenant signature date for lease_records | `Sample value` | - |
| `unit_id` | `uuid` | UUID | 16 bytes | Field storing unit id for lease_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (property_units.id) |
| `bed_id` | `uuid` | UUID | 16 bytes | Field storing bed id for lease_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (unit_beds.id) |

---

## 6. Utility Tracking, Billing & Payment Processing

### `utility_records`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for utility_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for utility_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for utility_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for utility_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `utility_type` | `varchar(50)` | text | 50 | Field storing utility type for utility_records | `Sample value` | - |
| `billing_month` | `varchar(20)` | string | 20 | Target billing cycle (YYYY-MM) | `2026-06` | - |
| `previous_reading` | `decimal(10, 2)` | decimal | 10, 2 | Field storing previous reading for utility_records | `5000.00` | - |
| `current_reading` | `decimal(10, 2)` | decimal | 10, 2 | Field storing current reading for utility_records | `5000.00` | - |
| `consumption` | `decimal(10, 2)` | decimal | 10, 2 | Field storing consumption for utility_records | `5000.00` | - |
| `rate_per_unit` | `decimal(10, 2)` | decimal | 10, 2 | Field storing rate per unit for utility_records | `5000.00` | - |
| `total_amount` | `decimal(10, 2)` | decimal | 10, 2 | Field storing total amount for utility_records | `5000.00` | - |
| `remarks` | `text` | text | - | Field storing remarks for utility_records | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

### `billing_records`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for billing_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for billing_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for billing_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for billing_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `billing_month` | `varchar(20)` | string | 20 | Target billing cycle (YYYY-MM) | `2026-06` | - |
| `rent_amount` | `decimal(10, 2)` | decimal | 10, 2 | Field storing rent amount for billing_records | `5000.00` | - |
| `utility_amount` | `decimal(10, 2)` | decimal | 10, 2 | Field storing utility amount for billing_records | `5000.00` | - |
| `penalty_amount` | `decimal(10, 2)` | decimal | 10, 2 | Field storing penalty amount for billing_records | `5000.00` | - |
| `total_amount` | `decimal(10, 2)` | decimal | 10, 2 | Field storing total amount for billing_records | `5000.00` | - |
| `due_date` | `date` | date | - | Payment due deadline | `2026-06-05` | - |
| `billing_status` | `varchar(50)` | text | 50 | Invoice state (pending_payment, paid, overdue) | `pending_payment` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |
| `water` | `varchar(255)` | currency | 255 | Sub-metered water billing charge | `250.00` | - |
| `electricity` | `varchar(255)` | currency | 255 | Sub-metered power billing charge | `620.00` | - |
| `internet` | `varchar(255)` | currency | 255 | Monthly shared WiFi fee | `150.00` | - |
| `parking` | `varchar(255)` | text | 255 | Field storing parking for billing_records | `Sample value` | - |
| `other_charges` | `varchar(255)` | text | 255 | Field storing other charges for billing_records | `Sample value` | - |
| `remarks` | `varchar(255)` | text | 255 | Field storing remarks for billing_records | `Sample value` | - |
| `unit_id` | `uuid` | UUID | 16 bytes | Field storing unit id for billing_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (property_units.id) |

---

### `payment_records`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `billing_id` | `uuid` | UUID | 16 bytes | Field storing billing id for payment_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (billing_records.id) |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for payment_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for payment_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for payment_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for payment_records | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `payment_amount` | `decimal(10, 2)` | decimal | 10, 2 | Field storing payment amount for payment_records | `5000.00` | - |
| `payment_method` | `varchar(50)` | text | 50 | Remittance channel (GCash, Maya, Bank, Cash) | `GCash` | - |
| `payment_reference_number` | `varchar(100)` | text | 100 | Field storing payment reference number for payment_records | `Sample value` | - |
| `payment_proof_url` | `text` | text | - | Field storing payment proof url for payment_records | `Sample value` | - |
| `payment_proof_path` | `text` | text | - | Field storing payment proof path for payment_records | `Sample value` | - |
| `payment_status` | `varchar(50)` | text | 50 | Verification status (pending_verification, verified) | `verified` | - |
| `verification_remarks` | `text` | text | - | Field storing verification remarks for payment_records | `Sample value` | - |
| `submitted_at` | `timestamptz` | timestamp | - | Field storing submitted at for payment_records | `2026-10-13 08:30:00` | - |
| `verified_at` | `timestamptz` | timestamp | - | Field storing verified at for payment_records | `2026-10-13 08:30:00` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

## 7. Maintenance Operations & Work Order Lifecycle

### `maintenance_requests`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for maintenance_requests | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for maintenance_requests | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for maintenance_requests | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for maintenance_requests | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `assigned_maintenance_id` | `uuid` | UUID | 16 bytes | Field storing assigned maintenance id for maintenance_requests | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `issue_title` | `varchar(255)` | text | 255 | Brief title of the reported fault | `Leaking bathroom faucet` | - |
| `issue_description` | `text` | text | - | Field storing issue description for maintenance_requests | `Sample value` | - |
| `issue_category` | `varchar(50)` | text | 50 | Category of defect (plumbing, electrical, aircon, etc.) | `plumbing` | - |
| `priority_level` | `varchar(50)` | text | 50 | Urgency rating (low, medium, high, emergency) | `medium` | - |
| `image_url` | `text` | text | - | Field storing image url for maintenance_requests | `Sample value` | - |
| `image_path` | `text` | text | - | Field storing image path for maintenance_requests | `Sample value` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |
| `landlord_remarks` | `text` | text | - | Field storing landlord remarks for maintenance_requests | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |
| `completed_at` | `timestamptz` | timestamp | - | Field storing completed at for maintenance_requests | `2026-10-13 08:30:00` | - |
| `preferred_schedule` | `varchar(255)` | text | 255 | Tenant preferred repair time slot | `Saturday 2:00 PM` | - |
| `unit_number` | `varchar(255)` | text | 255 | Designated room or unit identifier | `Room 204` | - |
| `rejection_reason` | `varchar(255)` | text | 255 | Field storing rejection reason for maintenance_requests | `Sample value` | - |
| `travel_started_at` | `varchar(255)` | text | 255 | Field storing travel started at for maintenance_requests | `Sample value` | - |
| `arrived_at` | `varchar(255)` | text | 255 | Field storing arrived at for maintenance_requests | `Sample value` | - |
| `repair_started_at` | `varchar(255)` | text | 255 | Field storing repair started at for maintenance_requests | `Sample value` | - |
| `problem_found` | `varchar(255)` | text | 255 | Field storing problem found for maintenance_requests | `Sample value` | - |
| `repair_performed` | `varchar(255)` | text | 255 | Field storing repair performed for maintenance_requests | `Sample value` | - |
| `recommendations` | `varchar(255)` | text | 255 | Field storing recommendations for maintenance_requests | `Sample value` | - |
| `before_photo_url` | `varchar(255)` | URL | 255 | URL of damage photo before repair | `https://storage.../before.jpg` | - |
| `after_photo_url` | `varchar(255)` | URL | 255 | URL of photo verifying completed repair | `https://storage.../after.jpg` | - |
| `labor_cost` | `varchar(255)` | currency | 255 | Technician labor compensation | `350.00` | - |
| `material_cost` | `varchar(255)` | currency | 255 | Total cost of replacement parts | `180.00` | - |
| `unit_id` | `uuid` | UUID | 16 bytes | Field storing unit id for maintenance_requests | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (property_units.id) |

---

### `maintenance_categories`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `category_name` | `varchar(50)` | text | 50 | Field storing category name for maintenance_categories | `Sample value` | - |

---

### `maintenance_assignments`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `maintenance_request_id` | `uuid` | UUID | 16 bytes | Field storing maintenance request id for maintenance_assignments | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `maintenance_personnel_id` | `uuid` | UUID | 16 bytes | Field storing maintenance personnel id for maintenance_assignments | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `due_date` | `date` | date | - | Payment due deadline | `2026-06-05` | - |
| `instructions` | `text` | text | - | Field storing instructions for maintenance_assignments | `Sample value` | - |
| `assigned_at` | `timestamptz` | timestamp | - | Field storing assigned at for maintenance_assignments | `2026-10-13 08:30:00` | - |

---

### `maintenance_updates`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `maintenance_request_id` | `uuid` | UUID | 16 bytes | Field storing maintenance request id for maintenance_updates | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `status_update` | `varchar(50)` | text | 50 | Field storing status update for maintenance_updates | `Sample value` | - |
| `notes` | `text` | text | - | Field storing notes for maintenance_updates | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

### `maintenance_task_updates`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `maintenance_request_id` | `uuid` | UUID | 16 bytes | Field storing maintenance request id for maintenance_task_updates | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `maintenance_personnel_id` | `uuid` | UUID | 16 bytes | Field storing maintenance personnel id for maintenance_task_updates | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `status_update` | `varchar(50)` | text | 50 | Field storing status update for maintenance_task_updates | `Sample value` | - |
| `progress_notes` | `text` | text | - | Field storing progress notes for maintenance_task_updates | `Sample value` | - |
| `image_url` | `text` | text | - | Field storing image url for maintenance_task_updates | `Sample value` | - |
| `image_path` | `text` | text | - | Field storing image path for maintenance_task_updates | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

### `maintenance_photos`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `maintenance_request_id` | `uuid` | UUID | 16 bytes | Field storing maintenance request id for maintenance_photos | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `photo_url` | `text` | text | - | Field storing photo url for maintenance_photos | `Sample value` | - |
| `photo_type` | `varchar(50)` | text | 50 | Field storing photo type for maintenance_photos | `Sample value` | - |
| `uploaded_at` | `timestamptz` | timestamp | - | Field storing uploaded at for maintenance_photos | `2026-10-13 08:30:00` | - |

---

### `maintenance_materials`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `maintenance_request_id` | `uuid` | UUID | 16 bytes | Field storing maintenance request id for maintenance_materials | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `material_name` | `varchar(255)` | text | 255 | Field storing material name for maintenance_materials | `Sample value` | - |
| `quantity` | `integer` | integer | 4 bytes | Field storing quantity for maintenance_materials | `1` | - |
| `cost` | `decimal(10, 2)` | decimal | 10, 2 | Field storing cost for maintenance_materials | `5000.00` | - |

---

### `maintenance_reports`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `maintenance_request_id` | `uuid` | UUID | 16 bytes | Field storing maintenance request id for maintenance_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `maintenance_personnel_id` | `uuid` | UUID | 16 bytes | Field storing maintenance personnel id for maintenance_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `problem_found` | `text` | text | - | Field storing problem found for maintenance_reports | `Sample value` | - |
| `repair_performed` | `text` | text | - | Field storing repair performed for maintenance_reports | `Sample value` | - |
| `materials_used` | `text` | text | - | Field storing materials used for maintenance_reports | `Sample value` | - |
| `recommendations` | `text` | text | - | Field storing recommendations for maintenance_reports | `Sample value` | - |
| `labor_cost` | `decimal(10, 2)` | currency | 10, 2 | Technician labor compensation | `350.00` | - |
| `material_cost` | `decimal(10, 2)` | currency | 10, 2 | Total cost of replacement parts | `180.00` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

## 8. Complaints, Disputes & Policy Governance

### `complaints`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `complaint_number` | `varchar(30)` | text | 30 | Field storing complaint number for complaints | `Sample value` | - |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for complaints | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for complaints | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for complaints | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for complaints | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `category` | `varchar(50)` | text | 50 | Field storing category for complaints | `Sample value` | - |
| `subject` | `varchar(255)` | text | 255 | Field storing subject for complaints | `Sample value` | - |
| `description` | `text` | text | - | Detailed description of the property or request | `Spacious student dorm near university` | - |
| `attachment_url` | `text` | text | - | Field storing attachment url for complaints | `Sample value` | - |
| `attachment_path` | `text` | text | - | Field storing attachment path for complaints | `Sample value` | - |
| `status` | `varchar(30)` | text | 30 | Current workflow or availability status | `approved` | - |
| `resolution_notes` | `text` | text | - | Field storing resolution notes for complaints | `Sample value` | - |
| `rejection_reason` | `text` | text | - | Field storing rejection reason for complaints | `Sample value` | - |
| `resolved_at` | `timestamptz` | timestamp | - | Field storing resolved at for complaints | `2026-10-13 08:30:00` | - |
| `closed_at` | `timestamptz` | timestamp | - | Field storing closed at for complaints | `2026-10-13 08:30:00` | - |
| `submitted_at` | `timestamptz` | timestamp | - | Field storing submitted at for complaints | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

### `complaint_status_logs`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `complaint_id` | `uuid` | UUID | 16 bytes | Field storing complaint id for complaint_status_logs | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (complaints.id) |
| `updated_by` | `uuid` | UUID | 16 bytes | Field storing updated by for complaint_status_logs | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `previous_status` | `varchar(30)` | text | 30 | Field storing previous status for complaint_status_logs | `Sample value` | - |
| `new_status` | `varchar(30)` | text | 30 | Field storing new status for complaint_status_logs | `Sample value` | - |
| `remarks` | `text` | text | - | Field storing remarks for complaint_status_logs | `Sample value` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

### `disputes`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `complainant_id` | `uuid` | UUID | 16 bytes | Field storing complainant id for disputes | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `respondent_id` | `uuid` | UUID | 16 bytes | Field storing respondent id for disputes | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for disputes | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for disputes | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `dispute_type` | `varchar(50)` | text | 50 | Field storing dispute type for disputes | `Sample value` | - |
| `dispute_title` | `varchar(255)` | text | 255 | Field storing dispute title for disputes | `Sample value` | - |
| `dispute_description` | `text` | text | - | Field storing dispute description for disputes | `Sample value` | - |
| `attachment_url` | `text` | text | - | Field storing attachment url for disputes | `Sample value` | - |
| `attachment_path` | `text` | text | - | Field storing attachment path for disputes | `Sample value` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |
| `resolution_notes` | `text` | text | - | Field storing resolution notes for disputes | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |
| `resolved_at` | `timestamptz` | timestamp | - | Field storing resolved at for disputes | `2026-10-13 08:30:00` | - |

---

### `policy_violations`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `reported_by` | `uuid` | UUID | 16 bytes | Field storing reported by for policy_violations | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `violator_id` | `uuid` | UUID | 16 bytes | Field storing violator id for policy_violations | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for policy_violations | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for policy_violations | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `violation_type` | `varchar(50)` | text | 50 | Field storing violation type for policy_violations | `Sample value` | - |
| `violation_description` | `text` | text | - | Field storing violation description for policy_violations | `Sample value` | - |
| `evidence_url` | `text` | text | - | Field storing evidence url for policy_violations | `Sample value` | - |
| `evidence_path` | `text` | text | - | Field storing evidence path for policy_violations | `Sample value` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |
| `action_taken` | `text` | text | - | Field storing action taken for policy_violations | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |
| `resolved_at` | `timestamptz` | timestamp | - | Field storing resolved at for policy_violations | `2026-10-13 08:30:00` | - |

---

## 9. Incident Case Triage & Case Messaging

### `tenant_reports`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for tenant_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for tenant_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for tenant_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for tenant_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `report_category` | `varchar(50)` | text | 50 | Field storing report category for tenant_reports | `Sample value` | - |
| `incident_date` | `date` | date | - | Field storing incident date for tenant_reports | `2026-10-13 08:30:00` | - |
| `incident_description` | `text` | text | - | Field storing incident description for tenant_reports | `Sample value` | - |
| `severity` | `varchar(20)` | text | 20 | Field storing severity for tenant_reports | `Sample value` | - |
| `status` | `varchar(30)` | text | 30 | Current workflow or availability status | `approved` | - |
| `admin_id` | `uuid` | UUID | 16 bytes | Field storing admin id for tenant_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `admin_remarks` | `text` | text | - | Field storing admin remarks for tenant_reports | `Sample value` | - |
| `reviewed_at` | `timestamptz` | timestamp | - | Field storing reviewed at for tenant_reports | `2026-10-13 08:30:00` | - |
| `tenant_explanation` | `text` | text | - | Field storing tenant explanation for tenant_reports | `Sample value` | - |
| `tenant_responded_at` | `timestamptz` | timestamp | - | Field storing tenant responded at for tenant_reports | `2026-10-13 08:30:00` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

### `tenant_report_evidence`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `report_id` | `uuid` | UUID | 16 bytes | Field storing report id for tenant_report_evidence | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (reports.id) |
| `file_name` | `varchar(255)` | text | 255 | Field storing file name for tenant_report_evidence | `Sample value` | - |
| `file_url` | `text` | text | - | Field storing file url for tenant_report_evidence | `Sample value` | - |
| `file_path` | `text` | text | - | Field storing file path for tenant_report_evidence | `Sample value` | - |
| `file_type` | `varchar(100)` | text | 100 | Field storing file type for tenant_report_evidence | `Sample value` | - |
| `file_size` | `bigint` | text | 255 | Field storing file size for tenant_report_evidence | `Sample value` | - |
| `uploaded_at` | `timestamptz` | timestamp | - | Field storing uploaded at for tenant_report_evidence | `2026-10-13 08:30:00` | - |

---

### `landlord_reports`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for landlord_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for landlord_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for landlord_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for landlord_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `report_category` | `varchar(50)` | text | 50 | Field storing report category for landlord_reports | `Sample value` | - |
| `report_category` | `in` | text | 255 | Field storing report category for landlord_reports | `Sample value` | - |
| `incident_date` | `date` | date | - | Field storing incident date for landlord_reports | `2026-10-13 08:30:00` | - |
| `incident_description` | `text` | text | - | Field storing incident description for landlord_reports | `Sample value` | - |
| `severity` | `varchar(20)` | text | 20 | Field storing severity for landlord_reports | `Sample value` | - |
| `severity` | `in` | text | 255 | Field storing severity for landlord_reports | `Sample value` | - |
| `status` | `varchar(30)` | text | 30 | Current workflow or availability status | `approved` | - |
| `admin_id` | `uuid` | UUID | 16 bytes | Field storing admin id for landlord_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `admin_remarks` | `text` | text | - | Field storing admin remarks for landlord_reports | `Sample value` | - |
| `reviewed_at` | `timestamptz` | timestamp | - | Field storing reviewed at for landlord_reports | `2026-10-13 08:30:00` | - |
| `landlord_explanation` | `text` | text | - | Field storing landlord explanation for landlord_reports | `Sample value` | - |
| `landlord_responded_at` | `timestamptz` | timestamp | - | Field storing landlord responded at for landlord_reports | `2026-10-13 08:30:00` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

### `landlord_report_evidence`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `report_id` | `uuid` | UUID | 16 bytes | Field storing report id for landlord_report_evidence | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (reports.id) |
| `file_name` | `varchar(255)` | text | 255 | Field storing file name for landlord_report_evidence | `Sample value` | - |
| `file_url` | `text` | text | - | Field storing file url for landlord_report_evidence | `Sample value` | - |
| `file_path` | `text` | text | - | Field storing file path for landlord_report_evidence | `Sample value` | - |
| `file_type` | `varchar(100)` | text | 100 | Field storing file type for landlord_report_evidence | `Sample value` | - |
| `file_size` | `bigint` | text | 255 | Field storing file size for landlord_report_evidence | `Sample value` | - |
| `uploaded_at` | `timestamptz` | timestamp | - | Field storing uploaded at for landlord_report_evidence | `2026-10-13 08:30:00` | - |

---

### `user_reports`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `reporter_id` | `uuid` | UUID | 16 bytes | Field storing reporter id for user_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `reported_user_id` | `uuid` | UUID | 16 bytes | Field storing reported user id for user_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for user_reports | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `report_type` | `varchar(50)` | text | 50 | Field storing report type for user_reports | `Sample value` | - |
| `report_title` | `varchar(255)` | text | 255 | Field storing report title for user_reports | `Sample value` | - |
| `report_description` | `text` | text | - | Field storing report description for user_reports | `Sample value` | - |
| `attachment_url` | `text` | text | - | Field storing attachment url for user_reports | `Sample value` | - |
| `attachment_path` | `text` | text | - | Field storing attachment path for user_reports | `Sample value` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |
| `admin_remarks` | `text` | text | - | Field storing admin remarks for user_reports | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |
| `resolved_at` | `timestamptz` | timestamp | - | Field storing resolved at for user_reports | `2026-10-13 08:30:00` | - |

---

### `report_messages`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `report_type` | `varchar(255)` | text | 255 | Field storing report type for report_messages | `Sample value` | - |
| `report_id` | `uuid` | UUID | 16 bytes | Field storing report id for report_messages | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (reports.id) |
| `sender_id` | `uuid` | UUID | 16 bytes | Field storing sender id for report_messages | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `sender_role` | `varchar(255)` | text | 255 | Field storing sender role for report_messages | `Sample value` | - |
| `recipient_role` | `varchar(255)` | text | 255 | Field storing recipient role for report_messages | `Sample value` | - |
| `message_text` | `varchar(255)` | text | 255 | Field storing message text for report_messages | `Sample value` | - |
| `attachment_url` | `varchar(255)` | text | 255 | Field storing attachment url for report_messages | `Sample value` | - |
| `attachment_path` | `varchar(255)` | text | 255 | Field storing attachment path for report_messages | `Sample value` | - |
| `created_at` | `varchar(255)` | timestamp | 255 | Timestamp record was created | `2026-10-13 08:30:00` | - |

---

## 10. Ratings, Reviews & Feedback System

### `property_ratings`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for property_ratings | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for property_ratings | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for property_ratings | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for property_ratings | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `cleanliness` | `integer` | integer | 4 bytes | Field storing cleanliness for property_ratings | `1` | - |
| `safety` | `integer` | integer | 4 bytes | Field storing safety for property_ratings | `1` | - |
| `comfort` | `integer` | integer | 4 bytes | Field storing comfort for property_ratings | `1` | - |
| `amenities` | `integer` | integer | 4 bytes | Field storing amenities for property_ratings | `1` | - |
| `location` | `integer` | integer | 4 bytes | Field storing location for property_ratings | `1` | - |
| `internet_availability` | `integer` | integer | 4 bytes | Field storing internet availability for property_ratings | `1` | - |
| `water_supply` | `integer` | integer | 4 bytes | Field storing water supply for property_ratings | `1` | - |
| `electricity_reliability` | `integer` | integer | 4 bytes | Field storing electricity reliability for property_ratings | `1` | - |
| `noise_level` | `integer` | integer | 4 bytes | Field storing noise level for property_ratings | `1` | - |
| `overall_satisfaction` | `integer` | integer | 4 bytes | Field storing overall satisfaction for property_ratings | `1` | - |
| `overall_computed_avg` | `decimal(3, 2)` | decimal | 3, 2 | Field storing overall computed avg for property_ratings | `5000.00` | - |
| `feedback` | `text` | text | - | Field storing feedback for property_ratings | `Sample value` | - |
| `submitted_at` | `timestamptz` | timestamp | - | Field storing submitted at for property_ratings | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

### `landlord_ratings_v2`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for landlord_ratings_v2 | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for landlord_ratings_v2 | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for landlord_ratings_v2 | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for landlord_ratings_v2 | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `communication` | `integer` | integer | 4 bytes | Field storing communication for landlord_ratings_v2 | `1` | - |
| `responsiveness` | `integer` | integer | 4 bytes | Field storing responsiveness for landlord_ratings_v2 | `1` | - |
| `professionalism` | `integer` | integer | 4 bytes | Field storing professionalism for landlord_ratings_v2 | `1` | - |
| `fairness` | `integer` | integer | 4 bytes | Field storing fairness for landlord_ratings_v2 | `1` | - |
| `maintenance_response` | `integer` | integer | 4 bytes | Field storing maintenance response for landlord_ratings_v2 | `1` | - |
| `respectfulness` | `integer` | integer | 4 bytes | Field storing respectfulness for landlord_ratings_v2 | `1` | - |
| `reliability` | `integer` | integer | 4 bytes | Field storing reliability for landlord_ratings_v2 | `1` | - |
| `overall_satisfaction` | `integer` | integer | 4 bytes | Field storing overall satisfaction for landlord_ratings_v2 | `1` | - |
| `overall_computed_avg` | `decimal(3, 2)` | decimal | 3, 2 | Field storing overall computed avg for landlord_ratings_v2 | `5000.00` | - |
| `feedback` | `text` | text | - | Field storing feedback for landlord_ratings_v2 | `Sample value` | - |
| `submitted_at` | `timestamptz` | timestamp | - | Field storing submitted at for landlord_ratings_v2 | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

### `landlord_ratings`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for landlord_ratings | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for landlord_ratings | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for landlord_ratings | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for landlord_ratings | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `rating` | `integer` | integer | 4 bytes | Field storing rating for landlord_ratings | `1` | - |
| `feedback` | `text` | text | - | Field storing feedback for landlord_ratings | `Sample value` | - |
| `submitted_at` | `timestamptz` | timestamp | - | Field storing submitted at for landlord_ratings | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

### `ratings_feedback`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `tenant_id` | `uuid` | UUID | 16 bytes | Field storing tenant id for ratings_feedback | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `landlord_id` | `uuid` | UUID | 16 bytes | Field storing landlord id for ratings_feedback | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for ratings_feedback | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `lease_id` | `uuid` | UUID | 16 bytes | Field storing lease id for ratings_feedback | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (lease_records.id) |
| `rating` | `integer` | integer | 4 bytes | Field storing rating for ratings_feedback | `1` | - |
| `feedback_text` | `text` | text | - | Field storing feedback text for ratings_feedback | `Sample value` | - |
| `feedback_type` | `varchar(50)` | text | 50 | Field storing feedback type for ratings_feedback | `Sample value` | - |
| `is_authenticated` | `boolean` | boolean | 1 byte | Field storing is authenticated for ratings_feedback | `false` | - |
| `status` | `varchar(50)` | text | 50 | Current workflow or availability status | `approved` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

### `property_feedback_summary`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `property_id` | `uuid` | UUID | 16 bytes | Field storing property id for property_feedback_summary | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (properties.id) |
| `rating_average` | `decimal(3, 2)` | decimal | 3, 2 | Field storing rating average for property_feedback_summary | `5000.00` | - |
| `total_feedback` | `integer` | integer | 4 bytes | Field storing total feedback for property_feedback_summary | `1` | - |
| `positive_summary` | `text` | text | - | Field storing positive summary for property_feedback_summary | `Sample value` | - |
| `negative_summary` | `text` | text | - | Field storing negative summary for property_feedback_summary | `Sample value` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

## 11. System Notifications

### `notifications`

| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |
|:---|:---|:---|:---:|:---|:---|:---:|
| `id` | `uuid` | UUID | 16 bytes | Primary key | `d3b07384-d113-4696-9812-70b9eb0f3b0e` | PK |
| `user_id` | `uuid` | UUID | 16 bytes | Field storing user id for notifications | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | FK (users.id) |
| `type` | `varchar(80)` | text | 80 | Field storing type for notifications | `Sample value` | - |
| `title` | `varchar(255)` | text | 255 | Field storing title for notifications | `Sample value` | - |
| `message` | `text` | text | - | Field storing message for notifications | `Sample value` | - |
| `reference_id` | `uuid` | UUID | 16 bytes | Field storing reference id for notifications | `c7a19e52-192e-4b48-8df0-4b2a8d672801` | - |
| `read_status` | `boolean` | boolean | 1 byte | Field storing read status for notifications | `false` | - |
| `created_at` | `timestamptz` | timestamp | - | Timestamp record was created | `2026-10-13 08:30:00` | - |
| `updated_at` | `timestamptz` | timestamp | - | Timestamp record was last modified | `2026-10-13 09:15:00` | - |

---

