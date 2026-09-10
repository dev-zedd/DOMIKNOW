(function () {
    'use strict';

    const WORK_STAGES = [
        { key: 'offer', label: 'Accept' },
        { key: 'travel', label: 'Travel' },
        { key: 'repair', label: 'Repair' },
        { key: 'report', label: 'Report' },
        { key: 'close', label: 'Close' }
    ];

    const PAGE_META = {
        'dashboard.html': {
            eyebrow: 'Overview',
            description: 'Check your tasks and repair requests.',
            showFlow: false
        },
        'tasks.html': {
            eyebrow: 'Tasks',
            description: 'View and update your assigned repair tasks.',
            showFlow: false
        },
        'task-details.html': {
            eyebrow: 'Work Order',
            description: 'View details and update progress for this request.',
            action: { label: '← Back to tasks', href: 'tasks.html', secondary: true },
            showFlow: true,
            dynamicFlow: true
        }
    };

    const STATUS_STAGE = {
        assigned: 'offer',
        accepted: 'travel',
        travelling: 'travel',
        arrived: 'repair',
        repairing: 'repair',
        completed: 'report',
        verified: 'close',
        closed: 'close'
    };

    function currentPage() {
        return window.location.pathname.split('/').pop() || 'dashboard.html';
    }

    function createSummary(meta) {
        const summary = document.createElement('section');
        summary.className = 'maintenance-page-summary';
        summary.setAttribute('aria-labelledby', 'appPageTitle');

        const copy = document.createElement('div');
        copy.className = 'maintenance-page-summary-copy';

        const eyebrow = document.createElement('p');
        eyebrow.className = 'maintenance-page-eyebrow';
        eyebrow.textContent = meta.eyebrow;

        const description = document.createElement('p');
        description.className = 'maintenance-page-description';
        description.textContent = meta.description;
        copy.append(eyebrow, description);
        summary.appendChild(copy);

        if (meta.action) {
            const action = document.createElement('a');
            action.href = meta.action.href;
            action.className = `maintenance-summary-action${meta.action.secondary ? ' secondary' : ''}`;
            action.textContent = meta.action.label;
            summary.appendChild(action);
        }

        return summary;
    }

    function createWorkFlow() {
        const list = document.createElement('ol');
        list.className = 'maintenance-workflow';
        list.setAttribute('aria-label', 'Maintenance work protocol');

        WORK_STAGES.forEach((stage, index) => {
            const item = document.createElement('li');
            item.className = 'maintenance-workflow-step';
            item.dataset.stage = stage.key;

            const number = document.createElement('span');
            number.className = 'maintenance-workflow-number';
            number.textContent = String(index + 1);

            const label = document.createElement('span');
            label.className = 'maintenance-workflow-label';
            label.textContent = stage.label;
            item.append(number, label);
            list.appendChild(item);
        });

        return list;
    }

    function updateWorkFlow(rawStatus) {
        const status = String(rawStatus || '').trim().toLowerCase().replace(/\s+/g, '_');
        const activeStage = STATUS_STAGE[status];
        const activeIndex = WORK_STAGES.findIndex(stage => stage.key === activeStage);

        document.querySelectorAll('.maintenance-workflow-step').forEach((item, index) => {
            item.classList.toggle('active', index === activeIndex);
            item.classList.toggle('complete', activeIndex >= 0 && index < activeIndex);
            if (index === activeIndex) item.setAttribute('aria-current', 'step');
            else item.removeAttribute('aria-current');
        });
    }

    function observeTaskStatus() {
        const statusElement = document.getElementById('taskStatus');
        if (!statusElement) return;

        const syncStatus = () => updateWorkFlow(statusElement.textContent);
        syncStatus();

        const observer = new MutationObserver(syncStatus);
        observer.observe(statusElement, { childList: true, characterData: true, subtree: true });
    }

    function enhanceTaskContent() {
        document.querySelectorAll('.main-content-inner table').forEach((table) => {
            table.classList.add('maintenance-data-table');
            const wrapper = table.parentElement;
            if (wrapper && wrapper.classList.contains('ui-table-wrapper')) {
                wrapper.classList.add('maintenance-table-scroll');
            }
        });

        document.querySelectorAll('.main-content-inner form').forEach((form) => {
            form.classList.add('maintenance-form');
        });
    }

    async function loadWorkSummary() {
        const status = document.getElementById('workSummaryStatus');
        if (!status) return;
        try {
            const response = await fetch('/api/maintenance/requests/worker', {
                headers: { Authorization: `Bearer ${localStorage.getItem('domiknow_token')}` }
            });
            if (!response.ok) throw new Error('Summary unavailable');
            const result = await response.json();
            if (!Array.isArray(result.data)) throw new Error('Invalid summary');
            const groups = { offers: ['assigned'], active: ['accepted', 'travelling', 'arrived', 'repairing'], review: ['completed', 'verified'], closed: ['closed'] };
            Object.entries(groups).forEach(([key, states]) => {
                document.querySelector(`[data-work-count="${key}"]`).textContent = result.data.filter(task => states.includes(task.status)).length;
            });
            status.textContent = `${result.data.length} assigned tasks. Open the queue to review details.`;
        } catch (_) {
            status.textContent = 'Your work summary could not be loaded. ';
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'btn btn-secondary';
            retry.textContent = 'Try again';
            retry.addEventListener('click', () => { retry.disabled = true; loadWorkSummary(); }, { once: true });
            status.appendChild(retry);
        }
    }

    function initialize() {
        const layout = document.querySelector('.dashboard-layout-maintenance');
        const content = layout && layout.querySelector('.main-content-inner');
        const page = currentPage();
        const meta = PAGE_META[page];

        if (!layout || !content || !meta || content.querySelector('.maintenance-module-intro')) return;

        document.body.setAttribute('data-maintenance-page', page.replace('.html', ''));

        const intro = document.createElement('div');
        intro.className = 'maintenance-module-intro';
        intro.appendChild(createSummary(meta));
        if (meta.showFlow) intro.appendChild(createWorkFlow());
        const breadcrumbs = content.querySelector(':scope > [data-domiknow-breadcrumbs]');
        if (breadcrumbs) breadcrumbs.insertAdjacentElement('afterend', intro);
        else content.insertBefore(intro, content.firstChild);

        enhanceTaskContent();
        loadWorkSummary();
        if (meta.dynamicFlow) observeTaskStatus();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
    document.addEventListener('domiknow:page-content-updated', initialize);
    window.initializeMaintenanceModule = initialize;
}());
