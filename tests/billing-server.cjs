// Isolated UI test server with in-memory records. No real backend writes.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dashboard = { id: 1, updated_at: new Date().toISOString(), data: {
    events: [{ id: 'evt_1783414026134', clientName: 'Sample Event', clientPhone: '', createdDate: '2026-08-27', eventDate: '2030-08-27', stageIndex: 2, status: 'advance-paid', serviceType: 'Invitation', venue: 'Sample venue', payments: [], items: [{ desc: 'Invitation cards', rate: 10, qty: 100, subItems: ['Printing charge', 'Envelope included'] }] }],
    staff: [], attendance: [], workLogs: [], staffApplications: [], eventStaffAssignments: [], adminEmails: ['billing-test@example.invalid'], webhooks: { url: '', triggers: {} }
} };
const sales = [];
if (process.argv.includes('--dashboard-finance')) {
    dashboard.data.events = require('./dashboard-finance-fixture.cjs').currentFinanceEvents();
}
const files = new Set(['index.html', 'style.css', 'app.js', 'document-pricing.js', 'sales-billing.js', 'manifest.json', 'tests/mock-client.js']);
http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost:3100');
    if (url.pathname === '/test-db' && req.method === 'POST') {
        let body = ''; for await (const chunk of req) body += chunk;
        const q = JSON.parse(body);
        let data = [];
        if (q.table === 'dashboard_data') {
            if (q.action === 'update') Object.assign(dashboard, q.value);
            data = [dashboard];
        } else if (q.table === 'sales_bills') {
            if (q.action === 'insert') sales.push({ ...q.value, bill_number: sales.length + 1, updated_at: new Date().toISOString() });
            data = sales.filter(row => q.filters.every(([key, value]) => row[key] === value));
            if (q.action === 'update') data.forEach(row => Object.assign(row, q.value));
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ data: q.single ? (data[0] || null) : data, error: null }));
        return;
    }
    if (url.pathname === '/sw.js') { res.setHeader('Content-Type', 'application/javascript'); res.end('/* no service worker in tests */'); return; }
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!files.has(file)) { res.writeHead(404); res.end(); return; }
    let content = fs.readFileSync(path.join(root, file), 'utf8');
    if (file === 'index.html') content = content.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^>]+><\/script>/, '<script src="/tests/mock-client.js"></script>');
    if (file === 'app.js') content = content.replace('    registerServiceWorker();', '    // disabled for isolated tests');
    const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/javascript';
    res.setHeader('Content-Type', `${type}; charset=utf-8`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "connect-src 'self'");
    res.end(content);
}).listen(3100, '127.0.0.1', () => console.log('Isolated billing test app: http://127.0.0.1:3100'));
