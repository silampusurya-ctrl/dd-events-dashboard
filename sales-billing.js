// Independent admin sales ledger: never creates an event or staff notification.
let salesBillDraft = null;
let salesBillDirty = false;
let salesBillRows = [];
let salesBillSaving = false;
let salesBillRevision = null;

function salesBillNumber(row = salesBillDraft) {
    return row?.bill_number ? `SALE-${String(row.bill_number).padStart(6, '0')}` : 'DRAFT';
}

function salesMoney(value) {
    return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function resetSalesBilling() {
    salesBillDraft = null;
    salesBillRows = [];
    salesBillDirty = false;
    salesBillRevision = null;
    const tab = document.getElementById('tab-sales-billing');
    if (tab) tab.innerHTML = '';
}

async function loadSalesBillingTab() {
    if (!currentAdminEmail) return;
    const tab = document.getElementById('tab-sales-billing');
    if (!document.getElementById('sales-bills-list')) {
        tab.innerHTML = `
            <div class="sales-intro no-print"><h2>Sales Billing</h2><p>Photo frames, invitations and other products — no event required.</p></div>
            <div class="billing-container">
                <aside class="billing-sidebar-card">
                    <div class="card-header"><h3>Sales Bills</h3><button type="button" class="btn primary-btn" onclick="createSalesBill()">+ New Bill</button></div>
                    <div class="invoice-search-box"><input id="sales-bill-search" aria-label="Search sales bills" placeholder="Search customer or bill..." oninput="renderSalesBillsList()"></div>
                    <p id="sales-list-status" class="sales-status" role="status"></p>
                    <div class="invoices-list" id="sales-bills-list"></div>
                </aside>
                <div class="billing-main-panel">
                    <div id="sales-bill-placeholder" class="no-selection-panel"><h3>Create a product bill</h3><p>Choose New Bill to enter your own items, prices and extra charges.</p></div>
                    <div id="sales-bill-editor" class="hidden"></div>
                </div>
            </div>`;
    }
    if (salesBillDraft) renderSalesBillEditor();
    await fetchSalesBills();
}

async function fetchSalesBills() {
    const status = document.getElementById('sales-list-status');
    if (status) status.textContent = 'Loading saved bills…';
    try {
        // Page through the ledger instead of silently omitting bills after 1,000.
        const rows = [];
        for (let from = 0; ; from += 500) {
            const result = await sb.from('sales_bills').select('id,bill_number,data,updated_at').order('bill_number', { ascending: false }).range(from, from + 499);
            if (result.error) throw result.error;
            rows.push(...(result.data || []));
            if (!result.data || result.data.length < 500) break;
        }
        if (!currentAdminEmail) return;
        salesBillRows = rows;
        if (status) status.textContent = `${rows.length} saved bill${rows.length === 1 ? '' : 's'}`;
        renderSalesBillsList();
    } catch (error) {
        console.error('Sales bills could not be loaded', error);
        if (status) status.textContent = 'Could not load saved bills. Check your connection and reopen Sales Billing.';
    }
}

function renderSalesBillsList() {
    const list = document.getElementById('sales-bills-list');
    if (!list) return;
    const query = (document.getElementById('sales-bill-search')?.value || '').toLowerCase();
    const rows = salesBillRows.filter(row => `${salesBillNumber(row)} ${row.data.customerName || ''} ${row.data.phone || ''}`.toLowerCase().includes(query));
    list.innerHTML = rows.length ? rows.map(row => `
        <button type="button" class="invoice-list-item sales-list-button ${salesBillDraft?.id === row.id ? 'selected' : ''}" data-bill-id="${escapeDocumentText(row.id)}" onclick="openSalesBill(this.dataset.billId)">
            <span class="invoice-item-header"><strong>${salesBillNumber(row)}</strong><span>${escapeDocumentText(row.data.date || '')}</span></span>
            <span class="invoice-item-body"><span>${escapeDocumentText(row.data.customerName || 'Customer')}</span><strong>${salesMoney(getDocumentCalculations(row.data).grandTotal)}</strong></span>
        </button>`).join('') : '<div class="empty-notifications">No matching sales bills.</div>';
}

function canReplaceSalesDraft() {
    if (salesBillSaving) { showToast('Please wait for the bill to finish saving.'); return false; }
    return !salesBillDirty || confirm('This bill has unsaved changes. Discard them and continue?');
}

function createSalesBill() {
    if (!currentAdminEmail || !canReplaceSalesDraft()) return;
    salesBillDraft = { id: crypto.randomUUID(), bill_number: null, date: getTodayDateString(), customerName: '', phone: '', address: '', notes: '', items: [{ desc: '', rate: null, qty: null }], discount: null, paid: null };
    salesBillRevision = null;
    salesBillDirty = true;
    renderSalesBillEditor();
    renderSalesBillsList();
}

function openSalesBill(id) {
    if (!canReplaceSalesDraft()) return;
    const row = salesBillRows.find(bill => bill.id === id);
    if (!row) return;
    salesBillDraft = { ...cloneDocumentData(row.data), id: row.id, bill_number: row.bill_number };
    salesBillRevision = row.updated_at;
    salesBillDirty = false;
    renderSalesBillEditor();
    renderSalesBillsList();
}

function renderSalesBillEditor() {
    if (!salesBillDraft) return;
    hideView('sales-bill-placeholder');
    showView('sales-bill-editor');
    const field = (key, label, type = 'text') => `<div class="form-group"><label for="sales-${key}">${label}</label><input type="${type}" id="sales-${key}" value="${escapeDocumentText(salesBillDraft[key] ?? '')}" oninput="updateSalesBillField('${key}', this.value)"></div>`;
    document.getElementById('sales-bill-editor').innerHTML = `
        <div class="invoice-actions-header no-print"><strong id="sales-bill-number">${salesBillNumber()}</strong><div class="action-buttons">
            <button type="button" class="btn secondary-btn" onclick="exportSalesBill('print')">Print / PDF</button>
            <button type="button" class="btn secondary-btn" onclick="exportSalesBill('jpeg')">Download JPEG</button>
            <button type="button" class="btn secondary-btn" onclick="exportSalesBill('share')">Share Image</button>
            <button type="button" class="btn primary-btn" id="sales-save-button" onclick="saveSalesBill()">Save Bill</button>
        </div></div>
        <p id="sales-save-status" class="sales-status no-print" role="status"></p>
        <div class="sales-customer-form no-print">
            <div class="form-row-two">${field('customerName', 'Customer name')}${field('date', 'Bill date', 'date')}</div>
            <div class="form-row-two">${field('phone', 'Phone (optional)', 'tel')}${field('address', 'Address (optional)')}</div>
            ${field('notes', 'Notes (optional)')}
            <p class="stage-desc">Type your own rate and quantity. A blank quantity counts as 1 for a priced line. Extra charges are added to the total; leave unpriced lines blank.</p>
        </div>
        <div class="invoice-paper a4-sheet" id="sales-print-area">
            <div class="invoice-header"><div class="invoice-logo"><h2>DD Events</h2><p>(Events & Management)</p><p>AL.AR. Street, Kalayarkovil</p><p>Call: 6374503310, 6384203310</p></div>
            <div class="invoice-title"><h1>SALES BILL</h1><p id="sales-print-number"></p><p id="sales-print-date"></p></div></div>
            <hr class="divider"><div class="billing-to sales-billed-to"><strong>Billed To:</strong><p id="sales-print-customerName"></p><p id="sales-print-phone"></p><p id="sales-print-address"></p></div>
            <table class="invoice-items-table sales-items-table"><thead><tr><th>Description</th><th class="text-right">Rate (₹)</th><th class="text-right">Qty</th><th class="text-right">Total (₹)</th><th class="actions-col no-print"></th></tr></thead><tbody id="sales-items-tbody"></tbody></table>
            <div class="invoice-items-action no-print"><button type="button" class="btn text-btn" onclick="changePricedDocumentRows('sales', 'add')">+ Add Item Line</button></div>
            <div class="invoice-summary-section"><div class="summary-notes"><strong>Payment Info</strong><p>GPay: 6374503310</p><p id="sales-print-notes" class="sales-note"></p></div><div class="summary-calculations">
                <div class="calc-row"><span>Subtotal:</span><span id="sales-subtotal"></span></div>
                <div class="calc-row no-print"><label for="sales-discount">Discount (₹):</label><input type="number" min="0" step="0.01" id="sales-discount" class="calc-input" value="${salesBillDraft.discount ?? ''}" oninput="updateSalesBillField('discount', this.value)"></div>
                <div class="calc-row" id="sales-discount-row"><span>Discount:</span><span id="sales-discount-display"></span></div>
                <div class="calc-row total-row"><span>Total Amount:</span><span id="sales-grand-total"></span></div>
                <div class="calc-row no-print"><label for="sales-paid">Amount Paid (₹):</label><input type="number" min="0" step="0.01" id="sales-paid" class="calc-input" value="${salesBillDraft.paid ?? ''}" oninput="updateSalesBillField('paid', this.value)"></div>
                <div class="calc-row" id="sales-paid-row"><span>Amount Paid:</span><span id="sales-paid-display"></span></div>
                <div class="calc-row balance-row" id="sales-balance-row"><span>Balance:</span><span id="sales-balance"></span></div>
            </div></div><div class="quote-signature-footer"><span>Thank you for your purchase!</span></div>
        </div>`;
    renderSalesBillItems();
    updateSalesBillPreview();
    updateSalesBillTotals();
    setSalesBillSaveStatus(salesBillDirty ? 'Unsaved changes' : 'Saved');
}

function setSalesBillSaveStatus(message) {
    const el = document.getElementById('sales-save-status');
    if (el) el.textContent = message;
}

function updateSalesBillField(field, value) {
    if (!salesBillDraft) return;
    salesBillDraft[field] = ['discount', 'paid'].includes(field) ? optionalDocumentNumber(value) : value;
    salesBillDirty = true;
    updateSalesBillPreview();
    updateSalesBillTotals();
    setSalesBillSaveStatus('Unsaved changes');
}

function updateSalesBillPreview() {
    ['customerName', 'phone', 'address', 'notes'].forEach(key => {
        const el = document.getElementById(`sales-print-${key}`);
        if (el) { el.textContent = salesBillDraft[key] || ''; el.hidden = !salesBillDraft[key]; }
    });
    document.getElementById('sales-print-date').textContent = salesBillDraft.date ? `Date: ${formatDisplayDate(salesBillDraft.date)}` : '';
    document.getElementById('sales-print-number').textContent = salesBillNumber();
}

function renderSalesBillItems() {
    document.getElementById('sales-items-tbody').innerHTML = renderPricedDocumentRows(salesBillDraft.items, 'sales');
}

function updateSalesBillTotals() {
    const totals = getDocumentCalculations(salesBillDraft);
    const priced = salesBillDraft.items.some(item => hasDocumentRate(item) || (item.subItems || []).some(hasDocumentRate));
    document.getElementById('sales-subtotal').textContent = priced ? salesMoney(totals.subtotal) : '';
    document.getElementById('sales-grand-total').textContent = priced ? salesMoney(totals.grandTotal) : '';
    for (const key of ['discount', 'paid']) {
        const value = optionalDocumentNumber(salesBillDraft[key]);
        document.getElementById(`sales-${key}-row`).hidden = value === null;
        document.getElementById(`sales-${key}-display`).textContent = value === null ? '' : salesMoney(value);
    }
    document.getElementById('sales-balance-row').hidden = !priced;
    document.getElementById('sales-balance').textContent = priced ? salesMoney(Math.max(0, totals.grandTotal - (salesBillDraft.paid || 0))) : '';
}

async function saveSalesBill() {
    if (!currentAdminEmail || !salesBillDraft || salesBillSaving) return false;
    if (document.activeElement?.isContentEditable) document.activeElement.blur();
    if (!salesBillDraft.customerName.trim() || !salesBillDraft.date || !salesBillDraft.items.some(item => item.desc.trim())) {
        showToast('Enter customer name, bill date and at least one item description.');
        return false;
    }
    salesBillSaving = true;
    const draft = cloneDocumentData(salesBillDraft);
    const { id, bill_number, ...data } = draft;
    const snapshot = JSON.stringify(salesBillDraft);
    const button = document.getElementById('sales-save-button');
    if (button) button.disabled = true;
    setSalesBillSaveStatus('Saving…');
    try {
        let query;
        if (salesBillRevision) {
            query = sb.from('sales_bills').update({ data, updated_at: new Date().toISOString() }).eq('id', id).eq('updated_at', salesBillRevision);
        } else query = sb.from('sales_bills').insert({ id, data });
        const result = await query.select('id,bill_number,data,updated_at').maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new Error('This bill was changed on another device. Reopen the saved bill before editing it again.');
        const row = result.data;
        const changedDuringSave = JSON.stringify(salesBillDraft) !== snapshot;
        salesBillDraft.bill_number = row.bill_number;
        salesBillRevision = row.updated_at;
        salesBillDirty = changedDuringSave;
        salesBillRows = [row, ...salesBillRows.filter(item => item.id !== row.id)].sort((a, b) => b.bill_number - a.bill_number);
        renderSalesBillsList();
        document.getElementById('sales-bill-number').textContent = salesBillNumber();
        updateSalesBillPreview();
        setSalesBillSaveStatus(changedDuringSave ? 'Earlier changes saved; save again for your latest edits.' : 'Saved successfully');
        showToast('Sales bill saved.');
        return !changedDuringSave;
    } catch (error) {
        console.error('Sales bill save failed', error);
        setSalesBillSaveStatus('Not saved. Your edits are still here; check your connection and try again.');
        showToast(error.message?.startsWith('This bill') ? error.message : 'Could not save the sales bill. Your edits have been kept.');
        return false;
    } finally {
        salesBillSaving = false;
        if (button) button.disabled = false;
    }
}

async function exportSalesBill(format) {
    if (!salesBillDraft) return;
    if (document.activeElement?.isContentEditable) document.activeElement.blur();
    // A customer copy must have a durable, unique bill number.
    if (salesBillDirty || !salesBillDraft.bill_number) {
        if (!await saveSalesBill()) return;
    }
    const filename = `${salesBillNumber()}.jpg`;
    if (format === 'print') window.print();
    else if (format === 'share') await shareElementAsJPEG('sales-print-area', filename, 'DD Events Sales Bill');
    else downloadElementAsJPEG('sales-print-area', filename);
}

window.addEventListener('beforeunload', event => {
    if (salesBillDirty) { event.preventDefault(); event.returnValue = ''; }
});
