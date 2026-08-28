// Only served by tests/billing-server.cjs; never deployed.
const supabase = {
    createClient: () => ({
        auth: { getSession: async () => ({ data: { session: { user: { email: 'billing-test@example.invalid' } } } }), signOut: async () => ({}) },
        from(table) {
            const request = { table, filters: [], action: 'select' };
            const query = {
                select() { return query; },
                eq(key, value) { request.filters.push([key, value]); return query; },
                order() { return query; }, range() { return query; },
                insert(value) { request.action = 'insert'; request.value = value; return query; },
                update(value) { request.action = 'update'; request.value = value; return query; },
                async single() { request.single = true; return query.then(result => result); },
                async maybeSingle() { request.single = true; return query.then(result => result); },
                then(resolve, reject) { return fetch('/test-db', { method: 'POST', body: JSON.stringify(request) }).then(r => r.json()).then(resolve, reject); }
            };
            return query;
        }
    })
};
