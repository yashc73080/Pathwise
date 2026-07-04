// Helpers for creating AdvancedMarkerElement markers with the app's marker styles.
// Requires the Maps script to be loaded with libraries=marker (see TripContext.js).

// Default red pin with a drop animation, used to preview a searched/clicked place
export function createPreviewMarker({ map, position, title }) {
    const { AdvancedMarkerElement, PinElement } = window.google.maps.marker;
    const pin = new PinElement();
    pin.classList.add('marker-drop');
    return new AdvancedMarkerElement({
        map,
        position,
        title,
        content: pin,
        gmpClickable: true,
    });
}

// Itinerary marker; shows a numbered circle when a route position is known,
// otherwise a colored dot for the stop's day.
export function createItineraryMarker({ map, position, title, number = null, color = null }) {
    const { AdvancedMarkerElement } = window.google.maps.marker;
    return new AdvancedMarkerElement({
        map,
        position,
        title,
        content: number ? numberedCircle(number, color) : coloredDot(color),
    });
}

// Swap an itinerary marker's content to a numbered route circle
export function setMarkerNumber(marker, number, color = null) {
    marker.content = number ? numberedCircle(number, color) : coloredDot(color);
}

// Small blue dot marking the user's current location
export function createLocationDot({ map, position, title }) {
    const { AdvancedMarkerElement } = window.google.maps.marker;
    const el = document.createElement('div');
    el.style.cssText =
        'width:16px;height:16px;border-radius:50%;background:#4285F4;' +
        'border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);transform:translateY(50%);';
    return new AdvancedMarkerElement({ map, position, title, content: el });
}

export function clearMarker(marker) {
    if (marker) marker.map = null;
}

function numberedCircle(number, color = null) {
    const markerColor = color || { bg: '#2563eb', border: '#1e40af', text: '#ffffff' };
    const el = document.createElement('div');
    el.textContent = String(number);
    el.style.cssText =
        `width:24px;height:24px;border-radius:50%;background:${markerColor.bg};border:2px solid ${markerColor.border};` +
        `color:${markerColor.text};font-size:12px;font-weight:bold;display:flex;align-items:center;` +
        'justify-content:center;transform:translateY(50%);';
    return el;
}

function coloredDot(color = null) {
    const markerColor = color || { bg: '#2563eb', border: '#1e40af' };
    const el = document.createElement('div');
    el.style.cssText =
        `width:20px;height:20px;border-radius:50%;background:${markerColor.bg};border:3px solid white;` +
        `box-shadow:0 1px 5px rgba(0,0,0,0.35),0 0 0 2px ${markerColor.border};transform:translateY(50%);`;
    return el;
}
