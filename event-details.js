const EVENT_DETAILS_API = '/api/event-details-form';
let currentFormData = null;

function byId(id) { return document.getElementById(id); }
function show(id) { byId(id).classList.remove('hidden'); }
function hide(id) { byId(id).classList.add('hidden'); }

function formatEventDate(value) {
    if (!value) return '—';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getToken() {
    return new URLSearchParams(window.location.search).get('token') || '';
}

function setValue(id, value) { byId(id).value = value || ''; }

function fillResponse(response = {}) {
    const session = Array.from(document.querySelectorAll('input[name="session"]'))
        .find(input => input.value === (response.session || ''));
    if (session) session.checked = true;
    setValue('event-start-time', response.eventStartTime);
    setValue('main-program-time', response.mainProgramTime);
    setValue('setup-access-time', response.setupAccessTime);
    setValue('contact-name', response.contactName);
    setValue('contact-phone', response.contactPhone);
    setValue('venue-address', response.venueAddress || currentFormData?.event?.venue);
    setValue('schedule-notes', response.scheduleNotes);
    setValue('special-instructions', response.specialInstructions);
}

function renderLoaded(data) {
    currentFormData = data;
    byId('customer-heading').textContent = `Hello ${data.event.customerName || 'Customer'}!`;
    byId('summary-date').textContent = formatEventDate(data.event.eventDate);
    byId('summary-service').textContent = data.event.serviceType || '—';
    byId('summary-venue').textContent = data.event.venue || 'Not added yet';
    fillResponse(data.response);
    hide('loading-state');
    if (data.status === 'submitted') show('success-state');
    else show('form-content');
}

async function loadForm() {
    const token = getToken();
    if (!token) return showFatal('This form link is incomplete. Please ask DD Events for a new link.');
    try {
        const response = await fetch(`${EVENT_DETAILS_API}?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'This form could not be loaded.');
        renderLoaded(data);
    } catch (error) {
        showFatal(error.message || 'This form could not be loaded. Please try again.');
    }
}

function showFatal(message) {
    hide('loading-state');
    hide('form-content');
    byId('error-message').textContent = message;
    show('error-state');
}

function collectResponse() {
    return {
        session: document.querySelector('input[name="session"]:checked')?.value || '',
        eventStartTime: byId('event-start-time').value,
        mainProgramTime: byId('main-program-time').value,
        setupAccessTime: byId('setup-access-time').value,
        contactName: byId('contact-name').value.trim(),
        contactPhone: byId('contact-phone').value.trim(),
        venueAddress: byId('venue-address').value.trim(),
        scheduleNotes: byId('schedule-notes').value.trim(),
        specialInstructions: byId('special-instructions').value.trim()
    };
}

function showFormError(message) {
    byId('form-error').textContent = message;
    show('form-error');
    byId('form-error').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function submitForm(event) {
    event.preventDefault();
    hide('form-error');
    if (!event.currentTarget.reportValidity()) return;
    const responseData = collectResponse();
    if (!responseData.session) return showFormError('Please choose Morning, Evening, Full Day, or Other.');

    const button = byId('submit-button');
    button.disabled = true;
    button.textContent = 'Saving...';
    try {
        const response = await fetch(EVENT_DETAILS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: getToken(), response: responseData })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The form could not be saved.');
        currentFormData = data;
        hide('form-content');
        show('success-state');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showFormError(error.message || 'The form could not be saved. Please try again.');
    } finally {
        button.disabled = false;
        button.textContent = 'Submit Event Details';
    }
}

byId('event-details-form').addEventListener('submit', submitForm);
byId('edit-response-button').addEventListener('click', () => {
    hide('success-state');
    fillResponse(currentFormData?.response || {});
    show('form-content');
});
loadForm();
