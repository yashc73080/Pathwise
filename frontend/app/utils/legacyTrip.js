import { legacyTripToV2, normalizeTrip } from './tripModel';

export function toTripV2(data) {
    if (!data) return null;
    if (data.schemaVersion === 2 || data.days) {
        return normalizeTrip(data);
    }
    return legacyTripToV2(data);
}
