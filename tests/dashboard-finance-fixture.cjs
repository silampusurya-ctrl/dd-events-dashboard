function financeEvent(id, stageIndex, amount, payments = [], extra = {}) {
    const statuses = ['enquiry', 'quotation', 'advance-paid', 'event-completed', 'pending-bill', 'completed-bill', 'delivered'];
    const document = () => ({ items: [{ desc: 'Decoration', rate: amount, qty: 1 }], bonusItems: [], discount: 0 });
    return {
        id: `evt_1783414026${id}`, clientName: `Finance Sample ${id}`, clientPhone: '',
        createdDate: '2026-08-27', eventDate: '2026-09-10', serviceType: 'Decoration',
        stageIndex, status: statuses[stageIndex], quotationData: document(), invoiceData: document(),
        payments, ...extra
    };
}

function currentFinanceEvents() {
    return [
        financeEvent(1, 2, 1000, [{ method: 'Booking Advance', amount: 200 }, { method: 'Cash', amount: 100 }]),
        financeEvent(2, 2, 500, [{ method: 'Advance', amount: 500 }], { eventDate: '2026-08-27' }),
        financeEvent(3, 3, 1200, [{ method: 'Advance', amount: 400 }]),
        financeEvent(4, 6, 300, [{ method: 'Cash', amount: 50 }]),
        financeEvent(5, 3, 9000, [{ method: 'Advance', amount: 9000 }]),
        financeEvent(6, 5, 8000, [{ method: 'Cash', amount: 8000 }]),
        financeEvent(7, 6, 7000, [{ method: 'Advance', amount: 7000 }]),
        financeEvent(8, 2, 600, [{ method: 'Advance', amount: 100 }], { eventDate: '2026-08-26' }),
        financeEvent(9, 1, 400, [{ method: 'Advance', amount: 100 }])
    ];
}

module.exports = { financeEvent, currentFinanceEvents };
