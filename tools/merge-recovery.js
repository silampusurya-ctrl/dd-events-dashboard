// Turns the raw scan from recover-events.html into a backup file the dashboard
// can import. Run it against the downloaded "raw scan (evidence)" file:
//
//   node tools/merge-recovery.js "E:\\Downloads\\dd_events_raw_scan_2026-08-28.json"
//
// It combines every surviving source: staff assignments and applications from
// the shared row, admin finance entries, and the files still sitting in the
// event-documents bucket.

const fs = require('fs');
const path = require('path');

const SERVICE_OPTIONS = [
    'Wedding Photography', 'Outdoor Shoot', 'Baby Shower Event', 'Birthday Party Management',
    'Corporate Event Decoration', 'Catering Setup', 'Full Event Management', 'Decoration',
    'Entertainment', 'Photography', 'Makeup', 'Full Wedding Planning'
];
const BOOKED_STAGE_INDEX = 2; // 'advance-paid' - documents and expenses only exist from here on

const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

// Same hash the dashboard uses in createStableEventDocumentServiceId(), so an
// uploaded file's folder name can be turned back into the quotation line it
// belonged to.
function serviceKeyFor(description, index) {
    const signature = `${index}|${String(description || '').trim().toLowerCase()}`;
    let hash = 2166136261;
    for (let position = 0; position < signature.length; position += 1) {
        hash ^= signature.charCodeAt(position);
        hash = Math.imul(hash, 16777619);
    }
    return `service_${index}_${(hash >>> 0).toString(36)}`;
}

// Every plausible quotation line description, keyed by the folder name it
// would produce. The dashboard writes lines as "Decoration", "Decoration
// Service" or numbered as "2. Decoration", so all three shapes are covered.
function buildServiceKeyIndex(maxIndex = 6) {
    const candidates = new Set();
    for (const name of SERVICE_OPTIONS) {
        candidates.add(name);
        candidates.add(`${name} Service`);
        for (let n = 1; n <= 10; n += 1) {
            candidates.add(`${n}. ${name}`);
            candidates.add(`${n}. ${name} Service`);
        }
    }
    const lookup = new Map();
    for (const description of candidates) {
        for (let index = 0; index <= maxIndex; index += 1) {
            lookup.set(serviceKeyFor(description, index), { description, index });
        }
    }
    return lookup;
}

function rebuildStaff(state) {
    const byPerson = new Map();
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
        if (record.name) { person.names.add(record.name); person.name = record.name; }
        if (record.role) person.roles.add(record.role);
        if (record.when && (!person.firstSeen || record.when < person.firstSeen)) person.firstSeen = record.when;
    }

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
                recoveredAlsoKnownAs: [...person.names].filter(name => name !== person.name)
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

function buildEvents(scan) {
    const state = scan.row.data || {};
    const serviceKeyIndex = buildServiceKeyIndex();
    const byEvent = new Map();

    const slot = (eventId) => {
        if (!eventId) return null;
        if (!byEvent.has(eventId)) {
            byEvent.set(eventId, {
                eventId, staff: new Map(), documents: [], financeNotes: [],
                expense: 0, investment: 0, serviceNames: new Set(), lines: new Map()
            });
        }
        return byEvent.get(eventId);
    };

    for (const row of state.eventStaffAssignments || []) {
        const entry = slot(String(row.eventId || ''));
        if (entry) entry.staff.set(row.staffName || 'Unknown', row.workType || '');
    }
    for (const row of state.staffApplications || []) {
        const entry = slot(String(row.eventId || ''));
        if (entry && !entry.staff.has(row.staffName)) entry.staff.set(row.staffName || 'Unknown', row.department || '');
    }
    for (const row of scan.finance || []) {
        const entry = slot(String(row.event_id || ''));
        if (!entry) continue;
        if (row.service_name) entry.serviceNames.add(row.service_name);
        if (row.entry_type === 'investment') entry.investment += Number(row.amount) || 0;
        else entry.expense += Number(row.amount) || 0;
        if (row.notes) entry.financeNotes.push(`${row.category}: ${row.notes}`);
    }
    for (const doc of scan.documents || []) {
        const entry = slot(doc.eventId);
        if (!entry) continue;
        entry.documents.push(doc);
        // Recover the quotation line this file was filed under.
        const resolved = serviceKeyIndex.get(doc.serviceKey);
        if (resolved) {
            entry.lines.set(resolved.index, resolved.description);
            entry.serviceNames.add(resolved.description);
        }
    }

    const events = [];
    for (const entry of byEvent.values()) {
        const stamp = Number(String(entry.eventId).replace(/^evt_/, ''));
        const createdDate = Number.isFinite(stamp) && stamp > 0
            ? dateOnly(new Date(stamp).toISOString())
            : dateOnly(new Date().toISOString());

        // Rebuild the quotation lines at the positions the file folders proved,
        // so uploaded files reattach to the right service instead of orphaning.
        const highestIndex = entry.lines.size ? Math.max(...entry.lines.keys()) : -1;
        const items = [];
        for (let index = 0; index <= highestIndex; index += 1) {
            const description = entry.lines.get(index) || `Unknown service ${index + 1} (recovered)`;
            items.push({
                desc: description,
                rate: 0,
                qty: 1,
                subItems: [],
                documentServiceId: serviceKeyFor(description, index)
            });
        }

        const serviceNames = [...entry.serviceNames];
        const cleanService = (serviceNames[0] || '')
            .replace(/^\d+\.\s*/, '')
            .replace(/\s+Service$/i, '')
            .trim();
        const staffLines = [...entry.staff.entries()]
            .map(([name, work]) => (work ? `${name} (${work})` : name));
        const hasAdminEvidence = entry.documents.length > 0 || entry.expense > 0 || entry.investment > 0;

        events.push({
            id: entry.eventId,
            clientName: `RECOVERED ${createdDate}`,
            clientPhone: '', clientEmail: '', leadSource: '', referredBy: '',
            address: '', venue: '', eventDate: '',
            serviceType: cleanService,
            budget: 0,
            notes: [
                'RECOVERED RECORD - customer name, phone, venue, event date, budget and payment history were lost in the 2026-08-27 wipe and must be filled in by hand.',
                serviceNames.length ? `Services: ${serviceNames.join(', ')}` : '',
                entry.expense ? `Recorded expenses: Rs ${entry.expense.toFixed(2)}` : '',
                entry.investment ? `Recorded investment: Rs ${entry.investment.toFixed(2)}` : '',
                entry.financeNotes.length ? `Finance notes: ${entry.financeNotes.join(' | ')}` : '',
                staffLines.length ? `Staff assigned: ${staffLines.join(', ')}` : '',
                entry.documents.length ? `${entry.documents.length} uploaded file(s) restored - open the Documents tab.` : ''
            ].filter(Boolean).join('\n'),
            // Files and internal expenses only exist on a booked event, so this
            // much of the stage is evidence, not a guess.
            status: hasAdminEvidence ? 'advance-paid' : 'enquiry',
            stageIndex: hasAdminEvidence ? BOOKED_STAGE_INDEX : 0,
            delivered: false,
            heldCompleted: false,
            items,
            discount: 0,
            payments: [],
            createdDate,
            documents: entry.documents.map(doc => ({
                id: doc.id, name: doc.name, path: doc.path, type: doc.type, size: doc.size,
                serviceKey: doc.serviceKey,
                serviceName: (serviceKeyIndex.get(doc.serviceKey) || {}).description || doc.serviceKey,
                uploadedAt: doc.uploadedAt
            })),
            documentNotes: '',
            documentServiceNotes: {},
            recoveredAt: new Date().toISOString()
        });
    }

    events.sort((a, b) => String(a.createdDate).localeCompare(String(b.createdDate)));
    return events;
}

const scanFile = process.argv[2];
if (!scanFile) {
    console.error('Usage: node tools/merge-recovery.js <raw scan json>');
    process.exit(1);
}

const scan = JSON.parse(fs.readFileSync(scanFile, 'utf8'));
const state = scan.row.data || {};
const events = buildEvents(scan);
const staff = (state.staff || []).length ? state.staff : rebuildStaff(state);

const recovered = Object.assign({}, state, {
    events,
    staff,
    attendance: state.attendance || [],
    workLogs: state.workLogs || []
});

const outFile = path.join(__dirname, `dd_events_final_recovery_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(outFile, JSON.stringify(recovered, null, 4), 'utf8');

console.log(`Events: ${events.length}   Staff: ${staff.length}`);
console.log(`Files reattached: ${events.reduce((total, event) => total + event.documents.length, 0)}`);
console.log('');
for (const event of events) {
    const files = event.documents.length ? `  ${event.documents.length} file(s)` : '';
    const service = event.serviceType ? `  [${event.serviceType}]` : '';
    console.log(`  ${event.createdDate}  ${event.id}  ${event.status}${service}${files}`);
}
console.log(`\nWritten to: ${outFile}`);
