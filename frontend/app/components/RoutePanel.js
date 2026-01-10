'use client';

import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { addTrip, updateTripName } from '../firebase/firestore';
import WeatherVisualization from './WeatherVisualization';
import { useDraggablePanel } from '../hooks/useDraggablePanel';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function RoutePanel() {
    const { optimizedRoute, selectedLocations, optimizedCoords, exportToGoogleMaps, reorderOptimizedRoute, startIndex, endIndex, activePanel, setActivePanel, routeHeight, setRouteHeight, currentChatSessionId } = useTrip();
    const { userLoggedIn, currentUser, openLoginModal } = useAuth();

    const [isSaving, setIsSaving] = useState(false);
    const [showSignInPrompt, setShowSignInPrompt] = useState(false);

    // Draggable panel hook for mobile resizing
    const { panelRef, handleDragStart } = useDraggablePanel({
        initialHeight: routeHeight,
        onHeightChange: (newHeight) => {
            if (newHeight === 'minimized') {
                handleClose();
            } else {
                setRouteHeight(newHeight);
            }
        }
    });

    // Logging
    useEffect(() => {
        if (optimizedRoute) {
            console.log('Selected Locations:', selectedLocations);
            console.log('Optimized Route in RoutePanel:', optimizedRoute);
            console.log('Optimized Coordinates in RoutePanel:', optimizedCoords);
        }
        if (optimizedRoute) {
            console.log('Selected Locations:', selectedLocations);
            console.log('Optimized Route in RoutePanel:', optimizedRoute);
            console.log('Optimized Coordinates in RoutePanel:', optimizedCoords);
            if (!currentUser) setShowSignInPrompt(true);
        }
    }, [optimizedRoute, currentUser]);

    const handleSaveTrip = async () => {
        if (!userLoggedIn) {
            openLoginModal();
            return;
        }

        setIsSaving(true);
        try {
            // Prepare trip data with null name (AI will generate it in background)
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

            // Generate AI name in background (non-blocking)
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

    const handleClose = () => {
        setActivePanel('none');
    };

    // Determine visibility based on mobile (activePanel) or desktop (optimizedRoute exists)
    const isMobileVisible = activePanel === 'route';

    // Empty state component
    const EmptyState = () => (
        <div className="p-6 flex flex-col items-center justify-center text-center">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">No Route Yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Add locations and click &quot;Optimize Route&quot; to see your optimized path here.</p>
        </div>
    );

    // Handle drag end for route reordering
    const handleRouteDragEnd = (result) => {
        if (!result.destination) return;
        if (result.destination.index === result.source.index) return;
        reorderOptimizedRoute(result.source.index, result.destination.index);
    };

    // Route list component with drag-and-drop using renderClone for proper portal behavior
    const RouteList = () => {
        // Render function for both the in-place item and the dragging clone 
        // TODO: fix for mobile
        const renderDraggableItem = (provided, snapshot, location, index) => (
            <div
                ref={provided.innerRef}
                {...provided.draggableProps}
                {...provided.dragHandleProps}
                style={{
                    ...provided.draggableProps.style,
                    touchAction: 'none'
                }}
                className={`flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing ${snapshot.isDragging ? 'shadow-lg scale-[1.02] bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
            >
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
                <span className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full flex items-center justify-center text-sm font-medium shadow-sm">
                    {index + 1}
                </span>
                <span className="text-gray-700 dark:text-gray-200 flex-1 truncate">{location.name}</span>
            </div>
        );

        return (
            <DragDropContext onDragEnd={handleRouteDragEnd}>
                <Droppable
                    droppableId="mobile-optimized-route"
                    renderClone={(provided, snapshot, rubric) =>
                        renderDraggableItem(provided, snapshot, optimizedCoords[rubric.source.index], rubric.source.index)
                    }
                >
                    {(provided) => (
                        <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-2"
                        >
                            {optimizedCoords.map((location, i) => (
                                <Draggable key={`mobile-route-${i}`} draggableId={`mobile-route-${i}`} index={i}>
                                    {(provided, snapshot) => renderDraggableItem(provided, snapshot, location, i)}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        );
    };

    return (
        <>
            {/* Mobile only: Bottom sheet panel with draggable height */}
            <div
                ref={panelRef}
                className={`
                    md:hidden fixed z-40 bg-white dark:bg-gray-900 shadow-xl flex flex-col
                    inset-x-0 bottom-0 rounded-t-2xl
                    transition-all duration-300 ease-in-out
                    ${isMobileVisible ? 'translate-y-0' : 'translate-y-full'}
                    ${routeHeight === 'full' ? 'h-[75vh]' : 'h-[40vh]'}
                    pb-12
                `}
            >
                {/* Centered Drag Pill */}
                <div
                    className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                >
                    <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                </div>

                {/* Header Row - left side draggable, right side buttons */}
                <div className="px-4 pb-2 flex items-center border-b border-gray-200 dark:border-gray-700">
                    {/* Draggable area - title */}
                    <div
                        className="flex-1 cursor-grab active:cursor-grabbing touch-none"
                        onMouseDown={handleDragStart}
                        onTouchStart={handleDragStart}
                    >
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Optimized Route</h3>
                    </div>
                    {/* Buttons - not draggable */}
                    <div className="flex gap-1 items-center">
                        {showSignInPrompt && !currentUser && (
                            <button
                                onClick={openLoginModal}
                                className="mr-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full animate-pulse hover:bg-blue-200 dark:hover:bg-blue-800"
                            >
                                Sign In
                            </button>
                        )}
                        {optimizedRoute && (
                            <>
                                <button
                                    onClick={handleSaveTrip}
                                    disabled={isSaving}
                                    className={`p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all duration-200 ${isSaving ? 'opacity-75 cursor-not-allowed' : ''}`}
                                    title="Save Trip"
                                    aria-label="Save trip"
                                >
                                    {isSaving ? (
                                        <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                    )}
                                </button>
                                <button
                                    onClick={exportToGoogleMaps}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                                    title="Open in Google Maps"
                                    aria-label="Open in Google Maps"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 92.3 132.3">
                                        <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z" />
                                        <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z" />
                                        <path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3" />
                                        <path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3" />
                                        <path fill="#34a853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2" />
                                    </svg>
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleClose}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            aria-label="Close route panel"
                        >
                            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {optimizedRoute ? <RouteList /> : <EmptyState />}

                    {/* Weather Visualization */}
                    <WeatherVisualization />
                </div>
            </div>
            {/* Desktop RoutePanel removed - now integrated into Sidebar tabs */}
        </>
    );
}
