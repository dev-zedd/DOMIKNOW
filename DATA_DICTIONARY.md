# DOMIKNOW SYSTEM - COMPREHENSIVE DATA DICTIONARY
**Document Version:** 2.0 (Academic & Thesis Standard)
**Database Engine:** PostgreSQL 15+ (Hosted on Supabase)
**Total Verified Physical Tables:** 46 Active Tables
**Date Compiled:** 2026-10-13

## 1. Pangkalahatang Buod (Executive Summary)
Ang DomiKnow database architecture ay dinisenyo gamit ang relational PostgreSQL structure upang suportahan ang komprehensibong operasyon ng rental housing governance, multi-criteria recommendation (TOPSIS), digital leasing, utility billing, maintenance lifecycle, incident triage, at community feedback. Bawat table ay sumusunod sa Third Normal Form (3NF) at may mahigpit na foreign key constraints, check constraints, at automated timestamping.

### Master Table Directory (Summary Overview)

| Blg | Pangalan ng Table | Functional Subsystem / Module | Pangunahing Silbi sa System |
|:---:|:---|:---|:---|
| 1 | `users` | User Authentication, Identity & Security | Pangunahing talaan ng lahat ng rehistradong user at kanilag mga roles. |
| 2 | `email_verifications` | User Authentication, Identity & Security | Nagtatala ng OTP codes at tokens para sa account email verification. |
| 3 | `audit_logs` | User Authentication, Identity & Security | Immutable security audit trail ng mga administrative at user events. |
| 4 | `properties` | Property, Units & Inventory Management | Listahan ng mga paupahang bahay o gusali na pagmamay-ari ng landlords. |
| 5 | `property_amenities` | Property, Units & Inventory Management | Mga serbisyo at kagamitang inaalok sa property (WiFi, Tubig, etc.). |
| 6 | `property_documents` | Property, Units & Inventory Management | Mga legal na dokumento (Business Permit, DTI) para sa property approval. |
| 7 | `property_images` | Property, Units & Inventory Management | Gallery ng mga opisyal na larawan para sa property listing. |
| 8 | `property_reservations` | Property, Units & Inventory Management | Pansamantalang pagpapareserba ng unit/bedspace bago ang lease. |
| 9 | `property_units` | Property, Units & Inventory Management | Mga partikular na kwarto o yunit sa loob ng isang paupahan. |
| 10 | `unit_amenities` | Property, Units & Inventory Management | Mga partikular na amenities na eksklusibo sa bawat unit. |
| 11 | `unit_images` | Property, Units & Inventory Management | Gallery ng mga larawan para sa indibidwal na kwarto/yunit. |
| 12 | `unit_beds` | Property, Units & Inventory Management | Bedspace inventory at pagkakakilanlan ng bawat higaan/kama. |
| 13 | `recommendation_runs` | Multi-Criteria Recommendation Engine (TOPSIS / MCDM) | Kasaysayan ng pagtakbo ng TOPSIS algorithm bawat search query. |
| 14 | `recommendation_candidates` | Multi-Criteria Recommendation Engine (TOPSIS / MCDM) | Mga kalkuladong marka at ranggo ng bawat property sa TOPSIS run. |
| 15 | `recommendation_exclusions` | Multi-Criteria Recommendation Engine (TOPSIS / MCDM) | Mga paupahang na-filter o hindi pumasa sa pamantayan ng tenant. |
| 16 | `tenant_applications` | Tenant Screening & Rental Applications | Pormal na aplikasyon ng tenant para umupa ng property/unit/bed. |
| 17 | `tenant_application_documents` | Tenant Screening & Rental Applications | Mga kalakip na requirements (ID, COE, proof of billing) ng aplikante. |
| 18 | `tenant_screening` | Tenant Screening & Rental Applications | Screening score at pagsusuri ng landlord sa kredensyal ng tenant. |
| 19 | `lease_records` | Digital Lease Contract Management | Opisyal na kontrata ng upa (digital lease agreement) at lagda. |
| 20 | `utility_records` | Utility Tracking, Billing & Payment Processing | Talaan ng monthly sub-meter reading sa kuryente at tubig. |
| 21 | `billing_records` | Utility Tracking, Billing & Payment Processing | Buwanang singilin sa upa, kuryente, tubig, at iba pang bayarin. |
| 22 | `payment_records` | Utility Tracking, Billing & Payment Processing | Transaksyon sa pagbabayad, resibo, at verification status. |
| 23 | `maintenance_requests` | Maintenance Operations & Work Order Tracking | Tiket ng sirang pasilidad na inireklamo ng tenant para kumpunihin. |
| 24 | `maintenance_categories` | Maintenance Operations & Work Order Tracking | Mga klasipikasyon ng maintenance work (Plumbing, Electrical, etc.). |
| 25 | `maintenance_assignments` | Maintenance Operations & Work Order Tracking | Pagtatalaga ng technician o maintenance personnel sa tiket. |
| 26 | `maintenance_updates` | Maintenance Operations & Work Order Tracking | Status timeline at work logs ng technician habang nag-aayos. |
| 27 | `maintenance_task_updates` | Maintenance Operations & Work Order Tracking | Granular checklist updates sa bawat hakbang ng pagkumpuni. |
| 28 | `maintenance_photos` | Maintenance Operations & Work Order Tracking | Katibayan ng sira at natapos na gawa (Before & After photos). |
| 29 | `maintenance_materials` | Maintenance Operations & Work Order Tracking | Talaan ng piyesa at materyales na binili kasama ang gastos. |
| 30 | `maintenance_reports` | Maintenance Operations & Work Order Tracking | Panghuling ulat at likidasyon ng natapos na maintenance job. |
| 31 | `complaints` | Complaints, Disputes & Policy Governance | Pormal na reklamo ng tenant ukol sa kapaligiran o kapitbahay. |
| 32 | `complaint_status_logs` | Complaints, Disputes & Policy Governance | Timeline ng aksyon at imbestigasyon ng landlord sa reklamo. |
| 33 | `disputes` | Complaints, Disputes & Policy Governance | Pormal na hidwaan na inakyat sa admin para sa opisyal na mediation. |
| 34 | `policy_violations` | Complaints, Disputes & Policy Governance | Talaan ng paglabag sa mga alituntunin o house rules. |
| 35 | `tenant_reports` | Incident Reporting, Case Triage & Case Messaging | Opisyal na ulat ng tenant laban sa landlord o pamunuan. |
| 36 | `tenant_report_evidence` | Incident Reporting, Case Triage & Case Messaging | Mga kalakip na ebidensya at screenshot ng tenant incident report. |
| 37 | `landlord_reports` | Incident Reporting, Case Triage & Case Messaging | Opisyal na ulat ng landlord laban sa pasaway na tenant. |
| 38 | `landlord_report_evidence` | Incident Reporting, Case Triage & Case Messaging | Mga litrato at patunay ng kapabayaan o pagkasira mula sa landlord. |
| 39 | `user_reports` | Incident Reporting, Case Triage & Case Messaging | Pangkalahatang ulat ng mga user na dumadaan sa case triage ng admin. |
| 40 | `report_messages` | Incident Reporting, Case Triage & Case Messaging | Live case communication logs sa pagitan ng complainant, respondent, at admin. |
| 41 | `property_ratings` | Ratings, Reviews & Feedback System | Star rating at ebalwasyon ng tenant sa kalidad ng paupahan. |
| 42 | `landlord_ratings_v2` | Ratings, Reviews & Feedback System | Detalyadong marka sa pagiging maaasahan at katarungan ng landlord. |
| 43 | `landlord_ratings` | Ratings, Reviews & Feedback System | Talaan ng rating na ibinigay sa landlord. |
| 44 | `ratings_feedback` | Ratings, Reviews & Feedback System | Mensahe at nakasulat na rebyu mula sa tenant matapos manirahan. |
| 45 | `property_feedback_summary` | Ratings, Reviews & Feedback System | Naka-cache na kabuuang marka at bilang ng reviews bawat property. |
| 46 | `notifications` | System Notifications | In-app notification alerts para sa mga mahahalagang anunsyo at aktibidad. |

---

## 2. Detalyadong Data Dictionary ng Bawat Table (Detailed Table Specifications)

### 1. User Authentication, Identity & Security
> Naglalaman ng mga account ng lahat ng gumagamit ng platform (Tenant, Landlord, Maintenance Personnel, Admin), OTP verification codes, at immutable security audit logs.

#### Table: `users`
- **Functional Module:** 1. User Authentication, Identity & Security
- **Deskripsyon / Silbi:** Pangunahing talaan ng lahat ng rehistradong user at kanilag mga roles. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 17

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `full_name` | `VARCHAR(255)` | NO | None | Kumpletong pangalan ng rehistradong gumagamit |
| `email` | `VARCHAR(255)` | NO | UNIQUE | Opisyal at unique na email address para sa authentication |
| `password_hash` | `VARCHAR(255)` | NO | None | Bcrypt hash ng password ng account para sa seguridad |
| `role` | `VARCHAR(50)` | NO | None | Ginagampanang papel sa system (tenant, landlord, maintenance, admin) |
| `contact_number` | `VARCHAR(50)` | YES | None | Aktibong contact number / cellphone number |
| `address` | `TEXT` | YES | None | Tirahan o pisikal na lokasyon |
| `profile_image_url` | `TEXT` | YES | None | URL link patungo sa profile photo sa Supabase Storage |
| `is_verified` | `BOOLEAN` | YES | None | Status kung na-verify na ang email address (true/false) |
| `account_status` | `VARCHAR(50)` | YES | None | Estado ng account (pending, active, disabled, rejected) |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |
| `landlord_average_rating` | `VARCHAR / JSONB / UUID` | YES | None | Kalkuladong average rating ng landlord mula sa mga tenant |
| `landlord_rating_count` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa landlord rating count kaugnay ng users |
| `landlord_trust_score` | `VARCHAR / JSONB / UUID` | YES | None | Pangkalahatang trust score index ng landlord (0-100) |
| `suspension_lifted_at` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa suspension lifted at kaugnay ng users |
| `created_by_landlord_id` | `VARCHAR / JSONB / UUID` | YES | FK | Naglalaman ng datos para sa created by landlord id kaugnay ng users |

#### Table: `email_verifications`
- **Functional Module:** 1. User Authentication, Identity & Security
- **Deskripsyon / Silbi:** Nagtatala ng OTP codes at tokens para sa account email verification. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 7

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `user_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa gumagamit sa users table |
| `email` | `VARCHAR(255)` | NO | None | Opisyal at unique na email address para sa authentication |
| `verification_code` | `VARCHAR(10)` | NO | None | Naglalaman ng datos para sa verification code kaugnay ng email_verifications |
| `expires_at` | `TIMESTAMP` | NO | None | Naglalaman ng datos para sa expires at kaugnay ng email_verifications |
| `is_used` | `BOOLEAN` | YES | None | Naglalaman ng datos para sa is used kaugnay ng email_verifications |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |

#### Table: `audit_logs`
- **Functional Module:** 1. User Authentication, Identity & Security
- **Deskripsyon / Silbi:** Immutable security audit trail ng mga administrative at user events. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 5

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `user_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa gumagamit sa users table |
| `action` | `VARCHAR(255)` | NO | None | Naglalaman ng datos para sa action kaugnay ng audit_logs |
| `description` | `TEXT` | YES | None | Naglalaman ng datos para sa description kaugnay ng audit_logs |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |

---

### 2. Property, Units & Inventory Management
> Naglalaman ng lahat ng impormasyon tungkol sa mga paupahang bahay, gusali, apartments, mga indibidwal na kwarto/units, bedspaces, amenities, mga legal na dokumento, at photo gallery.

#### Table: `properties`
- **Functional Module:** 2. Property, Units & Inventory Management
- **Deskripsyon / Silbi:** Listahan ng mga paupahang bahay o gusali na pagmamay-ari ng landlords. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 29

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `landlord_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_name` | `VARCHAR(255)` | NO | None | Pangalan o pamagat ng paupahang establisimyento |
| `property_type` | `VARCHAR(50)` | NO | None | Uri ng paupahan (apartment, boarding_house, bedspace, studio_unit, etc.) |
| `description` | `TEXT` | YES | None | Naglalaman ng datos para sa description kaugnay ng properties |
| `address` | `TEXT` | NO | None | Tirahan o pisikal na lokasyon |
| `barangay` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa barangay kaugnay ng properties |
| `municipality` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa municipality kaugnay ng properties |
| `province` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa province kaugnay ng properties |
| `latitude` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa latitude kaugnay ng properties |
| `longitude` | `DECIMAL(11` | NO | None | Naglalaman ng datos para sa longitude kaugnay ng properties |
| `monthly_rent` | `DECIMAL(10` | NO | None | Halaga ng buwanang upa (PHP) |
| `max_occupants` | `INTEGER` | NO | None | Naglalaman ng datos para sa max occupants kaugnay ng properties |
| `tenant_type_suitability` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa tenant type suitability kaugnay ng properties |
| `house_rules` | `TEXT` | YES | None | Naglalaman ng datos para sa house rules kaugnay ng properties |
| `status` | `VARCHAR(50)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `average_rating` | `DECIMAL(3` | YES | None | Naglalaman ng datos para sa average rating kaugnay ng properties |
| `feedback_count` | `INTEGER` | YES | None | Naglalaman ng datos para sa feedback count kaugnay ng properties |
| `main_image_url` | `TEXT` | YES | None | Naglalaman ng datos para sa main image url kaugnay ng properties |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |
| `admin_reviewed_by` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa admin reviewed by kaugnay ng properties |
| `admin_reviewed_at` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa admin reviewed at kaugnay ng properties |
| `rejection_reason` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa rejection reason kaugnay ng properties |
| `unit_number` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa unit number kaugnay ng properties |
| `rating_count` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa rating count kaugnay ng properties |
| `total_floors` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa total floors kaugnay ng properties |
| `total_capacity` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa total capacity kaugnay ng properties |
| `landmark` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa landmark kaugnay ng properties |

#### Table: `property_amenities`
- **Functional Module:** 2. Property, Units & Inventory Management
- **Deskripsyon / Silbi:** Mga serbisyo at kagamitang inaalok sa property (WiFi, Tubig, etc.). Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 4

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `property_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `amenity_name` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa amenity name kaugnay ng property_amenities |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |

#### Table: `property_documents`
- **Functional Module:** 2. Property, Units & Inventory Management
- **Deskripsyon / Silbi:** Mga legal na dokumento (Business Permit, DTI) para sa property approval. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 11

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `property_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `landlord_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `document_type` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa document type kaugnay ng property_documents |
| `file_name` | `VARCHAR(255)` | NO | None | Naglalaman ng datos para sa file name kaugnay ng property_documents |
| `file_url` | `TEXT` | NO | None | Naglalaman ng datos para sa file url kaugnay ng property_documents |
| `file_path` | `TEXT` | NO | None | Naglalaman ng datos para sa file path kaugnay ng property_documents |
| `mime_type` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa mime type kaugnay ng property_documents |
| `file_size` | `INTEGER` | NO | None | Naglalaman ng datos para sa file size kaugnay ng property_documents |
| `uploaded_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa uploaded at kaugnay ng property_documents |
| `status` | `VARCHAR(50)` | YES | None | Kasalukuyang estado ng daloy ng proseso |

#### Table: `property_images`
- **Functional Module:** 2. Property, Units & Inventory Management
- **Deskripsyon / Silbi:** Gallery ng mga opisyal na larawan para sa property listing. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 6

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `property_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `image_url` | `TEXT` | NO | None | Naglalaman ng datos para sa image url kaugnay ng property_images |
| `image_path` | `TEXT` | NO | None | Naglalaman ng datos para sa image path kaugnay ng property_images |
| `is_main` | `BOOLEAN` | YES | None | Naglalaman ng datos para sa is main kaugnay ng property_images |
| `uploaded_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa uploaded at kaugnay ng property_images |

#### Table: `property_reservations`
- **Functional Module:** 2. Property, Units & Inventory Management
- **Deskripsyon / Silbi:** Pansamantalang pagpapareserba ng unit/bedspace bago ang lease. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 9

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `tenant_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `property_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `reservation_date` | `DATE` | NO | None | Naglalaman ng datos para sa reservation date kaugnay ng property_reservations |
| `move_in_date` | `DATE` | NO | None | Naglalaman ng datos para sa move in date kaugnay ng property_reservations |
| `message` | `TEXT` | YES | None | Naglalaman ng datos para sa message kaugnay ng property_reservations |
| `status` | `VARCHAR(50)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

#### Table: `property_units`
- **Functional Module:** 2. Property, Units & Inventory Management
- **Deskripsyon / Silbi:** Mga partikular na kwarto o yunit sa loob ng isang paupahan. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 19

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `unit_number` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa unit number kaugnay ng property_units |
| `unit_type` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa unit type kaugnay ng property_units |
| `monthly_rent` | `DECIMAL(10` | NO | None | Halaga ng buwanang upa (PHP) |
| `security_deposit` | `DECIMAL(10` | YES | None | Halaga ng paunang deposito bago makalipat |
| `capacity` | `INTEGER` | NO | None | Naglalaman ng datos para sa capacity kaugnay ng property_units |
| `bedrooms` | `INTEGER` | YES | None | Naglalaman ng datos para sa bedrooms kaugnay ng property_units |
| `bathrooms` | `INTEGER` | YES | None | Naglalaman ng datos para sa bathrooms kaugnay ng property_units |
| `floor_area_sqm` | `DECIMAL(6` | YES | None | Naglalaman ng datos para sa floor area sqm kaugnay ng property_units |
| `status` | `VARCHAR(50)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `main_image_url` | `TEXT` | YES | None | Naglalaman ng datos para sa main image url kaugnay ng property_units |
| `description` | `TEXT` | YES | None | Naglalaman ng datos para sa description kaugnay ng property_units |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |
| `floor` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa floor kaugnay ng property_units |
| `gender_restriction` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa gender restriction kaugnay ng property_units |
| `rental_style` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa rental style kaugnay ng property_units |
| `room_name` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa room name kaugnay ng property_units |

#### Table: `unit_amenities`
- **Functional Module:** 2. Property, Units & Inventory Management
- **Deskripsyon / Silbi:** Mga partikular na amenities na eksklusibo sa bawat unit. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 4

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `unit_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na unit o kwarto (property_units table) |
| `amenity_name` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa amenity name kaugnay ng unit_amenities |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |

#### Table: `unit_images`
- **Functional Module:** 2. Property, Units & Inventory Management
- **Deskripsyon / Silbi:** Gallery ng mga larawan para sa indibidwal na kwarto/yunit. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 6

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `unit_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na unit o kwarto (property_units table) |
| `image_url` | `TEXT` | NO | None | Naglalaman ng datos para sa image url kaugnay ng unit_images |
| `image_path` | `TEXT` | NO | None | Naglalaman ng datos para sa image path kaugnay ng unit_images |
| `is_main` | `BOOLEAN` | YES | None | Naglalaman ng datos para sa is main kaugnay ng unit_images |
| `uploaded_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa uploaded at kaugnay ng unit_images |

#### Table: `unit_beds`
- **Functional Module:** 2. Property, Units & Inventory Management
- **Deskripsyon / Silbi:** Bedspace inventory at pagkakakilanlan ng bawat higaan/kama. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 8

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `unit_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na unit o kwarto (property_units table) |
| `bed_number` | `INTEGER` | NO | None | Naglalaman ng datos para sa bed number kaugnay ng unit_beds |
| `bed_label` | `TEXT` | YES | None | Naglalaman ng datos para sa bed label kaugnay ng unit_beds |
| `status` | `TEXT` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `monthly_rent` | `NUMERIC(10` | NO | None | Halaga ng buwanang upa (PHP) |
| `created_at` | `TIMESTAMPTZ` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMPTZ` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

---

### 3. Multi-Criteria Recommendation Engine (TOPSIS / MCDM)
> Naglalaman ng execution logs at scoring metrics para sa multi-criteria recommendation algorithm na sumusukat sa kagustuhan ng tenant (upang matukoy ang pinaka-angkop na paupahan).

#### Table: `recommendation_runs`
- **Functional Module:** 3. Multi-Criteria Recommendation Engine (TOPSIS / MCDM)
- **Deskripsyon / Silbi:** Kasaysayan ng pagtakbo ng TOPSIS algorithm bawat search query. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 13

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `formula_version` | `VARCHAR(40)` | NO | None | Naglalaman ng datos para sa formula version kaugnay ng recommendation_runs |
| `tenant_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `generated_at` | `TIMESTAMPTZ` | NO | None | Naglalaman ng datos para sa generated at kaugnay ng recommendation_runs |
| `tenant_input_snapshot` | `JSONB` | NO | None | Naglalaman ng datos para sa tenant input snapshot kaugnay ng recommendation_runs |
| `active_criteria` | `TEXT` | NO | None | Naglalaman ng datos para sa active criteria kaugnay ng recommendation_runs |
| `raw_importance` | `JSONB` | NO | None | Naglalaman ng datos para sa raw importance kaugnay ng recommendation_runs |
| `normalized_weights` | `JSONB` | NO | None | Naglalaman ng datos para sa normalized weights kaugnay ng recommendation_runs |
| `platform_priors` | `JSONB` | NO | None | Naglalaman ng datos para sa platform priors kaugnay ng recommendation_runs |
| `candidate_count` | `INTEGER` | NO | None | Naglalaman ng datos para sa candidate count kaugnay ng recommendation_runs |
| `eligible_count` | `INTEGER` | NO | None | Naglalaman ng datos para sa eligible count kaugnay ng recommendation_runs |
| `excluded_count` | `INTEGER` | NO | None | Naglalaman ng datos para sa excluded count kaugnay ng recommendation_runs |
| `created_at` | `TIMESTAMPTZ` | NO | None | Timestamp kung kailan ginawa ang record sa system |

#### Table: `recommendation_candidates`
- **Functional Module:** 3. Multi-Criteria Recommendation Engine (TOPSIS / MCDM)
- **Deskripsyon / Silbi:** Mga kalkuladong marka at ranggo ng bawat property sa TOPSIS run. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 12

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `recommendation_run_id` | `UUID` | NO | FK | Naglalaman ng datos para sa recommendation run id kaugnay ng recommendation_candidates |
| `property_id` | `UUID` | NO | None | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `rank` | `INTEGER` | NO | None | Naglalaman ng datos para sa rank kaugnay ng recommendation_candidates |
| `eligibility_passed` | `BOOLEAN` | NO | None | Naglalaman ng datos para sa eligibility passed kaugnay ng recommendation_candidates |
| `raw_score` | `DOUBLE` | NO | None | Naglalaman ng datos para sa raw score kaugnay ng recommendation_candidates |
| `display_score` | `NUMERIC(5` | NO | None | Naglalaman ng datos para sa display score kaugnay ng recommendation_candidates |
| `criterion_scores` | `JSONB` | NO | None | Naglalaman ng datos para sa criterion scores kaugnay ng recommendation_candidates |
| `fallback_flags` | `JSONB` | NO | None | Naglalaman ng datos para sa fallback flags kaugnay ng recommendation_candidates |
| `property_input_snapshot` | `JSONB` | NO | None | Naglalaman ng datos para sa property input snapshot kaugnay ng recommendation_candidates |
| `explanation_snapshot` | `JSONB` | NO | None | Naglalaman ng datos para sa explanation snapshot kaugnay ng recommendation_candidates |
| `created_at` | `TIMESTAMPTZ` | NO | None | Timestamp kung kailan ginawa ang record sa system |

#### Table: `recommendation_exclusions`
- **Functional Module:** 3. Multi-Criteria Recommendation Engine (TOPSIS / MCDM)
- **Deskripsyon / Silbi:** Mga paupahang na-filter o hindi pumasa sa pamantayan ng tenant. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 5

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `recommendation_run_id` | `UUID` | NO | FK | Naglalaman ng datos para sa recommendation run id kaugnay ng recommendation_exclusions |
| `property_id` | `UUID` | NO | None | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `reason_codes` | `TEXT` | NO | None | Naglalaman ng datos para sa reason codes kaugnay ng recommendation_exclusions |
| `created_at` | `TIMESTAMPTZ` | NO | None | Timestamp kung kailan ginawa ang record sa system |

---

### 4. Tenant Screening & Rental Applications
> Naglalaman ng proseso ng aplikasyon ng mga naghahanap ng matitirhan, mga isinumiteng requirements (Valid ID, Proof of Income, COE), at screening evaluation.

#### Table: `tenant_applications`
- **Functional Module:** 4. Tenant Screening & Rental Applications
- **Deskripsyon / Silbi:** Pormal na aplikasyon ng tenant para umupa ng property/unit/bed. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 15

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `tenant_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `property_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `landlord_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `reservation_id` | `UUID` | YES | FK | Naglalaman ng datos para sa reservation id kaugnay ng tenant_applications |
| `application_message` | `TEXT` | YES | None | Naglalaman ng datos para sa application message kaugnay ng tenant_applications |
| `desired_move_in_date` | `DATE` | NO | None | Naglalaman ng datos para sa desired move in date kaugnay ng tenant_applications |
| `status` | `VARCHAR(50)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `landlord_remarks` | `TEXT` | YES | None | Naglalaman ng datos para sa landlord remarks kaugnay ng tenant_applications |
| `submitted_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa submitted at kaugnay ng tenant_applications |
| `reviewed_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa reviewed at kaugnay ng tenant_applications |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |
| `unit_id` | `VARCHAR / JSONB / UUID` | YES | FK | Foreign key na tumutukoy sa partikular na unit o kwarto (property_units table) |
| `bed_id` | `VARCHAR / JSONB / UUID` | YES | FK | Foreign key na tumutukoy sa partikular na kama/bedspace (unit_beds table) |

#### Table: `tenant_application_documents`
- **Functional Module:** 4. Tenant Screening & Rental Applications
- **Deskripsyon / Silbi:** Mga kalakip na requirements (ID, COE, proof of billing) ng aplikante. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 10

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `application_id` | `UUID` | YES | FK | Naglalaman ng datos para sa application id kaugnay ng tenant_application_documents |
| `tenant_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `document_type` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa document type kaugnay ng tenant_application_documents |
| `file_name` | `VARCHAR(255)` | NO | None | Naglalaman ng datos para sa file name kaugnay ng tenant_application_documents |
| `file_url` | `TEXT` | NO | None | Naglalaman ng datos para sa file url kaugnay ng tenant_application_documents |
| `file_path` | `TEXT` | NO | None | Naglalaman ng datos para sa file path kaugnay ng tenant_application_documents |
| `mime_type` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa mime type kaugnay ng tenant_application_documents |
| `file_size` | `INTEGER` | NO | None | Naglalaman ng datos para sa file size kaugnay ng tenant_application_documents |
| `uploaded_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa uploaded at kaugnay ng tenant_application_documents |

#### Table: `tenant_screening`
- **Functional Module:** 4. Tenant Screening & Rental Applications
- **Deskripsyon / Silbi:** Screening score at pagsusuri ng landlord sa kredensyal ng tenant. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 17

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `application_id` | `UUID` | NO | FK | Naglalaman ng datos para sa application id kaugnay ng tenant_screening |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `landlord_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `monthly_income` | `DECIMAL(12` | NO | None | Naglalaman ng datos para sa monthly income kaugnay ng tenant_screening |
| `employment_status` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa employment status kaugnay ng tenant_screening |
| `employment_details` | `TEXT` | YES | None | Naglalaman ng datos para sa employment details kaugnay ng tenant_screening |
| `payment_behavior_score` | `INTEGER` | YES | None | Naglalaman ng datos para sa payment behavior score kaugnay ng tenant_screening |
| `previous_rental_history` | `VARCHAR(50)` | YES | None | Naglalaman ng datos para sa previous rental history kaugnay ng tenant_screening |
| `rental_conduct_notes` | `VARCHAR(50)` | YES | None | Naglalaman ng datos para sa rental conduct notes kaugnay ng tenant_screening |
| `screening_score` | `INTEGER` | YES | None | Naglalaman ng datos para sa screening score kaugnay ng tenant_screening |
| `screening_result_label` | `VARCHAR(50)` | YES | None | Naglalaman ng datos para sa screening result label kaugnay ng tenant_screening |
| `screening_remarks` | `TEXT` | YES | None | Naglalaman ng datos para sa screening remarks kaugnay ng tenant_screening |
| `status` | `VARCHAR(50)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

---

### 5. Digital Lease Contract Management
> Naglalaman ng kumpletong digital lease agreements, terms and conditions, monthly rates, security deposits, house rules, at electronic signatures ng landlord at tenant.

#### Table: `lease_records`
- **Functional Module:** 5. Digital Lease Contract Management
- **Deskripsyon / Silbi:** Opisyal na kontrata ng upa (digital lease agreement) at lagda. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 37

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `application_id` | `UUID` | NO | FK | Naglalaman ng datos para sa application id kaugnay ng lease_records |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `lease_start_date` | `DATE` | NO | None | Naglalaman ng datos para sa lease start date kaugnay ng lease_records |
| `lease_end_date` | `DATE` | NO | None | Naglalaman ng datos para sa lease end date kaugnay ng lease_records |
| `monthly_rent` | `DECIMAL(10` | NO | None | Halaga ng buwanang upa (PHP) |
| `security_deposit` | `DECIMAL(10` | NO | None | Halaga ng paunang deposito bago makalipat |
| `lease_status` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa lease status kaugnay ng lease_records |
| `terms_and_conditions` | `TEXT` | YES | None | Naglalaman ng datos para sa terms and conditions kaugnay ng lease_records |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |
| `lease_number` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa lease number kaugnay ng lease_records |
| `advance_payment` | `VARCHAR / JSONB / UUID` | YES | None | Halaga ng advance rental payment |
| `payment_due_day` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa payment due day kaugnay ng lease_records |
| `utilities_covered` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa utilities covered kaugnay ng lease_records |
| `utilities_other` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa utilities other kaugnay ng lease_records |
| `max_occupants` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa max occupants kaugnay ng lease_records |
| `pet_policy` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa pet policy kaugnay ng lease_records |
| `pet_conditions` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa pet conditions kaugnay ng lease_records |
| `smoking_policy` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa smoking policy kaugnay ng lease_records |
| `parking_policy` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa parking policy kaugnay ng lease_records |
| `parking_slot_number` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa parking slot number kaugnay ng lease_records |
| `house_rules` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa house rules kaugnay ng lease_records |
| `landlord_responsibilities` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa landlord responsibilities kaugnay ng lease_records |
| `tenant_responsibilities` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa tenant responsibilities kaugnay ng lease_records |
| `late_fee_amount` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa late fee amount kaugnay ng lease_records |
| `grace_period` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa grace period kaugnay ng lease_records |
| `termination_policy` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa termination policy kaugnay ng lease_records |
| `additional_terms` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa additional terms kaugnay ng lease_records |
| `landlord_signature_name` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa landlord signature name kaugnay ng lease_records |
| `landlord_signature_date` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa landlord signature date kaugnay ng lease_records |
| `tenant_signature_name` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa tenant signature name kaugnay ng lease_records |
| `tenant_signature_date` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa tenant signature date kaugnay ng lease_records |
| `unit_id` | `VARCHAR / JSONB / UUID` | YES | FK | Foreign key na tumutukoy sa partikular na unit o kwarto (property_units table) |
| `bed_id` | `VARCHAR / JSONB / UUID` | YES | FK | Foreign key na tumutukoy sa partikular na kama/bedspace (unit_beds table) |

---

### 6. Utility Tracking, Billing & Payment Processing
> Naglalaman ng meter reading para sa kuryente at tubig, buwanang billing statements, transaction records, reference numbers, at proof of payment verification.

#### Table: `utility_records`
- **Functional Module:** 6. Utility Tracking, Billing & Payment Processing
- **Deskripsyon / Silbi:** Talaan ng monthly sub-meter reading sa kuryente at tubig. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 15

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `utility_type` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa utility type kaugnay ng utility_records |
| `billing_month` | `VARCHAR(20)` | NO | None | Naglalaman ng datos para sa billing month kaugnay ng utility_records |
| `previous_reading` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa previous reading kaugnay ng utility_records |
| `current_reading` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa current reading kaugnay ng utility_records |
| `consumption` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa consumption kaugnay ng utility_records |
| `rate_per_unit` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa rate per unit kaugnay ng utility_records |
| `total_amount` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa total amount kaugnay ng utility_records |
| `remarks` | `TEXT` | YES | None | Naglalaman ng datos para sa remarks kaugnay ng utility_records |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

#### Table: `billing_records`
- **Functional Module:** 6. Utility Tracking, Billing & Payment Processing
- **Deskripsyon / Silbi:** Buwanang singilin sa upa, kuryente, tubig, at iba pang bayarin. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 21

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `billing_month` | `VARCHAR(20)` | NO | None | Naglalaman ng datos para sa billing month kaugnay ng billing_records |
| `rent_amount` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa rent amount kaugnay ng billing_records |
| `utility_amount` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa utility amount kaugnay ng billing_records |
| `penalty_amount` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa penalty amount kaugnay ng billing_records |
| `total_amount` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa total amount kaugnay ng billing_records |
| `due_date` | `DATE` | NO | None | Naglalaman ng datos para sa due date kaugnay ng billing_records |
| `billing_status` | `VARCHAR(50)` | NO | None | Estado ng singil (pending_payment, waiting_verification, paid, overdue) |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |
| `water` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa water kaugnay ng billing_records |
| `electricity` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa electricity kaugnay ng billing_records |
| `internet` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa internet kaugnay ng billing_records |
| `parking` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa parking kaugnay ng billing_records |
| `other_charges` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa other charges kaugnay ng billing_records |
| `remarks` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa remarks kaugnay ng billing_records |
| `unit_id` | `VARCHAR / JSONB / UUID` | YES | FK | Foreign key na tumutukoy sa partikular na unit o kwarto (property_units table) |

#### Table: `payment_records`
- **Functional Module:** 6. Utility Tracking, Billing & Payment Processing
- **Deskripsyon / Silbi:** Transaksyon sa pagbabayad, resibo, at verification status. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 17

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `billing_id` | `UUID` | NO | FK | Naglalaman ng datos para sa billing id kaugnay ng payment_records |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `payment_amount` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa payment amount kaugnay ng payment_records |
| `payment_method` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa payment method kaugnay ng payment_records |
| `payment_reference_number` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa payment reference number kaugnay ng payment_records |
| `payment_proof_url` | `TEXT` | NO | None | Naglalaman ng datos para sa payment proof url kaugnay ng payment_records |
| `payment_proof_path` | `TEXT` | NO | None | Naglalaman ng datos para sa payment proof path kaugnay ng payment_records |
| `payment_status` | `VARCHAR(50)` | NO | None | Estado ng bayad (pending_verification, verified, rejected) |
| `verification_remarks` | `TEXT` | YES | None | Naglalaman ng datos para sa verification remarks kaugnay ng payment_records |
| `submitted_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa submitted at kaugnay ng payment_records |
| `verified_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa verified at kaugnay ng payment_records |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

---

### 7. Maintenance Operations & Work Order Tracking
> Naglalaman ng mga maintenance request tickets, pagtatalaga ng personnel o landlord workers, progress tracking (travelling, repairing, completed), materyales, at liquidation reports.

#### Table: `maintenance_requests`
- **Functional Module:** 7. Maintenance Operations & Work Order Tracking
- **Deskripsyon / Silbi:** Tiket ng sirang pasilidad na inireklamo ng tenant para kumpunihin. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 31

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `assigned_maintenance_id` | `UUID` | YES | FK | Naglalaman ng datos para sa assigned maintenance id kaugnay ng maintenance_requests |
| `issue_title` | `VARCHAR(255)` | NO | None | Maikling pamagat o paksa ng idinulog na problema |
| `issue_description` | `TEXT` | NO | None | Detalyadong paliwanag ng kailangang ayusin o problema |
| `issue_category` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa issue category kaugnay ng maintenance_requests |
| `priority_level` | `VARCHAR(50)` | NO | None | Lebel ng pangangailangan (low, medium, high, emergency) |
| `image_url` | `TEXT` | YES | None | Naglalaman ng datos para sa image url kaugnay ng maintenance_requests |
| `image_path` | `TEXT` | YES | None | Naglalaman ng datos para sa image path kaugnay ng maintenance_requests |
| `status` | `VARCHAR(50)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `landlord_remarks` | `TEXT` | YES | None | Naglalaman ng datos para sa landlord remarks kaugnay ng maintenance_requests |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |
| `completed_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa completed at kaugnay ng maintenance_requests |
| `preferred_schedule` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa preferred schedule kaugnay ng maintenance_requests |
| `unit_number` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa unit number kaugnay ng maintenance_requests |
| `rejection_reason` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa rejection reason kaugnay ng maintenance_requests |
| `travel_started_at` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa travel started at kaugnay ng maintenance_requests |
| `arrived_at` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa arrived at kaugnay ng maintenance_requests |
| `repair_started_at` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa repair started at kaugnay ng maintenance_requests |
| `problem_found` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa problem found kaugnay ng maintenance_requests |
| `repair_performed` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa repair performed kaugnay ng maintenance_requests |
| `recommendations` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa recommendations kaugnay ng maintenance_requests |
| `before_photo_url` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa before photo url kaugnay ng maintenance_requests |
| `after_photo_url` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa after photo url kaugnay ng maintenance_requests |
| `labor_cost` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa labor cost kaugnay ng maintenance_requests |
| `material_cost` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa material cost kaugnay ng maintenance_requests |
| `unit_id` | `VARCHAR / JSONB / UUID` | YES | FK | Foreign key na tumutukoy sa partikular na unit o kwarto (property_units table) |

#### Table: `maintenance_categories`
- **Functional Module:** 7. Maintenance Operations & Work Order Tracking
- **Deskripsyon / Silbi:** Mga klasipikasyon ng maintenance work (Plumbing, Electrical, etc.). Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 2

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `category_name` | `VARCHAR(50)` | NO | UNIQUE | Naglalaman ng datos para sa category name kaugnay ng maintenance_categories |

#### Table: `maintenance_assignments`
- **Functional Module:** 7. Maintenance Operations & Work Order Tracking
- **Deskripsyon / Silbi:** Pagtatalaga ng technician o maintenance personnel sa tiket. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 6

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `maintenance_request_id` | `UUID` | NO | FK | Naglalaman ng datos para sa maintenance request id kaugnay ng maintenance_assignments |
| `maintenance_personnel_id` | `UUID` | NO | FK | Naglalaman ng datos para sa maintenance personnel id kaugnay ng maintenance_assignments |
| `due_date` | `DATE` | NO | None | Naglalaman ng datos para sa due date kaugnay ng maintenance_assignments |
| `instructions` | `TEXT` | YES | None | Naglalaman ng datos para sa instructions kaugnay ng maintenance_assignments |
| `assigned_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa assigned at kaugnay ng maintenance_assignments |

#### Table: `maintenance_updates`
- **Functional Module:** 7. Maintenance Operations & Work Order Tracking
- **Deskripsyon / Silbi:** Status timeline at work logs ng technician habang nag-aayos. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 5

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `maintenance_request_id` | `UUID` | NO | FK | Naglalaman ng datos para sa maintenance request id kaugnay ng maintenance_updates |
| `status_update` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa status update kaugnay ng maintenance_updates |
| `notes` | `TEXT` | YES | None | Naglalaman ng datos para sa notes kaugnay ng maintenance_updates |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |

#### Table: `maintenance_task_updates`
- **Functional Module:** 7. Maintenance Operations & Work Order Tracking
- **Deskripsyon / Silbi:** Granular checklist updates sa bawat hakbang ng pagkumpuni. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 8

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `maintenance_request_id` | `UUID` | NO | FK | Naglalaman ng datos para sa maintenance request id kaugnay ng maintenance_task_updates |
| `maintenance_personnel_id` | `UUID` | NO | FK | Naglalaman ng datos para sa maintenance personnel id kaugnay ng maintenance_task_updates |
| `status_update` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa status update kaugnay ng maintenance_task_updates |
| `progress_notes` | `TEXT` | NO | None | Naglalaman ng datos para sa progress notes kaugnay ng maintenance_task_updates |
| `image_url` | `TEXT` | YES | None | Naglalaman ng datos para sa image url kaugnay ng maintenance_task_updates |
| `image_path` | `TEXT` | YES | None | Naglalaman ng datos para sa image path kaugnay ng maintenance_task_updates |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |

#### Table: `maintenance_photos`
- **Functional Module:** 7. Maintenance Operations & Work Order Tracking
- **Deskripsyon / Silbi:** Katibayan ng sira at natapos na gawa (Before & After photos). Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 5

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `maintenance_request_id` | `UUID` | NO | FK | Naglalaman ng datos para sa maintenance request id kaugnay ng maintenance_photos |
| `photo_url` | `TEXT` | NO | None | Naglalaman ng datos para sa photo url kaugnay ng maintenance_photos |
| `photo_type` | `VARCHAR(50)` | YES | None | Naglalaman ng datos para sa photo type kaugnay ng maintenance_photos |
| `uploaded_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa uploaded at kaugnay ng maintenance_photos |

#### Table: `maintenance_materials`
- **Functional Module:** 7. Maintenance Operations & Work Order Tracking
- **Deskripsyon / Silbi:** Talaan ng piyesa at materyales na binili kasama ang gastos. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 5

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `maintenance_request_id` | `UUID` | NO | FK | Naglalaman ng datos para sa maintenance request id kaugnay ng maintenance_materials |
| `material_name` | `VARCHAR(255)` | NO | None | Naglalaman ng datos para sa material name kaugnay ng maintenance_materials |
| `quantity` | `INTEGER` | NO | None | Naglalaman ng datos para sa quantity kaugnay ng maintenance_materials |
| `cost` | `DECIMAL(10` | NO | None | Naglalaman ng datos para sa cost kaugnay ng maintenance_materials |

#### Table: `maintenance_reports`
- **Functional Module:** 7. Maintenance Operations & Work Order Tracking
- **Deskripsyon / Silbi:** Panghuling ulat at likidasyon ng natapos na maintenance job. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 10

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `maintenance_request_id` | `UUID` | NO | FK | Naglalaman ng datos para sa maintenance request id kaugnay ng maintenance_reports |
| `maintenance_personnel_id` | `UUID` | NO | FK | Naglalaman ng datos para sa maintenance personnel id kaugnay ng maintenance_reports |
| `problem_found` | `TEXT` | NO | None | Naglalaman ng datos para sa problem found kaugnay ng maintenance_reports |
| `repair_performed` | `TEXT` | NO | None | Naglalaman ng datos para sa repair performed kaugnay ng maintenance_reports |
| `materials_used` | `TEXT` | YES | None | Naglalaman ng datos para sa materials used kaugnay ng maintenance_reports |
| `recommendations` | `TEXT` | YES | None | Naglalaman ng datos para sa recommendations kaugnay ng maintenance_reports |
| `labor_cost` | `DECIMAL(10` | YES | None | Naglalaman ng datos para sa labor cost kaugnay ng maintenance_reports |
| `material_cost` | `DECIMAL(10` | YES | None | Naglalaman ng datos para sa material cost kaugnay ng maintenance_reports |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |

---

### 8. Complaints, Disputes & Policy Governance
> Naglalaman ng mga reklamo ng tenants tungkol sa living conditions, status logs, alitan na nangangailangan ng mediation ng admin, at logs ng policy violations.

#### Table: `complaints`
- **Functional Module:** 8. Complaints, Disputes & Policy Governance
- **Deskripsyon / Silbi:** Pormal na reklamo ng tenant ukol sa kapaligiran o kapitbahay. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 18

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `complaint_number` | `VARCHAR(30)` | NO | UNIQUE | Naglalaman ng datos para sa complaint number kaugnay ng complaints |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `category` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa category kaugnay ng complaints |
| `subject` | `VARCHAR(255)` | NO | None | Naglalaman ng datos para sa subject kaugnay ng complaints |
| `description` | `TEXT` | NO | None | Naglalaman ng datos para sa description kaugnay ng complaints |
| `attachment_url` | `TEXT` | YES | None | Naglalaman ng datos para sa attachment url kaugnay ng complaints |
| `attachment_path` | `TEXT` | YES | None | Naglalaman ng datos para sa attachment path kaugnay ng complaints |
| `status` | `VARCHAR(30)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `resolution_notes` | `TEXT` | YES | None | Naglalaman ng datos para sa resolution notes kaugnay ng complaints |
| `rejection_reason` | `TEXT` | YES | None | Naglalaman ng datos para sa rejection reason kaugnay ng complaints |
| `resolved_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa resolved at kaugnay ng complaints |
| `closed_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa closed at kaugnay ng complaints |
| `submitted_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa submitted at kaugnay ng complaints |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

#### Table: `complaint_status_logs`
- **Functional Module:** 8. Complaints, Disputes & Policy Governance
- **Deskripsyon / Silbi:** Timeline ng aksyon at imbestigasyon ng landlord sa reklamo. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 7

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `complaint_id` | `UUID` | NO | FK | Naglalaman ng datos para sa complaint id kaugnay ng complaint_status_logs |
| `updated_by` | `UUID` | NO | FK | Naglalaman ng datos para sa updated by kaugnay ng complaint_status_logs |
| `previous_status` | `VARCHAR(30)` | NO | None | Naglalaman ng datos para sa previous status kaugnay ng complaint_status_logs |
| `new_status` | `VARCHAR(30)` | NO | None | Naglalaman ng datos para sa new status kaugnay ng complaint_status_logs |
| `remarks` | `TEXT` | YES | None | Naglalaman ng datos para sa remarks kaugnay ng complaint_status_logs |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

#### Table: `disputes`
- **Functional Module:** 8. Complaints, Disputes & Policy Governance
- **Deskripsyon / Silbi:** Pormal na hidwaan na inakyat sa admin para sa opisyal na mediation. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 15

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `complainant_id` | `UUID` | NO | FK | Naglalaman ng datos para sa complainant id kaugnay ng disputes |
| `respondent_id` | `UUID` | NO | FK | Naglalaman ng datos para sa respondent id kaugnay ng disputes |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `dispute_type` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa dispute type kaugnay ng disputes |
| `dispute_title` | `VARCHAR(255)` | NO | None | Naglalaman ng datos para sa dispute title kaugnay ng disputes |
| `dispute_description` | `TEXT` | NO | None | Naglalaman ng datos para sa dispute description kaugnay ng disputes |
| `attachment_url` | `TEXT` | YES | None | Naglalaman ng datos para sa attachment url kaugnay ng disputes |
| `attachment_path` | `TEXT` | YES | None | Naglalaman ng datos para sa attachment path kaugnay ng disputes |
| `status` | `VARCHAR(50)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `resolution_notes` | `TEXT` | YES | None | Naglalaman ng datos para sa resolution notes kaugnay ng disputes |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |
| `resolved_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa resolved at kaugnay ng disputes |

#### Table: `policy_violations`
- **Functional Module:** 8. Complaints, Disputes & Policy Governance
- **Deskripsyon / Silbi:** Talaan ng paglabag sa mga alituntunin o house rules. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 14

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `reported_by` | `UUID` | NO | FK | Naglalaman ng datos para sa reported by kaugnay ng policy_violations |
| `violator_id` | `UUID` | NO | FK | Naglalaman ng datos para sa violator id kaugnay ng policy_violations |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `violation_type` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa violation type kaugnay ng policy_violations |
| `violation_description` | `TEXT` | NO | None | Naglalaman ng datos para sa violation description kaugnay ng policy_violations |
| `evidence_url` | `TEXT` | YES | None | Naglalaman ng datos para sa evidence url kaugnay ng policy_violations |
| `evidence_path` | `TEXT` | YES | None | Naglalaman ng datos para sa evidence path kaugnay ng policy_violations |
| `status` | `VARCHAR(50)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `action_taken` | `TEXT` | YES | None | Naglalaman ng datos para sa action taken kaugnay ng policy_violations |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |
| `resolved_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa resolved at kaugnay ng policy_violations |

---

### 9. Incident Reporting, Case Triage & Case Messaging
> Naglalaman ng mga pormal na incident reports na isinampa ng tenant laban sa landlord o ng landlord laban sa tenant, mga kalakip na ebidensya, at live chat logs sa bawat case.

#### Table: `tenant_reports`
- **Functional Module:** 9. Incident Reporting, Case Triage & Case Messaging
- **Deskripsyon / Silbi:** Opisyal na ulat ng tenant laban sa landlord o pamunuan. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 17

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `report_category` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa report category kaugnay ng tenant_reports |
| `incident_date` | `DATE` | NO | None | Naglalaman ng datos para sa incident date kaugnay ng tenant_reports |
| `incident_description` | `TEXT` | NO | None | Naglalaman ng datos para sa incident description kaugnay ng tenant_reports |
| `severity` | `VARCHAR(20)` | NO | None | Naglalaman ng datos para sa severity kaugnay ng tenant_reports |
| `status` | `VARCHAR(30)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `admin_id` | `UUID` | YES | FK | Naglalaman ng datos para sa admin id kaugnay ng tenant_reports |
| `admin_remarks` | `TEXT` | YES | None | Naglalaman ng datos para sa admin remarks kaugnay ng tenant_reports |
| `reviewed_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa reviewed at kaugnay ng tenant_reports |
| `tenant_explanation` | `TEXT` | YES | None | Naglalaman ng datos para sa tenant explanation kaugnay ng tenant_reports |
| `tenant_responded_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa tenant responded at kaugnay ng tenant_reports |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

#### Table: `tenant_report_evidence`
- **Functional Module:** 9. Incident Reporting, Case Triage & Case Messaging
- **Deskripsyon / Silbi:** Mga kalakip na ebidensya at screenshot ng tenant incident report. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 8

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `report_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa incident report ticket |
| `file_name` | `VARCHAR(255)` | NO | None | Naglalaman ng datos para sa file name kaugnay ng tenant_report_evidence |
| `file_url` | `TEXT` | NO | None | Naglalaman ng datos para sa file url kaugnay ng tenant_report_evidence |
| `file_path` | `TEXT` | NO | None | Naglalaman ng datos para sa file path kaugnay ng tenant_report_evidence |
| `file_type` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa file type kaugnay ng tenant_report_evidence |
| `file_size` | `BIGINT` | YES | None | Naglalaman ng datos para sa file size kaugnay ng tenant_report_evidence |
| `uploaded_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa uploaded at kaugnay ng tenant_report_evidence |

#### Table: `landlord_reports`
- **Functional Module:** 9. Incident Reporting, Case Triage & Case Messaging
- **Deskripsyon / Silbi:** Opisyal na ulat ng landlord laban sa pasaway na tenant. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 19

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `report_category` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa report category kaugnay ng landlord_reports |
| `report_category` | `IN` | YES | None | Naglalaman ng datos para sa report category kaugnay ng landlord_reports |
| `incident_date` | `DATE` | NO | None | Naglalaman ng datos para sa incident date kaugnay ng landlord_reports |
| `incident_description` | `TEXT` | NO | None | Naglalaman ng datos para sa incident description kaugnay ng landlord_reports |
| `severity` | `VARCHAR(20)` | NO | None | Naglalaman ng datos para sa severity kaugnay ng landlord_reports |
| `severity` | `IN` | YES | None | Naglalaman ng datos para sa severity kaugnay ng landlord_reports |
| `status` | `VARCHAR(30)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `admin_id` | `UUID` | YES | FK | Naglalaman ng datos para sa admin id kaugnay ng landlord_reports |
| `admin_remarks` | `TEXT` | YES | None | Naglalaman ng datos para sa admin remarks kaugnay ng landlord_reports |
| `reviewed_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa reviewed at kaugnay ng landlord_reports |
| `landlord_explanation` | `TEXT` | YES | None | Naglalaman ng datos para sa landlord explanation kaugnay ng landlord_reports |
| `landlord_responded_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa landlord responded at kaugnay ng landlord_reports |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

#### Table: `landlord_report_evidence`
- **Functional Module:** 9. Incident Reporting, Case Triage & Case Messaging
- **Deskripsyon / Silbi:** Mga litrato at patunay ng kapabayaan o pagkasira mula sa landlord. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 8

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `report_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa incident report ticket |
| `file_name` | `VARCHAR(255)` | NO | None | Naglalaman ng datos para sa file name kaugnay ng landlord_report_evidence |
| `file_url` | `TEXT` | NO | None | Naglalaman ng datos para sa file url kaugnay ng landlord_report_evidence |
| `file_path` | `TEXT` | NO | None | Naglalaman ng datos para sa file path kaugnay ng landlord_report_evidence |
| `file_type` | `VARCHAR(100)` | NO | None | Naglalaman ng datos para sa file type kaugnay ng landlord_report_evidence |
| `file_size` | `BIGINT` | YES | None | Naglalaman ng datos para sa file size kaugnay ng landlord_report_evidence |
| `uploaded_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa uploaded at kaugnay ng landlord_report_evidence |

#### Table: `user_reports`
- **Functional Module:** 9. Incident Reporting, Case Triage & Case Messaging
- **Deskripsyon / Silbi:** Pangkalahatang ulat ng mga user na dumadaan sa case triage ng admin. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 14

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `reporter_id` | `UUID` | NO | FK | Naglalaman ng datos para sa reporter id kaugnay ng user_reports |
| `reported_user_id` | `UUID` | NO | FK | Naglalaman ng datos para sa reported user id kaugnay ng user_reports |
| `property_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `report_type` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa report type kaugnay ng user_reports |
| `report_title` | `VARCHAR(255)` | NO | None | Naglalaman ng datos para sa report title kaugnay ng user_reports |
| `report_description` | `TEXT` | NO | None | Naglalaman ng datos para sa report description kaugnay ng user_reports |
| `attachment_url` | `TEXT` | YES | None | Naglalaman ng datos para sa attachment url kaugnay ng user_reports |
| `attachment_path` | `TEXT` | YES | None | Naglalaman ng datos para sa attachment path kaugnay ng user_reports |
| `status` | `VARCHAR(50)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `admin_remarks` | `TEXT` | YES | None | Naglalaman ng datos para sa admin remarks kaugnay ng user_reports |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |
| `resolved_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa resolved at kaugnay ng user_reports |

#### Table: `report_messages`
- **Functional Module:** 9. Incident Reporting, Case Triage & Case Messaging
- **Deskripsyon / Silbi:** Live case communication logs sa pagitan ng complainant, respondent, at admin. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 10

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `VARCHAR / JSONB / UUID` | YES | PK | Primary unique identifier para sa record (UUID) |
| `report_type` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa report type kaugnay ng report_messages |
| `report_id` | `VARCHAR / JSONB / UUID` | YES | FK | Foreign key na tumutukoy sa incident report ticket |
| `sender_id` | `VARCHAR / JSONB / UUID` | YES | FK | Naglalaman ng datos para sa sender id kaugnay ng report_messages |
| `sender_role` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa sender role kaugnay ng report_messages |
| `recipient_role` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa recipient role kaugnay ng report_messages |
| `message_text` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa message text kaugnay ng report_messages |
| `attachment_url` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa attachment url kaugnay ng report_messages |
| `attachment_path` | `VARCHAR / JSONB / UUID` | YES | None | Naglalaman ng datos para sa attachment path kaugnay ng report_messages |
| `created_at` | `VARCHAR / JSONB / UUID` | YES | None | Timestamp kung kailan ginawa ang record sa system |

---

### 10. Ratings, Reviews & Feedback System
> Naglalaman ng mga star ratings at reviews para sa property at landlord, trust score metrics, at aggregate feedback summary para sa public display.

#### Table: `property_ratings`
- **Functional Module:** 10. Ratings, Reviews & Feedback System
- **Deskripsyon / Silbi:** Star rating at ebalwasyon ng tenant sa kalidad ng paupahan. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 19

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `cleanliness` | `INTEGER` | NO | None | Naglalaman ng datos para sa cleanliness kaugnay ng property_ratings |
| `safety` | `INTEGER` | NO | None | Naglalaman ng datos para sa safety kaugnay ng property_ratings |
| `comfort` | `INTEGER` | NO | None | Naglalaman ng datos para sa comfort kaugnay ng property_ratings |
| `amenities` | `INTEGER` | NO | None | Naglalaman ng datos para sa amenities kaugnay ng property_ratings |
| `location` | `INTEGER` | NO | None | Naglalaman ng datos para sa location kaugnay ng property_ratings |
| `internet_availability` | `INTEGER` | NO | None | Naglalaman ng datos para sa internet availability kaugnay ng property_ratings |
| `water_supply` | `INTEGER` | NO | None | Naglalaman ng datos para sa water supply kaugnay ng property_ratings |
| `electricity_reliability` | `INTEGER` | NO | None | Naglalaman ng datos para sa electricity reliability kaugnay ng property_ratings |
| `noise_level` | `INTEGER` | NO | None | Naglalaman ng datos para sa noise level kaugnay ng property_ratings |
| `overall_satisfaction` | `INTEGER` | NO | None | Naglalaman ng datos para sa overall satisfaction kaugnay ng property_ratings |
| `overall_computed_avg` | `DECIMAL(3` | NO | None | Naglalaman ng datos para sa overall computed avg kaugnay ng property_ratings |
| `feedback` | `TEXT` | NO | None | Naglalaman ng datos para sa feedback kaugnay ng property_ratings |
| `submitted_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa submitted at kaugnay ng property_ratings |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

#### Table: `landlord_ratings_v2`
- **Functional Module:** 10. Ratings, Reviews & Feedback System
- **Deskripsyon / Silbi:** Detalyadong marka sa pagiging maaasahan at katarungan ng landlord. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 17

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `communication` | `INTEGER` | NO | None | Naglalaman ng datos para sa communication kaugnay ng landlord_ratings_v2 |
| `responsiveness` | `INTEGER` | NO | None | Naglalaman ng datos para sa responsiveness kaugnay ng landlord_ratings_v2 |
| `professionalism` | `INTEGER` | NO | None | Naglalaman ng datos para sa professionalism kaugnay ng landlord_ratings_v2 |
| `fairness` | `INTEGER` | NO | None | Naglalaman ng datos para sa fairness kaugnay ng landlord_ratings_v2 |
| `maintenance_response` | `INTEGER` | NO | None | Naglalaman ng datos para sa maintenance response kaugnay ng landlord_ratings_v2 |
| `respectfulness` | `INTEGER` | NO | None | Naglalaman ng datos para sa respectfulness kaugnay ng landlord_ratings_v2 |
| `reliability` | `INTEGER` | NO | None | Naglalaman ng datos para sa reliability kaugnay ng landlord_ratings_v2 |
| `overall_satisfaction` | `INTEGER` | NO | None | Naglalaman ng datos para sa overall satisfaction kaugnay ng landlord_ratings_v2 |
| `overall_computed_avg` | `DECIMAL(3` | NO | None | Naglalaman ng datos para sa overall computed avg kaugnay ng landlord_ratings_v2 |
| `feedback` | `TEXT` | NO | None | Naglalaman ng datos para sa feedback kaugnay ng landlord_ratings_v2 |
| `submitted_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa submitted at kaugnay ng landlord_ratings_v2 |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

#### Table: `landlord_ratings`
- **Functional Module:** 10. Ratings, Reviews & Feedback System
- **Deskripsyon / Silbi:** Talaan ng rating na ibinigay sa landlord. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 9

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `rating` | `INTEGER` | NO | None | Naglalaman ng datos para sa rating kaugnay ng landlord_ratings |
| `feedback` | `TEXT` | NO | None | Naglalaman ng datos para sa feedback kaugnay ng landlord_ratings |
| `submitted_at` | `TIMESTAMP` | YES | None | Naglalaman ng datos para sa submitted at kaugnay ng landlord_ratings |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

#### Table: `ratings_feedback`
- **Functional Module:** 10. Ratings, Reviews & Feedback System
- **Deskripsyon / Silbi:** Mensahe at nakasulat na rebyu mula sa tenant matapos manirahan. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 12

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `tenant_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa umuupa o aplikante (users table) |
| `landlord_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa may-ari ng paupahan (users table) |
| `property_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `lease_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa active lease contract (lease_records table) |
| `rating` | `INTEGER` | NO | None | Naglalaman ng datos para sa rating kaugnay ng ratings_feedback |
| `feedback_text` | `TEXT` | YES | None | Naglalaman ng datos para sa feedback text kaugnay ng ratings_feedback |
| `feedback_type` | `VARCHAR(50)` | NO | None | Naglalaman ng datos para sa feedback type kaugnay ng ratings_feedback |
| `is_authenticated` | `BOOLEAN` | NO | None | Naglalaman ng datos para sa is authenticated kaugnay ng ratings_feedback |
| `status` | `VARCHAR(50)` | NO | None | Kasalukuyang estado ng daloy ng proseso |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

#### Table: `property_feedback_summary`
- **Functional Module:** 10. Ratings, Reviews & Feedback System
- **Deskripsyon / Silbi:** Naka-cache na kabuuang marka at bilang ng reviews bawat property. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 8

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `property_id` | `UUID` | YES | FK | Foreign key na tumutukoy sa partikular na paupahan (properties table) |
| `rating_average` | `DECIMAL(3` | NO | None | Naglalaman ng datos para sa rating average kaugnay ng property_feedback_summary |
| `total_feedback` | `INTEGER` | NO | None | Naglalaman ng datos para sa total feedback kaugnay ng property_feedback_summary |
| `positive_summary` | `TEXT` | YES | None | Naglalaman ng datos para sa positive summary kaugnay ng property_feedback_summary |
| `negative_summary` | `TEXT` | YES | None | Naglalaman ng datos para sa negative summary kaugnay ng property_feedback_summary |
| `created_at` | `TIMESTAMP` | YES | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | YES | None | Timestamp ng pinakahuling pagbabago sa record |

---

### 11. System Notifications
> Naglalaman ng real-time in-app notification alerts para sa mga user tuwing may bagong bill, maintenance update, application status, o case message.

#### Table: `notifications`
- **Functional Module:** 11. System Notifications
- **Deskripsyon / Silbi:** In-app notification alerts para sa mga mahahalagang anunsyo at aktibidad. Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.
- **Primary Key:** `id`
- **Bilang ng Columns:** 9

| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |
|:---|:---|:---:|:---:|:---|
| `id` | `UUID` | NO | PK | Primary unique identifier para sa record (UUID) |
| `user_id` | `UUID` | NO | FK | Foreign key na tumutukoy sa gumagamit sa users table |
| `type` | `VARCHAR(80)` | NO | None | Naglalaman ng datos para sa type kaugnay ng notifications |
| `title` | `VARCHAR(255)` | NO | None | Naglalaman ng datos para sa title kaugnay ng notifications |
| `message` | `TEXT` | NO | None | Naglalaman ng datos para sa message kaugnay ng notifications |
| `reference_id` | `TEXT` | YES | None | Naglalaman ng datos para sa reference id kaugnay ng notifications |
| `read_status` | `BOOLEAN` | NO | None | Naglalaman ng datos para sa read status kaugnay ng notifications |
| `created_at` | `TIMESTAMP` | NO | None | Timestamp kung kailan ginawa ang record sa system |
| `updated_at` | `TIMESTAMP` | NO | None | Timestamp ng pinakahuling pagbabago sa record |

---

