// Rebuilds an events list for the dashboard from whatever survived the
// 2026-08-27 wipe of dashboard_data. Reads only; writes a JSON file you can
// review and then load through Settings > Import Backup.
//
//   node tools/rebuild-events.js
//
// Without an admin login this sees only the shared row (staff assignments and
// applications). recover-events.html does the same job in the browser and can
// additionally read finance entries and uploaded documents once you are
// logged in as an admin.

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://razwvjgajaparzjksoll.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhend2amdhamFwYXJ6amtzb2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMDM0NDMsImV4cCI6MjA5ODg3OTQ0M30.cWqUkKcf6WHs0srbvIqx58kMqSiBXU9NdZy8SBus1OQ';

function dateOnly(value) {
    return value ? String(value).slice(0, 10) : '';
}

async function readSharedRow() {
    const url = `${SUPABASE_URL}/rest/v1/dashboard_data?id=eq.1&select=data,updated_at`;
    const response = await fetch(url, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!response.ok) throw new Error(`dashboard_data read failed: ${response.status}`);
    const rows = await response.json();
    if (!rows.length) throw new Error('dashboard_data row id=1 not found.');
    return rows[0];
}

function rebuild(state) {
    const byEvent = new Map();
    const slot = (eventId) => {
        if (!eventId) return null;
        if (!byEvent.has(eventId)) {
            byEvent.set(eventId, { eventId, staff: new Map(), firstSeen: '' });
        }
        return byEvent.get(eventId);
    };
    const noteFirstSeen = (entry, when) => {
        if (when && (!entry.firstSeen || when < entry.firstSeen)) entry.firstSeen = when;
    };

    for (const row of state.eventStaffAssignments || []) {
        const entry = slot(String(row.eventId || ''));
        if (!entry) continue;
        entry.staff.set(row.staffName || 'Unknown', row.workType || '');
        noteFirstSeen(entry, row.createdAt);
    }
    for (const row of state.staffApplications || []) {
        const entry = slot(String(row.eventId || ''));
        if (!entry) continue;
        if (!entry.staff.has(row.staffName)) entry.staff.set(row.staffName || 'Unknown', row.department || '');
        noteFirstSeen(entry, row.appliedAt);
    }

    const events = [...byEvent.values()].map(entry => {
        // Event ids are `evt_<epoch ms>`, so the id itself dates the record
        // more precisely than the first staff action attached to it.
        const idStamp = Number(String(entry.eventId).replace(/^evt_/, ''));
        const idDate = Number.isFinite(idStamp) && idStamp > 0
            ? dateOnly(new Date(idStamp).toISOString())
            : '';
        const staffLines = [...entry.staff.entries()]
            .map(([name, work]) => (work ? `${name} (${work})` : name));
        return {
            id: entry.eventId,
            clientName: `RECOVERED ${entry.eventId}`,
            clientPhone: '', clientEmail: '', leadSource: '', referredBy: '',
            address: '', venue: '', eventDate: '',
            serviceType: '',
            budget: 0,
            notes: [
                'RECOVERED RECORD - customer name, phone, venue, date and budget were lost and must be filled in by hand.',
                staffLines.length ? `Staff assigned: ${staffLines.join(', ')}` : ''
            ].filter(Boolean).join('\n'),
            status: 'enquiry', stageIndex: 0, delivered: false, heldCompleted: false,
            items: [], discount: 0, payments: [],
            createdDate: idDate || dateOnly(entry.firstSeen) || dateOnly(new Date().toISOString()),
            documents: [], documentNotes: '', documentServiceNotes: {},
            recoveredAt: new Date().toISOString()
        };
    });
    events.sort((a, b) => String(a.createdDate).localeCompare(String(b.createdDate)));
    return events;
}

// The staff directory was wiped too, but every assignment and application
// carries the person's name, phone and the work they were booked for. The
// phone number is the reliable identity here - the same person shows up under
// several spellings ("Dharun", "DHARUN", "Dharun prabhu"), so names are
// collected per phone and the most recent one wins.
function rebuildStaff(state) {
    const byPerson = new Map();
    const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

    const records = [];
    for (const row of state.eventStaffAssignments || []) {
        records.push({ staffId: row.staffId, name: row.staffName, phone: row.phone, role: row.workType, when: row.createdAt });
    }
    for (const row of state.staffApplications || []) {
        records.push({ staffId: row.staffId, name: row.staffName, phone: row.phone, role: row.department, when: row.appliedAt });
    }
    records.sort((a, b) => String(a.when || '').localeCompare(String(b.when || '')));

    for (const record of records) {
        const phone = normalizePhone(record.phone);
        const key = phone || record.staffId || String(record.name || '').trim().toLowerCase();
        if (!key) continue;
        if (!byPerson.has(key)) {
            byPerson.set(key, { staffId: '', name: '', names: new Set(), phone: '', roles: new Set(), firstSeen: '' });
        }
        const person = byPerson.get(key);
        if (!person.staffId && record.staffId) person.staffId = record.staffId;
        if (!person.phone && phone) person.phone = phone;
        if (record.name) {
            person.names.add(record.name);
            person.name = record.name; // records are in date order, so the last one is the current name
        }
        if (record.role) person.roles.add(record.role);
        if (record.when && (!person.firstSeen || record.when < person.firstSeen)) person.firstSeen = record.when;
    }

    // Fold in entries that carried no phone or id by matching their name
    // against a name a phone-identified person has used.
    const identified = [...byPerson.entries()].filter(([, person]) => person.phone);
    for (const [key, person] of [...byPerson.entries()]) {
        if (person.phone) continue;
        const candidate = String(person.name || '').trim().toLowerCase();
        const match = identified.find(([, known]) =>
            [...known.names].some(name => name.trim().toLowerCase() === candidate));
        if (!match) continue;
        for (const role of person.roles) match[1].roles.add(role);
        byPerson.delete(key);
    }

    return [...byPerson.values()]
        .filter(person => person.name)
        .map(person => {
            const roles = [...person.roles].filter(Boolean);
            const primaryRole = roles.find(role => role !== 'General Event Work') || roles[0] || 'General Event Work';
            const otherNames = [...person.names].filter(name => name !== person.name);
            return {
                id: person.staffId || `stf_recovered_${person.phone || Math.random().toString(36).slice(2, 8)}`,
                name: person.name,
                role: primaryRole,
                department: primaryRole,
                phone: person.phone,
                address: '',
                workRoles: roles,
                workRolesUpdatedAt: '',
                selfCreated: false,
                createdAt: person.firstSeen || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                recoveredAt: new Date().toISOString(),
                recoveredAlsoKnownAs: otherNames
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

(async () => {
    const row = await readSharedRow();
    const state = row.data || {};
    const events = rebuild(state);
    const staff = (state.staff || []).length ? state.staff : rebuildStaff(state);
    const recovered = Object.assign({}, state, {
        events,
        staff,
        attendance: state.attendance || [],
        workLogs: state.workLogs || []
    });

    const outFile = path.join(__dirname, `dd_events_recovered_${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(outFile, JSON.stringify(recovered, null, 4), 'utf8');

    console.log(`Shared row last written: ${row.updated_at}`);
    console.log(`Events rebuilt: ${events.length}`);
    console.log(`Staff rebuilt: ${staff.length} -> ${staff.map(member => member.name).join(', ')}`);
    for (const event of events) {
        console.log(`  ${event.id}  first seen ${event.createdDate}  ${event.notes.split('\n')[1] || ''}`);
    }
    console.log(`\nWritten to: ${outFile}`);
})().catch(err => {
    console.error(err.message);
    process.exit(1);
});
