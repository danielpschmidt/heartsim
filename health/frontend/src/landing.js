import '@fontsource-variable/inter/wght.css';
import './style.css';
import { consent } from './consent.js';

window.consent = consent;

function toggleTheme() {
    const root = document.documentElement;
    const next = root.classList.contains('light') ? 'dark' : 'light';
    root.classList.remove('light', 'dark');
    root.classList.add(next);
    try {
        localStorage.setItem('auramind_theme', next);
    } catch (e) { /* ignore */ }
}

function toggleMobileNav(force) {
    const nav = document.getElementById('mobile-nav');
    const open = typeof force === 'boolean' ? force : nav.classList.contains('hidden');
    nav.classList.toggle('hidden', !open);
    document.getElementById('mobile-nav-btn').setAttribute('aria-expanded', String(open));
}

// Bereits angemeldete Personen direkt zur App führen statt zur Registrierung.
async function detectLogin() {
    try {
        const res = await fetch('/api/auth/me.php', { credentials: 'include' });
        if (!res.ok) return;
        const me = await res.json();
        if (!me.user) return;
        document.querySelectorAll('[data-cta="register"]').forEach((el) => {
            el.textContent = 'Zur App →';
            el.setAttribute('href', '/app/');
        });
        document.querySelectorAll('[data-cta="login"]').forEach((el) => el.classList.add('hidden'));
    } catch (e) { /* Homepage funktioniert auch ohne API */ }
}

window.home = { toggleTheme, toggleMobileNav };

window.addEventListener('DOMContentLoaded', () => {
    consent.init();
    document.getElementById('footer-year').textContent = new Date().getFullYear();
    document.querySelectorAll('#mobile-nav a').forEach((a) => a.addEventListener('click', () => toggleMobileNav(false)));
    detectLogin();
});
