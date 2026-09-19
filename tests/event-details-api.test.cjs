const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/event-details-form.js');

function responseRecorder() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; }
    };
}

function dashboardRow() {
    return {
        updated_at: '2026-09-19T09:00:00.000Z',
        data: {
            adminEmails: ['private@example.com'],
            events: [{
                id: 'evt_1',
                clientName: 'Meena',
                clientPhone: '9876543210',
                eventDate: '2026-09-25',
                serviceType: 'Wedding',
                venue: 'Kalayarkovil',
                eventDetailsForm: {
                    accessToken: '89e124d4-71f4-4f1c-a648-6dc2515f963a',
                    status: 'pending',
                    response: {},
                    updatedAt: '2026-09-19T09:00:00.000Z'
                }
            }]
        }
    };
}

test('public form GET returns only whitelisted event fields', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => [dashboardRow()] });
    try {
        const res = responseRecorder();
        await handler({ method: 'GET', query: { token: '89e124d4-71f4-4f1c-a648-6dc2515f963a' } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.event.customerName, 'Meena');
        assert.equal(res.body.event.clientPhone, undefined);
        assert.equal(JSON.stringify(res.body).includes('private@example.com'), false);
        assert.equal(res.headers['Cache-Control'], 'no-store');
    } finally {
        global.fetch = originalFetch;
    }
});

test('public form POST validates and writes the response using an optimistic update', async () => {
    const originalFetch = global.fetch;
    let patchedBody = null;
    let calls = 0;
    global.fetch = async (_url, options = {}) => {
        calls += 1;
        if (options.method === 'PATCH') {
            patchedBody = JSON.parse(options.body);
            return { ok: true, json: async () => [{ id: 1 }] };
        }
        return { ok: true, json: async () => [dashboardRow()] };
    };
    try {
        const res = responseRecorder();
        await handler({
            method: 'POST',
            body: {
                token: '89e124d4-71f4-4f1c-a648-6dc2515f963a',
                response: {
                    session: 'Evening', eventStartTime: '18:30', guestArrivalTime: '18:00',
                    mainProgramTime: '19:30', setupAccessTime: '14:00', guestCount: 500,
                    contactName: 'Kumar', contactPhone: '9876543210', venueAddress: 'Main Hall',
                    mapsLink: 'https://maps.google.com/example', scheduleNotes: 'Reception', specialInstructions: 'Use side gate'
                }
            }
        }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(calls, 2);
        assert.equal(patchedBody.data.events[0].eventDetailsForm.status, 'submitted');
        assert.equal(patchedBody.data.events[0].eventDetailsForm.response.session, 'Evening');
        assert.equal(res.body.response.contactName, 'Kumar');
    } finally {
        global.fetch = originalFetch;
    }
});

test('public form rejects invalid tokens before reading the dashboard', async () => {
    const originalFetch = global.fetch;
    let called = false;
    global.fetch = async () => { called = true; };
    try {
        const res = responseRecorder();
        await handler({ method: 'GET', query: { token: 'not-a-token' } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(called, false);
    } finally {
        global.fetch = originalFetch;
    }
});

