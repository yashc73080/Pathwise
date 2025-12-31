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

                        // Create InfoWindow Content with DOM API to avoid global window issues
                        const contentDiv = document.createElement('div');
                        contentDiv.style.padding = '12px';
                        contentDiv.style.minWidth = '200px';

                        const title = document.createElement('h3');
                        title.textContent = place.name;
                        title.style.margin = '0 0 8px 0';
                        title.style.color = '#666666ff';
                        title.style.fontSize = '16px';
                        title.style.fontWeight = '600';
                        contentDiv.appendChild(title);

                        const address = document.createElement('p');
                        address.textContent = place.formatted_address;
                        address.style.margin = '0 0 12px 0';
                        address.style.color = '#666';
                        address.style.fontSize = '14px';
                        contentDiv.appendChild(address);

                        const btn = document.createElement('button');
                        btn.textContent = 'Add to Itinerary';
                        btn.style.width = '100%';
                        btn.style.backgroundColor = '#2563eb';
                        btn.style.color = 'white';
                        btn.style.padding = '8px 12px';
                        btn.style.border = 'none';
                        btn.style.borderRadius = '6px';
                        btn.style.fontWeight = '500';
                        btn.style.cursor = 'pointer';
                        btn.style.transition = 'background-color 0.2s';

                        btn.onmouseover = () => btn.style.backgroundColor = '#1d4ed8';
                        btn.onmouseout = () => btn.style.backgroundColor = '#2563eb';

                        btn.onclick = () => {
                            addToItinerary(placeData, newMarker);
                            infoWindow.close();
                        };

                        contentDiv.appendChild(btn);

                        const infoWindow = new window.google.maps.InfoWindow({
                            content: contentDiv,
                        });

                        infoWindow.open(map, newMarker);
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
