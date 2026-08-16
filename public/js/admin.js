(function () {
    'use strict';

    const GOVERNANCE_STAGES = [
        { key: 'access', label: 'Access', href: 'users.html' },
        { key: 'verify', label: 'Verify', href: 'property-review.html' },
        { key: 'monitor', label: 'Monitor', href: 'payments.html' },
        { key: 'resolve', label: 'Resolve', href: 'reports.html' },
        { key: 'govern', label: 'Govern', href: 'policy-management.html' }
    ];

    const PAGE_META = {
        'overview.html': {
            eyebrow: 'Operational command center',
            description: 'See the queues that need administrative attention, then move into the correct review surface before taking action.',
            action: { label: 'Open case triage', href: 'reports.html' }
        },
        'users.html': {
            eyebrow: 'Identity & access',
            description: 'Approve legitimate role requests, disable compromised access, and preserve a clear account-status history.',
            stage: 'access'
        },
        'property-review.html': {
            eyebrow: 'Listing verification',
            description: 'Prioritize new property submissions and verify ownership, location, documentation, and listing readiness.',
            stage: 'verify'
        },
        'property-review-details.html': {
            eyebrow: 'Property evidence review',
            description: 'Inspect the complete submission and record an approval or a specific, actionable rejection reason.',
            stage: 'verify',
            action: { label: 'Back to review queue', href: 'property-review.html', secondary: true }
        },
        'reservations.html': {
            eyebrow: 'Reservation oversight',
            description: 'Monitor pending requests, move-in intent, and status decisions across all participating properties.',
            stage: 'monitor'
        },
        'payments.html': {
            eyebrow: 'Financial monitoring',
            description: 'Audit submitted payment evidence, reference codes, parties, billing periods, and verification outcomes.',
            stage: 'monitor'
        },
        'reports.html': {
            eyebrow: 'Trust & safety operations',
            description: 'Triage reports by urgency, collect balanced evidence, and record proportionate, traceable outcomes.',
            stage: 'resolve',
            showSummary: false
        },
        'report-detail.html': {
            eyebrow: 'Case investigation',
            description: 'Keep allegations, evidence, inquiries, explanations, and the final administrative decision in one case record.',
            stage: 'resolve',
            showSummary: false,
            action: { label: 'Back to case queue', href: 'reports.html', secondary: true }
        },
        'policy-management.html': {
            eyebrow: 'Policy governance',
            description: 'Maintain clear platform rules and ensure published guidance matches the standards used in administrative decisions.',
            stage: 'govern',
            showSummary: false
        },
        'audit-logs.html': {
            eyebrow: 'Compliance record',
            description: 'Trace security, transaction, and administrative events by role, action, and date without altering the source record.',
            stage: 'govern'
        }
    };

    function currentPage() {
        return window.location.pathname.split('/').pop() || 'overview.html';
    }

    function createSummary(meta) {
        const summary = document.createElement('section');
        summary.className = 'admin-page-summary';
        summary.setAttribute('aria-labelledby', 'appPageTitle');

        const copy = document.createElement('div');
        copy.className = 'admin-page-summary__copy';
        const eyebrow = document.createElement('p');
        eyebrow.className = 'admin-page-eyebrow';
        eyebrow.textContent = meta.eyebrow;
        const description = document.createElement('p');
        description.className = 'admin-page-description';
        description.textContent = meta.description;
        copy.append(eyebrow, description);
        summary.appendChild(copy);

        if (meta.action) {
            const action = document.createElement('a');
            action.href = meta.action.href;
            action.className = `admin-summary-action${meta.action.secondary ? ' secondary' : ''}`;
            action.textContent = meta.action.label;
            summary.appendChild(action);
        }
        return summary;
    }

    function createGovernanceFlow(activeStage) {
        if (!activeStage) return null;
        const nav = document.createElement('nav');
        nav.className = 'admin-governance-flow';
        nav.setAttribute('aria-label', 'Administrative control flow');

        GOVERNANCE_STAGES.forEach((stage, index) => {
            const link = document.createElement('a');
            link.href = stage.href;
            link.className = `admin-governance-step${stage.key === activeStage ? ' active' : ''}`;
            if (stage.key === activeStage) link.setAttribute('aria-current', 'step');
            const number = document.createElement('span');
            number.textContent = String(index + 1);
            const label = document.createElement('strong');
            label.textContent = stage.label;
            link.append(number, label);
            nav.appendChild(link);
        });
        return nav;
    }

    function enhanceAdminContent(content, page) {
        content.querySelectorAll('table').forEach(table => {
            table.classList.add('admin-data-table');
            const wrapper = table.parentElement;
            if (wrapper?.classList.contains('ui-table-wrapper')) wrapper.classList.add('admin-table-scroll');
            enhanceResponsiveTable(table);
        });
        content.querySelectorAll('form').forEach(form => form.classList.add('admin-form'));

        if (['users.html', 'reservations.html'].includes(page)) {
            content.querySelectorAll('.nav-back').forEach(back => {
                if (back.querySelector('a[href="reports.html"]')) back.remove();
            });
        }

        removeDuplicatePageHeading(content, page);
        addDirectoryControls(content, page);

        if (page === 'reports.html') {
            document.getElementById('investigateModal')?.remove();
        }
    }

    function removeDuplicatePageHeading(content, page) {
        if (['payments.html', 'property-review.html'].includes(page)) {
            const heading = content.querySelector('.dashboard-container > h2');
            const description = heading?.nextElementSibling;
            heading?.remove();
            if (description?.tagName === 'P') description.remove();
        }

        if (['users.html', 'reservations.html'].includes(page)) {
            const heading = content.querySelector('.dashboard-container > div > h2');
            if (heading) {
                const row = heading.parentElement;
                heading.remove();
                row?.classList.add('admin-inline-feedback-row');
            }
        }

        if (page === 'property-review-details.html') {
            content.querySelector('.nav-back')?.remove();
            const heading = content.querySelector('.dashboard-container h2');
            const copy = heading?.parentElement;
            const row = copy?.parentElement;
            const description = copy?.querySelector('p');
            description?.remove();
            heading?.remove();
            row?.classList.add('admin-detail-status-row');
        }
    }

    function enhanceResponsiveTable(table) {
        if (table.classList.contains('audit-table')) return;
        table.classList.add('admin-record-table');

        const labelCells = () => {
            const labels = Array.from(table.querySelectorAll('thead th')).map(header => header.textContent.trim());
            table.querySelectorAll('tbody tr').forEach(row => {
                Array.from(row.cells).forEach((cell, index) => {
                    if (cell.colSpan > 1) {
                        cell.classList.add('admin-table-state-cell');
                        return;
                    }
                    cell.dataset.label = labels[index] || 'Details';
                });
            });
        };

        labelCells();
        const observer = new MutationObserver(labelCells);
        const body = table.tBodies[0];
        if (body) observer.observe(body, { childList: true, subtree: true });
    }

    function addDirectoryControls(content, page) {
        const configs = {
            'users.html': { placeholder: 'Search by name, email, role, or status', statuses: ['pending', 'active', 'disabled', 'rejected'] },
            'reservations.html': { placeholder: 'Search by tenant, property, message, or status', statuses: ['pending', 'approved', 'rejected', 'cancelled'] },
            'payments.html': { placeholder: 'Search by tenant, landlord, property, reference, or status', statuses: ['pending verification', 'verified', 'rejected'] }
        };
        const config = configs[page];
        const table = content.querySelector('.admin-record-table');
        if (!config || !table || content.querySelector('.admin-table-controls')) return;

        const controls = document.createElement('div');
        controls.className = 'admin-table-controls';
        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'form-input admin-table-search';
        search.placeholder = config.placeholder;
        search.setAttribute('aria-label', config.placeholder);

        const status = document.createElement('select');
        status.className = 'form-input admin-table-status-filter';
        status.setAttribute('aria-label', 'Filter by status');
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'All statuses';
        status.appendChild(allOption);
        config.statuses.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = formatLabel(value);
            status.appendChild(option);
        });

        const count = document.createElement('span');
        count.className = 'admin-table-result-count';
        count.setAttribute('aria-live', 'polite');
        controls.append(search, status, count);
        table.parentElement?.insertBefore(controls, table);

        const filterRows = () => {
            const query = search.value.trim().toLowerCase();
            const statusValue = status.value;
            let visible = 0;
            table.querySelectorAll('tbody tr').forEach(row => {
                if (row.querySelector('[colspan]')) return;
                const text = row.textContent.toLowerCase();
                const badgeText = row.querySelector('.status-badge')?.textContent.trim().toLowerCase() || '';
                const matches = (!query || text.includes(query)) && (!statusValue || badgeText.includes(statusValue));
                row.hidden = !matches;
                if (matches) visible += 1;
            });
            count.textContent = `${visible} ${visible === 1 ? 'record' : 'records'} shown`;
        };

        search.addEventListener('input', filterRows);
        status.addEventListener('change', filterRows);
        const body = table.tBodies[0];
        if (body) new MutationObserver(filterRows).observe(body, { childList: true });
        filterRows();
    }

    async function requestData(url, token) {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        const result = await response.json();
        return Array.isArray(result.data) ? result.data : [];
    }

    function setMetric(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = Number.isFinite(value) ? String(value) : '—';
    }

    async function loadOverview() {
        const queue = document.getElementById('adminPriorityQueue');
        if (!queue) return;
        const token = localStorage.getItem('domiknow_token');
        if (!token) return;

        const requests = await Promise.allSettled([
            requestData('/api/users', token),
            requestData('/api/admin/properties/review', token),
            requestData('/api/reservations', token),
            requestData('/api/admin/monitor/payments', token),
            requestData('/api/admin/tenant-reports', token),
            requestData('/api/admin/landlord-reports', token)
        ]);
        const [usersResult, propertiesResult, reservationsResult, paymentsResult, tenantReportsResult, landlordReportsResult] = requests;
        const users = usersResult.status === 'fulfilled' ? usersResult.value : [];
        const properties = propertiesResult.status === 'fulfilled' ? propertiesResult.value : [];
        const reservations = reservationsResult.status === 'fulfilled' ? reservationsResult.value : [];
        const payments = paymentsResult.status === 'fulfilled' ? paymentsResult.value : [];
        const tenantReports = tenantReportsResult.status === 'fulfilled'
            ? tenantReportsResult.value.map(item => ({ ...item, _type: 'tenant_report' })) : [];
        const landlordReports = landlordReportsResult.status === 'fulfilled'
            ? landlordReportsResult.value.map(item => ({ ...item, _type: 'landlord_report' })) : [];
        const reports = [...tenantReports, ...landlordReports];
        const openStatuses = new Set(['pending', 'pending_admin_review', 'in_review', 'needs_more_evidence']);

        const pendingUsers = users.filter(user => user.account_status === 'pending');
        const pendingProperties = properties.filter(property => property.status === 'pending_review');
        const pendingReservations = reservations.filter(reservation => reservation.status === 'pending');
        const pendingPayments = payments.filter(payment => ['pending', 'pending_verification'].includes(payment.payment_status));
        const openReports = reports.filter(report => openStatuses.has(report.status));

        setMetric('overviewPendingUsers', pendingUsers.length);
        setMetric('overviewPendingProperties', pendingProperties.length);
        setMetric('overviewPendingReservations', pendingReservations.length);
        setMetric('overviewPendingPayments', pendingPayments.length);
        setMetric('overviewOpenCases', openReports.length);

        const priorityItems = [
            ...openReports.map(report => ({
                kind: 'Case',
                title: formatLabel(report.report_category || 'Incident report'),
                meta: `${formatLabel(report.severity || 'normal')} priority · ${formatLabel(report.status)}`,
                date: report.created_at,
                href: `report-detail.html?id=${encodeURIComponent(report.id)}&type=${encodeURIComponent(report._type)}`,
                priority: ['critical', 'major', 'high'].includes(report.severity) ? 4 : 3
            })),
            ...pendingProperties.map(property => ({
                kind: 'Property',
                title: property.property_name || 'Property submission',
                meta: `${property.landlord_name || 'Landlord'} · ${property.barangay || 'Siniloan'}`,
                date: property.created_at,
                href: `property-review-details.html?id=${encodeURIComponent(property.id)}`,
                priority: 2
            })),
            ...pendingUsers.map(user => ({
                kind: 'Access',
                title: user.full_name || user.email || 'Account request',
                meta: `${formatLabel(user.role)} · Awaiting approval`,
                date: user.created_at,
                href: 'users.html',
                priority: 1
            }))
        ].sort((left, right) => right.priority - left.priority || new Date(right.date || 0) - new Date(left.date || 0));

        queue.replaceChildren();
        if (!priorityItems.length) {
            const empty = document.createElement('div');
            empty.className = 'admin-queue-empty';
            empty.textContent = 'No account, property, or case reviews currently require attention.';
            queue.appendChild(empty);
        } else {
            priorityItems.slice(0, 7).forEach(item => queue.appendChild(createQueueItem(item)));
        }

        const failedCount = requests.filter(result => result.status === 'rejected').length;
        const notice = document.getElementById('overviewLoadNotice');
        if (notice) {
            notice.dataset.state = failedCount ? 'warning' : 'success';
            notice.textContent = failedCount
                ? `${failedCount} data ${failedCount === 1 ? 'source is' : 'sources are'} temporarily unavailable. Available queues are shown.`
                : 'Operational snapshot updated from all administrative queues.';
        }
    }

    function createQueueItem(item) {
        const link = document.createElement('a');
        link.href = item.href;
        link.className = 'admin-queue-item';
        const kind = document.createElement('span');
        kind.className = `admin-queue-kind admin-queue-kind--${item.kind.toLowerCase()}`;
        kind.textContent = item.kind;
        const copy = document.createElement('span');
        copy.className = 'admin-queue-copy';
        const title = document.createElement('strong');
        title.textContent = item.title;
        const meta = document.createElement('small');
        meta.textContent = item.meta;
        copy.append(title, meta);
        const action = document.createElement('span');
        action.className = 'admin-queue-action';
        action.textContent = 'Review';
        link.append(kind, copy, action);
        return link;
    }

    function formatLabel(value) {
        return String(value || 'Not specified').replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
    }

    function initialize() {
        const layout = document.querySelector('.dashboard-layout-admin');
        const content = layout?.querySelector('.main-content-inner');
        const page = currentPage();
        const meta = PAGE_META[page];
        if (!layout || !content || !meta || content.querySelector('.admin-module-intro')) return;

        document.body.setAttribute('data-admin-page', page.replace('.html', ''));
        const intro = document.createElement('div');
        intro.className = 'admin-module-intro';
        if (meta.showSummary !== false) intro.appendChild(createSummary(meta));
        const flow = createGovernanceFlow(meta.stage);
        if (flow) intro.appendChild(flow);
        content.insertBefore(intro, content.firstChild);
        enhanceAdminContent(content, page);
        if (page === 'overview.html') loadOverview();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
}());
