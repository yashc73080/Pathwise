'use client';

import { useEffect, useRef } from 'react';
import { useTrip } from '../context/TripContext';

export default function Map() {
    const {
        mapLoaded,
        setMap,
        map,
        searchBox,
        addToItinerary,
        currentMarker,
        currentPlace
    } = useTrip();

    const mapRef = useRef(null);

    useEffect(() => {
        if (!mapLoaded || map) return;

        const newMap = new window.google.maps.Map(document.getElementById('map'), {
            center: { lat: 40.749933, lng: -73.98633 },
            zoom: 13,
            mapTypeControl: false,
            zoomControl: false,
            streetViewControl: false,
            fullscreenControl: false
        });

        setMap(newMap);

        // Click on map to close items? Or maybe generic click handling
        // For now keeping it simple as per original code
    }, [mapLoaded, map, setMap]);

    // Handle bounds change - sync with searchbox
    useEffect(() => {
        if (map && searchBox) {
            const listener = map.addListener('bounds_changed', () => {
                searchBox.setBounds(map.getBounds());
            });
            return () => {
                window.google.maps.event.removeListener(listener);
            };
        }
    }, [map, searchBox]);

    // Make current marker clickable
    useEffect(() => {
        if (currentMarker && currentPlace) {
            const listener = currentMarker.addListener('click', () => {
                addToItinerary();
            });
            return () => {
                window.google.maps.event.removeListener(listener);
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
