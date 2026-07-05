'use client';

import { useEffect, useRef } from 'react';
import { useTrip } from '../context/TripContext';
import { useTheme } from '../context/ThemeContext';
import { createPreviewMarker, clearMarker } from '../utils/markers';

// Advanced Markers require a map ID; DEMO_MAP_ID is Google's sandbox ID for development
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

export default function Map() {
    const {
        mapLoaded,
        setMap,
        map,
        addToItinerary,
        currentMarker,
        currentPlace,
        setCurrentPlace,
        setCurrentMarker
    } = useTrip();

    const { resolvedTheme } = useTheme();

    // colorScheme can only be set at construction, so the map is rebuilt on theme
    // change; TripContext re-attaches markers and the polyline when `map` changes
    const mapThemeRef = useRef(null);
    useEffect(() => {
        if (!mapLoaded) return;
        if (map && mapThemeRef.current === resolvedTheme) return;

        const newMap = new window.google.maps.Map(document.getElementById('map'), {
            center: map ? map.getCenter() : { lat: 40.749933, lng: -73.98633 },
            zoom: map ? map.getZoom() : 13,
            mapId: MAP_ID,
            colorScheme: resolvedTheme === 'dark'
                ? window.google.maps.ColorScheme.DARK
                : window.google.maps.ColorScheme.LIGHT,
            mapTypeControl: false,
            zoomControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            disableDefaultUI: true,
            clickableIcons: true,
            gestureHandling: 'greedy'
        });

        mapThemeRef.current = resolvedTheme;
        setMap(newMap);
    }, [mapLoaded, map, resolvedTheme, setMap]);

    // Handle POI clicks
    useEffect(() => {
        if (!map) return;

        const listener = map.addListener('click', async (e) => {
            if (!e.placeId) return;
            e.stop(); // Prevent default InfoWindow

            try {
                const { Place } = await window.google.maps.importLibrary('places');
                const place = new Place({ id: e.placeId });
                await place.fetchFields({
                    fields: ['displayName', 'formattedAddress', 'location'],
                });

                if (!place.location) return;

                const placeData = {
                    name: place.displayName,
                    address: place.formattedAddress,
                    lat: place.location.lat(),
                    lng: place.location.lng(),
                    placeId: e.placeId
                };

                setCurrentPlace(placeData);

                clearMarker(currentMarker);

                const newMarker = createPreviewMarker({
                    map: map,
                    position: place.location,
                    title: placeData.name,
                });

                setCurrentMarker(newMarker);

                // Pan to location for visibility
                map.panTo(place.location);
            } catch (error) {
                console.error('Failed to fetch place details:', error);
            }
        });

        return () => {
            window.google.maps.event.removeListener(listener);
        };
    }, [map, currentMarker, setCurrentPlace, setCurrentMarker, addToItinerary]);

    // Make current marker clickable (for direct add if user clicks the marker itself)
    useEffect(() => {
        if (currentMarker && currentPlace) {
            const handleClick = () => {
                addToItinerary();
            };
            currentMarker.addEventListener('gmp-click', handleClick);
            return () => {
                currentMarker.removeEventListener('gmp-click', handleClick);
            };
        }
    }, [currentMarker, currentPlace, addToItinerary]);

    return (
        <div
            id="map"
            className="absolute inset-0 w-full h-full"
        />
    );
}

