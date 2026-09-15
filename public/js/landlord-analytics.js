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
            const date = day(record.created_at || record.createdAt || record.timestamp || record.date || record.submitted_at || record.verified_at || record.due_date || record.lease_start_date || record.issue_date);
            return (!from && !to) || (date && (!from || date >= from) && (!to || date <= to));
        });
        const statuses = Object.create(null), months = Object.create(null);
        let undated = 0;
        for (const record of filtered) {
            const status = String(record[field] || record.status || record.lease_status || record.billing_status || record.payment_status || record.account_status || 'unknown').toLowerCase();
            statuses[status] = (statuses[status] || 0) + 1;
            const date = day(record.created_at || record.createdAt || record.timestamp || record.date || record.submitted_at || record.verified_at || record.due_date || record.lease_start_date || record.issue_date);
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

    function calculateOccupancy(properties) {
        const props = Array.isArray(properties) ? properties : [];
        let totalUnits = 0;
        let occupiedUnits = 0;
        let availableUnits = 0;
        let maintenanceUnits = 0;

        props.forEach(prop => {
            const units = Array.isArray(prop.units) ? prop.units : [];
            if (units.length > 0) {
                units.forEach(unit => {
                    totalUnits++;
                    const st = (unit.status || unit.occupancy_status || '').toLowerCase();
                    if (st === 'occupied' || st === 'rented') occupiedUnits++;
                    else if (st === 'maintenance' || st === 'under_maintenance') maintenanceUnits++;
                    else availableUnits++;
                });
            } else {
                const totalCap = Number(prop.total_units || prop.total_rooms || prop.available_units || 1);
                const availCap = Number(prop.available_units !== undefined ? prop.available_units : (prop.status === 'approved' ? 1 : 0));
                totalUnits += totalCap;
                const occ = Math.max(0, totalCap - availCap);
                occupiedUnits += occ;
                availableUnits += availCap;
            }
        });

        const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : 0;
        return {
            totalProperties: props.length,
            totalUnits,
            occupiedUnits,
            availableUnits,
            maintenanceUnits,
            occupancyRate
        };
    }

    function summarizeBillings(billings) {
        const list = Array.isArray(billings) ? billings : [];
        let totalBilled = 0;
        let totalCollected = 0;
        let totalOverdue = 0;
        let totalOutstanding = 0;

        list.forEach(b => {
            const amount = Number(b.amount || b.total_amount || b.rent_amount || 0);
            const balance = Number(b.balance !== undefined ? b.balance : (b.status === 'paid' ? 0 : amount));
            const paid = Number(b.paid_amount || (b.status === 'paid' ? amount : Math.max(0, amount - balance)));

            totalBilled += amount;
            totalCollected += paid;
            totalOutstanding += balance;

            const st = (b.status || b.billing_status || b.payment_status || '').toLowerCase();
            if (st === 'overdue' || (b.is_overdue && balance > 0)) {
                totalOverdue += balance;
            }
        });

        const settlementRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0;
        return {
            totalBillings: list.length,
            totalBilled,
            totalCollected,
            totalOverdue,
            totalOutstanding,
            settlementRate
        };
    }

    function getAttentionItems(dataMap) {
        const items = [];

        // 1. Overdue Billings
        const billings = dataMap.billings || [];
        const overdueCount = billings.filter(b => (b.status || b.billing_status || '').toLowerCase() === 'overdue' || b.is_overdue === true).length;
        if (overdueCount > 0) {
            items.push({
                title: 'Overdue Tenant Billings',
                count: overdueCount,
                desc: 'Unpaid billing statements past their due date requiring follow-up.',
                href: 'billings.html',
                actionLabel: 'View overdue bills',
                level: 'urgent'
            });
        }

        // 2. Payments Pending Verification
        const payments = dataMap.payments || [];
        const pendingPayments = payments.filter(p => ['pending', 'submitted', 'unverified', 'pending_verification'].includes((p.payment_status || p.status || '').toLowerCase())).length;
        if (pendingPayments > 0) {
            items.push({
                title: 'Payment Proofs to Verify',
                count: pendingPayments,
                desc: 'Submitted rent or utility transaction receipts awaiting confirmation.',
                href: 'billings.html',
                actionLabel: 'Verify payments',
                level: 'urgent'
            });
        }

        // 3. Maintenance Requests Awaiting Action
        const maintenance = dataMap.maintenance || [];
        const pendingMaintenance = maintenance.filter(m => ['pending', 'open', 'assigned', 'in_progress'].includes((m.status || '').toLowerCase())).length;
        if (pendingMaintenance > 0) {
            items.push({
                title: 'Maintenance Action Items',
                count: pendingMaintenance,
                desc: 'Repair tickets awaiting assignment, worker dispatch, or completion sign-off.',
                href: 'maintenance.html',
                actionLabel: 'Manage repairs',
                level: 'warning'
            });
        }

        // 4. Applications Pending Review
        const applications = dataMap.applications || [];
        const pendingApplications = applications.filter(a => ['pending', 'submitted', 'under_review'].includes((a.status || '').toLowerCase())).length;
        if (pendingApplications > 0) {
            items.push({
                title: 'Applications to Review',
                count: pendingApplications,
                desc: 'Tenant rental applications submitted and awaiting landlord review.',
                href: 'applications.html',
                actionLabel: 'Review applicants',
                level: 'warning'
            });
        }

        // 5. Open Tenant Complaints & Disputes
        const disputes = dataMap.disputes || dataMap.complaints || [];
        const openDisputes = disputes.filter(d => ['pending', 'open', 'in_progress'].includes((d.status || '').toLowerCase())).length;
        if (openDisputes > 0) {
            items.push({
                title: 'Open Complaints & Disputes',
                count: openDisputes,
                desc: 'Tenant complaints or incident reports requiring landlord resolution.',
                href: 'disputes.html',
                actionLabel: 'Resolve disputes',
                level: 'urgent'
            });
        }

        return items;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { day, summarize, monthlySeries, calculateOccupancy, summarizeBillings, getAttentionItems };
        return;
    }

    const landlordDatasets = [
        { key: 'properties', title: 'Properties & Units', url: '/api/landlord/properties', field: 'status', href: 'properties.html' },
        { key: 'applications', title: 'Tenant Applications', url: '/api/landlord/applications', field: 'status', href: 'applications.html' },
        { key: 'leases', title: 'Lease Agreements', url: '/api/leases', field: 'lease_status', href: 'leases.html' },
        { key: 'billings', title: 'Rental Billings', url: '/api/billings', field: 'billing_status', href: 'billings.html' },
        { key: 'payments', title: 'Payment Proofs', url: '/api/payments', field: 'payment_status', href: 'billings.html' },
        { key: 'maintenance', title: 'Maintenance Requests', url: '/api/maintenance/requests/landlord', field: 'status', href: 'maintenance.html' },
        { key: 'disputes', title: 'Tenant Complaints', url: '/api/landlord/complaints', field: 'status', href: 'disputes.html' },
        { key: 'feedback', title: 'Reviews & Feedback', url: '/api/landlord/ratings', field: 'status', href: 'feedback.html' }
    ];

    let datasetMap = {};

    const el = (tag, text, className) => {
        const node = document.createElement(tag);
        if (text !== undefined && text !== null) node.textContent = text;
        if (className) node.className = className;
        return node;
    };

    function getLandlordStatusClass(status) {
        const st = String(status || '').toLowerCase();
        if (['active', 'approved', 'verified', 'paid', 'resolved', 'closed', 'completed', 'signed', 'occupied'].includes(st)) return 'bg-status-active';
        if (['pending', 'submitted', 'under_review', 'open', 'assigned', 'in_progress', 'draft', 'pending_verification', 'pending_payment', 'pending_tenant_acceptance'].includes(st)) return 'bg-status-pending';
        if (['rejected', 'disabled', 'overdue', 'unverified', 'terminated', 'cancelled', 'partially_paid'].includes(st)) return 'bg-status-rejected';
        if (['available', 'vacant'].includes(st)) return 'bg-status-available';
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
        const panels = document.getElementById('landlordPanels');
        if (panels) panels.replaceChildren();

        landlordDatasets.forEach(source => {
            const rawData = datasetMap[source.key] || [];
            const data = summarize(rawData, source.field);

            if (panels) {
                const card = el('section', undefined, 'analytics-domain-card');
                card.id = `landlord-source-${source.key}`;

                // Header
                const header = el('div', undefined, 'domain-card-header');
                header.innerHTML = `
                    <div class="domain-card-title-group">
                        <h3 class="domain-card-title">${source.title}</h3>
                        <span class="domain-card-badge">${data.total.toLocaleString()} total</span>
                    </div>
                    <a href="${source.href}" class="domain-card-link" aria-label="Open ${source.title} page">
                        <span>Inspect</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </a>
                `;
                card.append(header);

                // Body
                const body = el('div', undefined, 'domain-card-body');

                // Segmented Status Distribution
                const distBox = el('div', undefined, 'status-dist-container');
                distBox.append(el('div', 'Current Status Distribution', 'status-dist-header'));

                const sortedStatuses = Object.entries(data.statuses).sort((a, b) => b[1] - a[1]);
                if (sortedStatuses.length === 0) {
                    distBox.append(el('p', 'No records found in ground-truth database.', 'analytics-empty-state'));
                } else {
                    const bar = el('div', undefined, 'status-dist-bar');
                    bar.setAttribute('role', 'progressbar');
                    bar.setAttribute('aria-label', `${source.title} status distribution`);

                    const legend = el('div', undefined, 'status-dist-legend');

                    sortedStatuses.forEach(([status, count]) => {
                        const pct = data.total > 0 ? (count / data.total) * 100 : 0;
                        const roundedPct = Math.round(pct);
                        const colorClass = getLandlordStatusClass(status);

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

                card.append(body);
                panels.append(card);
            }
        });
    }

    async function load() {
        const panels = document.getElementById('landlordPanels');
        if (panels) panels.setAttribute('aria-busy', 'true');

        const token = localStorage.getItem('domiknow_token');

        const results = await Promise.allSettled(landlordDatasets.map(async (source) => {
            const response = await fetch(source.url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`Source unavailable (${response.status})`);
            const json = await response.json();
            const data = Array.isArray(json) ? json : (json.data || json.properties || json.applications || json.leases || json.billings || json.payments || json.maintenance || json.complaints || json.ratings || []);
            if (!Array.isArray(data)) throw new Error('Unexpected source data structure');
            return { key: source.key, data };
        }));

        datasetMap = {};
        results.forEach((res, idx) => {
            const key = landlordDatasets[idx].key;
            datasetMap[key] = res.status === 'fulfilled' ? res.value.data : [];
        });

        if (panels) panels.setAttribute('aria-busy', 'false');
        render();
    }

    document.addEventListener('DOMContentLoaded', () => {
        const role = localStorage.getItem('domiknow_role');
        if (role && role !== 'landlord') return;
        load();
    });
}(typeof window === 'undefined' ? null : window));
