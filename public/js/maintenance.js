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
            showFlow: false,
            dynamicFlow: false
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
        return null;
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
        const hasWorkCounts = Boolean(document.querySelector('[data-work-count]'));
        const hasCharts = Boolean(document.getElementById('chartMonthlyTrend'));
        if (!status && !hasWorkCounts && !hasCharts) return;

        try {
            const response = await fetch('/api/maintenance/requests/worker', {
                headers: { Authorization: `Bearer ${localStorage.getItem('domiknow_token')}` }
            });
            if (!response.ok) throw new Error('Summary unavailable');
            const result = await response.json();
            if (!Array.isArray(result.data)) throw new Error('Invalid summary');
            const groups = { offers: ['assigned'], active: ['accepted', 'travelling', 'arrived', 'repairing'], review: ['completed', 'verified'], closed: ['closed'] };
            Object.entries(groups).forEach(([key, states]) => {
                const el = document.querySelector(`[data-work-count="${key}"]`);
                if (el) el.textContent = result.data.filter(task => states.includes(task.status)).length;
            });
            if (status) {
                status.textContent = `${result.data.length} assigned tasks. Open the queue to review details.`;
            }

            // Render operational KPI charts if chart containers exist on current page
            renderWorkerCharts(result.data);
        } catch (_) {
            if (status) {
                status.textContent = 'Your work summary could not be loaded. ';
                const retry = document.createElement('button');
                retry.type = 'button';
                retry.className = 'btn btn-secondary';
                retry.textContent = 'Try again';
                retry.addEventListener('click', () => { retry.disabled = true; loadWorkSummary(); }, { once: true });
                status.appendChild(retry);
            }
        }
    }

    // ── Worker KPI & Analytics Visual Graph Renderers ──────────────────────────

    function renderWorkerCharts(tasks) {
        const taskList = Array.isArray(tasks) ? tasks : [];
        renderMonthlyTrendChart(document.getElementById('chartMonthlyTrend'), taskList);
        renderCategoryDistributionChart(document.getElementById('chartCategoryDistribution'), taskList);
        renderPipelineStagesChart(document.getElementById('chartPipelineStages'), taskList);
        renderResolutionSpeedChart(document.getElementById('chartResolutionSpeed'), taskList);
        renderQualityScoreGauge(document.getElementById('chartQualityScore'), taskList);
    }

    // 1. Monthly Jobs Completed Trend (Histogram Bar Chart)
    function renderMonthlyTrendChart(container, tasks) {
        if (!container) return;
        const completedTasks = tasks.filter(t => ['completed', 'verified', 'closed'].includes(t.status));
        const totalBadge = document.getElementById('monthlyTrendTotalBadge');
        if (totalBadge) totalBadge.textContent = `${completedTasks.length} Completed`;

        if (!completedTasks.length) {
            container.innerHTML = `
                <div class="worker-chart-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <p>No completed jobs recorded yet</p>
                    <small>Repairs finished will appear in your monthly trend histogram.</small>
                </div>
            `;
            return;
        }

        // Tally by month in UTC+8
        const months = {};
        completedTasks.forEach(task => {
            const rawDate = task.completed_at || task.updated_at || task.created_at;
            if (!rawDate) return;
            const d = new Date(rawDate);
            if (!Number.isFinite(d.getTime())) return;
            const key = new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 7);
            months[key] = (months[key] || 0) + 1;
        });

        // 6-month continuous series up to current month
        const now = new Date();
        const currentMonthKey = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 7);
        const cursor = new Date(`${currentMonthKey}-01T00:00:00Z`);
        const series = [];
        for (let i = 0; i < 6; i++) {
            const key = cursor.toISOString().slice(0, 7);
            series.unshift({ month: key, count: months[key] || 0 });
            cursor.setUTCMonth(cursor.getUTCMonth() - 1);
        }

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 460 135');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Monthly Completed Jobs Histogram');
        svg.style.width = '100%';
        svg.style.height = '135px';
        svg.style.overflow = 'visible';

        const add = (tag, attrs, text) => {
            const node = document.createElementNS(svg.namespaceURI, tag);
            Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
            if (text !== undefined) node.textContent = text;
            svg.appendChild(node);
            return node;
        };

        const maxCount = Math.max(1, ...series.map(s => s.count));
        const top = Math.max(2, Math.ceil(maxCount / 2) * 2);

        // Gridlines
        [0, top / 2, top].forEach(val => {
            const y = 105 - (val / top) * 85;
            add('line', { x1: 26, x2: 450, y1: y, y2: y, stroke: 'var(--color-border-default, #e2e8f0)', 'stroke-dasharray': '3 3', 'stroke-width': '1' });
            add('text', { x: 20, y: y + 3.5, 'text-anchor': 'end', fill: 'var(--color-text-muted, #94a3b8)', 'font-size': '10px', 'font-weight': '600' }, String(val));
        });

        const step = 424 / series.length;
        series.forEach(({ month, count }, idx) => {
            const height = (count / top) * 85;
            const x = 30 + step * idx + step * 0.18;
            const barWidth = Math.max(10, step * 0.64);
            const barY = 105 - height;

            const rect = add('rect', {
                x,
                y: count > 0 ? barY : 103,
                width: barWidth,
                height: count > 0 ? height : 2,
                rx: 4,
                fill: count > 0 ? 'var(--color-action-primary, #0355f3)' : 'var(--color-bg-subtle, #e2e8f0)',
                style: 'transition: all 0.2s ease;'
            });

            const titleEl = document.createElementNS(svg.namespaceURI, 'title');
            titleEl.textContent = `${month}: ${count} completed repair${count === 1 ? '' : 's'}`;
            rect.appendChild(titleEl);

            if (count > 0) {
                add('text', { x: x + barWidth / 2, y: Math.max(14, barY - 4), 'text-anchor': 'middle', fill: 'var(--color-text-primary, #0f172a)', 'font-size': '11px', 'font-weight': '750' }, String(count));
            }

            const dateObj = new Date(`${month}-01T00:00:00Z`);
            const label = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(dateObj);
            add('text', { x: x + barWidth / 2, y: 124, 'text-anchor': 'middle', fill: 'var(--color-text-secondary, #64748b)', 'font-size': '10px', 'font-weight': '600' }, label);
        });

        container.replaceChildren(svg);
    }

    // 2. Task Distribution by Category (Donut Chart + Legend)
    function renderCategoryDistributionChart(container, tasks) {
        if (!container) return;
        const totalBadge = document.getElementById('categoryActiveCountBadge');
        if (totalBadge) totalBadge.textContent = `${tasks.length} Task${tasks.length === 1 ? '' : 's'}`;

        if (!tasks.length) {
            container.innerHTML = `
                <div class="worker-chart-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                    <p>No task categories assigned yet</p>
                    <small>Categories will display as jobs are dispatched to you.</small>
                </div>
            `;
            return;
        }

        const CATEGORY_COLORS = {
            plumbing: '#0284c7',
            electrical: '#f59e0b',
            aircon: '#06b6d4',
            door: '#8b5cf6',
            roof: '#ea580c',
            appliance: '#10b981',
            internet: '#ec4899',
            others: '#64748b'
        };

        const counts = {};
        tasks.forEach(t => {
            const cat = (t.issue_category || 'others').toLowerCase();
            counts[cat] = (counts[cat] || 0) + 1;
        });

        const activeCategories = Object.entries(counts)
            .map(([cat, count]) => ({
                cat,
                count,
                pct: Math.round((count / tasks.length) * 100),
                color: CATEGORY_COLORS[cat] || '#64748b'
            }))
            .sort((a, b) => b.count - a.count);

        const wrapper = document.createElement('div');
        wrapper.className = 'worker-donut-container';

        // SVG Donut
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 140 140');
        svg.setAttribute('width', '130');
        svg.setAttribute('height', '130');
        svg.style.overflow = 'visible';

        const radius = 48;
        const circumference = 2 * Math.PI * radius;
        let cumulativePct = 0;

        activeCategories.forEach(item => {
            const segmentPct = item.count / tasks.length;
            const strokeDasharray = `${segmentPct * circumference} ${circumference}`;
            const strokeDashoffset = -cumulativePct * circumference;

            const circle = document.createElementNS(svg.namespaceURI, 'circle');
            circle.setAttribute('cx', '70');
            circle.setAttribute('cy', '70');
            circle.setAttribute('r', String(radius));
            circle.setAttribute('fill', 'transparent');
            circle.setAttribute('stroke', item.color);
            circle.setAttribute('stroke-width', '16');
            circle.setAttribute('stroke-dasharray', strokeDasharray);
            circle.setAttribute('stroke-dashoffset', String(strokeDashoffset));
            circle.setAttribute('transform', 'rotate(-90 70 70)');
            circle.style.transition = 'stroke-dasharray 0.3s ease';

            const title = document.createElementNS(svg.namespaceURI, 'title');
            title.textContent = `${item.cat}: ${item.count} tasks (${item.pct}%)`;
            circle.appendChild(title);
            svg.appendChild(circle);

            cumulativePct += segmentPct;
        });

        // Center text in Donut
        const centerCount = document.createElementNS(svg.namespaceURI, 'text');
        centerCount.setAttribute('x', '70');
        centerCount.setAttribute('y', '66');
        centerCount.setAttribute('text-anchor', 'middle');
        centerCount.setAttribute('fill', 'var(--color-text-primary, #0f172a)');
        centerCount.setAttribute('font-size', '18px');
        centerCount.setAttribute('font-weight', '800');
        centerCount.textContent = String(tasks.length);
        svg.appendChild(centerCount);

        const centerLabel = document.createElementNS(svg.namespaceURI, 'text');
        centerLabel.setAttribute('x', '70');
        centerLabel.setAttribute('y', '82');
        centerLabel.setAttribute('text-anchor', 'middle');
        centerLabel.setAttribute('fill', 'var(--color-text-muted, #94a3b8)');
        centerLabel.setAttribute('font-size', '9px');
        centerLabel.setAttribute('font-weight', '700');
        centerLabel.setAttribute('letter-spacing', '0.04em');
        centerLabel.textContent = 'TOTAL';
        svg.appendChild(centerLabel);

        // Legend list
        const legend = document.createElement('div');
        legend.className = 'worker-donut-legend';

        activeCategories.forEach(item => {
            const row = document.createElement('div');
            row.className = 'worker-legend-item';

            const left = document.createElement('span');
            left.className = 'worker-legend-label';
            const dot = document.createElement('span');
            dot.className = 'worker-legend-dot';
            dot.style.background = item.color;
            const name = document.createElement('span');
            name.textContent = item.cat;
            left.append(dot, name);

            const right = document.createElement('span');
            right.className = 'worker-legend-count';
            right.innerHTML = `${item.count} <span class="worker-legend-pct">${item.pct}%</span>`;

            row.append(left, right);
            legend.appendChild(row);
        });

        wrapper.append(svg, legend);
        container.replaceChildren(wrapper);
    }

    // 3. Workload Pipeline Stages (Horizontal Segmented Bars)
    function renderPipelineStagesChart(container, tasks) {
        if (!container) return;
        const total = tasks.length;

        const PIPELINE_STAGES = [
            { label: 'New Offers', statuses: ['assigned'], color: '#f59e0b' },
            { label: 'Accepted', statuses: ['accepted'], color: '#0284c7' },
            { label: 'In Field / Repairing', statuses: ['travelling', 'arrived', 'repairing'], color: '#6366f1' },
            { label: 'Under Review', statuses: ['completed', 'verified'], color: '#8b5cf6' },
            { label: 'Closed & Archived', statuses: ['closed'], color: '#16a34a' }
        ];

        const list = document.createElement('div');
        list.className = 'worker-pipeline-list';

        PIPELINE_STAGES.forEach(stage => {
            const count = tasks.filter(t => stage.statuses.includes(t.status)).length;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;

            const row = document.createElement('div');
            row.className = 'worker-pipeline-row';

            const meta = document.createElement('div');
            meta.className = 'worker-pipeline-meta';
            meta.innerHTML = `
                <span class="worker-pipeline-title">
                    <span class="worker-legend-dot" style="background: ${stage.color};"></span>
                    <span>${stage.label}</span>
                </span>
                <span class="worker-pipeline-val">${count} <small style="color: var(--color-text-muted); font-weight: 550;">(${pct}%)</small></span>
            `;

            const track = document.createElement('div');
            track.className = 'worker-pipeline-track';
            const bar = document.createElement('div');
            bar.className = 'worker-pipeline-bar';
            bar.style.width = `${pct}%`;
            bar.style.background = stage.color;
            track.appendChild(bar);

            row.append(meta, track);
            list.appendChild(row);
        });

        container.replaceChildren(list);
    }

    // 4. Resolution Speed vs SLA Target (Comparative Horizontal Bars)
    function renderResolutionSpeedChart(container, tasks) {
        if (!container) return;
        const completedTasks = tasks.filter(t => ['completed', 'verified', 'closed'].includes(t.status));

        const SLA_BENCHMARKS = [
            { priority: 'emergency', label: 'Emergency', targetHours: 4, badgeBg: 'rgba(220, 38, 38, 0.1)', badgeColor: '#dc2626' },
            { priority: 'high', label: 'High Priority', targetHours: 24, badgeBg: 'rgba(234, 88, 12, 0.1)', badgeColor: '#ea580c' },
            { priority: 'medium', label: 'Medium', targetHours: 48, badgeBg: 'rgba(37, 99, 235, 0.1)', badgeColor: '#2563eb' },
            { priority: 'low', label: 'Low', targetHours: 72, badgeBg: 'rgba(22, 163, 74, 0.1)', badgeColor: '#16a34a' }
        ];

        const list = document.createElement('div');
        list.className = 'worker-sla-list';

        SLA_BENCHMARKS.forEach(item => {
            const matches = completedTasks.filter(t => t.priority_level === item.priority);
            let avgHours = null;
            let withinSla = true;

            if (matches.length > 0) {
                const totalHours = matches.reduce((sum, t) => {
                    const start = new Date(t.repair_started_at || t.arrived_at || t.travel_started_at || t.created_at);
                    const end = new Date(t.completed_at || t.updated_at);
                    const dur = Math.max(0.1, (end.getTime() - start.getTime()) / 3600000);
                    return sum + dur;
                }, 0);
                avgHours = Number((totalHours / matches.length).toFixed(1));
                withinSla = avgHours <= item.targetHours;
            }

            const row = document.createElement('div');
            row.className = 'worker-sla-row';

            const barPct = avgHours !== null ? Math.min(100, Math.max(8, Math.round((avgHours / item.targetHours) * 100))) : 0;
            const barColor = avgHours === null ? 'var(--color-bg-subtle, #e2e8f0)' : (withinSla ? '#16a34a' : '#d97706');

            const meta = document.createElement('div');
            meta.className = 'worker-sla-meta';
            meta.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="worker-sla-badge" style="background: ${item.badgeBg}; color: ${item.badgeColor};">${item.label}</span>
                    <span style="font-size: 0.72rem; color: var(--color-text-muted);">Target: ≤${item.targetHours}h</span>
                </div>
                <div class="worker-sla-hours">
                    ${avgHours !== null ? `${avgHours}h avg <span style="font-size: 0.7rem; font-weight: 700; color: ${withinSla ? '#16a34a' : '#d97706'};">(${withinSla ? 'Within SLA' : 'Over SLA'})</span>` : '<span style="color: var(--color-text-muted); font-size: 0.75rem;">— No data yet</span>'}
                </div>
            `;

            const track = document.createElement('div');
            track.className = 'worker-sla-track';
            const bar = document.createElement('div');
            bar.className = 'worker-sla-bar';
            bar.style.width = `${barPct}%`;
            bar.style.background = barColor;
            track.appendChild(bar);

            row.append(meta, track);
            list.appendChild(row);
        });

        container.replaceChildren(list);
    }

    // 5. First-Time Fix & Quality Score (Radial Gauge Arc)
    function renderQualityScoreGauge(container, tasks) {
        if (!container) return;
        const completed = tasks.filter(t => ['completed', 'verified', 'closed'].includes(t.status));

        let reworksCount = 0;
        completed.forEach(task => {
            const updates = Array.isArray(task.maintenance_updates) ? task.maintenance_updates : [];
            const hasRework = updates.some(u => 
                (u.notes && u.notes.toLowerCase().includes('rework')) || 
                (u.notes && u.notes.toLowerCase().includes('returned to the technician'))
            ) || (task.recommendations && task.recommendations.toLowerCase().includes('rework'));
            if (hasRework) reworksCount++;
        });

        const totalCompleted = completed.length;
        const firstTimeFixes = Math.max(0, totalCompleted - reworksCount);
        const ftfRate = totalCompleted > 0 ? Math.round((firstTimeFixes / totalCompleted) * 100) : 100;

        const box = document.createElement('div');
        box.className = 'worker-gauge-box';

        const arcLen = 204.2; // approx circumference of 65px radius semicircle
        const fillLen = (ftfRate / 100) * arcLen;
        const strokeColor = ftfRate >= 90 ? '#16a34a' : (ftfRate >= 80 ? '#2563eb' : '#d97706');

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 160 95');
        svg.setAttribute('class', 'worker-gauge-svg');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `First Time Fix Rate: ${ftfRate}%`);

        // Background arc
        const bgPath = document.createElementNS(svg.namespaceURI, 'path');
        bgPath.setAttribute('d', 'M 15 85 A 65 65 0 0 1 145 85');
        bgPath.setAttribute('fill', 'none');
        bgPath.setAttribute('stroke', 'var(--color-bg-subtle, #e2e8f0)');
        bgPath.setAttribute('stroke-width', '14');
        bgPath.setAttribute('stroke-linecap', 'round');
        svg.appendChild(bgPath);

        // Active arc
        const activePath = document.createElementNS(svg.namespaceURI, 'path');
        activePath.setAttribute('d', 'M 15 85 A 65 65 0 0 1 145 85');
        activePath.setAttribute('fill', 'none');
        activePath.setAttribute('stroke', strokeColor);
        activePath.setAttribute('stroke-width', '14');
        activePath.setAttribute('stroke-linecap', 'round');
        activePath.setAttribute('stroke-dasharray', `${fillLen} ${arcLen}`);
        activePath.style.transition = 'stroke-dasharray 0.4s ease';
        svg.appendChild(activePath);

        // Center number
        const scoreText = document.createElementNS(svg.namespaceURI, 'text');
        scoreText.setAttribute('x', '80');
        scoreText.setAttribute('y', '74');
        scoreText.setAttribute('text-anchor', 'middle');
        scoreText.setAttribute('fill', 'var(--color-text-primary, #0f172a)');
        scoreText.setAttribute('font-size', '22px');
        scoreText.setAttribute('font-weight', '850');
        scoreText.textContent = `${ftfRate}%`;
        svg.appendChild(scoreText);

        const subText = document.createElementNS(svg.namespaceURI, 'text');
        subText.setAttribute('x', '80');
        subText.setAttribute('y', '88');
        subText.setAttribute('text-anchor', 'middle');
        subText.setAttribute('fill', 'var(--color-text-muted, #94a3b8)');
        subText.setAttribute('font-size', '8px');
        subText.setAttribute('font-weight', '700');
        subText.setAttribute('letter-spacing', '0.04em');
        subText.textContent = 'FIX RATE';
        svg.appendChild(subText);

        // Stats summary
        const stats = document.createElement('div');
        stats.className = 'worker-gauge-stats';
        stats.innerHTML = `
            <div class="worker-gauge-stat-item">
                <span>First-Time Fix</span>
                <strong style="color: #16a34a;">${firstTimeFixes}</strong>
            </div>
            <div class="worker-gauge-stat-item">
                <span>Reworks</span>
                <strong style="color: ${reworksCount > 0 ? '#d97706' : 'var(--color-text-muted)'};">${reworksCount}</strong>
            </div>
            <div class="worker-gauge-stat-item">
                <span>Rating</span>
                <strong style="font-size: 0.8125rem; color: ${strokeColor};">${ftfRate >= 90 ? 'Excellent' : (ftfRate >= 80 ? 'Good' : 'Review')}</strong>
            </div>
        `;

        box.append(svg, stats);
        container.replaceChildren(box);
    }

    function initialize() {
        const layout = document.querySelector('.dashboard-layout-maintenance');
        const content = layout && layout.querySelector('.main-content-inner');
        const page = currentPage();

        if (!layout || !content) return;

        document.body.setAttribute('data-maintenance-page', page.replace('.html', ''));

        // Remove maintenance operating workflow navigation bar and intro across all pages
        content.querySelectorAll('.maintenance-module-intro, .maintenance-workflow, .maintenance-page-summary').forEach((el) => el.remove());

        enhanceTaskContent();
        loadWorkSummary();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
    document.addEventListener('domiknow:page-content-updated', initialize);
    window.initializeMaintenanceModule = initialize;
}());
