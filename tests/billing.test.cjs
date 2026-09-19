const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { financeEvent, currentFinanceEvents } = require('./dashboard-finance-fixture.cjs');

function setup() {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } });
        return elements.get(id);
    };
    const context = vm.createContext({ console, TextEncoder, URL, crypto: require('node:crypto').webcrypto,
        setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
        document: { addEventListener() {}, createElement: () => ({ className: '', innerHTML: '' }), getElementById: element, querySelectorAll: () => [], activeElement: null },
        window: { addEventListener() {} }, navigator: {}, localStorage: { getItem: () => null, setItem() {} },
        confirm: () => true, supabase: { createClient: () => ({}) } });
    for (const file of ['document-pricing.js', 'app.js', 'sales-billing.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
    return { context, element, run: code => vm.runInContext(code, context) };
}

test('100 invitations plus printing charge adds exactly once', () => {
    const { context: c } = setup();
    const items = [{ desc: 'Invitations', rate: 10, qty: 100, subItems: ['Envelope included', { desc: 'Printing', rate: 500, qty: null }] }];
    assert.equal(c.getDocumentCalculations({ items, discount: 100 }).subtotal, 1500);
    assert.equal(c.getDocumentCalculations({ items, discount: 100 }).grandTotal, 1400);
});

test('blank, invalid and legacy zero prices stay blank; typed zero is explicit', () => {
    const { context: c } = setup();
    for (const rate of [null, undefined, '', ' ', 0, NaN, -1]) assert.equal(c.formatDocumentLineAmount({ rate, qty: 100 }), '');
    assert.equal(c.formatDocumentLineAmount({ rate: 0, rateEntered: true, qty: 100 }), '₹0.00');
    assert.equal(c.getDocumentLineAmount({ rate: 7.5, qty: 2.5 }), 18.75);
    assert.equal(c.getDocumentLineAmount({ rate: 500, qty: 0 }), 0);
    assert.equal(c.optionalDocumentNumber('1,500.25'), 1500.25);
});

test('legacy sub-service strings and optional objects render without zero placeholders or HTML injection', () => {
    const { context: c } = setup();
    const html = c.renderPricedDocumentRows([{ desc: '<Frame>', rate: null, qty: null, subItems: ['Packing', { desc: 'Printing', rate: null, qty: null }] }], 'quotation');
    assert.ok(html.includes('&lt;Frame&gt;'));
    assert.ok(html.includes('Sub-service rate'));
    assert.ok(!html.includes('₹0'));
    assert.ok(!html.includes('[object Object]'));
    assert.ok(!c.documentItemsText([{ desc: 'Unpriced', subItems: ['Packing'] }]).includes('₹'));
});

test('priced sub-items survive quote-to-invoice copy and independent invoice edits', () => {
    const { context: c } = setup();
    const event = { quotationData: { items: [{ desc: 'Invitations', rate: 10, qty: 100, subItems: [{ desc: 'Printing', rate: 500, qty: null }] }], bonusItems: [], discount: 0 } };
    c.copyQuotationToInvoice(event);
    const reloaded = JSON.parse(JSON.stringify(event));
    assert.equal(c.getDocumentCalculations(c.getInvoiceDocument(reloaded)).grandTotal, 1500);
    reloaded.invoiceData.items[0].subItems[0].rate = 700;
    assert.equal(c.getQuotationCalculations(reloaded).grandTotal, 1500);
    assert.equal(c.getDocumentCalculations(c.getInvoiceDocument(reloaded)).grandTotal, 1700);
});

test('pricing fields update quote and invoice visible totals and preserve descriptions', () => {
    const { context: c, run, element } = setup();
    run("saveState = () => Promise.resolve(true); appState.events=[{id:'evt_test', stageIndex:2, status:'advance-paid', serviceType:'Decoration', quotationData:{items:[{desc:'Invitations',rate:10,qty:100,subItems:['Printing']}],bonusItems:[],discount:0}}]; currentQuotationEventId='evt_test'; currentInvoiceEventId='evt_test';");
    c.renderQuotationItems(run('appState.events[0]'));
    c.editPricedDocumentLine('quotation', 0, 0, 'rate', { textContent: '500' });
    assert.equal(element('q-grand-total').textContent, '₹1,500.00');
    assert.equal(run('appState.events[0].quotationData.items[0].subItems[0].desc'), 'Printing');
    c.copyQuotationToInvoice(run('appState.events[0]'));
    c.renderInvoiceItems(run('appState.events[0]'));
    c.editPricedDocumentLine('invoice', 0, 0, 'rate', { textContent: '' });
    assert.equal(element('inv-grand-total').textContent, '₹1,000.00');
    assert.equal(element('invoice-line-total-0-0').textContent, '');
    assert.equal(c.getQuotationCalculations(run('appState.events[0]')).grandTotal, 1500);
});

test('department/document descriptions remain compatible with priced sub-items', () => {
    const { context: c } = setup();
    const event = { serviceType: 'Wedding', items: [{ desc: 'Wedding', rate: 100, qty: 1, subItems: [{ desc: 'Photography', rate: 50, qty: null }] }] };
    assert.ok(c.getEventDepartments(event).includes('Photography & Videography'));
    const service = c.getEventDocumentServiceItems(event)[0];
    assert.equal(service.subItems[0], 'Photography');
    assert.equal(service.total, 150);
});

test('photo delivery note applies only when a photography service is present', () => {
    const { context: c } = setup();
    assert.equal(c.hasPhotographyService([{ desc: 'Photography & Videography' }]), true);
    assert.equal(c.hasPhotographyService([{ desc: 'Wedding', subItems: [{ desc: 'Candid Photographer' }] }]), true);
    assert.equal(c.hasPhotographyService([{ desc: 'Decoration' }, { desc: 'Catering' }]), false);
    assert.equal(c.hasPhotographyService([{ desc: 'Videography' }]), false);
});

test('event execution customer form uses a secure token link and WhatsApp message', () => {
    const { context: c } = setup();
    const event = { id: 'evt_1', clientName: 'Meena', clientPhone: '9876543210', eventDate: '2026-09-25', serviceType: 'Wedding' };
    const token = '89e124d4-71f4-4f1c-a648-6dc2515f963a';
    const url = c.getEventDetailsFormUrl(token);
    const message = c.buildEventDetailsWhatsAppMessage(event, token);
    assert.equal(url, `https://ddeventsandmanagement.com/event-details.html?token=${token}`);
    assert.ok(message.includes('Meena'));
    assert.ok(message.includes(url));
    assert.ok(!url.includes(event.clientPhone));
});

test('event execution card shows form status without exposing its access token', () => {
    const { context: c, run } = setup();
    run("appState.events=[{id:'evt_1',eventDetailsForm:{accessToken:'private-token',status:'submitted',response:{session:'Evening',eventStartTime:'18:30'},submittedAt:'2026-09-19T10:00:00Z'}}]");
    const html = c.getEventDetailsFormCardHtml({ id: 'evt_1' });
    assert.ok(html.includes('Details Received'));
    assert.ok(html.includes('Evening'));
    assert.ok(html.includes('18:30'));
    assert.ok(!html.includes('private-token'));
});

test('newer customer form response survives a later stale dashboard save merge', () => {
    const { context: c } = setup();
    const local = [{ id: 'evt_1', eventDetailsForm: { accessToken: 'token', status: 'pending', updatedAt: '2026-09-19T10:00:00Z' } }];
    const server = [{ id: 'evt_1', eventDetailsForm: { accessToken: 'token', status: 'submitted', response: { session: 'Morning' }, updatedAt: '2026-09-19T10:05:00Z' } }];
    const merged = c.mergeEventDocumentChanges(local, server);
    assert.equal(merged[0].eventDetailsForm.status, 'submitted');
    assert.equal(merged[0].eventDetailsForm.response.session, 'Morning');
});

test('dashboard money includes Advance Pay through Event Execution stages', () => {
    const { context: c } = setup();
    const summary = c.getDashboardFinancialSummary(currentFinanceEvents());
    assert.deepEqual(JSON.parse(JSON.stringify(summary)), {
        bookedEventValue: 12300, advanceCollected: 10200, amountReceived: 10300, pendingPayments: 2000
    });
});

test('only Advance Pay and Event Execution stages contribute to booked value', () => {
    const { context: c } = setup();
    for (const stage of [2, 3]) {
        const event = financeEvent(stage, stage, 1000, [{ method: 'Advance', amount: 200 }]);
        const summary = c.getDashboardFinancialSummary([event]);
        assert.equal(summary.bookedEventValue, 1000);
        assert.equal(summary.pendingPayments, 800);
    }
    for (const stage of [0, 1, 4, 5, 6]) {
        const event = financeEvent(stage, stage, 1000, [{ method: 'Advance', amount: 200 }]);
        assert.ok(Object.values(c.getDashboardFinancialSummary([event])).every(amount => amount === 0));
    }
});

test('stage membership remains authoritative regardless of event date', () => {
    const { context: c } = setup();
    for (const eventDate of ['2026-08-26', '2026-08-27', '2026-08-28', '', '27-08-2026']) {
        const event = financeEvent(eventDate || 'none', 2, 1000, [{ method: 'Advance', amount: 200 }], { eventDate });
        assert.equal(c.getDashboardFinancialSummary([event]).pendingPayments, 800);
    }
});

test('visible booked status wins over a stale legacy Held checkbox flag', () => {
    const { context: c } = setup();
    const event = financeEvent(1, 2, 1000, [{ method: 'Advance', amount: 200 }]);
    assert.equal(c.getDashboardFinancialSummary([event]).pendingPayments, 800);
    event.heldCompleted = true;
    assert.equal(c.getDashboardFinancialSummary([event]).pendingPayments, 800);
    event.status = 'event-completed';
    assert.equal(c.getDashboardFinancialSummary([event]).pendingPayments, 800);
    event.status = 'pending-bill';
    assert.equal(c.getDashboardFinancialSummary([event]).pendingPayments, 0);
});

test('current booked pending uses invoice discounts and priced sub-services', () => {
    const { context: c } = setup();
    const event = financeEvent(1, 2, 1000, [{ method: 'Cash', amount: 1000 }]);
    event.invoiceData.items[0].subItems = [{ desc: 'Extra flowers', rate: 500, qty: 1 }];
    event.invoiceData.discount = 100;
    assert.equal(c.getDashboardFinancialSummary([event]).pendingPayments, 400);
});

test('dashboard handles numeric-string payments and decimal amounts exactly', () => {
    const { context: c } = setup();
    const event = financeEvent(1, 2, 0.3, [{ method: 'ADVANCE', amount: '0.1' }, { method: 'Cash', amount: '0.2' }]);
    const summary = c.getDashboardFinancialSummary([event]);
    assert.equal(summary.advanceCollected, 0.1);
    assert.equal(summary.amountReceived, 0.3);
    assert.equal(summary.pendingPayments, 0);
});

test('empty and history-only dashboards return zero current amounts', () => {
    const { context: c } = setup();
    for (const events of [[], [financeEvent(2, 6, 1000, [{ method: 'Cash', amount: 1000 }])]]) {
        assert.deepEqual(JSON.parse(JSON.stringify(c.getDashboardFinancialSummary(events))), {
            bookedEventValue: 0, advanceCollected: 0, amountReceived: 0, pendingPayments: 0
        });
    }
});

test('dashboard updates after completion and reload without deleting historical records', () => {
    const { context: c, run, element } = setup();
    const events = currentFinanceEvents();
    c.financeFixture = events;
    run('appState.events = financeFixture; appState.attendance = [];');
    const before = JSON.stringify(events);
    c.renderDashboard();
    assert.equal(element('stat-booked-value').textContent, '₹12,300.00');
    assert.equal(element('stat-advance-collected').textContent, '₹10,200.00');
    assert.equal(element('stat-pending-payments').textContent, '₹2,000.00');
    assert.equal(JSON.stringify(events), before);
    events[0].stageIndex = 4;
    events[0].status = 'pending-bill';
    c.renderDashboard();
    assert.equal(element('stat-booked-value').textContent, '₹11,300.00');
    assert.equal(element('stat-advance-collected').textContent, '₹10,000.00');
    assert.equal(element('stat-pending-payments').textContent, '₹1,300.00');
    const reload = setup();
    assert.equal(reload.context.getDashboardFinancialSummary(JSON.parse(JSON.stringify(events))).pendingPayments, 1300);
    assert.equal(events.length, 9);
});

test('failed shared-data load preserves the current state and never creates or saves an empty default', async () => {
    const { context: c, run } = setup();
    run(`
        appState = { events: [{ id: 'must-survive' }], staff: [] };
        hasLoadedSharedState = false;
        loadFailureDefaultCalled = false;
        loadFailureSaveCalled = false;
        initDefaultState = () => { loadFailureDefaultCalled = true; appState = { events: [] }; };
        saveState = () => { loadFailureSaveCalled = true; return Promise.resolve(true); };
        sb.from = () => ({
            select() { return this; },
            eq() { return this; },
            single: async () => ({ data: null, error: { message: 'offline' } })
        });
    `);

    assert.equal(await c.loadState(), false);
    assert.equal(run("appState.events[0].id"), 'must-survive');
    assert.equal(run('loadFailureDefaultCalled'), false);
    assert.equal(run('loadFailureSaveCalled'), false);
    assert.equal(run('hasLoadedSharedState'), false);
});

test('shared-data save is blocked until a successful load has completed', async () => {
    const { context: c, run } = setup();
    run(`
        hasLoadedSharedState = false;
        blockedSaveReachedDatabase = false;
        blockedSaveToast = '';
        showToast = message => { blockedSaveToast = message; };
        sb.from = () => { blockedSaveReachedDatabase = true; throw new Error('database must not be called'); };
    `);

    assert.equal(await c.saveState(), false);
    assert.equal(run('blockedSaveReachedDatabase'), false);
    assert.match(run('blockedSaveToast'), /Nothing was saved/);
});

test('successful shared-data load enables later saves and applies the server state', async () => {
    const { context: c, run } = setup();
    run(`
        hasLoadedSharedState = false;
        sb.from = () => ({
            select() { return this; },
            eq() { return this; },
            single: async () => ({
                data: { data: { events: [{ id: 'from-server' }], staff: [] }, updated_at: '2026-08-27T12:00:00.000Z' },
                error: null
            })
        });
    `);

    assert.equal(await c.loadState(), true);
    assert.equal(run("appState.events[0].id"), 'from-server');
    assert.equal(run('hasLoadedSharedState'), true);
    assert.equal(run('lastSeenDashboardUpdateAt'), '2026-08-27T12:00:00.000Z');
});

test('dashboard copy shows only booked value, advance and remaining balance', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.ok(html.includes('Booked Event Value'));
    assert.ok(html.includes('Advance Received'));
    assert.ok(html.includes('Still To Receive'));
    assert.ok(html.includes('remaining balance after deducting every payment already recorded'));
    assert.ok(!html.includes('Received So Far'));
    assert.ok(!html.includes('stat-current-received'));
    assert.ok(!html.includes('Current Quotation Amount'));
    assert.ok(!html.includes('stat-quotation-amount'));
    assert.ok(!html.includes('stat-bills-settled'));
});

test('Sales Billing creates no event and persists separately with unique number', async () => {
    const { context: c, run } = setup();
    run("currentAdminEmail='test@example.invalid'; showToast = () => {}; salesBillDraft={id:'test-id',customerName:'Test Customer',date:'2026-08-27',items:[{desc:'Frame',rate:200,qty:2}],discount:null,paid:null}; salesBillDirty=true; sb.from=table=>{ if(table!=='sales_bills')throw new Error('wrong table'); return { insert:row=>({select:()=>({maybeSingle:async()=>({data:{...row,bill_number:1,updated_at:'2026-08-27T00:00:00Z'},error:null})})}) }; }; ");
    assert.equal(await c.saveSalesBill(), true);
    assert.equal(run('appState.events.length'), 0);
    assert.equal(run('salesBillDirty'), false);
    assert.equal(c.salesBillNumber(), 'SALE-000001');
});

test('failed or conflicting sales save retains unsaved draft and blocks export', async () => {
    const { context: c, run } = setup();
    run("currentAdminEmail='test@example.invalid'; showToast=()=>{}; console={error:()=>{}}; salesBillDraft={id:'test-id',customerName:'Test',date:'2026-08-27',items:[{desc:'Frame',rate:200}],discount:null,paid:null}; salesBillDirty=true; sb.from=()=>({insert:()=>({select:()=>({maybeSingle:async()=>({data:null,error:{message:'network unavailable'}})})})});");
    assert.equal(await c.saveSalesBill(), false);
    assert.equal(run('salesBillDraft.items[0].rate'), 200);
    assert.equal(run('salesBillDirty'), true);
    assert.equal(run('salesBillSaving'), false);
});

test('HTML loads dependencies before app and contains independent sales tab', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.ok(html.indexOf('src="document-pricing.js') < html.indexOf('src="app.js'));
    assert.ok(html.includes('src="sales-billing.js'));
    assert.ok(html.includes('id="tab-sales-billing"'));
});

test('Event Execution is a label-only change preserving the stored stage', () => {
    const { context: c } = setup();
    assert.equal(c.getStageLabel('event-completed'), 'Event Execution');
    assert.equal(c.getStageIndex('event-completed'), 3);
    const event = { stageIndex: 3 };
    c.syncEventStage(event);
    assert.equal(event.status, 'event-completed');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.ok(html.includes('Event Execution Stage'));
    assert.ok(!html.includes('Event Completed'));
    assert.ok(html.includes('id="whatsapp-center-modal"'));
});

test('quotation can be confirmed without advance and skips directly to Event Execution', async () => {
    const { context: c, run } = setup();
    run(`
        appState.events = [{
            id: 'evt_without_advance', clientName: 'No Advance Customer', clientPhone: '6374503310',
            eventDate: '2026-09-10', serviceType: 'Decoration', stageIndex: 1, status: 'quotation',
            confirmedWithoutAdvance: true, quotationData: { items: [{ desc: 'Decoration', rate: 1000, qty: 1 }], bonusItems: [], discount: 0 }
        }];
        saveState = () => Promise.resolve(true);
        stageNotifications = 0;
        notifyStaffOfBookedEvent = () => { stageNotifications += 1; };
        refreshAllViews = () => {};
        showToast = () => {};
    `);

    assert.equal(c.getNextStageForEvent(run('appState.events[0]')).key, 'event-completed');
    assert.equal(await c.advanceEventStage('evt_without_advance'), true);
    assert.equal(run('appState.events[0].stageIndex'), 3);
    assert.equal(run('appState.events[0].status'), 'event-completed');
    assert.equal(run('(appState.events[0].payments || []).length'), 0);
    assert.equal(run('stageNotifications'), 1);
});

test('normal quotation approval still moves to Advance Pay', async () => {
    const { context: c, run } = setup();
    run(`
        appState.events = [{
            id: 'evt_normal_advance', stageIndex: 1, status: 'quotation',
            confirmedWithoutAdvance: false, quotationData: { items: [], bonusItems: [], discount: 0 }
        }];
        saveState = () => Promise.resolve(true);
        notifyStaffOfBookedEvent = () => {};
        refreshAllViews = () => {};
        showToast = () => {};
    `);

    assert.equal(c.getNextStageForEvent(run('appState.events[0]')).key, 'advance-paid');
    assert.equal(await c.advanceEventStage('evt_normal_advance'), true);
    assert.equal(run('appState.events[0].stageIndex'), 2);
    assert.equal(run('appState.events[0].status'), 'advance-paid');
});

test('WhatsApp phone normalization supports Indian and international formats', () => {
    const { context: c } = setup();
    for (const phone of ['6374503310', '06374503310', '+91 63745 03310', '0091 6374503310']) {
        assert.equal(c.normalizeWhatsAppPhone(phone), '916374503310');
    }
    assert.equal(c.normalizeWhatsAppPhone('+44 7700 900123'), '447700900123');
    for (const phone of ['', undefined, 'invalid', '12345', '0000000000', '1234567890123456']) {
        assert.equal(c.normalizeWhatsAppPhone(phone), '');
    }
});

test('WhatsApp actions target the selected customer and prefill the correct document', () => {
    const { context: c, run } = setup();
    c.whatsAppEvents = [financeEvent('1783414026134', 2, 1000, [{ method: 'Advance', amount: 200, date: '2026-08-27' }], {
        clientName: 'Sample & Customer', clientPhone: '+91 63745 03310'
    })];
    run('appState.events = whatsAppEvents; window.open = (url, target, features) => { window.lastOpen = { url, target, features }; }; showToast = () => {};');
    const eventId = run('appState.events[0].id');
    for (const [type, heading] of [['quotation', '*QUOTATION - DD EVENTS*'], ['invoice', '*TAX INVOICE - DD EVENTS*'], ['chat', 'Hi Sample & Customer,']]) {
        assert.equal(c.openCustomerWhatsApp(eventId, type), true);
        const url = new URL(c.window.lastOpen.url);
        assert.equal(url.hostname, 'wa.me');
        assert.equal(url.pathname, '/916374503310');
        assert.ok(url.searchParams.get('text').startsWith(heading));
        assert.ok(url.searchParams.get('text').includes('Sample & Customer'));
        assert.equal(c.window.lastOpen.target, '_blank');
    }
    c.openCustomerWhatsApp(eventId, 'invoice');
    const invoice = new URL(c.window.lastOpen.url).searchParams.get('text');
    assert.ok(invoice.includes('*Total Paid:* ₹200'));
    assert.ok(invoice.includes('*Pending Balance:* *₹800*'));
});

test('WhatsApp rejects missing phones, unknown records and invoices before booking', () => {
    const { context: c, run } = setup();
    run("appState.events = [{id:'evt_1783414026134', clientName:'Test', stageIndex:1, status:'quotation', clientPhone:'6374503310'}]; window.open = () => { throw new Error('Must not open'); }; showToast = () => {};");
    assert.equal(c.openCustomerWhatsApp('evt_1783414026134', 'invoice'), false);
    assert.equal(c.openCustomerWhatsApp('missing', 'chat'), false);
    assert.equal(c.openWhatsAppChat('', 'Test'), false);
});

test('WhatsApp Center filters customers, escapes content and disables missing phone actions', () => {
    const { context: c, run, element } = setup();
    run("appState.events = [{id:'evt_1783414026134', clientName:'<Test Customer>', stageIndex:3, status:'event-completed', serviceType:'Decoration', eventDate:'2026-08-27', clientPhone:''}];");
    c.renderWhatsAppCenter();
    const html = element('whatsapp-center-list').innerHTML;
    assert.ok(html.includes('&lt;Test Customer&gt;'));
    assert.ok(html.includes('Event Execution'));
    assert.ok(html.includes('Phone number required'));
    assert.equal((html.match(/ disabled/g) || []).length, 7);
    assert.ok(html.includes('Quote Image'));
    assert.ok(html.includes('Bill Image'));
    assert.ok(html.includes('Booking Welcome'));
    assert.ok(html.includes('Event Thank You'));
    assert.ok(html.includes('Payment Thank You'));
    assert.ok(html.includes('Feedback / Review'));
    element('whatsapp-center-search').value = 'not a customer';
    c.renderWhatsAppCenter();
    assert.ok(element('whatsapp-center-list').innerHTML.includes('No matching customers found.'));
});

test('WhatsApp Center prepares the selected quotation and bill as JPEG images', async () => {
    const { context: c, run } = setup();
    c.imageEvent = financeEvent('1783414026134', 2, 1000, [], { clientName: 'Image Customer' });
    run("appState.events=[imageEvent]; imageCalls=[]; closeModal=id=>imageCalls.push(['close',id]); switchTab=id=>imageCalls.push(['tab',id]); shareElementAsJPEG=async (...args)=>imageCalls.push(['share',...args]);");
    const id = run('appState.events[0].id');

    assert.equal(await c.shareCustomerDocumentImage(id, 'quotation'), true);
    assert.equal(run('currentQuotationEventId'), id);
    assert.deepEqual(JSON.parse(JSON.stringify(run('imageCalls'))), [
        ['close', 'whatsapp-center-modal'],
        ['tab', 'quotation'],
        ['share', 'quotation-print-area', 'Quotation-41402.jpg', 'DD Events Quotation']
    ]);

    run('imageCalls=[];');
    assert.equal(await c.shareCustomerDocumentImage(id, 'invoice'), true);
    assert.equal(run('currentInvoiceEventId'), id);
    assert.deepEqual(JSON.parse(JSON.stringify(run('imageCalls'))), [
        ['close', 'whatsapp-center-modal'],
        ['tab', 'billing'],
        ['share', 'invoice-print-area', 'INV-41402.jpg', 'DD Events Bill']
    ]);
});

test('bill image is blocked before Advance Pay while quotation image remains available', async () => {
    const { context: c, run } = setup();
    run("appState.events=[{id:'evt_1783414026134',clientName:'Test',stageIndex:1,status:'quotation'}]; showToast=()=>{}; shareElementAsJPEG=async()=>{throw new Error('Must not share');};");
    assert.equal(await c.shareCustomerDocumentImage('evt_1783414026134', 'invoice'), false);
});

test('stage messages include the customer and open only at the correct workflow stage', () => {
    const { context: c, run } = setup();
    c.messageEvents = [
        financeEvent('welcome', 2, 1000, [{ method: 'Advance', amount: 200 }], { clientName: 'Welcome Customer', clientPhone: '6374503310', eventDate: '2026-09-10', venue: 'Welcome Hall' }),
        financeEvent('event', 4, 1000, [{ method: 'Advance', amount: 200 }], { clientName: 'Event Customer', clientPhone: '6374503310', eventDate: '2026-09-11' }),
        financeEvent('paid', 5, 1000, [{ method: 'Cash', amount: 1000 }], { clientName: 'Paid Customer', clientPhone: '6374503310' })
    ];
    run("appState.events=messageEvents; window.open=url=>{window.lastOpen=url;}; toastMessages=[]; showToast=message=>toastMessages.push(message);");

    assert.equal(c.openCustomerWhatsApp(run('appState.events[0].id'), 'booking-welcome'), true);
    let text = new URL(c.window.lastOpen).searchParams.get('text');
    assert.ok(text.startsWith('*WELCOME TO DD EVENTS*'));
    assert.ok(text.includes('Welcome Customer'));
    assert.ok(text.includes('10 Sep 2026'));
    assert.ok(text.includes('Welcome Hall'));

    assert.equal(c.openCustomerWhatsApp(run('appState.events[1].id'), 'event-thanks'), true);
    text = new URL(c.window.lastOpen).searchParams.get('text');
    assert.ok(text.startsWith('*THANK YOU FROM DD EVENTS*'));
    assert.ok(text.includes('Event Customer'));

    assert.equal(c.openCustomerWhatsApp(run('appState.events[2].id'), 'payment-thanks'), true);
    text = new URL(c.window.lastOpen).searchParams.get('text');
    assert.ok(text.startsWith('*PAYMENT RECEIVED - DD EVENTS*'));
    assert.ok(text.includes('Paid Customer'));
    assert.ok(text.includes('*Amount Received:* ₹1,000'));
    assert.ok(text.includes('*Pending Balance:* ₹0'));
});

test('feedback request opens after Event Execution with the configured Google Review link', () => {
    const { context: c, run } = setup();
    c.reviewEvents = [
        financeEvent('review-ready', 4, 1000, [], { clientName: 'Review Customer', clientPhone: '6374503310', serviceType: 'Decoration' }),
        financeEvent('review-early', 3, 1000, [], { clientName: 'Early Customer', clientPhone: '6374503310' })
    ];
    run(`
        appState.events = reviewEvents;
        appState.googleReviewUrl = 'https://g.page/r/Ca560DRIuFyIEAE/review';
        window.open = url => { window.lastOpen = url; };
        toastMessages = [];
        showToast = message => toastMessages.push(message);
    `);

    assert.equal(c.openCustomerWhatsApp(run('appState.events[0].id'), 'feedback-review'), true);
    const text = new URL(c.window.lastOpen).searchParams.get('text');
    assert.ok(text.startsWith('*YOUR FEEDBACK MATTERS - DD EVENTS*'));
    assert.ok(text.includes('Review Customer'));
    assert.ok(text.includes('https://g.page/r/Ca560DRIuFyIEAE/review'));
    assert.equal(c.openCustomerWhatsApp(run('appState.events[1].id'), 'feedback-review'), false);
    assert.ok(run('toastMessages[0]').includes('after Event Execution'));
});

test('thank-you messages cannot make premature or incorrect completion claims', () => {
    const { context: c, run } = setup();
    c.unsafeMessages = [
        financeEvent('before-event', 3, 1000, [{ method: 'Advance', amount: 200 }], { clientPhone: '6374503310' }),
        financeEvent('pending-payment', 5, 1000, [{ method: 'Cash', amount: 500 }], { clientPhone: '6374503310' })
    ];
    run("appState.events=unsafeMessages; window.open=()=>{throw new Error('Must not open');}; toastMessages=[]; showToast=message=>toastMessages.push(message);");
    assert.equal(c.openCustomerWhatsApp(run('appState.events[0].id'), 'event-thanks'), false);
    assert.equal(c.openCustomerWhatsApp(run('appState.events[1].id'), 'payment-thanks'), false);
    assert.ok(run('toastMessages[0]').includes('Pending Bill'));
    assert.ok(run('toastMessages[1]').includes('₹500 is still pending'));
});

test('WhatsApp Center CSS keeps customer details full-width above action groups', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
    assert.match(css, /\.whatsapp-customer-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
    assert.match(css, /\.search-bar\.whatsapp-center-search\s*\{[^}]*width:\s*100%[^}]*max-width:\s*none/s);
    assert.ok(css.includes('.whatsapp-action-group'));
});
