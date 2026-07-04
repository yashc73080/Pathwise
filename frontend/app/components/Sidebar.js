'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDraggablePanel } from '../hooks/useDraggablePanel';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
import { addTrip, updateTripName } from '../firebase/firestore';
import toast from 'react-hot-toast';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import WeatherVisualization from './WeatherVisualization';
import { getBackendUrl } from '../utils/backendUrl';
import { getDayColor } from '../utils/dayColors';

export default function Sidebar() {
    const {
        isSidebarOpen,
        setIsSidebarOpen,
        selectedLocations,
        removeLocation,
        reorderLocations,
        submitItinerary,
        isSubmitting,
        clearAllLocations,
        startIndex,
        endIndex,
        setStartLocation,
        setEndLocation,
        activePanel,
        setActivePanel,
        optimizedRoute,
        hasAnyOptimizedRoute,
        hasOptimizableDay,
        optimizationRunId,
        optimizedCoords,
        exportToGoogleMaps,
        reorderOptimizedRoute,
        sidebarHeight,
        setSidebarHeight,
        trip,
        activeDayId,
        setActiveDayId,
        addDay,
        removeDay,
        serializeCurrentTrip
    } = useTrip();

    const { userLoggedIn, currentUser, openLoginModal } = useAuth();

    // Desktop tab: 'itinerary' | 'route'
    const [desktopTab, setDesktopTab] = useState('itinerary');
    const [isSaving, setIsSaving] = useState(false);
    const [showSignInPrompt, setShowSignInPrompt] = useState(false);
    const activeDayIndex = Math.max(0, trip.days.findIndex(day => day.id === activeDayId));
    const activeDayColor = getDayColor(activeDayIndex);

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

    // Show the save prompt after an optimization, but leave the user on their current tab.
    useEffect(() => {
        if (optimizedRoute && !currentUser) {
            setShowSignInPrompt(true);
        }
    }, [optimizedRoute, currentUser]);

    useEffect(() => {
        if (optimizationRunId > 0) {
            setDesktopTab('route');
            if (!currentUser) setShowSignInPrompt(true);
        }
    }, [optimizationRunId, currentUser]);

    // Detect when new destinations are added after optimization - switch back to itinerary
    const isRouteStale = optimizedCoords && selectedLocations.length > optimizedCoords.length;
    useEffect(() => {
        if (isRouteStale) {
            setDesktopTab('itinerary');
        }
    }, [isRouteStale]);

    const handleRouteDragEnd = (result) => {
        if (!result.destination) return;
        if (result.destination.index === result.source.index) return;
        reorderOptimizedRoute(result.source.index, result.destination.index);
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
                ...serializeCurrentTrip(),
                title: null
            };

            const tripId = await addTrip(currentUser, tripData);
            toast.success('Trip saved successfully!');

            fetch(`${getBackendUrl()}/generate-trip-name`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locations: selectedLocations })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.name && data.name !== 'My Trip') {
                        updateTripName(currentUser, tripId, data.name);
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
                    className="hidden md:block absolute top-20 left-4 z-20 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105"
                    aria-label="Open itinerary sidebar"
                >
                    <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Mobile: Bottom sheet panel with draggable height */}
            <div
                ref={panelRef}
                className={`
                    md:hidden fixed z-40 bg-white dark:bg-gray-900 shadow-xl flex flex-col
                    inset-x-0 bottom-0 rounded-t-2xl
                    transition-all duration-300 ease-in-out
                    ${isMobileVisible ? 'translate-y-0' : 'translate-y-full'}
                    ${sidebarHeight === 'full' ? 'h-[75vh]' : 'h-[40vh]'}
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

                {/* Header Row - left side draggable, right side button */}
                <div className="px-4 pb-2 flex items-center border-b border-gray-200 dark:border-gray-700">
                    {/* Draggable area - title */}
                    <div
                        className="flex-1 cursor-grab active:cursor-grabbing touch-none"
                        onMouseDown={handleDragStart}
                        onTouchStart={handleDragStart}
                    >
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Itinerary</h2>
                    </div>
                    {/* Close button - not draggable */}
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        aria-label="Close itinerary"
                    >
                        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <DayTabs
                        days={trip.days}
                        activeDayId={activeDayId}
                        setActiveDayId={setActiveDayId}
                        addDay={addDay}
                        removeDay={removeDay}
                    />
                    {selectedLocations.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <LocationList
                            selectedLocations={selectedLocations}
                            startIndex={startIndex}
                            endIndex={endIndex}
                            setStartLocation={setStartLocation}
                            setEndLocation={setEndLocation}
                            removeLocation={removeLocation}
                            reorderLocations={reorderLocations}
                        />
                    )}
                </div>

                <ActionButtons
                    selectedLocations={selectedLocations}
                    hasOptimizableDay={hasOptimizableDay}
                    submitItinerary={submitItinerary}
                    isSubmitting={isSubmitting}
                    clearAllLocations={clearAllLocations}
                />
            </div>

            {/* Desktop: Floating left panel with tabs */}
            <div
                className={`
                    hidden md:flex absolute z-10 bg-white dark:bg-gray-900 shadow-xl flex-col transition-all duration-300
                    top-20 left-4 w-88 rounded-lg
                    ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
                `}
                style={{ height: 'calc(100% - 6rem)' }}
            >
                {/* Header with close button */}
                <div className="p-4 pb-2 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Trip Planner</h2>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        aria-label="Close sidebar"
                    >
                        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>

                {/* Tab buttons */}
                <div className="px-4 pb-2">
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        <button
                            onClick={() => setDesktopTab('itinerary')}
                            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${desktopTab === 'itinerary'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            Itinerary
                        </button>
                        <button
                            onClick={() => setDesktopTab('route')}
                            disabled={!hasAnyOptimizedRoute}
                            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${desktopTab === 'route'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : hasAnyOptimizedRoute
                                    ? 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                    : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Route
                            {optimizedRoute && !isRouteStale && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                        </button>
                    </div>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
                    {desktopTab === 'itinerary' ? (
                        <>
                            <DayTabs
                                days={trip.days}
                                activeDayId={activeDayId}
                                setActiveDayId={setActiveDayId}
                                addDay={addDay}
                                removeDay={removeDay}
                            />
                            {selectedLocations.length === 0 ? (
                                <EmptyState />
                            ) : (
                                <LocationList
                                    selectedLocations={selectedLocations}
                                    startIndex={startIndex}
                                    endIndex={endIndex}
                                    setStartLocation={setStartLocation}
                                    setEndLocation={setEndLocation}
                                    removeLocation={removeLocation}
                                    reorderLocations={reorderLocations}
                                />
                            )}
                        </>
                    ) : (
                        /* Optimized Route View */
                        <div className="p-4">
                            <RouteDayTabs
                                days={trip.days}
                                activeDayId={activeDayId}
                                setActiveDayId={setActiveDayId}
                            />
                            {optimizedRoute && optimizedCoords ? (
                                <DragDropContext onDragEnd={handleRouteDragEnd}>
                                    <Droppable
                                        droppableId="optimized-route"
                                        renderClone={(provided, snapshot, rubric) => {
                                            const location = optimizedCoords[rubric.source.index];
                                            const index = rubric.source.index;
                                            return (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`flex items-center gap-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg cursor-grab active:cursor-grabbing shadow-lg scale-[1.02]`}
                                                >
                                                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                    </svg>
                                                    <span
                                                        className="w-7 h-7 text-white rounded-full flex items-center justify-center text-sm font-medium shadow-sm"
                                                        style={{ backgroundColor: activeDayColor.bg, border: `2px solid ${activeDayColor.border}` }}
                                                    >
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-gray-700 dark:text-gray-200 flex-1 truncate">{location.name}</span>
                                                </div>
                                            );
                                        }}
                                    >
                                        {(provided) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className="space-y-2"
                                            >
                                                {optimizedCoords.map((location, i) => (
                                                    <Draggable key={`route-${i}`} draggableId={`route-${i}`} index={i}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={`flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing ${snapshot.isDragging ? 'shadow-lg scale-[1.02] bg-blue-50 dark:bg-blue-900/30' : ''
                                                                    }`}
                                                            >
                                                                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                                </svg>
                                                                <span
                                                                    className="w-7 h-7 text-white rounded-full flex items-center justify-center text-sm font-medium shadow-sm"
                                                                    style={{ backgroundColor: activeDayColor.bg, border: `2px solid ${activeDayColor.border}` }}
                                                                >
                                                                    {i + 1}
                                                                </span>
                                                                <span className="text-gray-700 dark:text-gray-200 flex-1 truncate">{location.name}</span>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
                        hasOptimizableDay={hasOptimizableDay}
                        submitItinerary={submitItinerary}
                        isSubmitting={isSubmitting}
                        clearAllLocations={clearAllLocations}
                    />
                ) : (
                    /* Route tab actions */
                    optimizedRoute && (
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg flex flex-col gap-2">
                            {showSignInPrompt && !currentUser && (
                                <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg flex justify-between items-center shadow-sm animate-slide-up">
                                    <div className="flex-1">
                                        <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">✨ Trip optimized!</p>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Sign in to save this trip.</p>
                                    </div>
                                    <div className="flex gap-2 ml-3">
                                        <button
                                            onClick={() => setShowSignInPrompt(false)}
                                            className="text-blue-400 hover:text-blue-600 p-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => {
                                                openLoginModal();
                                                setShowSignInPrompt(false);
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                                        >
                                            Sign In
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2">
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
                                    className="flex-1 py-2.5 px-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                    title="Open in Google Maps"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 92.3 132.3">
                                        <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z" />
                                        <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z" />
                                        <path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3" />
                                        <path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3" />
                                        <path fill="#34a853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2" />
                                    </svg>
                                    Export
                                </button>
                            </div>
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
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-center">Search and add locations to create your itinerary</p>
        </div>
    );
}

function DayTabs({ days, activeDayId, setActiveDayId, addDay, removeDay }) {
    return (
        <div className="px-3 pt-3 pb-2 flex gap-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800">
            {days.map((day, index) => {
                const dayColor = getDayColor(index);
                return (
                <button
                    key={day.id}
                    onClick={() => setActiveDayId(day.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeDayId === day.id
                        ? 'text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    style={activeDayId === day.id ? { backgroundColor: dayColor.bg } : undefined}
                >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeDayId === day.id ? dayColor.text : dayColor.bg }} />
                    {day.label || 'Day'}
                </button>
                );
            })}
            <button
                onClick={addDay}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Add day"
            >
                +
            </button>
            {days.length > 1 && (
                <button
                    onClick={() => removeDay(activeDayId)}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-md bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50"
                    title="Remove current day"
                >
                    -
                </button>
            )}
        </div>
    );
}

function RouteDayTabs({ days, activeDayId, setActiveDayId }) {
    return (
        <div className="pb-3 mb-3 flex gap-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800">
            {days.map((day, index) => {
                const dayColor = getDayColor(index);
                return (
                    <button
                        key={day.id}
                        onClick={() => setActiveDayId(day.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeDayId === day.id
                            ? 'text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        style={activeDayId === day.id ? { backgroundColor: dayColor.bg } : undefined}
                    >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeDayId === day.id ? dayColor.text : dayColor.bg }} />
                        {day.label || 'Day'}
                    </button>
                );
            })}
        </div>
    );
}

// LocationList component (no drag-and-drop, just display)
function LocationList({ selectedLocations, startIndex, endIndex, setStartLocation, setEndLocation, removeLocation, reorderLocations }) {
    const handleDragEnd = (result) => {
        if (!result.destination || result.destination.index === result.source.index) return;
        reorderLocations(result.source.index, result.destination.index);
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="active-day-stops">
                {(provided) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="p-3 space-y-2"
                    >
                        {selectedLocations.map((location, index) => (
                            <Draggable key={location.id || index} draggableId={location.id || `stop-${index}`} index={index}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition-all duration-200 ${snapshot.isDragging ? 'shadow-lg border-blue-300 dark:border-blue-600' : ''}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                {...provided.dragHandleProps}
                                                className="p-1 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                </svg>
                                            </div>
                                            {/* Location info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{location.name}</p>
                                                    {startIndex === index && (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded shrink-0">S</span>
                                                    )}
                                                    {endIndex === index && (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded shrink-0">E</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{location.address}</p>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    onClick={() => setStartLocation(index)}
                                                    className={`p-1.5 rounded transition-all ${startIndex === index
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/50'
                                                        }`}
                                                    title="Set as start"
                                                >
                                                    <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">S</span>
                                                </button>
                                                <button
                                                    onClick={() => setEndLocation(index)}
                                                    className={`p-1.5 rounded transition-all ${endIndex === index
                                                        ? 'bg-red-600 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/50'
                                                        }`}
                                                    title="Set as end"
                                                >
                                                    <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">E</span>
                                                </button>
                                                <button
                                                    onClick={() => removeLocation(index)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all"
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
function ActionButtons({ selectedLocations, hasOptimizableDay, submitItinerary, isSubmitting, clearAllLocations }) {
    return (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
            {(selectedLocations.length > 0 || hasOptimizableDay) && (
                <div className="flex gap-2">
                    <button
                        onClick={submitItinerary}
                        disabled={isSubmitting || !hasOptimizableDay}
                        className={`flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium text-sm shadow-sm hover:from-blue-700 hover:to-blue-800 transition-all ${isSubmitting ? 'opacity-75 cursor-not-allowed' : 'hover:shadow-md'
                            }`}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Optimizing...
                            </div>
                        ) : (
                            'Optimize'
                        )}
                    </button>

                    <button
                        onClick={clearAllLocations}
                        className="py-2 px-3 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
}
