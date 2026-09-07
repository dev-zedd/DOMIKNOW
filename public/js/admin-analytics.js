(function (root) {
    'use strict';
    function day(value) {
        if (!value) return null;
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return null;
        return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
    }
    function summarize(records, field, from = '', to = '') {
        const filtered = records.filter(record => {
            const date = day(record.created_at);
            return (!from && !to) || (date && (!from || date >= from) && (!to || date <= to));
        });
        const statuses = Object.create(null), months = Object.create(null);
        let undated = 0;
        for (const record of filtered) {
            const status = String(record[field] || 'unknown');
            statuses[status] = (statuses[status] || 0) + 1;
            const date = day(record.created_at);
            if (date) months[date.slice(0, 7)] = (months[date.slice(0, 7)] || 0) + 1;
            else undated++;
        }
        return { total: filtered.length, statuses, months, undated };
    }
    function monthlySeries(months) {
        const keys = Object.keys(months).sort();
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
    if (typeof module !== 'undefined' && module.exports) { module.exports = { day, summarize, monthlySeries }; return; }
    const sources = [
        ['User accounts', '/api/users', 'account_status', 'users.html'],
        ['Property submissions', '/api/admin/properties/review', 'status', 'property-review.html'],
        ['Reservations', '/api/reservations', 'status', 'reservations.html'],
        ['Payment submissions', '/api/admin/monitor/payments', 'payment_status', 'payments.html'],
        ['Reports about tenants', '/api/admin/tenant-reports', 'status', 'reports.html'],
        ['Reports about landlords', '/api/admin/landlord-reports', 'status', 'reports.html']
    ];
    let results = [], loadedAt = '';
    const el = (tag, text, className) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    };
    function monthlyChart(months, title) {
        const series = monthlySeries(months);
        const figure = el('figure', undefined, 'analytics-monthly');
        figure.append(el('figcaption', 'Monthly activity'));
        if (!series.length) {
            figure.append(el('p', 'No dated activity to plot.', 'analytics-empty'));
            return figure;
        }
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 520 190');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `${title}: monthly record counts. Exact values follow in the data table.`);
        const add = (tag, attrs, text) => {
            const node = document.createElementNS(svg.namespaceURI, tag);
            Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
            if (text !== undefined) node.textContent = text;
            svg.append(node); return node;
        };
        const max = Math.max(1, ...series.map(item => item.count));
        const top = Math.max(2, Math.ceil(max / 2) * 2);
        [0, top / 2, top].forEach(value => {
            const y = 145 - value / top * 120;
            add('line', { x1: 36, x2: 514, y1: y, y2: y, class: 'analytics-gridline' });
            add('text', { x: 28, y: y + 4, 'text-anchor': 'end', class: 'analytics-axis' }, value);
        });
        const step = 478 / series.length;
        series.forEach(({month, count}, index) => {
            const height = count / top * 120;
            const x = 36 + step * index + step * .2;
            const bar = add('rect', { x, y: 145 - height, width: step * .6, height, rx: 3, class: 'analytics-column' });
            const tooltip = document.createElementNS(svg.namespaceURI, 'title');
            tooltip.textContent = `${month}: ${count} records`; bar.append(tooltip);
            add('text', { x: x + step * .3, y: 138 - height, 'text-anchor': 'middle', class: 'analytics-axis' }, count);
            if (series.length <= 6 || index % 2 === 0 || index === series.length - 1) {
                add('text', { x: x + step * .3, y: 165, 'text-anchor': 'middle', class: 'analytics-axis' }, new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)));
            }
        });
        figure.append(svg, el('p', `${series[0].month} to ${series[series.length - 1].month} . Up to 12 months ending with the latest recorded activity. Zero months between records are included.`, 'analytics-chart-note'));
        return figure;
    }
    function render() {
        const from = document.getElementById('analyticsFrom').value;
        const to = document.getElementById('analyticsTo').value;
        const notice = document.getElementById('analyticsStatus');
        if (from && to && from > to) { notice.textContent = 'Choose an end date on or after the start date. Previous results remain displayed.'; return; }
        const panels = document.getElementById('analyticsPanels');
        panels.replaceChildren();
        const figures = document.getElementById('analyticsFigures');
        figures.replaceChildren();
        sources.forEach(([title, , field, href], index) => {
            const panel = el('section', undefined, 'analytics-panel');
            panel.append(el('h2', title));
            const result = results[index];
            const metric = el('a', undefined, 'analytics-figure');
            metric.href = `#analytics-source-${index}`;
            metric.append(el('span', title), el('strong', result?.status === 'fulfilled' ? summarize(result.value, field, from, to).total.toLocaleString() : 'Unavailable'), el('small', 'Records in selected period'));
            figures.append(metric);
            panel.id = `analytics-source-${index}`;
            if (result?.status !== 'fulfilled') {
                panel.append(el('p', 'Data unavailable. Refresh data to try again.'));
            } else {
                const data = summarize(result.value, field, from, to);
                panel.append(el('strong', `${data.total.toLocaleString()} ${data.total === 1 ? 'record' : 'records'}`, 'analytics-total'));
                panel.append(el('h3', 'Current status distribution', 'analytics-chart-heading'));
                const bars = el('div', undefined, 'analytics-bars');
                Object.entries(data.statuses).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
                    const row = el('div');
                    const label = el('div', undefined, 'analytics-bar-label');
                    label.append(el('span', status.replaceAll('_', ' ')), el('span', `${count} (${Math.round(count / data.total * 100)}%)`));
                    const track = el('div', undefined, 'analytics-track');
                    track.setAttribute('aria-hidden', 'true');
                    const fill = el('div', undefined, 'analytics-fill');
                    fill.style.width = `${count / data.total * 100}%`;
                    track.append(fill); row.append(label, track); bars.append(row);
                });
                panel.append(bars);
                if (!data.total) panel.append(el('p', 'No records in this date range.'));
                panel.append(monthlyChart(data.months, title));
                const details = el('details');
                details.append(el('summary', 'View exact monthly values'));
                const table = el('table');
                table.append(el('caption', 'Records grouped by creation month (Philippine time)'));
                const head = el('thead'), heading = el('tr');
                for (const name of ['Month', 'Records']) { const th = el('th', name); th.scope = 'col'; heading.append(th); }
                head.append(heading); table.append(head);
                const body = el('tbody');
                Object.entries(data.months).sort(([a], [b]) => b.localeCompare(a)).forEach(([month, count]) => {
                    const row = el('tr'); row.append(el('td', month), el('td', count)); body.append(row);
                });
                table.append(body); details.append(table, el('p', `${data.undated} undated records. Months without records are omitted.`)); panel.append(details);
            }
            const link = el('a', 'View records'); link.href = href; panel.append(link); panels.append(panel);
        });
        const available = results.filter(result => result.status === 'fulfilled').length;
        notice.textContent = `${available} of ${sources.length} sources available${available < sources.length ? ' — partial data' : ''}. Updated ${loadedAt}. Created: ${from || 'earliest'} through ${to || 'latest'}.`;
    }
    async function load() {
        const button = document.getElementById('analyticsRefresh');
        button.disabled = true;
        document.getElementById('analyticsPanels').setAttribute('aria-busy', 'true');
        document.getElementById('analyticsStatus').textContent = 'Loading analytics...';
        results = await Promise.allSettled(sources.map(async ([, url]) => {
            const response = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('domiknow_token')}` } });
            if (!response.ok) throw new Error('Source unavailable');
            const json = await response.json();
            if (!Array.isArray(json.data)) throw new Error('Unexpected source format');
            return json.data;
        }));
        loadedAt = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date());
        button.disabled = false;
        document.getElementById('analyticsPanels').setAttribute('aria-busy', 'false');
        render();
    }
    document.addEventListener('DOMContentLoaded', () => {
        if (localStorage.getItem('domiknow_role') !== 'admin') return;
        document.getElementById('analyticsFilters').addEventListener('submit', event => { event.preventDefault(); render(); });
        document.getElementById('analyticsFilters').addEventListener('reset', () => setTimeout(render, 0));
        document.getElementById('analyticsRefresh').addEventListener('click', load);
        load();
    });
}(typeof window === 'undefined' ? null : window));
