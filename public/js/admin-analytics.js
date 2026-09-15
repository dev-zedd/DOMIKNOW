(function (root) {
    'use strict';

    function day(value) {
        if (!value) return null;
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return null;
        return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
    }

    function summarize(records, field, from = '', to = '') {
        const filtered = (records || []).filter(record => {
            const date = day(record.created_at || record.createdAt || record.timestamp || record.date || record.submitted_at || record.verified_at || record.lease_start_date);
            return (!from && !to) || (date && (!from || date >= from) && (!to || date <= to));
        });
        const statuses = Object.create(null), months = Object.create(null);
        let undated = 0;
        for (const record of filtered) {
            const status = String(record[field] || record.status || record.lease_status || record.payment_status || record.account_status || 'unknown').toLowerCase();
            statuses[status] = (statuses[status] || 0) + 1;
            const date = day(record.created_at || record.createdAt || record.timestamp || record.date || record.submitted_at || record.verified_at || record.lease_start_date);
            if (date) months[date.slice(0, 7)] = (months[date.slice(0, 7)] || 0) + 1;
            else undated++;
        }
        return { total: filtered.length, statuses, months, undated, raw: filtered };
    }

    function monthlySeries(months) {
        const keys = Object.keys(months || {}).sort();
        if (!keys.length) return [];
        const end = keys[keys.length - 1];
        const cursor = new Date(`${end}-01T00:00:00Z`);
        const series = [];
        for (let index = 0; index < 12; index++) {
            const key = cursor.toISOString().slice(0, 7);
            if (key < keys[0]) break;
            series.unshift({ month: key, count: months[key] || 0 });
            cursor.setUTCMonth(cursor.getUTCMonth() - 1);
        }
        return series;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { day, summarize, monthlySeries };
        return;
    }

    const sources = [
        { title: 'User Accounts', url: '/api/users', field: 'account_status', href: 'users.html', icon: 'users', color: 'blue' },
        { title: 'Property Submissions', url: '/api/admin/properties/review', field: 'status', href: 'property-review.html', icon: 'building', color: 'amber' },
        { title: 'Monitored Leases', url: '/api/admin/monitor/leases', field: 'lease_status', href: 'payments.html', icon: 'file-text', color: 'purple' },
        { title: 'Payment Submissions', url: '/api/admin/monitor/payments', field: 'payment_status', href: 'payments.html', icon: 'credit-card', color: 'green' },
        { title: 'Reports (Tenants)', url: '/api/admin/tenant-reports', field: 'status', href: 'reports.html', icon: 'alert-triangle', color: 'amber' },
        { title: 'Reports (Landlords)', url: '/api/admin/landlord-reports', field: 'status', href: 'reports.html', icon: 'alert-circle', color: 'amber' }
    ];

    let results = [], loadedAt = '';

    const el = (tag, text, className) => {
        const node = document.createElement(tag);
        if (text !== undefined && text !== null) node.textContent = text;
        if (className) node.className = className;
        return node;
    };

    function getSourceSvg(iconName) {
        switch (iconName) {
            case 'users':
                return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
            case 'building':
                return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15" y2="14.01"></line><line x1="9" y1="18" x2="9" y2="18.01"></line><line x1="15" y1="18" x2="15" y2="18.01"></line></svg>';
            case 'file-text':
                return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
            case 'credit-card':
                return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>';
            case 'alert-triangle':
            case 'alert-circle':
                return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
            case 'message-square':
                return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
            default:
                return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>';
        }
    }

    function getStatusClass(status) {
        const st = String(status || '').toLowerCase();
        if (['active', 'approved', 'verified', 'paid', 'resolved', 'closed'].includes(st)) return 'bg-status-active';
        if (['pending', 'submitted', 'under_review', 'open'].includes(st)) return 'bg-status-pending';
        if (['rejected', 'disabled', 'overdue', 'unverified'].includes(st)) return 'bg-status-rejected';
        return 'bg-status-default';
    }

    function renderMonthlySvgChart(months, title) {
        const series = monthlySeries(months);
        const chartBox = el('div', undefined, 'monthly-chart-box');
        chartBox.append(el('h4', 'Monthly Record History (UTC+8)', 'monthly-chart-title'));

        if (!series.length) {
            chartBox.append(el('p', 'No dated activity in selected period.', 'analytics-empty-state'));
            return chartBox;
        }

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 500 130');
        svg.setAttribute('class', 'monthly-svg');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `${title}: 12-month activity histogram.`);

        const add = (tag, attrs, text) => {
            const node = document.createElementNS(svg.namespaceURI, tag);
            Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
            if (text !== undefined) node.textContent = text;
            svg.append(node);
            return node;
        };

        const max = Math.max(1, ...series.map(item => item.count));
        const top = Math.max(2, Math.ceil(max / 2) * 2);

        // Baseline gridlines
        [0, top / 2, top].forEach(value => {
            const y = 100 - (value / top) * 80;
            add('line', { x1: 28, x2: 490, y1: y, y2: y, class: 'chart-gridline' });
            add('text', { x: 22, y: y + 3.5, 'text-anchor': 'end', class: 'chart-axis-text' }, value);
        });

        const step = 460 / series.length;
        series.forEach(({ month, count }, index) => {
            const height = (count / top) * 80;
            const x = 30 + step * index + step * 0.15;
            const barWidth = Math.max(4, step * 0.7);
            const barY = 100 - height;

            const bar = add('rect', {
                x,
                y: barY,
                width: barWidth,
                height: Math.max(2, height),
                rx: 3,
                class: 'chart-bar'
            });

            const tooltip = document.createElementNS(svg.namespaceURI, 'title');
            tooltip.textContent = `${month}: ${count} records`;
            bar.append(tooltip);

            if (count > 0) {
                add('text', { x: x + barWidth / 2, y: Math.max(12, barY - 4), 'text-anchor': 'middle', class: 'chart-val-text' }, count);
            }

            if (series.length <= 6 || index % 2 === 0 || index === series.length - 1) {
                const monthLabel = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
                add('text', { x: x + barWidth / 2, y: 118, 'text-anchor': 'middle', class: 'chart-axis-text' }, monthLabel);
            }
        });

        chartBox.append(svg);
        return chartBox;
    }

    function render() {
        const fromInput = document.getElementById('analyticsFrom');
        const toInput = document.getElementById('analyticsTo');
        const from = fromInput ? fromInput.value : '';
        const to = toInput ? toInput.value : '';
        const notice = document.getElementById('analyticsStatus');

        if (from && to && from > to) {
            if (notice) notice.textContent = 'Invalid date range: End date must be on or after start date.';
            return;
        }

        const panels = document.getElementById('analyticsPanels');
        if (panels) panels.replaceChildren();

        sources.forEach((source, index) => {
            const result = results[index];
            const data = result?.status === 'fulfilled' ? summarize(result.value, source.field, from, to) : null;

            // Domain Breakdown Card (2-Column Grid Item)
            if (panels) {
                const card = el('section', undefined, 'analytics-domain-card');
                card.id = `domain-source-${index}`;

                // Header
                const header = el('div', undefined, 'domain-card-header');
                header.innerHTML = `
                    <div class="domain-card-title-group">
                        <h3 class="domain-card-title">${source.title}</h3>
                        <span class="domain-card-badge">${data ? `${data.total.toLocaleString()} total` : 'Unavailable'}</span>
                    </div>
                    <a href="${source.href}" class="domain-card-link" aria-label="Open ${source.title} page">
                        <span>Inspect</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </a>
                `;
                card.append(header);

                // Body
                const body = el('div', undefined, 'domain-card-body');

                if (!data) {
                    body.append(el('p', 'Data currently unavailable. Click "Refresh" to re-attempt sync.', 'analytics-empty-state'));
                } else {
                    // Segmented Status Distribution
                    const distBox = el('div', undefined, 'status-dist-container');
                    distBox.append(el('div', 'Current Status Distribution', 'status-dist-header'));

                    const sortedStatuses = Object.entries(data.statuses).sort((a, b) => b[1] - a[1]);
                    if (sortedStatuses.length === 0) {
                        distBox.append(el('p', 'No records found in selected period.', 'analytics-empty-state'));
                    } else {
                        const bar = el('div', undefined, 'status-dist-bar');
                        bar.setAttribute('role', 'progressbar');
                        bar.setAttribute('aria-label', `${source.title} status distribution`);

                        const legend = el('div', undefined, 'status-dist-legend');

                        sortedStatuses.forEach(([status, count]) => {
                            const pct = data.total > 0 ? (count / data.total) * 100 : 0;
                            const roundedPct = Math.round(pct);
                            const colorClass = getStatusClass(status);

                            const segment = el('div', undefined, `status-dist-segment ${colorClass}`);
                            segment.style.width = `${pct}%`;
                            segment.title = `${status}: ${count} (${roundedPct}%)`;
                            bar.append(segment);

                            const legendItem = el('div', undefined, 'status-legend-item');
                            legendItem.innerHTML = `
                                <span class="status-legend-dot ${colorClass}"></span>
                                <span class="status-legend-name">${status.replaceAll('_', ' ')}</span>
                                <span class="status-legend-val">${count.toLocaleString()} <small style="font-weight:400; color:var(--color-text-muted);">(${roundedPct}%)</small></span>
                            `;
                            legend.append(legendItem);
                        });

                        distBox.append(bar, legend);
                    }
                    body.append(distBox);

                    // Monthly Histogram SVG
                    body.append(renderMonthlySvgChart(data.months, source.title));

                    // Collapsible Tabular Details
                    const details = el('details', undefined, 'analytics-table-details');
                    const summary = el('summary', undefined, 'analytics-table-summary');
                    summary.innerHTML = `
                        <span>Monthly record breakdown table</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    `;
                    details.append(summary);

                    const table = el('table', undefined, 'analytics-mini-table');
                    const thead = el('thead');
                    thead.innerHTML = `<tr><th>Month (UTC+8)</th><th>Count</th></tr>`;
                    table.append(thead);

                    const tbody = el('tbody');
                    const sortedMonths = Object.entries(data.months).sort(([a], [b]) => b.localeCompare(a));
                    if (sortedMonths.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="2" class="analytics-empty-state">No dated activity recorded.</td></tr>`;
                    } else {
                        sortedMonths.forEach(([m, count]) => {
                            const row = el('tr');
                            row.innerHTML = `<td>${m}</td><td><strong>${count.toLocaleString()}</strong></td>`;
                            tbody.append(row);
                        });
                    }
                    table.append(tbody);
                    details.append(table);
                    body.append(details);
                }

                card.append(body);
                panels.append(card);
            }
        });

        const available = results.filter(r => r.status === 'fulfilled').length;
        if (notice) {
            notice.textContent = `${available} of ${sources.length} sources synchronized (${loadedAt})`;
        }
    }

    async function load() {
        const button = document.getElementById('analyticsRefresh');
        if (button) button.disabled = true;
        const panels = document.getElementById('analyticsPanels');
        if (panels) panels.setAttribute('aria-busy', 'true');
        const notice = document.getElementById('analyticsStatus');
        if (notice) notice.textContent = 'Syncing live records...';

        const token = localStorage.getItem('domiknow_token');

        results = await Promise.allSettled(sources.map(async (source) => {
            const response = await fetch(source.url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`Source unavailable (${response.status})`);
            const json = await response.json();
            const data = Array.isArray(json) ? json : (json.data || json.users || json.properties || json.reports || json.billings || json.leases || []);
            if (!Array.isArray(data)) throw new Error('Unexpected source data structure');
            return data;
        }));

        loadedAt = new Intl.DateTimeFormat('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Manila'
        }).format(new Date());

        if (button) button.disabled = false;
        if (panels) panels.setAttribute('aria-busy', 'false');
        render();
    }

    document.addEventListener('DOMContentLoaded', () => {
        const role = localStorage.getItem('domiknow_role');
        if (role && role !== 'admin') return;

        const filtersForm = document.getElementById('analyticsFilters');
        if (filtersForm) {
            filtersForm.addEventListener('submit', event => {
                event.preventDefault();
                render();
            });
            filtersForm.addEventListener('reset', () => setTimeout(render, 0));
        }

        const refreshBtn = document.getElementById('analyticsRefresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', load);
        }

        load();
    });
}(typeof window === 'undefined' ? null : window));
