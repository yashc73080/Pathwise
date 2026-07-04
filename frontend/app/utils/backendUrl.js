// In development the backend runs on port 5000 of the same machine serving the
// frontend, so derive the URL from the page's hostname instead of hardcoding a
// LAN IP in .env.development (DHCP reassignments kept breaking that). Works for
// localhost on desktop and for phones hitting the dev server over the LAN.
// Production/Capacitor builds always use NEXT_PUBLIC_BACKEND_URL (Cloud Run).
export function getBackendUrl() {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
        return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return process.env.NEXT_PUBLIC_BACKEND_URL;
}
