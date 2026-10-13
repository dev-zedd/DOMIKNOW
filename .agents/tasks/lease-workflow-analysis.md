# DOMIKNOW Lease Agreement Workflow Analysis

## Executive Summary

This analysis examines the current lease agreement workflow in DOMIKNOW, evaluating how landlords create lease contracts and identify gaps for implementing:
1. **Pre-filling lease agreements** based on landlord property details
2. **Automating monthly billing** based on lease terms

## Section 1: Current Lease Agreement Workflow

### Step-by-Step Process

1. **Application Approval**: Landlord approves a tenant application through `/landlord/applications.html`
2. **Lease Creation**: Landlord navigates to `/landlord/leases.html` and clicks "Create Lease Agreement"
3. **Form Pre-population**: System redirects to `/landlord/lease-create.html` with optional `?application_id=` parameter
4. **Manual Data Entry**: Landlord fills comprehensive lease form with:
   - Lease dates (start/end)
   - Financial terms (rent, deposit, advance payment, due day)
   - Property policies (pet, smoking, parking, utilities)
   - Legal terms (rules, responsibilities, termination policy)
5. **Electronic Signature**: Landlord's signature is auto-applied upon form submission
6. **Tenant Review**: Lease status set to `pending_tenant_acceptance`, tenant receives notification
7. **Tenant Response**: Tenant can accept or reject the lease via their portal
8. **Activation**: Upon acceptance, lease becomes `active` and initial billing is auto-generated

### Technical Flow
- **Route**: `POST /api/leases` → `leaseController.createLease()`
- **Data Source**: Approved `tenant_applications` record
- **Validation**: Lease dates, payment terms, application ownership
- **Auto-features**: Lease number generation, landlord signature stamping

## Section 2: Database Schema Summary

### Core Tables and Relationships

#### lease_records
**Purpose**: Primary lease agreement storage
**Key Columns**:
- `application_id` → links to `tenant_applications.id`
- `property_id` → links to `properties.id` 
- `unit_id` → links to `property_units.id` (optional)
- `bed_id` → links to `unit_beds.id` (optional)
- Financial: `monthly_rent`, `security_deposit`, `advance_payment`, `payment_due_day`
- Terms: `utilities_covered` (JSONB), policy fields, responsibilities text
- Signatures: `landlord_signature_name/date`, `tenant_signature_name/date`
- Status: `lease_status` (pending_tenant_acceptance, accepted, rejected, active, expired, terminated, ended, cancelled)

#### properties
**Purpose**: Property master data that can pre-fill leases
**Pre-fillable Fields**:
- `property_name`, `address`, `barangay`, `municipality`, `province`
- `monthly_rent` (baseline), `max_occupants`  
- `house_rules`, `tenant_type_suitability`
- `unit_number` (added in schema patches)

#### property_units  
**Purpose**: Unit-level details (alternative to property-level data)
**Pre-fillable Fields**:
- `unit_number`, `monthly_rent`, `security_deposit`, `capacity`
- `bedrooms`, `bathrooms`, `floor_area_sqm`
- `status` (available/occupied/reserved)

#### property_amenities & unit_amenities
**Purpose**: Structured amenity data
**Pre-fillable Use**: Can inform utilities coverage and property features in lease

#### billing_records
**Purpose**: Monthly billing automation target
**Key Columns**:
- `lease_id` → direct link to active lease
- `billing_month`, `due_date` → derived from lease terms
- Financial breakdown: `rent_amount`, `water`, `electricity`, `internet`, `parking`, `other_charges`
- `billing_status` → payment workflow states

### Data Relationships for Pre-filling
```
tenant_applications → properties → lease_records
                  ↳ property_units ↗
                  ↳ unit_beds ↗
```

## Section 3: Frontend & Backend Implementation Details

### Frontend Architecture

#### Lease Creation Form (`/public/pages/landlord/lease-create.html`)
**Current Features**:
- Two-panel layout: info sidebar + main form
- Application selector dropdown (pre-filtered for approved applications)  
- Comprehensive form sections: dates, financials, policies, terms
- URL parameter support: `?application_id=` for direct linking
- Real-time validation and date constraints
- Electronic signature consent integration

**Data Flow**:
1. Page loads → fetches approved applications via `GET /api/landlord/applications`
2. Application selection → populates info sidebar with tenant/property data
3. Form submission → `POST /api/leases` with all lease terms

#### Lease Management (`/public/pages/landlord/leases.html`)
**Current Features**:
- Tabular lease registry with status filtering
- Action buttons: View, Edit, Update Status
- Modal-based lease detail viewer
- Integration with billing and payment workflows

### Backend Architecture

#### leaseController.js
**Key Methods**:
- `createLease()`: Main lease creation with validation
- `updateLeaseDetails()`: Edit pending/rejected leases  
- `acceptLease()`: Tenant acceptance workflow
- `getLandlordLeases()`: Lease directory for landlords

**Current Pre-filling**: 
- Fetches application details via `landlordModel.findApplicationDetails()`
- Auto-extracts: `tenant_id`, `property_id`, `unit_id`, `bed_id` from application
- Auto-generates: lease number, landlord signature

#### Data Models
- **leaseModel.js**: CRUD operations for lease_records
- **landlordModel.js**: Application and property data fetching
- **billingModel.js**: Monthly billing generation

## Section 4: Existing Integration Points

### Application → Lease Data Flow
**Currently Automatic**:
- Tenant information (ID, name, contact, desired move-in date)
- Property selection (property_id, unit_id, bed_id)
- Landlord information (ID, signature name)

**Currently Manual**:
- All financial terms (rent amount, deposit, advance payment)
- All lease dates (start date, end date, payment due day)
- All policies (utilities, pets, smoking, parking, rules)
- All legal terms (responsibilities, conditions, additional terms)

### Lease → Billing Integration
**Currently Implemented**:
- Auto-generation of initial "Move-In" billing upon lease acceptance
- Includes: monthly rent + security deposit + advance payment
- Linked via `lease_id` in billing_records
- Due date set to lease start date

**Manual Process**:
- Landlords manually create monthly recurring bills via `/landlord/billings.html`
- Must manually enter rent amount, due date, utility charges each month
- No automation based on lease payment_due_day or recurring schedules

## Section 5: Gaps for Pre-filling Enhancement

### Property Data Not Currently Used
**Available but Unused in Lease Creation**:
- `properties.monthly_rent` → could auto-fill lease rent amount
- `properties.house_rules` → could auto-fill lease house_rules field  
- `properties.max_occupants` → could auto-fill lease max_occupants
- `property_units.monthly_rent` → unit-specific rent (overrides property-level)
- `property_units.security_deposit` → unit-specific deposit amount
- `property_units.capacity` → unit-specific occupancy limit

### Amenity-Based Utility Pre-filling
**Available Data**:
- `property_amenities` + `unit_amenities` tables contain structured amenity data
- Common utilities: 'WiFi', 'Water', 'Electricity', 'Parking'

**Enhancement Opportunity**:
- Map amenities to `utilities_covered` JSONB field in leases
- Auto-detect included utilities and pre-configure billing exclusions

### Policy Pre-filling from Property Type
**Available Data**:
- `properties.property_type` (apartment, boarding_house, bedspace, studio_unit, room_for_rent, house)
- `properties.tenant_type_suitability` (student, worker, family, general)

**Enhancement Opportunity**:  
- Define default policies by property type (e.g., boarding houses typically have shared amenities)
- Pre-fill parking_policy, pet_policy, smoking_policy based on property characteristics

### Address and Location Auto-fill
**Available Data**:
- Complete address: `address`, `barangay`, `municipality`, `province`
- GPS coordinates: `latitude`, `longitude`

**Current Gap**: Address details not automatically included in lease document generation

## Section 6: Gaps for Monthly Billing Automation

### Lease Terms Not Used for Automation
**Available but Unused**:
- `payment_due_day` (1-28) → should trigger monthly billing generation
- `lease_start_date` + `lease_end_date` → defines billing period bounds
- `monthly_rent` → should auto-populate billing rent_amount
- `utilities_covered` → should auto-exclude included utilities from billing
- `late_fee_amount` + `grace_period` → should auto-apply overdue penalties

### No Recurring Billing Scheduler
**Current Process**: 100% manual billing creation
**Missing Infrastructure**:
- Automated monthly job to generate bills for active leases
- Logic to calculate next billing date based on payment_due_day
- Automatic termination when lease_end_date reached

### Utility Integration Gaps
**Current Limitation**: 
- Utilities are manually entered per billing cycle
- No tracking of previous readings or consumption patterns  
- No auto-calculation based on lease utilities_covered configuration

**Database Support Exists**:
- `utility_records` table available for meter readings
- Billing breakdown fields: `water`, `electricity`, `internet`, `parking`

### Payment Due Date Calculation
**Current Process**: Landlord manually sets due_date for each bill
**Enhancement Opportunity**: 
- Auto-calculate based on `lease.payment_due_day` (e.g., if payment_due_day=5, January bill due on Jan 5)
- Handle month-end edge cases (due_day > days in month)

## Section 7: Recommended Implementation Approach

### Phase 1: Lease Pre-filling Enhancement

#### 1.1 Property Data Integration
**Modify**: `public/pages/landlord/lease-create.html`
**Enhancement**: When application selected, auto-populate:
```javascript
// When application is selected, fetch property details and pre-fill
async function populateFromProperty(applicationData) {
    const property = applicationData.properties;
    const unit = applicationData.property_units;
    
    // Pre-fill financial terms
    document.getElementById('monthlyRent').value = unit?.monthly_rent || property.monthly_rent;
    document.getElementById('securityDeposit').value = unit?.security_deposit || property.monthly_rent;
    document.getElementById('maxOccupants').value = unit?.capacity || property.max_occupants;
    
    // Pre-fill policy defaults
    document.getElementById('houseRules').value = property.house_rules || '';
    
    // Pre-fill utilities based on amenities
    const amenities = property.amenities || [];
    populateUtilitiesFromAmenities(amenities);
}
```

#### 1.2 Amenity-Based Utility Configuration  
**Modify**: Lease creation form JavaScript
**Logic**: 
```javascript
function populateUtilitiesFromAmenities(amenities) {
    const utilities = {};
    utilities.water = amenities.includes('Water') ? 'included' : 'tenant_pays';
    utilities.electricity = amenities.includes('Electricity') ? 'included' : 'tenant_pays';
    utilities.internet = amenities.includes('WiFi') ? 'included' : 'tenant_pays';
    utilities.parking = amenities.includes('Parking') ? 'included' : 'not_applicable';
    
    // Update utilities_covered form fields
    updateUtilitiesFormFields(utilities);
}
```

#### 1.3 Smart Default Policies
**Enhancement**: Property type-based policy defaults
```javascript
function getDefaultPolicies(propertyType, tenantTypeSuitability) {
    const defaults = {
        boarding_house: {
            pet_policy: 'Not Allowed',
            smoking_policy: 'Not Allowed', 
            parking_policy: 'Shared/Limited'
        },
        apartment: {
            pet_policy: 'With Restrictions',
            smoking_policy: 'Not Allowed',
            parking_policy: 'Included'
        }
        // Add more property type defaults
    };
    return defaults[propertyType] || {};
}
```

### Phase 2: Monthly Billing Automation

#### 2.1 Scheduled Billing Generation
**New File**: `server/services/billingScheduler.js`
**Purpose**: Automated monthly billing creation
```javascript
async function generateMonthlyBills() {
    const today = new Date();
    const currentDay = today.getDate();
    
    // Find active leases with payment_due_day = currentDay
    const leases = await getActiveLeasesByDueDay(currentDay);
    
    for (const lease of leases) {
        await createMonthlyBilling(lease, today);
    }
}

async function createMonthlyBilling(lease, billDate) {
    const billing = {
        lease_id: lease.id,
        tenant_id: lease.tenant_id,
        landlord_id: lease.landlord_id,
        property_id: lease.property_id,
        unit_id: lease.unit_id,
        billing_month: billDate.toISOString().slice(0, 7), // YYYY-MM
        rent_amount: lease.monthly_rent,
        due_date: billDate.toISOString().slice(0, 10),
        billing_status: 'pending_payment',
        // Auto-exclude utilities marked as 'included' in lease
        water: lease.utilities_covered?.water === 'included' ? 0 : null,
        electricity: lease.utilities_covered?.electricity === 'included' ? 0 : null,
        internet: lease.utilities_covered?.internet === 'included' ? 0 : null
    };
    
    await billingModel.createBilling(billing);
}
```

#### 2.2 Cron Job Integration
**Modify**: `server/app.js` 
**Add**: Daily cron job to trigger billing generation
```javascript
const cron = require('node-cron');
const billingScheduler = require('./services/billingScheduler');

// Run daily at 9 AM to generate bills for leases with today's due day
cron.schedule('0 9 * * *', async () => {
    console.log('Running automated billing generation...');
    await billingScheduler.generateMonthlyBills();
});
```

#### 2.3 Enhanced Billing Controller
**Modify**: `server/controllers/billingController.js`
**Add**: Lease-aware billing creation with automatic field population

### Phase 3: Integration Testing & Validation

#### 3.1 Data Validation
- Ensure property/unit rent amounts are consistent
- Validate utilities_covered JSONB structure  
- Test edge cases (month-end due dates, leap years)

#### 3.2 Workflow Testing
- Create test lease with various property types
- Verify pre-filling accuracy across different scenarios
- Confirm billing automation triggers correctly

#### 3.3 User Experience Testing  
- Landlord workflow efficiency measurement
- Tenant notification and billing experience
- Error handling and fallback scenarios

### Implementation Priority
1. **High Priority**: Property data pre-filling (immediate landlord efficiency gain)
2. **Medium Priority**: Amenity-based utility configuration (reduces errors)  
3. **High Priority**: Monthly billing automation (reduces ongoing manual work)
4. **Low Priority**: Advanced policy defaults (nice-to-have enhancement)

This implementation approach leverages existing database structure and API patterns while significantly reducing manual data entry and automating recurring processes.