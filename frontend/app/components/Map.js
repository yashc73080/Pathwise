'use client';

import { useEffect, useRef } from 'react';
import { useTrip } from '../context/TripContext';
import { useTheme } from '../context/ThemeContext';

// Dark mode map styles
const darkMapStyles = [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    {
        featureType: 'administrative.locality',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#d59563' }]
    },
    {
        featureType: 'poi',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#d59563' }]
    },
    {
        featureType: 'poi.park',
        elementType: 'geometry',
        stylers: [{ color: '#263c3f' }]
    },
    {
        featureType: 'poi.park',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#6b9a76' }]
    },
    {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#38414e' }]
    },
    {
        featureType: 'road',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#212a37' }]
    },
    {
        featureType: 'road',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#9ca5b3' }]
    },
    {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#746855' }]
    },
    {
        featureType: 'road.highway',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#1f2835' }]
    },
    {
        featureType: 'road.highway',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#f3d19c' }]
    },
    {
        featureType: 'transit',
        elementType: 'geometry',
        stylers: [{ color: '#2f3948' }]
    },
    {
        featureType: 'transit.station',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#d59563' }]
    },
    {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#17263c' }]
    },
    {
        featureType: 'water',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#515c6d' }]
    },
    {
        featureType: 'water',
        elementType: 'labels.text.stroke',
        stylers: [{ color: '#17263c' }]
    }
];

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

    const { resolvedTheme } = useTheme();

    useEffect(() => {
        if (!mapLoaded || map) return;

        const newMap = new window.google.maps.Map(document.getElementById('map'), {
            center: { lat: 40.749933, lng: -73.98633 },
            zoom: 13,
            mapTypeControl: false,
            zoomControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: true,
            gestureHandling: 'greedy',
            styles: resolvedTheme === 'dark' ? darkMapStyles : []
        });

        setMap(newMap);
    }, [mapLoaded, map, setMap]);

    // Update map styles when theme changes
    useEffect(() => {
        if (!map) return;
        map.setOptions({
            styles: resolvedTheme === 'dark' ? darkMapStyles : []
        });
    }, [map, resolvedTheme]);

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

