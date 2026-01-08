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
        currentPlace,
        setCurrentPlace,
        setCurrentMarker
    } = useTrip();

    useEffect(() => {
        if (!mapLoaded || map) return;

        const newMap = new window.google.maps.Map(document.getElementById('map'), {
            center: { lat: 40.749933, lng: -73.98633 },
            zoom: 13,
            mapTypeControl: false,
            zoomControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: true
        });

        setMap(newMap);
    }, [mapLoaded, map, setMap]);

    // Handle POI clicks
    useEffect(() => {
        if (!map) return;

        const listener = map.addListener('click', (e) => {
            if (e.placeId) {
                e.stop(); // Prevent default InfoWindow

                const placesService = new window.google.maps.places.PlacesService(map);

                placesService.getDetails({ placeId: e.placeId }, (place, status) => {
                    if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                        const placeData = {
                            name: place.name,
                            address: place.formatted_address,
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng(),
                            placeId: e.placeId
                        };

                        setCurrentPlace(placeData);

                        if (currentMarker) {
                            currentMarker.setMap(null);
                        }

                        const newMarker = new window.google.maps.Marker({
                            map: map,
                            position: place.geometry.location,
                            title: place.name,
                            animation: window.google.maps.Animation.DROP,
                        });

                        setCurrentMarker(newMarker);

                        // Pan to location for visibility
                        map.panTo(place.geometry.location);
                    }
                });
            }
        });

        return () => {
            window.google.maps.event.removeListener(listener);
        };
    }, [map, currentMarker, setCurrentPlace, setCurrentMarker, addToItinerary]);

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

    // Make current marker clickable (for direct add if user clicks the marker itself)
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
