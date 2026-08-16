(function () {
    'use strict';

    const WORKFLOW_STEPS = [
        { key: 'discover', label: 'Explore', href: 'properties.html' },
        { key: 'apply', label: 'Apply', href: 'applications.html' },
        { key: 'lease', label: 'Lease', href: 'leases.html' },
        { key: 'pay', label: 'Pay', href: 'billings.html' }
    ];

    const PAGE_META = {
        'properties.html': {
            description: 'Find approved rentals in Siniloan, compare the details that matter, and choose with confidence.',
            eyebrow: 'Find your next home',
            step: 'discover'
        },
        'property-details.html': {
            description: 'Review the property, available spaces, amenities, location, and rental terms before you apply.',
            eyebrow: 'Property review',
            step: 'discover',
            action: { label: 'Back to homes', href: 'properties.html', secondary: true }
        },
        'apply.html': {
            description: 'Confirm your details and attach the required documents. You can track the landlord review after submission.',
            eyebrow: 'Rental application',
            step: 'apply'
        },
        'applications.html': {
            description: 'Track every application, landlord decision, requested document, and next step in one place.',
            eyebrow: 'Application pipeline',
            step: 'apply',
            action: { label: 'Explore homes', href: 'properties.html' }
        },
        'application-details.html': {
            description: 'Follow this application from submission through review and keep its supporting documents complete.',
            eyebrow: 'Application record',
            step: 'apply',
            action: { label: 'All applications', href: 'applications.html', secondary: true }
        },
        'leases.html': {
            description: 'Review your active agreement, dates, rental terms, parties, and signed lease documents.',
            eyebrow: 'Your tenancy',
            step: 'lease'
        },
        'billings.html': {
            description: 'See what is due, review statement details, submit payment proof, and track verification.',
            eyebrow: 'Money & records',
            step: 'pay'
        },
        'maintenance.html': {
            description: 'Report an issue with the right priority and keep track of every update until the work is complete.',
            eyebrow: 'Property care'
        },
        'disputes.html': {
            description: 'Create a clear case record, follow its review status, and keep communication in one place.',
            eyebrow: 'Resolution center'
        },
        'feedback.html': {
            description: 'Share verified feedback after a tenancy or maintenance experience and review your submissions.',
            eyebrow: 'Ratings & feedback'
        },
        'reports.html': {
            description: 'File a safety or conduct concern, respond to cases involving you, and follow administrative decisions.',
            eyebrow: 'Safety & accountability'
        },
        'landlord-report-form.html': {
            description: 'Document what happened, connect it to an active lease, and attach evidence for administrative review.',
            eyebrow: 'New incident report',
            action: { label: 'Reports center', href: 'reports.html', secondary: true }
        },
        'tenant-reports.html': {
            description: 'Review reports filed against you, see the current decision, and provide your explanation when requested.',
            eyebrow: 'Reports involving you',
            action: { label: 'Reports center', href: 'reports.html', secondary: true }
        },
        'policy-violations.html': {
            description: 'Review recorded policy concerns and submit a violation connected to an active lease.',
            eyebrow: 'Policy records'
        }
    };

    function currentPage() {
        return window.location.pathname.split('/').pop() || 'properties.html';
    }

    function createWorkflow(activeStep) {
        if (!activeStep) return null;

        const nav = document.createElement('nav');
        nav.className = 'tenant-journey';
        nav.setAttribute('aria-label', 'Rental journey');

        WORKFLOW_STEPS.forEach((step, index) => {
            const link = document.createElement('a');
            link.href = step.href;
            link.className = `tenant-journey-step${step.key === activeStep ? ' active' : ''}`;
            if (step.key === activeStep) link.setAttribute('aria-current', 'step');

            const number = document.createElement('span');
            number.className = 'tenant-journey-number';
            number.textContent = String(index + 1);

            const label = document.createElement('span');
            label.className = 'tenant-journey-label';
            label.textContent = step.label;

            link.append(number, label);
            nav.appendChild(link);
        });

        return nav;
    }

    function createPageSummary(meta) {
        const summary = document.createElement('section');
        summary.className = 'tenant-page-summary';
        summary.setAttribute('aria-labelledby', 'appPageTitle');

        const copy = document.createElement('div');
        copy.className = 'tenant-page-summary-copy';

        const eyebrow = document.createElement('p');
        eyebrow.className = 'tenant-page-eyebrow';
        eyebrow.textContent = meta.eyebrow;

        const description = document.createElement('p');
        description.className = 'tenant-page-description';
        description.textContent = meta.description;
        copy.append(eyebrow, description);
        summary.appendChild(copy);

        if (meta.action) {
            const action = document.createElement('a');
            action.className = meta.action.secondary ? 'tenant-summary-action secondary' : 'tenant-summary-action';
            action.href = meta.action.href;
            action.textContent = meta.action.label;
            summary.appendChild(action);
        }

        return summary;
    }

    function improveTables() {
        document.querySelectorAll('.main-content-inner table').forEach((table, tableIndex) => {
            table.classList.add('tenant-data-table', 'tenant-record-table');
            const wrapper = table.parentElement;
            if (wrapper) wrapper.classList.add('tenant-table-scroll');

            const headers = Array.from(table.querySelectorAll('thead th')).map((header) => header.textContent.trim());
            const labelRows = () => {
                table.querySelectorAll('tbody tr').forEach((row) => {
                    const cells = Array.from(row.children);
                    if (cells.length === 1 && cells[0].hasAttribute('colspan')) {
                        cells[0].classList.add('tenant-table-state-cell');
                        return;
                    }
                    cells.forEach((cell, index) => {
                        if (!cell.dataset.label) cell.dataset.label = headers[index] || `Column ${index + 1}`;
                    });
                });
            };
            labelRows();
            if (table.tBodies[0]) {
                new MutationObserver(labelRows).observe(table.tBodies[0], { childList: true });
            }
            addTableControls(table, tableIndex);
        });
    }

    function addTableControls(table, tableIndex) {
        if (!table.tHead || table.closest('.modal-overlay, .chat-head-modal') || table.previousElementSibling?.classList.contains('tenant-table-controls')) return;
        const controls = document.createElement('div');
        controls.className = 'tenant-table-controls';

        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'form-input tenant-table-search';
        search.placeholder = 'Search these records';
        search.setAttribute('aria-label', `Search table ${tableIndex + 1}`);

        const status = document.createElement('select');
        status.className = 'form-input tenant-table-status';
        status.setAttribute('aria-label', `Filter table ${tableIndex + 1} by status`);
        status.innerHTML = '<option value="">All statuses</option>';

        const count = document.createElement('span');
        count.className = 'tenant-table-count';
        count.setAttribute('aria-live', 'polite');
        controls.append(search, status, count);
        table.parentElement?.insertBefore(controls, table);

        const syncStatusOptions = () => {
            const current = status.value;
            const values = new Set();
            table.querySelectorAll('tbody tr .status-badge, tbody tr .badge').forEach((badge) => {
                const value = badge.textContent.trim();
                if (value) values.add(value);
            });
            status.replaceChildren(new Option('All statuses', ''));
            [...values].sort().forEach((value) => status.appendChild(new Option(value, value.toLowerCase())));
            if ([...status.options].some((option) => option.value === current)) status.value = current;
        };

        const filterRows = () => {
            const query = search.value.trim().toLowerCase();
            const statusValue = status.value;
            let visible = 0;
            table.querySelectorAll('tbody tr').forEach((row) => {
                if (row.querySelector('[colspan]')) return;
                const text = row.textContent.toLowerCase();
                const badge = row.querySelector('.status-badge, .badge')?.textContent.trim().toLowerCase() || '';
                const matches = (!query || text.includes(query)) && (!statusValue || badge.includes(statusValue));
                row.hidden = !matches;
                if (matches) visible += 1;
            });
            count.textContent = `${visible} ${visible === 1 ? 'record' : 'records'}`;
        };

        const refresh = () => {
            syncStatusOptions();
            filterRows();
        };
        search.addEventListener('input', filterRows);
        status.addEventListener('change', filterRows);
        if (table.tBodies[0]) new MutationObserver(refresh).observe(table.tBodies[0], { childList: true });
        refresh();
    }

    function improveForms() {
        document.querySelectorAll('.main-content-inner form').forEach((form) => {
            form.classList.add('tenant-form');
        });
    }

    function improveControls(root) {
        root.querySelectorAll('button:not([type])').forEach((button) => {
            if (!button.closest('form')) button.type = 'button';
            const visibleText = button.textContent.replace(/\s+/g, ' ').trim();
            if (!visibleText && !button.getAttribute('aria-label')) {
                const label = button.getAttribute('title')
                    || (button.className.includes('close') ? 'Close dialog' : '')
                    || button.dataset.action?.replace(/[_-]+/g, ' ')
                    || 'Action';
                button.setAttribute('aria-label', label);
            }
        });

        root.querySelectorAll('a[target="_blank"]').forEach((link) => {
            link.rel = 'noopener noreferrer';
        });
    }

    function improveTabs() {
        document.querySelectorAll('.tab-headers, .reports-tabs, .filter-tabs').forEach((tabList) => {
            tabList.setAttribute('role', 'tablist');
            if (!tabList.getAttribute('aria-label')) tabList.setAttribute('aria-label', 'View options');
            tabList.querySelectorAll('button').forEach((button) => {
                button.type = 'button';
                button.setAttribute('role', 'tab');
                button.setAttribute('aria-selected', button.classList.contains('active') ? 'true' : 'false');
            });
        });

        document.addEventListener('click', (event) => {
            const button = event.target.closest('[role="tab"]');
            const tabList = button?.closest('[role="tablist"]');
            if (!button || !tabList) return;
            requestAnimationFrame(() => {
                tabList.querySelectorAll('[role="tab"]').forEach((tab) => {
                    tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
                });
            });
        });
    }

    function improveModals() {
        const overlays = Array.from(document.querySelectorAll('.modal-overlay, .chat-head-modal'));
        if (!overlays.length) return;
        const focusOrigins = new WeakMap();

        const isVisible = (modal) => {
            const style = window.getComputedStyle(modal);
            return !modal.classList.contains('hidden')
                && style.display !== 'none'
                && style.visibility !== 'hidden'
                && style.pointerEvents !== 'none'
                && style.opacity !== '0';
        };

        const syncModal = (modal) => {
            const visible = isVisible(modal);
            const wasHidden = modal.getAttribute('aria-hidden') !== 'false';
            modal.setAttribute('aria-hidden', visible ? 'false' : 'true');
            if (visible && wasHidden) {
                focusOrigins.set(modal, document.activeElement);
                document.body.classList.add('tenant-modal-open');
                requestAnimationFrame(() => {
                    const focusTarget = modal.querySelector('[autofocus], .modal-close-btn, .modal-close-x, .form-modal-close, .chat-head-close-btn, button, input, select, textarea');
                    (focusTarget || modal).focus();
                });
            } else if (!visible && !wasHidden) {
                if (!overlays.some((candidate) => candidate !== modal && isVisible(candidate))) {
                    document.body.classList.remove('tenant-modal-open');
                }
                focusOrigins.get(modal)?.focus?.();
            }
        };

        overlays.forEach((modal, index) => {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.tabIndex = -1;
            const heading = modal.querySelector('h1, h2, h3, .modal-title');
            if (heading) {
                if (!heading.id) heading.id = `tenantModalTitle${index + 1}`;
                modal.setAttribute('aria-labelledby', heading.id);
            } else if (!modal.getAttribute('aria-label')) {
                modal.setAttribute('aria-label', 'Dialog');
            }
            syncModal(modal);
            new MutationObserver(() => syncModal(modal)).observe(modal, {
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden']
            });
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const modal = [...overlays].reverse().find(isVisible);
            if (!modal) return;
            const close = modal.querySelector('.modal-close-btn, .modal-close-x, .form-modal-close, .chat-head-close-btn, [aria-label^="Close" i]');
            close?.click();
        });
    }

    function initialize() {
        const layout = document.querySelector('.dashboard-layout-tenant');
        const content = layout && layout.querySelector('.main-content-inner');
        const page = currentPage();
        const meta = PAGE_META[page];

        if (!layout || !content || !meta || content.querySelector('.tenant-module-intro')) return;

        document.body.setAttribute('data-tenant-page', page.replace('.html', ''));

        const intro = document.createElement('div');
        intro.className = 'tenant-module-intro';
        intro.appendChild(createPageSummary(meta));

        const journey = createWorkflow(meta.step);
        if (journey) intro.appendChild(journey);

        content.insertBefore(intro, content.firstChild);
        improveTables();
        improveForms();
        improveControls(document);
        improveTabs();
        improveModals();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
}());
