export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Formatiert Coach-Nachrichten sicher: escaped zuerst den gesamten Text und
 * wendet danach nur ein sehr eingeschränktes **fett** + Zeilenumbruch-Markup an.
 * Es wird NIE roher, unescapter Text in innerHTML eingefügt.
 */
export function formatMessageHtml(text) {
    const escaped = escapeHtml(text);
    return escaped
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}
