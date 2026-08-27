const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('unknown browser and API routes have separate 404 recovery responses', () => {
    const appSource = read('server/app.js');
    const apiFallbackIndex = appSource.indexOf("app.use('/api', (req, res) =>");
    const htmlFallbackIndex = appSource.indexOf("res.status(404).sendFile(path.join(__dirname, '../public/pages/404.html'))");
    const finalFeatureRouteIndex = appSource.indexOf("app.use('/api/storage', storageRoutes)");

    assert.ok(apiFallbackIndex > finalFeatureRouteIndex);
    assert.ok(htmlFallbackIndex > apiFallbackIndex);

    const notFoundPage = read('public/pages/404.html');
    assert.match(notFoundPage, /Browse verified rentals/);
    assert.match(notFoundPage, /Go back/);
    assert.match(notFoundPage, /Help and FAQs/);
    assert.match(notFoundPage, /id="mainContent"/);
});

test('admin overview exposes live, accessible operational analytics', () => {
    const overview = read('public/pages/admin/overview.html');
    const adminScript = read('public/js/admin.js');

    assert.match(overview, /id="adminWorkloadChart"/);
    assert.match(overview, /id="adminCaseChart"/);
    assert.match(overview, /id="adminAnalyticsRefresh"/);
    assert.match(adminScript, /renderOverviewAnalytics/);
    assert.match(adminScript, /aria-valuenow/);
    assert.match(adminScript, /availableSources/);
    assert.match(adminScript, /Unavailable/);
    assert.match(adminScript, /partial data/);
});

test('detail pages receive contextual breadcrumbs and public property onboarding', () => {
    const dashboardScript = read('public/js/dashboard.js');
    const walkthroughScript = read('public/js/walkthrough-system.js');

    assert.match(dashboardScript, /ensureContextBreadcrumbs/);
    assert.match(dashboardScript, /aria-label', 'Breadcrumb'/);
    assert.match(dashboardScript, /data-domiknow-page-style/);
    assert.match(dashboardScript, /legacyBreadcrumb\.removeAttribute\('style'\)/);
    assert.match(walkthroughScript, /'public-property'/);
    assert.match(walkthroughScript, /#availableSpacesSection/);
    assert.match(walkthroughScript, /domiknow:property-ready/);
});

test('public trust content uses verified feedback and a focused closing CTA', () => {
    const home = read('public/index.html');
    const feedbackScript = read('public/js/public-home.js');

    assert.match(home, /id="communityFeedback"/);
    assert.match(home, /class="public-final-cta"/);
    assert.match(home, /No payment is required to browse listings/);
    assert.match(feedbackScript, /DOMIKNOW does not use fabricated testimonials/);
    assert.match(feedbackScript, /Browse rentals/);
});

test('public and authentication journeys keep progressive actions clear and theme-safe', () => {
    const home = read('public/index.html');
    const listings = read('public/pages/public/properties.html');
    const forgotPassword = read('public/pages/auth/forgot-password.html');
    const verifyCode = read('public/pages/auth/verify-code.html');
    const authCss = read('public/css/auth-module.css');
    const publicCss = read('public/css/public-module.css');
    const designCss = read('public/css/design-system.css');
    const loadingScript = read('public/js/loading-system.js');

    assert.match(home, /class="nav-link public-nav-signup"/);
    assert.match(listings, /class="public-nav-signup"/);
    assert.match(forgotPassword, /id="resetForm"[^>]*hidden/);
    assert.match(forgotPassword, /auth-recovery-success__icon/);
    assert.match(verifyCode, /autocomplete="one-time-code"/);
    assert.match(authCss, /body\.auth-page \[hidden\]\s*\{\s*display:\s*none\s*!important/);
    assert.doesNotMatch(publicCss, /@view-transition\s*\{\s*navigation:\s*auto/);
    assert.doesNotMatch(designCss, /@view-transition\s*\{\s*navigation:\s*auto/);
    assert.match(loadingScript, /setAttribute\('aria-hidden', 'true'\)/);
    assert.match(loadingScript, /setAttribute\('aria-hidden', 'false'\)/);
});

test('recovery and field-operation polish preserve safe navigation and accessible evidence', () => {
    const notFoundPage = read('public/pages/404.html');
    const uiScript = read('public/js/ui.js');
    const maintenanceTask = read('public/pages/maintenance/task-details.html');

    assert.match(notFoundPage, /new URL\(document\.referrer\)\.origin === window\.location\.origin/);
    assert.match(uiScript, /path\.includes\('\/pages\/404'\)/);
    assert.match(maintenanceTask, /id="issueImg" alt="Maintenance issue evidence"/);
});

test('shared responsive polish covers tablets, phones, touch input, and legacy viewport locks', () => {
    const uiScript = read('public/js/ui.js');
    const responsiveCss = read('public/css/responsive-polish.css');

    assert.match(uiScript, /responsive-polish\.css/);
    assert.match(uiScript, /data-domiknow-responsive-polish/);
    assert.match(responsiveCss, /@media \(max-width: 1023px\)/);
    assert.match(responsiveCss, /@media \(max-width: 767px\)/);
    assert.match(responsiveCss, /@media \(max-width: 767px\) and \(orientation: landscape\)/);
    assert.match(responsiveCss, /@media \(hover: none\) and \(pointer: coarse\)/);
    assert.match(responsiveCss, /body\[data-tenant-page="application-details"\]/);
    assert.match(responsiveCss, /\.public-landing-page \.nav-links/);
    assert.doesNotMatch(responsiveCss, /\.public-landing-page \.nav-links\s*\{[^}]*display:\s*none/is);
});

test('missing payment proof objects use an explicit unavailable state', () => {
    const proofHelper = read('server/utils/paymentProofHelper.js');
    const dashboardScript = read('public/js/dashboard.js');
    const tenantPayments = read('public/pages/tenant/billings.html');
    const landlordPayments = read('public/pages/landlord/payments.html');
    const adminPayments = read('public/pages/admin/payments.html');

    assert.match(proofHelper, /payment_proof_available = false/);
    assert.match(proofHelper, /payment_proof_state = 'missing'/);
    assert.match(dashboardScript, /if \(!rawValue\) return '#'/);
    assert.match(tenantPayments, /This proof file is unavailable/);
    assert.match(landlordPayments, /No file exists at the stored path/);
    assert.match(adminPayments, /No file exists at the stored path/);
});

test('maintenance field workflows are mobile-first, recoverable, and use system dialogs', () => {
    const tasks = read('public/pages/maintenance/tasks.html');
    const details = read('public/pages/maintenance/task-details.html');
    const notifications = read('public/pages/maintenance/notifications.html');
    const maintenanceCss = read('public/css/maintenance.css');
    const loadingScript = read('public/js/loading-system.js');

    assert.match(tasks, /class="maintenance-data-table"/);
    assert.match(tasks, /data-label="Property and unit"/);
    assert.match(tasks, /Review offer/);
    assert.match(tasks, /View details/);
    assert.match(tasks, /renderTaskMessage/);
    assert.match(details, /id="taskLoadError"/);
    assert.match(details, /id="retryTaskButton"/);
    assert.match(details, /window\.domiknowConfirm/);
    assert.match(details, /showTaskNotice/);
    assert.doesNotMatch(details, /\balert\s*\(/);
    assert.doesNotMatch(details, /onclick=/);
    assert.match(notifications, /Assigned work, schedule changes, repair updates/);
    assert.match(maintenanceCss, /\.maintenance-data-table td::before/);
    assert.match(maintenanceCss, /grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(loadingScript, /record\.type === 'childList'/);
    assert.match(loadingScript, /scheduleLegacyUpgrade\(mutationRoot\)/);
});

test('tenant journeys prioritize results on mobile and keep consequential actions in system dialogs', () => {
    const tenantScript = read('public/js/tenant.js');
    const tenantCss = read('public/css/tenant.css');
    const dashboardScript = read('public/js/dashboard.js');
    const propertyDetails = read('public/pages/tenant/property-details.html');
    const applicationDetails = read('public/pages/tenant/application-details.html');
    const leases = read('public/pages/tenant/leases.html');
    const billings = read('public/pages/tenant/billings.html');
    const loadingScript = read('public/js/loading-system.js');

    assert.match(tenantScript, /improveDiscoveryPreferences/);
    assert.match(tenantScript, /Edit rental priorities/);
    assert.match(tenantScript, /tenant-preferences-collapsed/);
    assert.match(tenantCss, /\.recommendation-controls\.tenant-preferences-collapsed \.filter-section/);
    assert.match(tenantCss, /\.tenant-journey\s*\{[^}]*margin-left:\s*0 !important/is);
    assert.match(propertyDetails, /data-page-title="Property Details"/);
    assert.match(applicationDetails, /data-page-title="Application Details"/);
    assert.doesNotMatch(propertyDetails, /topbarTitle\.innerHTML/);
    assert.doesNotMatch(applicationDetails, /topbarTitle\.innerHTML/);
    assert.doesNotMatch(leases, /\balert\s*\(/);
    assert.doesNotMatch(billings, /\balert\s*\(/);
    assert.match(dashboardScript, /title: 'Keyboard shortcuts'/);
    assert.match(loadingScript, /data-dk-auto-loading/);
});

test('landlord operations stay searchable, responsive, and aligned to their parent workflow', () => {
    const landlordScript = read('public/js/landlord.js');
    const landlordCss = read('public/css/landlord.css');
    const dashboardScript = read('public/js/dashboard.js');
    const propertyCreate = read('public/pages/landlord/property-create.html');
    const maintenance = read('public/pages/landlord/maintenance.html');
    const modalCss = read('public/css/modal-system.css');

    assert.match(landlordScript, /window\.landlordNotice/);
    assert.match(landlordScript, /addTableControls/);
    assert.match(landlordScript, /Search visible records/);
    assert.match(landlordScript, /improveSteppers/);
    assert.match(landlordCss, /\.landlord-table-controls/);
    assert.match(landlordCss, /body\[data-landlord-page="units"\] \.room-grid/);
    assert.match(landlordCss, /max-height:\s*calc\(100dvh - 24px\)/);
    assert.match(dashboardScript, /'property-details\.html', 'units\.html'/);
    assert.match(dashboardScript, /'billings\.html', 'payments\.html'/);
    assert.match(propertyCreate, /button type="button" id="stepHeader1"/);
    assert.match(propertyCreate, /aria-controls="stepPanel1"/);
    assert.doesNotMatch(maintenance, /Tubo|Kuryente|Karpintero|Pintor/);
    assert.doesNotMatch(maintenance, />\s*\+ Add Maintenance Worker/);
    assert.match(modalCss, /\.dk-modal-root \[hidden\]\s*\{\s*display:\s*none\s*!important/);
});
