// DD Events Dashboard - Core Logic

// State Data structures
let appState = {
    events: [],
    staff: [],
    attendance: [],
    workLogs: [],
    staffApplications: [],
    eventStaffAssignments: [],
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

const staffDepartments = servicePresets.map(preset => preset.name);
const EVENT_DOCUMENTS_BUCKET = 'event-documents';
const DEFAULT_GOOGLE_REVIEW_URL = 'https://g.page/r/Ca560DRIuFyIEAE/review';

const departmentKeywords = {
    'Planning & Consultation': ['planning', 'consultation', 'wedding planning'],
    'Venue Booking': ['venue'],
    'Decoration': ['decoration', 'decor', 'stage'],
    'Catering': ['catering', 'food', 'meal'],
    'Photography & Videography': ['photography', 'photographer', 'videography', 'video', 'photo'],
    'Makeup & Styling': ['makeup', 'styling', 'beauty'],
    'Entertainment': ['entertainment', 'dj', 'music', 'dance'],
    'Sound, Light & LED': ['sound', 'light', 'led'],
    'Guest Management': ['guest management', 'hospitality'],
    'Transportation': ['transportation', 'transport', 'vehicle'],
    'Accommodation': ['accommodation', 'hotel', 'room'],
    'Seer & Return Gifts': ['seer', 'return gift', 'gift'],
    'Rentals': ['rental', 'rentals'],
    'Traditional Services': ['traditional', 'pooja', 'ritual'],
    'Special Effects': ['special effect', 'firework', 'smoke'],
    'Wedding Essentials': ['wedding essential'],
    'Digital Services': ['digital', 'social media', 'website'],
    'Post-Wedding Deliverables': ['post-wedding', 'album', 'deliverable'],
    'Event Coordination': ['coordination', 'coordinator'],
    'Luxury & Destination Wedding Services': ['destination wedding', 'luxury wedding']
};

const commonStaffWorkRoles = [
    'Electrician', 'Florist', 'Loader', 'Helper', 'Stage Setup', 'Backdrop Setup',
    'Light Technician', 'Sound Technician', 'LED Operator', 'Photographer',
    'Videographer', 'Drone Operator', 'Album Designer', 'Makeup Artist',
    'Catering Service', 'Cook', 'Server', 'Driver', 'Event Coordinator',
    'Guest Reception', 'Cleaner', 'Material In-Charge'
];

const staffSubWorksByDepartment = {
    'Planning & Consultation': ['Event Planner', 'Budget Planning', 'Timeline Coordinator', 'Vendor Coordinator', 'Client Coordinator'],
    'Venue Booking': ['Venue Coordinator', 'Site Inspector', 'Booking Coordinator', 'Hall Supervisor'],
    'Decoration': ['Decoration Supervisor', 'Florist', 'Stage Setup', 'Backdrop Setup', 'Electrician', 'Loader', 'Helper'],
    'Catering': ['Catering Supervisor', 'Head Cook', 'Assistant Cook', 'Server', 'Buffet Setup', 'Cleaner'],
    'Photography & Videography': ['Photographer', 'Candid Photographer', 'Traditional Photographer', 'Videographer', 'Drone Operator', 'Video Editor', 'Album Designer'],
    'Makeup & Styling': ['Makeup Artist', 'Hair Stylist', 'Saree Drapist', 'Groom Stylist', 'Makeup Assistant'],
    'Entertainment': ['DJ', 'Emcee', 'Singer', 'Dancer', 'Band Coordinator', 'Entertainment Coordinator'],
    'Sound, Light & LED': ['Sound Technician', 'Light Technician', 'LED Operator', 'Electrician', 'Console Operator', 'Rigging Helper'],
    'Guest Management': ['Guest Reception', 'Hospitality Coordinator', 'Invitation Desk', 'Seating Coordinator', 'Guest Assistant'],
    'Transportation': ['Transport Coordinator', 'Driver', 'Vehicle In-Charge', 'Pickup Assistant', 'Parking Coordinator'],
    'Accommodation': ['Accommodation Coordinator', 'Room Allocation', 'Hotel Liaison', 'Check-in Assistant', 'Guest Support'],
    'Seer & Return Gifts': ['Gift Coordinator', 'Gift Packing', 'Seer Arrangement', 'Distribution Staff', 'Stock In-Charge'],
    'Rentals': ['Rental Coordinator', 'Material In-Charge', 'Furniture Setup', 'Tent Setup', 'Loader', 'Return Checker'],
    'Traditional Services': ['Priest Coordinator', 'Ritual Assistant', 'Pooja Material In-Charge', 'Traditional Artist', 'Temple Coordinator'],
    'Special Effects': ['Special Effects Operator', 'Cold Pyro Operator', 'Smoke Machine Operator', 'Confetti Operator', 'Safety Assistant'],
    'Wedding Essentials': ['Wedding Essentials Coordinator', 'Garland In-Charge', 'Thamboolam Setup', 'Ceremony Assistant', 'Material Checker'],
    'Digital Services': ['Social Media Manager', 'Live Streaming Operator', 'Content Creator', 'Website Coordinator', 'Digital Invitation Designer'],
    'Post-Wedding Deliverables': ['Album Designer', 'Photo Editor', 'Video Editor', 'Delivery Coordinator', 'Quality Checker'],
    'Event Coordination': ['Event Coordinator', 'Floor Manager', 'Stage Manager', 'Vendor Coordinator', 'Timeline Coordinator', 'Runner'],
    'Luxury & Destination Wedding Services': ['Destination Planner', 'Travel Coordinator', 'Guest Experience Manager', 'Local Vendor Coordinator', 'Logistics Manager', 'Concierge']
};

function getDepartmentSubWorks(department) {
    return staffSubWorksByDepartment[department] || commonStaffWorkRoles;
}

let currentQuotationEventId = null;
let currentInvoiceEventId = null;
let currentEventStageFilter = 'all';
let currentEventDateView = 'event';
let currentEventDocumentsEventId = null;
let currentEventDocumentServiceKey = '';
let currentEventFinanceEventId = null;
let currentEventDetailsResponseEventId = null;
let adminFinanceEntries = [];
let pendingStaffProfilePhoto = '';
let currentStaffDirectoryFilter = { type: 'all', value: '' };

// Manual pipeline stage sequence. An event moves from one stage to the next
// only when the "Approve -> Next Stage" tick button is clicked - nothing
// moves automatically based on payments/dates any more.
const STAGE_DEFS = [
    { key: 'enquiry', label: 'Enquiry' },
    { key: 'quotation', label: 'Quotation' },
    { key: 'advance-paid', label: 'Advance Pay / Date Booked' },
    { key: 'event-completed', label: 'Event Execution' },
    { key: 'pending-bill', label: 'Pending Bill' },
    { key: 'completed-bill', label: 'Completed Bill' },
    { key: 'delivered', label: 'Delivered' }
];

function cloneDocumentData(data) {
    return JSON.parse(JSON.stringify(data || { items: [], bonusItems: [], discount: 0 }));
}

function escapeDocumentText(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function handleInlineEditorKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
    }
}

function normalizeInlineNumber(element, fallback = 0, integer = false) {
    const parsed = integer ? parseInt(element.textContent) : parseFloat(element.textContent);
    const value = Number.isFinite(parsed) ? parsed : fallback;
    element.textContent = String(value);
    return value;
}

// Quotation and invoice are separate business documents. Older saved events
// used the same event.items array for both, so migrate that data lazily without
// losing any existing services, sub-services or bonus items.
function getQuotationDocument(event) {
    if (!event.quotationData) {
        event.quotationData = {
            items: cloneDocumentData(event.items || []),
            bonusItems: cloneDocumentData(event.bonusItems || []),
            discount: Number(event.discount) || 0,
            savedAt: event.quotationSavedAt || null
        };
    }
    if (!Array.isArray(event.quotationData.items)) event.quotationData.items = [];
    if (!Array.isArray(event.quotationData.bonusItems)) event.quotationData.bonusItems = [];
    return event.quotationData;
}

function getInvoiceDocument(event) {
    if (!event.invoiceData) {
        const source = getQuotationDocument(event);
        event.invoiceData = cloneDocumentData({
            items: source.items,
            bonusItems: source.bonusItems,
            discount: source.discount,
            sourceQuotationSavedAt: source.savedAt || null
        });
    }
    if (!Array.isArray(event.invoiceData.items)) event.invoiceData.items = [];
    if (!Array.isArray(event.invoiceData.bonusItems)) event.invoiceData.bonusItems = [];
    return event.invoiceData;
}

function syncLegacyDocumentFields(event, documentData) {
    // Keep legacy fields updated for backups and the MCP server while the UI
    // uses the safer quotationData/invoiceData documents.
    event.items = cloneDocumentData(documentData.items || []);
    event.bonusItems = cloneDocumentData(documentData.bonusItems || []);
    event.discount = Number(documentData.discount) || 0;
}

function markQuotationSaved(event) {
    const quote = getQuotationDocument(event);
    quote.savedAt = new Date().toISOString();
    event.quotationSavedAt = quote.savedAt;
    syncLegacyDocumentFields(event, quote);
}

function copyQuotationToInvoice(event) {
    const quote = getQuotationDocument(event);
    event.invoiceData = cloneDocumentData({
        items: quote.items,
        bonusItems: quote.bonusItems,
        discount: quote.discount,
        sourceQuotationSavedAt: quote.savedAt || new Date().toISOString()
    });
    syncLegacyDocumentFields(event, event.invoiceData);
}

function getDocumentCalculations(documentData) {
    const subtotal = (documentData.items || []).reduce((sum, item) => {
        return sum + getDocumentItemTotal(item);
    }, 0);
    const discount = Number(documentData.discount) || 0;
    return {
        subtotal,
        discount,
        grandTotal: Math.max(0, subtotal - discount)
    };
}

function getQuotationCalculations(event) {
    return getDocumentCalculations(getQuotationDocument(event));
}

function getStageIndex(key) {
    const idx = STAGE_DEFS.findIndex(s => s.key === key);
    return idx === -1 ? 0 : idx;
}

function getStageLabel(key) {
    const stage = STAGE_DEFS.find(s => s.key === key);
    return stage ? stage.label : key;
}

function getNextStageForEvent(event) {
    const currentStage = getStageIndex(event?.status);
    if (currentStage === getStageIndex('quotation') && event?.confirmedWithoutAdvance) {
        return STAGE_DEFS[getStageIndex('event-completed')];
    }
    return STAGE_DEFS[currentStage + 1] || null;
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
async function advanceEventStage(eventId) {
    const evt = appState.events.find(e => e.id === eventId);
    if (!evt) return;

    if (evt.stageIndex >= STAGE_DEFS.length - 1) {
        showToast('This event is already at the final stage.');
        return;
    }

    const currentStage = evt.stageIndex;
    const previousEvent = cloneDocumentData(evt);

    // Lock the approved quotation into a separate invoice document when the
    // booking is confirmed, then refresh it once more when Event Execution is
    // approved into Pending Bill. The second hand-off carries any final quote
    // corrections made before billing starts.
    if (currentStage === 1 || currentStage === 3) {
        markQuotationSaved(evt);
        copyQuotationToInvoice(evt);
    }

    evt.stageIndex = currentStage === getStageIndex('quotation') && evt.confirmedWithoutAdvance
        ? getStageIndex('event-completed')
        : currentStage + 1;
    syncEventStage(evt);
    const saved = await saveState();
    if (!saved) {
        Object.keys(evt).forEach(key => delete evt[key]);
        Object.assign(evt, previousEvent);
        showToast('Stage change could not be saved. Please try again.');
        refreshAllViews();
        return false;
    }
    showToast(`Moved to "${getStageLabel(evt.status)}" stage.`);
    refreshAllViews();

    // Alert staff the moment a date gets locked in, so they can apply to work it.
    if (currentStage === getStageIndex('quotation') && ['advance-paid', 'event-completed'].includes(evt.status)) {
        notifyStaffOfBookedEvent(evt);
    }
    return true;
}

async function setWithoutAdvanceConfirmation(eventId, checked) {
    const event = appState.events.find(item => String(item.id) === String(eventId));
    if (!event || getStageIndex(event.status) !== getStageIndex('quotation')) return false;
    const previousValue = Boolean(event.confirmedWithoutAdvance);
    event.confirmedWithoutAdvance = Boolean(checked);
    if (!await saveState()) {
        event.confirmedWithoutAdvance = previousValue;
        showToast('Confirmation option could not be saved. Please try again.');
        refreshAllViews();
        return false;
    }
    showToast(event.confirmedWithoutAdvance
        ? 'Event confirmed without advance. Next approval will move it to Event Execution.'
        : 'Without-advance confirmation removed.');
    refreshAllViews();
    return true;
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
    setupRefreshOnResume();
});

// When someone switches away from the app (minimizes it, switches tabs/apps)
// and comes back, refetch the shared data immediately so approval status
// changes made elsewhere (e.g. admin approving/rejecting a work application)
// show up right away instead of only after a manual reload.
function setupRefreshOnResume() {
    const refresh = async () => {
        if (document.visibilityState !== 'visible') return;

        const isStaffAuthenticated = localStorage.getItem('dd_staff_authenticated') === 'true';
        if (isStaffAuthenticated) {
            const previousDecisions = getMyApplicationDecisions();
            if (await loadState()) {
                renderMyWorkLogs();
                renderAvailableEventsForStaff();
                announceApplicationDecisions(previousDecisions);
            } else {
                showToast('Could not refresh shared data. Your current view was kept.');
            }
            return;
        }

        // Skip reload if a save is in-flight or completed within the last 4 seconds —
        // reloading now would overwrite in-memory edits that haven't landed in Supabase yet.
        if (_saveInFlight || (Date.now() - _lastSaveAt < 4000)) return;

        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user) {
            if (await loadState()) {
                refreshAllViews();
            } else {
                showToast('Could not refresh shared data. Your current view was kept.');
            }
        }
    };

    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
}

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

function getInstallPlatform() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) return 'ios';
    if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
    if (/SamsungBrowser/i.test(ua)) return 'samsung';
    if (/Edg/i.test(ua)) return 'edge';
    if (/Android/i.test(ua)) return 'android';
    if (/Safari/i.test(ua) && !/Chrome|Chromium|CriOS/i.test(ua)) return 'safari';
    return 'desktop';
}

function updateInstallBannerForBrowser() {
    const message = document.getElementById('install-banner-message');
    const button = document.getElementById('install-app-button');
    if (!message || !button) return;
    const platform = getInstallPlatform();
    const needsGuide = !deferredInstallPrompt;
    button.innerHTML = needsGuide
        ? '<i class="fa-solid fa-circle-info"></i> How to Install'
        : '<i class="fa-solid fa-download"></i> Install';
    if (platform === 'ios') message.textContent = 'Install from Safari using Share → Add to Home Screen.';
    else if (platform === 'firefox') message.textContent = 'Install from the Firefox menu using Install or Add to Home Screen.';
    else if (platform === 'safari') message.textContent = 'Add DD Events from Safari to your Dock or Home Screen.';
    else if (needsGuide) message.textContent = 'Use your browser menu to install or add DD Events to your home screen.';
    else message.textContent = 'Add this app to your home screen for quick access.';
}

function setupInstallPrompt() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;

        if (sessionStorage.getItem('dd_install_banner_dismissed') === 'true') return;
        updateInstallBannerForBrowser();
        showView('install-app-banner');
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        hideView('install-app-banner');
        showToast('DD Events installed! Find it on your home screen.');
    });

    // Safari and Firefox do not expose Chrome's beforeinstallprompt event.
    // Show the same banner with browser-specific manual installation steps.
    window.setTimeout(() => {
        if (deferredInstallPrompt || sessionStorage.getItem('dd_install_banner_dismissed') === 'true') return;
        updateInstallBannerForBrowser();
        showView('install-app-banner');
    }, 1400);
}

function dismissInstallBanner() {
    hideView('install-app-banner');
    sessionStorage.setItem('dd_install_banner_dismissed', 'true');
}

async function triggerAppInstall() {
    hideView('install-app-banner');
    if (!deferredInstallPrompt) {
        showManualInstallHelp();
        return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
}

function showManualInstallHelp() {
    const content = document.getElementById('install-help-content');
    if (!content) return;
    const platform = getInstallPlatform();
    let title = 'Install from your browser menu';
    let steps = [
        'Open the browser menu.',
        'Choose Install app or Add to Home Screen.',
        'Confirm Add or Install.'
    ];

    if (platform === 'ios') {
        title = 'Install on iPhone / iPad using Safari';
        steps = ['Open this link in Safari.', 'Tap the Share button.', 'Choose Add to Home Screen.', 'Turn on Open as Web App, then tap Add.'];
    } else if (platform === 'firefox') {
        title = 'Install using Firefox';
        steps = ['Tap the three-dot Firefox menu.', 'Choose Install or Add to Home Screen.', 'Tap Add automatically or confirm Add.'];
    } else if (platform === 'samsung') {
        title = 'Install using Samsung Internet';
        steps = ['Tap the browser menu.', 'Choose Add page to.', 'Select Home screen and confirm.'];
    } else if (platform === 'safari') {
        title = 'Install using Safari';
        steps = ['Open the File menu.', 'Choose Add to Dock.', 'Confirm the app name and add it.'];
    } else if (platform === 'edge') {
        title = 'Install using Microsoft Edge';
        steps = ['Open the three-dot menu.', 'Choose Apps.', 'Select Install DD Events and confirm.'];
    }

    content.innerHTML = `
        <div class="install-help-browser"><i class="fa-solid fa-compass"></i><div><h3>${escapeDocumentText(title)}</h3><p>The website is working. This browser uses its own install menu instead of Chrome's popup.</p></div></div>
        <ol class="install-help-steps">${steps.map(step => `<li>${escapeDocumentText(step)}</li>`).join('')}</ol>
        <div class="install-help-link"><i class="fa-solid fa-link"></i><span>Website link</span><strong>https://dd-events-five.vercel.app</strong></div>`;
    openModal('install-help-modal');
}

// ==========================================
// 1. AUTHENTICATION MODULE (Supabase Auth - real accounts, work on any device)
// ==========================================

const SUPABASE_URL = 'https://razwvjgajaparzjksoll.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhend2amdhamFwYXJ6amtzb2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMDM0NDMsImV4cCI6MjA5ODg3OTQ0M30.cWqUkKcf6WHs0srbvIqx58kMqSiBXU9NdZy8SBus1OQ';
const PUBLIC_SITE_URL = 'https://ddeventsandmanagement.com';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Staff use the shared portal password rather than Supabase Auth. Keep their
// database requests isolated from any saved/expired admin session in `sb`.
const staffSb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

// Set once a real Supabase session is confirmed - used for display and for
// "you can't remove your own account" checks. Supabase itself persists the
// actual session token, so this app no longer needs its own auth flags.
let currentAdminEmail = null;
let dashboardAutoSyncTimer = null;
let lastSeenDashboardUpdateAt = '';
// No shared-data write is allowed until this browser has completed at least
// one successful read. This prevents a temporary network/read failure from
// turning an uninitialized local state into a destructive empty save.
let hasLoadedSharedState = false;

async function initAuth() {
    stopDashboardAutoSync();
    // localStorage (not sessionStorage) so staff stay logged in even after
    // fully closing and reopening the app - only "Exit" logs them out.
    const isStaffAuthenticated = localStorage.getItem('dd_staff_authenticated') === 'true';

    if (isStaffAuthenticated) {
        showView('auth-container');
        hideView('app-container');
        hideView('staff-app-container');
        hideView('password-login-view');
        hideView('dashboard-load-error-view');
        showView('auth-loading-view');
        const loaded = await startStaffPortal();
        if (!loaded) {
            showDashboardLoadError();
            return;
        }
        hideView('auth-loading-view');
        hideView('auth-container');
        showView('staff-app-container');
        return;
    }

    showView('auth-container');
    hideView('app-container');
    hideView('staff-app-container');
    hideView('password-login-view');
    hideView('dashboard-load-error-view');
    showView('auth-loading-view');

    const { data: { session } } = await sb.auth.getSession();

    if (session && session.user) {
        const loaded = await loadState();
        if (!loaded) {
            showDashboardLoadError();
            return;
        }
        const email = session.user.email.toLowerCase();

        if ((appState.disabledAdminEmails || []).includes(email)) {
            await sb.auth.signOut();
            showToast('This account has been disabled by your admin.');
            hideView('auth-loading-view');
            initAuth();
            return;
        }

        currentAdminEmail = email;
        // Admin-only tables (finance, sales bills, documents) are guarded by
        // is_dd_events_admin(), which reads this roster. If the roster ever
        // loses an email, that admin silently loses database access, so a
        // confirmed login re-adds itself here.
        await registerAdminEmailInRoster(email);
        await loadAdminFinanceEntries();
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

function showDashboardLoadError() {
    showView('auth-container');
    hideView('app-container');
    hideView('staff-app-container');
    hideView('auth-loading-view');
    hideView('password-login-view');
    showView('dashboard-load-error-view');
}

async function retryDashboardLoad() {
    hideView('dashboard-load-error-view');
    showView('auth-loading-view');
    await initAuth();
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
    if (!await loadState()) {
        showToast('Shared data could not be loaded. The account list was not changed.');
        return false;
    }
    if (!appState.adminEmails) appState.adminEmails = [];
    if (!appState.adminEmails.includes(email)) {
        appState.adminEmails.push(email);
        await saveState();
    }
    return true;
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

    let passwordRow = null;
    let fetchError = null;
    // Retry once for short mobile-network interruptions. A connection failure
    // must not be reported as "staff access has not been set up".
    for (let attempt = 0; attempt < 2; attempt++) {
        const result = await staffSb.from('dashboard_data').select('staff_password_hash').eq('id', 1).maybeSingle();
        passwordRow = result.data;
        fetchError = result.error;
        if (!fetchError) break;
    }

    if (fetchError) {
        console.error('Staff password lookup failed', fetchError);
        showToast('Could not connect to staff login. Check your internet and try again.');
        return;
    }

    if (!passwordRow || !passwordRow.staff_password_hash) {
        showToast('Staff access has not been set up yet. Please contact your admin.');
        return;
    }

    const enteredHash = await sha256(passwordInput.value);

    if (enteredHash === passwordRow.staff_password_hash) {
        localStorage.setItem('dd_staff_authenticated', 'true');
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
    stopDashboardAutoSync();
    localStorage.removeItem('dd_staff_authenticated');
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
    if (!await loadState()) {
        showToast('Shared data could not be loaded. No account was removed.');
        return;
    }
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
    resetSalesBilling();
    stopDashboardAutoSync();
    sb.auth.signOut();
    currentAdminEmail = null;
    hasLoadedSharedState = false;
    currentEventFinanceEventId = null;
    currentEventDetailsResponseEventId = null;
    adminFinanceEntries = [];
    appState = { events: [], staff: [], attendance: [], workLogs: [], staffApplications: [], eventStaffAssignments: [], webhooks: {} };
    initAuth();
}

// ==========================================
// 2. STATE & STORAGE MANAGEMENT (Supabase - one shared row, works from any device)
// ==========================================

async function loadState() {
    const dataClient = localStorage.getItem('dd_staff_authenticated') === 'true' ? staffSb : sb;
    try {
        const { data, error } = await dataClient.from('dashboard_data').select('data, updated_at').eq('id', 1).single();

        if (error || !data || !data.data || typeof data.data !== 'object') {
            console.error('Failed to load shared data', error || new Error('Shared dashboard data is missing.'));
            return false;
        }

        applyLoadedState(data.data);
        lastSeenDashboardUpdateAt = data.updated_at || '';
        hasLoadedSharedState = true;
        return true;
    } catch (error) {
        console.error('Failed to load shared data', error);
        return false;
    }
}

function applyLoadedState(stateData) {
    appState = stateData || {};
    if (!appState.webhooks) appState.webhooks = { url: '', triggers: { inquiry: true, payment: true, attendance: true } };
    if (!appState.events) appState.events = [];
    if (!appState.staff) appState.staff = [];
    appState.staff.forEach(member => { member.workRoles = normalizeStaffWorkRoles(member.workRoles); });
    if (!appState.attendance) appState.attendance = [];
    if (!appState.workLogs) appState.workLogs = [];
    if (!appState.staffApplications) appState.staffApplications = [];
    appState.staffApplications = mergeStaffApplicationHistory(appState.staffApplications, []);
    if (!appState.eventStaffAssignments) appState.eventStaffAssignments = [];
    appState.eventStaffAssignments = mergeEventStaffAssignmentLedger(appState.eventStaffAssignments, []);
    if (!appState.adminEmails) appState.adminEmails = [];
    if (!appState.disabledAdminEmails) appState.disabledAdminEmails = [];
    if (!appState.muhurthamDates) appState.muhurthamDates = getDefaultMuhurthamDates();
    if (typeof appState.googleReviewUrl !== 'string' || !appState.googleReviewUrl.trim()) {
        appState.googleReviewUrl = DEFAULT_GOOGLE_REVIEW_URL;
    }

    appState.events.forEach(event => {
        if (!Array.isArray(event.documents)) event.documents = [];
        if (typeof event.documentNotes !== 'string') event.documentNotes = '';
        if (!event.documentServiceNotes || typeof event.documentServiceNotes !== 'object' || Array.isArray(event.documentServiceNotes)) event.documentServiceNotes = {};
        syncEventStage(event);
        getQuotationDocument(event);

        // Events that had already crossed the quotation stage before this
        // update still need an invoice document built from their saved data.
        if (event.stageIndex >= 2) getInvoiceDocument(event);
    });
}

// Internal event finance is intentionally stored outside dashboard_data.
// Staff load dashboard_data through their shared portal, so putting private
// costs there would expose them even if the UI button were hidden.
function normalizeAdminFinanceEntry(row) {
    return {
        id: row.id,
        eventId: String(row.event_id || ''),
        entryType: row.entry_type === 'investment' ? 'investment' : 'expense',
        serviceKey: String(row.service_key || ''),
        serviceName: String(row.service_name || 'General'),
        category: String(row.category || 'Other'),
        amount: Number(row.amount) || 0,
        notes: String(row.notes || ''),
        createdBy: String(row.created_by || ''),
        createdAt: row.created_at || ''
    };
}

function getAdminFinanceSignature(entries = adminFinanceEntries) {
    return JSON.stringify(entries.map(entry => [entry.id, entry.amount, entry.notes, entry.createdAt]));
}

async function loadAdminFinanceEntries(silent = false) {
    if (!currentAdminEmail) return false;
    const previousSignature = getAdminFinanceSignature();
    const { data, error } = await sb
        .from('event_finance_entries')
        .select('id,event_id,entry_type,service_key,service_name,category,amount,notes,created_by,created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Admin finance entries could not be loaded', error);
        if (!silent) showToast('Admin finance data could not be loaded. Please try again.');
        return false;
    }

    adminFinanceEntries = (data || []).map(normalizeAdminFinanceEntry);
    return previousSignature !== getAdminFinanceSignature();
}

function getEventFinanceEntries(eventId) {
    if (!currentAdminEmail) return [];
    return adminFinanceEntries.filter(entry => String(entry.eventId) === String(eventId));
}

function getEventDetailForm(eventId) {
    const event = appState.events.find(item => String(item.id) === String(eventId));
    return event?.eventDetailsForm || null;
}

function getEventFinanceTotals(event) {
    const totals = { expenses: 0, investments: 0, labor: 0, revenue: 0, profit: 0 };
    if (!event || !currentAdminEmail) return totals;
    getEventFinanceEntries(event.id).forEach(entry => {
        if (entry.entryType === 'investment') totals.investments += entry.amount;
        else totals.expenses += entry.amount;
        if (entry.entryType === 'expense' && entry.category === 'Labor') totals.labor += entry.amount;
    });
    totals.revenue = getEventInvoiceCalculations(event).grandTotal;
    totals.profit = totals.revenue - totals.expenses - totals.investments;
    return totals;
}

function getStaffProfileRevision(state = appState) {
    return JSON.stringify((state.staff || []).map(member => ({
        id: member.id,
        updatedAt: member.updatedAt || '',
        name: member.name || '',
        phone: member.phone || '',
        address: member.address || '',
        department: member.department || member.role || '',
        photoUpdatedAt: member.photoUpdatedAt || ''
    })));
}

function stopDashboardAutoSync() {
    if (!dashboardAutoSyncTimer) return;
    clearInterval(dashboardAutoSyncTimer);
    dashboardAutoSyncTimer = null;
}

async function syncAdminDashboardChanges() {
    if (!currentAdminEmail || document.visibilityState !== 'visible' || _saveInFlight || Date.now() - _lastSaveAt < 4000) return;

    const financeChanged = await loadAdminFinanceEntries(true);
    const { data, error } = await sb.from('dashboard_data').select('data, updated_at').eq('id', 1).single();
    if (error || !data || data.updated_at === lastSeenDashboardUpdateAt) {
        if (financeChanged) {
            renderEventsList();
            refreshActivePipelineStage();
            if (!document.getElementById('event-expenses-modal')?.classList.contains('hidden')) renderEventFinanceModal();
        }
        return;
    }

    const previousStaffRevision = getStaffProfileRevision();
    applyLoadedState(data.data || {});
    lastSeenDashboardUpdateAt = data.updated_at || '';
    refreshAllViews();
    renderAdminAccountsList();
    if (!document.getElementById('event-details-response-modal')?.classList.contains('hidden')) renderEventDetailsResponseModal();

    if (getStaffProfileRevision() !== previousStaffRevision) {
        showToast('Staff profiles updated automatically.');
    }
}

function startDashboardAutoSync() {
    stopDashboardAutoSync();
    dashboardAutoSyncTimer = setInterval(syncAdminDashboardChanges, 5000);
}

// The staff portal had no equivalent of the admin auto-sync above: an approval
// or rejection only appeared after the staff member switched away from the app
// and back (the visibilitychange handler). Anyone watching the screen waiting
// for a decision just kept seeing "Pending Admin Approval", and newly booked
// work never showed up on its own either.
async function syncStaffPortalChanges() {
    if (document.visibilityState !== 'visible') return;
    // Don't clobber an application that is still being written.
    if (_saveInFlight || Date.now() - _lastSaveAt < 4000) return;

    const { data, error } = await staffSb
        .from('dashboard_data')
        .select('data, updated_at')
        .eq('id', 1)
        .single();
    if (error || !data || !data.data || typeof data.data !== 'object') return;
    if (data.updated_at === lastSeenDashboardUpdateAt) return;

    const previousDecisions = getMyApplicationDecisions();
    applyLoadedState(data.data);
    lastSeenDashboardUpdateAt = data.updated_at || '';

    // Only repaint the portal itself; the profile form is a separate view and
    // must not be reset out from under someone who is typing in it.
    if (!document.getElementById('staff-portal-content')?.classList.contains('hidden')) {
        renderMyWorkLogs();
        renderAvailableEventsForStaff();
        announceApplicationDecisions(previousDecisions);
    }
}

// Push alerts don't reach every staff phone (permission denied, an iPhone that
// never got added to the home screen, a dead subscription). An in-app message
// on the decision means they still find out while the app is open.
function getMyApplicationDecisions() {
    const profile = getCurrentStaffProfile();
    const decisions = new Map();
    if (!profile) return decisions;
    (appState.staffApplications || []).forEach(application => {
        const event = appState.events.find(evt => String(evt.id || '') === String(application.eventId || ''));
        if (!event) return;
        if (getStaffApplicationForEvent(event, profile) === application) {
            decisions.set(String(application.eventId), application.status || 'pending');
        }
    });
    return decisions;
}

function announceApplicationDecisions(previousDecisions) {
    if (!previousDecisions || previousDecisions.size === 0) return;
    const current = getMyApplicationDecisions();
    for (const [eventId, status] of current) {
        const before = previousDecisions.get(eventId);
        if (!before || before === status || status === 'pending') continue;
        const event = appState.events.find(evt => String(evt.id || '') === String(eventId));
        const when = event ? formatDisplayDate(event.eventDate) : 'your event';
        showToast(status === 'approved'
            ? `Approved! You can come to work on ${when}.`
            : `Your application for ${when} was not selected.`);
        break;
    }
}

function startStaffAutoSync() {
    stopDashboardAutoSync();
    dashboardAutoSyncTimer = setInterval(syncStaffPortalChanges, 10000);
}

// Sample/approximate dates spanning traditional Tamil wedding-season months
// (Thai, Panguni/Chithirai, Aani, Karthigai) - these are NOT sourced from a
// real panchangam/astrologer, just illustrative placeholders. Admins should
// verify and edit this list in Settings against their actual calendar.
function getDefaultMuhurthamDates() {
    return [
        { id: 'mhd_1', date: '2026-01-15', label: 'Thai Month (sample)' },
        { id: 'mhd_2', date: '2026-01-22', label: 'Thai Month (sample)' },
        { id: 'mhd_3', date: '2026-02-05', label: 'Thai Month (sample)' },
        { id: 'mhd_4', date: '2026-04-14', label: 'Panguni Uthiram period (sample)' },
        { id: 'mhd_5', date: '2026-04-22', label: 'Chithirai Month (sample)' },
        { id: 'mhd_6', date: '2026-06-18', label: 'Aani Month (sample)' },
        { id: 'mhd_7', date: '2026-06-25', label: 'Aani Month (sample)' },
        { id: 'mhd_8', date: '2026-11-19', label: 'Karthigai Month (sample)' }
    ];
}

function initDefaultState() {
    appState = {
        events: [],
        staff: [],
        attendance: [],
        workLogs: [],
        staffApplications: [],
        eventStaffAssignments: [],
        adminEmails: [],
        disabledAdminEmails: [],
        googleReviewUrl: DEFAULT_GOOGLE_REVIEW_URL,
        muhurthamDates: getDefaultMuhurthamDates(),
        webhooks: {
            url: '',
            triggers: { inquiry: true, payment: true, attendance: true }
        }
    };
    // This is intentionally local-only. Persisting a default state without a
    // confirmed server read could erase the shared dashboard.
}

let _saveInFlight = false;
let _lastSaveAt = 0;
let _saveQueue = Promise.resolve();

function normalizeStaffPhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function getStaffApplicationIdentity(application) {
    const phone = normalizeStaffPhone(application.phone);
    if (phone) return `phone:${phone}`;
    if (application.staffId) return `id:${String(application.staffId)}`;
    const name = String(application.staffName || '').trim().toLowerCase();
    const department = String(application.department || '').trim().toLowerCase();
    return `legacy:${name}|${department}`;
}

function choosePersistentStaffApplication(first, second) {
    if (!first) return cloneDocumentData(second);
    if (!second) return cloneDocumentData(first);

    // Only "decided vs not yet decided" is ranked. Ranking approved above
    // rejected made an approval resurface whenever a later rejection was
    // merged against it, silently undoing the newer decision.
    const statusRank = { pending: 1, rejected: 2, approved: 2 };
    const firstRank = statusRank[first.status] || 0;
    const secondRank = statusRank[second.status] || 0;
    let preferred = first;
    let fallback = second;

    // A completed admin decision must never be replaced by a stale pending
    // application. If two decisions exist, keep the most recently decided one.
    if (secondRank > firstRank) {
        preferred = second;
        fallback = first;
    } else if (secondRank === firstRank) {
        const firstTime = new Date(first.decidedAt || first.appliedAt || 0).getTime() || 0;
        const secondTime = new Date(second.decidedAt || second.appliedAt || 0).getTime() || 0;
        if (secondTime > firstTime) {
            preferred = second;
            fallback = first;
        }
    }

    return { ...cloneDocumentData(fallback), ...cloneDocumentData(preferred) };
}

function mergeStaffApplicationHistory(localApplications = [], serverApplications = []) {
    const byId = new Map();
    [...serverApplications, ...localApplications].forEach(application => {
        if (!application || !application.eventId) return;
        const idKey = application.id || `${application.eventId}|${getStaffApplicationIdentity(application)}`;
        byId.set(idKey, choosePersistentStaffApplication(byId.get(idKey), application));
    });

    // Older browser versions could create a second record for the same staff
    // and event. Collapse those records while preserving the final decision.
    const byEventAndStaff = new Map();
    byId.forEach(application => {
        const historyKey = `${String(application.eventId)}|${getStaffApplicationIdentity(application)}`;
        byEventAndStaff.set(historyKey, choosePersistentStaffApplication(byEventAndStaff.get(historyKey), application));
    });
    return [...byEventAndStaff.values()];
}

function chooseLatestEventStaffAssignment(first, second) {
    if (!first) return cloneDocumentData(second);
    if (!second) return cloneDocumentData(first);
    const firstTime = new Date(first.updatedAt || first.createdAt || 0).getTime() || 0;
    const secondTime = new Date(second.updatedAt || second.createdAt || 0).getTime() || 0;
    const preferred = secondTime >= firstTime ? second : first;
    const fallback = preferred === second ? first : second;
    return { ...cloneDocumentData(fallback), ...cloneDocumentData(preferred) };
}

function mergeEventStaffAssignmentLedger(localAssignments = [], serverAssignments = []) {
    const assignments = new Map();
    [...serverAssignments, ...localAssignments].forEach(assignment => {
        if (!assignment || !assignment.id || !assignment.eventId) return;
        assignments.set(assignment.id, chooseLatestEventStaffAssignment(assignments.get(assignment.id), assignment));
    });
    return [...assignments.values()];
}

function mergeEventDocumentChanges(localEvents = [], serverEvents = []) {
    const serverById = new Map(serverEvents.map(event => [String(event.id), event]));
    return localEvents.map(event => {
        const serverEvent = serverById.get(String(event.id));
        if (!serverEvent) return event;
        const localTime = new Date(event.documentsUpdatedAt || 0).getTime() || 0;
        const serverTime = new Date(serverEvent.documentsUpdatedAt || 0).getTime() || 0;
        const source = serverTime > localTime ? serverEvent : event;
        const localFormTime = new Date(event.eventDetailsForm?.updatedAt || 0).getTime() || 0;
        const serverFormTime = new Date(serverEvent.eventDetailsForm?.updatedAt || 0).getTime() || 0;
        const formSource = serverFormTime > localFormTime ? serverEvent : event;
        return {
            ...event,
            documents: cloneDocumentData(source.documents || []),
            documentNotes: source.documentNotes || '',
            documentsUpdatedAt: source.documentsUpdatedAt || event.documentsUpdatedAt || '',
            eventDetailsForm: formSource.eventDetailsForm
                ? cloneDocumentData(formSource.eventDetailsForm)
                : event.eventDetailsForm
        };
    });
}

function normalizeStaffWorkRoles(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(/[\n,]+/);
    const seen = new Set();
    return source.map(role => String(role || '').trim()).filter(role => {
        const key = role.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 30);
}

function mergeStaffWorkRoleChanges(localStaff = [], serverStaff = []) {
    const serverById = new Map(serverStaff.map(member => [String(member.id), member]));
    return localStaff.map(member => {
        const serverMember = serverById.get(String(member.id));
        if (!serverMember) return { ...member, workRoles: normalizeStaffWorkRoles(member.workRoles) };
        const localTime = new Date(member.workRolesUpdatedAt || 0).getTime() || 0;
        const serverTime = new Date(serverMember.workRolesUpdatedAt || 0).getTime() || 0;
        const roleSource = serverTime > localTime ? serverMember : member;
        return {
            ...member,
            workRoles: normalizeStaffWorkRoles(roleSource.workRoles),
            workRolesUpdatedAt: roleSource.workRolesUpdatedAt || member.workRolesUpdatedAt || ''
        };
    });
}

function saveState() {
    if (!hasLoadedSharedState) {
        console.error('Blocked shared-data save because no successful load has completed.');
        showToast('Data is not loaded. Nothing was saved. Please reconnect and try again.');
        return Promise.resolve(false);
    }

    // Snapshot at request time, serialize writes, then merge the latest server
    // application history before an optimistic update. This prevents any
    // unrelated admin/staff edit from erasing existing apply/approval actions.
    const stateSnapshot = cloneDocumentData(appState);
    _lastSaveAt = Date.now();

    _saveQueue = _saveQueue.catch(() => {}).then(async () => {
        _saveInFlight = true;
        const dataClient = localStorage.getItem('dd_staff_authenticated') === 'true' ? staffSb : sb;

        for (let attempt = 0; attempt < 4; attempt += 1) {
            const { data: latestRow, error: readError } = await dataClient
                .from('dashboard_data')
                .select('data, updated_at')
                .eq('id', 1)
                .single();
            if (readError || !latestRow) {
                console.error('Failed to read latest shared data before save', readError);
                return false;
            }

            const mergedSnapshot = cloneDocumentData(stateSnapshot);
            mergedSnapshot.events = mergeEventDocumentChanges(
                stateSnapshot.events || [],
                latestRow.data?.events || []
            );
            mergedSnapshot.staff = mergeStaffWorkRoleChanges(
                stateSnapshot.staff || [],
                latestRow.data?.staff || []
            );
            mergedSnapshot.staffApplications = mergeStaffApplicationHistory(
                stateSnapshot.staffApplications || [],
                latestRow.data?.staffApplications || []
            );
            mergedSnapshot.eventStaffAssignments = mergeEventStaffAssignmentLedger(
                stateSnapshot.eventStaffAssignments || [],
                latestRow.data?.eventStaffAssignments || []
            );
            // A save that empties a list the server still has data in is almost
            // always an accident (a stale tab, a half-loaded state), and it costs
            // the whole office its records. Refuse it and keep the server copy.
            const wipedLists = ['events', 'staff', 'attendance', 'workLogs'].filter(key => {
                const serverCount = (latestRow.data?.[key] || []).length;
                const outgoingCount = (mergedSnapshot[key] || []).length;
                return serverCount > 0 && outgoingCount === 0;
            });
            if (wipedLists.length) {
                console.error('Blocked a shared-data save that would erase:', wipedLists.join(', '));
                showToast(`Save blocked: this would erase all ${wipedLists.join(' and ')}. Reload the page and try again.`);
                return false;
            }

            const updateTimestamp = new Date().toISOString();
            const { data: savedRows, error: saveError } = await dataClient
                .from('dashboard_data')
                .update({ data: mergedSnapshot, updated_at: updateTimestamp })
                .eq('id', 1)
                .eq('updated_at', latestRow.updated_at)
                .select('updated_at');

            if (saveError) {
                console.error('Failed to save shared data', saveError);
                return false;
            }

            if (savedRows && savedRows.length > 0) {
                lastSeenDashboardUpdateAt = updateTimestamp;
                appState.staffApplications = mergeStaffApplicationHistory(
                    appState.staffApplications || [],
                    mergedSnapshot.staffApplications
                );
                appState.eventStaffAssignments = mergeEventStaffAssignmentLedger(
                    appState.eventStaffAssignments || [],
                    mergedSnapshot.eventStaffAssignments
                );
                appState.events = mergeEventDocumentChanges(
                    appState.events || [],
                    mergedSnapshot.events || []
                );
                appState.staff = mergeStaffWorkRoleChanges(
                    appState.staff || [],
                    mergedSnapshot.staff || []
                );
                return true;
            }
            // Another device saved between our read and write. Re-read, merge,
            // and retry instead of overwriting its newer application history.
        }
        console.error('Could not save shared data after concurrent update retries.');
        return false;
    }).finally(() => {
        _saveInFlight = false;
        _lastSaveAt = Date.now();
    });

    return _saveQueue;
}

// ==========================================
// 3. APPLICATION WORKFLOW
// ==========================================

async function startApplication() {
    // appState is already loaded by initAuth() before this runs.
    populatePresetServicePickers();
    populateStaffDepartmentSelects();
    switchTab('dashboard');
    refreshAllViews();
    renderAdminAccountsList();
    refreshAdminNotifyUI();
    startDashboardAutoSync();

    const today = getTodayDateString();
    document.getElementById('event-date').value = today;
    document.getElementById('attendance-log-date').value = today;
    document.getElementById('pay-date').value = today;
}

// ==========================================
// 3B. STAFF WORK PORTAL (separate, own password, same shared data)
// ==========================================

async function startStaffPortal() {
    const loaded = await loadState();
    if (!loaded) return false;
    populateStaffDepartmentSelects();
    document.getElementById('worklog-date').value = getTodayDateString();
    document.getElementById('worklog-time').value = getCurrentTimeString();
    const profile = getCurrentStaffProfile();
    if (profile) {
        showStaffPortalForProfile(profile);
    } else {
        showStaffProfilePanel();
    }
    startStaffAutoSync();
    return true;
}

function populateStaffDepartmentSelects() {
    ['staff-profile-department', 'new-staff-role'].forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const selected = select.value;
        select.innerHTML = '<option value="">-- Select Department --</option>' +
            staffDepartments.map(department => `<option value="${escapeDocumentText(department)}">${escapeDocumentText(department)}</option>`).join('');
        select.value = selected;
    });
}

function getCurrentStaffProfile() {
    const profileId = localStorage.getItem('dd_staff_profile_id') || getStaffProfileIdCookie();
    let profile = profileId ? appState.staff.find(member => member.id === profileId) || null : null;

    // Recover older/partial browser sessions where the profile ID is missing
    // but the saved phone/name is still available. Only accept a unique match.
    if (!profile) {
        const savedPhone = (localStorage.getItem('dd_staff_profile_phone') || '').replace(/\D/g, '');
        if (savedPhone) {
            const phoneMatches = appState.staff.filter(member => (member.phone || '').replace(/\D/g, '') === savedPhone);
            if (phoneMatches.length === 1) profile = phoneMatches[0];
        }
    }

    if (!profile) {
        const savedName = (localStorage.getItem('dd_staff_selected_name') || localStorage.getItem('dd_staff_applicant_name') || '').trim().toLowerCase();
        if (savedName) {
            const nameMatches = appState.staff.filter(member => (member.name || '').trim().toLowerCase() === savedName);
            if (nameMatches.length === 1) profile = nameMatches[0];
        }
    }

    if (profile) rememberStaffProfile(profile);
    return profile;
}

function getStaffProfileIdCookie() {
    const cookie = document.cookie.split('; ').find(entry => entry.startsWith('dd_staff_profile_id='));
    return cookie ? decodeURIComponent(cookie.substring(cookie.indexOf('=') + 1)) : '';
}

function rememberStaffProfile(profile) {
    if (!profile) return;
    localStorage.setItem('dd_staff_profile_id', profile.id);
    localStorage.setItem('dd_staff_profile_phone', profile.phone || '');
    localStorage.setItem('dd_staff_selected_name', profile.name || '');
    localStorage.setItem('dd_staff_applicant_name', profile.name || '');
    document.cookie = `dd_staff_profile_id=${encodeURIComponent(profile.id)}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
}

function showStaffProfilePanel(profile = null) {
    showView('staff-profile-panel');
    hideView('staff-portal-content');
    const form = document.getElementById('staff-profile-form');
    form.reset();
    document.getElementById('staff-profile-id').value = profile ? profile.id : '';
    pendingStaffProfilePhoto = profile?.photoData || '';
    updateStaffPhotoPreview(pendingStaffProfilePhoto);
    document.getElementById('staff-photo-status').textContent = '';
    if (profile) {
        document.getElementById('staff-profile-name').value = profile.name || '';
        document.getElementById('staff-profile-address').value = profile.address || '';
        document.getElementById('staff-profile-phone').value = profile.phone || '';
        document.getElementById('staff-profile-department').value = profile.department || profile.role || '';
    }
}

function editStaffProfile() {
    const profile = getCurrentStaffProfile();
    if (profile) showStaffProfilePanel(profile);
}

async function saveStaffProfile() {
    const id = document.getElementById('staff-profile-id').value || `stf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const name = document.getElementById('staff-profile-name').value.trim();
    const address = document.getElementById('staff-profile-address').value.trim();
    const phone = document.getElementById('staff-profile-phone').value.trim();
    const department = document.getElementById('staff-profile-department').value;
    if (!name || !address || !phone || !department) {
        showToast('Please complete all profile details.');
        return;
    }

    // Staff may leave the portal open while admins edit other records. Merge
    // the profile into the latest shared document so saving it does not write
    // an older in-memory copy over newer admin work.
    const { data: latestRow, error: latestError } = await staffSb.from('dashboard_data').select('data').eq('id', 1).single();
    if (latestError || !latestRow) {
        console.error('Could not refresh data before saving staff profile', latestError);
        showToast('Could not save profile right now. Please try again.');
        return;
    }
    applyLoadedState(latestRow.data || {});

    const duplicatePhone = appState.staff.find(member => member.id !== id && member.phone && member.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    if (duplicatePhone) {
        showToast('A staff profile already uses this phone number. Please contact admin.');
        return;
    }

    const existingIndex = appState.staff.findIndex(member => member.id === id);
    const profile = {
        ...(existingIndex >= 0 ? appState.staff[existingIndex] : {}),
        id,
        name,
        address,
        phone,
        department,
        role: department,
        photoData: pendingStaffProfilePhoto,
        selfCreated: true,
        updatedAt: new Date().toISOString()
    };
    if ((existingIndex < 0 && profile.photoData) || (existingIndex >= 0 && profile.photoData !== appState.staff[existingIndex].photoData)) {
        profile.photoUpdatedAt = profile.updatedAt;
    }
    if (!profile.createdAt) profile.createdAt = profile.updatedAt;
    if (existingIndex >= 0) appState.staff[existingIndex] = profile;
    else appState.staff.push(profile);

    await saveState();
    rememberStaffProfile(profile);
    await updateExistingStaffSubscription(profile);
    showToast(existingIndex >= 0 ? 'Profile updated successfully.' : 'Profile saved successfully.');
    showStaffPortalForProfile(profile);
}

function showStaffPortalForProfile(profile) {
    hideView('staff-profile-panel');
    showView('staff-portal-content');
    document.getElementById('worklog-staff-select').value = profile.name;
    document.getElementById('staff-current-name').textContent = profile.name;
    document.getElementById('staff-current-department').textContent = profile.department || profile.role || 'Department not set';
    const workRolesElement = document.getElementById('staff-current-work-roles');
    const workRoles = normalizeStaffWorkRoles(profile.workRoles);
    workRolesElement.innerHTML = workRoles.length
        ? `<span>Assigned works:</span> ${workRoles.map(role => `<strong>${escapeDocumentText(role)}</strong>`).join('')}`
        : '<span>Specific work is not assigned yet.</span>';
    const avatar = document.getElementById('staff-current-avatar');
    const safeProfilePhoto = getSafeStaffPhoto(profile.photoData);
    avatar.innerHTML = safeProfilePhoto
        ? `<img src="${safeProfilePhoto}" alt="${escapeDocumentText(profile.name)} profile photo">`
        : '<i class="fa-solid fa-user"></i>';
    rememberStaffProfile(profile);
    renderMyWorkLogs();
    renderAvailableEventsForStaff();
    refreshStaffNotifyUI();
    updateExistingStaffSubscription(profile);
}

async function updateExistingStaffSubscription(profile) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;
        const subJson = subscription.toJSON();
        // supabase-js resolves with { error } instead of throwing, so an
        // unchecked upsert leaves the device looking subscribed while the
        // server has no row to push to.
        const { error } = await staffSb.from('push_subscriptions').upsert({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
            subscriber_name: profile.name,
            subscriber_role: 'staff',
            subscriber_department: resolveStaffDepartment(profile),
            staff_profile_id: profile.id
        }, { onConflict: 'endpoint' });
        if (error) console.error('Could not update staff notification profile', error);
    } catch (err) {
        console.error('Could not update staff notification profile', err);
    }
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

    if (!existingSub) {
        showView('staff-notify-banner');
        statusEl.textContent = '';
        return;
    }

    // A browser subscription on its own proves nothing: the matching row can be
    // missing because the profile was created after permission was granted, or
    // because the Edge Function pruned it as dead. Claiming "ON" in that state
    // hides the Enable button for good and no alert ever arrives, so check the
    // server and offer to re-enable when the registration is gone.
    const registered = await isStaffPushRegistered(existingSub);
    if (registered === false) {
        showView('staff-notify-banner');
        statusEl.textContent = 'This device is no longer registered for alerts - tap Enable Notifications to fix it.';
        return;
    }

    hideView('staff-notify-banner');
    statusEl.textContent = 'Notifications are ON - you\'ll be alerted here when a new event is booked.';
}

// true = registered, false = definitely missing, null = could not tell (offline
// or the query failed), in which case the caller leaves the current state alone.
async function isStaffPushRegistered(subscription) {
    try {
        const endpoint = subscription.toJSON().endpoint;
        const { data, error } = await staffSb
            .from('push_subscriptions')
            .select('endpoint')
            .eq('endpoint', endpoint)
            .maybeSingle();
        if (error) {
            console.error('Could not verify push registration', error);
            return null;
        }
        return !!data;
    } catch (err) {
        console.error('Could not verify push registration', err);
        return null;
    }
}

async function enableStaffNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('Push notifications are not supported on this browser.');
        return;
    }

    // Check the profile before touching the browser subscription. Subscribing
    // first and bailing out here left the device holding a push subscription
    // with no server row: the banner then read as already enabled, so it could
    // never be turned on again and no alert ever arrived.
    const profile = getCurrentStaffProfile();
    if (!profile) {
        showToast('Please create your staff profile before enabling notifications.');
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

        const { error } = await staffSb.from('push_subscriptions').upsert({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
            subscriber_name: profile.name,
            subscriber_role: 'staff',
            subscriber_department: resolveStaffDepartment(profile),
            staff_profile_id: profile.id
        }, { onConflict: 'endpoint' });
        // Reporting success on a failed write is what made this look enabled
        // while the server had nothing to send to.
        if (error) {
            console.error('Could not register this device for staff notifications', error);
            showToast('Could not register this device for alerts. Please try again.');
            refreshStaffNotifyUI();
            return;
        }

        showToast('Notifications enabled! You\'ll be alerted when a new event is booked.');
        refreshStaffNotifyUI();
    } catch (err) {
        console.error('Push subscription failed', err);
        showToast('Could not enable notifications on this device.');
    }
}

// Same as the staff notification opt-in above, but for the admin dashboard
// (Settings page) - so admins also get alerted for bookings, work requests,
// and approval updates, not just staff.
async function refreshAdminNotifyUI() {
    const banner = document.getElementById('admin-notify-banner');
    const statusEl = document.getElementById('admin-notify-status');
    if (!banner || !statusEl) return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        hideView('admin-notify-banner');
        statusEl.textContent = '';
        return;
    }

    if (Notification.permission === 'denied') {
        hideView('admin-notify-banner');
        statusEl.textContent = 'Notifications are blocked in your browser settings - enable them there to get alerts.';
        return;
    }

    const registration = await navigator.serviceWorker.ready;
    const existingSub = await registration.pushManager.getSubscription();

    if (existingSub) {
        hideView('admin-notify-banner');
        statusEl.textContent = 'Notifications are ON - you\'ll be alerted here for bookings, work requests, and approvals.';
    } else {
        showView('admin-notify-banner');
        statusEl.textContent = '';
    }
}

async function enableAdminNotifications() {
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

        // Clear the staff-only columns explicitly: an upsert only overwrites the
        // columns it names, so a device that was signed in as staff earlier would
        // keep its old department/profile id and stay matched by staff targeting.
        const { error: adminSubError } = await sb.from('push_subscriptions').upsert({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
            subscriber_name: currentAdminEmail || '',
            subscriber_role: 'admin',
            subscriber_department: null,
            staff_profile_id: null
        }, { onConflict: 'endpoint' });
        if (adminSubError) {
            console.error('Could not register this device for admin notifications', adminSubError);
            showToast('Could not register this device for alerts. Please try again.');
            refreshAdminNotifyUI();
            return;
        }

        showToast('Notifications enabled! You\'ll be alerted for bookings, requests, and approvals.');
        refreshAdminNotifyUI();
    } catch (err) {
        console.error('Push subscription failed', err);
        showToast('Could not enable notifications on this device.');
    }
}

// Broadcasts a push notification to every subscribed device - both staff and
// admin, since booking/request/approval updates all matter to both sides.
async function sendPushBroadcast(title, body, targeting = {}) {
    try {
        // Edge Functions reject calls without a bearer token when JWT
        // verification is left on (the Supabase default), so send the anon key
        // as Authorization too - not just as `apikey`. Without this the
        // request comes back 401 and every notification is dropped silently.
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ title, body, url: './', ...targeting })
        });

        // fetch() only rejects on network failure, so a 401/500 from the
        // function would otherwise look like a successful send.
        if (!response.ok) {
            console.error('Push notification request failed', response.status, await response.text().catch(() => ''));
            return false;
        }
        const result = await response.json().catch(() => null);
        if (result && result.sent === 0) {
            console.warn('Push notification reached no devices', { title, targeting, result });
        }
        return true;
    } catch (err) {
        console.error('Failed to send push notification', err);
        return false;
    }
}

async function notifyStaffOfBookedEvent(evt) {
    if (!isUpcomingStaffWorkEvent(evt)) return;
    const departments = getEventDepartments(evt);

    // A booking is often confirmed before its quotation lines are filled in,
    // and some service names match no department keyword at all. Bailing out
    // here used to drop the alert entirely, and nothing ever re-sent it. Tell
    // every staff device instead - the portal still filters what each of them
    // can actually apply to.
    if (departments.length === 0) {
        await sendPushBroadcast(
            'New Booked Event',
            `Date: ${formatDisplayDate(evt.eventDate)}\nLocation: ${evt.venue || 'Not set'}\nOpen the app to check if this is your department work.`,
            { audienceRole: 'staff' }
        );
        return;
    }

    await Promise.all(departments.map(department => sendPushBroadcast(
        'New Department Work',
        `Date: ${formatDisplayDate(evt.eventDate)}\nLocation: ${evt.venue || 'Not set'}\nDepartment: ${department}`,
        { audienceRole: 'staff', departments: [department] }
    )));
}

async function notifyAdminOfWorkRequest(evt, staffName) {
    await sendPushBroadcast(
        'New Work Request',
        `${staffName} wants to work on ${evt.clientName} - ${getEventServiceDescriptions(evt).join(', ')} on ${formatDisplayDate(evt.eventDate)}.`,
        { audienceRole: 'admin' }
    );
}

async function notifyStaffOfApprovalDecision(evt, staffName, decision, staffProfileId = '', department = '') {
    await sendPushBroadcast(
        decision === 'approved' ? 'Work Approved' : 'Work Request Update',
        `Date: ${formatDisplayDate(evt.eventDate)}\nLocation: ${evt.venue || 'Not set'}\nDepartment: ${department || 'Not set'}`,
        { audienceRole: 'staff', staffProfileId, subscriberName: staffName }
    );
}

function populateWorklogStaffSelect() {
    const profile = getCurrentStaffProfile();
    document.getElementById('worklog-staff-select').value = profile ? profile.name : '';
}

function onWorklogStaffChange() {
    populateWorklogStaffSelect();
}

function submitWorkLog() {
    const profile = getCurrentStaffProfile();
    if (!profile) {
        showToast('Please create your profile first.');
        return;
    }
    const staffName = profile.name;

    const date = document.getElementById('worklog-date').value;
    const time = document.getElementById('worklog-time').value;
    const location = document.getElementById('worklog-location').value.trim();
    const work = document.getElementById('worklog-work').value.trim();

    appState.workLogs.push({
        id: 'wl_' + Date.now(),
        staffId: profile.id,
        staffName,
        department: profile.department || profile.role || '',
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

    const profile = getCurrentStaffProfile();
    const staffName = profile ? profile.name : '';
    const logs = appState.workLogs
        .filter(l => profile && (l.staffId === profile.id || (!l.staffId && l.staffName === staffName)))
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

// Once a booking reaches Advance Pay, keep it visible to the relevant staff
// until its event date has passed. Admin may move a future booking to a later
// billing stage or tick HELD/COMPLETED early; neither should make that future
// work disappear from the staff portal.
function isUpcomingStaffWorkEvent(evt) {
    const eventDate = String(evt.eventDate || '');
    return eventDate >= getTodayDateString()
        && getStageIndex(evt.status) >= getStageIndex('advance-paid');
}

function getBookedEventsForStaff() {
    return appState.events
        .filter(isUpcomingStaffWorkEvent)
        // Keep every booking, including multiple events on the same date.
        // The secondary ID comparison only makes their order stable; it does
        // not group or de-duplicate them.
        .sort((a, b) => {
            const dateOrder = String(a.eventDate || '').localeCompare(String(b.eventDate || ''));
            return dateOrder || String(a.id || '').localeCompare(String(b.id || ''));
        });
}

// The "Primary Service Type" (e.g. "Full Wedding Planning") only labels the
// overall booking - it doesn't say what work is actually involved. Staff
// need to see every individual service line added to the quotation
// (Decoration, Catering, Photography, etc.) so they know what the job is.
function getEventServiceDescriptions(evt) {
    if (evt.items && evt.items.length > 0) {
        return evt.items.map(item => item.desc);
    }
    return [evt.serviceType];
}

function getEventDepartments(evt) {
    const subServices = (evt.items || []).flatMap(item => (item.subItems || []).map(getSubItemDescription));
    const searchable = [evt.serviceType, ...getEventServiceDescriptions(evt), ...subServices]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return staffDepartments.filter(department => {
        const keywords = departmentKeywords[department] || [department.toLowerCase()];
        return keywords.some(keyword => searchable.includes(keyword.toLowerCase()));
    });
}

// Older builds let a free-text role be saved where a department belongs, so
// live profiles hold values like "Decoration Supervisor" (a sub-work) or
// "General Event Work" (an ad-hoc label). Neither matches any department, which
// left those staff with a permanently empty portal and no push alerts. Map back
// to a real department where we can, and report the rest as unclassified.
function resolveStaffDepartment(profile) {
    const raw = String((profile && (profile.department || profile.role)) || '').trim();
    if (!raw) return '';
    const key = raw.toLowerCase();

    const exact = staffDepartments.find(department => department.toLowerCase() === key);
    if (exact) return exact;

    const bySubWork = Object.keys(staffSubWorksByDepartment).find(department =>
        (staffSubWorksByDepartment[department] || []).some(work => String(work).trim().toLowerCase() === key)
    );
    return bySubWork || '';
}

function eventMatchesStaffDepartment(evt, profile) {
    const eventDepartments = getEventDepartments(evt);

    // A booking whose services match no department - usually one confirmed
    // before its quotation lines were filled in - belonged to nobody, so it was
    // invisible to every staff member including the ones the booking alert had
    // just gone out to. Show it to all of them instead.
    if (eventDepartments.length === 0) return true;

    // Same for a profile we cannot classify: showing every booked job beats a
    // dead-end portal, and the admin still decides who is actually approved.
    const department = resolveStaffDepartment(profile);
    if (!department) return true;

    return eventDepartments.includes(department);
}

function getStaffApplicationForEvent(evt, profile) {
    if (!evt || !profile) return null;

    const staffId = String(profile.id || '');
    const staffName = String(profile.name || '').trim().toLowerCase();
    const staffPhone = normalizeStaffPhone(profile.phone);
    const staffDepartment = String(profile.department || profile.role || '').trim().toLowerCase();
    return appState.staffApplications.find(application => {
        if (String(application.eventId || '') !== String(evt.id || '')) return false;

        const applicationStaffId = String(application.staffId || '');
        if (staffId && applicationStaffId && applicationStaffId === staffId) return true;

        // Phone survives browser storage loss and profile recreation, so an
        // approved application still belongs to the same real person.
        const applicationPhone = normalizeStaffPhone(application.phone);
        if (staffPhone && applicationPhone && applicationPhone === staffPhone) return true;

        const applicationName = String(application.staffName || '').trim().toLowerCase();
        const applicationDepartment = String(application.department || '').trim().toLowerCase();
        return !!staffName && applicationName === staffName &&
            (!applicationStaffId || !staffId) &&
            (!applicationDepartment || !staffDepartment || applicationDepartment === staffDepartment);
    }) || null;
}

function renderStaffWorkCard(evt, profile, application) {
    let actionHTML;
    if (application && application.status === 'approved') {
        actionHTML = '<div class="stage-final-tag" style="margin-top: 10px;"><i class="fa-solid fa-circle-check"></i> Approved - you can come to work!</div>';
    } else if (application && application.status === 'pending') {
        actionHTML = '<div class="approval-status-tag pending"><i class="fa-solid fa-hourglass-half"></i> Pending Admin Approval</div>';
    } else if (application && application.status === 'rejected') {
        actionHTML = '<div class="approval-status-tag rejected"><i class="fa-solid fa-circle-xmark"></i> Not Selected for This Event</div>';
    } else {
        actionHTML = `
            <div class="apply-inline-form">
                <button class="btn primary-btn btn-block" style="margin-top: 8px;" onclick="applyForEventWork('${escapeDocumentText(evt.id)}')">
                    <i class="fa-solid fa-hand"></i> Apply to Work
                </button>
            </div>
        `;
    }

    return `
        <div class="kanban-card" data-event-id="${escapeDocumentText(evt.id)}">
            <h4><i class="fa-solid fa-briefcase"></i> Department Work</h4>
            <p><strong>Date:</strong> ${formatDisplayDate(evt.eventDate)}</p>
            <p><strong>Location:</strong> ${escapeDocumentText(evt.venue || 'Not set')}</p>
            <p><strong>Department:</strong> ${escapeDocumentText(profile.department || profile.role)}</p>
            ${actionHTML}
        </div>
    `;
}

function renderAvailableEventsForStaff() {
    const container = document.getElementById('staff-available-events');
    if (!container) return;

    // Applying no longer depends on picking a name from the registered staff
    // dropdown above - anyone can type their own name here, so casual/new
    // laborers don't need to be added to the Staff list first. We remember
    // the last name they typed in localStorage (not sessionStorage) so it
    // survives the app being fully closed and reopened, not just reloaded -
    // otherwise returning staff would see a blank "apply" form again even
    // after already being approved.
    const profile = getCurrentStaffProfile();
    if (!profile) {
        container.innerHTML = '<div class="empty-notifications">Create your staff profile to see department work.</div>';
        return;
    }
    const events = getBookedEventsForStaff().filter(evt => eventMatchesStaffDepartment(evt, profile));

    if (events.length === 0) {
        container.innerHTML = `<div class="empty-notifications">No booked work is currently available for ${escapeDocumentText(profile.department || profile.role)}.</div>`;
        return;
    }

    const workItems = events.map(evt => ({
        event: evt,
        application: getStaffApplicationForEvent(evt, profile)
    }));
    const availableWork = workItems.filter(item => !item.application);
    const appliedWork = workItems.filter(item => !!item.application);

    const renderGroup = (title, icon, items, emptyMessage) => `
        <section class="staff-work-group">
            <div class="staff-work-group-heading">
                <h4><i class="fa-solid ${icon}"></i> ${title}</h4>
                <span class="staff-work-count">${items.length}</span>
            </div>
            ${items.length
                ? `<div class="pipeline-cards-grid">${items.map(item => renderStaffWorkCard(item.event, profile, item.application)).join('')}</div>`
                : `<div class="empty-notifications">${emptyMessage}</div>`}
        </section>
    `;

    container.innerHTML = [
        renderGroup('Available to Apply', 'fa-hand', availableWork, 'No new work is waiting for your application.'),
        renderGroup('Applied / Approval Status', 'fa-clipboard-check', appliedWork, 'You have not applied for any upcoming work yet.')
    ].join('');
}

async function applyForEventWork(eventId) {
    const profile = getCurrentStaffProfile();
    if (!profile) {
        showToast('Please create your profile first.');
        return;
    }
    const staffName = profile.name;
    const phone = profile.phone || '';

    // Remember who's applying BEFORE the early-return checks below, so
    // re-opening the app (which can wipe this) or clicking Apply again on an
    // event already applied to still re-links this device to the right
    // application and shows its real status instead of a blank form.
    localStorage.setItem('dd_staff_applicant_name', staffName);

    const event = appState.events.find(evt => String(evt.id || '') === String(eventId || ''));
    // Without this the app would file an application against a deleted or
    // not-yet-synced event, which then sits in the admin table forever as
    // "Event deleted" and can never be acted on.
    if (!event) {
        showToast('This work is no longer available. Please refresh and try again.');
        renderAvailableEventsForStaff();
        return;
    }

    const alreadyApplied = getStaffApplicationForEvent(event, profile);
    if (alreadyApplied) {
        showToast('You have already applied for this event.');
        renderAvailableEventsForStaff();
        return;
    }

    const newApplication = {
        id: 'app_' + Date.now(),
        eventId,
        staffId: profile.id,
        staffName,
        phone,
        department: profile.department || profile.role || '',
        appliedAt: new Date().toISOString(),
        status: 'pending',
        decidedAt: null
    };
    appState.staffApplications.push(newApplication);

    const saved = await saveState();
    if (!saved) {
        appState.staffApplications = appState.staffApplications.filter(application => application.id !== newApplication.id);
        showToast('Application could not be saved. Please try again.');
        renderAvailableEventsForStaff();
        return;
    }
    showToast('Application submitted! Waiting for admin approval.');
    renderAvailableEventsForStaff();

    notifyAdminOfWorkRequest(event, staffName);
}

// Admin-side: every staff application across every event, newest first.
function renderEventApprovals() {
    const tbody = document.getElementById('event-approvals-tbody');
    if (!tbody) return;

    const appliedTime = application => new Date(application?.appliedAt || 0).getTime() || 0;
    const apps = [...(appState.staffApplications || [])].sort((a, b) => appliedTime(b) - appliedTime(a));

    if (apps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No staff applications yet.</td></tr>';
        return;
    }

    tbody.innerHTML = apps.map(app => {
        const evt = appState.events.find(e => String(e.id || '') === String(app.eventId || ''));
        const eventLabel = evt
            ? `<strong>${escapeDocumentText(evt.clientName)}</strong><br><small class="text-muted">${formatDisplayDate(evt.eventDate)} - ${escapeDocumentText(evt.venue || '-')}</small>`
            : '<span class="text-muted">Event deleted</span>';
        const service = evt ? escapeDocumentText(evt.serviceType || '-') : '-';

        let statusBadge;
        let actions;
        // A decision used to be final: the buttons became a dash, so a mistaken
        // approval or rejection could never be corrected from the app. Offer the
        // opposite decision instead - the merge keeps whichever was decided last.
        if (app.status === 'approved') {
            statusBadge = '<span class="badge badge-completed-bill">Approved</span>';
            actions = `
                <button class="action-icon-btn danger" title="Change to Rejected" onclick="decideStaffApplication('${escapeDocumentText(app.id)}', 'rejected')"><i class="fa-solid fa-rotate-left"></i></button>
            `;
        } else if (app.status === 'rejected') {
            statusBadge = '<span class="badge" style="background: rgba(231,76,60,0.15); color: var(--color-danger);">Rejected</span>';
            actions = `
                <button class="action-icon-btn" title="Change to Approved" onclick="decideStaffApplication('${escapeDocumentText(app.id)}', 'approved')"><i class="fa-solid fa-rotate-left text-green"></i></button>
            `;
        } else {
            statusBadge = '<span class="badge badge-pending-bill">Pending</span>';
            actions = `
                <div style="display:flex; gap:5px;">
                    <button class="action-icon-btn" title="Approve" onclick="decideStaffApplication('${escapeDocumentText(app.id)}', 'approved')"><i class="fa-solid fa-check text-green"></i></button>
                    <button class="action-icon-btn danger" title="Reject" onclick="decideStaffApplication('${escapeDocumentText(app.id)}', 'rejected')"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
        }

        // appliedAt can be missing on records written by older versions, and
        // reading .substring() off undefined threw before any row rendered -
        // which blanked the whole approvals table instead of one cell.
        const appliedOn = app.appliedAt ? formatDisplayDate(String(app.appliedAt).substring(0, 10)) : '-';

        return `
            <tr>
                <td>${eventLabel}</td>
                <td>${service}</td>
                <td>${escapeDocumentText(app.staffName || '-')}</td>
                <td>${escapeDocumentText(app.phone || '-')}</td>
                <td>${appliedOn}</td>
                <td>${statusBadge}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

async function decideStaffApplication(appId, decision) {
    const application = appState.staffApplications.find(a => a.id === appId);
    if (!application) return;

    if (application.status === decision) {
        showToast(`This application is already ${decision}.`);
        return;
    }
    // Reversing a decision changes who turns up to the job, so make it explicit.
    if (application.status === 'approved' || application.status === 'rejected') {
        const staffLabel = application.staffName || 'this staff member';
        const confirmed = confirm(`${staffLabel} is currently ${application.status}. Change this to ${decision}?`);
        if (!confirmed) return;
    }

    const previousStatus = application.status;
    application.status = decision;
    application.decidedAt = new Date().toISOString();
    if (decision === 'approved') ensureApprovedStaffAssignments();

    // Taking an approval back has to take the salary-ledger row with it,
    // otherwise the staff member stays listed as expected on the event.
    let keptLedgerRow = false;
    if (previousStatus === 'approved' && decision !== 'approved') {
        keptLedgerRow = !releaseStaffAssignmentForApplication(application.id);
    }
    const saved = await saveState();
    if (!saved) {
        application.status = previousStatus;
        await loadState();
        showToast('Approval could not be saved. Please try again.');
        renderEventApprovals();
        return;
    }
    showToast(keptLedgerRow
        ? 'Application rejected, but the salary entry was kept because attendance or payment is already recorded on it.'
        : decision === 'approved' ? 'Staff approved for this event.' : 'Staff application rejected.');
    renderEventApprovals();
    renderEventStaffSalary();

    const evt = appState.events.find(e => e.id === application.eventId);
    if (evt) notifyStaffOfApprovalDecision(
        evt,
        application.staffName,
        decision,
        application.staffId || '',
        application.department || appState.staff.find(member => member.id === application.staffId)?.department || ''
    );
}

function filterEventApprovals() {
    const query = document.getElementById('approvals-search').value.toLowerCase();
    const rows = document.querySelectorAll('#event-approvals-tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

// ==========================================
// EVENT-WISE STAFF ATTENDANCE & SALARY LEDGER (ADMIN ONLY)
// ==========================================

// Drops the ledger row this application created. Returns false - and keeps the
// row - when real work has already been recorded against it, because that data
// is the admin's, not something a status flip should silently delete.
function releaseStaffAssignmentForApplication(applicationId) {
    const sourceId = String(applicationId || '');
    if (!sourceId || !Array.isArray(appState.eventStaffAssignments)) return true;

    const index = appState.eventStaffAssignments.findIndex(assignment =>
        assignment.sourceApplicationId && String(assignment.sourceApplicationId) === sourceId
    );
    if (index < 0) return true;

    const assignment = appState.eventStaffAssignments[index];
    const hasRecordedWork = (assignment.attendanceStatus && assignment.attendanceStatus !== 'expected')
        || Number(assignment.salaryTotal) > 0
        || Number(assignment.amountPaid) > 0
        || String(assignment.notes || '').trim() !== '';
    if (hasRecordedWork) return false;

    appState.eventStaffAssignments.splice(index, 1);
    return true;
}

function ensureApprovedStaffAssignments() {
    if (!Array.isArray(appState.eventStaffAssignments)) appState.eventStaffAssignments = [];
    (appState.staffApplications || []).filter(application => application.status === 'approved').forEach(application => {
        const sourceId = String(application.id || '');
        const alreadyTracked = appState.eventStaffAssignments.some(assignment =>
            assignment.sourceApplicationId && String(assignment.sourceApplicationId) === sourceId
        );
        if (alreadyTracked) return;

        const staff = appState.staff.find(member => String(member.id || '') === String(application.staffId || ''));
        const createdAt = application.decidedAt || application.appliedAt || new Date().toISOString();
        appState.eventStaffAssignments.push({
            id: `esa_${sourceId || Date.now()}`,
            eventId: application.eventId,
            staffId: application.staffId || staff?.id || '',
            staffName: application.staffName || staff?.name || 'Unnamed Staff',
            phone: application.phone || staff?.phone || '',
            workType: application.department || staff?.department || staff?.role || 'General Event Work',
            attendanceStatus: 'expected',
            salaryTotal: 0,
            amountPaid: 0,
            notes: '',
            sourceApplicationId: sourceId,
            createdAt,
            updatedAt: createdAt
        });
    });
}

function populateEventStaffSalarySelectors() {
    const eventSelect = document.getElementById('salary-event-select');
    const staffSelect = document.getElementById('salary-staff-select');
    if (!eventSelect || !staffSelect) return;
    const selectedEvent = eventSelect.value;
    const selectedStaff = staffSelect.value;
    const events = [...appState.events].sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
    eventSelect.innerHTML = '<option value="">-- Select Event --</option>' + events.map(event =>
        `<option value="${escapeDocumentText(event.id)}">${escapeDocumentText(formatDisplayDate(event.eventDate))} - ${escapeDocumentText(event.clientName)} (${escapeDocumentText(event.serviceType)})</option>`
    ).join('');
    staffSelect.innerHTML = '<option value="">-- Select Staff --</option>' + [...appState.staff]
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map(staff => `<option value="${escapeDocumentText(staff.id)}">${escapeDocumentText(staff.name)} - ${escapeDocumentText(staff.department || staff.role || 'No department')}</option>`)
        .join('');
    eventSelect.value = selectedEvent;
    staffSelect.value = selectedStaff;
    loadStaffWorkRoleSuggestions();
}

function loadStaffWorkRoleSuggestions(resetWork = false) {
    const staffId = document.getElementById('salary-staff-select')?.value;
    const workInput = document.getElementById('salary-work-type');
    const datalist = document.getElementById('salary-work-role-options');
    if (!workInput || !datalist) return;
    const staff = appState.staff.find(member => String(member.id) === String(staffId));
    const roles = normalizeStaffWorkRoles(staff?.workRoles);
    datalist.innerHTML = roles.map(role => `<option value="${escapeDocumentText(role)}"></option>`).join('');
    if (resetWork) workInput.value = '';
    if (staff && !workInput.value.trim()) {
        workInput.value = roles[0] || staff.department || staff.role || '';
    }
}

function formatSalaryAmount(value) {
    return `₹${Math.max(0, Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

async function addEventStaffAssignment() {
    const eventId = document.getElementById('salary-event-select').value;
    const staffId = document.getElementById('salary-staff-select').value;
    const workType = document.getElementById('salary-work-type').value.trim();
    const salaryTotal = Math.max(0, Number(document.getElementById('salary-agreed-amount').value) || 0);
    const event = appState.events.find(item => String(item.id) === String(eventId));
    const staff = appState.staff.find(item => String(item.id) === String(staffId));
    if (!event || !staff || !workType) {
        showToast('Please select an event, staff member and work.');
        return;
    }

    const duplicate = appState.eventStaffAssignments.some(assignment =>
        String(assignment.eventId) === String(eventId) &&
        String(assignment.staffId) === String(staffId) &&
        String(assignment.workType || '').trim().toLowerCase() === workType.toLowerCase()
    );
    if (duplicate) {
        showToast('This staff member is already added for the same event and work.');
        return;
    }

    const now = new Date().toISOString();
    const assignment = {
        id: `esa_manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        eventId,
        staffId,
        staffName: staff.name,
        phone: staff.phone || '',
        workType,
        attendanceStatus: 'expected',
        salaryTotal,
        amountPaid: 0,
        notes: '',
        sourceApplicationId: '',
        createdAt: now,
        updatedAt: now
    };
    appState.eventStaffAssignments.push(assignment);
    const saved = await saveState();
    if (!saved) {
        appState.eventStaffAssignments = appState.eventStaffAssignments.filter(item => item.id !== assignment.id);
        showToast('Could not add staff to this event. Please try again.');
        return;
    }
    document.getElementById('event-staff-assignment-form').reset();
    showToast(`${staff.name} added to ${event.clientName}'s event.`);
    renderEventStaffSalary();
}

function renderEventStaffSalary() {
    const container = document.getElementById('event-staff-salary-groups');
    if (!container) return;
    ensureApprovedStaffAssignments();
    populateEventStaffSalarySelectors();

    const allAssignments = appState.eventStaffAssignments || [];
    const eventCount = new Set(allAssignments.map(item => String(item.eventId))).size;
    const attendedCount = allAssignments.filter(item => item.attendanceStatus === 'attended').length;
    const totalSalary = allAssignments.reduce((sum, item) => sum + Math.max(0, Number(item.salaryTotal) || 0), 0);
    const totalPaid = allAssignments.reduce((sum, item) => sum + Math.max(0, Number(item.amountPaid) || 0), 0);
    document.getElementById('salary-stat-events').textContent = eventCount;
    document.getElementById('salary-stat-attended').textContent = attendedCount;
    document.getElementById('salary-stat-total').textContent = formatSalaryAmount(totalSalary);
    document.getElementById('salary-stat-paid').textContent = formatSalaryAmount(totalPaid);
    document.getElementById('salary-stat-balance').textContent = formatSalaryAmount(Math.max(0, totalSalary - totalPaid));

    const query = (document.getElementById('event-salary-search')?.value || '').trim().toLowerCase();
    const attendanceFilter = document.getElementById('event-salary-attendance-filter')?.value || 'all';
    const visibleAssignments = allAssignments.filter(assignment => {
        const event = appState.events.find(item => String(item.id) === String(assignment.eventId));
        const haystack = [event?.clientName, event?.eventDate, event?.venue, event?.serviceType, assignment.staffName, assignment.phone, assignment.workType]
            .filter(Boolean).join(' ').toLowerCase();
        return (attendanceFilter === 'all' || assignment.attendanceStatus === attendanceFilter) && (!query || haystack.includes(query));
    });

    if (visibleAssignments.length === 0) {
        container.innerHTML = '<div class="events-empty-state"><i class="fa-solid fa-people-group"></i><h3>No staff salary records</h3><p>Approve a staff application or add staff to an event above.</p></div>';
        return;
    }

    const groups = new Map();
    visibleAssignments.forEach(assignment => {
        const key = String(assignment.eventId);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(assignment);
    });
    const sortedGroups = [...groups.entries()].sort(([firstId], [secondId]) => {
        const first = appState.events.find(event => String(event.id) === firstId);
        const second = appState.events.find(event => String(event.id) === secondId);
        return new Date(second?.eventDate || 0) - new Date(first?.eventDate || 0);
    });

    container.innerHTML = sortedGroups.map(([eventId, assignments], groupIndex) => {
        const event = appState.events.find(item => String(item.id) === String(eventId));
        const eventSalary = assignments.reduce((sum, item) => sum + Math.max(0, Number(item.salaryTotal) || 0), 0);
        const eventPaid = assignments.reduce((sum, item) => sum + Math.max(0, Number(item.amountPaid) || 0), 0);
        return `<section class="event-salary-group">
            <header class="event-salary-heading">
                <div class="event-salary-title">
                    <span class="event-salary-date"><i class="fa-regular fa-calendar"></i> ${event ? escapeDocumentText(formatDisplayDate(event.eventDate)) : 'Event deleted'}</span>
                    <h3>${escapeDocumentText(event?.clientName || 'Deleted Event')}</h3>
                    <p>${escapeDocumentText(event?.serviceType || '-')} · ${escapeDocumentText(event?.venue || 'Venue not added')}</p>
                </div>
                <div class="event-salary-totals">
                    <span><small>Salary</small><strong>${formatSalaryAmount(eventSalary)}</strong></span>
                    <span><small>Paid</small><strong class="paid">${formatSalaryAmount(eventPaid)}</strong></span>
                    <span><small>Due</small><strong class="due">${formatSalaryAmount(Math.max(0, eventSalary - eventPaid))}</strong></span>
                </div>
            </header>
            <div class="event-salary-staff-list">
                ${assignments.map((assignment, index) => renderEventSalaryStaffRow(assignment, `${groupIndex}-${index}`)).join('')}
            </div>
        </section>`;
    }).join('');
}

function renderEventSalaryStaffRow(assignment, rowKey) {
    const staff = appState.staff.find(member => String(member.id) === String(assignment.staffId));
    const photo = getSafeStaffPhoto(staff?.photoData);
    const salaryTotal = Math.max(0, Number(assignment.salaryTotal) || 0);
    const amountPaid = Math.max(0, Number(assignment.amountPaid) || 0);
    const balance = Math.max(0, salaryTotal - amountPaid);
    const statusLabels = { expected: 'Not marked yet', attended: 'Came to work', absent: 'Did not come' };
    const rowId = `salary-assignment-${rowKey}`;
    return `<article class="salary-staff-row attendance-${escapeDocumentText(assignment.attendanceStatus || 'expected')}" id="${rowId}">
        <div class="salary-staff-person">
            <div class="salary-staff-avatar">${photo ? `<img src="${photo}" alt="${escapeDocumentText(assignment.staffName)}">` : '<i class="fa-solid fa-user"></i>'}</div>
            <div><h4>${escapeDocumentText(assignment.staffName || 'Unnamed Staff')}</h4><span>${escapeDocumentText(assignment.phone || 'No phone')}</span></div>
        </div>
        <div class="salary-row-fields">
            <label><span>Work</span><input class="salary-work-input" type="text" value="${escapeDocumentText(assignment.workType || '')}"></label>
            <label><span>Attendance</span><select class="salary-attendance-input">
                ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${assignment.attendanceStatus === value ? 'selected' : ''}>${label}</option>`).join('')}
            </select></label>
            <label><span>Agreed Salary (₹)</span><input class="salary-total-input" type="number" min="0" step="1" value="${salaryTotal}" oninput="updateSalaryRowBalance('${rowId}')"></label>
            <label><span>Amount Paid (₹)</span><input class="salary-paid-input" type="number" min="0" step="1" value="${amountPaid}" oninput="updateSalaryRowBalance('${rowId}')"></label>
            <div class="salary-balance-field"><span>Balance Due</span><strong class="salary-row-balance ${balance > 0 ? 'has-due' : ''}">${formatSalaryAmount(balance)}</strong></div>
        </div>
        <div class="salary-row-footer">
            <label><span>Admin Notes</span><input class="salary-notes-input" type="text" value="${escapeDocumentText(assignment.notes || '')}" placeholder="Payment or attendance note"></label>
            <button class="btn primary-btn" onclick="saveEventStaffAssignment('${escapeDocumentText(assignment.id)}', '${rowId}')"><i class="fa-solid fa-floppy-disk"></i> Save</button>
        </div>
    </article>`;
}

function updateSalaryRowBalance(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const salaryTotal = Math.max(0, Number(row.querySelector('.salary-total-input').value) || 0);
    const amountPaid = Math.max(0, Number(row.querySelector('.salary-paid-input').value) || 0);
    const balance = Math.max(0, salaryTotal - amountPaid);
    const balanceElement = row.querySelector('.salary-row-balance');
    balanceElement.textContent = formatSalaryAmount(balance);
    balanceElement.classList.toggle('has-due', balance > 0);
}

async function saveEventStaffAssignment(assignmentId, rowId) {
    const assignment = appState.eventStaffAssignments.find(item => String(item.id) === String(assignmentId));
    const row = document.getElementById(rowId);
    if (!assignment || !row) return;
    const salaryTotal = Math.max(0, Number(row.querySelector('.salary-total-input').value) || 0);
    const amountPaid = Math.max(0, Number(row.querySelector('.salary-paid-input').value) || 0);
    if (amountPaid > salaryTotal) {
        showToast('Amount paid cannot be more than the agreed salary.');
        return;
    }
    assignment.workType = row.querySelector('.salary-work-input').value.trim() || assignment.workType;
    assignment.attendanceStatus = row.querySelector('.salary-attendance-input').value;
    assignment.salaryTotal = salaryTotal;
    assignment.amountPaid = amountPaid;
    assignment.notes = row.querySelector('.salary-notes-input').value.trim();
    assignment.updatedAt = new Date().toISOString();
    const saved = await saveState();
    if (!saved) {
        await loadState();
        showToast('Salary details could not be saved. Please try again.');
        renderEventStaffSalary();
        return;
    }
    showToast('Staff attendance and salary saved.');
    renderEventStaffSalary();
}

// ==========================================
// LEAD BOWLS - one bowl per muhurtham date. Booked events (advance-paid+)
// auto-collect into whichever bowl matches their event date - there is no
// manual "move to bowl" step, it's purely a live filter by date.
// ==========================================

const LEAD_BOWL_MIN_FILL = 3;

function getLeadsForBowlDate(dateStr) {
    return appState.events.filter(evt =>
        evt.eventDate === dateStr && getStageIndex(evt.status) >= getStageIndex('advance-paid')
    );
}

function renderLeadBowls() {
    const grid = document.getElementById('lead-bowls-grid');
    if (!grid) return;

    const bowls = [...(appState.muhurthamDates || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (bowls.length === 0) {
        grid.innerHTML = '<div class="empty-notifications">No muhurtham dates set up yet. Add some in Settings.</div>';
        return;
    }

    const tokenColors = ['#7B2CBF', '#F39C12', '#16A085', '#E74C3C', '#2E86DE', '#D63384', '#27AE60', '#8E44AD'];

    grid.innerHTML = bowls.map(bowl => {
        const leads = getLeadsForBowlDate(bowl.date);
        const isFilled = leads.length >= LEAD_BOWL_MIN_FILL;

        // Each lead becomes a little glowing "token" that visually drops into
        // the glass bowl - like marbles piling up as more dates get booked.
        const tokensHTML = leads.map((evt, i) => `
            <div class="lead-token" style="background: ${tokenColors[i % tokenColors.length]};" title="${evt.clientName} - ${evt.serviceType}">
                ${evt.clientName.trim().charAt(0).toUpperCase() || '?'}
            </div>
        `).join('');

        return `
            <div class="lead-bowl-wrapper">
                <div class="lead-bowl-shape ${isFilled ? 'lead-bowl-filled' : ''}">
                    <div class="lead-bowl-shine"></div>
                    <div class="lead-bowl-tokens">
                        ${tokensHTML || '<span class="lead-bowl-empty-hint">Empty</span>'}
                    </div>
                </div>
                <h4 class="lead-bowl-date">${formatDisplayDate(bowl.date)}</h4>
                <p class="text-muted lead-bowl-label">${bowl.label || ''}</p>
                <div class="lead-bowl-status ${isFilled ? 'filled' : 'pending'}">
                    ${isFilled
                        ? `<i class="fa-solid fa-circle-check"></i> Filled (${leads.length} leads)`
                        : `<i class="fa-solid fa-hourglass-half"></i> ${leads.length}/${LEAD_BOWL_MIN_FILL} leads - needs ${LEAD_BOWL_MIN_FILL - leads.length} more`}
                </div>
            </div>
        `;
    }).join('');
}

// Settings -> Muhurtham Dates management
function renderMuhurthamDatesList() {
    const container = document.getElementById('muhurtham-dates-list');
    if (!container) return;

    const bowls = [...(appState.muhurthamDates || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (bowls.length === 0) {
        container.innerHTML = '<div class="empty-notifications">No dates added yet.</div>';
        return;
    }

    container.innerHTML = bowls.map(bowl => `
        <div class="admin-account-row">
            <span class="admin-account-email">
                <i class="fa-solid fa-calendar-day"></i> ${formatDisplayDate(bowl.date)}
                ${bowl.label ? `<span class="text-muted" style="font-weight: normal; margin-left: 6px;">${bowl.label}</span>` : ''}
            </span>
            <button class="action-icon-btn danger" title="Remove date" onclick="removeMuhurthamDate('${bowl.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

async function addMuhurthamDate() {
    const date = document.getElementById('new-muhurtham-date').value;
    const label = document.getElementById('new-muhurtham-label').value.trim();

    if (!date) {
        showToast('Please pick a date.');
        return;
    }

    if (!appState.muhurthamDates) appState.muhurthamDates = [];
    if (appState.muhurthamDates.some(b => b.date === date)) {
        showToast('This date is already in the list.');
        return;
    }

    appState.muhurthamDates.push({ id: 'mhd_' + Date.now(), date, label });
    await saveState();
    showToast('Muhurtham date added!');
    document.getElementById('add-muhurtham-form').reset();
    renderMuhurthamDatesList();
    renderLeadBowls();
}

async function removeMuhurthamDate(id) {
    if (!confirm('Remove this muhurtham date and its lead bowl?')) return;

    appState.muhurthamDates = (appState.muhurthamDates || []).filter(b => b.id !== id);
    await saveState();
    showToast('Muhurtham date removed.');
    renderMuhurthamDatesList();
    renderLeadBowls();
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
    if (document.getElementById('tab-event-staff-salary')?.classList.contains('active')) {
        renderEventStaffSalary();
    }
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
        formattedTitle = 'Event Billing & Invoices';
    } else if (tabId === 'sales-billing') {
        formattedTitle = 'Sales Billing';
    } else if (tabId === 'quotation') {
        formattedTitle = 'Quotations';
    } else if (tabId === 'worklogs') {
        formattedTitle = 'Staff Work Logs';
    } else if (tabId === 'event-approvals') {
        formattedTitle = 'Event Staff Approvals';
    } else if (tabId === 'event-staff-salary') {
        formattedTitle = 'Event Staff & Salary';
    } else if (tabId === 'lead-bowls') {
        formattedTitle = 'Lead Bowls';
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
    } else if (tabId === 'sales-billing') {
        loadSalesBillingTab();
    } else if (tabId === 'staff') {
        renderStaffTab();
    } else if (tabId === 'worklogs') {
        renderAdminWorkLogs();
    } else if (tabId === 'event-approvals') {
        renderEventApprovals();
    } else if (tabId === 'event-staff-salary') {
        renderEventStaffSalary();
    } else if (tabId === 'lead-bowls') {
        renderLeadBowls();
    } else if (tabId === 'customers') {
        renderCustomersList();
    } else if (tabId === 'settings') {
        loadStaffPasswordStatus();
        renderAdminAccountsList();
        refreshAdminNotifyUI();
        renderMuhurthamDatesList();
        loadReviewSettingsInForm();
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
    const leadSource = document.getElementById('lead-source').value;
    const referredBy = leadSource === 'Referral' ? document.getElementById('referred-by').value.trim() : '';
    const address = document.getElementById('client-address').value.trim();
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
            appState.events[index].leadSource = leadSource;
            appState.events[index].referredBy = referredBy;
            appState.events[index].address = address;
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
            leadSource,
            referredBy,
            address,
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
    document.getElementById('lead-source').value = event.leadSource || '';
    document.getElementById('referred-by').value = event.referredBy || '';
    toggleReferredByField();
    document.getElementById('client-address').value = event.address || '';
    document.getElementById('event-venue').value = event.venue || '';
    document.getElementById('event-date').value = event.eventDate;
    document.getElementById('service-type').value = event.serviceType;
    document.getElementById('event-budget').value = event.budget;
    document.getElementById('event-held-completed').checked = event.heldCompleted || false;
    document.getElementById('event-notes').value = event.notes || '';

    openModal('add-event-modal');
}

async function deleteEvent(eventId) {
    if (confirm('Are you sure you want to delete this event/inquiry? All associated billing logs will be lost permanently.')) {
        const event = appState.events.find(item => String(item.id) === String(eventId));
        const previousEvents = cloneDocumentData(appState.events);
        const storedPaths = (event?.documents || []).map(record => record.path).filter(Boolean);
        appState.events = appState.events.filter(e => e.id !== eventId);
        if (currentQuotationEventId === eventId) currentQuotationEventId = null;
        if (currentInvoiceEventId === eventId) currentInvoiceEventId = null;
        const saved = await saveState();
        if (!saved) {
            appState.events = previousEvents;
            showToast('Event could not be deleted. Please try again.');
            refreshAllViews();
            return;
        }
        if (storedPaths.length) {
            const { error } = await sb.storage.from(EVENT_DOCUMENTS_BUCKET).remove(storedPaths);
            if (error) console.error('Deleted event file cleanup failed', error);
        }
        if (currentAdminEmail) {
            const { error: financeDeleteError } = await sb.from('event_finance_entries').delete().eq('event_id', String(eventId));
            if (financeDeleteError) console.error('Deleted event finance cleanup failed', financeDeleteError);
            adminFinanceEntries = adminFinanceEntries.filter(entry => String(entry.eventId) !== String(eventId));
        }
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
    const container = document.getElementById('events-grouped-list');
    const filters = document.getElementById('event-stage-filters');
    if (!container || !filters) return;

    const query = (document.getElementById('event-search')?.value || '').trim().toLowerCase();
    const stageFilters = [{ key: 'all', label: 'All Events', icon: 'fa-layer-group' }, ...STAGE_DEFS.map(stage => ({
        ...stage,
        label: stage.key === 'advance-paid' ? 'Confirmed / Booked' : stage.label
    }))];

    filters.innerHTML = stageFilters.map(stage => {
        const count = stage.key === 'all' ? appState.events.length : appState.events.filter(evt => evt.status === stage.key).length;
        return `<button class="event-stage-filter stage-tone-${stage.key} ${currentEventStageFilter === stage.key ? 'active' : ''}"
                    onclick="setEventStageFilter('${stage.key}')" aria-pressed="${currentEventStageFilter === stage.key}">
                    <span class="stage-filter-label"><i class="fa-solid ${stage.icon || getStageIcon(stage.key)}"></i> ${escapeDocumentText(stage.label)}</span>
                    <strong>${count}</strong>
                </button>`;
    }).join('');

    const visibleEvents = appState.events.filter(evt => {
        const matchesStage = currentEventStageFilter === 'all' || evt.status === currentEventStageFilter;
        const searchText = [evt.clientName, evt.clientPhone, evt.serviceType, evt.venue, evt.eventDate, evt.createdDate]
            .filter(Boolean).join(' ').toLowerCase();
        return matchesStage && (!query || searchText.includes(query));
    });

    if (visibleEvents.length === 0) {
        container.innerHTML = '<div class="events-empty-state"><i class="fa-regular fa-calendar-xmark"></i><h3>No matching events</h3><p>Try another stage or search word.</p></div>';
        return;
    }

    const dateFor = evt => currentEventDateView === 'received' ? (evt.createdDate || evt.eventDate) : evt.eventDate;
    visibleEvents.sort((a, b) => {
        const dateDiff = new Date(dateFor(a)) - new Date(dateFor(b));
        return dateDiff || String(a.clientName).localeCompare(String(b.clientName));
    });

    const groups = new Map();
    visibleEvents.forEach(evt => {
        const dateKey = dateFor(evt) || 'Date not set';
        if (!groups.has(dateKey)) groups.set(dateKey, []);
        groups.get(dateKey).push(evt);
    });

    container.innerHTML = [...groups.entries()].map(([date, events]) => `
        <section class="event-date-group">
            <header class="event-date-heading">
                <div><i class="fa-regular fa-calendar"></i><strong>${date === 'Date not set' ? date : formatDisplayDate(date)}</strong></div>
                <span>${events.length} ${events.length === 1 ? 'record' : 'records'}</span>
            </header>
            <div class="event-card-list">${events.map(renderEventSummaryCard).join('')}</div>
        </section>`).join('');
}

function filterEvents() {
    renderEventsList();
}

function getStageIcon(stageKey) {
    const icons = {
        enquiry: 'fa-comments', quotation: 'fa-file-signature', 'advance-paid': 'fa-calendar-check',
        'event-completed': 'fa-flag-checkered', 'pending-bill': 'fa-hourglass-half',
        'completed-bill': 'fa-circle-check', delivered: 'fa-box-open'
    };
    return icons[stageKey] || 'fa-circle';
}

function setEventStageFilter(stageKey) {
    currentEventStageFilter = stageKey;
    renderEventsList();
}

function setEventDateView(view) {
    currentEventDateView = view;
    document.querySelectorAll('.date-view-btn').forEach(button => button.classList.toggle('active', button.dataset.dateView === view));
    renderEventsList();
}

function renderEventSummaryCard(evt) {
    const calculations = getEventInvoiceCalculations(evt);
    const nextStage = getNextStageForEvent(evt);
    const amount = calculations.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const receivedDate = evt.createdDate ? formatDisplayDate(evt.createdDate) : 'Not recorded';
    const documentCount = Array.isArray(evt.documents) ? evt.documents.length : 0;
    const financeCount = getEventFinanceEntries(evt.id).length;
    const isBookedEvent = getStageIndex(evt.status) >= getStageIndex('advance-paid');

    return `<article class="event-summary-card stage-card-${evt.status}">
        <div class="event-card-main">
            <div class="event-customer">
                <span class="badge badge-${evt.status}">${escapeDocumentText(getStageLabel(evt.status))}</span>
                <h3>${escapeDocumentText(evt.clientName || 'Unnamed customer')}</h3>
                <a href="tel:${escapeDocumentText(evt.clientPhone || '')}"><i class="fa-solid fa-phone"></i> ${escapeDocumentText(evt.clientPhone || 'No phone')}</a>
            </div>
            <div class="event-card-detail"><span>Service / Venue</span><strong>${escapeDocumentText(evt.serviceType || 'Not specified')}</strong><small>${escapeDocumentText(evt.venue || 'Venue not added')}</small></div>
            <div class="event-card-detail"><span>Event date</span><strong>${escapeDocumentText(formatDisplayDate(evt.eventDate))}</strong></div>
            <div class="event-card-detail"><span>Enquiry received</span><strong>${escapeDocumentText(receivedDate)}</strong></div>
            <div class="event-card-amount"><span>Total</span><strong>₹${amount}</strong></div>
        </div>
        <div class="event-card-footer">
            <div class="event-primary-actions">
                <button class="event-action-btn" onclick="openEditEventModal('${evt.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="event-action-btn quotation-action" onclick="startQuotationForEvent('${evt.id}')"><i class="fa-solid fa-file-signature"></i> Open quotation</button>
                <button class="event-action-btn" onclick="startBillingForEvent('${evt.id}')"><i class="fa-solid fa-file-invoice-dollar"></i> Billing</button>
                ${isBookedEvent ? `<button class="event-action-btn event-documents-action" onclick="openEventDocuments('${evt.id}')"><i class="fa-solid fa-folder-open"></i> Documents${documentCount ? ` (${documentCount})` : ''}</button>` : ''}
                ${isBookedEvent && currentAdminEmail ? `<button class="event-action-btn event-expenses-action" onclick="openEventExpenses('${evt.id}')"><i class="fa-solid fa-lock"></i> Expenses${financeCount ? ` (${financeCount})` : ''}</button>` : ''}
            </div>
            <div class="event-progress-action">
                ${evt.status === 'quotation' ? `<label class="without-advance-toggle compact" onclick="event.stopPropagation()">
                    <input type="checkbox" ${evt.confirmedWithoutAdvance ? 'checked' : ''} onchange="setWithoutAdvanceConfirmation('${evt.id}', this.checked)">
                    <span>Confirm without advance</span>
                </label>` : ''}
                ${evt.delivered || !nextStage
                    ? '<span class="event-delivered"><i class="fa-solid fa-circle-check"></i> Delivered</span>'
                    : `<button class="btn event-approve-btn" onclick="advanceEventStage('${evt.id}')"><i class="fa-solid fa-check"></i> Move to ${escapeDocumentText(nextStage.label)}</button>`}
                <button class="action-icon-btn danger" onclick="deleteEvent('${evt.id}')" title="Delete event" aria-label="Delete event"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    </article>`;
}

// ==========================================
// 4A. BOOKED EVENT DOCUMENTS & PDF REPORT
// ==========================================

function getCurrentEventDocumentsEvent() {
    return appState.events.find(event => String(event.id) === String(currentEventDocumentsEventId));
}

function createStableEventDocumentServiceId(description, index) {
    const signature = `${index}|${String(description || '').trim().toLowerCase()}`;
    let hash = 2166136261;
    for (let position = 0; position < signature.length; position += 1) {
        hash ^= signature.charCodeAt(position);
        hash = Math.imul(hash, 16777619);
    }
    return `service_${index}_${(hash >>> 0).toString(36)}`;
}

function getEventDocumentServiceItems(event) {
    const quotation = getQuotationDocument(event);
    let items = quotation.items || [];
    if (!items.length && event.serviceType) {
        quotation.items = [{ desc: event.serviceType, rate: 0, qty: 1, subItems: [] }];
        items = quotation.items;
    }
    return items.map((item, index) => {
        const description = item.desc || event.serviceType || `Event Service ${index + 1}`;
        if (!item.documentServiceId) {
            // A deterministic ID survives dashboard auto-sync even before the
            // first upload/save persists it to Supabase.
            item.documentServiceId = createStableEventDocumentServiceId(description, index);
        }
        const rate = Number(item.rate) || 0;
        const qty = Math.max(1, Number(item.qty) || 1);
        return {
            key: item.documentServiceId,
            description,
            subItems: Array.isArray(item.subItems) ? item.subItems.map(getSubItemDescription).filter(Boolean) : [],
            rate,
            qty,
            total: getDocumentItemTotal(item)
        };
    });
}

function getCurrentEventDocumentService(event = getCurrentEventDocumentsEvent()) {
    if (!event) return null;
    const services = getEventDocumentServiceItems(event);
    let service = currentEventDocumentServiceKey
        ? services.find(item => item.key === currentEventDocumentServiceKey) || null
        : null;

    // If an auto-sync replaced an older unsaved random ID, keep the visibly
    // selected dropdown service by its stable quotation position.
    if (!service) {
        const selector = document.getElementById('event-document-service-select');
        const selectedOption = selector?.selectedOptions?.[0];
        const serviceIndex = Number(selectedOption?.dataset?.serviceIndex);
        if (Number.isInteger(serviceIndex) && serviceIndex >= 0) {
            service = services[serviceIndex] || null;
            if (service) {
                currentEventDocumentServiceKey = service.key;
                selectedOption.value = service.key;
                selector.value = service.key;
            }
        }
    }
    return service;
}

function getSelectedEventDocumentRecords(event = getCurrentEventDocumentsEvent()) {
    const service = getCurrentEventDocumentService(event);
    if (!event || !service) return [];
    const services = getEventDocumentServiceItems(event);
    const selectedServiceName = String(service.description || '').trim().toLowerCase();
    return (event.documents || []).filter(record => {
        if (record.serviceKey === service.key) return true;
        // Older uploads may carry a previous service ID after quotation sync,
        // but their saved service name still identifies the correct service.
        if (record.serviceName && String(record.serviceName).trim().toLowerCase() === selectedServiceName) return true;
        if (record.serviceKey) return false;
        // Preserve access to uploads created before service-wise documents when
        // the quotation contains only one service. Multi-service legacy files
        // stay untouched instead of being assigned to the wrong service.
        return services.length === 1;
    });
}

function getEventDocumentServiceNotes(event, service) {
    if (!event || !service) return '';
    const savedNotes = event.documentServiceNotes?.[service.key];
    if (typeof savedNotes === 'string') return savedNotes;
    return getEventDocumentServiceItems(event).length === 1 ? (event.documentNotes || '') : '';
}

async function openEventDocuments(eventId) {
    const event = appState.events.find(item => String(item.id) === String(eventId));
    if (!event) return;
    if (getStageIndex(event.status) < getStageIndex('advance-paid')) {
        showToast('Event documents are available after the event is confirmed/booked.');
        return;
    }

    currentEventDocumentsEventId = event.id;
    currentEventDocumentServiceKey = '';
    if (!Array.isArray(event.documents)) event.documents = [];
    if (!event.documentServiceNotes || typeof event.documentServiceNotes !== 'object' || Array.isArray(event.documentServiceNotes)) event.documentServiceNotes = {};
    document.getElementById('event-documents-event-id').value = event.id;
    document.getElementById('event-document-files').value = '';
    document.getElementById('event-document-upload-status').classList.add('hidden');
    const services = getEventDocumentServiceItems(event);
    const selector = document.getElementById('event-document-service-select');
    selector.innerHTML = '<option value="">-- Choose a quotation service --</option>' + services.map((service, index) =>
        `<option value="${escapeDocumentText(service.key)}" data-service-index="${index}">${escapeDocumentText(service.description)}</option>`
    ).join('');
    if (services.length === 1) {
        currentEventDocumentServiceKey = services[0].key;
        selector.value = services[0].key;
    }
    openModal('event-documents-modal');
    await changeEventDocumentService();
}

async function changeEventDocumentService() {
    const event = getCurrentEventDocumentsEvent();
    const selector = document.getElementById('event-document-service-select');
    if (!event || !selector) return;
    currentEventDocumentServiceKey = selector.value;
    const service = getCurrentEventDocumentService(event);
    document.getElementById('event-document-notes').value = getEventDocumentServiceNotes(event, service);
    document.getElementById('event-document-files').value = '';
    document.getElementById('event-document-upload-status').classList.add('hidden');
    document.getElementById('event-documents-summary').innerHTML = renderEventDocumentsSummary(event, service);
    await renderEventDocumentList(event);
}

function renderEventDocumentsSummary(event, service) {
    if (!service) {
        return '<div class="event-document-empty"><i class="fa-solid fa-hand-pointer"></i><p>Select one quotation service above. Only that service details, notes and images will be used.</p></div>';
    }
    return `<div class="event-document-summary-title">
            <div><span>Event Date</span><strong>${escapeDocumentText(formatDisplayDate(event.eventDate))}</strong></div>
            <div><span>Customer</span><strong>${escapeDocumentText(event.clientName || 'Not added')}</strong></div>
            <div><span>Venue</span><strong>${escapeDocumentText(event.venue || 'Not added')}</strong></div>
            <div><span>Work Items</span><strong>${service.subItems.length}</strong></div>
        </div>
        <div class="event-document-service-summary"><span>Selected Quotation Service</span><div>
            <strong>${escapeDocumentText(service.description)}${service.subItems.length ? `<small>${service.subItems.map(escapeDocumentText).join(' · ')}</small>` : '<small>No sub-service details added.</small>'}</strong>
        </div></div>`;
}

function setEventDocumentUploadStatus(message, isError = false) {
    const status = document.getElementById('event-document-upload-status');
    status.textContent = message;
    status.classList.remove('hidden', 'error');
    if (isError) status.classList.add('error');
}

function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('File could not be read.'));
        reader.readAsDataURL(blob);
    });
}

function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Image could not be opened.'));
        image.src = dataUrl;
    });
}

async function prepareEventDocumentImage(file) {
    const source = await readBlobAsDataUrl(file);
    const image = await loadImageFromDataUrl(source);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) throw new Error('Image compression failed.');
    const baseName = String(file.name || 'event-image').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

function safeEventDocumentFileName(name) {
    const cleaned = String(name || 'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
    return cleaned.replace(/^[-.]+|[-.]+$/g, '').slice(-100) || 'file';
}

async function uploadEventDocuments() {
    const event = getCurrentEventDocumentsEvent();
    const service = getCurrentEventDocumentService(event);
    const input = document.getElementById('event-document-files');
    const files = [...(input.files || [])];
    if (!event || !service) {
        showToast('Choose a quotation service first.');
        return;
    }
    if (files.length === 0) {
        showToast('Choose one or more images/PDF files first.');
        return;
    }
    if (getSelectedEventDocumentRecords(event).length + files.length > 12) {
        showToast('Maximum 12 uploaded files are allowed for one service.');
        return;
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    const uploadButton = document.getElementById('event-document-upload-btn');
    uploadButton.disabled = true;
    const uploadedRecords = [];
    const problems = [];

    try {
        for (let index = 0; index < files.length; index += 1) {
            const originalFile = files[index];
            setEventDocumentUploadStatus(`Uploading ${index + 1} of ${files.length}: ${originalFile.name}`);
            if (!allowedTypes.has(originalFile.type)) {
                problems.push(`${originalFile.name}: unsupported file type`);
                continue;
            }
            if (originalFile.size > 10 * 1024 * 1024) {
                problems.push(`${originalFile.name}: file is larger than 10 MB`);
                continue;
            }

            const preparedFile = originalFile.type.startsWith('image/')
                ? await prepareEventDocumentImage(originalFile)
                : originalFile;
            if (preparedFile.size > 5 * 1024 * 1024) {
                problems.push(`${originalFile.name}: compressed file is still larger than 5 MB`);
                continue;
            }

            const documentId = `edoc_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
            const storagePath = `${event.id}/${safeEventDocumentFileName(service.key)}/${documentId}-${safeEventDocumentFileName(preparedFile.name)}`;
            const { error } = await sb.storage.from(EVENT_DOCUMENTS_BUCKET).upload(storagePath, preparedFile, {
                contentType: preparedFile.type,
                upsert: false
            });
            if (error) {
                console.error('Event document upload failed', error);
                problems.push(`${originalFile.name}: upload failed`);
                continue;
            }
            uploadedRecords.push({
                id: documentId,
                name: originalFile.name,
                path: storagePath,
                type: preparedFile.type,
                size: preparedFile.size,
                serviceKey: service.key,
                serviceName: service.description,
                uploadedAt: new Date().toISOString()
            });
        }

        if (uploadedRecords.length) {
            event.documents = [...(event.documents || []), ...uploadedRecords];
            event.documentsUpdatedAt = new Date().toISOString();
            const saved = await saveState();
            if (!saved) {
                event.documents = (event.documents || []).filter(record => !uploadedRecords.some(uploaded => uploaded.id === record.id));
                await sb.storage.from(EVENT_DOCUMENTS_BUCKET).remove(uploadedRecords.map(record => record.path));
                throw new Error('Uploaded file details could not be saved.');
            }
        }

        input.value = '';
        setEventDocumentUploadStatus(
            `${uploadedRecords.length} file${uploadedRecords.length === 1 ? '' : 's'} uploaded.${problems.length ? ` ${problems.length} file(s) skipped.` : ''}`,
            uploadedRecords.length === 0
        );
        if (problems.length) console.warn('Skipped event documents:', problems);
        await renderEventDocumentList(event);
        renderEventsList();
    } catch (error) {
        console.error('Event documents upload error', error);
        setEventDocumentUploadStatus(error.message || 'Files could not be uploaded.', true);
    } finally {
        uploadButton.disabled = false;
    }
}

async function renderEventDocumentList(event = getCurrentEventDocumentsEvent()) {
    const container = document.getElementById('event-document-list');
    const count = document.getElementById('event-document-count');
    if (!container || !count || !event) return;
    const service = getCurrentEventDocumentService(event);
    if (!service) {
        count.textContent = '0 files';
        container.innerHTML = '<div class="event-document-empty"><i class="fa-solid fa-hand-pointer"></i><p>Choose a quotation service to view its files.</p></div>';
        return;
    }
    const records = getSelectedEventDocumentRecords(event);
    count.textContent = `${records.length} ${records.length === 1 ? 'file' : 'files'}`;
    if (!records.length) {
        container.innerHTML = `<div class="event-document-empty"><i class="fa-regular fa-folder-open"></i><p>No images or PDFs uploaded for ${escapeDocumentText(service.description)}.</p></div>`;
        return;
    }

    container.innerHTML = records.map(record => `<article class="event-document-file-card" id="event-document-card-${record.id}">
        <div class="event-document-preview loading"><i class="fa-solid fa-spinner fa-spin"></i></div>
        <div class="event-document-file-info"><strong>${escapeDocumentText(record.name)}</strong><span>${escapeDocumentText(record.type === 'application/pdf' ? 'PDF Document' : 'Event Image')} · ${formatEventDocumentSize(record.size)}</span></div>
        <div class="event-document-file-actions">
            <button type="button" onclick="downloadEventDocument('${record.id}')" title="Download file" aria-label="Download ${escapeDocumentText(record.name)}"><i class="fa-solid fa-download"></i><span>Download</span></button>
            <button type="button" class="danger" onclick="deleteEventDocument('${record.id}')" title="Delete file" aria-label="Delete ${escapeDocumentText(record.name)}"><i class="fa-solid fa-trash"></i><span>Delete</span></button>
        </div>
    </article>`).join('');

    await Promise.all(records.map(async record => {
        const card = document.getElementById(`event-document-card-${record.id}`);
        if (!card || currentEventDocumentsEventId !== event.id) return;
        const preview = card.querySelector('.event-document-preview');
        if (record.type === 'application/pdf') {
            preview.className = 'event-document-preview pdf';
            preview.innerHTML = '<i class="fa-solid fa-file-pdf"></i>';
            return;
        }
        const { data, error } = await sb.storage.from(EVENT_DOCUMENTS_BUCKET).createSignedUrl(record.path, 3600);
        if (error || !data?.signedUrl) {
            preview.className = 'event-document-preview error';
            preview.innerHTML = '<i class="fa-solid fa-image"></i>';
            return;
        }
        preview.className = 'event-document-preview image';
        preview.innerHTML = `<img src="${escapeDocumentText(data.signedUrl)}" alt="${escapeDocumentText(record.name)}">`;
    }));
}

function formatEventDocumentSize(bytes) {
    const size = Number(bytes) || 0;
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(size / 1024))} KB`;
}

async function saveEventDocumentNotes(silent = false) {
    const event = getCurrentEventDocumentsEvent();
    const service = getCurrentEventDocumentService(event);
    if (!event || !service) {
        if (!silent) showToast('Choose a quotation service first.');
        return false;
    }
    const notes = document.getElementById('event-document-notes').value.trim();
    if (!event.documentServiceNotes || typeof event.documentServiceNotes !== 'object' || Array.isArray(event.documentServiceNotes)) event.documentServiceNotes = {};
    const previousNotes = event.documentServiceNotes[service.key];
    if (notes === (previousNotes || '')) return true;
    event.documentServiceNotes[service.key] = notes;
    event.documentsUpdatedAt = new Date().toISOString();
    const saved = await saveState();
    if (!saved) {
        if (typeof previousNotes === 'undefined') delete event.documentServiceNotes[service.key];
        else event.documentServiceNotes[service.key] = previousNotes;
        if (!silent) showToast('Event notes could not be saved. Please try again.');
        return false;
    }
    if (!silent) showToast(`${service.description} notes saved.`);
    return true;
}

async function downloadEventDocument(documentId) {
    const event = getCurrentEventDocumentsEvent();
    const record = getSelectedEventDocumentRecords(event).find(item => String(item.id) === String(documentId));
    if (!record) return;
    const { data, error } = await sb.storage.from(EVENT_DOCUMENTS_BUCKET).download(record.path);
    if (error || !data) {
        console.error('Event document download failed', error);
        showToast('File could not be downloaded.');
        return;
    }
    downloadBlob(data, record.name || 'event-file');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function deleteEventDocument(documentId) {
    const event = getCurrentEventDocumentsEvent();
    const service = getCurrentEventDocumentService(event);
    const record = getSelectedEventDocumentRecords(event).find(item => String(item.id) === String(documentId));
    if (!event || !service || !record || !confirm(`Delete "${record.name}" from ${service.description}? This file cannot be recovered.`)) return;
    const previousDocuments = cloneDocumentData(event.documents || []);
    event.documents = previousDocuments.filter(item => String(item.id) !== String(documentId));
    event.documentsUpdatedAt = new Date().toISOString();
    const saved = await saveState();
    if (!saved) {
        event.documents = previousDocuments;
        showToast('File details could not be deleted. Please try again.');
        return;
    }
    const { error } = await sb.storage.from(EVENT_DOCUMENTS_BUCKET).remove([record.path]);
    if (error) console.error('Stored event file cleanup failed', error);
    showToast(`${record.name} deleted from ${service.description}.`);
    await renderEventDocumentList(event);
    renderEventsList();
}

async function getEventDocumentImageData(record) {
    let { data, error } = await sb.storage.from(EVENT_DOCUMENTS_BUCKET).download(record.path);
    if (error || !data) {
        const signed = await sb.storage.from(EVENT_DOCUMENTS_BUCKET).createSignedUrl(record.path, 300);
        if (signed.error || !signed.data?.signedUrl) throw error || signed.error || new Error('Image download failed.');
        const response = await fetch(signed.data.signedUrl);
        if (!response.ok) throw new Error(`Image download failed (${response.status}).`);
        data = await response.blob();
    }
    const inferredType = inferEventDocumentImageType(record);
    const normalizedBlob = data.type?.startsWith('image/') ? data : data.slice(0, data.size, inferredType);
    return readBlobAsDataUrl(normalizedBlob);
}

function inferEventDocumentImageType(record) {
    const name = String(record?.name || record?.path || '').toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
}

function isEventDocumentImage(record) {
    const type = String(record?.type || '').toLowerCase();
    const name = String(record?.name || record?.path || '').toLowerCase();
    return type.startsWith('image/') || /\.(jpe?g|png|webp)$/.test(name);
}

function isEventDocumentPdf(record) {
    const type = String(record?.type || '').toLowerCase();
    const name = String(record?.name || record?.path || '').toLowerCase();
    return type === 'application/pdf' || name.endsWith('.pdf');
}

function eventDocumentReportMarkup(event, service, selectedRecords, imageCount) {
    const pdfRecords = selectedRecords.filter(isEventDocumentPdf);
    const serviceNotes = getEventDocumentServiceNotes(event, service);
    return `<div class="event-pdf-header"><div><span>DD</span><h1>DD Events</h1></div><p>Selected Service Details</p></div>
        <div class="event-pdf-title"><h2>${escapeDocumentText(service.description)}</h2><strong>${escapeDocumentText(formatDisplayDate(event.eventDate))}</strong></div>
        <div class="event-pdf-basic-grid">
            <div><span>Customer</span><strong>${escapeDocumentText(event.clientName || '-')}</strong></div>
            <div><span>Phone</span><strong>${escapeDocumentText(event.clientPhone || '-')}</strong></div>
            <div><span>Venue</span><strong>${escapeDocumentText(event.venue || '-')}</strong></div>
            <div><span>Event Date</span><strong>${escapeDocumentText(formatDisplayDate(event.eventDate))}</strong></div>
            <div><span>Included Images</span><strong>${imageCount}</strong></div>
        </div>
        <section><h3>Selected Service Work Details</h3><div class="event-pdf-services"><div>
            <strong>${escapeDocumentText(service.description)}</strong>
            ${service.subItems.length ? `<ul>${service.subItems.map(item => `<li>${escapeDocumentText(item)}</li>`).join('')}</ul>` : '<small>No sub-service details added.</small>'}
        </div></div></section>
        <section><h3>${escapeDocumentText(service.description)} Notes</h3><p>${escapeDocumentText(serviceNotes || 'No notes added for this service.').replace(/\n/g, '<br>')}</p></section>
        ${pdfRecords.length ? `<section><h3>Uploaded PDF Attachments</h3><ul class="event-pdf-attachments">${pdfRecords.map(record => `<li>${escapeDocumentText(record.name)} (${formatEventDocumentSize(record.size)})</li>`).join('')}</ul><small>These attachments can be downloaded individually from the Event Documents panel.</small></section>` : ''}
        <div class="event-pdf-footer-text">Generated from DD Events Dashboard on ${escapeDocumentText(new Date().toLocaleDateString('en-IN'))}</div>`;
}

async function addEventDocumentImagePage(pdf, imageRecord, service, pageNumber, totalPages, imageNumber, totalImages) {
    const image = await loadImageFromDataUrl(imageRecord.dataUrl);
    const pageWidth = 210;
    const pageHeight = 297;
    const sideMargin = 10;
    const imageTop = 23;
    const imageBottom = 278;
    const availableWidth = pageWidth - (sideMargin * 2);
    const availableHeight = imageBottom - imageTop;
    const widthScale = availableWidth / image.naturalWidth;
    const heightScale = availableHeight / image.naturalHeight;
    const scale = Math.min(widthScale, heightScale);
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    const imageX = (pageWidth - imageWidth) / 2;
    const imageY = imageTop + ((availableHeight - imageHeight) / 2);
    const imageFormat = String(imageRecord.dataUrl).startsWith('data:image/png') ? 'PNG' : 'JPEG';

    pdf.addPage();
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(90, 24, 154);
    pdf.text(`${service.description} | Image ${imageNumber} of ${totalImages}`, sideMargin, 13);
    pdf.setDrawColor(231, 215, 245);
    pdf.setLineWidth(0.35);
    pdf.rect(imageX, imageY, imageWidth, imageHeight);
    pdf.addImage(imageRecord.dataUrl, imageFormat, imageX, imageY, imageWidth, imageHeight, undefined, 'FAST');

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 289, pageWidth, 8, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(90, 24, 154);
    pdf.text(`DD Events | Page ${pageNumber} of ${totalPages}`, pageWidth / 2, 294, { align: 'center' });
}

async function downloadEventDetailsPdf() {
    const event = getCurrentEventDocumentsEvent();
    const service = getCurrentEventDocumentService(event);
    if (!event || !service) {
        showToast('Choose a quotation service first.');
        return;
    }
    if (!window.jspdf?.jsPDF || typeof html2canvas !== 'function') {
        showToast('PDF generator is not available. Check internet and try again.');
        return;
    }

    const button = document.getElementById('event-document-pdf-btn');
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing PDF...';
    let reportElement;
    try {
        const notesSaved = await saveEventDocumentNotes(true);
        if (!notesSaved) throw new Error('Notes could not be saved before PDF creation.');
        const selectedRecords = getSelectedEventDocumentRecords(event);
        const imageFiles = selectedRecords.filter(isEventDocumentImage);
        const imageRecords = [];
        const failedImages = [];
        for (const record of imageFiles) {
            try {
                imageRecords.push({ ...record, dataUrl: await getEventDocumentImageData(record) });
            } catch (error) {
                console.error('Event image could not be loaded for PDF', record.path, error);
                failedImages.push(record.name || 'image');
            }
        }
        if (failedImages.length) {
            throw new Error(`${failedImages.length} uploaded image${failedImages.length === 1 ? '' : 's'} could not be loaded. Please reopen Documents and try again.`);
        }

        reportElement = document.createElement('div');
        reportElement.className = 'event-pdf-report';
        reportElement.innerHTML = eventDocumentReportMarkup(event, service, selectedRecords, imageRecords.length);
        document.body.appendChild(reportElement);
        const canvas = await html2canvas(reportElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 794
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 7;
        const contentWidth = pageWidth - (margin * 2);
        const contentHeight = pageHeight - 15;
        const renderedHeight = canvas.height * contentWidth / canvas.width;
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        const detailPageCount = Math.max(1, Math.ceil(renderedHeight / contentHeight));
        const totalPageCount = detailPageCount + imageRecords.length;
        for (let page = 0; page < detailPageCount; page += 1) {
            if (page > 0) pdf.addPage();
            pdf.addImage(imageData, 'JPEG', margin, margin - (page * contentHeight), contentWidth, renderedHeight, undefined, 'FAST');
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 289, pageWidth, 8, 'F');
            pdf.setFontSize(8);
            pdf.setTextColor(90, 24, 154);
            pdf.text(`DD Events | Page ${page + 1} of ${totalPageCount}`, pageWidth / 2, 294, { align: 'center' });
        }
        for (let index = 0; index < imageRecords.length; index += 1) {
            await addEventDocumentImagePage(
                pdf,
                imageRecords[index],
                service,
                detailPageCount + index + 1,
                totalPageCount,
                index + 1,
                imageRecords.length
            );
        }
        const safeClientName = safeEventDocumentFileName(event.clientName || 'event');
        const safeServiceName = safeEventDocumentFileName(service.description || 'service');
        pdf.save(`DD-Events-${event.eventDate || 'date'}-${safeClientName}-${safeServiceName}.pdf`);
        showToast(`${service.description} PDF downloaded.`);
    } catch (error) {
        console.error('Event PDF generation failed', error);
        showToast(error.message || 'Event PDF could not be created.');
    } finally {
        reportElement?.remove();
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Download Service PDF';
    }
}

// ==========================================
// 4B. ADMIN-ONLY EVENT FINANCE
// ==========================================

function getCurrentEventFinanceEvent() {
    return appState.events.find(event => String(event.id) === String(currentEventFinanceEventId));
}

function formatFinanceAmount(value) {
    return `₹${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function openEventExpenses(eventId) {
    if (!currentAdminEmail) {
        showToast('Only an admin can view event expenses.');
        return;
    }
    const event = appState.events.find(item => String(item.id) === String(eventId));
    if (!event) return;
    if (getStageIndex(event.status) < getStageIndex('advance-paid')) {
        showToast('Expenses are available after the event is confirmed/booked.');
        return;
    }

    currentEventFinanceEventId = event.id;
    await loadAdminFinanceEntries(true);
    const services = getEventDocumentServiceItems(event);
    const selector = document.getElementById('event-finance-service');
    selector.innerHTML = services.map(service => `<option value="${escapeDocumentText(service.key)}">${escapeDocumentText(service.description)}</option>`).join('');
    if (!services.length) selector.innerHTML = '<option value="general">General Event Cost</option>';
    document.getElementById('event-finance-entry-form').reset();
    selector.value = services[0]?.key || 'general';
    renderEventFinanceModal();
    openModal('event-expenses-modal');
}

function renderEventFinanceModal() {
    const event = getCurrentEventFinanceEvent();
    const summary = document.getElementById('event-finance-summary');
    const list = document.getElementById('event-finance-entry-list');
    const count = document.getElementById('event-finance-entry-count');
    if (!event || !summary || !list || !count) return;

    const entries = getEventFinanceEntries(event.id);
    const totals = getEventFinanceTotals(event);
    const totalInternalCost = totals.expenses + totals.investments;
    summary.innerHTML = `
        <div class="event-finance-event-title"><div><span>Event</span><strong>${escapeDocumentText(event.clientName || 'Unnamed customer')}</strong></div><div><span>Date</span><strong>${escapeDocumentText(formatDisplayDate(event.eventDate))}</strong></div></div>
        <div class="event-finance-total-grid">
            <div><span>Client Total</span><strong>${formatFinanceAmount(totals.revenue)}</strong></div>
            <div class="expense"><span>Expenses</span><strong>${formatFinanceAmount(totals.expenses)}</strong></div>
            <div class="investment"><span>Investment</span><strong>${formatFinanceAmount(totals.investments)}</strong></div>
            <div><span>Labor (in expenses)</span><strong>${formatFinanceAmount(totals.labor)}</strong></div>
            <div><span>Total Internal Cost</span><strong>${formatFinanceAmount(totalInternalCost)}</strong></div>
            <div class="${totals.profit < 0 ? 'loss' : 'profit'}"><span>${totals.profit < 0 ? 'Loss' : 'Estimated Profit'}</span><strong>${formatFinanceAmount(Math.abs(totals.profit))}</strong></div>
        </div>`;

    count.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    if (!entries.length) {
        list.innerHTML = '<div class="event-finance-empty"><i class="fa-solid fa-receipt"></i><p>No internal expenses or investments added for this event.</p></div>';
        return;
    }

    const grouped = new Map();
    entries.forEach(entry => {
        const groupKey = entry.serviceName || 'General Event Cost';
        if (!grouped.has(groupKey)) grouped.set(groupKey, []);
        grouped.get(groupKey).push(entry);
    });
    list.innerHTML = [...grouped.entries()].map(([serviceName, serviceEntries]) => {
        const serviceExpense = serviceEntries.filter(entry => entry.entryType === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
        const serviceInvestment = serviceEntries.filter(entry => entry.entryType === 'investment').reduce((sum, entry) => sum + entry.amount, 0);
        return `<section class="event-finance-service-group">
            <header><div><i class="fa-solid fa-briefcase"></i><strong>${escapeDocumentText(serviceName)}</strong></div><span>E ${formatFinanceAmount(serviceExpense)} · I ${formatFinanceAmount(serviceInvestment)}</span></header>
            <div>${serviceEntries.map(entry => `<article class="event-finance-entry-row">
                <div class="event-finance-entry-main"><span class="event-finance-kind ${entry.entryType}">${escapeDocumentText(entry.entryType)}</span><strong>${escapeDocumentText(entry.category)}</strong>${entry.notes ? `<p>${escapeDocumentText(entry.notes)}</p>` : ''}<small>${entry.createdAt ? escapeDocumentText(new Date(entry.createdAt).toLocaleString('en-IN')) : ''}${entry.createdBy ? ` · ${escapeDocumentText(entry.createdBy)}` : ''}</small></div>
                <strong class="event-finance-entry-amount">${formatFinanceAmount(entry.amount)}</strong>
                <button type="button" class="event-finance-delete" onclick="deleteEventFinanceEntry('${entry.id}')" title="Delete entry" aria-label="Delete finance entry"><i class="fa-solid fa-trash"></i></button>
            </article>`).join('')}</div>
        </section>`;
    }).join('');
}

async function addEventFinanceEntry(submitEvent) {
    submitEvent.preventDefault();
    if (!currentAdminEmail) {
        showToast('Only an admin can add event expenses.');
        return;
    }
    const event = getCurrentEventFinanceEvent();
    if (!event) return;
    const serviceKey = document.getElementById('event-finance-service').value;
    const services = getEventDocumentServiceItems(event);
    const service = services.find(item => item.key === serviceKey);
    const entryType = document.getElementById('event-finance-type').value;
    const category = document.getElementById('event-finance-category').value;
    const amount = Number(document.getElementById('event-finance-amount').value);
    const notes = document.getElementById('event-finance-notes').value.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
        showToast('Enter a valid amount greater than zero.');
        return;
    }

    const button = document.getElementById('event-finance-add-btn');
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    const payload = {
        event_id: String(event.id),
        entry_type: entryType === 'investment' ? 'investment' : 'expense',
        service_key: service?.key || 'general',
        service_name: service?.description || 'General Event Cost',
        category,
        amount,
        notes,
        created_by: currentAdminEmail
    };
    try {
        const { data, error } = await sb.from('event_finance_entries').insert(payload).select().single();
        if (error) throw error;
        adminFinanceEntries.unshift(normalizeAdminFinanceEntry(data));
        document.getElementById('event-finance-amount').value = '';
        document.getElementById('event-finance-notes').value = '';
        renderEventFinanceModal();
        renderEventsList();
        refreshActivePipelineStage();
        showToast(`${entryType === 'investment' ? 'Investment' : 'Expense'} saved privately.`);
    } catch (error) {
        console.error('Admin finance entry could not be saved', error);
        showToast('Expense could not be saved. Please try again.');
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-plus"></i> Add Entry';
    }
}

async function deleteEventFinanceEntry(entryId) {
    if (!currentAdminEmail || !confirm('Delete this internal finance entry?')) return;
    const previousEntries = adminFinanceEntries.slice();
    adminFinanceEntries = adminFinanceEntries.filter(entry => String(entry.id) !== String(entryId));
    renderEventFinanceModal();
    renderEventsList();
    refreshActivePipelineStage();
    const { error } = await sb.from('event_finance_entries').delete().eq('id', entryId);
    if (error) {
        adminFinanceEntries = previousEntries;
        renderEventFinanceModal();
        renderEventsList();
        refreshActivePipelineStage();
        console.error('Admin finance entry could not be deleted', error);
        showToast('Entry could not be deleted. Please try again.');
        return;
    }
    showToast('Internal finance entry deleted.');
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

        const calcs = getQuotationCalculations(evt);
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
    const quote = getQuotationDocument(event);

    hideView('quotation-placeholder');
    showView('quotation-editor');

    document.getElementById('q-status-badge').className = `badge badge-${event.status}`;
    document.getElementById('q-status-badge').textContent = getStageLabel(event.status);
    const uniqueNumber = event.id.split('_')[1].substring(4, 9);
    document.getElementById('q-display-number').textContent = `QTN-${uniqueNumber}`;
    
    document.getElementById('q-date-text').textContent = event.createdDate || getTodayDateString();
    document.getElementById('q-cust-name').textContent = event.clientName;
    document.getElementById('q-cust-phone').textContent = event.clientPhone;
    document.getElementById('q-cust-email').textContent = event.clientEmail || '-';
    document.getElementById('q-event-service').textContent = event.serviceType;
    document.getElementById('q-event-date').textContent = formatDisplayDate(event.eventDate);
    document.getElementById('q-event-venue').textContent = event.venue || '-';

    const addressWrap = document.getElementById('q-cust-address-wrap');
    if (event.address) {
        document.getElementById('q-cust-address').textContent = event.address;
        addressWrap.classList.remove('hidden');
    } else {
        addressWrap.classList.add('hidden');
    }

    renderQuotationItems(event);
    renderQuotationBonusItems(event);
    document.getElementById('q-discount-input').value = quote.discount || 0;
    calculateQuotationTotals();
}

function renderQuotationItems(event) {
    const doc = getQuotationDocument(event);
    if (!doc.items.length) doc.items.push({ desc: event.serviceType ? event.serviceType + ' Service' : '', rate: optionalDocumentNumber(event.budget), qty: null });
    document.getElementById('quotation-items-tbody').innerHTML = renderPricedDocumentRows(doc.items, 'quotation');
}

function addQuotationSubItem(itemIndex) {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    const item = quote.items[itemIndex];
    if (!item.subItems) item.subItems = [];
    item.subItems.push({ desc: '', rate: null, qty: null });

    renderQuotationItems(event);
    saveState();
}

function removeQuotationSubItem(itemIndex, subIndex) {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    quote.items[itemIndex].subItems.splice(subIndex, 1);
    renderQuotationItems(event);
    saveState();
}

function updateQuotationSubItemField(itemIndex, subIndex, val) {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    const subItem = normalizePricedSubItem(quote.items[itemIndex].subItems[subIndex]);
    quote.items[itemIndex].subItems[subIndex] = { ...subItem, desc: val };
    saveState();
}

function addPresetServiceToQuotation(serviceName) {
    if (!serviceName) return;
    const preset = servicePresets.find(p => p.name === serviceName);
    if (!preset) return;

    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    quote.items.push({ desc: preset.name, rate: preset.rate, qty: 1 });

    renderQuotationItems(event);
    calculateQuotationTotals();
    saveState();
    showToast(`Added ${preset.name} to Quotation.`);
}

function addQuotationItem() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    quote.items.push({ desc: '', rate: null, qty: null });

    renderQuotationItems(event);
    calculateQuotationTotals();
    saveState();
}

// Fixed Quotation Items array deletion indexing logic error
function removeQuotationItem(idx) {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    if (quote.items.length <= 1) {
        showToast('Must have at least one line item.');
        return;
    }

    quote.items.splice(idx, 1);
    renderQuotationItems(event);
    calculateQuotationTotals();
    saveState();
}

function updateQuotationItemField(idx, field, val) {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    quote.items[idx][field] = val;

    const itemTotalEl = document.getElementById(`q-item-total-${idx}`);
    if (itemTotalEl) {
        itemTotalEl.textContent = `₹${(quote.items[idx].rate * quote.items[idx].qty).toFixed(2)}`;
    }

    calculateQuotationTotals();
    saveState();
}

// Bonus / complimentary items - a separate list shown under its own "BONUS
// FREE" heading with its own total, matching the quotation format where
// free extras (arches, name boards, etc.) are called out separately from
// the paid service items above.
function renderQuotationBonusItems(event) {
    const quote = getQuotationDocument(event);
    const tbody = document.getElementById('quotation-bonus-tbody');
    const totalRow = document.getElementById('q-bonus-total-row');
    const bonusSection = document.getElementById('q-bonus-section');
    const bonusTrigger = document.getElementById('q-bonus-add-trigger');
    tbody.innerHTML = '';

    if (quote.bonusItems.length === 0) {
        totalRow.classList.add('hidden');
        bonusSection.classList.add('hidden');
        if (bonusTrigger) bonusTrigger.classList.remove('hidden');
        return;
    }

    bonusSection.classList.remove('hidden');
    if (bonusTrigger) bonusTrigger.classList.add('hidden');
    totalRow.classList.remove('hidden');

    quote.bonusItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span class="document-editable" contenteditable="true" role="textbox" aria-label="Bonus item description" onkeydown="handleInlineEditorKey(event)" onblur="updateQuotationBonusItemField(${index}, 'desc', this.textContent.trim())">${escapeDocumentText(item.desc)}</span>
            </td>
            <td class="text-right" width="140">
                <span class="document-editable numeric-editable" contenteditable="true" role="textbox" inputmode="decimal" aria-label="Bonus item value" onkeydown="handleInlineEditorKey(event)" onblur="updateQuotationBonusItemField(${index}, 'rate', normalizeInlineNumber(this, 0))">${Number(item.rate) || 0}</span>
            </td>
            <td class="actions-col no-print text-center" width="50">
                <button class="action-icon-btn danger" onclick="removeQuotationBonusItem(${index})"><i class="fa-solid fa-xmark"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function addQuotationBonusItem() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    quote.bonusItems.push({ desc: 'New Bonus Item', rate: 0, qty: 1 });

    renderQuotationBonusItems(event);
    calculateQuotationTotals();
    saveState();
}

function removeQuotationBonusItem(idx) {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    quote.bonusItems.splice(idx, 1);
    renderQuotationBonusItems(event);
    calculateQuotationTotals();
    saveState();
}

function updateQuotationBonusItemField(idx, field, val) {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    quote.bonusItems[idx][field] = val;
    calculateQuotationTotals();
    saveState();
}

function removeAllQuotationBonusItems() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    if (quote.bonusItems.length === 0) return;

    if (!confirm('Remove the entire Bonus Free section and all its items?')) return;

    quote.bonusItems = [];
    renderQuotationBonusItems(event);
    calculateQuotationTotals();
    saveState();
    showToast('Bonus box removed.');
}

function calculateQuotationTotals() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    let subtotal = 0;
    if (quote.items) {
        quote.items.forEach(item => {
            subtotal += getDocumentItemTotal(item);
        });
    }

    let bonusTotal = 0;
    if (quote.bonusItems) {
        quote.bonusItems.forEach(item => {
            bonusTotal += (item.rate * (item.qty || 1));
        });
    }

    const discountVal = parseFloat(document.getElementById('q-discount-input').value) || 0;
    quote.discount = discountVal;

    const grandTotal = Math.max(0, subtotal - discountVal);

    document.getElementById('q-subtotal').textContent = `₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('q-discount-display').textContent = `₹${discountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('q-grand-total').textContent = `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('q-bonus-total').textContent = `₹${bonusTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function saveQuotationChanges() {
    if (document.activeElement?.isContentEditable) document.activeElement.blur();
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    const quote = getQuotationDocument(event);

    const discountVal = parseFloat(document.getElementById('q-discount-input').value) || 0;
    quote.discount = discountVal;
    markQuotationSaved(event);

    if (event.stageIndex >= 2 && event.stageIndex < 3) {
        copyQuotationToInvoice(event);
    }

    if (!await saveState()) { showToast('Quotation could not be saved. Please try again.'); return; }
    showToast('Quotation details saved!');
    refreshAllViews();
    loadQuotationTab();
}

function printQuotation() {
    if (document.activeElement?.isContentEditable) document.activeElement.blur();
    window.print();
}

// ==========================================
// JPEG EXPORT / SHARE (used by both Quotation and Invoice panels)
// ==========================================

// Renders a DOM node to a JPEG Blob using html2canvas, skipping any
// screen-only controls (.no-print) so the exported image matches print output.
function captureElementAsJPEGBlob(elementId) {
    if (document.activeElement?.isContentEditable) document.activeElement.blur();
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

function normalizeWhatsAppPhone(value) {
    let digits = String(value || '').replace(/[^0-9]/g, '');
    if (digits.startsWith('00')) digits = digits.substring(2);
    else if (digits.startsWith('0')) digits = digits.substring(1);
    if (digits.length === 10) digits = `91${digits}`;
    return /^[1-9][0-9]{9,14}$/.test(digits) ? digits : '';
}

function openWhatsAppChat(phone, message = '') {
    const cleanPhone = normalizeWhatsAppPhone(phone);
    if (!cleanPhone) {
        showToast('Add a valid customer phone number first.');
        return false;
    }
    const text = message ? `?text=${encodeURIComponent(message)}` : '';
    window.open(`https://wa.me/${cleanPhone}${text}`, '_blank', 'noopener,noreferrer');
    return true;
}

function getEventDetailsFormUrl(accessToken) {
    return `${PUBLIC_SITE_URL}/event-details.html?token=${encodeURIComponent(String(accessToken || ''))}`;
}

function buildEventDetailsWhatsAppMessage(event, accessToken) {
    return `*DD EVENTS - EVENT DETAILS FORM*

Hello ${event.clientName || 'Customer'},

Your event booking is confirmed. Please fill in the event timing, venue, contact person and schedule details using this secure form:

${getEventDetailsFormUrl(accessToken)}

*Event Date:* ${formatDisplayDate(event.eventDate)}
*Service:* ${event.serviceType || 'Event Service'}

இந்த form-ல் event timing மற்றும் தேவையான basic details-ஐ update செய்யுங்கள். Thank you!`;
}

async function ensureEventDetailForm(event) {
    const existing = getEventDetailForm(event.id);
    if (existing?.accessToken) return existing;

    const previousValue = event.eventDetailsForm;
    const now = new Date().toISOString();
    event.eventDetailsForm = {
        accessToken: crypto.randomUUID(),
        status: 'pending',
        response: {},
        createdAt: now,
        updatedAt: now
    };

    if (!await saveState()) {
        event.eventDetailsForm = previousValue;
        throw new Error('The form link could not be saved.');
    }
    return event.eventDetailsForm;
}

async function shareEventDetailsForm(eventId) {
    const event = appState.events.find(item => String(item.id) === String(eventId));
    if (!event || event.status !== 'event-completed') {
        showToast('This form is available only in the Event Execution stage.');
        return false;
    }
    if (!normalizeWhatsAppPhone(event.clientPhone)) {
        showToast('Add a valid customer phone number first.');
        return false;
    }

    try {
        const form = await ensureEventDetailForm(event);
        refreshActivePipelineStage();
        return openWhatsAppChat(event.clientPhone, buildEventDetailsWhatsAppMessage(event, form.accessToken));
    } catch (error) {
        console.error('Customer event form could not be prepared', error);
        showToast('Customer form could not be prepared. Please try again.');
        return false;
    }
}

function getEventDetailsFormCardHtml(event) {
    const form = getEventDetailForm(event.id);
    if (!form) {
        return `<div class="event-form-status not-shared"><i class="fa-solid fa-clipboard-list"></i><span><strong>Event Details Form</strong><small>Not shared yet</small></span></div>`;
    }
    if (form.status === 'submitted') {
        const session = escapeDocumentText(form.response.session || 'Details received');
        return `<div class="event-form-status submitted"><i class="fa-solid fa-circle-check"></i><span><strong>Details Received</strong><small>${session}${form.response.eventStartTime ? ` · ${escapeDocumentText(form.response.eventStartTime)}` : ''}</small></span></div>`;
    }
    return `<div class="event-form-status pending"><i class="fa-solid fa-clock"></i><span><strong>Form Shared</strong><small>Waiting for customer response</small></span></div>`;
}

function formatSubmittedDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function openEventDetailsResponse(eventId) {
    const form = getEventDetailForm(eventId);
    if (!form || form.status !== 'submitted') {
        showToast('Customer details have not been submitted yet.');
        return false;
    }
    currentEventDetailsResponseEventId = String(eventId);
    renderEventDetailsResponseModal();
    openModal('event-details-response-modal');
    return true;
}

function renderEventDetailsResponseModal() {
    const event = appState.events.find(item => String(item.id) === String(currentEventDetailsResponseEventId));
    const form = getEventDetailForm(currentEventDetailsResponseEventId);
    const container = document.getElementById('event-details-response-content');
    if (!event || !form || !container) return;

    const response = form.response || {};
    const rows = [
        ['Session', response.session],
        ['Event Start Time', response.eventStartTime],
        ['Guest Arrival Time', response.guestArrivalTime],
        ['Main Program / Muhurtham', response.mainProgramTime],
        ['Team Setup Access Time', response.setupAccessTime],
        ['Expected Guests', response.guestCount || '—'],
        ['Primary Contact', response.contactName],
        ['Contact Phone', response.contactPhone],
        ['Exact Venue / Address', response.venueAddress],
        ['Program Schedule', response.scheduleNotes],
        ['Special Instructions', response.specialInstructions]
    ];
    const mapsLink = /^https?:\/\//i.test(String(response.mapsLink || '')) ? String(response.mapsLink) : '';

    container.innerHTML = `
        <div class="event-response-heading">
            <div><span>Customer</span><strong>${escapeDocumentText(event.clientName)}</strong></div>
            <div><span>Event Date</span><strong>${escapeDocumentText(formatDisplayDate(event.eventDate))}</strong></div>
            <div><span>Submitted</span><strong>${escapeDocumentText(formatSubmittedDate(form.submittedAt))}</strong></div>
        </div>
        <div class="event-response-grid">
            ${rows.map(([label, value]) => `<div><span>${escapeDocumentText(label)}</span><strong>${escapeDocumentText(value || '—')}</strong></div>`).join('')}
        </div>
        ${mapsLink ? `<a class="event-response-map" href="${escapeDocumentText(mapsLink)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-location-dot"></i> Open Google Maps</a>` : ''}`;
}

function buildQuotationWhatsAppMessage(event) {
    const quote = getQuotationDocument(event);
    const calcs = getQuotationCalculations(event);
    const uniqueNumber = event.id.split('_')[1].substring(4, 9);
    const quoteNum = `QTN-${uniqueNumber}`;

    const itemsText = documentItemsText(quote.items);

    return `*QUOTATION - DD EVENTS*
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

}

function shareQuotationWhatsApp() {
    const event = appState.events.find(e => e.id === currentQuotationEventId);
    if (!event) return;
    openWhatsAppChat(event.clientPhone, buildQuotationWhatsAppMessage(event));
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
    const invoice = getInvoiceDocument(event);

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
    renderInvoiceBonusItems(event);
    document.getElementById('inv-discount-input').value = invoice.discount || 0;
    calculateInvoiceTotals();
    renderPaymentHistory(event);
}

function renderInvoiceItems(event) {
    const doc = getInvoiceDocument(event);
    if (!doc.items.length) doc.items.push({ desc: event.serviceType ? event.serviceType + ' Service' : '', rate: optionalDocumentNumber(event.budget), qty: null });
    document.getElementById('invoice-items-tbody').innerHTML = renderPricedDocumentRows(doc.items, 'invoice');
}

function addInvoiceSubItem(itemIndex) {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    const item = invoice.items[itemIndex];
    if (!item.subItems) item.subItems = [];
    item.subItems.push({ desc: '', rate: null, qty: null });

    renderInvoiceItems(event);
    saveState();
}

function removeInvoiceSubItem(itemIndex, subIndex) {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    invoice.items[itemIndex].subItems.splice(subIndex, 1);
    renderInvoiceItems(event);
    saveState();
}

function updateInvoiceSubItemField(itemIndex, subIndex, val) {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    const subItem = normalizePricedSubItem(invoice.items[itemIndex].subItems[subIndex]);
    invoice.items[itemIndex].subItems[subIndex] = { ...subItem, desc: val };
    saveState();
}

// Bonus items on the invoice - same data as quotation.bonusItems, so what
// admin marked as "free" in the quote continues to show on the final bill.
function renderInvoiceBonusItems(event) {
    const invoice = getInvoiceDocument(event);
    const tbody = document.getElementById('invoice-bonus-tbody');
    const bonusSection = document.getElementById('inv-bonus-section');
    const bonusTrigger = document.getElementById('inv-bonus-add-trigger');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (invoice.bonusItems.length === 0) {
        bonusSection.classList.add('hidden');
        if (bonusTrigger) bonusTrigger.classList.remove('hidden');
        return;
    }

    bonusSection.classList.remove('hidden');
    if (bonusTrigger) bonusTrigger.classList.add('hidden');

    invoice.bonusItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span class="document-editable" contenteditable="true" role="textbox" aria-label="Bonus item description" onkeydown="handleInlineEditorKey(event)" onblur="updateInvoiceBonusItemField(${index}, 'desc', this.textContent.trim())">${escapeDocumentText(item.desc)}</span>
            </td>
            <td class="actions-col no-print text-center" width="50">
                <button class="action-icon-btn danger" onclick="removeInvoiceBonusItem(${index})"><i class="fa-solid fa-xmark"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function addInvoiceBonusItem() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    invoice.bonusItems.push({ desc: 'New Bonus Item', rate: 0, qty: 1 });

    renderInvoiceBonusItems(event);
    saveState();
}

function removeInvoiceBonusItem(idx) {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    invoice.bonusItems.splice(idx, 1);
    renderInvoiceBonusItems(event);
    saveState();
}

function updateInvoiceBonusItemField(idx, field, val) {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    invoice.bonusItems[idx][field] = val;
    saveState();
}

function removeAllInvoiceBonusItems() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    if (invoice.bonusItems.length === 0) return;

    if (!confirm('Remove the entire Bonus Free section and all its items?')) return;

    invoice.bonusItems = [];
    renderInvoiceBonusItems(event);
    saveState();
    showToast('Bonus box removed.');
}

function addPresetServiceToInvoice(serviceName) {
    if (!serviceName) return;
    const preset = servicePresets.find(p => p.name === serviceName);
    if (!preset) return;

    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    invoice.items.push({ desc: preset.name, rate: preset.rate, qty: 1 });

    renderInvoiceItems(event);
    calculateInvoiceTotals();
    saveState();
    showToast(`Added ${preset.name} to Invoice.`);
}

function addInvoiceItem() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    invoice.items.push({ desc: '', rate: null, qty: null });

    renderInvoiceItems(event);
    calculateInvoiceTotals();
    saveState();
}

function removeInvoiceItem(idx) {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    if (invoice.items.length <= 1) {
        showToast('Must have at least one line item.');
        return;
    }

    invoice.items.splice(idx, 1);
    renderInvoiceItems(event);
    calculateInvoiceTotals();
    saveState();
}

function updateItemField(idx, field, val) {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    invoice.items[idx][field] = val;

    const itemTotalEl = document.getElementById(`item-total-${idx}`);
    if (itemTotalEl) {
        itemTotalEl.textContent = `₹${(invoice.items[idx].rate * invoice.items[idx].qty).toFixed(2)}`;
    }

    calculateInvoiceTotals();
    saveState();
}

function calculateInvoiceTotals() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    const photographyNote = document.getElementById('photography-delivery-note');
    if (photographyNote) photographyNote.classList.toggle('hidden', !hasPhotographyService(invoice.items));

    let subtotal = 0;
    if (invoice.items) {
        invoice.items.forEach(item => {
            subtotal += getDocumentItemTotal(item);
        });
    }

    const discountVal = parseFloat(document.getElementById('inv-discount-input').value) || 0;
    invoice.discount = discountVal;

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

function openCurrentInvoiceDocuments() {
    if (!currentInvoiceEventId) {
        showToast('Select an invoice first.');
        return;
    }

    openEventDocuments(currentInvoiceEventId);
}

async function saveInvoiceChanges() {
    if (document.activeElement?.isContentEditable) document.activeElement.blur();
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    const invoice = getInvoiceDocument(event);

    const discountVal = parseFloat(document.getElementById('inv-discount-input').value) || 0;
    invoice.discount = discountVal;
    invoice.savedAt = new Date().toISOString();
    syncLegacyDocumentFields(event, invoice);

    if (!await saveState()) { showToast('Invoice could not be saved. Please try again.'); return; }
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
    if (document.activeElement?.isContentEditable) document.activeElement.blur();
    window.print();
}

function buildInvoiceWhatsAppMessage(event) {
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

    return `*TAX INVOICE - DD EVENTS*
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

}

function shareInvoiceWhatsApp() {
    const event = appState.events.find(e => e.id === currentInvoiceEventId);
    if (!event) return;
    openWhatsAppChat(event.clientPhone, buildInvoiceWhatsAppMessage(event));
}

function openWhatsAppCenter() {
    const search = document.getElementById('whatsapp-center-search');
    if (search) search.value = '';
    renderWhatsAppCenter();
    openModal('whatsapp-center-modal');
}

function openCustomerWhatsApp(eventId, type) {
    const event = appState.events.find(item => item.id === eventId);
    if (!event) {
        showToast('Customer record not found.');
        return false;
    }
    const stageIndex = Number(event.stageIndex || 0);
    if (type === 'invoice' && stageIndex < 2) {
        showToast('Invoice is available after Advance Pay / Date Booked.');
        return false;
    }
    if (type === 'booking-welcome' && stageIndex < 2) {
        showToast('Booking welcome is available after Advance Pay / Date Booked.');
        return false;
    }
    if (type === 'event-thanks' && stageIndex < 4) {
        showToast('Event thank-you is available after execution moves to Pending Bill.');
        return false;
    }
    if (type === 'feedback-review') {
        if (stageIndex < 4) {
            showToast('Feedback request is available after Event Execution is completed.');
            return false;
        }
        if (!getGoogleReviewUrl()) {
            showToast('Add a valid Google Review link in Settings first.');
            return false;
        }
    }
    if (type === 'payment-thanks') {
        const calcs = getEventInvoiceCalculations(event);
        if (stageIndex < 5) {
            showToast('Payment thank-you is available at Completed Bill.');
            return false;
        }
        if (calcs.pendingBalance > 0) {
            showToast(`₹${calcs.pendingBalance.toLocaleString('en-IN')} is still pending. Record the full payment before sending a payment thank-you.`);
            return false;
        }
    }
    let message = `Hi ${event.clientName || 'Customer'},`;
    if (type === 'quotation') message = buildQuotationWhatsAppMessage(event);
    if (type === 'invoice') message = buildInvoiceWhatsAppMessage(event);
    if (type === 'booking-welcome') message = buildBookingWelcomeMessage(event);
    if (type === 'event-thanks') message = buildEventThankYouMessage(event);
    if (type === 'payment-thanks') message = buildPaymentThankYouMessage(event);
    if (type === 'feedback-review') message = buildFeedbackReviewMessage(event);
    return openWhatsAppChat(event.clientPhone, message);
}

function buildBookingWelcomeMessage(event) {
    return `*WELCOME TO DD EVENTS*
-------------------------------
Hi *${event.clientName || 'Customer'}*,

Your booking is confirmed. Welcome to the DD Events family!

*Service:* ${event.serviceType || '-'}
*Event Date:* ${formatDisplayDate(event.eventDate) || '-'}
*Venue:* ${event.venue || '-'}

We are happy to be part of your special event. Our team will keep you updated as the event date approaches.

For any questions, call 6374503310 or 6384203310.

Thank you for choosing DD Events!`;
}

function buildEventThankYouMessage(event) {
    return `*THANK YOU FROM DD EVENTS*
-------------------------------
Hi *${event.clientName || 'Customer'}*,

Thank you for trusting DD Events for your ${event.serviceType || 'event'} on ${formatDisplayDate(event.eventDate) || 'the scheduled date'}.

It was a pleasure to be part of your special occasion. We hope you and your guests had a wonderful experience.

We look forward to celebrating with you again!

With thanks,
*DD Events (Events & Management)*`;
}

function buildPaymentThankYouMessage(event) {
    const calcs = getEventInvoiceCalculations(event);
    return `*PAYMENT RECEIVED - DD EVENTS*
-------------------------------
Hi *${event.clientName || 'Customer'}*,

Thank you. We have received the full payment for your ${event.serviceType || 'event'}.

*Invoice:* ${getInvoiceNumber(event)}
*Amount Received:* ₹${calcs.totalPaid.toLocaleString('en-IN')}
*Pending Balance:* ₹0

Your bill is now complete. Thank you for choosing DD Events!

With thanks,
*DD Events (Events & Management)*`;
}

function getGoogleReviewUrl() {
    const value = String(appState.googleReviewUrl || DEFAULT_GOOGLE_REVIEW_URL).trim();
    try {
        const parsed = new URL(value);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch (error) {
        return '';
    }
}

function buildFeedbackReviewMessage(event) {
    const reviewUrl = getGoogleReviewUrl();
    return `*YOUR FEEDBACK MATTERS - DD EVENTS*
-------------------------------
Hi *${event.clientName || 'Customer'}*,

Thank you for choosing DD Events for your ${event.serviceType || 'event'}. We hope you had a wonderful experience with our team.

Please take a moment to share your feedback and Google review. Your review helps us improve and helps other families choose us with confidence.

*Write a review:* ${reviewUrl}

Thank you for your support!

With thanks,
*DD Events (Events & Management)*`;
}

async function shareCustomerDocumentImage(eventId, type) {
    const event = appState.events.find(item => item.id === eventId);
    if (!event) {
        showToast('Customer record not found.');
        return false;
    }
    if (type === 'invoice' && Number(event.stageIndex || 0) < 2) {
        showToast('Bill image is available after Advance Pay / Date Booked.');
        return false;
    }

    closeModal('whatsapp-center-modal');
    if (type === 'quotation') {
        currentQuotationEventId = event.id;
        switchTab('quotation');
        const uniqueNumber = event.id.split('_')[1].substring(4, 9);
        await shareElementAsJPEG('quotation-print-area', `Quotation-${uniqueNumber}.jpg`, 'DD Events Quotation');
        return true;
    }

    currentInvoiceEventId = event.id;
    switchTab('billing');
    await shareElementAsJPEG('invoice-print-area', `${getInvoiceNumber(event)}.jpg`, 'DD Events Bill');
    return true;
}

function renderWhatsAppCenter() {
    const container = document.getElementById('whatsapp-center-list');
    if (!container) return;
    const search = String(document.getElementById('whatsapp-center-search')?.value || '').trim().toLowerCase();
    const events = [...(appState.events || [])]
        .filter(event => [event.clientName, event.clientPhone, event.serviceType, getStageLabel(event.status)]
            .some(value => String(value || '').toLowerCase().includes(search)))
        .sort((a, b) => String(b.eventDate || '').localeCompare(String(a.eventDate || '')));

    if (!events.length) {
        container.innerHTML = '<div class="empty-state"><i class="fa-brands fa-whatsapp"></i><p>No matching customers found.</p></div>';
        return;
    }

    container.innerHTML = events.map(event => {
        const hasPhone = Boolean(normalizeWhatsAppPhone(event.clientPhone));
        const stageIndex = Number(event.stageIndex || 0);
        const invoiceReady = stageIndex >= 2;
        const bookingWelcomeReady = hasPhone && stageIndex >= 2;
        const eventThanksReady = hasPhone && stageIndex >= 4;
        const feedbackReady = hasPhone && stageIndex >= 4 && Boolean(getGoogleReviewUrl());
        const paymentCalcs = getEventInvoiceCalculations(event);
        const paymentThanksReady = hasPhone && stageIndex >= 5 && paymentCalcs.pendingBalance <= 0;
        const disabled = hasPhone ? '' : ' disabled';
        const invoiceDisabled = hasPhone && invoiceReady ? '' : ' disabled';
        const phoneText = hasPhone ? escapeDocumentText(event.clientPhone) : 'Phone number required';
        const eventArgument = escapeDocumentText(JSON.stringify(String(event.id)));
        return `<article class="whatsapp-customer-row">
            <div class="whatsapp-customer-details">
                <strong>${escapeDocumentText(event.clientName || 'Unnamed customer')}</strong>
                <span><i class="fa-solid fa-phone"></i> ${phoneText}</span>
                <small>${escapeDocumentText(event.serviceType || 'Service not set')} · ${escapeDocumentText(formatDisplayDate(event.eventDate))} · ${escapeDocumentText(getStageLabel(event.status))}</small>
            </div>
            <div class="whatsapp-customer-actions">
                <div class="whatsapp-action-group"><span>Documents</span><div>
                    <button type="button" class="whatsapp-action-btn primary" onclick="openCustomerWhatsApp(${eventArgument}, 'quotation')"${disabled} title="Open customer chat with quotation text"><i class="fa-solid fa-file-lines"></i> Quotation Text</button>
                    <button type="button" class="whatsapp-action-btn image" onclick="shareCustomerDocumentImage(${eventArgument}, 'quotation')" title="Share quotation as a JPEG image"><i class="fa-solid fa-image"></i> Quote Image</button>
                    <button type="button" class="whatsapp-action-btn" onclick="openCustomerWhatsApp(${eventArgument}, 'invoice')"${invoiceDisabled} title="${invoiceReady ? 'Open customer chat with bill text' : 'Available after Advance Pay / Date Booked'}"><i class="fa-solid fa-receipt"></i> Bill Text</button>
                    <button type="button" class="whatsapp-action-btn image" onclick="shareCustomerDocumentImage(${eventArgument}, 'invoice')"${invoiceReady ? '' : ' disabled'} title="${invoiceReady ? 'Share bill as a JPEG image' : 'Available after Advance Pay / Date Booked'}"><i class="fa-solid fa-file-image"></i> Bill Image</button>
                </div></div>
                <div class="whatsapp-action-group"><span>Customer Messages</span><div>
                    <button type="button" class="whatsapp-action-btn message" onclick="openCustomerWhatsApp(${eventArgument}, 'booking-welcome')"${bookingWelcomeReady ? '' : ' disabled'} title="${stageIndex >= 2 ? 'Send booking confirmation and welcome' : 'Available after Advance Pay / Date Booked'}"><i class="fa-solid fa-handshake"></i> Booking Welcome</button>
                    <button type="button" class="whatsapp-action-btn message" onclick="openCustomerWhatsApp(${eventArgument}, 'event-thanks')"${eventThanksReady ? '' : ' disabled'} title="${stageIndex >= 4 ? 'Thank the customer after event execution' : 'Available after Event Execution'}"><i class="fa-solid fa-heart"></i> Event Thank You</button>
                    <button type="button" class="whatsapp-action-btn message" onclick="openCustomerWhatsApp(${eventArgument}, 'payment-thanks')"${paymentThanksReady ? '' : ' disabled'} title="${stageIndex < 5 ? 'Available at Completed Bill' : paymentCalcs.pendingBalance > 0 ? 'Full payment must be recorded first' : 'Confirm full payment and thank the customer'}"><i class="fa-solid fa-circle-check"></i> Payment Thank You</button>
                    <button type="button" class="whatsapp-action-btn review" onclick="openCustomerWhatsApp(${eventArgument}, 'feedback-review')"${feedbackReady ? '' : ' disabled'} title="${stageIndex < 4 ? 'Available after Event Execution is completed' : !getGoogleReviewUrl() ? 'Add Google Review link in Settings' : 'Ask for feedback and a Google review'}"><i class="fa-brands fa-google"></i> Feedback / Review</button>
                    <button type="button" class="whatsapp-action-btn" onclick="openCustomerWhatsApp(${eventArgument}, 'chat')"${disabled}><i class="fa-brands fa-whatsapp"></i> Chat</button>
                </div></div>
            </div>
        </article>`;
    }).join('');
}

// Helpers
function getInvoiceNumber(event) {
    if (!event) return '';
    const uniqueNumber = event.id.split('_')[1].substring(4, 9);
    return `INV-${uniqueNumber}`;
}

function getEventInvoiceCalculations(event) {
    const documentData = event.stageIndex >= 2
        ? getInvoiceDocument(event)
        : getQuotationDocument(event);
    const { subtotal, discount, grandTotal } = getDocumentCalculations(documentData);
    
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
    const groupsContainer = document.getElementById('staff-members-groups');
    const departmentContainer = document.getElementById('staff-department-counts');
    const subworkContainer = document.getElementById('staff-subwork-counts');
    const activeFilter = document.getElementById('staff-directory-active-filter');
    if (!groupsContainer || !departmentContainer || !subworkContainer || !activeFilter) return;

    const staffList = appState.staff || [];
    const departmentCounts = new Map();
    const departmentSubworkCounts = new Map();
    staffList.forEach(member => {
        const department = member.department || member.role || 'Department not set';
        departmentCounts.set(department, (departmentCounts.get(department) || 0) + 1);
        if (!departmentSubworkCounts.has(department)) departmentSubworkCounts.set(department, new Map());
        normalizeStaffWorkRoles(member.workRoles).forEach(role => {
            const departmentRoles = departmentSubworkCounts.get(department);
            departmentRoles.set(role, (departmentRoles.get(role) || 0) + 1);
        });
    });

    const isActive = (type, value = '') => currentStaffDirectoryFilter.type === type && currentStaffDirectoryFilter.value === value;
    const filterButton = (type, value, label, count, icon) => `
        <button type="button" class="staff-count-card ${isActive(type, value) ? 'active' : ''}"
            data-filter-type="${escapeDocumentText(type)}" data-filter-value="${escapeDocumentText(value)}"
            onclick="setStaffDirectoryFilterFromButton(this)">
            <i class="fa-solid ${icon}"></i><span>${escapeDocumentText(label)}</span><strong>${count}</strong>
        </button>`;

    departmentContainer.innerHTML = filterButton('all', '', 'All Staff', staffList.length, 'fa-users') +
        [...departmentCounts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([department, count]) => filterButton('department', department, department, count, 'fa-briefcase'))
            .join('');

    subworkContainer.innerHTML = departmentCounts.size
        ? [...departmentCounts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([department, staffCount]) => {
                const assignedCounts = departmentSubworkCounts.get(department) || new Map();
                const departmentWorks = [...new Set([...getDepartmentSubWorks(department), ...assignedCounts.keys()])];
                const serviceGroupOpen = (currentStaffDirectoryFilter.type === 'department' && currentStaffDirectoryFilter.value === department) ||
                    (currentStaffDirectoryFilter.type === 'service-work' && currentStaffDirectoryFilter.value.startsWith(`${department}|||`));
                return `<details class="staff-service-subwork-group" ${serviceGroupOpen ? 'open' : ''}>
                    <summary><div><i class="fa-solid fa-briefcase"></i><strong>${escapeDocumentText(department)}</strong></div><span>${staffCount} staff <i class="fa-solid fa-chevron-down"></i></span></summary>
                    <div class="staff-service-subwork-list">${departmentWorks.map(role =>
                        filterButton('service-work', `${department}|||${role}`, role, assignedCounts.get(role) || 0, 'fa-screwdriver-wrench')
                    ).join('')}</div>
                </details>`;
            }).join('')
        : '<span class="text-muted">Add staff to view service-wise sub-works.</span>';

    const query = (document.getElementById('staff-directory-search')?.value || '').trim().toLowerCase();
    const visibleStaff = staffList.filter(member => {
        const department = member.department || member.role || 'Department not set';
        const roles = normalizeStaffWorkRoles(member.workRoles);
        const [serviceFilterDepartment, serviceFilterRole] = currentStaffDirectoryFilter.type === 'service-work'
            ? currentStaffDirectoryFilter.value.split('|||')
            : ['', ''];
        const matchesFilter = currentStaffDirectoryFilter.type === 'all' ||
            (currentStaffDirectoryFilter.type === 'department' && department === currentStaffDirectoryFilter.value) ||
            (currentStaffDirectoryFilter.type === 'subwork' && roles.includes(currentStaffDirectoryFilter.value)) ||
            (currentStaffDirectoryFilter.type === 'service-work' && department === serviceFilterDepartment && roles.includes(serviceFilterRole));
        const searchText = [member.name, member.phone, member.address, department, ...roles].filter(Boolean).join(' ').toLowerCase();
        return matchesFilter && (!query || searchText.includes(query));
    });

    if (currentStaffDirectoryFilter.type === 'all') {
        activeFilter.classList.add('hidden');
        activeFilter.innerHTML = '';
    } else {
        const activeFilterLabel = currentStaffDirectoryFilter.type === 'service-work'
            ? currentStaffDirectoryFilter.value.split('|||').join(' → ')
            : currentStaffDirectoryFilter.value;
        activeFilter.classList.remove('hidden');
        activeFilter.innerHTML = `<span>Showing: <strong>${escapeDocumentText(activeFilterLabel)}</strong> · ${visibleStaff.length} staff</span><button type="button" onclick="clearStaffDirectoryFilter()"><i class="fa-solid fa-xmark"></i> Clear filter</button>`;
    }

    if (visibleStaff.length === 0) {
        groupsContainer.innerHTML = '<div class="events-empty-state"><i class="fa-solid fa-user-slash"></i><h3>No matching staff</h3><p>Clear the filter or try another search.</p></div>';
        return;
    }

    const groupedStaff = new Map();
    visibleStaff.forEach(member => {
        const department = member.department || member.role || 'Department not set';
        if (!groupedStaff.has(department)) groupedStaff.set(department, []);
        groupedStaff.get(department).push(member);
    });
    groupsContainer.innerHTML = [...groupedStaff.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([department, members]) => `
            <details class="staff-department-group" ${currentStaffDirectoryFilter.type !== 'all' || query ? 'open' : ''}>
                <summary><div><i class="fa-solid fa-briefcase"></i><h3>${escapeDocumentText(department)}</h3></div><span>${members.length} ${members.length === 1 ? 'person' : 'people'} <i class="fa-solid fa-chevron-down"></i></span></summary>
                <div class="staff-directory-cards">${members.sort((a, b) => String(a.name).localeCompare(String(b.name))).map(renderStaffDirectoryCard).join('')}</div>
            </details>`).join('');
}

function setStaffDirectoryFilterFromButton(button) {
    currentStaffDirectoryFilter = { type: button.dataset.filterType || 'all', value: button.dataset.filterValue || '' };
    renderStaffConfigTable();
}

function clearStaffDirectoryFilter() {
    currentStaffDirectoryFilter = { type: 'all', value: '' };
    renderStaffConfigTable();
}

function renderStaffDirectoryCard(member) {
    const safePhoto = getSafeStaffPhoto(member.photoData);
    const workRoles = normalizeStaffWorkRoles(member.workRoles);
    return `<article class="staff-directory-card">
        <div class="staff-directory-card-main">
            <button class="staff-directory-avatar" onclick="viewStaffProfile('${member.id}')" title="View full profile">
                ${safePhoto ? `<img src="${safePhoto}" alt="${escapeDocumentText(member.name)}">` : '<i class="fa-solid fa-user"></i>'}
            </button>
            <div class="staff-directory-name"><h4>${escapeDocumentText(member.name || 'Unnamed Staff')}</h4>${member.selfCreated ? '<span>Self-created profile</span>' : '<span>Added by admin</span>'}</div>
            <div class="staff-directory-detail"><span>Phone</span><strong>${escapeDocumentText(member.phone || 'Not added')}</strong></div>
            <div class="staff-directory-detail address"><span>Address</span><strong>${escapeDocumentText(member.address || 'Not added')}</strong></div>
        </div>
        <div class="staff-directory-work">
            <span>Assigned sub-works</span>
            <div class="staff-work-role-tags">${workRoles.length ? workRoles.map(role => `<span>${escapeDocumentText(role)}</span>`).join('') : '<small class="text-muted">Not assigned yet</small>'}</div>
        </div>
        <div class="staff-directory-actions">
            <button type="button" onclick="openStaffWorkRoles('${member.id}')"><i class="fa-solid fa-screwdriver-wrench"></i> Assign Works</button>
            <button type="button" onclick="viewStaffProfile('${member.id}')"><i class="fa-solid fa-eye"></i> Full Details</button>
            <button type="button" class="danger" onclick="removeStaffMember('${member.id}')"><i class="fa-solid fa-trash-can"></i> Remove</button>
        </div>
    </article>`;
}

function getSafeStaffPhoto(value) {
    return /^data:image\/(jpeg|png|webp);base64,/i.test(value || '') ? value : '';
}

function updateStaffPhotoPreview(photoData) {
    const image = document.getElementById('staff-photo-preview-img');
    const preview = document.getElementById('staff-photo-preview');
    const removeButton = document.getElementById('staff-photo-remove-btn');
    const safePhoto = getSafeStaffPhoto(photoData);
    if (!image || !preview || !removeButton) return;
    image.src = safePhoto;
    image.classList.toggle('hidden', !safePhoto);
    preview.classList.toggle('has-photo', !!safePhoto);
    removeButton.classList.toggle('hidden', !safePhoto);
}

function removeStaffProfilePhoto() {
    pendingStaffProfilePhoto = '';
    updateStaffPhotoPreview('');
    document.getElementById('staff-photo-status').textContent = 'Photo removed. Save the profile to confirm.';
}

async function handleStaffProfilePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const status = document.getElementById('staff-photo-status');
    if (!file.type.startsWith('image/')) {
        status.textContent = 'Please select an image file.';
        return;
    }
    if (file.size > 12 * 1024 * 1024) {
        status.textContent = 'Photo is too large. Please choose a photo below 12 MB.';
        return;
    }

    status.textContent = 'Preparing photo…';
    try {
        pendingStaffProfilePhoto = await resizeStaffProfilePhoto(file);
        updateStaffPhotoPreview(pendingStaffProfilePhoto);
        status.textContent = 'Photo ready. Tap Save Profile to upload it.';
    } catch (error) {
        console.error('Could not prepare staff photo', error);
        status.textContent = 'Could not read this photo. Please choose another image.';
    }
}

function resizeStaffProfilePhoto(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            const image = new Image();
            image.onerror = reject;
            image.onload = () => {
                const maxSide = 360;
                const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                const context = canvas.getContext('2d');
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                let quality = 0.82;
                let result = canvas.toDataURL('image/jpeg', quality);
                while (result.length > 140000 && quality > 0.42) {
                    quality -= 0.1;
                    result = canvas.toDataURL('image/jpeg', quality);
                }
                resolve(result);
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function viewStaffProfile(staffId) {
    const member = appState.staff.find(staff => staff.id === staffId);
    if (!member) return;
    const safePhoto = getSafeStaffPhoto(member.photoData);
    const createdDate = member.createdAt ? new Date(member.createdAt).toLocaleString('en-IN') : 'Not recorded';
    const updatedDate = member.updatedAt ? new Date(member.updatedAt).toLocaleString('en-IN') : 'Not recorded';
    const workRoles = normalizeStaffWorkRoles(member.workRoles);
    document.getElementById('staff-details-modal-body').innerHTML = `
        <div class="staff-details-profile">
            <div class="staff-details-photo">${safePhoto ? `<img src="${safePhoto}" alt="${escapeDocumentText(member.name)} profile photo">` : '<i class="fa-solid fa-user"></i>'}</div>
            <div class="staff-details-name"><h3>${escapeDocumentText(member.name)}</h3><span class="staff-department-badge">${escapeDocumentText(member.department || member.role || 'Department not set')}</span></div>
        </div>
        <div class="staff-details-grid">
            <div><span>Phone Number</span><strong>${escapeDocumentText(member.phone || 'Not added')}</strong></div>
            <div><span>Profile Type</span><strong>${member.selfCreated ? 'Staff self-created' : 'Added by admin'}</strong></div>
            <div class="staff-details-address"><span>Address</span><strong>${escapeDocumentText(member.address || 'Not added')}</strong></div>
            <div class="staff-details-address"><span>Work Skills / Sub-Works</span><div class="staff-work-role-tags details">${workRoles.length ? workRoles.map(role => `<span>${escapeDocumentText(role)}</span>`).join('') : '<strong>Not assigned yet</strong>'}</div></div>
            <div><span>Created</span><strong>${escapeDocumentText(createdDate)}</strong></div>
            <div><span>Last Updated</span><strong>${escapeDocumentText(updatedDate)}</strong></div>
        </div>`;
    openModal('staff-details-modal');
}

function openStaffWorkRoles(staffId) {
    const member = appState.staff.find(staff => String(staff.id) === String(staffId));
    if (!member) return;
    document.getElementById('work-roles-staff-id').value = member.id;
    document.getElementById('work-roles-staff-name').textContent = member.name;
    const department = member.department || member.role || 'Department not set';
    document.getElementById('work-roles-staff-department').textContent = department;
    document.getElementById('staff-work-roles-input').value = normalizeStaffWorkRoles(member.workRoles).join('\n');
    document.getElementById('common-work-role-title').textContent = `${department} sub-works`;
    document.getElementById('common-work-role-buttons').innerHTML = getDepartmentSubWorks(department).map(role =>
        `<button type="button" data-work-role="${escapeDocumentText(role)}" onclick="addCommonStaffWorkRoleFromButton(this)">${escapeDocumentText(role)}</button>`
    ).join('');
    openModal('staff-work-roles-modal');
}

function addCommonStaffWorkRoleFromButton(button) {
    addCommonStaffWorkRole(button.dataset.workRole || '');
}

function addCommonStaffWorkRole(role) {
    const input = document.getElementById('staff-work-roles-input');
    const roles = normalizeStaffWorkRoles(`${input.value}\n${role}`);
    input.value = roles.join('\n');
}

async function saveStaffWorkRoles() {
    const staffId = document.getElementById('work-roles-staff-id').value;
    const member = appState.staff.find(staff => String(staff.id) === String(staffId));
    if (!member) return;
    const roles = normalizeStaffWorkRoles(document.getElementById('staff-work-roles-input').value);
    member.workRoles = roles;
    member.workRolesUpdatedAt = new Date().toISOString();
    member.updatedAt = member.workRolesUpdatedAt;
    const saved = await saveState();
    if (!saved) {
        await loadState();
        showToast('Work skills could not be saved. Please try again.');
        renderStaffTab();
        return;
    }
    closeModal('staff-work-roles-modal');
    showToast(`Work skills saved for ${member.name}.`);
    renderStaffTab();
}

function addStaffMember() {
    const name = document.getElementById('new-staff-name').value.trim();
    const role = document.getElementById('new-staff-role').value.trim();

    if (!name || !role) return;

    const newStaff = {
        id: 'stf_' + Date.now(),
        name,
        role,
        department: role,
        phone: '',
        address: '',
        workRoles: [],
        workRolesUpdatedAt: '',
        selfCreated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
        tbody.innerHTML = '<tr class="attendance-empty-row"><td colspan="5" class="text-center">No attendance logged for this date.</td></tr>';
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
            <td data-label="Staff Name"><strong>${escapeDocumentText(name)}</strong></td>
            <td data-label="Department">${escapeDocumentText(role)}</td>
            <td data-label="Check-In"><span class="badge badge-paid">${escapeDocumentText(log.checkInTime)}</span></td>
            <td data-label="Check-Out">${log.checkOutTime ? `<span class="badge badge-billing">${escapeDocumentText(log.checkOutTime)}</span>` : `<span class="badge badge-inquiry">Active</span>`}</td>
            <td data-label="Working Hours"><strong>${escapeDocumentText(hrsHTML)}</strong></td>
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
                address: evt.address || '',
                email: evt.clientEmail,
                eventsCount: 0,
                totalBilled: 0,
                pendingBalance: 0,
                history: []
            };
        }

        // Older inquiries may not have an address, while a later event for
        // the same customer does. Keep the first available saved address.
        if (!customerMap[key].address && evt.address) {
            customerMap[key].address = evt.address;
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
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No customers found. Customers are registered automatically when an inquiry is created.</td></tr>';
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
            <td>${escapeDocumentText(cust.address || 'Not added')}</td>
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

function loadReviewSettingsInForm() {
    const input = document.getElementById('google-review-url');
    if (input) input.value = appState.googleReviewUrl || DEFAULT_GOOGLE_REVIEW_URL;
}

async function saveReviewSettings() {
    const input = document.getElementById('google-review-url');
    if (!input) return false;
    const value = input.value.trim();
    let normalizedUrl = '';
    try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
        normalizedUrl = parsed.href;
    } catch (error) {
        showToast('Enter a valid Google Review link starting with https://');
        return false;
    }

    const previousUrl = appState.googleReviewUrl;
    appState.googleReviewUrl = normalizedUrl;
    if (!await saveState()) {
        appState.googleReviewUrl = previousUrl;
        showToast('Google Review link could not be saved. Please try again.');
        return false;
    }
    input.value = normalizedUrl;
    showToast('Google Review link saved successfully.');
    return true;
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
    if (!await loadState()) {
        showToast('Shared data could not be loaded. Backup was not exported.');
        return;
    }
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

            // Name what is actually wrong. "Invalid backup file structure" on
            // its own sends people hunting through the file for a fault that is
            // usually just the wrong file picked from the folder.
            const missing = ['events', 'staff', 'attendance']
                .filter(key => !Array.isArray(parsedData[key]));
            if (missing.length) {
                showToast(`This file is not a dashboard backup - it has no ${missing.join(', ')} list. Pick the exported backup JSON.`);
                document.getElementById('import-file').value = '';
                return;
            }

            const previousState = appState;
            appState = parsedData;
            const saved = await saveState();
            if (!saved) {
                appState = previousState;
                showToast('Backup could not be saved. Nothing was changed.');
                return;
            }
            showToast(`Backup restored: ${parsedData.events.length} events, ${parsedData.staff.length} staff.`);
            document.getElementById('import-file').value = '';
            await startApplication();
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

function getDashboardFinancialSummary(events) {
    // Keep amounts in paise so a rounding residue cannot keep a settled event
    // on the dashboard. Completed records remain saved in the event history.
    const toPaise = amount => Math.round((Number(amount) || 0) * 100);
    const totals = { bookedEventValue: 0, advanceCollected: 0, amountReceived: 0, pendingPayments: 0 };

    events.forEach(event => {
        // Keep the event in the booked-value summary from confirmed booking
        // through Event Execution. Moving to Pending Bill removes it here;
        // the billing pipeline then becomes the source of truth.
        const isBookedValueStage = event.status === 'advance-paid' || event.status === 'event-completed';
        if (!isBookedValueStage) return;

        const payments = event.payments || [];
        const paid = payments.reduce((sum, payment) => sum + toPaise(payment.amount), 0);
        const { grandTotal } = getEventInvoiceCalculations(event);
        const pending = Math.max(0, toPaise(grandTotal) - paid);
        totals.bookedEventValue += toPaise(grandTotal);
        totals.advanceCollected += payments
            .filter(payment => String(payment.method || '').toLowerCase().includes('advance'))
            .reduce((sum, payment) => sum + toPaise(payment.amount), 0);
        totals.amountReceived += paid; // Includes advance payments; do not add the two cards together.
        totals.pendingPayments += pending;
    });

    return Object.fromEntries(Object.entries(totals).map(([key, amount]) => [key, amount / 100]));
}

function renderDashboard() {
    const totalInquiries = appState.events.length;
    const activeEvents = appState.events.filter(e => e.status !== 'delivered' && e.status !== 'enquiry').length;
    const completedEvents = appState.events.filter(e => e.status === 'delivered').length;
    const today = getTodayDateString();
    const financials = getDashboardFinancialSummary(appState.events);
    const staffPresent = appState.attendance.filter(a => a.date === today).length;

    document.getElementById('stat-total-inquiries').textContent = totalInquiries;
    document.getElementById('stat-active-events').textContent = activeEvents;
    document.getElementById('stat-booked-value').textContent = '₹' + financials.bookedEventValue.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    document.getElementById('stat-advance-collected').textContent = '₹' + financials.advanceCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    document.getElementById('stat-completed-events').textContent = completedEvents;
    document.getElementById('stat-pending-payments').textContent = '₹' + financials.pendingPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 });
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

        // Highlight anything happening within the next 7 days so it stands
        // out from the rest of the upcoming list at a glance.
        const evtDate = new Date(evt.eventDate);
        evtDate.setHours(0, 0, 0, 0);
        const daysAway = Math.round((evtDate - todayDate) / (1000 * 60 * 60 * 24));
        const isWithinWeek = daysAway >= 0 && daysAway <= 7;

        if (isWithinWeek) {
            tr.className = 'row-highlight-week';
        }

        tr.innerHTML = `
            <td>
                <strong>${formatDisplayDate(evt.eventDate)}</strong>
                ${isWithinWeek ? `<span class="badge-this-week">${daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`}</span>` : ''}
            </td>
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
    const isBookedStage = getStageIndex(stageKey) >= getStageIndex('advance-paid');
    stageEvents.forEach(evt => {
        const calcs = getEventInvoiceCalculations(evt);
        const documentCount = Array.isArray(evt.documents) ? evt.documents.length : 0;
        const financeCount = getEventFinanceEntries(evt.id).length;
        const eventDetailsForm = getEventDetailForm(evt.id);
        const nextStage = getNextStageForEvent(evt);
        const nextLabel = nextStage ? nextStage.label : '';

        const card = document.createElement('div');
        card.className = 'kanban-card';

        card.innerHTML = `
            <h4>${evt.clientName}</h4>
            <p><i class="fa-solid fa-calendar-day"></i> ${formatDisplayDate(evt.eventDate)}</p>
            <p><i class="fa-solid fa-tags"></i> ${evt.serviceType}</p>
            <p class="kanban-card-total">Quote: ₹${calcs.grandTotal.toLocaleString('en-IN')}</p>
            <p>Paid: ₹${calcs.totalPaid.toLocaleString('en-IN')} | Bal: ₹${calcs.pendingBalance.toLocaleString('en-IN')}</p>
            ${evt.confirmedWithoutAdvance && getStageIndex(evt.status) >= getStageIndex('event-completed')
                ? '<p class="without-advance-status"><i class="fa-solid fa-circle-check"></i> Confirmed without advance</p>'
                : ''}
            ${stageKey === 'event-completed' ? getEventDetailsFormCardHtml(evt) : ''}
            <div class="kanban-card-actions no-print">
                <button onclick="event.stopPropagation(); startQuotationForEvent('${evt.id}')" title="Quotation"><i class="fa-solid fa-file-signature"></i></button>
                <button onclick="event.stopPropagation(); startBillingForEvent('${evt.id}')" title="Invoicing"><i class="fa-solid fa-file-invoice-dollar"></i></button>
            </div>
            ${stageKey === 'advance-paid' ? `
            <button class="btn btn-block kanban-documents-btn no-print" onclick="event.stopPropagation(); openEventDocuments('${evt.id}')">
                <i class="fa-solid fa-folder-open"></i> Documents${documentCount ? ` (${documentCount})` : ''}
            </button>` : ''}
            ${stageKey === 'event-completed' ? `
            <div class="event-form-actions no-print">
                <button class="btn btn-block event-form-share-btn" onclick="event.stopPropagation(); shareEventDetailsForm('${evt.id}')">
                    <i class="fa-brands fa-whatsapp"></i> ${eventDetailsForm ? 'Share Form Again' : 'Share Details Form'}
                </button>
                ${eventDetailsForm?.status === 'submitted' ? `<button class="btn btn-block event-form-view-btn" onclick="event.stopPropagation(); openEventDetailsResponse('${evt.id}')"><i class="fa-solid fa-eye"></i> View Customer Details</button>` : ''}
            </div>` : ''}
            ${isBookedStage && currentAdminEmail ? `
            <button class="btn btn-block kanban-expenses-btn no-print" onclick="event.stopPropagation(); openEventExpenses('${evt.id}')">
                <i class="fa-solid fa-lock"></i> Admin Expenses${financeCount ? ` (${financeCount})` : ''}
            </button>` : ''}
            ${stageKey === 'quotation' ? `
            <label class="without-advance-toggle no-print" onclick="event.stopPropagation()">
                <input type="checkbox" ${evt.confirmedWithoutAdvance ? 'checked' : ''} onchange="setWithoutAdvanceConfirmation('${evt.id}', this.checked)">
                <span><strong>Without Advance</strong> — Event Confirmed</span>
            </label>` : ''}
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
        toggleReferredByField();
    }
}

// Shows the "Referred By" name field only when Lead Source is set to
// Referral, so we know exactly who to thank/reward for the referral.
function toggleReferredByField() {
    const isReferral = document.getElementById('lead-source').value === 'Referral';
    document.getElementById('referred-by-group').classList.toggle('hidden', !isReferral);
    if (!isReferral) {
        document.getElementById('referred-by').value = '';
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
