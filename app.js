// DD Events Dashboard - Core Logic

// State Data structures
let appState = {
    events: [],
    staff: [],
    attendance: [],
    workLogs: [],
    staffApplications: [],
    webhooks: {
        url: '',
        triggers: {
            inquiry: true,
            payment: true,
            attendance: true
        }
    }
};

// Preset Services Catalog
const servicePresets = [
    { name: "Planning & Consultation", rate: 5000 },
    { name: "Venue Booking", rate: 10000 },
    { name: "Decoration", rate: 35000 },
    { name: "Catering", rate: 50000 },
    { name: "Photography & Videography", rate: 30000 },
    { name: "Makeup & Styling", rate: 12000 },
    { name: "Entertainment", rate: 20000 },
    { name: "Sound, Light & LED", rate: 18000 },
    { name: "Guest Management", rate: 10000 },
    { name: "Transportation", rate: 12000 },
    { name: "Accommodation", rate: 20000 },
    { name: "Seer & Return Gifts", rate: 8000 },
    { name: "Rentals", rate: 10000 },
    { name: "Traditional Services", rate: 12000 },
    { name: "Special Effects", rate: 7000 },
    { name: "Wedding Essentials", rate: 15000 },
    { name: "Digital Services", rate: 5000 },
    { name: "Post-Wedding Deliverables", rate: 8000 },
    { name: "Event Coordination", rate: 10000 },
    { name: "Luxury & Destination Wedding Services", rate: 150000 }
];

let currentQuotationEventId = null;
let currentInvoiceEventId = null;

// Manual pipeline stage sequence. An event moves from one stage to the next
// only when the "Approve -> Next Stage" tick button is clicked - nothing
// moves automatically based on payments/dates any more.
const STAGE_DEFS = [
    { key: 'enquiry', label: 'Enquiry' },
    { key: 'quotation', label: 'Quotation' },
    { key: 'advance-paid', label: 'Advance Pay / Date Booked' },
    { key: 'event-completed', label: 'Event Completed' },
    { key: 'pending-bill', label: 'Pending Bill' },
    { key: 'completed-bill', label: 'Completed Bill' },
    { key: 'delivered', label: 'Delivered' }
];

function getStageIndex(key) {
    const idx = STAGE_DEFS.findIndex(s => s.key === key);
    return idx === -1 ? 0 : idx;
}

function getStageLabel(key) {
    const stage = STAGE_DEFS.find(s => s.key === key);
    return stage ? stage.label : key;
}

// Keeps evt.status/evt.delivered in sync with evt.stageIndex, and migrates
// events saved under the old automatic 5-status model to the new 7-stage one.
function syncEventStage(evt) {
    if (typeof evt.stageIndex !== 'number') {
        const legacyMap = { Inquiry: 0, Quotation: 2, Billing: 4, Paid: 5, Delivered: 6 };
        evt.stageIndex = legacyMap.hasOwnProperty(evt.status) ? legacyMap[evt.status] : 0;
    }
    evt.stageIndex = Math.max(0, Math.min(evt.stageIndex, STAGE_DEFS.length - 1));
    evt.status = STAGE_DEFS[evt.stageIndex].key;
    evt.delivered = evt.stageIndex === STAGE_DEFS.length - 1;
}

// Manually advances an event to the next pipeline stage. This is the only
// way an event's stage changes - triggered by the "Approve" tick button.
function advanceEventStage(eventId) {
    const evt = appState.events.find(e => e.id === eventId);
    if (!evt) return;

    if (evt.stageIndex >= STAGE_DEFS.length - 1) {
        showToast('This event is already at the final stage.');
        return;
    }

    evt.stageIndex++;
    syncEventStage(evt);
    saveState();
    showToast(`Moved to "${getStageLabel(evt.status)}" stage.`);
    refreshAllViews();

    // Alert staff the moment a date gets locked in, so they can apply to work it.
    if (evt.status === 'advance-paid') {
        notifyStaffOfBookedEvent(evt);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();

    // Set up form submission handlers
    document.getElementById('login-password-form').addEventListener('submit', handleLoginPassword);
    document.getElementById('staff-login-form').addEventListener('submit', handleStaffLogin);
    document.getElementById('create-account-form').addEventListener('submit', handleCreateAdminAccount);

    registerServiceWorker();
    setupInstallPrompt();
});

// ==========================================
// 0. PWA - INSTALLABLE APP (service worker + "Add to Home Screen" prompt)
// ==========================================

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // Auto-reload once when a newer service worker takes control, so an
    // installed/home-screen app picks up updates on its own instead of
    // needing the user to manually uninstall and reinstall it.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasReloaded) return;
        hasReloaded = true;
        window.location.reload();
    });

    navigator.serviceWorker.register('sw.js').then((registration) => {
        // Force an immediate check for a newer sw.js instead of waiting for
        // the browser's own update schedule - important for installed PWAs
        // that get relaunched from a cached home-screen icon.
        registration.update();
    }).catch((err) => {
        console.error('Service worker registration failed', err);
    });
}

let deferredInstallPrompt = null;

function setupInstallPrompt() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;

        if (sessionStorage.getItem('dd_install_banner_dismissed') === 'true') return;
        showView('install-app-banner');
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        hideView('install-app-banner');
        showToast('DD Events installed! Find it on your home screen.');
    });
}

function dismissInstallBanner() {
    hideView('install-app-banner');
    sessionStorage.setItem('dd_install_banner_dismissed', 'true');
}

async function triggerAppInstall() {
    hideView('install-app-banner');
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
}

// ==========================================
// 1. AUTHENTICATION MODULE (Supabase Auth - real accounts, work on any device)
// ==========================================

const SUPABASE_URL = 'https://razwvjgajaparzjksoll.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhend2amdhamFwYXJ6amtzb2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMDM0NDMsImV4cCI6MjA5ODg3OTQ0M30.cWqUkKcf6WHs0srbvIqx58kMqSiBXU9NdZy8SBus1OQ';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Set once a real Supabase session is confirmed - used for display and for
// "you can't remove your own account" checks. Supabase itself persists the
// actual session token, so this app no longer needs its own auth flags.
let currentAdminEmail = null;

async function initAuth() {
    const isStaffAuthenticated = sessionStorage.getItem('dd_staff_authenticated') === 'true';

    if (isStaffAuthenticated) {
        hideView('auth-container');
        hideView('app-container');
        showView('staff-app-container');
        await startStaffPortal();
        return;
    }

    showView('auth-container');
    hideView('app-container');
    hideView('staff-app-container');
    hideView('password-login-view');
    showView('auth-loading-view');

    const { data: { session } } = await sb.auth.getSession();

    if (session && session.user) {
        await loadState();
        const email = session.user.email.toLowerCase();

        if ((appState.disabledAdminEmails || []).includes(email)) {
            await sb.auth.signOut();
            showToast('This account has been disabled by your admin.');
            hideView('auth-loading-view');
            initAuth();
            return;
        }

        currentAdminEmail = email;
        hideView('auth-loading-view');
        hideView('auth-container');
        hideView('staff-app-container');
        showView('app-container');
        await startApplication();
    } else {
        hideView('auth-loading-view');
        showView('password-login-view');
        setAuthMode('admin');
    }
}

// Toggles the login screen between the office/admin login form and the
// staff portal login form. Both share the same physical screen so staff
// never need to know (or see) the admin password.
function setAuthMode(mode) {
    const isAdmin = mode === 'admin';
    document.getElementById('mode-admin-btn').classList.toggle('active', isAdmin);
    document.getElementById('mode-staff-btn').classList.toggle('active', !isAdmin);
    document.getElementById('staff-login-fields').classList.toggle('hidden', isAdmin);
    document.getElementById('create-account-fields').classList.add('hidden');
    document.getElementById('admin-login-fields').classList.toggle('hidden', !isAdmin);

    if (isAdmin) {
        document.getElementById('login-email').focus();
    } else {
        document.getElementById('staff-login-password').focus();
    }
}

// Toggles between the login form and the "create new account" form on the
// admin side of the login screen - lets any office teammate self-register
// their own email + password without needing an already-logged-in admin.
function showCreateAccountView() {
    document.getElementById('admin-login-fields').classList.add('hidden');
    document.getElementById('create-account-fields').classList.remove('hidden');
    hideView('create-account-error-msg');
    document.getElementById('create-account-email').focus();
}

function showAdminLoginView() {
    document.getElementById('create-account-fields').classList.add('hidden');
    document.getElementById('admin-login-fields').classList.remove('hidden');
    document.getElementById('login-email').focus();
}

// Supabase Auth has no client-safe way to list every registered user, so we
// keep our own roster of known admin emails inside the shared data blob -
// just for showing/managing the list in Settings.
async function registerAdminEmailInRoster(email) {
    await loadState();
    if (!appState.adminEmails) appState.adminEmails = [];
    if (!appState.adminEmails.includes(email)) {
        appState.adminEmails.push(email);
        await saveState();
    }
}

async function handleCreateAdminAccount(e) {
    e.preventDefault();
    const email = document.getElementById('create-account-email').value.trim().toLowerCase();
    const pass = document.getElementById('create-account-password').value;
    const confirmPass = document.getElementById('create-account-password-confirm').value;

    if (pass.length < 4) {
        showToast('Password must be at least 4 characters long.');
        return;
    }

    if (pass !== confirmPass) {
        showToast('Passwords do not match.');
        return;
    }

    hideView('create-account-error-msg');
    const { data, error } = await sb.auth.signUp({ email, password: pass });

    if (error) {
        showToast(error.message);
        return;
    }
    // Supabase quirk: signing up with an email that already has an account
    // returns a user object with no identities, instead of a clear error.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
        showView('create-account-error-msg');
        return;
    }

    await registerAdminEmailInRoster(email);
    showToast(`Account created for ${email}!`);
    document.getElementById('create-account-form').reset();
    initAuth();
}

async function handleStaffLogin(e) {
    e.preventDefault();
    const passwordInput = document.getElementById('staff-login-password');

    const { data, error: fetchError } = await sb.from('dashboard_data').select('staff_password_hash').eq('id', 1).single();

    if (fetchError || !data || !data.staff_password_hash) {
        showToast('Staff access has not been set up yet. Please contact your admin.');
        return;
    }

    const enteredHash = await sha256(passwordInput.value);

    if (enteredHash === data.staff_password_hash) {
        sessionStorage.setItem('dd_staff_authenticated', 'true');
        hideView('staff-login-error-msg');
        passwordInput.value = '';
        initAuth();
    } else {
        showView('staff-login-error-msg');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

async function setStaffPassword() {
    const pass = document.getElementById('staff-pass-input').value;
    const confirmPass = document.getElementById('staff-pass-confirm-input').value;

    if (pass.length < 4) {
        showToast('Staff password must be at least 4 characters long.');
        return;
    }

    if (pass !== confirmPass) {
        showToast('Passwords do not match.');
        return;
    }

    const hash = await sha256(pass);
    const { error } = await sb.from('dashboard_data').update({ staff_password_hash: hash }).eq('id', 1);

    if (error) {
        showToast('Failed to save staff password.');
        return;
    }

    showToast('Staff portal password saved!');
    document.getElementById('staff-password-form').reset();
    loadStaffPasswordStatus();
}

async function loadStaffPasswordStatus() {
    const statusEl = document.getElementById('staff-password-status');
    const labelEl = document.getElementById('staff-pass-input-label');
    const submitBtn = document.getElementById('staff-pass-submit-btn');
    if (!statusEl) return;

    const { data } = await sb.from('dashboard_data').select('staff_password_hash').eq('id', 1).single();
    const hasStaffPassword = !!(data && data.staff_password_hash);

    statusEl.textContent = hasStaffPassword
        ? 'Staff portal password is set. Share it only with your staff.'
        : 'No staff password set yet - staff cannot log in until you create one below.';

    if (labelEl) {
        labelEl.textContent = hasStaffPassword ? 'New Staff Access Password' : 'Staff Access Password';
    }
    if (submitBtn) {
        submitBtn.innerHTML = hasStaffPassword
            ? '<i class="fa-solid fa-shield-halved"></i> Change Staff Password'
            : '<i class="fa-solid fa-shield-halved"></i> Create Staff Password';
    }
}

function staffLogout() {
    sessionStorage.removeItem('dd_staff_authenticated');
    sessionStorage.removeItem('dd_staff_selected_name');
    initAuth();
}

// SHA-256 Hashing helper using Web Crypto API - still used for the shared
// staff portal password, which isn't a real per-person Supabase account.
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleLoginPassword(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const enteredPass = document.getElementById('login-password').value;

    const { error } = await sb.auth.signInWithPassword({ email, password: enteredPass });

    if (!error) {
        hideView('login-error-msg');
        document.getElementById('login-password').value = '';
        initAuth();
    } else {
        showView('login-error-msg');
        document.getElementById('login-password').value = '';
        document.getElementById('login-password').focus();
    }
}

async function changeMyPassword() {
    const oldPass = document.getElementById('old-pass').value;
    const changePass = document.getElementById('change-pass').value;

    // Re-verify the current password first - Supabase's updateUser() doesn't
    // require it, but we don't want anyone at an unlocked computer to change
    // the password without knowing the existing one.
    const { error: verifyError } = await sb.auth.signInWithPassword({ email: currentAdminEmail, password: oldPass });
    if (verifyError) {
        showToast('Current password incorrect.');
        return;
    }

    if (changePass.length < 4) {
        showToast('New password must be at least 4 characters long.');
        return;
    }

    const { error } = await sb.auth.updateUser({ password: changePass });
    if (error) {
        showToast(error.message);
        return;
    }

    showToast('Password updated successfully!');
    document.getElementById('change-password-form').reset();
}

// Adds another office login (email + password) from Settings -> Admin
// Accounts. Supabase's client SDK signs the current browser INTO the newly
// created account (there's no safe client-side way around that without
// exposing the service_role key) - so we sign back out right after and ask
// the admin to log back into their own account.
async function addAdminAccount() {
    const email = document.getElementById('new-admin-email').value.trim().toLowerCase();
    const pass = document.getElementById('new-admin-password').value;
    const confirmPass = document.getElementById('new-admin-password-confirm').value;

    if (pass.length < 4) {
        showToast('Password must be at least 4 characters long.');
        return;
    }

    if (pass !== confirmPass) {
        showToast('Passwords do not match.');
        return;
    }

    const { data, error } = await sb.auth.signUp({ email, password: pass });

    if (error) {
        showToast(error.message);
        return;
    }
    if (data.user && data.user.identities && data.user.identities.length === 0) {
        showToast('An account with this email already exists.');
        return;
    }

    await registerAdminEmailInRoster(email);
    await sb.auth.signOut();
    showToast(`Account created for ${email}! Please log back in with your own account.`);
    initAuth();
}

async function deleteAdminAccount(email) {
    await loadState();
    const roster = appState.adminEmails || [];

    if (roster.length <= 1) {
        showToast('You need at least one admin account.');
        return;
    }

    if (email === currentAdminEmail) {
        showToast("You can't remove the account you're currently logged in with.");
        return;
    }

    if (!confirm(`Remove admin account "${email}"?`)) return;

    if (!appState.disabledAdminEmails) appState.disabledAdminEmails = [];
    if (!appState.disabledAdminEmails.includes(email)) {
        appState.disabledAdminEmails.push(email);
    }
    appState.adminEmails = roster.filter(e => e !== email);
    await saveState();

    showToast('Admin account removed.');
    renderAdminAccountsList();
}

function renderAdminAccountsList() {
    const container = document.getElementById('admin-accounts-list');
    if (!container) return;

    const roster = appState.adminEmails || [];

    container.innerHTML = roster.map(email => `
        <div class="admin-account-row">
            <span class="admin-account-email">
                <i class="fa-solid fa-user-tie"></i> ${email}
                ${email === currentAdminEmail ? '<span class="admin-account-you-tag">You</span>' : ''}
            </span>
            ${roster.length > 1 && email !== currentAdminEmail
                ? `<button class="action-icon-btn danger" title="Remove account" onclick="deleteAdminAccount('${email}')"><i class="fa-solid fa-trash"></i></button>`
                : ''}
        </div>
    `).join('');

    document.getElementById('current-admin-name').textContent = currentAdminEmail || 'Administrator';
}

function logout() {
    sb.auth.signOut();
    currentAdminEmail = null;
    appState = { events: [], staff: [], attendance: [], workLogs: [], staffApplications: [], webhooks: {} };
    initAuth();
}

// ==========================================
// 2. STATE & STORAGE MANAGEMENT (Supabase - one shared row, works from any device)
// ==========================================

async function loadState() {
    const { data, error } = await sb.from('dashboard_data').select('data').eq('id', 1).single();

    if (error || !data) {
        console.error('Failed to load shared data', error);
        initDefaultState();
        return;
    }

    appState = data.data || {};
    if (!appState.webhooks) appState.webhooks = { url: '', triggers: { inquiry: true, payment: true, attendance: true } };
    if (!appState.events) appState.events = [];
    if (!appState.staff) appState.staff = [];
    if (!appState.attendance) appState.attendance = [];
    if (!appState.workLogs) appState.workLogs = [];
    if (!appState.staffApplications) appState.staffApplications = [];
    if (!appState.adminEmails) appState.adminEmails = [];
    if (!appState.disabledAdminEmails) appState.disabledAdminEmails = [];
}

function initDefaultState() {
    appState = {
        events: [],
        staff: [],
        attendance: [],
        workLogs: [],
        staffApplications: [],
        adminEmails: [],
        disabledAdminEmails: [],
        webhooks: {
            url: '',
            triggers: { inquiry: true, payment: true, attendance: true }
        }
    };
    saveState();
}

async function saveState() {
    const { error } = await sb.from('dashboard_data').update({ data: appState, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) {
        console.error('Failed to save shared data', error);
    }
}

// ==========================================
// 3. APPLICATION WORKFLOW
// ==========================================

async function startApplication() {
    // appState is already loaded by initAuth() before this runs.
    populatePresetServicePickers();
    switchTab('dashboard');
    refreshAllViews();
    renderAdminAccountsList();

    const today = getTodayDateString();
    document.getElementById('event-date').value = today;
    document.getElementById('attendance-log-date').value = today;
    document.getElementById('pay-date').value = today;
}

// ==========================================
// 3B. STAFF WORK PORTAL (separate, own password, same shared data)
// ==========================================

async function startStaffPortal() {
    await loadState();
    populateWorklogStaffSelect();
    document.getElementById('worklog-date').value = getTodayDateString();
    document.getElementById('worklog-time').value = getCurrentTimeString();
    renderMyWorkLogs();
    renderAvailableEventsForStaff();
    refreshStaffNotifyUI();
}

// ==========================================
// 3C. PUSH NOTIFICATIONS - staff get a home-screen alert when a new event
// gets its date booked (reaches the "Advance Pay / Date Booked" stage).
// ==========================================

const VAPID_PUBLIC_KEY = 'BGwJ1GXScekbfhwx1WQDsF6LLpwAmKd84bmP_3SSnA9E3xAPqB03HjhBW166OjtyUuxw1_xZhLuFXrLc-P8cdFE';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// Shows the "Enable Notifications" banner or a status line depending on
// whether push is supported/already enabled on this device/browser.
async function refreshStaffNotifyUI() {
    const banner = document.getElementById('staff-notify-banner');
    const statusEl = document.getElementById('staff-notify-status');
    if (!banner || !statusEl) return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        hideView('staff-notify-banner');
        statusEl.textContent = '';
        return;
    }

    if (Notification.permission === 'denied') {
        hideView('staff-notify-banner');
        statusEl.textContent = 'Notifications are blocked in your browser settings - enable them there to get booking alerts.';
        return;
    }

    const registration = await navigator.serviceWorker.ready;
    const existingSub = await registration.pushManager.getSubscription();

    if (existingSub) {
        hideView('staff-notify-banner');
        statusEl.textContent = 'Notifications are ON - you\'ll be alerted here when a new event is booked.';
    } else {
        showView('staff-notify-banner');
        statusEl.textContent = '';
    }
}

async function enableStaffNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('Push notifications are not supported on this browser.');
        return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        showToast('Notification permission was not granted.');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        const subJson = subscription.toJSON();
        const staffName = sessionStorage.getItem('dd_staff_applicant_name') || document.getElementById('worklog-staff-select').value || '';

        await sb.from('push_subscriptions').upsert({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
            subscriber_name: staffName,
            subscriber_role: 'staff'
        }, { onConflict: 'endpoint' });

        showToast('Notifications enabled! You\'ll be alerted when a new event is booked.');
        refreshStaffNotifyUI();
    } catch (err) {
        console.error('Push subscription failed', err);
        showToast('Could not enable notifications on this device.');
    }
}

// Fires a push notification to every subscribed staff device. Called once
// an event crosses INTO the "Advance Pay / Date Booked" stage.
async function notifyStaffOfBookedEvent(evt) {
    try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                title: 'New Event Booked!',
                body: `${evt.serviceType} on ${formatDisplayDate(evt.eventDate)} at ${evt.venue || 'venue TBD'}. Apply now!`,
                url: './'
            })
        });
    } catch (err) {
        console.error('Failed to send staff notification', err);
    }
}

function populateWorklogStaffSelect() {
    const select = document.getElementById('worklog-staff-select');
    const savedName = sessionStorage.getItem('dd_staff_selected_name') || '';

    select.innerHTML = '<option value="">-- Select your name --</option>' +
        appState.staff.map(s => `<option value="${s.name}" ${s.name === savedName ? 'selected' : ''}>${s.name} (${s.role})</option>`).join('');
}

function onWorklogStaffChange() {
    const name = document.getElementById('worklog-staff-select').value;
    sessionStorage.setItem('dd_staff_selected_name', name);
    renderMyWorkLogs();
    renderAvailableEventsForStaff();
}

function submitWorkLog() {
    const staffName = document.getElementById('worklog-staff-select').value;
    if (!staffName) {
        showToast('Please select your name first.');
        return;
    }

    const date = document.getElementById('worklog-date').value;
    const time = document.getElementById('worklog-time').value;
    const location = document.getElementById('worklog-location').value.trim();
    const work = document.getElementById('worklog-work').value.trim();

    appState.workLogs.push({
        id: 'wl_' + Date.now(),
        staffName,
        date,
        time,
        location,
        work,
        loggedAt: new Date().toISOString()
    });

    saveState();
    showToast('Work update submitted!');

    document.getElementById('worklog-location').value = '';
    document.getElementById('worklog-work').value = '';
    document.getElementById('worklog-date').value = getTodayDateString();
    document.getElementById('worklog-time').value = getCurrentTimeString();

    renderMyWorkLogs();
}

function renderMyWorkLogs() {
    const tbody = document.getElementById('worklog-my-list-tbody');
    if (!tbody) return;

    const staffName = document.getElementById('worklog-staff-select').value;
    const logs = appState.workLogs
        .filter(l => !staffName || l.staffName === staffName)
        .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt))
        .slice(0, 20);

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No work updates yet.</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(l => `
        <tr>
            <td>${formatDisplayDate(l.date)}</td>
            <td>${l.time}</td>
            <td>${l.location}</td>
            <td>${l.work}</td>
        </tr>
    `).join('');
}

// Admin-side view of every work update submitted from the Staff Portal.
function renderAdminWorkLogs() {
    const tbody = document.getElementById('worklogs-tbody');
    if (!tbody) return;

    const logs = [...appState.workLogs].sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No staff work updates submitted yet.</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(l => `
        <tr>
            <td><strong>${l.staffName}</strong></td>
            <td>${formatDisplayDate(l.date)}</td>
            <td>${l.time}</td>
            <td>${l.location}</td>
            <td>${l.work}</td>
        </tr>
    `).join('');
}

function filterWorkLogs() {
    const query = document.getElementById('worklog-search').value.toLowerCase();
    const rows = document.querySelectorAll('#worklogs-tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

// ==========================================
// 3C. EVENT STAFFING - staff apply from the portal, admin approves
// ==========================================

// Events become visible to staff the moment admin approves the "Advance Pay /
// Date Booked" stage (or any stage after it) - shared appState, no extra sync needed.
function getBookedEventsForStaff() {
    return appState.events
        .filter(evt => getStageIndex(evt.status) >= getStageIndex('advance-paid'))
        .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
}

function renderAvailableEventsForStaff() {
    const container = document.getElementById('staff-available-events');
    if (!container) return;

    // Applying no longer depends on picking a name from the registered staff
    // dropdown above - anyone can type their own name here, so casual/new
    // laborers don't need to be added to the Staff list first. We remember
    // the last name they typed (this browser session only) so their
    // pending/approved status still shows up if they revisit the page.
    const myName = sessionStorage.getItem('dd_staff_applicant_name') || '';
    const events = getBookedEventsForStaff();

    if (events.length === 0) {
        container.innerHTML = '<div class="empty-notifications">No booked events yet. Check back once admin locks a booking date.</div>';
        return;
    }

    container.innerHTML = events.map(evt => {
        const myApplication = myName
            ? appState.staffApplications.find(a => a.eventId === evt.id && a.staffName.toLowerCase() === myName.toLowerCase())
            : null;

        let actionHTML;
        if (myApplication && myApplication.status === 'approved') {
            actionHTML = '<div class="stage-final-tag" style="margin-top: 10px;"><i class="fa-solid fa-circle-check"></i> Approved - you can come to work!</div>';
        } else if (myApplication && myApplication.status === 'pending') {
            actionHTML = '<div class="approval-status-tag pending"><i class="fa-solid fa-hourglass-half"></i> Pending Admin Approval</div>';
        } else if (myApplication && myApplication.status === 'rejected') {
            actionHTML = '<div class="approval-status-tag rejected"><i class="fa-solid fa-circle-xmark"></i> Not Selected for This Event</div>';
        } else {
            const safeName = myName.replace(/"/g, '&quot;');
            actionHTML = `
                <div class="apply-inline-form">
                    <input type="text" id="apply-name-${evt.id}" placeholder="Your name" class="form-control" value="${safeName}">
                    <input type="tel" id="apply-phone-${evt.id}" placeholder="Your phone number" class="form-control" style="margin-top: 8px;">
                    <button class="btn primary-btn btn-block" style="margin-top: 8px;" onclick="applyForEventWork('${evt.id}')">
                        <i class="fa-solid fa-hand"></i> Apply to Work
                    </button>
                </div>
            `;
        }

        return `
            <div class="kanban-card">
                <h4>${evt.clientName}</h4>
                <p><i class="fa-solid fa-calendar-day"></i> ${formatDisplayDate(evt.eventDate)}</p>
                <p><i class="fa-solid fa-location-dot"></i> ${evt.venue || 'Venue not set'}</p>
                <p><i class="fa-solid fa-tags"></i> ${evt.serviceType}</p>
                ${actionHTML}
            </div>
        `;
    }).join('');
}

function applyForEventWork(eventId) {
    const nameInput = document.getElementById(`apply-name-${eventId}`);
    const phoneInput = document.getElementById(`apply-phone-${eventId}`);
    const staffName = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!staffName) {
        showToast('Please enter your name first.');
        return;
    }

    const alreadyApplied = appState.staffApplications.find(a => a.eventId === eventId && a.staffName.toLowerCase() === staffName.toLowerCase());
    if (alreadyApplied) {
        showToast('You have already applied for this event.');
        return;
    }

    appState.staffApplications.push({
        id: 'app_' + Date.now(),
        eventId,
        staffName,
        phone,
        appliedAt: new Date().toISOString(),
        status: 'pending',
        decidedAt: null
    });

    sessionStorage.setItem('dd_staff_applicant_name', staffName);
    saveState();
    showToast('Application submitted! Waiting for admin approval.');
    renderAvailableEventsForStaff();
}

// Admin-side: every staff application across every event, newest first.
function renderEventApprovals() {
    const tbody = document.getElementById('event-approvals-tbody');
    if (!tbody) return;

    const apps = [...appState.staffApplications].sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

    if (apps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No staff applications yet.</td></tr>';
        return;
    }

    tbody.innerHTML = apps.map(app => {
        const evt = appState.events.find(e => e.id === app.eventId);
        const eventLabel = evt
            ? `<strong>${evt.clientName}</strong><br><small class="text-muted">${formatDisplayDate(evt.eventDate)} - ${evt.venue || '-'}</small>`
            : '<span class="text-muted">Event deleted</span>';
        const service = evt ? evt.serviceType : '-';

        let statusBadge;
        let actions;
        if (app.status === 'approved') {
            statusBadge = '<span class="badge badge-completed-bill">Approved</span>';
            actions = '<span class="text-muted" style="font-size: 0.8rem;">-</span>';
        } else if (app.status === 'rejected') {
            statusBadge = '<span class="badge" style="background: rgba(231,76,60,0.15); color: var(--color-danger);">Rejected</span>';
            actions = '<span class="text-muted" style="font-size: 0.8rem;">-</span>';
        } else {
            statusBadge = '<span class="badge badge-pending-bill">Pending</span>';
            actions = `
                <div style="display:flex; gap:5px;">
                    <button class="action-icon-btn" title="Approve" onclick="decideStaffApplication('${app.id}', 'approved')"><i class="fa-solid fa-check text-green"></i></button>
                    <button class="action-icon-btn danger" title="Reject" onclick="decideStaffApplication('${app.id}', 'rejected')"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
        }

        return `
            <tr>
                <td>${eventLabel}</td>
                <td>${service}</td>
                <td>${app.staffName}</td>
                <td>${app.phone || '-'}</td>
                <td>${formatDisplayDate(app.appliedAt.substring(0, 10))}</td>
                <td>${statusBadge}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

function decideStaffApplication(appId, decision) {
    const application = appState.staffApplications.find(a => a.id === appId);
    if (!application) return;

    application.status = decision;
    application.decidedAt = new Date().toISOString();
    saveState();
    showToast(decision === 'approved' ? 'Staff approved for this event.' : 'Staff application rejected.');
    renderEventApprovals();
}

function filterEventApprovals() {
    const query = document.getElementById('approvals-search').value.toLowerCase();
    const rows = document.querySelectorAll('#event-approvals-tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

function populatePresetServicePickers() {
    const qPicker = document.getElementById('q-service-picker');
    const invPicker = document.getElementById('inv-service-picker');
    
    const optionsHTML = servicePresets.map(preset => 
        `<option value="${preset.name}">${preset.name} (₹${preset.rate})</option>`
    ).join('');
    
    qPicker.innerHTML = '<option value="">-- Click to choose and add service --</option>' + optionsHTML;
    invPicker.innerHTML = '<option value="">-- Click to choose and add service --</option>' + optionsHTML;
}

// Keeps every event's status/delivered flag in sync with its stageIndex.
// Stage changes themselves only happen via advanceEventStage() (manual tick).
function updateEventStatuses() {
    appState.events.forEach(evt => syncEventStage(evt));
}

function refreshAllViews() {
    updateEventStatuses();
    renderDashboard();
    renderEventsList();
    renderStaffTab();
    renderCustomersList();
    loadWebhookSettingsInForm();
    checkUpcomingEventNotifications();
    refreshActivePipelineStage();
}

// Re-renders whichever pipeline stage page is currently open, so data
// (quotation saved, payment logged, delivery toggled) moves between the
// stage pages automatically without needing a manual tab switch.
function refreshActivePipelineStage() {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab || !activeTab.id.startsWith('tab-stage-')) return;
    renderPipelineStage(activeTab.id.replace('tab-stage-', ''));
}

// Mobile sidebar drawer - the sidebar is a fixed off-canvas panel below the
// 900px breakpoint (see style.css), toggled by the header hamburger button.
function openSidebar() {
    document.getElementById('app-sidebar').classList.add('mobile-open');
    document.getElementById('sidebar-overlay').classList.add('visible');
}

function closeSidebar() {
    document.getElementById('app-sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-overlay').classList.remove('visible');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });

    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    const activeNav = document.querySelector(`.sidebar-menu a[href="#${tabId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    closeSidebar();
    
    const stageTitles = {};
    STAGE_DEFS.forEach(s => { stageTitles[`stage-${s.key}`] = s.label; });

    let formattedTitle = tabId.charAt(0).toUpperCase() + tabId.slice(1);
    if (tabId === 'billing') {
        formattedTitle = 'Billing & Invoices';
    } else if (tabId === 'quotation') {
        formattedTitle = 'Quotations';
    } else if (tabId === 'worklogs') {
        formattedTitle = 'Staff Work Logs';
    } else if (tabId === 'event-approvals') {
        formattedTitle = 'Event Staff Approvals';
    } else if (stageTitles[tabId]) {
        formattedTitle = stageTitles[tabId];
    }
    document.getElementById('current-tab-title').textContent = formattedTitle;

    if (tabId === 'dashboard') {
        renderDashboard();
    } else if (stageTitles[tabId]) {
        renderPipelineStage(tabId.replace('stage-', ''));
    } else if (tabId === 'events') {
        renderEventsList();
    } else if (tabId === 'quotation') {
        loadQuotationTab();
    } else if (tabId === 'billing') {
        loadBillingTab();
    } else if (tabId === 'staff') {
        renderStaffTab();
    } else if (tabId === 'worklogs') {
        renderAdminWorkLogs();
    } else if (tabId === 'event-approvals') {
        renderEventApprovals();
    } else if (tabId === 'customers') {
        renderCustomersList();
    } else if (tabId === 'settings') {
        loadStaffPasswordStatus();
        renderAdminAccountsList();
    }
    
    hideView('notification-dropdown');
}

// ==========================================
// 4. EVENTS & INQUIRY LIFE-CYCLE MODULE
// ==========================================

function submitEventForm() {
    const id = document.getElementById('event-id-field').value;
    const clientName = document.getElementById('client-name').value.trim();
    const clientPhone = document.getElementById('client-phone').value.trim();
    const clientEmail = document.getElementById('client-email').value.trim();
    const venue = document.getElementById('event-venue').value.trim();
    const eventDate = document.getElementById('event-date').value;
    const serviceType = document.getElementById('service-type').value;
    const budget = parseFloat(document.getElementById('event-budget').value) || 0;
    const heldCompleted = document.getElementById('event-held-completed').checked;
    const notes = document.getElementById('event-notes').value.trim();

    if (id) {
        const index = appState.events.findIndex(e => e.id === id);
        if (index !== -1) {
            appState.events[index].clientName = clientName;
            appState.events[index].clientPhone = clientPhone;
            appState.events[index].clientEmail = clientEmail;
            appState.events[index].venue = venue;
            appState.events[index].eventDate = eventDate;
            appState.events[index].serviceType = serviceType;
            appState.events[index].budget = budget;
            appState.events[index].heldCompleted = heldCompleted;
            appState.events[index].notes = notes;
            
            showToast('Event updated successfully.');
        }
    } else {
        const newEvent = {
            id: 'evt_' + Date.now(),
            clientName,
            clientPhone,
            clientEmail,
            venue,
            eventDate,
            serviceType,
            budget,
            notes,
            status: 'enquiry',
            stageIndex: 0,
            delivered: false,
            heldCompleted: heldCompleted,
            items: [
                { desc: serviceType + ' Service', rate: budget, qty: 1 }
            ],
            discount: 0,
            payments: [],
            createdDate: getTodayDateString()
        };
        appState.events.push(newEvent);
        showToast('New event inquiry registered!');
        
        triggerWebhook('inquiry', {
            event: 'inquiry_created',
            timestamp: new Date().toISOString(),
            data: {
                id: newEvent.id,
                clientName: newEvent.clientName,
                clientPhone: newEvent.clientPhone,
                clientEmail: newEvent.clientEmail,
                venue: newEvent.venue,
                eventDate: newEvent.eventDate,
                serviceType: newEvent.serviceType,
                budget: newEvent.budget,
                notes: newEvent.notes
            }
        });
    }

    saveState();
    closeModal('add-event-modal');
    refreshAllViews();
}

function openEditEventModal(eventId) {
    const event = appState.events.find(e => e.id === eventId);
    if (!event) return;

    document.getElementById('modal-title').textContent = 'Edit Event Details';
    document.getElementById('event-id-field').value = event.id;
    document.getElementById('client-name').value = event.clientName;
    document.getElementById('client-phone').value = event.clientPhone;
    document.getElementById('client-email').value = event.clientEmail || '';
    document.getElementById('event-venue').value = event.venue || '';
    document.getElementById('event-date').value = event.eventDate;
    document.getElementById('service-type').value = event.serviceType;
    document.getElementById('event-budget').value = event.budget;
    document.getElementById('event-held-completed').checked = event.heldCompleted || false;
    document.getElementById('event-notes').value = event.notes || '';

    openModal('add-event-modal');
}

function deleteEvent(eventId) {
    if (confirm('Are you sure you want to delete this event/inquiry? All associated billing logs will be lost permanently.')) {
        appState.events = appState.events.filter(e => e.id !== eventId);
        if (currentQuotationEventId === eventId) currentQuotationEventId = null;
        if (currentInvoiceEventId === eventId) currentInvoiceEventId = null;
        saveState();
        showToast('Event deleted successfully.');
        refreshAllViews();
    }
}

function toggleEventCompletion(eventId) {
    const event = appState.events.find(e => e.id === eventId);
    if (!event) return;
    
    event.heldCompleted = !event.heldCompleted;
    saveState();
    showToast(event.heldCompleted ? 'Event marked as HELD/COMPLETED.' : 'Event marked as ACTIVE/INCOMPLETE.');
    refreshAllViews();
}

function renderEventsList() {
    const tbody = document.getElementById('events-list-tbody');
    tbody.innerHTML = '';

    if (appState.events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No events or inquiries registered yet. Click "New Event" to start!</td></tr>';
        return;
    }

    const sortedEvents = [...appState.events].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

    sortedEvents.forEach(evt => {
        const tr = document.createElement('tr');
        const calculations = getEventInvoiceCalculations(evt);
        
        const statusBadgeClass = `badge-${evt.status}`;
        const displayStatus = getStageLabel(evt.status);

        tr.innerHTML = `
            <td><strong>${formatDisplayDate(evt.eventDate)}</strong></td>
            <td>
                <strong>${evt.clientName}</strong><br>
                <small class="text-muted">${evt.clientPhone}</small>
            </td>
            <td>${evt.serviceType}</td>
            <td>₹${calculations.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td><span class="badge ${statusBadgeClass}">${displayStatus}</span></td>
            <td>
                ${evt.delivered
                    ? '<span class="text-green" style="font-size:0.85rem;"><i class="fa-solid fa-circle-check"></i> Delivered</span>'
                    : `<button class="btn text-btn" style="font-size:0.8rem; padding:4px 8px;" onclick="advanceEventStage('${evt.id}')">
                        <i class="fa-solid fa-check"></i> Approve &rarr; ${getStageLabel(STAGE_DEFS[getStageIndex(evt.status) + 1].key)}
                       </button>`}
            </td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="action-icon-btn" onclick="openEditEventModal('${evt.id}')" title="Edit details"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="action-icon-btn" onclick="startQuotationForEvent('${evt.id}')" title="Manage Quotation"><i class="fa-solid fa-file-signature text-quotation"></i></button>
                    <button class="action-icon-btn" onclick="startBillingForEvent('${evt.id}')" title="Manage Billing"><i class="fa-solid fa-file-invoice-dollar text-billing"></i></button>
                    <button class="action-icon-btn" onclick="toggleEventCompletion('${evt.id}')" title="${evt.heldCompleted ? 'Mark Active' : 'Mark Event Held/Completed'}">
                        <i class="fa-solid ${evt.heldCompleted ? 'fa-calendar-check text-green' : 'fa-calendar-minus'}"></i>
                    </button>
                    <button class="action-icon-btn danger" onclick="deleteEvent('${evt.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterEvents() {
    const query = document.getElementById('event-search').value.toLowerCase();
    const rows = document.querySelectorAll('#events-list-tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(query)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// ==========================================
// 5A. QUOTATIONS MODULE
// ==========================================

function loadQuotationTab() {
    renderQuotationsList();
    if (currentQuotationEventId) {
        openQuotationEditor(currentQuotationEventId);
    } else {
        hideView('quotation-editor');
        showView('quotation-placeholder');
    }
}

function renderQuotationsList() {
    const container = document.getElementById('quotations-list-container');
    container.innerHTML = '';

    if (appState.events.length === 0) {
        container.innerHTML = '<div class="empty-notifications">No events found. Register an inquiry first.</div>';
        return;
    }

    appState.events.forEach(evt => {
        const div = document.createElement('div');
        div.className = `invoice-list-item ${currentQuotationEventId === evt.id ? 'selected' : ''}`;
        div.onclick = () => {
            currentQuotationEventId = evt.id;
            loadQuotationTab();
        };

        const calcs = getEventInvoiceCalculations(evt);
        const uniqueNumber = evt.id.split('_')[1].substring(4, 9);
        const quoteNum = `QTN-${uniqueNumber}`;

        div.innerHTML = `
            <div class="invoice-item-header">
                <span>${quoteNum}</span>
                <span class="badge badge-${evt.status}">${getStageLabel(evt.status)}</span>
            </div>
            <div class="invoice-item-body">
                <span>${evt.clientName}</span>
                <strong>₹${calcs.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
            </div>
        `;
        container.appendChild(div);
    });
}

function startQuotationForEvent(eventId) {
    currentQuotationEventId = eventId;
    switchTab('quotation');
}

function openQuotationEditor(eventId) {
    const event = appState.events.find(e => e.id === eventId);
    if (!event) return;

    hideView('quotation-placeholder');
    showView('quotation-editor');

    document.getElementById('q-status-badge').className = `badge badge-${event.status}`;
    document.getElementById('q-status-badge').textContent = getStageLabel(event.status);
    const uniqueNumber = event.id.split('_')[1].substring(4, 9);
    document.getElementById('q-display-number').textContent = `QTN-${uniqueNumber}`;
    
    document.getElementById('q-date-text').textContent = event.createdDate || getTodayDateString();
    document.getElementById('q-cust-name').textContent = event.clientName;
    document.getElementById('q-cust-phone').textContent = `Phone: ${event.clientPhone}`;
    document.getElementById('q-cust-email').textContent = `Email: ${event.clientEmail || '-'}`;
    document.getElementById('q-event-service').textContent = event.serviceType;
    document.getElementById('q-event-date').textContent = formatDisplayDate(event.eventDate);
    document.getElementById('q-event-venue').textContent = event.venue || '-';

    renderQuotationItems(event);
    document.getElementById('q-discount-input').value = event.discount || 0;
    calculateQuotationTotals();
}

function renderQuotationItems(event) {
    const tbody = document.getElementById('quotation-items-tbody');
    tbody.innerHTML = '';

    if (!event.items || event.items.length === 0) {
        event.items = [{ desc: event.serviceType + ' Service', rate: event.budget, qty: 1 }];
    }

    event.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="text" class="table-input" value="${item.desc}" onchange="updateQuotationItemField(${index}, 'desc', this.value)">
            </td>
            <td class="text-right">
                <input type="number" class="table-input text-right" value="${item.rate}" onchange="updateQuotationItemField(${index}, 'rate', parseFloat(this.value) || 0)">
            </td>
            <td class="text-right">
                <input type="number" class="table-input text-right" value="${item.qty}" min="1" onchange="updateQuotationItemField(${index}, 'qty', parseInt(this.value) || 1)">
            </td>
            <td class="text-right font-bold" id="q-item-total-${index}">₹${(item.rate * item.qty).toFixed(2)}</td>
            <td class="actions-col no-print text-center">
                <button class="action-icon-btn danger" onclick="removeQuotationItem(${index})"><i class="fa-solid fa-xmark"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function addPresetServiceToQuotation(serviceName) {
    if (!serviceName) return;
    const preset = servicePresets.find(p => p.name === serviceName);
    if (!preset) return;

    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;

    if (!event.items) event.items = [];
    event.items.push({ desc: preset.name, rate: preset.rate, qty: 1 });

    renderQuotationItems(event);
    calculateQuotationTotals();
    showToast(`Added ${preset.name} to Quotation.`);
}

function addQuotationItem() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;

    if (!event.items) event.items = [];
    event.items.push({ desc: 'New Line Item', rate: 0, qty: 1 });
    
    renderQuotationItems(event);
    calculateQuotationTotals();
}

// Fixed Quotation Items array deletion indexing logic error
function removeQuotationItem(idx) {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;

    if (event.items.length <= 1) {
        showToast('Must have at least one line item.');
        return;
    }

    event.items.splice(idx, 1);
    renderQuotationItems(event);
    calculateQuotationTotals();
}

function updateQuotationItemField(idx, field, val) {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;

    event.items[idx][field] = val;
    
    const itemTotalEl = document.getElementById(`q-item-total-${idx}`);
    if (itemTotalEl) {
        itemTotalEl.textContent = `₹${(event.items[idx].rate * event.items[idx].qty).toFixed(2)}`;
    }
    
    calculateQuotationTotals();
}

function calculateQuotationTotals() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;

    let subtotal = 0;
    if (event.items) {
        event.items.forEach(item => {
            subtotal += (item.rate * item.qty);
        });
    }

    const discountVal = parseFloat(document.getElementById('q-discount-input').value) || 0;
    event.discount = discountVal;

    const grandTotal = Math.max(0, subtotal - discountVal);

    document.getElementById('q-subtotal').textContent = `₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('q-discount-display').textContent = `₹${discountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('q-grand-total').textContent = `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function saveQuotationChanges() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;

    const discountVal = parseFloat(document.getElementById('q-discount-input').value) || 0;
    event.discount = discountVal;

    saveState();
    showToast('Quotation details saved!');
    refreshAllViews();
    loadQuotationTab();
}

function printQuotation() {
    window.print();
}

// ==========================================
// JPEG EXPORT / SHARE (used by both Quotation and Invoice panels)
// ==========================================

// Renders a DOM node to a JPEG Blob using html2canvas, skipping any
// screen-only controls (.no-print) so the exported image matches print output.
function captureElementAsJPEGBlob(elementId) {
    const el = document.getElementById(elementId);
    if (!el || typeof html2canvas === 'undefined') {
        showToast('Image export is unavailable right now. Please try Print instead.');
        return Promise.resolve(null);
    }

    return html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        ignoreElements: (node) => node.classList && node.classList.contains('no-print')
    }).then(canvas => new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95);
    }));
}

function downloadElementAsJPEG(elementId, filename) {
    captureElementAsJPEGBlob(elementId).then(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Image downloaded!');
    });
}

async function shareElementAsJPEG(elementId, filename, shareTitle) {
    const blob = await captureElementAsJPEGBlob(elementId);
    if (!blob) return;

    const file = new File([blob], filename, { type: 'image/jpeg' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: shareTitle });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
        }
    }

    showToast('Direct sharing is not supported on this device — downloading the image instead.');
    downloadElementAsJPEG(elementId, filename);
}

function downloadQuotationJPEG() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const uniqueNumber = event.id.split('_')[1].substring(4, 9);
    downloadElementAsJPEG('quotation-print-area', `Quotation-${uniqueNumber}.jpg`);
}

function shareQuotationJPEG() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const uniqueNumber = event.id.split('_')[1].substring(4, 9);
    shareElementAsJPEG('quotation-print-area', `Quotation-${uniqueNumber}.jpg`, 'DD Events Quotation');
}

function downloadInvoiceJPEG() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    downloadElementAsJPEG('invoice-print-area', `${getInvoiceNumber(event)}.jpg`);
}

function shareInvoiceJPEG() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    shareElementAsJPEG('invoice-print-area', `${getInvoiceNumber(event)}.jpg`, 'DD Events Invoice');
}

function shareQuotationWhatsApp() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;

    const calcs = getEventInvoiceCalculations(event);
    const uniqueNumber = event.id.split('_')[1].substring(4, 9);
    const quoteNum = `QTN-${uniqueNumber}`;

    let itemsText = '';
    if (event.items) {
        event.items.forEach(item => {
            itemsText += `\n- ${item.desc}: ₹${item.rate} x ${item.qty} = ₹${item.rate * item.qty}`;
        });
    }

    const message = `*QUOTATION - DD EVENTS*
-------------------------------
*Quote No:* ${quoteNum}
*Customer:* ${event.clientName}
*Event Date:* ${formatDisplayDate(event.eventDate)}
*Service:* ${event.serviceType}
-------------------------------
*Details:*${itemsText}
-------------------------------
*Subtotal:* ₹${calcs.subtotal.toLocaleString('en-IN')}
*Discount:* -₹${calcs.discount.toLocaleString('en-IN')}
*Total Estimate:* ₹${calcs.grandTotal.toLocaleString('en-IN')}

*Booking Terms:*
Note: To book the event and lock the date, a booking advance of *₹2,000* must be paid. Date will only be locked after payment is received.

*Payment details:*
GPay / UPI: *6374503310*

*Shop details:*
DD Events (Events & Management)
AL.AR. Street, Kalayarkovil
Call: 6374503310, 6384203310
Thank you!`;

    let cleanPhone = event.clientPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
    }
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
    }

    if (!cleanPhone) {
        showToast('Please set a valid customer phone number first.');
        return;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
}

function filterQuotations() {
    const query = document.getElementById('quotation-search').value.toLowerCase();
    const items = document.querySelectorAll('#quotations-list-container .invoice-list-item');

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// ==========================================
// 5B. BILLING & INVOICES MODULE
// ==========================================

function loadBillingTab() {
    renderInvoicesList();
    if (currentInvoiceEventId) {
        openInvoiceEditor(currentInvoiceEventId);
    } else {
        hideView('invoice-editor');
        showView('invoice-placeholder');
    }
}

function renderInvoicesList() {
    const container = document.getElementById('invoices-list-container');
    container.innerHTML = '';

    if (appState.events.length === 0) {
        container.innerHTML = '<div class="empty-notifications">No events found. Register an inquiry first.</div>';
        return;
    }

    appState.events.forEach(evt => {
        const div = document.createElement('div');
        div.className = `invoice-list-item ${currentInvoiceEventId === evt.id ? 'selected' : ''}`;
        div.onclick = () => {
            currentInvoiceEventId = evt.id;
            loadBillingTab();
        };

        const calcs = getEventInvoiceCalculations(evt);
        const invoiceNum = getInvoiceNumber(evt);

        div.innerHTML = `
            <div class="invoice-item-header">
                <span>${invoiceNum}</span>
                <span class="badge badge-${evt.status}">${getStageLabel(evt.status)}</span>
            </div>
            <div class="invoice-item-body">
                <span>${evt.clientName}</span>
                <strong>₹${calcs.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
            </div>
        `;
        container.appendChild(div);
    });
}

function startBillingForEvent(eventId) {
    currentInvoiceEventId = eventId;
    switchTab('billing');
}

function openInvoiceEditor(eventId) {
    const event = appState.events.find(e => e.id === eventId);
    if (!event) return;

    hideView('invoice-placeholder');
    showView('invoice-editor');

    document.getElementById('inv-status-badge').className = `badge badge-${event.status}`;
    document.getElementById('inv-status-badge').textContent = getStageLabel(event.status);
    document.getElementById('inv-display-number').textContent = getInvoiceNumber(event);
    
    document.getElementById('inv-date-text').textContent = event.createdDate || getTodayDateString();
    document.getElementById('inv-cust-name').textContent = event.clientName;
    document.getElementById('inv-cust-phone').textContent = `Phone: ${event.clientPhone}`;
    document.getElementById('inv-cust-email').textContent = `Email: ${event.clientEmail || '-'}`;
    document.getElementById('inv-event-service').textContent = event.serviceType;
    document.getElementById('inv-event-date').textContent = formatDisplayDate(event.eventDate);
    document.getElementById('inv-event-venue').textContent = event.venue || '-';

    renderInvoiceItems(event);
    document.getElementById('inv-discount-input').value = event.discount || 0;
    calculateInvoiceTotals();
    renderPaymentHistory(event);
}

function renderInvoiceItems(event) {
    const tbody = document.getElementById('invoice-items-tbody');
    tbody.innerHTML = '';

    if (!event.items || event.items.length === 0) {
        event.items = [{ desc: event.serviceType + ' Service', rate: event.budget, qty: 1 }];
    }

    event.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="text" class="table-input" value="${item.desc}" onchange="updateItemField(${index}, 'desc', this.value)">
            </td>
            <td class="text-right">
                <input type="number" class="table-input text-right" value="${item.rate}" onchange="updateItemField(${index}, 'rate', parseFloat(this.value) || 0)">
            </td>
            <td class="text-right">
                <input type="number" class="table-input text-right" value="${item.qty}" min="1" onchange="updateItemField(${index}, 'qty', parseInt(this.value) || 1)">
            </td>
            <td class="text-right font-bold" id="item-total-${index}">₹${(item.rate * item.qty).toFixed(2)}</td>
            <td class="actions-col no-print text-center">
                <button class="action-icon-btn danger" onclick="removeInvoiceItem(${index})"><i class="fa-solid fa-xmark"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function addPresetServiceToInvoice(serviceName) {
    if (!serviceName) return;
    const preset = servicePresets.find(p => p.name === serviceName);
    if (!preset) return;

    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;

    if (!event.items) event.items = [];
    event.items.push({ desc: preset.name, rate: preset.rate, qty: 1 });

    renderInvoiceItems(event);
    calculateInvoiceTotals();
    showToast(`Added ${preset.name} to Invoice.`);
}

function addInvoiceItem() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;

    if (!event.items) event.items = [];
    event.items.push({ desc: 'New Line Item', rate: 0, qty: 1 });
    
    renderInvoiceItems(event);
    calculateInvoiceTotals();
}

function removeInvoiceItem(idx) {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;

    if (event.items.length <= 1) {
        showToast('Must have at least one line item.');
        return;
    }

    event.items.splice(idx, 1);
    renderInvoiceItems(event);
    calculateInvoiceTotals();
}

function updateItemField(idx, field, val) {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;

    event.items[idx][field] = val;
    
    const itemTotalEl = document.getElementById(`item-total-${idx}`);
    if (itemTotalEl) {
        itemTotalEl.textContent = `₹${(event.items[idx].rate * event.items[idx].qty).toFixed(2)}`;
    }
    
    calculateInvoiceTotals();
}

function calculateInvoiceTotals() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;

    let subtotal = 0;
    if (event.items) {
        event.items.forEach(item => {
            subtotal += (item.rate * item.qty);
        });
    }

    const discountVal = parseFloat(document.getElementById('inv-discount-input').value) || 0;
    event.discount = discountVal;

    const grandTotal = Math.max(0, subtotal - discountVal);
    
    let totalPaid = 0;
    if (event.payments) {
        event.payments.forEach(p => totalPaid += p.amount);
    }
    const pendingBalance = Math.max(0, grandTotal - totalPaid);

    document.getElementById('inv-subtotal').textContent = `₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('inv-discount-display').textContent = `₹${discountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('inv-grand-total').textContent = `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('inv-paid-total').textContent = `₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('inv-pending-balance').textContent = `₹${pendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (pendingBalance <= 0) {
        document.getElementById('inv-pending-balance').className = 'text-green';
    } else {
        document.getElementById('inv-pending-balance').className = 'text-red';
    }
}

function saveInvoiceChanges() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;

    const discountVal = parseFloat(document.getElementById('inv-discount-input').value) || 0;
    event.discount = discountVal;

    saveState();
    showToast('Invoice details saved!');
    refreshAllViews();
    loadBillingTab();
}

function recordPayment() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;

    const amount = parseFloat(document.getElementById('pay-amount').value) || 0;
    const date = document.getElementById('pay-date').value;
    const method = document.getElementById('pay-method').value;

    if (amount <= 0) {
        showToast('Payment amount must be greater than zero.');
        return;
    }

    const calcs = getEventInvoiceCalculations(event);
    if (amount > calcs.pendingBalance) {
        if (!confirm('Entered amount exceeds pending balance. Do you want to continue?')) {
            return;
        }
    }

    if (!event.payments) event.payments = [];
    
    const newPayment = {
        amount,
        date,
        method
    };
    event.payments.push(newPayment);

    saveState();
    showToast('Payment recorded successfully.');
    
    triggerWebhook('payment', {
        event: 'payment_received',
        timestamp: new Date().toISOString(),
        data: {
            eventId: event.id,
            clientName: event.clientName,
            paymentAmount: amount,
            paymentDate: date,
            paymentMethod: method,
            pendingBalance: calcs.pendingBalance - amount
        }
    });

    document.getElementById('pay-amount').value = '';
    
    refreshAllViews();
    loadBillingTab();
}

function renderPaymentHistory(event) {
    const tbody = document.getElementById('payment-history-tbody');
    tbody.innerHTML = '';

    if (!event.payments || event.payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No payment entries logged.</td></tr>';
        return;
    }

    event.payments.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDisplayDate(p.date)}</td>
            <td><strong>₹${p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            <td><span class="badge ${p.method.includes('Advance') ? 'badge-quotation' : 'badge-paid'}" style="font-size:0.75rem">${p.method}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function printInvoice() {
    window.print();
}

function shareInvoiceWhatsApp() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;

    const calcs = getEventInvoiceCalculations(event);
    const invoiceNum = getInvoiceNumber(event);

    let paymentsText = '';
    if (event.payments && event.payments.length > 0) {
        event.payments.forEach(p => {
            paymentsText += `\n- ₹${p.amount.toLocaleString('en-IN')} via ${p.method} on ${formatDisplayDate(p.date)}`;
        });
    } else {
        paymentsText = '\n- No payments logged yet';
    }

    const message = `*TAX INVOICE - DD EVENTS*
-------------------------------
*Invoice No:* ${invoiceNum}
*Customer:* ${event.clientName}
*Event Date:* ${formatDisplayDate(event.eventDate)}
*Service:* ${event.serviceType}
-------------------------------
*Total Amount:* ₹${calcs.grandTotal.toLocaleString('en-IN')}
*Payments Received:*${paymentsText}
-------------------------------
*Total Paid:* ₹${calcs.totalPaid.toLocaleString('en-IN')}
*Pending Balance:* *₹${calcs.pendingBalance.toLocaleString('en-IN')}*

*Payment details:*
GPay / UPI: *6374503310*

*Shop details:*
DD Events (Events & Management)
AL.AR. Street, Kalayarkovil
Call: 6374503310, 6384203310
Thank you!`;

    let cleanPhone = event.clientPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
    }
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
    }

    if (!cleanPhone) {
        showToast('Please set a valid customer phone number first.');
        return;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
}

// Helpers
function getInvoiceNumber(event) {
    if (!event) return '';
    const uniqueNumber = event.id.split('_')[1].substring(4, 9);
    return `INV-${uniqueNumber}`;
}

function getEventInvoiceCalculations(event) {
    let subtotal = 0;
    if (event.items) {
        event.items.forEach(item => {
            subtotal += (item.rate * item.qty);
        });
    } else {
        subtotal = event.budget || 0;
    }
    const discount = event.discount || 0;
    const grandTotal = Math.max(0, subtotal - discount);
    
    let totalPaid = 0;
    if (event.payments) {
        event.payments.forEach(p => totalPaid += p.amount);
    }
    const pendingBalance = Math.max(0, grandTotal - totalPaid);

    return {
        subtotal,
        discount,
        grandTotal,
        totalPaid,
        pendingBalance
    };
}

function filterInvoices() {
    const query = document.getElementById('invoice-search').value.toLowerCase();
    const items = document.querySelectorAll('#invoices-list-container .invoice-list-item');

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// ==========================================
// 6. STAFF ATTENDANCE MODULE
// ==========================================

function renderStaffTab() {
    renderAttendanceStaffDropdowns();
    renderStaffConfigTable();
    loadAttendanceLogs();
}

function renderAttendanceStaffDropdowns() {
    const select = document.getElementById('attendance-staff-select');
    select.innerHTML = '<option value="">-- Choose Staff --</option>';

    if (appState.staff.length === 0) {
        return;
    }

    appState.staff.forEach(member => {
        const opt = document.createElement('option');
        opt.value = member.id;
        opt.textContent = `${member.name} (${member.role})`;
        select.appendChild(opt);
    });
}

function renderStaffConfigTable() {
    const tbody = document.getElementById('staff-members-tbody');
    tbody.innerHTML = '';

    if (appState.staff.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No staff members configured.</td></tr>';
        return;
    }

    appState.staff.forEach(member => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${member.name}</strong></td>
            <td>${member.role}</td>
            <td>
                <button class="action-icon-btn danger" onclick="removeStaffMember('${member.id}')" title="Remove staff"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function addStaffMember() {
    const name = document.getElementById('new-staff-name').value.trim();
    const role = document.getElementById('new-staff-role').value.trim();

    if (!name || !role) return;

    const newStaff = {
        id: 'stf_' + Date.now(),
        name,
        role
    };

    appState.staff.push(newStaff);
    saveState();
    showToast(`${name} added to staff directory.`);
    
    document.getElementById('add-staff-form').reset();
    renderStaffTab();
}

function removeStaffMember(staffId) {
    const staff = appState.staff.find(s => s.id === staffId);
    if (!staff) return;

    if (confirm(`Remove ${staff.name} from directory? Past attendance logs will not be affected.`)) {
        appState.staff = appState.staff.filter(s => s.id !== staffId);
        saveState();
        showToast('Staff member removed.');
        renderStaffTab();
    }
}

function markStaffCheckIn() {
    const staffId = document.getElementById('attendance-staff-select').value;
    if (!staffId) {
        showToast('Please select a staff member.');
        return;
    }

    const staff = appState.staff.find(s => s.id === staffId);
    const today = getTodayDateString();
    const time = getCurrentTimeString();

    const existing = appState.attendance.find(a => a.staffId === staffId && a.date === today);

    if (existing) {
        showToast(`${staff.name} has already checked in today at ${existing.checkInTime}`);
        return;
    }

    const log = {
        id: 'att_' + Date.now(),
        date: today,
        staffId: staffId,
        checkInTime: time,
        checkOutTime: null
    };

    appState.attendance.push(log);
    saveState();
    showToast(`Checked In: ${staff.name} at ${time}`);
    
    triggerWebhook('attendance', {
        event: 'staff_checkin',
        timestamp: new Date().toISOString(),
        data: {
            staffName: staff.name,
            role: staff.role,
            date: today,
            checkInTime: time
        }
    });

    document.getElementById('attendance-staff-select').value = '';
    renderStaffTab();
    renderDashboard();
}

function markStaffCheckOut() {
    const staffId = document.getElementById('attendance-staff-select').value;
    if (!staffId) {
        showToast('Please select a staff member.');
        return;
    }

    const staff = appState.staff.find(s => s.id === staffId);
    const today = getTodayDateString();
    const time = getCurrentTimeString();

    const log = appState.attendance.find(a => a.staffId === staffId && a.date === today);

    if (!log) {
        showToast(`${staff.name} has not checked in today yet.`);
        return;
    }

    if (log.checkOutTime) {
        showToast(`${staff.name} has already checked out today at ${log.checkOutTime}`);
        return;
    }

    log.checkOutTime = time;
    saveState();
    showToast(`Checked Out (Closing): ${staff.name} at ${time}`);

    triggerWebhook('attendance', {
        event: 'staff_checkout',
        timestamp: new Date().toISOString(),
        data: {
            staffName: staff.name,
            role: staff.role,
            date: today,
            checkInTime: log.checkInTime,
            checkOutTime: time
        }
    });

    document.getElementById('attendance-staff-select').value = '';
    renderStaffTab();
}

function loadAttendanceLogs() {
    const tbody = document.getElementById('attendance-log-tbody');
    tbody.innerHTML = '';

    const filterDate = document.getElementById('attendance-log-date').value;
    if (!filterDate) return;

    const dayRecords = appState.attendance.filter(a => a.date === filterDate);

    if (dayRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No attendance logged for this date.</td></tr>';
        return;
    }

    dayRecords.forEach(log => {
        const staff = appState.staff.find(s => s.id === log.staffId);
        const name = staff ? staff.name : 'Unknown Staff';
        const role = staff ? staff.role : '-';
        
        let hrsHTML = '-';
        if (log.checkInTime && log.checkOutTime) {
            hrsHTML = calculateHoursDifference(log.checkInTime, log.checkOutTime);
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${name}</strong></td>
            <td>${role}</td>
            <td><span class="badge badge-paid">${log.checkInTime}</span></td>
            <td>${log.checkOutTime ? `<span class="badge badge-billing">${log.checkOutTime}</span>` : `<span class="badge badge-inquiry">Active</span>`}</td>
            <td><strong>${hrsHTML}</strong></td>
        `;
        tbody.appendChild(tr);
    });
}

function calculateHoursDifference(startStr, endStr) {
    const [startHrs, startMins] = startStr.split(':').map(Number);
    const [endHrs, endMins] = endStr.split(':').map(Number);
    
    let totalStartMins = (startHrs * 60) + startMins;
    let totalEndMins = (endHrs * 60) + endMins;
    
    if (totalEndMins < totalStartMins) {
        totalEndMins += (24 * 60);
    }
    
    const diffMins = totalEndMins - totalStartMins;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    return `${hrs} hr ${mins} min`;
}

// ==========================================
// 7. CUSTOMER DIRECTORY MODULE
// ==========================================

function renderCustomersList() {
    const tbody = document.getElementById('customers-list-tbody');
    tbody.innerHTML = '';

    const customerMap = {};

    appState.events.forEach(evt => {
        const key = `${evt.clientName.toLowerCase()}_${evt.clientPhone}`;
        const calcs = getEventInvoiceCalculations(evt);

        if (!customerMap[key]) {
            customerMap[key] = {
                name: evt.clientName,
                phone: evt.clientPhone,
                email: evt.clientEmail,
                eventsCount: 0,
                totalBilled: 0,
                pendingBalance: 0,
                history: []
            };
        }

        customerMap[key].eventsCount += 1;
        customerMap[key].totalBilled += calcs.grandTotal;
        customerMap[key].pendingBalance += calcs.pendingBalance;
        customerMap[key].history.push({
            date: evt.eventDate,
            service: evt.serviceType,
            status: evt.status
        });
    });

    const customers = Object.values(customerMap);

    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No customers found. Customers are registered automatically when an inquiry is created.</td></tr>';
        return;
    }

    customers.forEach(cust => {
        const historyLinks = cust.history.map(h => 
            `<span class="badge badge-${h.status.toLowerCase()}" style="font-size:0.75rem; margin-right:3px; margin-bottom:3px;" title="${formatDisplayDate(h.date)}">${h.service}</span>`
        ).join('');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${cust.name}</strong></td>
            <td>${cust.phone}</td>
            <td>${cust.email || '-'}</td>
            <td class="text-center"><strong>${cust.eventsCount}</strong></td>
            <td>₹${cust.totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td><span class="${cust.pendingBalance > 0 ? 'text-red' : 'text-green'}">₹${cust.pendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></td>
            <td><div style="display:flex; flex-wrap:wrap;">${historyLinks}</div></td>
        `;
        tbody.appendChild(tr);
    });
}

function filterCustomers() {
    const query = document.getElementById('customer-search').value.toLowerCase();
    const rows = document.querySelectorAll('#customers-list-tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(query)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// ==========================================
// 8. REMINDERS & NOTIFICATION BELL MODULE
// ==========================================

function checkUpcomingEventNotifications() {
    const listContainer = document.getElementById('notification-list');
    const urgentBannerList = document.getElementById('urgent-reminders-list');
    const countBadge = document.getElementById('notification-count');
    const bannerContainer = document.getElementById('urgent-reminders-container');
    
    listContainer.innerHTML = '';
    urgentBannerList.innerHTML = '';
    
    let alertCount = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    const urgentEvents = [];

    appState.events.forEach(evt => {
        if (evt.status === 'delivered') return;

        const eventDate = new Date(evt.eventDate);
        eventDate.setHours(0,0,0,0);

        const diffTime = eventDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 2) {
            alertCount++;
            urgentEvents.push({ evt, diffDays });

            const item = document.createElement('div');
            item.className = 'dropdown-item urgent';
            item.innerHTML = `
                <div class="dropdown-item-title">${evt.clientName} - ${evt.serviceType}</div>
                <div class="dropdown-item-desc">Happening in ${diffDays} day(s) (${formatDisplayDate(evt.eventDate)}). Status: <strong>${evt.status}</strong></div>
            `;
            listContainer.appendChild(item);

            const bannerCard = document.createElement('div');
            bannerCard.className = 'reminder-alert-card';
            
            const calcs = getEventInvoiceCalculations(evt);
            
            bannerCard.innerHTML = `
                <div class="reminder-alert-info">
                    <h4>${evt.clientName} - ${evt.serviceType}</h4>
                    <p><i class="fa-solid fa-clock"></i> Scheduled: <strong>${formatDisplayDate(evt.eventDate)}</strong> (${diffDays === 0 ? 'TODAY' : diffDays === 1 ? 'TOMORROW' : 'IN 2 DAYS'})</p>
                    <p><i class="fa-solid fa-money-bill"></i> Pending: <strong class="text-red">₹${calcs.pendingBalance.toLocaleString('en-IN')}</strong></p>
                </div>
                <div class="no-print">
                    <button class="btn secondary-btn" onclick="startQuotationForEvent('${evt.id}')">Quotation</button>
                    <button class="btn secondary-btn" style="margin-left:5px;" onclick="startBillingForEvent('${evt.id}')">Billing</button>
                </div>
            `;
            urgentBannerList.appendChild(bannerCard);
        }
    });

    if (alertCount > 0) {
        countBadge.classList.remove('hidden');
        countBadge.textContent = alertCount;
        bannerContainer.classList.remove('hidden');
    } else {
        countBadge.classList.add('hidden');
        bannerContainer.classList.add('hidden');
        listContainer.innerHTML = '<div class="empty-notifications">No upcoming 2-day notifications.</div>';
    }
}

function toggleNotificationDropdown() {
    const dd = document.getElementById('notification-dropdown');
    dd.classList.toggle('hidden');
}

// ==========================================
// 9. WEBHOOKS INTEGRATION RUNNER
// ==========================================

function loadWebhookSettingsInForm() {
    if (appState.webhooks) {
        document.getElementById('webhook-url').value = appState.webhooks.url || '';
        document.getElementById('trigger-inquiry').checked = appState.webhooks.triggers.inquiry;
        document.getElementById('trigger-payment').checked = appState.webhooks.triggers.payment;
        document.getElementById('trigger-attendance').checked = appState.webhooks.triggers.attendance;
    }
}

function saveWebhookSettings() {
    const url = document.getElementById('webhook-url').value.trim();
    const inquiry = document.getElementById('trigger-inquiry').checked;
    const payment = document.getElementById('trigger-payment').checked;
    const attendance = document.getElementById('trigger-attendance').checked;

    appState.webhooks = {
        url,
        triggers: {
            inquiry,
            payment,
            attendance
        }
    };

    saveState();
    showToast('Webhook settings saved successfully.');
}

async function triggerWebhook(triggerType, payload) {
    if (!appState.webhooks || !appState.webhooks.url) return;
    
    if (appState.webhooks.triggers[triggerType] === false) return;

    try {
        const response = await fetch(appState.webhooks.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log(`Webhook (${triggerType}) triggered successfully.`);
        } else {
            console.warn(`Webhook failed. Status: ${response.status}`);
        }
    } catch (err) {
        console.error('Failed to trigger webhook due to network error:', err);
    }
}

async function testWebhook() {
    const url = document.getElementById('webhook-url').value.trim();
    if (!url) {
        showToast('Please enter a Webhook URL first.');
        return;
    }

    showToast('Sending test payload...');

    const payload = {
        event: 'test_connection',
        timestamp: new Date().toISOString(),
        message: 'Hello from DD Events Dashboard! This is a test webhook trigger.'
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast('Test Webhook sent successfully!');
        } else {
            showToast(`Webhook responded with error code: ${response.status}`);
        }
    } catch (err) {
        showToast('Webhook trigger failed. Check console.');
        console.error(err);
    }
}

// ==========================================
// 10. BACKUP & DATA RECOVERY MODULE
// ==========================================

async function exportDataBackup() {
    await loadState();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 4));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const date = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("download", `dd_events_backup_${date}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    showToast('Data backup exported successfully!');
}

function importDataBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);

            if (parsedData.events && parsedData.staff && parsedData.attendance) {
                appState = parsedData;
                await saveState();
                showToast('Backup restored successfully!');
                document.getElementById('import-file').value = '';
                await startApplication();
            } else {
                showToast('Invalid backup file structure.');
            }
        } catch (err) {
            showToast('Failed to parse backup JSON.');
            console.error(err);
        }
    };
    reader.readAsText(file);
}

// ==========================================
// 11. DASHBOARD OVERVIEW & KANBAN MODULE
// ==========================================

function renderDashboard() {
    const totalInquiries = appState.events.length;
    const activeEvents = appState.events.filter(e => e.status !== 'delivered' && e.status !== 'enquiry').length;
    const completedEvents = appState.events.filter(e => e.status === 'delivered').length;
    
    let totalPendingPayments = 0;
    appState.events.forEach(e => {
        const calcs = getEventInvoiceCalculations(e);
        totalPendingPayments += calcs.pendingBalance;
    });

    const today = getTodayDateString();
    const staffPresent = appState.attendance.filter(a => a.date === today).length;

    document.getElementById('stat-total-inquiries').textContent = totalInquiries;
    document.getElementById('stat-active-events').textContent = activeEvents;
    document.getElementById('stat-completed-events').textContent = completedEvents;
    document.getElementById('stat-pending-payments').textContent = '₹' + totalPendingPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    document.getElementById('stat-staff-present').textContent = staffPresent;

    const upcomingTbody = document.getElementById('upcoming-events-tbody');
    upcomingTbody.innerHTML = '';

    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);

    const upcomingList = appState.events.filter(e => {
        const evtDate = new Date(e.eventDate);
        evtDate.setHours(0,0,0,0);
        return evtDate >= todayDate && e.status !== 'delivered';
    }).sort((a,b) => new Date(a.eventDate) - new Date(b.eventDate)).slice(0, 5);

    if (upcomingList.length === 0) {
        upcomingTbody.innerHTML = '<tr><td colspan="6" class="text-center">No upcoming events scheduled.</td></tr>';
        return;
    }

    upcomingList.forEach(evt => {
        const calcs = getEventInvoiceCalculations(evt);
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><strong>${formatDisplayDate(evt.eventDate)}</strong></td>
            <td>${evt.clientName}</td>
            <td>${evt.serviceType}</td>
            <td>₹${calcs.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td><span class="badge badge-${evt.status}">${getStageLabel(evt.status)}</span></td>
            <td>
                <div style="font-size:0.85rem;">
                    Pending Balance: <strong class="${calcs.pendingBalance > 0 ? 'text-red' : 'text-green'}">₹${calcs.pendingBalance.toLocaleString('en-IN')}</strong>
                </div>
            </td>
        `;
        upcomingTbody.appendChild(tr);
    });
}

// Renders the events belonging to a single pipeline stage on its own page.
// stageKey matches a STAGE_DEFS key directly (enquiry, quotation, advance-paid,
// event-completed, pending-bill, completed-bill, delivered). Events only ever
// move here when someone clicks "Approve -> Next Stage" on a card - there is
// no automatic movement based on payments or dates.
function renderPipelineStage(stageKey) {
    const container = document.getElementById(`cards-stage-${stageKey}`);
    const countEl = document.getElementById(`count-stage-${stageKey}`);
    if (!container || !countEl) return;

    const stageEvents = appState.events
        .filter(evt => evt.status === stageKey)
        .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

    countEl.textContent = stageEvents.length;
    container.innerHTML = '';

    if (stageEvents.length === 0) {
        container.innerHTML = '<div class="empty-notifications">No events in this stage.</div>';
        return;
    }

    const isLastStage = getStageIndex(stageKey) === STAGE_DEFS.length - 1;
    const nextLabel = isLastStage ? '' : getStageLabel(STAGE_DEFS[getStageIndex(stageKey) + 1].key);

    stageEvents.forEach(evt => {
        const calcs = getEventInvoiceCalculations(evt);

        const card = document.createElement('div');
        card.className = 'kanban-card';

        card.innerHTML = `
            <h4>${evt.clientName}</h4>
            <p><i class="fa-solid fa-calendar-day"></i> ${formatDisplayDate(evt.eventDate)}</p>
            <p><i class="fa-solid fa-tags"></i> ${evt.serviceType}</p>
            <p class="kanban-card-total">Quote: ₹${calcs.grandTotal.toLocaleString('en-IN')}</p>
            <p>Paid: ₹${calcs.totalPaid.toLocaleString('en-IN')} | Bal: ₹${calcs.pendingBalance.toLocaleString('en-IN')}</p>
            <div class="kanban-card-actions no-print">
                <button onclick="event.stopPropagation(); startQuotationForEvent('${evt.id}')" title="Quotation"><i class="fa-solid fa-file-signature"></i></button>
                <button onclick="event.stopPropagation(); startBillingForEvent('${evt.id}')" title="Invoicing"><i class="fa-solid fa-file-invoice-dollar"></i></button>
            </div>
            ${!isLastStage ? `
            <button class="btn primary-btn btn-block approve-stage-btn no-print" onclick="event.stopPropagation(); advanceEventStage('${evt.id}')">
                <i class="fa-solid fa-check"></i> Approve &rarr; ${nextLabel}
            </button>` : `
            <div class="stage-final-tag no-print"><i class="fa-solid fa-circle-check"></i> Final Stage</div>`}
        `;

        card.onclick = () => {
            if (evt.status === 'enquiry' || evt.status === 'quotation') {
                startQuotationForEvent(evt.id);
            } else {
                startBillingForEvent(evt.id);
            }
        };

        container.appendChild(card);
    });
}

// ==========================================
// GENERAL UTILITIES
// ==========================================

function getTodayDateString() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

function getCurrentTimeString() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

function openModal(id) {
    showView(id);
}

function closeModal(id) {
    hideView(id);
    if (id === 'add-event-modal') {
        document.getElementById('event-inquiry-form').reset();
        document.getElementById('event-id-field').value = '';
        document.getElementById('event-held-completed').checked = false;
        document.getElementById('modal-title').textContent = 'New Event Inquiry';
    }
}

function showView(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function hideView(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function showToast(message) {
    const toast = document.getElementById('notification-toast');
    const msgSpan = document.getElementById('toast-message');
    msgSpan.textContent = message;
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        closeToast();
    }, 4000);
}

function closeToast() {
    const toast = document.getElementById('notification-toast');
    toast.classList.add('hidden');
}
