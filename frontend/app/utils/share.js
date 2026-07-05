// Share links must point at the hosted web app. Inside Capacitor the page
// origin is capacitor://localhost, which other people cannot open, so fall
// back to the production hosting URL there.
const PRODUCTION_APP_URL = 'https://pathwise.web.app';

export function getShareUrl(tripId) {
    const origin = typeof window !== 'undefined' && window.location.protocol.startsWith('http')
        ? window.location.origin
        : PRODUCTION_APP_URL;
    return `${origin}/trip/?id=${tripId}`;
}

export async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}
