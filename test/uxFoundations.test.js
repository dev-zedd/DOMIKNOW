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
