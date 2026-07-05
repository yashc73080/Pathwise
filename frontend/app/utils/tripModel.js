export const TRIP_STORAGE_KEY = 'pathwise_trip_v2';
export const LEGACY_TRIP_STORAGE_KEY = 'pathwise_itinerary';

export function createId(prefix) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    }
    return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

export function createEmptyTrip(overrides = {}) {
    const dayId = createId('day');
    return normalizeTrip({
        schemaVersion: 2,
        id: null,
        title: 'Untitled Trip',
        destination: null,
        startDate: null,
        endDate: null,
        visibility: 'private',
        days: [{
            id: dayId,
            date: null,
            label: null,
            stops: [],
            route: null
        }],
        chatSessionId: null,
        createdBy: 'web',
        ...overrides
    });
}

export function normalizeStop(stop = {}) {
    return {
        id: stop.id || createId('stop'),
        name: stop.name || 'Untitled stop',
        lat: stop.lat ?? null,
        lng: stop.lng ?? null,
        address: stop.address || '',
        placeId: stop.placeId || stop.place_id || null,
        arrivalTime: stop.arrivalTime || null,
        departureTime: stop.departureTime || null,
        notes: stop.notes || null
    };
}

export function normalizeDay(day = {}, index = 0) {
    const stops = (day.stops || day.locations || []).map(normalizeStop);
    const stopIds = new Set(stops.map(stop => stop.id));
    const route = day.route ? {
        order: (day.route.order || []).filter(stopId => stopIds.has(stopId)),
        startStopId: stopIds.has(day.route.startStopId) ? day.route.startStopId : null,
        endStopId: stopIds.has(day.route.endStopId) ? day.route.endStopId : null,
        totalDistanceMiles: day.route.totalDistanceMiles ?? null,
        optimizedAt: day.route.optimizedAt || null
    } : null;

    return {
        id: day.id || createId('day'),
        date: day.date || null,
        label: `Day ${index + 1}`,
        stops,
        route: route && route.order.length > 0 ? route : route,
    };
}

export function normalizeTrip(trip = {}) {
    const days = (trip.days && trip.days.length ? trip.days : [{}]).map(normalizeDay);
    return {
        schemaVersion: 2,
        id: trip.id || null,
        ownerId: trip.ownerId || null,
        claimToken: trip.claimToken || null,
        title: trip.title || trip.name || 'Untitled Trip',
        destination: trip.destination || null,
        startDate: trip.startDate || null,
        endDate: trip.endDate || null,
        visibility: trip.visibility || 'private',
        days,
        chatSessionId: trip.chatSessionId || null,
        createdBy: trip.createdBy || 'web',
        createdAt: trip.createdAt || null,
        updatedAt: trip.updatedAt || null
    };
}

export function legacyTripToV2(legacy = {}) {
    const stops = (legacy.selectedLocations || legacy.locations || []).map(normalizeStop);
    const routeOrder = (legacy.optimizedRoute || [])
        .filter(index => Number.isInteger(index) && stops[index])
        .map(index => stops[index].id);
    const startStopId = Number.isInteger(legacy.startIndex) && stops[legacy.startIndex]
        ? stops[legacy.startIndex].id
        : null;
    const endStopId = Number.isInteger(legacy.endIndex) && stops[legacy.endIndex]
        ? stops[legacy.endIndex].id
        : null;

    return createEmptyTrip({
        id: legacy.id || null,
        title: legacy.title || legacy.name || 'Untitled Trip',
        ownerId: legacy.userId || null,
        chatSessionId: legacy.currentChatSessionId || legacy.chatSessionId || null,
        days: [{
            id: createId('day'),
            label: null,
            stops,
            route: routeOrder.length > 0
                ? { order: routeOrder, startStopId, endStopId, totalDistanceMiles: null, optimizedAt: null }
                : (startStopId || endStopId ? { order: [], startStopId, endStopId, totalDistanceMiles: null, optimizedAt: null } : null)
        }]
    });
}

export function getActiveDay(trip, activeDayId) {
    if (!trip?.days?.length) return null;
    return trip.days.find(day => day.id === activeDayId) || trip.days[0];
}

export function getOrderedStops(day) {
    if (!day) return [];
    if (!day.route?.order?.length) return day.stops;
    const byId = new Map(day.stops.map(stop => [stop.id, stop]));
    return day.route.order.map(stopId => byId.get(stopId)).filter(Boolean);
}

export function updateDayInTrip(trip, dayId, updater) {
    return normalizeTrip({
        ...trip,
        days: trip.days.map(day => day.id === dayId ? updater(day) : day)
    });
}

export function serializeTripForSave(trip) {
    const normalized = normalizeTrip(trip);
    return {
        title: normalized.title,
        destination: normalized.destination,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        days: normalized.days.map((day, index) => ({
            id: day.id,
            date: day.date,
            label: `Day ${index + 1}`,
            stops: day.stops.map(stop => ({ ...stop })),
            route: day.route
        })),
        chatSessionId: normalized.chatSessionId,
        createdBy: 'web'
    };
}
