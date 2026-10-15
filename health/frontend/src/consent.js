// Cookie-Einwilligung nach DSGVO/TDDDG (EU) und revDSG (Schweiz).
// Opt-in: Ohne Zustimmung wird Google Analytics gar nicht erst geladen.

const GA_ID = 'G-DYG1W5XB6R';
const CONSENT_KEY = 'auramind_consent';
const CONSENT_VERSION = 1;
// Einwilligung nach 12 Monaten erneut einholen.
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

let gaLoaded = false;

function readConsent() {
    try {
        const raw = localStorage.getItem(CONSENT_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.version !== CONSENT_VERSION) return null;
        if (Date.now() - data.timestamp > CONSENT_MAX_AGE_MS) return null;
        return data;
    } catch (e) {
        return null;
    }
}

function writeConsent(analytics) {
    try {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({
            version: CONSENT_VERSION,
            analytics,
            timestamp: Date.now(),
        }));
    } catch (e) { /* ignore */ }
}

function loadGoogleAnalytics() {
    if (gaLoaded) return;
    gaLoaded = true;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
}

function deleteAnalyticsCookies() {
    const host = location.hostname;
    const domains = ['', host, '.' + host, '.' + host.split('.').slice(-2).join('.')];
    document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        if (name === '_ga' || name.startsWith('_ga_') || name === '_gid' || name === '_gat') {
            domains.forEach((d) => {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` + (d ? `; domain=${d}` : '');
            });
        }
    });
}

function setBannerVisible(visible) {
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;
    banner.classList.toggle('hidden', !visible);
    banner.classList.toggle('flex', visible);
}

export const consent = {
    init() {
        const stored = readConsent();
        if (stored === null) {
            setBannerVisible(true);
        } else if (stored.analytics) {
            loadGoogleAnalytics();
        }
    },

    accept() {
        writeConsent(true);
        setBannerVisible(false);
        loadGoogleAnalytics();
    },

    reject() {
        const wasLoaded = gaLoaded;
        writeConsent(false);
        setBannerVisible(false);
        window.gtag('consent', 'update', { analytics_storage: 'denied' });
        deleteAnalyticsCookies();
        // Ein bereits geladenes gtag.js lässt sich nicht entladen – Neuladen stoppt es sicher.
        if (wasLoaded) location.reload();
    },

    // Einstellungen erneut öffnen (Widerruf jederzeit möglich, Art. 7 Abs. 3 DSGVO).
    openSettings() {
        setBannerVisible(true);
    },
};
