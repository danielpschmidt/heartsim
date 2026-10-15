import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

// Alle genutzten Farbfamilien laufen über CSS-Variablen (`--c-<familie>-<stufe>`),
// damit der Light Mode nur die Variablen umschalten muss statt jede Klasse doppelt
// zu pflegen. Dark-Werte = Tailwind-Standard, Light-Werte = gespiegelte Skala.
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const ACCENTS = ['teal', 'amber', 'emerald', 'indigo', 'purple', 'rose'];

const darkSlate = { ...colors.slate, 850: '#151f32', 950: '#070b14' };
const lightSlate = {
    50: '#020617', 100: '#0f172a', 200: '#1e293b', 300: '#334155', 400: '#475569',
    500: '#64748b', 600: '#94a3b8', 700: '#cbd5e1', 800: '#e2e8f0', 850: '#f8fafc',
    900: '#ffffff', 950: '#eef2f7',
};
// Im Light Mode werden helle Akzentstufen (Text auf dunklem Grund) zu dunklen und umgekehrt.
const ACCENT_LIGHT_SHADE = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 700, 500: 600, 600: 600, 700: 300, 800: 200, 900: 100, 950: 50 };

const rgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const ref = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const themeColors = { white: ref('white'), slate: {} };
const darkVars = { '--c-white': rgb('#ffffff') };
const lightVars = { '--c-white': rgb('#0f172a') };

for (const shade of Object.keys(darkSlate)) {
    themeColors.slate[shade] = ref(`slate-${shade}`);
    darkVars[`--c-slate-${shade}`] = rgb(darkSlate[shade]);
    lightVars[`--c-slate-${shade}`] = rgb(lightSlate[shade]);
}
for (const family of ACCENTS) {
    themeColors[family] = {};
    for (const shade of SHADES) {
        themeColors[family][shade] = ref(`${family}-${shade}`);
        darkVars[`--c-${family}-${shade}`] = rgb(colors[family][shade]);
        lightVars[`--c-${family}-${shade}`] = rgb(colors[family][ACCENT_LIGHT_SHADE[shade]]);
    }
}

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ['./index.html', './app/index.html', './src/**/*.{js,html}'],
    theme: {
        extend: {
            colors: themeColors,
            // Etwas größere Grundschrift für bessere Lesbarkeit.
            fontSize: {
                xs: ['0.875rem', { lineHeight: '1.25rem' }],
                sm: ['0.9375rem', { lineHeight: '1.375rem' }],
                base: ['1.0625rem', { lineHeight: '1.625rem' }],
                lg: ['1.1875rem', { lineHeight: '1.75rem' }],
            },
        },
    },
    plugins: [
        plugin(({ addBase }) => {
            addBase({
                ':root': { ...darkVars, colorScheme: 'dark' },
                'html.light': { ...lightVars, colorScheme: 'light' },
            });
        }),
    ],
};
