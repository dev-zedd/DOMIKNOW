const fs = require('fs');

const dict = JSON.parse(fs.readFileSync('generated_dictionary_data.json', 'utf8'));
const html2canvasContent = fs.readFileSync('html2canvas.min.js', 'utf8');

// Group tables into modules
const modules = [
  {
    name: "1. User Authentication & Identity Management",
    tables: ['users', 'email_verifications', 'audit_logs']
  },
  {
    name: "2. Property & Unit Inventory Management",
    tables: ['properties', 'property_amenities', 'property_documents', 'property_images', 'property_reservations', 'property_units', 'unit_amenities', 'unit_images', 'unit_beds']
  },
  {
    name: "3. TOPSIS Multi-Criteria Recommendation Engine",
    tables: ['recommendation_runs', 'recommendation_candidates', 'recommendation_exclusions']
  },
  {
    name: "4. Tenant Screening & Rental Applications",
    tables: ['tenant_applications', 'tenant_application_documents', 'tenant_screening']
  },
  {
    name: "5. Digital Lease Contract Management",
    tables: ['lease_records']
  },
  {
    name: "6. Utility Tracking, Billing & Payment Processing",
    tables: ['utility_records', 'billing_records', 'payment_records']
  },
  {
    name: "7. Maintenance Operations & Work Order Lifecycle",
    tables: ['maintenance_requests', 'maintenance_categories', 'maintenance_assignments', 'maintenance_updates', 'maintenance_task_updates', 'maintenance_photos', 'maintenance_materials', 'maintenance_reports']
  },
  {
    name: "8. Complaints, Disputes & Policy Governance",
    tables: ['complaints', 'complaint_status_logs', 'disputes', 'policy_violations']
  },
  {
    name: "9. Incident Case Triage & Case Messaging",
    tables: ['tenant_reports', 'tenant_report_evidence', 'landlord_reports', 'landlord_report_evidence', 'user_reports', 'report_messages']
  },
  {
    name: "10. Ratings, Reviews & Feedback System",
    tables: ['property_ratings', 'landlord_ratings_v2', 'landlord_ratings', 'ratings_feedback', 'property_feedback_summary']
  },
  {
    name: "11. System Notifications",
    tables: ['notifications']
  }
];

let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DOMIKNOW - Database Data Dictionary (PNG Exporter)</title>
    <style>
        :root {
            --bg-color: #0b1528;
            --card-bg: #0f1d35;
            --table-border: #1a365d;
            --header-bg: #142a4d;
            --row-alt: #0b182e;
            --text-main: #e2e8f0;
            --text-muted: #8da2c0;
            --text-highlight: #38bdf8;
            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            --badge-pk: #dc2626;
            --badge-fk: #2563eb;
        }

        body.light-theme {
            --bg-color: #f8fafc;
            --card-bg: #ffffff;
            --table-border: #cbd5e1;
            --header-bg: #0f172a;
            --row-alt: #f8fafc;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --text-highlight: #0284c7;
            --badge-pk: #b91c1c;
            --badge-fk: #1d4ed8;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--font-family);
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.5;
            padding: 24px;
            transition: background-color 0.2s, color 0.2s;
        }

        .container {
            max-width: 1440px;
            margin: 0 auto;
        }

        /* Top Sticky Header */
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            padding: 16px 20px;
            background: var(--card-bg);
            border: 1px solid var(--table-border);
            border-radius: 10px;
            margin-bottom: 24px;
            position: sticky;
            top: 12px;
            z-index: 100;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }

        .title-area h1 {
            font-size: 1.4rem;
            font-weight: 700;
            letter-spacing: -0.3px;
            color: var(--text-main);
        }

        .title-area p {
            font-size: 0.82rem;
            color: var(--text-muted);
            margin-top: 2px;
        }

        .controls {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .search-box {
            padding: 8px 14px;
            background: var(--bg-color);
            border: 1px solid var(--table-border);
            border-radius: 6px;
            color: var(--text-main);
            font-size: 0.85rem;
            width: 260px;
            outline: none;
        }

        .search-box:focus {
            border-color: var(--text-highlight);
        }

        .btn {
            padding: 8px 14px;
            background: var(--header-bg);
            border: 1px solid var(--table-border);
            color: var(--text-main);
            border-radius: 6px;
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .btn:hover {
            background: var(--text-highlight);
            color: #0b1528;
            border-color: var(--text-highlight);
        }

        .btn-primary {
            background: #0284c7;
            border-color: #38bdf8;
            color: #ffffff;
        }

        .btn-primary:hover {
            background: #0369a1;
            color: #ffffff;
        }

        .btn-download-table {
            padding: 5px 12px;
            font-size: 0.78rem;
            background: #1e3a68;
            border: 1px solid #38bdf8;
            color: #ffffff;
            border-radius: 5px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-weight: 600;
            transition: all 0.15s;
        }

        .btn-download-table:hover {
            background: #38bdf8;
            color: #0b1528;
        }

        body.light-theme .btn-download-table {
            background: #0284c7;
            border-color: #0369a1;
            color: #ffffff;
        }

        body.light-theme .btn-download-table:hover {
            background: #0369a1;
        }

        /* Navigation Pills */
        .nav-pills {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 12px;
            margin-bottom: 24px;
        }

        .pill {
            padding: 6px 12px;
            background: var(--card-bg);
            border: 1px solid var(--table-border);
            border-radius: 20px;
            font-size: 0.78rem;
            color: var(--text-muted);
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
            text-decoration: none;
        }

        .pill:hover {
            color: var(--text-main);
            background: var(--header-bg);
            border-color: var(--text-highlight);
        }

        /* Module section */
        .module-section {
            margin-bottom: 36px;
        }

        .module-title {
            font-size: 1.15rem;
            font-weight: 700;
            color: var(--text-highlight);
            margin-bottom: 16px;
            padding-left: 10px;
            border-left: 4px solid var(--text-highlight);
        }

        /* Table Card Container */
        .table-card {
            background: var(--card-bg);
            border: 1px solid var(--table-border);
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 26px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
            position: relative;
        }

        /* Capture Box specifically for High-Res PNG Rendering */
        .table-capture-box {
            background: var(--card-bg);
            padding: 16px;
            border-radius: 8px;
        }

        body.light-theme .table-capture-box {
            background: #ffffff;
        }

        .table-banner {
            background: var(--header-bg);
            padding: 10px 16px;
            border: 1px solid var(--table-border);
            border-bottom: none;
            border-radius: 6px 6px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        body.light-theme .table-banner {
            background: #0f172a;
        }

        .table-name {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 1.05rem;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: 0.5px;
        }

        .table-meta-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .table-meta {
            font-size: 0.78rem;
            color: var(--text-muted);
        }

        /* Data Dictionary Table */
        .table-wrapper {
            width: 100%;
            overflow-x: auto;
            border: 1px solid var(--table-border);
            border-radius: 0 0 6px 6px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
            text-align: left;
        }

        th {
            background: rgba(0, 0, 0, 0.35);
            color: #93c5fd;
            font-weight: 600;
            padding: 9px 14px;
            border-bottom: 1px solid var(--table-border);
            border-right: 1px solid var(--table-border);
            white-space: nowrap;
        }

        th:last-child {
            border-right: none;
        }

        body.light-theme th {
            background: #f1f5f9;
            color: #0f172a;
        }

        td {
            padding: 8px 14px;
            border-bottom: 1px solid var(--table-border);
            border-right: 1px solid var(--table-border);
            vertical-align: middle;
        }

        td:last-child {
            border-right: none;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tbody tr:nth-child(even) {
            background: var(--row-alt);
        }

        tbody tr:hover {
            background: rgba(56, 189, 248, 0.05);
        }

        .col-name {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 600;
            color: #ffffff;
            white-space: nowrap;
        }

        body.light-theme .col-name {
            color: #0f172a;
        }

        .col-type {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.8rem;
            color: #93c5fd;
            white-space: nowrap;
        }

        body.light-theme .col-type {
            color: #0369a1;
        }

        .col-fmt {
            color: var(--text-muted);
            white-space: nowrap;
            font-size: 0.8rem;
        }

        .col-size {
            text-align: center;
            color: var(--text-muted);
            white-space: nowrap;
            font-size: 0.8rem;
        }

        .col-desc {
            color: #e2e8f0;
            min-width: 200px;
        }

        body.light-theme .col-desc {
            color: #334155;
        }

        .col-ex {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.8rem;
            color: #34d399;
            word-break: break-all;
        }

        body.light-theme .col-ex {
            color: #059669;
        }

        .col-rel {
            text-align: center;
            font-weight: 700;
            white-space: nowrap;
            font-size: 0.78rem;
        }

        .badge-pk {
            color: #f87171;
            font-weight: 700;
        }

        body.light-theme .badge-pk {
            color: #dc2626;
        }

        .badge-fk {
            color: #60a5fa;
            font-weight: 600;
        }

        body.light-theme .badge-fk {
            color: #2563eb;
        }

        .badge-none {
            color: #64748b;
        }

        /* Toast notification */
        #toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #0284c7;
            color: #ffffff;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.85rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
            display: none;
            z-index: 999;
            animation: fadeIn 0.2s ease-in-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @media print {
            body {
                background: #ffffff !important;
                color: #000000 !important;
                padding: 0 !important;
            }
            .controls, .nav-pills, header, .btn-download-table, .table-meta-group button {
                display: none !important;
            }
            .table-card {
                border: 1px solid #000000 !important;
                break-inside: avoid;
                margin-bottom: 20px !important;
                box-shadow: none !important;
            }
            .table-banner {
                background: #f1f5f9 !important;
                color: #000000 !important;
                border-bottom: 1px solid #000000 !important;
            }
            .table-name {
                color: #000000 !important;
            }
            th, td {
                border: 1px solid #cccccc !important;
                color: #000000 !important;
            }
        }
    </style>
    <!-- Embed html2canvas directly for offline instant PNG generation -->
    <script>
        ${html2canvasContent}
    </script>
</head>
<body>
    <div class="container">
        <header>
            <div class="title-area">
                <h1>DOMIKNOW DATABASE DATA DICTIONARY</h1>
                <p>Simple Standard Format • Download any table as crisp PNG image (46 Tables)</p>
            </div>
            <div class="controls">
                <input type="text" id="searchInput" class="search-box" placeholder="Search table or column name..." oninput="filterTables()">
                <button class="btn" onclick="toggleTheme()" id="themeBtn">Theme: Dark</button>
                <button class="btn" onclick="window.print()">Print / PDF</button>
            </div>
        </header>

        <div class="nav-pills">
`;

for (let i = 0; i < modules.length; i++) {
  const m = modules[i];
  html += `            <a href="#mod-${i}" class="pill">${m.name}</a>\n`;
}

html += `        </div>\n\n`;

for (let i = 0; i < modules.length; i++) {
  const mod = modules[i];
  html += `        <section id="mod-${i}" class="module-section">\n`;
  html += `            <h2 class="module-title">${mod.name}</h2>\n`;

  for (const tableName of mod.tables) {
    const fields = dict[tableName] || [];
    html += `            <div class="table-card" id="card-${tableName}">\n`;
    html += `                <div class="table-capture-box" id="capture-${tableName}">\n`;
    html += `                    <div class="table-banner">\n`;
    html += `                        <span class="table-name">${tableName}</span>\n`;
    html += `                        <div class="table-meta-group">\n`;
    html += `                            <span class="table-meta">${fields.length} Columns</span>\n`;
    html += `                            <button class="btn-download-table" onclick="downloadTablePNG('${tableName}')" title="Download ${tableName} as PNG Image">\n`;
    html += `                                📷 Download PNG\n`;
    html += `                            </button>\n`;
    html += `                        </div>\n`;
    html += `                    </div>\n`;
    html += `                    <div class="table-wrapper">\n`;
    html += `                        <table>\n`;
    html += `                            <thead>\n`;
    html += `                                <tr>\n`;
    html += `                                    <th>Field Name</th>\n`;
    html += `                                    <th>Data Type</th>\n`;
    html += `                                    <th>Data Format</th>\n`;
    html += `                                    <th>Field Size</th>\n`;
    html += `                                    <th>Description</th>\n`;
    html += `                                    <th>Example</th>\n`;
    html += `                                    <th>Relationship</th>\n`;
    html += `                                </tr>\n`;
    html += `                            </thead>\n`;
    html += `                            <tbody>\n`;

    for (const f of fields) {
      let relBadge = `<span class="badge-none">-</span>`;
      if (f.relationship === 'PK') {
        relBadge = `<span class="badge-pk">PK</span>`;
      } else if (f.relationship.startsWith('FK')) {
        relBadge = `<span class="badge-fk" title="${f.relationship}">${f.relationship}</span>`;
      }

      html += `                                <tr>\n`;
      html += `                                    <td class="col-name">${f.fieldName}</td>\n`;
      html += `                                    <td class="col-type">${f.dataType}</td>\n`;
      html += `                                    <td class="col-fmt">${f.dataFormat}</td>\n`;
      html += `                                    <td class="col-size">${f.fieldSize}</td>\n`;
      html += `                                    <td class="col-desc">${f.description}</td>\n`;
      html += `                                    <td class="col-ex">${f.example}</td>\n`;
      html += `                                    <td class="col-rel">${relBadge}</td>\n`;
      html += `                                </tr>\n`;
    }

    html += `                            </tbody>\n`;
    html += `                        </table>\n`;
    html += `                    </div>\n`;
    html += `                </div>\n`;
    html += `            </div>\n`;
  }

  html += `        </section>\n\n`;
}

html += `    </div>

    <div id="toast">Downloading PNG...</div>

    <script>
        function toggleTheme() {
            const isLight = document.body.classList.toggle('light-theme');
            document.getElementById('themeBtn').textContent = isLight ? 'Theme: Light' : 'Theme: Dark';
        }

        function filterTables() {
            const query = document.getElementById('searchInput').value.toLowerCase().trim();
            const cards = document.querySelectorAll('.table-card');

            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                if (!query || text.includes(query)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }

        async function downloadTablePNG(tableName) {
            const captureElem = document.getElementById('capture-' + tableName);
            if (!captureElem) return;

            // Temporarily hide the download button inside the capture box so it is not in the PNG image
            const btn = captureElem.querySelector('.btn-download-table');
            if (btn) btn.style.visibility = 'hidden';

            showToast('Generating high-resolution PNG for ' + tableName + '...');

            try {
                const isLight = document.body.classList.contains('light-theme');
                const bgColor = isLight ? '#ffffff' : '#0b1528';

                const canvas = await html2canvas(captureElem, {
                    scale: 2.5, // 2.5x high-res rendering for crisp print/document quality
                    backgroundColor: bgColor,
                    useCORS: true,
                    logging: false
                });

                if (btn) btn.style.visibility = 'visible';

                // Create download link
                const link = document.createElement('a');
                link.download = tableName + '_data_dictionary.png';
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                showToast('Downloaded ' + tableName + '_data_dictionary.png successfully!');
            } catch (err) {
                if (btn) btn.style.visibility = 'visible';
                console.error('PNG Export Error:', err);
                alert('Export Error: ' + err.message);
            }
        }
    </script>
</body>
</html>`;

fs.writeFileSync('../data_dictionary.html', html);
fs.writeFileSync('public/data_dictionary.html', html);
console.log('Successfully updated data_dictionary.html with PNG export in both root and public directory!');
