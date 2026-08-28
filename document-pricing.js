// Shared optional pricing for event quotations, event invoices and sales bills.
// Legacy description-only subItems remain readable without rewriting old data.
function getSubItemDescription(item) {
    return typeof item === 'string' ? item : String(item?.desc || '');
}

function normalizePricedSubItem(item) {
    return typeof item === 'string' ? { desc: item, rate: null, qty: null } : { ...item };
}

function optionalDocumentNumber(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(String(value).replaceAll(',', '').trim());
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function readOptionalDocumentNumber(element) {
    const value = optionalDocumentNumber(element.textContent);
    element.textContent = value === null ? '' : String(value);
    return value;
}

function hasDocumentRate(item) {
    const rate = optionalDocumentNumber(item?.rate);
    // Old forms inserted 0 automatically. Show it only when explicitly entered.
    return rate !== null && (rate !== 0 || item.rateEntered === true);
}

function getDocumentLineAmount(item) {
    if (!item || typeof item === 'string' || !hasDocumentRate(item)) return null;
    const qty = optionalDocumentNumber(item.qty);
    return Math.round((Number(item.rate) * (qty === null ? 1 : qty) + Number.EPSILON) * 100) / 100;
}

function getDocumentItemTotal(item) {
    return (getDocumentLineAmount(item) ?? 0) + (item.subItems || []).reduce((sum, sub) => sum + (getDocumentLineAmount(sub) ?? 0), 0);
}

function formatDocumentLineAmount(item) {
    const amount = getDocumentLineAmount(item);
    return amount === null ? '' : `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function documentLineText(item, indent = '') {
    const description = getSubItemDescription(item);
    const amount = getDocumentLineAmount(item);
    return `\n${indent}- ${description}${amount === null ? '' : `: ${formatDocumentLineAmount(item)}`}`;
}

function documentItemsText(items) {
    return (items || []).map(item => documentLineText(item) + (item.subItems || []).map(sub => documentLineText(sub, '  ')).join('')).join('');
}

function hasPhotographyService(items) {
    const isPhotography = item => /\bphotograph(?:y|er|ers|ic)\b/i.test(getSubItemDescription(item));
    return (items || []).some(item => isPhotography(item) || (item.subItems || []).some(isPhotography));
}

function renderPricedDocumentRows(items, kind) {
    const renderLine = (line, index, subIndex = -1) => {
        const item = typeof line === 'string' ? normalizePricedSubItem(line) : line;
        const isSub = subIndex >= 0;
        const label = isSub ? 'Sub-service' : 'Item';
        const edit = field => `editPricedDocumentLine('${kind}', ${index}, ${subIndex}, '${field}', this)`;
        const number = field => {
            const value = optionalDocumentNumber(item[field]);
            return field === 'rate' && !hasDocumentRate(item) ? '' : (value === null ? '' : String(value));
        };
        return `<tr class="${isSub ? 'quotation-sub-item-row' : ''}">
            <td>${isSub ? '<span class="sub-item-bullet">–</span>' : ''}<span class="document-editable ${isSub ? 'sub-item-input' : ''}" contenteditable="true" role="textbox" aria-label="${label} description" onkeydown="handleInlineEditorKey(event)" onblur="${edit('desc')}">${escapeDocumentText(item.desc || '')}</span></td>
            <td class="text-right"><span class="document-editable numeric-editable" contenteditable="true" role="textbox" inputmode="decimal" aria-label="${label} rate" onkeydown="handleInlineEditorKey(event)" onblur="${edit('rate')}">${number('rate')}</span></td>
            <td class="text-right"><span class="document-editable numeric-editable" contenteditable="true" role="textbox" inputmode="decimal" aria-label="${label} quantity" onkeydown="handleInlineEditorKey(event)" onblur="${edit('qty')}">${number('qty')}</span></td>
            <td class="text-right font-bold" id="${kind}-line-total-${index}-${subIndex}">${formatDocumentLineAmount(item)}</td>
            <td class="actions-col no-print text-center"><button type="button" class="action-icon-btn danger" aria-label="Remove ${label.toLowerCase()}" onclick="changePricedDocumentRows('${kind}', 'remove', ${index}, ${subIndex})"><i class="fa-solid fa-xmark"></i></button></td>
        </tr>`;
    };
    return items.map((item, index) => renderLine(item, index) +
        (item.subItems || []).map((sub, subIndex) => renderLine(sub, index, subIndex)).join('') +
        `<tr class="no-print"><td colspan="5" class="add-sub-item-row"><button type="button" class="btn text-btn" onclick="changePricedDocumentRows('${kind}', 'add-sub', ${index})"><i class="fa-solid fa-plus"></i> Add Sub-service / Extra Charge</button></td></tr>`
    ).join('');
}

function getPricedEditorDocument(kind) {
    if (kind === 'sales') return salesBillDraft;
    const id = kind === 'quotation' ? currentQuotationEventId : currentInvoiceEventId;
    const event = appState.events.find(item => item.id === id);
    return event ? (kind === 'quotation' ? getQuotationDocument(event) : getInvoiceDocument(event)) : null;
}

function refreshPricedEditor(kind, rerender = false) {
    if (kind === 'sales') {
        salesBillDirty = true;
        if (rerender) renderSalesBillItems();
        updateSalesBillTotals();
        setSalesBillSaveStatus('Unsaved changes');
        return;
    }
    const event = appState.events.find(item => item.id === (kind === 'quotation' ? currentQuotationEventId : currentInvoiceEventId));
    if (!event) return;
    if (rerender) (kind === 'quotation' ? renderQuotationItems : renderInvoiceItems)(event);
    (kind === 'quotation' ? calculateQuotationTotals : calculateInvoiceTotals)();
    saveState();
}

function editPricedDocumentLine(kind, index, subIndex, field, element) {
    const doc = getPricedEditorDocument(kind);
    if (!doc?.items[index]) return;
    let item = doc.items[index];
    if (subIndex >= 0) {
        item.subItems[subIndex] = normalizePricedSubItem(item.subItems[subIndex]);
        item = item.subItems[subIndex];
    }
    item[field] = field === 'desc' ? element.textContent.trim() : readOptionalDocumentNumber(element);
    if (field === 'rate') item.rateEntered = item.rate !== null;
    document.getElementById(`${kind}-line-total-${index}-${subIndex}`).textContent = formatDocumentLineAmount(item);
    refreshPricedEditor(kind);
}

function changePricedDocumentRows(kind, action, index = -1, subIndex = -1) {
    const doc = getPricedEditorDocument(kind);
    if (!doc) return;
    if (action === 'add') doc.items.push({ desc: '', rate: null, qty: null });
    else if (action === 'add-sub') {
        const item = doc.items[index];
        if (!item.subItems) item.subItems = [];
        item.subItems.push({ desc: '', rate: null, qty: null });
    } else if (subIndex >= 0) doc.items[index].subItems.splice(subIndex, 1);
    else {
        if (doc.items.length <= 1) { showToast('Keep at least one item line.'); return; }
        doc.items.splice(index, 1);
    }
    refreshPricedEditor(kind, true);
}
