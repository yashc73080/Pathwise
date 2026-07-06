'use client';

import { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getBackendUrl } from '../utils/backendUrl';
import { createItineraryMarker, setMarkerNumber, clearMarker } from '../utils/markers';
import { getDayColor } from '../utils/dayColors';
import { createTrip, getTrip, syncTripDays } from '../firebase/firestore';
import {
    LEGACY_TRIP_STORAGE_KEY,
    TRIP_STORAGE_KEY,
    createEmptyTrip,
    createId,
    getActiveDay,
    getOrderedStops,
    legacyTripToV2,
    normalizeStop,
    normalizeTrip,
    serializeTripForSave,
    updateDayInTrip
} from '../utils/tripModel';
import { toTripV2 } from '../utils/legacyTrip';

const TripContext = createContext();

function buildRouteCoordinates(stops, shouldCloseCycle) {
    const coords = stops
        .filter(stop => stop?.lat != null && stop?.lng != null)
        .map(stop => ({ lat: stop.lat, lng: stop.lng }));
    if (shouldCloseCycle && coords.length > 0) coords.push(coords[0]);
    return coords;
}

function getDayCentroid(day) {
    const stops = (day?.stops || []).filter(stop => stop.lat != null && stop.lng != null);
    if (!stops.length) return null;
    return {
        lat: stops.reduce((sum, stop) => sum + Number(stop.lat), 0) / stops.length,
        lng: stops.reduce((sum, stop) => sum + Number(stop.lng), 0) / stops.length,
    };
}

export function TripProvider({ children }) {
    const [mapLoaded, setMapLoaded] = useState(false);
    const [trip, setTrip] = useState(() => createEmptyTrip());
    const [activeDayId, setActiveDayId] = useState(null);
    const [currentPlace, setCurrentPlace] = useState(null);
    const [map, setMap] = useState(null);
    const [currentMarker, setCurrentMarker] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isLocationSelected, setIsLocationSelected] = useState(true);
    const [activePanel, setActivePanel] = useState('none');
    const [chatHeight, setChatHeight] = useState('full');
    const [sidebarHeight, setSidebarHeight] = useState('full');
    const [routeHeight, setRouteHeight] = useState('full');
    const [weatherData, setWeatherData] = useState(null);
    const [isLoadingWeather, setIsLoadingWeather] = useState(false);
    const [optimizationRunId, setOptimizationRunId] = useState(0);

    const markersRef = useRef(new Map());
    const routePolylinesRef = useRef(new Map());
    const hasRestoredRef = useRef(false);
    // True while the local trip has edits that haven't been persisted to the
    // backend. Live snapshots from Firestore are ignored while dirty so a
    // remote update can't silently discard in-progress edits.
    const isDirtyRef = useRef(false);
    // Always-current trip for async callbacks (chat flows span multiple
    // renders; closures over `trip` would go stale mid-conversation).
    const tripRef = useRef(trip);
    tripRef.current = trip;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    const activeDay = useMemo(() => getActiveDay(trip, activeDayId), [trip, activeDayId]);
    const selectedLocations = activeDay?.stops || [];
    const optimizedRoute = activeDay?.route?.order?.length ? activeDay.route.order : null;
    const startIndex = activeDay?.route?.startStopId
        ? selectedLocations.findIndex(stop => stop.id === activeDay.route.startStopId)
        : null;
    const endIndex = activeDay?.route?.endStopId
        ? selectedLocations.findIndex(stop => stop.id === activeDay.route.endStopId)
        : null;
    const normalizedStartIndex = startIndex === -1 ? null : startIndex;
    const normalizedEndIndex = endIndex === -1 ? null : endIndex;
    const currentChatSessionId = trip.chatSessionId || null;
    const hasAnyOptimizedRoute = trip.days.some(day => day.route?.order?.length);
    const hasOptimizableDay = trip.days.some(day => day.stops.length >= 2);
    const needsTripOptimization = trip.days.some(day =>
        day.stops.length >= 2 && (!day.route?.order?.length || day.route.order.length < day.stops.length)
    );

    const orderedRouteStops = useMemo(() => getOrderedStops(activeDay), [activeDay]);
    const optimizedCoords = useMemo(() => {
        if (!optimizedRoute) return [];
        return orderedRouteStops.map(stop => ({
            id: stop.id,
            name: stop.name,
            address: stop.address || '',
            lat: stop.lat,
            lng: stop.lng
        }));
    }, [optimizedRoute, orderedRouteStops]);

    const clearRoutePolyline = useCallback(() => {
        routePolylinesRef.current.forEach(polyline => polyline.setMap(null));
        routePolylinesRef.current.clear();
    }, []);

    const clearRouteForActiveDay = useCallback(() => {
        if (!activeDay) return;
        setTrip(prev => updateDayInTrip(prev, activeDay.id, day => ({ ...day, route: null })));
        clearRoutePolyline();
    }, [activeDay, clearRoutePolyline]);

    // Draw one polyline per optimized day: the active day at full strength,
    // other days dimmed so the whole trip stays visible on the map.
    const redrawRoutes = useCallback((targetMap = map) => {
        if (!targetMap) return;

        const drawnDayIds = new Set();
        trip.days.forEach((day, dayIndex) => {
            const existing = routePolylinesRef.current.get(day.id);
            if (existing) {
                existing.setMap(null);
                routePolylinesRef.current.delete(day.id);
            }
            if (!day.route?.order?.length) return;

            const routeCoordinates = buildRouteCoordinates(getOrderedStops(day), !day.route.endStopId);
            if (routeCoordinates.length === 0) return;

            const dayColor = getDayColor(dayIndex);
            const isActiveDay = day.id === activeDay?.id;
            routePolylinesRef.current.set(day.id, new window.google.maps.Polyline({
                path: routeCoordinates,
                geodesic: true,
                strokeColor: dayColor.bg,
                strokeOpacity: isActiveDay ? 1.0 : 0.45,
                strokeWeight: isActiveDay ? 4 : 3,
                map: targetMap
            }));
            drawnDayIds.add(day.id);
        });

        routePolylinesRef.current.forEach((polyline, dayId) => {
            if (!drawnDayIds.has(dayId)) {
                polyline.setMap(null);
                routePolylinesRef.current.delete(dayId);
            }
        });
    }, [activeDay, map, trip.days]);

    useEffect(() => {
        if (!activeDayId && trip.days.length > 0) {
            setActiveDayId(trip.days[0].id);
        }
    }, [activeDayId, trip.days]);

    useEffect(() => {
        if (!hasRestoredRef.current) return;
        localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify({ trip, activeDayId, weatherData }));
    }, [trip, activeDayId, weatherData]);

    useEffect(() => {
        if (!map || !mapLoaded || hasRestoredRef.current) return;
        hasRestoredRef.current = true;

        const savedV2 = localStorage.getItem(TRIP_STORAGE_KEY);
        const savedLegacy = localStorage.getItem(LEGACY_TRIP_STORAGE_KEY);
        const savedState = savedV2 || savedLegacy;
        if (!savedState) return;

        try {
            const parsed = JSON.parse(savedState);
            const restoredTrip = savedV2 ? normalizeTrip(parsed.trip || parsed) : legacyTripToV2(parsed);
            setTrip(restoredTrip);
            setActiveDayId(parsed.activeDayId || restoredTrip.days[0]?.id || null);
            if (parsed.weatherData) setWeatherData(parsed.weatherData);
            toast.success('Previous itinerary restored');
        } catch (error) {
            console.error('Error restoring itinerary from localStorage:', error);
        }
    }, [map, mapLoaded]);

    useEffect(() => {
        if (window.google?.maps) {
            setMapLoaded(true);
            return;
        }

        const existingScript = document.querySelector('script[src^="https://maps.googleapis.com/maps/api/js"]');
        if (existingScript) {
            if (!window.google?.maps) {
                existingScript.addEventListener('load', () => setMapLoaded(true));
            } else {
                setMapLoaded(true);
            }
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => setMapLoaded(true);
        document.head.appendChild(script);
    }, [apiKey]);

    useEffect(() => {
        if (!map || !activeDay) return;

        const visibleStopIds = new Set(trip.days.flatMap(day => day.stops.map(stop => stop.id)));
        markersRef.current.forEach((marker, stopId) => {
            if (!visibleStopIds.has(stopId)) {
                clearMarker(marker);
                markersRef.current.delete(stopId);
            }
        });

        trip.days.forEach((day, dayIndex) => {
            const dayColor = getDayColor(dayIndex);
            const routePositionMap = new Map((day.route?.order || []).map((stopId, index) => [stopId, index + 1]));
            day.stops.forEach(stop => {
                let marker = markersRef.current.get(stop.id);
                if (!marker) {
                    marker = createItineraryMarker({
                        map,
                        position: { lat: stop.lat, lng: stop.lng },
                        title: stop.name,
                        number: routePositionMap.get(stop.id) || null,
                        color: dayColor
                    });
                    markersRef.current.set(stop.id, marker);
                } else {
                    marker.map = map;
                    marker.position = { lat: stop.lat, lng: stop.lng };
                    marker.title = stop.name;
                    setMarkerNumber(marker, routePositionMap.get(stop.id) || null, dayColor);
                }
            });
        });

        redrawRoutes(map);
    }, [activeDay, map, redrawRoutes, trip.days]);

    useEffect(() => {
        if (!map || !activeDay) return;
        const centroid = getDayCentroid(activeDay);
        if (centroid) map.panTo(centroid);
    }, [activeDayId, activeDay, map]);

    // Live-sync: while a persisted trip is open, mirror server-side edits
    // (agent, MCP, another device) into local state via Firestore snapshots.
    // Requires the deployed rules to allow reads on owned/link-visible trips;
    // if they deny, we log and carry on without live updates.
    useEffect(() => {
        const tripId = trip.id;
        if (!tripId) return;

        const unsubscribe = onSnapshot(
            doc(db, 'trips', tripId),
            (snapshot) => {
                if (!snapshot.exists() || isDirtyRef.current) return;
                setTrip(prev => {
                    if (prev.id !== snapshot.id) return prev;
                    // The stored document never carries the claim token
                    // (it lives in trip_claims); keep the local one.
                    const remote = normalizeTrip({ ...snapshot.data(), id: snapshot.id, claimToken: prev.claimToken });
                    const prevStamp = prev.updatedAt?.seconds ?? prev.updatedAt;
                    const remoteStamp = remote.updatedAt?.seconds ?? remote.updatedAt;
                    if (prevStamp != null && remoteStamp != null && String(prevStamp) === String(remoteStamp)) {
                        return prev;
                    }
                    return remote;
                });
            },
            (error) => {
                console.warn('Trip live-sync unavailable:', error?.message || error);
            }
        );
        return unsubscribe;
    }, [trip.id]);

    const updateActiveDay = useCallback((updater) => {
        if (!activeDay) return;
        isDirtyRef.current = true;
        setTrip(prev => updateDayInTrip(prev, activeDay.id, updater));
    }, [activeDay]);

    const addToItinerary = (placeOrEvent = null, markerToRemove = null) => {
        let place = placeOrEvent;
        if (place && (place.nativeEvent || typeof place.lat === 'undefined')) place = null;

        const locationToAdd = place || currentPlace;
        if (!locationToAdd || !activeDay) return;

        if (selectedLocations.some(loc => loc.name === locationToAdd.name)) {
            toast.error('Location already in itinerary');
            return;
        }

        const stop = normalizeStop(locationToAdd);
        updateActiveDay(day => ({ ...day, stops: [...day.stops, stop], route: null }));
        setCurrentPlace(null);
        clearMarker(markerToRemove || currentMarker);
        setCurrentMarker(null);
        toast.success('Added to itinerary!');
    };

    const removeLocation = (index) => {
        const stop = selectedLocations[index];
        if (!stop) return;
        clearMarker(markersRef.current.get(stop.id));
        markersRef.current.delete(stop.id);
        updateActiveDay(day => ({ ...day, stops: day.stops.filter(existing => existing.id !== stop.id), route: null }));
        clearRoutePolyline();
        toast.success('Removed from itinerary');
    };

    const clearAllLocations = () => {
        selectedLocations.forEach(stop => {
            clearMarker(markersRef.current.get(stop.id));
            markersRef.current.delete(stop.id);
        });
        clearRoutePolyline();
        updateActiveDay(day => ({ ...day, stops: [], route: null }));
        toast.success('All locations cleared');
    };

    const reorderLocations = (sourceIndex, destinationIndex) => {
        updateActiveDay(day => {
            const stops = Array.from(day.stops);
            const [removed] = stops.splice(sourceIndex, 1);
            stops.splice(destinationIndex, 0, removed);
            return { ...day, stops, route: null };
        });
        clearRoutePolyline();
    };

    const setStartLocation = (index) => {
        const stop = selectedLocations[index];
        if (!stop) return;
        updateActiveDay(day => ({
            ...day,
            route: {
                order: [],
                startStopId: day.route?.startStopId === stop.id ? null : stop.id,
                endStopId: day.route?.endStopId || null,
                totalDistanceMiles: null,
                optimizedAt: null
            }
        }));
        clearRoutePolyline();
    };

    const setEndLocation = (index) => {
        const stop = selectedLocations[index];
        if (!stop) return;
        updateActiveDay(day => ({
            ...day,
            route: {
                order: [],
                startStopId: day.route?.startStopId || null,
                endStopId: day.route?.endStopId === stop.id ? null : stop.id,
                totalDistanceMiles: null,
                optimizedAt: null
            }
        }));
        clearRoutePolyline();
    };

    const submitItinerary = async () => {
        const daysToOptimize = trip.days.filter(day => day.stops.length >= 2);
        if (daysToOptimize.length === 0) {
            toast.error('Add at least two locations to a day before optimizing.');
            return;
        }

        setIsSubmitting(true);
        try {
            const optimizedDays = await Promise.all(trip.days.map(async (day) => {
                if (day.stops.length < 2) {
                    return { ...day, route: null };
                }

                const requestBody = {
                    locations: day.stops.map(location => ({
                        name: location.name,
                        lat: location.lat,
                        lng: location.lng
                    }))
                };
                const startIndexForDay = day.route?.startStopId
                    ? day.stops.findIndex(stop => stop.id === day.route.startStopId)
                    : 0;
                const endIndexForDay = day.route?.endStopId
                    ? day.stops.findIndex(stop => stop.id === day.route.endStopId)
                    : null;

                if (startIndexForDay !== -1) requestBody.start_index = startIndexForDay;
                if (endIndexForDay !== null && endIndexForDay !== -1) requestBody.end_index = endIndexForDay;

                const response = await fetch(`${getBackendUrl()}/submit-itinerary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    throw new Error(`Failed to optimize ${day.label || 'day'}`);
                }

                const data = await response.json();
                const routeOrder = data.optimized_route
                    .filter(index => day.stops[index])
                    .map(index => day.stops[index].id);

                return {
                    ...day,
                    route: {
                        order: routeOrder,
                        startStopId: routeOrder[0] || null,
                        endStopId: endIndexForDay !== null && endIndexForDay !== -1 ? routeOrder[routeOrder.length - 1] : null,
                        totalDistanceMiles: null,
                        optimizedAt: new Date().toISOString()
                    }
                };
            }));

            isDirtyRef.current = true;
            const nextTrip = normalizeTrip({ ...trip, days: optimizedDays });
            const preferredDay = getActiveDay(nextTrip, activeDayId);
            const displayDay = preferredDay?.route?.order?.length
                ? preferredDay
                : nextTrip.days.find(day => day.route?.order?.length) || preferredDay;
            setTrip(nextTrip);
            if (displayDay?.id && displayDay.id !== activeDayId) {
                setActiveDayId(displayDay.id);
            }
            setActivePanel('route');
            setOptimizationRunId(runId => runId + 1);
            toast.success(daysToOptimize.length === 1 ? 'Route optimized!' : 'Routes optimized!');

            const activeRouteStops = getOrderedStops(displayDay);
            if (activeRouteStops.length) fetchWeather(activeRouteStops);
        } catch (error) {
            console.error('Error submitting itinerary:', error);
            toast.error('Error submitting itinerary.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const exportToGoogleMaps = () => {
        if (!optimizedCoords.length) {
            toast.error('No optimized route to export');
            return;
        }

        const waypoints = optimizedCoords
            .map(loc => encodeURIComponent(loc.address ? `${loc.name}, ${loc.address}` : loc.name))
            .join('/');
        const googleMapsUrl = `https://www.google.com/maps/dir/${waypoints}`;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            window.location.href = googleMapsUrl;
        } else {
            window.open(googleMapsUrl, '_blank');
        }
        toast.success('Opening in Google Maps!');
    };

    const reorderOptimizedRoute = (sourceIndex, destinationIndex) => {
        if (!optimizedRoute) return;
        const newOrder = Array.from(optimizedRoute);
        const [moved] = newOrder.splice(sourceIndex, 1);
        newOrder.splice(destinationIndex, 0, moved);
        updateActiveDay(day => ({
            ...day,
            route: {
                ...(day.route || {}),
                order: newOrder,
                startStopId: newOrder[0] || null,
                endStopId: day.route?.endStopId ? newOrder[newOrder.length - 1] : null,
                optimizedAt: new Date().toISOString()
            }
        }));
    };

    const addDay = () => {
        const day = {
            id: createId('day'),
            date: null,
            label: null,
            stops: [],
            route: null
        };
        isDirtyRef.current = true;
        setTrip(prev => normalizeTrip({ ...prev, days: [...prev.days, day] }));
        setActiveDayId(day.id);
    };

    const removeDay = (dayId) => {
        if (trip.days.length <= 1) {
            toast.error('Trip needs at least one day');
            return;
        }
        if (activeDayId === dayId) {
            clearRoutePolyline();
        }
        const nextDays = trip.days.filter(day => day.id !== dayId);
        isDirtyRef.current = true;
        setTrip(prev => normalizeTrip({ ...prev, days: nextDays }));
        if (activeDayId === dayId) setActiveDayId(nextDays[0]?.id || null);
    };

    const loadTrip = (incomingTrip) => {
        markersRef.current.forEach(marker => clearMarker(marker));
        markersRef.current.clear();
        clearRoutePolyline();

        const nextTrip = toTripV2(incomingTrip);
        isDirtyRef.current = false;
        setTrip(nextTrip);
        setActiveDayId(nextTrip.days[0]?.id || null);
        setWeatherData(null);
        if (nextTrip.days[0]?.stops?.length) fetchWeather(nextTrip.days[0].stops);
        toast.success('Trip loaded!');
    };

    // Edit arrival/departure times or notes on any stop, on any day.
    const updateStopDetails = useCallback((stopId, patch) => {
        isDirtyRef.current = true;
        setTrip(prev => normalizeTrip({
            ...prev,
            days: prev.days.map(day => ({
                ...day,
                stops: day.stops.map(stop => stop.id === stopId ? { ...stop, ...patch } : stop)
            }))
        }));
    }, []);

    // Move a stop to another day. Both days lose their optimized route since
    // their stop sets changed; markers re-key to the new day color via the
    // marker reconciliation effect.
    const moveStopToDay = useCallback((stopId, toDayId, position = null) => {
        setTrip(prev => {
            const sourceDay = prev.days.find(day => day.stops.some(stop => stop.id === stopId));
            if (!sourceDay || sourceDay.id === toDayId) return prev;
            const stop = sourceDay.stops.find(candidate => candidate.id === stopId);

            isDirtyRef.current = true;
            const days = prev.days.map(day => {
                if (day.id === sourceDay.id) {
                    return { ...day, stops: day.stops.filter(candidate => candidate.id !== stopId), route: null };
                }
                if (day.id === toDayId) {
                    const stops = [...day.stops];
                    stops.splice(position == null ? stops.length : position, 0, stop);
                    return { ...day, stops, route: null };
                }
                return day;
            });
            return normalizeTrip({ ...prev, days });
        });
        clearRoutePolyline();
        toast.success('Stop moved');
    }, [clearRoutePolyline]);

    // Make sure the trip exists server-side (and is in sync with local edits)
    // so the chat agent can operate on it. Anonymous users get a claimToken
    // back from create; it is kept on the trip for subsequent writes.
    const ensureTripPersisted = useCallback(async (currentUser) => {
        const current = tripRef.current;
        if (!current.id) {
            const data = await createTrip(currentUser, serializeTripForSave(current));
            const id = data.trip.id;
            const claimToken = data.claimToken || null;
            isDirtyRef.current = false;
            setTrip(prev => normalizeTrip({ ...prev, id, claimToken }));
            return { id, claimToken };
        }
        if (isDirtyRef.current) {
            try {
                await syncTripDays(currentUser, current.id, serializeTripForSave(current), current.claimToken);
                isDirtyRef.current = false;
            } catch (error) {
                // Read-only viewers can still chat; the agent's edits will fail
                // with a clear authorization message instead.
                console.warn('Could not sync local edits before chat:', error);
            }
        }
        return { id: current.id, claimToken: current.claimToken || null };
    }, []);

    // Pull the latest stored trip after the chat agent mutates it server-side.
    const refreshTripFromServer = useCallback(async (currentUser) => {
        const current = tripRef.current;
        if (!current.id) return;
        try {
            const fetched = await getTrip(currentUser, current.id, current.claimToken);
            isDirtyRef.current = false;
            setTrip(prev => normalizeTrip({ ...fetched, claimToken: prev.claimToken }));
        } catch (error) {
            console.error('Failed to refresh trip after agent update:', error);
        }
    }, []);

    // Called by the /trip/ share page before the map finishes loading so the
    // localStorage restore doesn't clobber the trip fetched from the URL.
    const disableLocalRestore = useCallback(() => {
        hasRestoredRef.current = true;
    }, []);

    // Record the backend id after a save so sharing and live-sync work on the
    // persisted document, and the local copy is no longer considered dirty.
    const markTripSaved = useCallback((tripId) => {
        isDirtyRef.current = false;
        setTrip(prev => normalizeTrip({ ...prev, id: tripId }));
    }, []);

    const fetchWeather = async (locations) => {
        if (!locations || locations.length === 0) return;

        setIsLoadingWeather(true);
        setWeatherData(null);
        try {
            const response = await fetch(`${getBackendUrl()}/weather`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locations: locations.map(loc => ({ name: loc.name, lat: loc.lat, lng: loc.lng }))
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setWeatherData(data);
                toast.success('Weather forecast loaded!');
            } else {
                toast.error('Failed to load weather');
            }
        } catch (error) {
            console.error('Error fetching weather:', error);
            toast.error('Error loading weather');
        } finally {
            setIsLoadingWeather(false);
        }
    };

    const setCurrentChatSessionId = (chatSessionId) => {
        setTrip(prev => normalizeTrip({ ...prev, chatSessionId }));
    };

    const value = {
        trip,
        setTrip,
        activeDayId,
        setActiveDayId,
        activeDay,
        hasAnyOptimizedRoute,
        hasOptimizableDay,
        needsTripOptimization,
        optimizationRunId,
        addDay,
        removeDay,
        serializeCurrentTrip: () => serializeTripForSave(trip),
        mapLoaded,
        selectedLocations,
        currentPlace,
        setCurrentPlace,
        map,
        setMap,
        currentMarker,
        setCurrentMarker,
        optimizedRoute,
        isSubmitting,
        isChatOpen,
        setIsChatOpen,
        isSidebarOpen,
        setIsSidebarOpen,
        isLocationSelected,
        setIsLocationSelected,
        startIndex: normalizedStartIndex,
        endIndex: normalizedEndIndex,
        addToItinerary,
        removeLocation,
        clearAllLocations,
        submitItinerary,
        reorderLocations,
        setStartLocation,
        setEndLocation,
        optimizedCoords,
        orderedRouteStops,
        exportToGoogleMaps,
        reorderOptimizedRoute,
        updateStopDetails,
        moveStopToDay,
        loadTrip,
        disableLocalRestore,
        markTripSaved,
        ensureTripPersisted,
        refreshTripFromServer,
        activePanel,
        setActivePanel,
        chatHeight,
        setChatHeight,
        sidebarHeight,
        setSidebarHeight,
        routeHeight,
        setRouteHeight,
        weatherData,
        isLoadingWeather,
        fetchWeather,
        setWeatherData,
        currentChatSessionId,
        setCurrentChatSessionId
    };

    return (
        <TripContext.Provider value={value}>
            {children}
        </TripContext.Provider>
    );
}

export function useTrip() {
    return useContext(TripContext);
}
