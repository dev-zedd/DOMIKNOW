(function () {
    'use strict';

    const OPERATING_STEPS = [
        { key: 'portfolio', label: 'Portfolio', href: 'properties.html' },
        { key: 'applicants', label: 'Applicants', href: 'applications.html' },
        { key: 'leases', label: 'Leases', href: 'leases.html' },
        { key: 'revenue', label: 'Revenue', href: 'billings.html' }
    ];

    const PAGE_META = {
        'properties.html': {
            eyebrow: 'Portfolio overview',
            description: 'Track property approvals, availability, occupancy setup, and the next action for every listing.',
            step: 'portfolio'
        },
        'property-create.html': {
            eyebrow: 'New portfolio entry',
            description: 'Create a complete, review-ready property record with location, documents, amenities, and listing media.',
            step: 'portfolio',
            action: { label: 'Back to portfolio', href: 'properties.html', secondary: true }
        },
        'property-details.html': {
            eyebrow: 'Property operations',
            description: 'Maintain listing information, compliance files, photos, approval status, and room inventory.',
            step: 'portfolio'
        },
        'units.html': {
            eyebrow: 'Inventory management',
            description: 'Define rentable rooms, beds, rates, capacity, availability, and the images tenants use to decide.',
            step: 'portfolio'
        },
        'applications.html': {
            eyebrow: 'Applicant pipeline',
            description: 'Review incoming tenants consistently, inspect supporting information, and record a clear decision.',
            step: 'applicants'
        },
        'application-details.html': {
            eyebrow: 'Applicant review',
            description: 'Evaluate the application, screening details, documents, target unit, and decision history together.',
            step: 'applicants'
        },
        'leases.html': {
            eyebrow: 'Tenancy registry',
            description: 'Monitor draft and active agreements, signatures, lease dates, tenant assignments, and renewals.',
            step: 'leases'
        },
        'lease-create.html': {
            eyebrow: 'Agreement builder',
            description: 'Turn an approved application into a precise lease with terms, parties, obligations, and signatures.',
            step: 'leases'
        },
        'billings.html': {
            eyebrow: 'Revenue operations',
            description: 'Create tenant statements, monitor due and overdue balances, and maintain a reliable revenue record.',
            step: 'revenue',
            action: { label: 'Verify payments', href: 'payments.html' }
        },
        'payments.html': {
            eyebrow: 'Payment control',
            description: 'Review submitted proof, match it to the correct bill, and record a traceable verification decision.',
            step: 'revenue',
            action: { label: 'Billing dashboard', href: 'billings.html', secondary: true }
        },
        'maintenance.html': {
            eyebrow: 'Property operations',
            description: 'Prioritize tenant requests, assign the right worker, and track service through verification and closure.'
        },
        'maintenance-details.html': {
            eyebrow: 'Maintenance case',
            description: 'Review the issue, evidence, assignment, work updates, costs, and tenant confirmation in one record.'
        },
        'reports.html': {
            eyebrow: 'Safety & accountability',
            description: 'File tenant concerns, respond to reports involving you, and follow administrative inquiries and outcomes.'
        },
        'tenant-report-form.html': {
            eyebrow: 'New incident report',
            description: 'Connect the incident to a verified tenancy, explain what occurred, and attach relevant evidence.'
        },
        'landlord-reports.html': {
            eyebrow: 'Reports involving you',
            description: 'Review allegations, administrative status, available evidence, and submit your explanation when requested.',
            action: { label: 'Reports center', href: 'reports.html', secondary: true }
        },
        'disputes.html': {
            eyebrow: 'Resolution center',
            description: 'Track complaints and disputes by status, respond with context, and preserve a clear case history.'
        },
        'feedback.html': {
            eyebrow: 'Reputation & quality',
            description: 'Understand verified tenant ratings and maintenance feedback across your managed properties.'
        }
    };

    const GLYPH_ICONS = new Map([
        ['📁', 'folder'],
        ['🔒', 'lock'],
        ['⚠️', 'warning'],
        ['⚠', 'warning'],
        ['❌', 'x'],
        ['⚡', 'bolt'],
        ['🟢', 'check'],
        ['✅', 'check'],
        ['📝', 'note'],
        ['✨', 'sparkle'],
        ['💬', 'message'],
        ['⚑', 'flag'],
        ['🗒️', 'note'],
        ['🗒', 'note'],
        ['🎯', 'target'],
        ['🎉', 'sparkle'],
        ['✕', 'x'],
        ['📎', 'paperclip'],
        ['🛡️', 'shield'],
        ['🛡', 'shield'],
        ['🔍', 'search'],
        ['⛔', 'ban'],
        ['✓', 'check']
    ]);

    const ICONIZE_SELECTOR = [
        'button',
        'a',
        '.alert-icon',
        '.empty-icon',
        '.hero-icon',
        '.card-head-icon',
        '.status-badge',
        '.badge',
        '.chip',
        '.feedback-snippet',
        '.alert',
        '[id$="StatusBanner"]',
        '#contactNoNotice',
        '#bgyDetectStatus',
        '#locationAccuracyStatus',
        '#createFeedback',
        '[id^="statusDoc"]',
        '[id^="statusPhoto"]'
    ].join(',');

    const SEMANTIC_STYLE_REPLACEMENTS = [
        [/((?:border|border-color)\s*:[^;]*?)rgba?\(239\s*,\s*68\s*,\s*68\s*(?:,\s*(?:0?\.\d+|1(?:\.0)?))?\)/gi, '$1var(--color-error-border)'],
        [/((?:border|border-color)\s*:[^;]*?)rgba?\(16\s*,\s*185\s*,\s*129\s*(?:,\s*(?:0?\.\d+|1(?:\.0)?))?\)/gi, '$1var(--color-success-border)'],
        [/((?:border|border-color)\s*:[^;]*?)rgba?\((?:245\s*,\s*158\s*,\s*11|249\s*,\s*115\s*,\s*22)\s*(?:,\s*(?:0?\.\d+|1(?:\.0)?))?\)/gi, '$1var(--color-warning-border)'],
        [/((?:border|border-color)\s*:[^;]*?)rgba?\((?:37\s*,\s*99\s*,\s*235|59\s*,\s*130\s*,\s*246|99\s*,\s*102\s*,\s*241)\s*(?:,\s*(?:0?\.\d+|1(?:\.0)?))?\)/gi, '$1var(--color-info-border)'],
        [/#(?:ef4444|dc2626|b91c1c)/gi, 'var(--color-error-text)'],
        [/rgba?\(239\s*,\s*68\s*,\s*68\s*(?:,\s*(?:0?\.\d+|1(?:\.0)?))?\)/gi, 'var(--color-error-bg)'],
        [/#(?:10b981|059669|047857)/gi, 'var(--color-success-text)'],
        [/rgba?\(16\s*,\s*185\s*,\s*129\s*(?:,\s*(?:0?\.\d+|1(?:\.0)?))?\)/gi, 'var(--color-success-bg)'],
        [/#(?:f59e0b|d97706|b45309|f97316|ea580c|c2410c)/gi, 'var(--color-warning-text)'],
        [/rgba?\((?:245\s*,\s*158\s*,\s*11|249\s*,\s*115\s*,\s*22)\s*(?:,\s*(?:0?\.\d+|1(?:\.0)?))?\)/gi, 'var(--color-warning-bg)'],
        [/#(?:2563eb|1d4ed8|3b82f6|4f46e5|6366f1)/gi, 'var(--color-action-primary)'],
        [/rgba?\((?:37\s*,\s*99\s*,\s*235|59\s*,\s*130\s*,\s*246|99\s*,\s*102\s*,\s*241)\s*(?:,\s*(?:0?\.\d+|1(?:\.0)?))?\)/gi, 'var(--color-info-bg)']
    ];

    function currentPage() {
        return window.location.pathname.split('/').pop() || 'properties.html';
    }

    function createOperatingFlow(activeStep) {
        if (!activeStep) return null;

        const nav = document.createElement('nav');
        nav.className = 'landlord-flow';
        nav.setAttribute('aria-label', 'Landlord operating flow');

        OPERATING_STEPS.forEach((step, index) => {
            const link = document.createElement('a');
            link.href = step.href;
            link.className = `landlord-flow-step${step.key === activeStep ? ' active' : ''}`;
            if (step.key === activeStep) link.setAttribute('aria-current', 'step');

            const number = document.createElement('span');
            number.className = 'landlord-flow-number';
            number.textContent = String(index + 1);

            const label = document.createElement('span');
            label.textContent = step.label;
            link.append(number, label);
            nav.appendChild(link);
        });

        return nav;
    }

    function createSummary(meta) {
        const summary = document.createElement('section');
        summary.className = 'landlord-page-summary';
        summary.setAttribute('aria-labelledby', 'appPageTitle');

        const copy = document.createElement('div');
        copy.className = 'landlord-page-summary-copy';

        const eyebrow = document.createElement('p');
        eyebrow.className = 'landlord-page-eyebrow';
        eyebrow.textContent = meta.eyebrow;

        const description = document.createElement('p');
        description.className = 'landlord-page-description';
        description.textContent = meta.description;
        copy.append(eyebrow, description);
        summary.appendChild(copy);

        if (meta.action) {
            const action = document.createElement('a');
            action.href = meta.action.href;
            action.className = `landlord-summary-action${meta.action.secondary ? ' secondary' : ''}`;
            const iconName = meta.action.href === 'properties.html'
                ? 'arrow-left'
                : meta.action.href === 'payments.html'
                    ? 'money'
                    : meta.action.href === 'billings.html'
                        ? 'clipboard'
                        : 'arrow-left';
            action.innerHTML = `${window.domiknowIcon ? window.domiknowIcon(iconName) : `<span data-icon="${iconName}"></span>`}<span>${meta.action.label}</span>`;
            summary.appendChild(action);
        }

        return summary;
    }

    function enhanceOperationalContent() {
        document.querySelectorAll('.main-content-inner table').forEach((table) => {
            table.classList.add('landlord-data-table', 'landlord-record-table');
            const wrapper = table.parentElement;
            if (wrapper) wrapper.classList.add('landlord-table-scroll');

            const headers = Array.from(table.querySelectorAll('thead th')).map((header) => header.textContent.trim());
            const labelRows = () => {
                table.querySelectorAll('tbody tr').forEach((row) => {
                    const cells = Array.from(row.children);
                    if (cells.length === 1 && cells[0].hasAttribute('colspan')) {
                        cells[0].classList.add('landlord-table-state-cell');
                        return;
                    }
                    cells.forEach((cell, index) => {
                        if (!cell.dataset.label) cell.dataset.label = headers[index] || `Column ${index + 1}`;
                    });
                });
            };
            labelRows();
            if (table.tBodies[0]) new MutationObserver(labelRows).observe(table.tBodies[0], { childList: true });
        });

        document.querySelectorAll('.main-content-inner form').forEach((form) => {
            form.classList.add('landlord-form');
        });

        improveControls(document);
        normalizeSemanticInlineStyles(document);
        improveIconography(document);
        improveTabs();
        improveModals();
    }

    function normalizeSemanticInlineStyles(root) {
        const styledElements = [];
        if (root.nodeType === Node.ELEMENT_NODE && root.hasAttribute?.('style')) styledElements.push(root);
        root.querySelectorAll?.('[style]').forEach((element) => styledElements.push(element));

        styledElements.forEach((element) => {
            const originalStyle = element.getAttribute('style');
            if (!originalStyle) return;
            const normalizedStyle = SEMANTIC_STYLE_REPLACEMENTS.reduce(
                (style, [pattern, replacement]) => style.replace(pattern, replacement),
                originalStyle
            );
            if (normalizedStyle !== originalStyle) element.setAttribute('style', normalizedStyle);
        });
    }

    function improveIconography(root) {
        const candidates = [];
        if (root.nodeType === Node.ELEMENT_NODE && root.matches?.(ICONIZE_SELECTOR)) candidates.push(root);
        root.querySelectorAll?.(ICONIZE_SELECTOR).forEach((element) => candidates.push(element));

        candidates.forEach((element) => {
            if (element.querySelector(':scope > .landlord-inline-icon')) return;

            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let textNode = walker.nextNode();
            while (textNode && !textNode.textContent.trim()) textNode = walker.nextNode();
            if (!textNode) return;

            const originalText = textNode.textContent;
            const leadingSpace = originalText.match(/^\s*/)?.[0] || '';
            const trimmedText = originalText.slice(leadingSpace.length);
            const match = Array.from(GLYPH_ICONS.keys())
                .sort((left, right) => right.length - left.length)
                .find((glyph) => trimmedText.startsWith(glyph));
            if (!match) return;

            const iconName = GLYPH_ICONS.get(match);
            textNode.textContent = `${leadingSpace}${trimmedText.slice(match.length).replace(/^\s+/, '')}`;

            const iconWrapper = document.createElement('span');
            iconWrapper.className = 'landlord-inline-icon';
            iconWrapper.setAttribute('aria-hidden', 'true');
            iconWrapper.innerHTML = window.domiknowIcon
                ? window.domiknowIcon(iconName)
                : `<span data-icon="${iconName}"></span>`;
            textNode.parentNode.insertBefore(iconWrapper, textNode);

            if (!element.textContent.trim() && !element.getAttribute('aria-label')) {
                element.setAttribute('aria-label', element.getAttribute('title') || iconName.replace(/-/g, ' '));
            }
        });
    }

    function observeDynamicIconography() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    normalizeSemanticInlineStyles(node);
                    improveIconography(node);
                }
                if (node.nodeType === Node.TEXT_NODE && node.parentElement) improveIconography(node.parentElement);
            }));
        });
        observer.observe(document.body, { childList: true, subtree: true });
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

        root.querySelectorAll('img:not([alt])').forEach((image) => image.setAttribute('alt', ''));
        root.querySelectorAll('a[target="_blank"]').forEach((link) => {
            link.rel = 'noopener noreferrer';
        });
    }

    function improveTabs() {
        document.querySelectorAll('.tabs-header, .tab-bar').forEach((tabList) => {
            tabList.setAttribute('role', 'tablist');
            if (!tabList.getAttribute('aria-label')) tabList.setAttribute('aria-label', 'View options');
            tabList.querySelectorAll('button').forEach((button) => {
                button.type = 'button';
                button.setAttribute('role', 'tab');
                button.setAttribute('aria-selected', button.classList.contains('active') ? 'true' : 'false');
            });
        });

        document.querySelectorAll('.filter-tabs, .status-tabs').forEach((filterGroup) => {
            if (!filterGroup.getAttribute('aria-label')) filterGroup.setAttribute('aria-label', 'Filter records');
            filterGroup.querySelectorAll('button').forEach((button) => {
                button.type = 'button';
                button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
            });
        });

        document.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button) return;
            const tabList = button.closest('[role="tablist"]');
            if (tabList) {
                requestAnimationFrame(() => tabList.querySelectorAll('[role="tab"]').forEach((tab) => {
                    tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
                }));
            }
            const filterGroup = button.closest('.filter-tabs, .status-tabs');
            if (filterGroup) {
                requestAnimationFrame(() => filterGroup.querySelectorAll('button').forEach((filter) => {
                    filter.setAttribute('aria-pressed', filter.classList.contains('active') ? 'true' : 'false');
                }));
            }
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
                document.body.classList.add('landlord-modal-open');
                requestAnimationFrame(() => {
                    const focusTarget = modal.querySelector('[autofocus], .modal-close-btn, .modal-close-x, button, input, select, textarea');
                    (focusTarget || modal).focus();
                });
            } else if (!visible && !wasHidden) {
                if (!overlays.some((candidate) => candidate !== modal && isVisible(candidate))) {
                    document.body.classList.remove('landlord-modal-open');
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
                if (!heading.id) heading.id = `landlordModalTitle${index + 1}`;
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
            modal.querySelector('.modal-close-btn, .modal-close-x, [aria-label^="Close" i]')?.click();
        });
    }

    function initialize() {
        const layout = document.querySelector('.dashboard-layout-landlord');
        const content = layout && layout.querySelector('.main-content-inner');
        const page = currentPage();
        const meta = PAGE_META[page];

        if (!layout || !content || !meta || content.querySelector('.landlord-module-intro')) return;

        document.body.setAttribute('data-landlord-page', page.replace('.html', ''));

        const intro = document.createElement('div');
        intro.className = 'landlord-module-intro';
        intro.appendChild(createSummary(meta));

        const flow = createOperatingFlow(meta.step);
        if (flow) intro.appendChild(flow);

        content.insertBefore(intro, content.firstChild);
        enhanceOperationalContent();
        observeDynamicIconography();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
}());
