import { getBackendUrl } from '../utils/backendUrl';

async function authHeaders(currentUser) {
    if (!currentUser) return { 'Content-Type': 'application/json' };
    const token = await currentUser.getIdToken();
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
    };
}

async function parseResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed with ${response.status}`);
    }
    return data;
}

export const addTrip = async (currentUser, tripData) => {
    const response = await fetch(`${getBackendUrl()}/api/trips`, {
        method: 'POST',
        headers: await authHeaders(currentUser),
        body: JSON.stringify(tripData)
    });
    const data = await parseResponse(response);
    return data.trip.id;
};

export const getUserTrips = async (currentUser) => {
    const response = await fetch(`${getBackendUrl()}/api/trips`, {
        method: 'GET',
        headers: await authHeaders(currentUser)
    });
    const data = await parseResponse(response);
    return data.trips || [];
};

export const deleteTrip = async (currentUser, tripId) => {
    const response = await fetch(`${getBackendUrl()}/api/trips/${tripId}`, {
        method: 'DELETE',
        headers: await authHeaders(currentUser)
    });
    await parseResponse(response);
};

export const getTrip = async (currentUser, tripId, claimToken = null) => {
    const headers = await authHeaders(currentUser);
    if (claimToken) headers['X-Claim-Token'] = claimToken;
    const response = await fetch(`${getBackendUrl()}/api/trips/${tripId}`, {
        method: 'GET',
        headers
    });
    const data = await parseResponse(response);
    return data.trip;
};

export const claimTrip = async (currentUser, tripId, claimToken) => {
    const response = await fetch(`${getBackendUrl()}/api/trips/${tripId}/claim`, {
        method: 'POST',
        headers: await authHeaders(currentUser),
        body: JSON.stringify({ claimToken })
    });
    const data = await parseResponse(response);
    return data.trip;
};

export const setTripVisibility = async (currentUser, tripId, visibility) => {
    const response = await fetch(`${getBackendUrl()}/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: await authHeaders(currentUser),
        body: JSON.stringify({ visibility })
    });
    const data = await parseResponse(response);
    return data.trip;
};

export const updateTripName = async (currentUser, tripId, name) => {
    const response = await fetch(`${getBackendUrl()}/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: await authHeaders(currentUser),
        body: JSON.stringify({ title: name })
    });
    await parseResponse(response);
};
