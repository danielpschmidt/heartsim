import { api, setCsrfToken, ApiError } from './api.js';
import { escapeHtml, formatMessageHtml } from './util.js';

const GOAL_PRESETS = {
    mania: [
        { id: 'm1', title: 'Reizüberflutung drosseln & Sinnesruhe', desc: 'Bildschirme dimmen, Musik abschalten und Sinnesreize minimieren.' },
        { id: 'm2', title: 'Impuls-Kauf & Vertrags-Stopp (48h-Pause)', desc: 'Alle finanziellen und vertraglichen Entscheidungen um 48h vertagen.' },
        { id: 'm3', title: 'Schlaf-Rhythmus verteidigen', desc: 'Trotz fehlendem Müdigkeitsgefühl feste Bettruhe und Dunkelheit wahren.' },
    ],
    depression: [
        { id: 'd1', title: '1%-Mikroschritt aus der Lähmung', desc: 'Nur eine winzige 2-Minuten-Aufgabe ohne Leistungsdruck umsetzen.' },
        { id: 'd2', title: 'Gedankenschleifen & Selbstvorwürfe stoppen', desc: 'Negative Grübelspiralen durch kognitive Distanzierung unterbrechen.' },
        { id: 'd3', title: 'Körperliche Grundversorgung sichern', desc: 'Ausreichend Wasser trinken, eine Kleinigkeit essen und frische Luft holen.' },
    ],
    mixed: [
        { id: 'x1', title: 'Akute innere Zerrissenheit entladen', desc: 'Sicheres Ventil für hohe Agitation (Kältereiz, Atemarbeit, Bewegung).' },
        { id: 'x2', title: 'Gedankensortierung & 5-Sinne-Erdung', desc: 'Mit der 5-4-3-2-1 Methode festen Boden unter den Füßen spüren.' },
        { id: 'x3', title: 'Reiz-Notbremse & Deeskalation', desc: 'Konfliktsituationen sofort verlassen und das Nervensystem beruhigen.' },
    ],
    balanced: [
        { id: 'b1', title: 'Frühwarnzeichen wachsam beobachten', desc: 'Kleine Veränderungen im Schlafrhythmus oder Impulslevel festhalten.' },
        { id: 'b2', title: 'Gleichmäßigen Tagesrhythmus festigen', desc: 'Feste Zeiten für Aufstehen, Mahlzeiten und Ruhephasen beibehalten.' },
        { id: 'b3', title: 'Achtsamkeits- & Dankbarkeitsübung', desc: 'Kurze Reflexion über die eigene emotionale Stabilität durchführen.' },
    ],
};

// Behavioral-Activation-Vorschläge gegen das "mir fällt nichts ein"-Problem bei
// depressiver Antriebslosigkeit. Bewusst sehr klein gehalten (1%-Mikroschritte).
const ACTIVITY_SUGGESTIONS = [
    {
        category: 'Bewegung', icon: '🚶', items: [
            { title: 'Einmal ums Haus/den Block gehen', difficulty: 'tiny' },
            { title: 'Am offenen Fenster 5x tief durchatmen', difficulty: 'tiny' },
            { title: '10 Minuten spazieren gehen', difficulty: 'small' },
        ],
    },
    {
        category: 'Selbstfürsorge', icon: '🛁', items: [
            { title: 'Ein Glas Wasser trinken', difficulty: 'tiny' },
            { title: 'Gesicht waschen & Zähne putzen', difficulty: 'tiny' },
            { title: 'Eine warme Dusche nehmen', difficulty: 'small' },
        ],
    },
    {
        category: 'Sozialer Kontakt', icon: '💬', items: [
            { title: 'Einer Person eine kurze Nachricht schreiben', difficulty: 'tiny' },
            { title: 'Bei einer vertrauten Person kurz anrufen', difficulty: 'small' },
        ],
    },
    {
        category: 'Erledigung', icon: '📦', items: [
            { title: 'Ein Geschirrteil abwaschen', difficulty: 'tiny' },
            { title: 'Einen Tisch/eine Fläche kurz aufräumen', difficulty: 'small' },
            { title: 'Eine offene E-Mail beantworten', difficulty: 'medium' },
        ],
    },
];

const PROFILES = {
    mania: {
        tendency: 'mania',
        title: 'Hohe Übererregung & Impulsdruck',
        badge: '⚡ Übererregung / Hypomanie',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        desc: 'Signifikant reduziertes Schlafbedürfnis, Gedankensprünge und starker Drang zu Handlungen oder Käufen. Ziel: Reize drosseln, 48h-Pausen aktivieren und Schlaf wahren.',
    },
    depression: {
        tendency: 'depression',
        title: 'Erhöhte Erschöpfung & Energielosigkeit',
        badge: '🌧️ Depressive Erschöpfung',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        desc: 'Schwere im Körper, verlangsamtes Denken und Neigung zu Rückzug und Selbstvorwürfen. Ziel: Radikale 1%-Mikroschritte ohne Druck und sanfte Selbstfürsorge.',
    },
    mixed: {
        tendency: 'mixed',
        title: 'Agitierter Mischzustand',
        badge: '🌪️ Mischzustand (Agitation)',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        desc: 'Gleichzeitige körperliche Getriebenheit bei quälenden negativen Gedanken oder extremer Reizbarkeit. Ziel: Physische Notbremse (Kältereiz), 5-Sinne-Erdung und Deeskalation.',
    },
    balanced: {
        tendency: 'balanced',
        title: 'Überwiegend stabiler Gleichgewichtszustand',
        badge: '🌱 Stabile Balance',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        desc: 'Ausgeglichenes Energielevel und normale Impulskontrolle. Ziel: Achtsame Prophylaxe, Frühwarnzeichen beobachten und gesunde Rhythmen festigen.',
    },
};

const ACTIVE_SESSION_KEY = 'auramind_active_session';

export const app = {
    state: {
        activeTab: 'coach',
        coachStep: 'assessment',
        currentUser: null,
        isAdmin: false,
        currentProfile: null,
        selectedGoal: '',
        currentSessionId: null,
        editSessionId: null,
        chatMessages: [],
        isAiLoading: false,
        breathingTimer: null,
        breathingRunning: false,
        breathingCountdown: 4,
        breathingPhase: 0,
    },

    async init() {
        document.getElementById('footer-year').textContent = new Date().getFullYear();
        try {
            const me = await api.me();
            setCsrfToken(me.csrfToken);
            if (me.user) {
                this.state.currentUser = me.user;
                this.state.isAdmin = !!me.isAdmin;
                this.switchTab('coach');
                if (!me.user.healthConsent) {
                    this.openModal('modal-health-consent');
                } else {
                    await this.enterCoach();
                }
            } else {
                this.switchTab('auth');
            }
        } catch (e) {
            this.showToast('Verbindung zum Server fehlgeschlagen.');
            this.switchTab('auth');
        }
        this.updateAuthUI();
        this.handleDeepLink();
    },

    /** Links von der Homepage: /app/#register, #datenschutz, #impressum, #kontakt. */
    handleDeepLink() {
        const hash = location.hash.slice(1);
        if (!hash) return;
        if (['datenschutz', 'impressum', 'kontakt'].includes(hash)) {
            this.openModal(`modal-${hash}`);
        } else if (hash === 'register' && !this.state.currentUser) {
            this.setAuthMode('register');
        }
        history.replaceState(null, '', location.pathname + location.search);
    },

    toggleTheme() {
        const root = document.documentElement;
        const next = root.classList.contains('light') ? 'dark' : 'light';
        root.classList.remove('light', 'dark');
        root.classList.add(next);
        try {
            localStorage.setItem('auramind_theme', next);
        } catch (e) { /* ignore */ }
    },

    async refreshCsrf() {
        const me = await api.me();
        setCsrfToken(me.csrfToken);
        return me;
    },

    showToast(msg) {
        const toast = document.getElementById('toast-el');
        const text = document.getElementById('toast-text');
        text.textContent = msg;
        toast.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
        }, 3200);
    },

    switchTab(tabId) {
        // Profil nur für angemeldete Nutzer.
        if (tabId === 'profile' && !this.state.currentUser) tabId = 'auth';
        // Bearbeitungsmodus nur, solange man im Coach bleibt.
        if (tabId !== 'coach') this.state.editSessionId = null;
        this.state.activeTab = tabId;
        const tabs = ['coach', 'tracking', 'history', 'profile', 'admin', 'auth'];
        tabs.forEach((t) => {
            const el = document.getElementById(`tab-${t}`);
            const nav = document.getElementById(`nav-${t}`);
            if (el) el.classList.toggle('hidden', t !== tabId);
            if (nav) {
                nav.className = t === tabId
                    ? 'px-3 py-1.5 rounded-lg transition font-bold bg-teal-500 text-slate-950 flex items-center gap-1.5'
                    : 'px-3 py-1.5 rounded-lg transition font-medium text-slate-300 hover:text-white flex items-center gap-1.5';
            }
        });

        if (tabId === 'tracking') this.renderTracking();
        if (tabId === 'history') this.renderHistory();
        if (tabId === 'profile') this.renderProfileForm();
        if (tabId === 'admin') this.renderAdminTab();

        this.updateAuthUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async handleUserHeaderAction() {
        if (this.state.currentUser) {
            try {
                await api.logout();
            } catch (e) { /* ignore */ }
            await this.resetToLoggedOut();
            this.showToast('Erfolgreich abgemeldet.');
        } else {
            this.switchTab('auth');
        }
    },

    async resetToLoggedOut() {
        this.forgetActiveSession();
        this.state.currentUser = null;
        this.state.isAdmin = false;
        this.state.currentSessionId = null;
        this.state.chatMessages = [];
        await this.refreshCsrf();
        this.switchTab('auth');
    },

    async submitHealthConsent() {
        if (!document.getElementById('health-consent-checkbox').checked) return;
        try {
            const res = await api.giveHealthConsent();
            this.state.currentUser = res.user;
            this.closeModal('modal-health-consent');
            await this.enterAfterLogin();
            this.showToast('Danke! Deine Einwilligung wurde gespeichert.');
        } catch (e) {
            this.showToast(e.message || 'Einwilligung konnte nicht gespeichert werden.');
        }
    },

    async declineHealthConsent() {
        this.closeModal('modal-health-consent');
        try {
            await api.logout();
        } catch (e) { /* ignore */ }
        await this.resetToLoggedOut();
        this.showToast('Abgemeldet. Ohne Einwilligung kann AuraMind keine Gesundheitsdaten bearbeiten.');
    },

    openDeleteAccount() {
        document.getElementById('delete-account-password').value = '';
        this.openModal('modal-delete-account');
        document.getElementById('delete-account-password').focus();
    },

    closeDeleteAccount() {
        this.closeModal('modal-delete-account');
        // Bestandskonto ohne Einwilligung: zurück zur Einwilligungsabfrage statt in die App.
        if (this.state.currentUser && !this.state.currentUser.healthConsent) {
            this.openModal('modal-health-consent');
        }
    },

    async submitDeleteAccount() {
        const input = document.getElementById('delete-account-password');
        const password = input.value;
        if (!password) return;
        try {
            await api.deleteAccount(password);
            input.value = '';
            this.closeModal('modal-delete-account');
            await this.resetToLoggedOut();
            this.showToast('Dein Konto und alle Daten wurden gelöscht.');
        } catch (e) {
            this.showToast(e.message || 'Löschen fehlgeschlagen.');
        }
    },

    updateAuthUI() {
        const btn = document.getElementById('user-action-btn');
        const badge = document.getElementById('history-badge');
        document.getElementById('nav-profile').classList.toggle('hidden', !this.state.currentUser);
        if (this.state.currentUser) {
            btn.innerHTML = '🚪';
            btn.title = `Angemeldet als ${this.state.currentUser.name} (Abmelden)`;
        } else {
            btn.innerHTML = '👤';
            btn.title = 'Anmelden / Registrieren';
            if (badge) badge.classList.add('hidden');
        }
    },

    showCoachStep(step) {
        this.state.coachStep = step;
        document.getElementById('coach-step-assessment').classList.toggle('hidden', step !== 'assessment');
        document.getElementById('coach-step-goals').classList.toggle('hidden', step !== 'goals');
        document.getElementById('coach-step-chat').classList.toggle('hidden', step !== 'chat');
    },

    submitAssessment() {
        const form = document.getElementById('assessment-form');
        const formData = new FormData(form);

        const energySleep = formData.get('energySleep');
        const thoughtSpeed = formData.get('thoughtSpeed');
        const behavior = formData.get('behavior');
        const symptoms = formData.getAll('symptoms');

        if (!energySleep || !thoughtSpeed || !behavior) {
            this.showToast('Bitte beantworte alle 3 Kernfragen.');
            return;
        }

        const scores = { mania: 0, depression: 0, mixed: 0, balanced: 0 };
        if (energySleep === 'high_mania') scores.mania += 3;
        else if (energySleep === 'low_dep') scores.depression += 3;
        else if (energySleep === 'agitated_mixed') scores.mixed += 3;
        else scores.balanced += 2;

        if (thoughtSpeed === 'racing_mania') scores.mania += 3;
        else if (thoughtSpeed === 'foggy_dep') scores.depression += 3;
        else if (thoughtSpeed === 'looping_mixed') { scores.mixed += 2; scores.depression += 1; }
        else scores.balanced += 2;

        if (behavior === 'risk_mania') scores.mania += 3;
        else if (behavior === 'retreat_dep') scores.depression += 3;
        else if (behavior === 'irritable_mixed') scores.mixed += 3;
        else scores.balanced += 2;

        symptoms.forEach((s) => {
            if (s === 'shopping') scores.mania += 1;
            if (s === 'heavy') scores.depression += 1;
            if (s === 'tension') scores.mixed += 1;
            if (s === 'no_appetite') { scores.mania += 1; scores.depression += 1; }
        });

        let detected = 'balanced';
        if (scores.mixed >= 4 || (scores.mania >= 3 && scores.depression >= 3)) detected = 'mixed';
        else if (scores.mania > scores.depression && scores.mania > scores.balanced) detected = 'mania';
        else if (scores.depression > scores.mania && scores.depression > scores.balanced) detected = 'depression';

        this.state.currentProfile = PROFILES[detected];
        this.renderGoalsStep();
        this.showCoachStep('goals');
    },

    renderGoalsStep() {
        const profile = this.state.currentProfile;
        const card = document.getElementById('deduced-profile-card');
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold px-3 py-1 rounded-full border ${escapeHtml(profile.badgeColor)}">
                    ${escapeHtml(profile.badge)}
                </span>
                <button id="back-to-assessment-btn" class="text-xs text-slate-400 hover:text-white transition">
                    ← Fragen anpassen
                </button>
            </div>
            <h3 class="text-xl font-bold text-white">${escapeHtml(profile.title)}</h3>
            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${escapeHtml(profile.desc)}</p>
        `;
        card.querySelector('#back-to-assessment-btn').onclick = () => this.showCoachStep('assessment');

        const container = document.getElementById('goals-list-container');
        container.innerHTML = '';
        const goals = GOAL_PRESETS[profile.tendency] || GOAL_PRESETS.balanced;
        goals.forEach((g) => {
            const item = document.createElement('div');
            item.className = 'p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-teal-500 cursor-pointer transition flex items-center justify-between group';
            item.onclick = () => this.startCoachSession(g.title);
            item.innerHTML = `
                <div class="space-y-1 pr-3">
                    <div class="text-sm font-bold text-white group-hover:text-teal-300 transition">${escapeHtml(g.title)}</div>
                    <div class="text-xs text-slate-400">${escapeHtml(g.desc)}</div>
                </div>
                <span class="shrink-0 px-3 py-1 rounded-xl bg-slate-800 text-teal-400 font-bold text-xs group-hover:bg-teal-500 group-hover:text-slate-950 transition">
                    Wählen →
                </span>
            `;
            container.appendChild(item);
        });
    },

    startCoachWithCustomGoal() {
        const input = document.getElementById('custom-goal-input');
        const val = input.value.trim();
        this.startCoachSession(val || 'Ruhe und Stabilität finden');
    },

    async startCoachSession(goalTitle) {
        if (!this.state.currentUser) {
            this.switchTab('auth');
            this.showToast('Bitte melde dich kurz an, um deine Sitzung zu speichern.');
            return;
        }

        this.state.selectedGoal = goalTitle;

        const payload = {
            tendency: this.state.currentProfile.tendency,
            title: this.state.currentProfile.title,
            goal: goalTitle,
        };

        // Bearbeitungsmodus (aus dem Profil): bestehende Sitzung anpassen statt neue anlegen.
        if (this.state.editSessionId) {
            try {
                const result = await api.updateSession({ id: this.state.editSessionId, ...payload });
                this.openChatSession(result.session);
                this.showToast('Coaching-Einstellung geändert.');
            } catch (e) {
                this.showToast(e.message || 'Einstellung konnte nicht geändert werden.');
            }
            return;
        }

        let result;
        try {
            result = await api.createSession(payload);
        } catch (e) {
            this.showToast('Sitzung konnte nicht gestartet werden.');
            return;
        }

        this.openChatSession(result.session, result.suggestions);
    },

    /** Zeigt eine (neue oder gespeicherte) Sitzung im Chat an und merkt sie sich für einen Reload. */
    openChatSession(session, suggestions = []) {
        this.state.editSessionId = null;
        this.state.currentProfile = PROFILES[session.tendency] || PROFILES.balanced;
        this.state.selectedGoal = session.goal;
        this.state.currentSessionId = session.id;
        this.state.chatMessages = session.messages || [];
        this.rememberActiveSession(session.id);
        this.showCoachStep('chat');

        document.getElementById('chat-current-goal').textContent = `Ziel: ${session.goal}`;
        const badge = document.getElementById('chat-profile-badge');
        badge.className = `text-[12px] px-2 py-0.5 rounded-full font-semibold border ${this.state.currentProfile.badgeColor}`;
        badge.textContent = this.state.currentProfile.badge;

        const aiStatus = document.getElementById('chat-ai-status');
        aiStatus.className = 'text-[12px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
        aiStatus.textContent = 'Lokale KVT-Engine';

        this.renderChatMessages();
        this.renderQuickReplies(suggestions);
    },

    /** Nach Login/Reload: zuletzt offene Sitzung wiederherstellen, sonst neuer Check-in. */
    async enterCoach() {
        const sessionId = this.readActiveSession();
        if (sessionId) {
            try {
                const res = await api.listSessions();
                const session = res.sessions.find((s) => s.id === sessionId);
                if (session) {
                    this.openChatSession(session);
                    return;
                }
            } catch (e) { /* dann eben neuer Check-in */ }
            this.forgetActiveSession();
        }
        this.showCoachStep('assessment');
    },

    async resumeSession(sessionId) {
        try {
            const res = await api.listSessions();
            const session = res.sessions.find((s) => s.id === sessionId);
            if (!session) {
                this.showToast('Sitzung nicht gefunden.');
                return;
            }
            this.switchTab('coach');
            this.openChatSession(session);
        } catch (e) {
            this.showToast('Sitzung konnte nicht geladen werden.');
        }
    },

    startNewCheckin() {
        this.state.editSessionId = null;
        this.forgetActiveSession();
        this.switchTab('coach');
        this.showCoachStep('assessment');
    },

    /** Check-in erneut durchlaufen; das Ergebnis ersetzt Tendenz + Ziel der bestehenden Sitzung. */
    editCoachingSettings(sessionId) {
        this.state.editSessionId = sessionId;
        this.switchTab('coach');
        this.showCoachStep('assessment');
        this.showToast('Beantworte die Fragen neu – deine Sitzung wird danach angepasst.');
    },

    /** Nach dem Login: mit Verlauf direkt dorthin, sonst zum Coach. */
    async enterAfterLogin() {
        let hasHistory = false;
        try {
            const res = await api.listSessions();
            hasHistory = res.sessions.length > 0;
        } catch (e) { /* dann Coach */ }

        if (hasHistory) {
            this.switchTab('history');
        } else {
            this.switchTab('coach');
            this.showCoachStep('assessment');
        }
    },

    rememberActiveSession(sessionId) {
        try {
            localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ userId: this.state.currentUser?.id, sessionId }));
        } catch (e) { /* ignore */ }
    },

    readActiveSession() {
        try {
            const stored = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) || 'null');
            return stored && stored.userId === this.state.currentUser?.id ? stored.sessionId : null;
        } catch (e) {
            return null;
        }
    },

    forgetActiveSession() {
        try {
            localStorage.removeItem(ACTIVE_SESSION_KEY);
        } catch (e) { /* ignore */ }
    },

    renderChatMessages() {
        const container = document.getElementById('chat-messages-container');
        container.innerHTML = '';
        this.state.chatMessages.forEach((msg) => {
            const row = document.createElement('div');
            row.className = `flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`;
            const formatted = formatMessageHtml(msg.text);

            row.innerHTML = `
                <div class="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-md ${
                    msg.sender === 'user'
                        ? 'bg-teal-600 text-white rounded-tr-sm'
                        : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-sm'
                }">
                    <div>${formatted}</div>
                </div>
            `;
            container.appendChild(row);
        });
        container.scrollTop = container.scrollHeight;
    },

    renderQuickReplies(suggestions = []) {
        const container = document.getElementById('chat-quick-replies');
        container.innerHTML = '';
        suggestions.forEach((text) => {
            const btn = document.createElement('button');
            btn.className = 'whitespace-nowrap px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-teal-300 hover:text-white transition font-medium shrink-0';
            btn.textContent = text;
            btn.onclick = () => this.sendChatMessage(text);
            container.appendChild(btn);
        });
    },

    async sendChatMessage(predefinedText) {
        const input = document.getElementById('chat-input');
        const text = (predefinedText || input.value).trim();
        if (!text || this.state.isAiLoading || !this.state.currentSessionId) return;
        input.value = '';
        this.renderQuickReplies([]);

        this.state.chatMessages.push({ sender: 'user', text });
        this.renderChatMessages();

        this.state.isAiLoading = true;
        const container = document.getElementById('chat-messages-container');
        const typingEl = document.createElement('div');
        typingEl.id = 'typing-indicator';
        typingEl.className = 'flex items-center space-x-2 text-slate-400 text-xs py-2 px-3';
        typingEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span><span>AuraMind reflektiert deine Situation...</span>';
        container.appendChild(typingEl);
        container.scrollTop = container.scrollHeight;

        let res;
        try {
            res = await api.sendChat({ sessionId: this.state.currentSessionId, text });
        } catch (e) {
            res = {
                reply: 'Es gab ein Verbindungsproblem. Bitte versuche es gleich noch einmal.',
                suggestions: [],
            };
        }

        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();

        this.state.chatMessages.push({ sender: 'assistant', text: res.reply });
        this.state.isAiLoading = false;

        const aiStatus = document.getElementById('chat-ai-status');
        if (res.usedGemini) {
            aiStatus.className = 'text-[12px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 font-mono';
            aiStatus.innerHTML = '<span>✨</span> Gemini KI aktiv';
        }

        this.renderChatMessages();
        this.renderQuickReplies(res.suggestions);

        if (res.openBreathing) {
            this.openModal('modal-breathing');
        }
        if (res.notice === 'crisis_keywords_detected') {
            this.openModal('modal-sos');
            this.showToast('Wir haben Notfallkontakte für dich geöffnet.');
        }
    },

    async renderHistory() {
        const container = document.getElementById('history-list-container');
        if (!this.state.currentUser) {
            container.innerHTML = '';
            return;
        }

        let sessions = [];
        try {
            const res = await api.listSessions();
            sessions = res.sessions;
        } catch (e) {
            container.innerHTML = '<div class="p-6 text-center text-xs text-rose-300">Verlauf konnte nicht geladen werden.</div>';
            return;
        }

        if (sessions.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <span class="text-3xl">🧠</span>
                    <p class="text-sm text-slate-400">Bisher wurden noch keine Coaching-Sitzungen aufgezeichnet.</p>
                    <button id="history-start-checkin-btn" class="px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs hover:bg-teal-400 transition">
                        Jetzt ersten Check-in starten →
                    </button>
                </div>
            `;
            container.querySelector('#history-start-checkin-btn').onclick = () => {
                this.switchTab('coach');
                this.showCoachStep('assessment');
            };
            return;
        }

        container.innerHTML = '';
        sessions.forEach((sess) => {
            const card = document.createElement('div');
            card.className = 'p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg';

            let dialogHtml = '';
            (sess.messages || []).forEach((m) => {
                dialogHtml += `
                    <div class="p-2.5 rounded-xl text-xs ${m.sender === 'user' ? 'bg-teal-950/40 border border-teal-800/60 text-teal-200 ml-4' : 'bg-slate-800/60 border border-slate-700/60 text-slate-300 mr-4'}">
                        <span class="font-bold text-[12px] block opacity-70 mb-0.5">${m.sender === 'user' ? 'Du' : 'AuraMind Coach'}:</span>
                        ${formatMessageHtml(m.text)}
                    </div>
                `;
            });

            card.innerHTML = `
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div class="flex items-center space-x-2">
                        <span class="text-xs font-mono text-teal-400">${escapeHtml(sess.date)}</span>
                        <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-semibold">
                            ${escapeHtml(sess.title)}
                        </span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-[13px] text-slate-400">${(sess.messages || []).length} Nachrichten</span>
                        <button type="button" class="resume-btn px-3 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-[13px] font-bold transition">
                            💬 Weiterführen
                        </button>
                    </div>
                </div>
                <div class="text-xs text-slate-300">
                    <strong>Gewähltes Ziel:</strong> <span class="text-teal-300">${escapeHtml(sess.goal)}</span>
                </div>
                <div class="space-y-2 pt-1">
                    <div class="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Dialog-Protokoll:</div>
                    <div class="space-y-2 max-h-56 overflow-y-auto pr-1">${dialogHtml}</div>
                </div>
            `;
            card.querySelector('.resume-btn').onclick = () => this.resumeSession(sess.id);
            container.appendChild(card);
        });
    },

    async renderProfileForm() {
        if (!this.state.currentUser) return;
        let user;
        try {
            const res = await api.getProfile();
            user = res.user;
        } catch (e) {
            this.showToast('Profil konnte nicht geladen werden.');
            return;
        }
        document.getElementById('profile-name').value = user.name || '';
        document.getElementById('profile-email').value = user.email || '';
        document.getElementById('profile-age').value = user.age || '';
        document.getElementById('profile-civil-status').value = user.civilStatus || 'Ledig';
        document.getElementById('profile-location').value = user.location || '';
        document.getElementById('profile-emergency-contact').value = user.emergencyContact || '';
        document.getElementById('profile-notes').value = user.notes || '';

        this.renderProfileCoaching();
    },

    async renderProfileCoaching() {
        const box = document.getElementById('profile-coaching');
        let sessions = [];
        try {
            sessions = (await api.listSessions()).sessions;
        } catch (e) {
            box.textContent = 'Coaching-Sitzungen konnten nicht geladen werden.';
            return;
        }
        if (sessions.length === 0) {
            box.textContent = 'Noch keine Coaching-Sitzung. Starte oben deine erste.';
            return;
        }

        // Aktuelle Sitzung = zuletzt geöffnete, sonst die neueste.
        const activeId = this.readActiveSession();
        const current = sessions.find((s) => s.id === activeId) || sessions[0];
        const profile = PROFILES[current.tendency] || PROFILES.balanced;

        box.innerHTML = `
            <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Aktuelle Sitzung</span>
                    <span class="text-[12px] px-2 py-0.5 rounded-full font-semibold border ${escapeHtml(profile.badgeColor)}">${escapeHtml(profile.badge)}</span>
                    <span class="text-[13px] font-mono text-slate-500">${escapeHtml(current.date)}</span>
                </div>
                <div class="text-sm text-slate-200"><strong>Ziel:</strong> <span class="text-teal-300">${escapeHtml(current.goal)}</span></div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" data-action="resume" class="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition">💬 Weiterführen</button>
                    <button type="button" data-action="edit" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-300 text-xs font-semibold transition">⚙️ Coaching-Einstellung ändern</button>
                </div>
            </div>
            <p class="pt-2">Insgesamt ${sessions.length} ${sessions.length === 1 ? 'Sitzung' : 'Sitzungen'} – alle findest du im <button type="button" data-action="history" class="text-teal-300 underline hover:text-teal-200">Verlauf</button>.</p>
        `;
        box.querySelector('[data-action="resume"]').onclick = () => this.resumeSession(current.id);
        box.querySelector('[data-action="edit"]').onclick = () => this.editCoachingSettings(current.id);
        box.querySelector('[data-action="history"]').onclick = () => this.switchTab('history');
    },

    async saveProfile() {
        if (!this.state.currentUser) return;
        const payload = {
            name: document.getElementById('profile-name').value.trim(),
            age: document.getElementById('profile-age').value || null,
            civilStatus: document.getElementById('profile-civil-status').value,
            location: document.getElementById('profile-location').value.trim(),
            emergencyContact: document.getElementById('profile-emergency-contact').value.trim(),
            notes: document.getElementById('profile-notes').value.trim(),
        };
        try {
            const res = await api.updateProfile(payload);
            this.state.currentUser = res.user;
            this.showToast('Profildaten erfolgreich gespeichert!');
        } catch (e) {
            this.showToast(e.message || 'Speichern fehlgeschlagen.');
        }
    },

    async renderAdminTab() {
        const isAuth = this.state.isAdmin;
        document.getElementById('admin-login-view').classList.toggle('hidden', isAuth);
        document.getElementById('admin-dashboard-view').classList.toggle('hidden', !isAuth);
        if (!isAuth) return;

        try {
            const [cfg, usersRes] = await Promise.all([api.getAdminConfig(), api.listAdminUsers()]);

            document.getElementById('admin-api-key-masked').textContent = cfg.hasApiKey ? cfg.apiKeyMasked : 'Kein Key hinterlegt';
            document.getElementById('admin-api-key').value = '';
            document.getElementById('admin-model').value = cfg.model;
            document.getElementById('admin-pin-change').value = '';

            const tbody = document.getElementById('admin-user-tbody');
            tbody.innerHTML = '';
            usersRes.users.forEach((u) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="py-2.5 px-3 font-bold text-white">${escapeHtml(u.name)}</td>
                    <td class="py-2.5 px-3 text-slate-300">${u.age ?? '-'}</td>
                    <td class="py-2.5 px-3 text-slate-300">${escapeHtml(u.civilStatus)}</td>
                    <td class="py-2.5 px-3 text-slate-300">${escapeHtml(u.location)}</td>
                    <td class="py-2.5 px-3">
                        <span class="px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 text-[13px]">${u.sessionCount}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right">
                        <button type="button" data-user-id="${escapeHtml(u.id)}" onclick="app.deleteAdminUser(this)" class="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[13px] font-semibold transition whitespace-nowrap">
                            Löschen
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            this.showToast('Admin-Daten konnten nicht geladen werden.');
        }
    },

    /** Zweistufig: erster Klick fragt nach, zweiter Klick (innerhalb 5 s) löscht endgültig. */
    async deleteAdminUser(btn) {
        if (btn.dataset.confirm !== '1') {
            btn.dataset.confirm = '1';
            btn.textContent = 'Endgültig löschen?';
            btn.classList.add('bg-rose-600', 'text-white');
            setTimeout(() => {
                if (!btn.isConnected || btn.disabled) return;
                btn.dataset.confirm = '';
                btn.textContent = 'Löschen';
                btn.classList.remove('bg-rose-600', 'text-white');
            }, 5000);
            return;
        }

        btn.disabled = true;
        try {
            await api.deleteAdminUser(btn.dataset.userId);
            this.showToast('Nutzer und alle zugehörigen Daten wurden gelöscht.');
            await this.renderAdminTab();
        } catch (e) {
            btn.disabled = false;
            this.showToast(e.message || 'Löschen fehlgeschlagen.');
        }
    },

    async loginAdmin() {
        const input = document.getElementById('admin-pin-input');
        const pin = input.value.trim();
        try {
            await api.adminLogin(pin);
            input.value = '';
            this.state.isAdmin = true;
            await this.renderAdminTab();
            this.showToast('Admin-Zugang gewährt.');
        } catch (e) {
            this.showToast(e instanceof ApiError ? e.message : 'Falsche Admin-PIN.');
        }
    },

    async logoutAdmin() {
        try {
            await api.adminLogout();
        } catch (e) { /* ignore */ }
        this.state.isAdmin = false;
        this.renderAdminTab();
        this.showToast('Admin abgemeldet.');
    },

    async saveAdminConfig() {
        const apiKey = document.getElementById('admin-api-key').value.trim();
        const model = document.getElementById('admin-model').value.trim();
        const newPin = document.getElementById('admin-pin-change').value.trim();

        const payload = { model };
        if (apiKey) payload.apiKey = apiKey;
        if (newPin) payload.newPin = newPin;

        try {
            await api.saveAdminConfig(payload);
            this.showToast('Admin-Konfiguration gespeichert.');
            await this.renderAdminTab();
        } catch (e) {
            this.showToast(e.message || 'Speichern fehlgeschlagen.');
        }
    },

    async submitContact() {
        const btn = document.getElementById('contact-submit');
        const payload = {
            name: document.getElementById('contact-name').value.trim(),
            email: document.getElementById('contact-email').value.trim(),
            message: document.getElementById('contact-message').value.trim(),
            website: document.getElementById('contact-website').value,
        };

        btn.disabled = true;
        try {
            await api.sendContact(payload);
            document.getElementById('contact-form').reset();
            this.closeModal('modal-kontakt');
            this.showToast('Danke! Deine Nachricht wurde gesendet.');
        } catch (e) {
            this.showToast(e.message || 'Nachricht konnte nicht gesendet werden.');
        } finally {
            btn.disabled = false;
        }
    },

    setAuthMode(mode) {
        const isLogin = mode === 'login';
        document.getElementById('auth-form-login').classList.toggle('hidden', !isLogin);
        document.getElementById('auth-form-register').classList.toggle('hidden', isLogin);
        document.getElementById('auth-heading').textContent = isLogin ? 'Willkommen bei AuraMind' : 'Neues Konto erstellen';

        document.getElementById('auth-tab-login').className = `flex-1 py-2 rounded-lg font-bold transition ${isLogin ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'}`;
        document.getElementById('auth-tab-register').className = `flex-1 py-2 rounded-lg font-bold transition ${!isLogin ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'}`;
    },

    async handleLogin() {
        const email = document.getElementById('auth-login-email').value.trim();
        const password = document.getElementById('auth-login-password').value;

        try {
            const res = await api.login({ email, password });
            this.state.currentUser = res.user;
            if (!res.user.healthConsent) {
                this.updateAuthUI();
                this.openModal('modal-health-consent');
                return;
            }
            await this.enterAfterLogin();
            this.showToast(`Willkommen zurück, ${res.user.name}!`);
        } catch (e) {
            this.showToast(e.message || 'Anmeldung fehlgeschlagen.');
        }
    },

    async handleRegister() {
        const name = document.getElementById('auth-reg-name').value.trim();
        const email = document.getElementById('auth-reg-email').value.trim();
        const password = document.getElementById('auth-reg-password').value;
        const age = document.getElementById('auth-reg-age').value || null;
        const civilStatus = document.getElementById('auth-reg-civil-status').value;
        const location = document.getElementById('auth-reg-location').value.trim();
        const healthConsent = document.getElementById('auth-reg-health-consent').checked;

        if (!name || !email || !password) {
            this.showToast('Bitte alle Pflichtfelder ausfüllen.');
            return;
        }
        if (!healthConsent) {
            this.showToast('Bitte bestätige die Einwilligung zur Bearbeitung deiner Gesundheitsdaten.');
            return;
        }

        try {
            const res = await api.register({ name, email, password, age, civilStatus, location, healthConsent });
            this.state.currentUser = res.user;
            this.switchTab('coach');
            this.showCoachStep('assessment');
            this.showToast(`Konto für ${res.user.name} erstellt!`);
        } catch (e) {
            this.showToast(e.message || 'Registrierung fehlgeschlagen.');
        }
    },

    toggleBreathingExercise() {
        if (this.state.breathingRunning) {
            this.stopBreathing();
            document.getElementById('breathing-toggle-btn').textContent = 'Übung fortsetzen';
        } else {
            this.startBreathing();
            document.getElementById('breathing-toggle-btn').textContent = 'Übung pausieren';
        }
    },

    startBreathing() {
        this.state.breathingRunning = true;
        this.state.breathingPhase = 0;
        this.state.breathingCountdown = 4;
        this.updateBreathingCircle();

        if (this.state.breathingTimer) clearInterval(this.state.breathingTimer);
        this.state.breathingTimer = setInterval(() => {
            this.state.breathingCountdown--;
            if (this.state.breathingCountdown <= 0) {
                if (this.state.breathingPhase === 0) {
                    this.state.breathingPhase = 1;
                    this.state.breathingCountdown = 7;
                } else if (this.state.breathingPhase === 1) {
                    this.state.breathingPhase = 2;
                    this.state.breathingCountdown = 8;
                } else {
                    this.state.breathingPhase = 0;
                    this.state.breathingCountdown = 4;
                }
            }
            this.updateBreathingCircle();
        }, 1000);
    },

    updateBreathingCircle() {
        const circle = document.getElementById('breathing-circle');
        const counter = document.getElementById('breathing-counter');
        const label = document.getElementById('breathing-phase-label');
        const sub = document.getElementById('breathing-phase-sub');

        counter.textContent = this.state.breathingCountdown;
        if (this.state.breathingPhase === 0) {
            label.textContent = 'Einatmen (durch die Nase)';
            sub.textContent = 'Tief in den Bauchraum atmen (4s)';
            circle.style.transform = 'scale(1.5)';
            circle.style.backgroundColor = 'rgba(20, 184, 166, 0.35)';
            circle.style.borderColor = 'rgb(45, 212, 191)';
        } else if (this.state.breathingPhase === 1) {
            label.textContent = 'Atem entspannt anhalten';
            sub.textContent = 'Keine Anspannung im Halsbereich (7s)';
            circle.style.transform = 'scale(1.5)';
            circle.style.backgroundColor = 'rgba(168, 85, 247, 0.35)';
            circle.style.borderColor = 'rgb(192, 132, 252)';
        } else {
            label.textContent = 'Vollständig ausatmen (Mund)';
            sub.textContent = 'Mit weichem Rauschen ausatmen (8s)';
            circle.style.transform = 'scale(0.9)';
            circle.style.backgroundColor = 'rgba(20, 184, 166, 0.1)';
            circle.style.borderColor = 'rgba(20, 184, 166, 0.4)';
        }
    },

    stopBreathing() {
        this.state.breathingRunning = false;
        if (this.state.breathingTimer) {
            clearInterval(this.state.breathingTimer);
            this.state.breathingTimer = null;
        }
    },

    // ---------------- Sicherheitsplan (Stanley-Brown-Modell) ----------------

    async openSafetyPlan() {
        this.openModal('modal-safety-plan');
        if (!this.state.currentUser) return;
        try {
            const res = await api.getSafetyPlan();
            const p = res.plan;
            document.getElementById('sp-warning-signs').value = p.warningSigns;
            document.getElementById('sp-internal-coping').value = p.internalCoping;
            document.getElementById('sp-social-distractions').value = p.socialDistractions;
            document.getElementById('sp-people-to-ask').value = p.peopleToAsk;
            document.getElementById('sp-professional-contacts').value = p.professionalContacts;
            document.getElementById('sp-safe-environment').value = p.safeEnvironment;
        } catch (e) {
            this.showToast('Sicherheitsplan konnte nicht geladen werden.');
        }
    },

    async saveSafetyPlan() {
        const payload = {
            warningSigns: document.getElementById('sp-warning-signs').value.trim(),
            internalCoping: document.getElementById('sp-internal-coping').value.trim(),
            socialDistractions: document.getElementById('sp-social-distractions').value.trim(),
            peopleToAsk: document.getElementById('sp-people-to-ask').value.trim(),
            professionalContacts: document.getElementById('sp-professional-contacts').value.trim(),
            safeEnvironment: document.getElementById('sp-safe-environment').value.trim(),
        };
        try {
            await api.saveSafetyPlan(payload);
            this.showToast('Sicherheitsplan gespeichert.');
        } catch (e) {
            this.showToast(e.message || 'Speichern fehlgeschlagen.');
        }
    },

    // ---------------- Tracking (Life-Charting, Social Rhythm, Behavioral Activation) ----------------

    async renderTracking() {
        if (!this.state.currentUser) return;
        try {
            const [checkinsRes, activitiesRes] = await Promise.all([
                api.listCheckins(30),
                api.listActivities(new Date().toISOString().slice(0, 10)),
            ]);
            this.renderTrackingFlags(checkinsRes.flags);
            this.renderMoodChart(checkinsRes.checkins);
            this.renderActivities(activitiesRes.activities);
        } catch (e) {
            this.showToast('Tracking-Daten konnten nicht geladen werden.');
        }
    },

    renderTrackingFlags(flags) {
        const container = document.getElementById('tracking-flags');
        container.innerHTML = '';
        const banners = [];
        if (flags.lowSleepWarning) {
            banners.push({
                tone: 'rose',
                text: `⚠️ ${flags.lowSleepStreak} Nächte in Folge mit unter 5 Stunden Schlaf. Schlafmangel ist eines der stärksten Frühwarnzeichen für eine manische Phase – Schlaf jetzt aktiv schützen.`,
            });
        }
        if (flags.irregularWakeTimes) {
            banners.push({
                tone: 'amber',
                text: `🌀 Deine Aufstehzeiten schwanken stark (±${Math.round(flags.wakeVarianceMinutes)} Min.). Ein regelmäßiger Tagesrhythmus stabilisiert die Stimmung spürbar (Social-Rhythm-Prinzip).`,
            });
        }
        banners.forEach((b) => {
            const div = document.createElement('div');
            const tones = {
                rose: 'bg-rose-950/60 border-rose-800 text-rose-200',
                amber: 'bg-amber-950/60 border-amber-800 text-amber-200',
            };
            div.className = `p-3 rounded-xl border text-xs leading-relaxed ${tones[b.tone]}`;
            div.textContent = b.text;
            container.appendChild(div);
        });
    },

    renderMoodChart(checkins) {
        const container = document.getElementById('mood-chart-container');
        if (!checkins.length) {
            container.innerHTML = '<p class="text-xs text-slate-500 py-6 text-center">Noch keine Check-ins vorhanden. Trage oben deinen ersten Tag ein.</p>';
            return;
        }

        const width = Math.max(360, checkins.length * 28);
        const height = 160;
        const padTop = 10;
        const padBottom = 24;
        const chartH = height - padTop - padBottom;
        const stepX = checkins.length > 1 ? (width - 20) / (checkins.length - 1) : 0;

        const yFor = (mood) => padTop + chartH - ((mood + 5) / 10) * chartH;
        const xFor = (i) => 10 + i * stepX;

        const points = checkins.map((c, i) => `${xFor(i)},${yFor(c.moodScore)}`).join(' ');

        const dots = checkins.map((c, i) => {
            const x = xFor(i);
            const y = yFor(c.moodScore);
            const color = c.moodScore > 1 ? 'rgb(var(--c-amber-500))' : c.moodScore < -1 ? 'rgb(var(--c-indigo-400))' : 'rgb(var(--c-teal-400))';
            return `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}" />`;
        }).join('');

        const labelEvery = Math.ceil(checkins.length / 8) || 1;
        const labels = checkins.map((c, i) => {
            if (i % labelEvery !== 0 && i !== checkins.length - 1) return '';
            const [, m, d] = c.date.split('-');
            return `<text x="${xFor(i)}" y="${height - 6}" font-size="11" fill="rgb(var(--c-slate-500))" text-anchor="middle">${d}.${m}.</text>`;
        }).join('');

        const zeroY = yFor(0);

        container.innerHTML = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="min-w-full">
                <line x1="10" y1="${zeroY}" x2="${width - 10}" y2="${zeroY}" stroke="rgb(var(--c-slate-700))" stroke-width="1" stroke-dasharray="3,3" />
                <polyline points="${points}" fill="none" stroke="rgb(var(--c-teal-400))" stroke-width="1.5" />
                ${dots}
                ${labels}
            </svg>
        `;
    },

    saveCheckin() {
        const medRaw = document.getElementById('checkin-medication').value;
        const payload = {
            date: new Date().toISOString().slice(0, 10),
            moodScore: parseInt(document.getElementById('checkin-mood').value, 10),
            sleepHours: document.getElementById('checkin-sleep').value || null,
            wakeTime: document.getElementById('checkin-wake').value || null,
            medicationTaken: medRaw === '' ? null : medRaw === '1',
            irritability: parseInt(document.getElementById('checkin-irritability').value, 10),
            socialContact: document.getElementById('checkin-social').checked,
            note: document.getElementById('checkin-note').value.trim(),
        };

        return api.saveCheckin(payload).then(() => {
            this.showToast('Check-in gespeichert.');
            this.renderTracking();
        }).catch((e) => {
            this.showToast(e.message || 'Check-in konnte nicht gespeichert werden.');
        });
    },

    renderActivities(activities) {
        const container = document.getElementById('activity-list');
        container.innerHTML = '';
        if (!activities.length) {
            container.innerHTML = '<p class="text-xs text-slate-500">Noch keine Aktivitäten für heute geplant.</p>';
            return;
        }

        const difficultyLabels = { tiny: 'Winzig', small: 'Klein', medium: 'Mittel' };

        activities.forEach((a) => {
            const wrap = document.createElement('div');
            wrap.className = 'p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs space-y-2';

            const topRow = document.createElement('div');
            topRow.className = 'flex items-center gap-2.5';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = a.done;
            checkbox.className = 'rounded text-teal-500 shrink-0';
            checkbox.onchange = () => this.setActivityDone(a.id, checkbox.checked);

            const titleSpan = document.createElement('span');
            titleSpan.className = `flex-1 ${a.done ? 'line-through text-slate-500' : 'text-slate-200'}`;
            titleSpan.textContent = a.title;

            const diffBadge = document.createElement('span');
            diffBadge.className = 'shrink-0 px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 text-[12px]';
            diffBadge.textContent = difficultyLabels[a.difficulty] || 'Klein';

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'shrink-0 text-slate-500 hover:text-rose-400 transition px-1';
            delBtn.textContent = '✕';
            delBtn.title = 'Entfernen';
            delBtn.onclick = () => this.removeActivity(a.id);

            topRow.append(checkbox, titleSpan, diffBadge, delBtn);
            wrap.appendChild(topRow);

            if (a.done) {
                if (a.masteryRating === null || a.pleasureRating === null) {
                    wrap.appendChild(this.buildActivityRatingPrompt(a.id));
                } else {
                    wrap.appendChild(this.buildActivityRatingSummary(a.masteryRating, a.pleasureRating));
                }
            }

            container.appendChild(wrap);
        });
    },

    buildActivityRatingPrompt(activityId) {
        const row = document.createElement('div');
        row.className = 'flex flex-wrap items-center gap-2 pl-6 pt-1 border-t border-slate-700/50';

        const masteryLabel = document.createElement('span');
        masteryLabel.className = 'text-[12px] text-slate-400';
        masteryLabel.textContent = 'Erfolgsgefühl:';
        const masterySelect = document.createElement('select');
        masterySelect.className = 'bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1 text-[12px] text-white';
        masterySelect.innerHTML = '<option value="0">Keins</option><option value="1">Etwas</option><option value="2">Stark</option>';

        const pleasureLabel = document.createElement('span');
        pleasureLabel.className = 'text-[12px] text-slate-400';
        pleasureLabel.textContent = 'Freude:';
        const pleasureSelect = document.createElement('select');
        pleasureSelect.className = 'bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1 text-[12px] text-white';
        pleasureSelect.innerHTML = '<option value="0">Keine</option><option value="1">Etwas</option><option value="2">Viel</option>';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-[12px] transition';
        saveBtn.textContent = 'Speichern';
        saveBtn.onclick = () => this.saveActivityRating(activityId, masterySelect.value, pleasureSelect.value);

        row.append(masteryLabel, masterySelect, pleasureLabel, pleasureSelect, saveBtn);
        return row;
    },

    buildActivityRatingSummary(masteryRating, pleasureRating) {
        const dots = (rating) => '●'.repeat(rating + 1) + '○'.repeat(2 - rating);
        const row = document.createElement('div');
        row.className = 'pl-6 pt-1 border-t border-slate-700/50 text-[12px] text-teal-400 flex gap-4';
        row.innerHTML = `<span>Erfolg: ${dots(masteryRating)}</span><span>Freude: ${dots(pleasureRating)}</span>`;
        return row;
    },

    toggleActivitySuggestions() {
        const panel = document.getElementById('activity-suggestions');
        const willShow = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        if (willShow && !panel.dataset.rendered) {
            this.renderActivitySuggestions();
            panel.dataset.rendered = '1';
        }
    },

    renderActivitySuggestions() {
        const panel = document.getElementById('activity-suggestions');
        panel.innerHTML = '';
        ACTIVITY_SUGGESTIONS.forEach((group) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'space-y-1.5';
            const heading = document.createElement('div');
            heading.className = 'text-[13px] font-bold text-slate-400';
            heading.textContent = `${group.icon} ${group.category}`;
            groupEl.appendChild(heading);

            const chipRow = document.createElement('div');
            chipRow.className = 'flex flex-wrap gap-1.5';
            group.items.forEach((item) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-teal-950 border border-slate-700 hover:border-teal-700 text-slate-300 hover:text-teal-300 text-[13px] transition';
                chip.textContent = `+ ${item.title}`;
                chip.onclick = () => this.addSuggestedActivity(item.title, item.difficulty);
                chipRow.appendChild(chip);
            });
            groupEl.appendChild(chipRow);
            panel.appendChild(groupEl);
        });
    },

    async addSuggestedActivity(title, difficulty) {
        try {
            await api.createActivity({ date: new Date().toISOString().slice(0, 10), title, difficulty });
            this.showToast('Aktivität hinzugefügt.');
            this.renderTracking();
        } catch (e) {
            this.showToast(e.message || 'Aktivität konnte nicht gespeichert werden.');
        }
    },

    async addActivity() {
        const input = document.getElementById('activity-input');
        const title = input.value.trim();
        const difficulty = document.getElementById('activity-difficulty').value;
        if (!title) return;
        try {
            await api.createActivity({ date: new Date().toISOString().slice(0, 10), title, difficulty });
            input.value = '';
            this.renderTracking();
        } catch (e) {
            this.showToast(e.message || 'Aktivität konnte nicht gespeichert werden.');
        }
    },

    async setActivityDone(id, done) {
        try {
            await api.updateActivity({ id, done });
            this.renderTracking();
        } catch (e) {
            this.showToast('Aktualisierung fehlgeschlagen.');
        }
    },

    async saveActivityRating(id, masteryRating, pleasureRating) {
        try {
            await api.updateActivity({ id, done: true, masteryRating: Number(masteryRating), pleasureRating: Number(pleasureRating) });
            this.showToast('Danke, gespeichert!');
            this.renderTracking();
        } catch (e) {
            this.showToast('Bewertung konnte nicht gespeichert werden.');
        }
    },

    async removeActivity(id) {
        try {
            await api.deleteActivity(id);
            this.renderTracking();
        } catch (e) {
            this.showToast('Konnte nicht entfernt werden.');
        }
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            if (modalId === 'modal-sos' && this.state.currentUser?.emergencyContact) {
                document.getElementById('sos-personal-contact-box').classList.remove('hidden');
                document.getElementById('sos-personal-contact-val').textContent = this.state.currentUser.emergencyContact;
            }
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            if (modalId === 'modal-breathing') this.stopBreathing();
        }
    },
};
