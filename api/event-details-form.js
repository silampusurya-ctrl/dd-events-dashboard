const SUPABASE_URL = 'https://razwvjgajaparzjksoll.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhend2amdhamFwYXJ6amtzb2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMDM0NDMsImV4cCI6MjA5ODg3OTQ0M30.cWqUkKcf6WHs0srbvIqx58kMqSiBXU9NdZy8SBus1OQ';
const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const supabaseHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
};

function cleanText(value, maxLength) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function validTime(value) {
    return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function findEventByToken(state, token) {
    return (state?.events || []).find(event => event?.eventDetailsForm?.accessToken === token) || null;
}

function publicRecord(event) {
    const form = event.eventDetailsForm || {};
    return {
        event: {
            customerName: event.clientName || '',
            eventDate: event.eventDate || '',
            serviceType: event.serviceType || '',
            venue: event.venue || ''
        },
        status: form.status === 'submitted' ? 'submitted' : 'pending',
        response: form.response || {},
        submittedAt: form.submittedAt || null
    };
}

async function readDashboard() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_data?select=data,updated_at&id=eq.1`, { headers: supabaseHeaders });
    if (!response.ok) throw new Error(`Dashboard read failed (${response.status})`);
    const rows = await response.json();
    return rows[0] || null;
}

async function updateDashboard(row, data) {
    const query = new URLSearchParams({ id: 'eq.1', updated_at: `eq.${row.updated_at}` });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_data?${query}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({ data, updated_at: new Date().toISOString() })
    });
    if (!response.ok) throw new Error(`Dashboard update failed (${response.status})`);
    const rows = await response.json();
    return rows.length > 0;
}

function validateResponse(submitted) {
    const session = cleanText(submitted?.session, 30);
    const eventStartTime = cleanText(submitted?.eventStartTime, 5);
    const mainProgramTime = cleanText(submitted?.mainProgramTime, 5);
    const setupAccessTime = cleanText(submitted?.setupAccessTime, 5);
    const contactName = cleanText(submitted?.contactName, 120);
    const contactPhone = cleanText(submitted?.contactPhone, 30);
    const venueAddress = cleanText(submitted?.venueAddress, 1000);
    const scheduleNotes = cleanText(submitted?.scheduleNotes, 3000);
    const specialInstructions = cleanText(submitted?.specialInstructions, 3000);

    if (!['Morning', 'Evening', 'Full Day', 'Other'].includes(session)) throw new Error('Please choose the event session.');
    if (!eventStartTime || !validTime(eventStartTime) || !validTime(mainProgramTime) || !validTime(setupAccessTime)) throw new Error('Please check the event timings.');
    if (!contactName || !/^[0-9+()\-\s]{7,30}$/.test(contactPhone)) throw new Error('Please enter a valid contact name and phone number.');
    if (!venueAddress) throw new Error('Please enter the event venue/address.');

    return { session, eventStartTime, mainProgramTime, setupAccessTime, contactName, contactPhone, venueAddress, scheduleNotes, specialInstructions };
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });

    const token = String(req.method === 'GET' ? req.query?.token || '' : req.body?.token || '');
    if (!tokenPattern.test(token)) return res.status(400).json({ error: 'This form link is invalid.' });

    try {
        if (req.method === 'GET') {
            const row = await readDashboard();
            const event = findEventByToken(row?.data, token);
            if (!event) return res.status(404).json({ error: 'This form link was not found or has expired.' });
            return res.status(200).json(publicRecord(event));
        }

        let customerResponse;
        try {
            customerResponse = validateResponse(req.body?.response);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        for (let attempt = 0; attempt < 4; attempt += 1) {
            const row = await readDashboard();
            const event = findEventByToken(row?.data, token);
            if (!event) return res.status(404).json({ error: 'This form link was not found or has expired.' });

            const now = new Date().toISOString();
            event.eventDetailsForm = {
                ...event.eventDetailsForm,
                status: 'submitted',
                response: customerResponse,
                submittedAt: now,
                updatedAt: now
            };

            if (await updateDashboard(row, row.data)) return res.status(200).json({ ok: true, ...publicRecord(event) });
        }

        return res.status(409).json({ error: 'The dashboard changed while saving. Please submit once more.' });
    } catch (error) {
        console.error('event-details-form failed', error);
        return res.status(500).json({ error: 'The form could not be saved. Please try again.' });
    }
};
