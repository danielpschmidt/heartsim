import '@fontsource-variable/inter/wght.css';
import './style.css';
import { app } from './app.js';
import { consent } from './consent.js';

window.app = app;
window.consent = consent;

window.addEventListener('DOMContentLoaded', () => {
    consent.init();
    app.init();
});
