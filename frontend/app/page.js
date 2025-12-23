'use client';

import { useEffect, useState, useRef } from 'react';
import ChatInterface from './components/ChatInterface';

export default function Page() {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [currentPlace, setCurrentPlace] = useState(null);
  const [map, setMap] = useState(null);
  const [searchBox, setSearchBox] = useState(null);
  const [currentMarker, setCurrentMarker] = useState(null);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);
  const locationsListRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (locationsListRef.current) {
      locationsListRef.current.scrollTop = locationsListRef.current.scrollHeight;
    }
  }, [selectedLocations]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (!mapLoaded) return;

    const newMap = new window.google.maps.Map(document.getElementById('map'), {
      center: { lat: 40.749933, lng: -73.98633 },
      zoom: 13,
      mapTypeControl: false, // Disable map type control (satellite/map switch)
      zoomControl: false,
      // scaleControl: true,
      streetViewControl: false,
      // rotateControl: true,
      fullscreenControl: false
    });
    setMap(newMap);

    const input = document.getElementById('pac-input');
    const newSearchBox = new window.google.maps.places.SearchBox(input);
    setSearchBox(newSearchBox);

    newMap.addListener('bounds_changed', () => {
      newSearchBox.setBounds(newMap.getBounds());
    });

    newSearchBox.addListener('places_changed', () => {
      const places = newSearchBox.getPlaces();

      if (places.length === 0) return;

      const place = places[0];

      if (!place.geometry || !place.geometry.location) {
        console.log('Returned place contains no geometry');
        return;
      }

      setCurrentPlace({
        name: place.name,
        address: place.formatted_address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      });

      if (currentMarker) {
        currentMarker.setMap(null);
      }

      const newMarker = new window.google.maps.Marker({
        map: newMap,
        position: place.geometry.location,
        title: place.name,
        animation: window.google.maps.Animation.DROP,
      });

      setCurrentMarker(newMarker);

      if (place.geometry.viewport) {
        newMap.fitBounds(place.geometry.viewport);
      } else {
        newMap.setCenter(place.geometry.location);
        newMap.setZoom(17);
      }
    });

  }, [mapLoaded]);

  const addToItinerary = () => {
    if (currentPlace && !selectedLocations.some(loc => loc.name === currentPlace.name)) {
      const marker = new window.google.maps.Marker({
        map: map,
        position: { lat: currentPlace.lat, lng: currentPlace.lng },
        title: currentPlace.name,
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        }
      });

      setSelectedLocations([...selectedLocations, { ...currentPlace, marker }]);
      document.getElementById('pac-input').value = '';
      setCurrentPlace(null);

      if (currentMarker) {
        currentMarker.setMap(null);
        setCurrentMarker(null);
      }
    }
  };

  const removeLocation = (index) => {
    const locationToRemove = selectedLocations[index];
    if (locationToRemove.marker) {
      locationToRemove.marker.setMap(null);
    }

    const newLocations = selectedLocations.filter((_, i) => i !== index);
    setSelectedLocations(newLocations);

    // Clear the optimized route when locations are modified
    setOptimizedRoute(null);
    if (routePolyline) {
      routePolyline.setMap(null);
      setRoutePolyline(null);
    }
  };

  const clearAllLocations = () => {
    // Clear all markers from the map
    selectedLocations.forEach(location => {
      if (location.marker) {
        location.marker.setMap(null);
      }
    });

    // Clear the optimized route
    if (routePolyline) {
      routePolyline.setMap(null);
      setRoutePolyline(null);
    }

    // Reset states
    setSelectedLocations([]);
    setOptimizedRoute(null);
  };

  // Submit itinerary function
  const submitItinerary = async () => {
    if (selectedLocations.length === 0) {
      alert("No locations to submit.");
      return;
    }

    setIsSubmitting(true);

    const itineraryData = selectedLocations.map(location => ({
      name: location.name,
      lat: location.lat,
      lng: location.lng
    }));

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/submit-itinerary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locations: itineraryData }),
      });

      if (response.ok) {
        const data = await response.json();
        setOptimizedRoute(data.optimized_route);

        if (routePolyline) {
          routePolyline.setMap(null);
        }

        const routeCoordinates = data.optimized_route.map(index => ({
          lat: selectedLocations[index].lat,
          lng: selectedLocations[index].lng
        }));

        routeCoordinates.push(routeCoordinates[0]);

        const newPolyline = new window.google.maps.Polyline({
          path: routeCoordinates,
          geodesic: true,
          strokeColor: '#FF0000',
          strokeOpacity: 1.0,
          strokeWeight: 2,
          map: map
        });

        setRoutePolyline(newPolyline);

        const bounds = new window.google.maps.LatLngBounds();
        routeCoordinates.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds);
      } else {
        alert('Failed to submit itinerary.');
      }
    } catch (error) {
      console.error('Error submitting itinerary:', error);
      alert('Error submitting itinerary.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Main Content Container */}
      <div className="flex-1 flex relative">
        {/* Map Container */}
        <div className="flex-1 relative">
          {/* Sidebar Toggle Button (only visible when sidebar is closed) */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-20 left-4 z-20 p-3 bg-white rounded-lg shadow-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Floating Search Box */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-full max-w-xl z-10 px-4">
            <div className="bg-white rounded-lg shadow-lg flex items-center p-1">
              <input
                id="pac-input"
                className="flex-1 p-3 bg-transparent border-none focus:ring-0 text-gray-900"
                type="text"
                placeholder="Search for a location"
              />
              <button
                onClick={addToItinerary}
                disabled={!currentPlace}
                className={`p-3 rounded-lg transition-colors ${
                  currentPlace
                    ? 'text-blue-600 hover:bg-gray-100'
                    : 'text-gray-400'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Collapsible Left Panel */}
          <div 
            className={`absolute top-20 left-4 w-88 bg-white rounded-lg shadow-xl flex flex-col z-10 transition-all duration-300 ${
              isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
            }`}
            style={{ height: 'calc(100% - 6rem)' }}
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Your Itinerary</h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Locations List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                {selectedLocations.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Search and add locations to create your itinerary</p>
                ) : (
                  selectedLocations.map((location, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-100 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{location.name}</p>
                          <p className="text-sm text-gray-500">{location.address}</p>
                        </div>
                        <button
                          onClick={() => removeLocation(index)}
                          className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t bg-gray-50 rounded-b-lg">
              {selectedLocations.length > 0 && (
                <>
                  <button
                    onClick={submitItinerary}
                    disabled={isSubmitting}
                    className={`w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors ${
                      isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Optimizing Route...
                      </div>
                    ) : (
                      'Optimize Route'
                    )}
                  </button>
                  <button
                    onClick={clearAllLocations}
                    className="w-full mt-2 py-2 px-4 text-gray-600 hover:text-gray-900 text-sm transition-colors"
                  >
                    Clear All Locations
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Map */}
          <div 
            id="map" 
            className="absolute inset-0 w-full h-full"
          />

          {/* Optimized Route Panel */}
          {optimizedRoute && (
            <div className="absolute top-20 right-4 w-80 bg-white rounded-lg shadow-lg">
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Optimized Route</h3>
                <div className="space-y-2">
                  {optimizedRoute.map((index, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                        {i + 1}
                      </span>
                      <span className="text-gray-700">{selectedLocations[index]?.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat Panel */}
          <div className="absolute bottom-4 right-4 flex flex-col items-end">
            {isChatOpen && (
              <div className="mb-4 w-88 bg-white rounded-lg shadow-lg">
                <div className="h-96 flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="font-semibold text-gray-900">TripWhiz AI Assistant</h2>
                    <button
                      onClick={() => setIsChatOpen(false)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 p-4 overflow-hidden">
                    <ChatInterface selectedLocations={selectedLocations} />
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="font-medium">TripWhiz AI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}