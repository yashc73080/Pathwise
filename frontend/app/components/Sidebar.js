'use client';

import { useState, useEffect } from 'react';
import { useDraggablePanel } from '../hooks/useDraggablePanel';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
import { addTrip, updateTripName } from '../firebase/firestore';
import toast from 'react-hot-toast';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import WeatherVisualization from './WeatherVisualization';

export default function Sidebar() {
    const {
        isSidebarOpen,
        setIsSidebarOpen,
        selectedLocations,
        removeLocation,
        submitItinerary,
        isSubmitting,
        clearAllLocations,
        reorderLocations,
        startIndex,
        endIndex,
        setStartLocation,
        setEndLocation,
        activePanel,
        setActivePanel,
        optimizedRoute,
        optimizedCoords,
        exportToGoogleMaps,
        sidebarHeight,
        setSidebarHeight,
        currentChatSessionId
    } = useTrip();

    const { userLoggedIn, currentUser, openLoginModal } = useAuth();

    // Desktop tab: 'itinerary' | 'route'
    const [desktopTab, setDesktopTab] = useState('itinerary');
    const [isSaving, setIsSaving] = useState(false);

    // Draggable panel hook
    const { panelRef, handleDragStart } = useDraggablePanel({
        initialHeight: sidebarHeight,
        onHeightChange: (newHeight) => {
            if (newHeight === 'minimized') {
                handleClose();
            } else {
                setSidebarHeight(newHeight);
            }
        }
    });

    // Auto-switch to route tab when optimization completes
    useEffect(() => {
        if (optimizedRoute) {
            setDesktopTab('route');
        }
    }, [optimizedRoute]);

    const handleDragEnd = (result) => {
        if (!result.destination) return;
        if (result.destination.index === result.source.index) return;
        reorderLocations(result.source.index, result.destination.index);
    };

    const handleClose = () => {
        setIsSidebarOpen(false);
        setActivePanel('none');
    };

    const handleSaveTrip = async () => {
        if (!userLoggedIn) {
            openLoginModal();
            return;
        }

        setIsSaving(true);
        try {
            const tripData = {
                name: null,
                locations: selectedLocations.map(loc => ({
                    name: loc.name,
                    lat: loc.lat,
                    lng: loc.lng,
                    address: loc.address || ''
                })),
                optimizedRoute,
                startIndex,
                endIndex,
                chatSessionId: currentChatSessionId || null
            };

            const tripId = await addTrip(currentUser.uid, tripData);
            toast.success('Trip saved successfully!');

            fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/generate-trip-name`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locations: tripData.locations })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.name && data.name !== 'My Trip') {
                        updateTripName(tripId, data.name);
                    }
                })
                .catch(err => console.error('Background name generation failed:', err));

        } catch (error) {
            toast.error('Failed to save trip');
        } finally {
            setIsSaving(false);
        }
    };

    const isMobileVisible = activePanel === 'itinerary';

    return (
        <>
            {/* Sidebar Toggle Button (only visible on desktop when sidebar is closed) */}
            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="hidden md:block absolute top-20 left-4 z-20 p-3 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-all duration-200 hover:scale-105"
                    aria-label="Open itinerary sidebar"
                >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Mobile: Bottom sheet panel with draggable height */}
            <div
                ref={panelRef}
                className={`
                    md:hidden fixed z-40 bg-white shadow-xl flex flex-col
                    inset-x-0 bottom-0 rounded-t-2xl
                    transition-all duration-300 ease-in-out
                    ${isMobileVisible ? 'translate-y-0' : 'translate-y-full'}
                    ${sidebarHeight === 'full' ? 'h-[85vh]' : 'h-[40vh]'}
                `}
                style={{ paddingBottom: '4rem' }}
            >
                {/* Drag Handle */}
                <div
                    className="flex justify-center py-6 cursor-grab active:cursor-grabbing touch-none w-full"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                >
                    <div className="w-16 h-1.5 bg-gray-300 rounded-full active:bg-gray-400 transition-colors"></div>
                </div>

                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">Your Itinerary</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Close itinerary"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {selectedLocations.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <LocationList
                            selectedLocations={selectedLocations}
                            handleDragEnd={handleDragEnd}
                            startIndex={startIndex}
                            endIndex={endIndex}
                            setStartLocation={setStartLocation}
                            setEndLocation={setEndLocation}
                            removeLocation={removeLocation}
                        />
                    )}
                </div>

                <ActionButtons
                    selectedLocations={selectedLocations}
                    submitItinerary={submitItinerary}
                    isSubmitting={isSubmitting}
                    clearAllLocations={clearAllLocations}
                />
            </div>

            {/* Desktop: Floating left panel with tabs */}
            <div
                className={`
                    hidden md:flex absolute z-10 bg-white shadow-xl flex-col transition-all duration-300
                    top-20 left-4 w-88 rounded-lg
                    ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
                `}
                style={{ height: 'calc(100% - 6rem)' }}
            >
                {/* Header with close button */}
                <div className="p-4 pb-2 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Trip Planner</h2>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Close sidebar"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>

                {/* Tab buttons */}
                <div className="px-4 pb-2">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setDesktopTab('itinerary')}
                            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${desktopTab === 'itinerary'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Itinerary
                        </button>
                        <button
                            onClick={() => setDesktopTab('route')}
                            disabled={!optimizedRoute}
                            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${desktopTab === 'route'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : optimizedRoute
                                    ? 'text-gray-600 hover:text-gray-900'
                                    : 'text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Route
                            {optimizedRoute && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                        </button>
                    </div>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto border-t">
                    {desktopTab === 'itinerary' ? (
                        <>
                            {selectedLocations.length === 0 ? (
                                <EmptyState />
                            ) : (
                                <LocationList
                                    selectedLocations={selectedLocations}
                                    handleDragEnd={handleDragEnd}
                                    startIndex={startIndex}
                                    endIndex={endIndex}
                                    setStartLocation={setStartLocation}
                                    setEndLocation={setEndLocation}
                                    removeLocation={removeLocation}
                                />
                            )}
                        </>
                    ) : (
                        /* Optimized Route View */
                        <div className="p-4">
                            {optimizedRoute && optimizedCoords ? (
                                <div className="space-y-2">
                                    {optimizedCoords.map((location, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                            <span className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full flex items-center justify-center text-sm font-medium shadow-sm">
                                                {i + 1}
                                            </span>
                                            <span className="text-gray-700 flex-1 truncate">{location.name}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <p>No optimized route yet</p>
                                    <p className="text-sm mt-1">Go to Itinerary tab and click &quot;Optimize Route&quot;</p>
                                </div>
                            )}

                            {/* Weather Visualization */}
                            <WeatherVisualization />
                        </div>
                    )}
                </div>

                {/* Bottom Actions */}
                {desktopTab === 'itinerary' ? (
                    <ActionButtons
                        selectedLocations={selectedLocations}
                        submitItinerary={submitItinerary}
                        isSubmitting={isSubmitting}
                        clearAllLocations={clearAllLocations}
                    />
                ) : (
                    /* Route tab actions */
                    optimizedRoute && (
                        <div className="p-4 border-t bg-gray-50 rounded-b-lg flex gap-2">
                            <button
                                onClick={handleSaveTrip}
                                disabled={isSaving}
                                className={`flex-1 py-2.5 px-4 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-colors ${isSaving ? 'opacity-75 cursor-not-allowed' : ''
                                    }`}
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                    </svg>
                                )}
                                Save
                            </button>
                            <button
                                onClick={exportToGoogleMaps}
                                className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Export
                            </button>
                        </div>
                    )
                )}
            </div>
        </>
    );
}

// Empty State component
function EmptyState() {
    return (
        <div className="p-4 flex flex-col items-center justify-center h-full">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-500 text-center">Search and add locations to create your itinerary</p>
        </div>
    );
}

// LocationList component
function LocationList({ selectedLocations, handleDragEnd, startIndex, endIndex, setStartLocation, setEndLocation, removeLocation }) {
    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="locations">
                {(provided) => (
                    <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="p-4 space-y-3"
                    >
                        {selectedLocations.map((location, index) => (
                            <Draggable key={index} draggableId={`location-${index}`} index={index}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className={`
                                            bg-gray-50 rounded-lg p-3 border transition-all duration-200
                                            ${snapshot.isDragging
                                                ? 'shadow-lg border-blue-300 scale-[1.02]'
                                                : 'border-gray-100 hover:border-blue-200 hover:shadow-sm'
                                            }
                                        `}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div
                                                        {...provided.dragHandleProps}
                                                        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded transition-colors"
                                                        aria-label="Drag to reorder"
                                                    >
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                        </svg>
                                                    </div>
                                                    {startIndex === index && (
                                                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Start</span>
                                                    )}
                                                    {endIndex === index && (
                                                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">End</span>
                                                    )}
                                                </div>
                                                <p className="font-medium text-gray-900">{location.name}</p>
                                                <p className="text-sm text-gray-500 line-clamp-1">{location.address}</p>
                                            </div>
                                            <div className="flex flex-col gap-2 items-end">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setStartLocation(index)}
                                                        className={`px-2 py-1.5 text-xs rounded-lg transition-all ${startIndex === index
                                                            ? 'bg-green-600 text-white'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                                                            }`}
                                                        title="Set as start"
                                                    >
                                                        S
                                                    </button>
                                                    <button
                                                        onClick={() => setEndLocation(index)}
                                                        className={`px-2 py-1.5 text-xs rounded-lg transition-all ${endIndex === index
                                                            ? 'bg-red-600 text-white'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-red-100'
                                                            }`}
                                                        title="Set as end"
                                                    >
                                                        E
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => removeLocation(index)}
                                                    className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                                                    aria-label="Remove location"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
}

// ActionButtons component
function ActionButtons({ selectedLocations, submitItinerary, isSubmitting, clearAllLocations }) {
    return (
        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
            {selectedLocations.length > 0 && (
                <>
                    <button
                        onClick={submitItinerary}
                        disabled={isSubmitting}
                        className={`w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium shadow-sm hover:from-blue-700 hover:to-blue-800 transition-all ${isSubmitting ? 'opacity-75 cursor-not-allowed' : 'hover:shadow-md'
                            }`}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Optimizing...
                            </div>
                        ) : (
                            'Optimize Route'
                        )}
                    </button>

                    <button
                        onClick={clearAllLocations}
                        className="w-full mt-2 py-2 px-4 text-gray-500 hover:text-red-600 text-sm transition-colors hover:bg-red-50 rounded-lg"
                    >
                        Clear All
                    </button>
                </>
            )}
        </div>
    );
}
