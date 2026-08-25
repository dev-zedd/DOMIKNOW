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
});

test('detail pages receive contextual breadcrumbs and public property onboarding', () => {
    const dashboardScript = read('public/js/dashboard.js');
    const walkthroughScript = read('public/js/walkthrough-system.js');

    assert.match(dashboardScript, /ensureContextBreadcrumbs/);
    assert.match(dashboardScript, /aria-label', 'Breadcrumb'/);
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
