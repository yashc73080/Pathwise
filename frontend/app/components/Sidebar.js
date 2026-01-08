'use client';

import { useTrip } from '../context/TripContext';

import toast from 'react-hot-toast';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

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
        setActivePanel
    } = useTrip();

    const handleDragEnd = (result) => {
        if (!result.destination) {
            return;
        }

        if (result.destination.index === result.source.index) {
            return;
        }

        reorderLocations(result.source.index, result.destination.index);
    };

    const handleClose = () => {
        setIsSidebarOpen(false);
        setActivePanel('none');
    };

    // Determine visibility based on mobile (activePanel) or desktop (isSidebarOpen)
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

            {/* Mobile: Bottom sheet panel */}
            <div
                className={`
                    md:hidden fixed z-40 bg-white shadow-xl flex flex-col
                    inset-x-0 bottom-0 h-[70vh] rounded-t-2xl
                    transition-transform duration-300 ease-in-out
                    ${isMobileVisible ? 'translate-y-0' : 'translate-y-full'}
                `}
                style={{ paddingBottom: '4rem' }}
            >
                {/* Handle indicator */}
                <div className="flex justify-center pt-2 pb-1">
                    <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
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

                {/* Locations List */}
                <div className="flex-1 overflow-y-auto">
                    {selectedLocations.length === 0 ? (
                        <div className="p-4 flex flex-col items-center justify-center h-full">
                            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-gray-500 text-center">Search and add locations to create your itinerary</p>
                        </div>
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

                {/* Bottom Actions */}
                <ActionButtons
                    selectedLocations={selectedLocations}
                    submitItinerary={submitItinerary}
                    isSubmitting={isSubmitting}
                    clearAllLocations={clearAllLocations}
                />
            </div>

            {/* Desktop: Floating left panel */}
            <div
                className={`
                    hidden md:flex absolute z-10 bg-white shadow-xl flex-col transition-all duration-300
                    top-20 left-4 w-88 rounded-lg
                    ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
                `}
                style={{ height: 'calc(100% - 6rem)' }}
            >
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">Your Itinerary</h2>
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

                {/* Locations List */}
                <div className="flex-1 overflow-y-auto">
                    {selectedLocations.length === 0 ? (
                        <div className="p-4 flex flex-col items-center justify-center h-full">
                            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-gray-500 text-center">Search and add locations to create your itinerary</p>
                        </div>
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

                {/* Bottom Actions */}
                <ActionButtons
                    selectedLocations={selectedLocations}
                    submitItinerary={submitItinerary}
                    isSubmitting={isSubmitting}
                    clearAllLocations={clearAllLocations}
                />
            </div>
        </>
    );
}

// Extracted LocationList component for reuse
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
                                                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                                                            </svg>
                                                            Start
                                                        </span>
                                                    )}
                                                    {endIndex === index && (
                                                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" transform="rotate(180 10 10)" />
                                                            </svg>
                                                            End
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-medium text-gray-900">{location.name}</p>
                                                <p className="text-sm text-gray-500 line-clamp-1">{location.address}</p>
                                            </div>
                                            <div className="flex flex-col gap-2 items-end">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setStartLocation(index)}
                                                        className={`px-2 py-1.5 text-xs rounded-lg transition-all duration-200 flex items-center gap-1 ${startIndex === index
                                                                ? 'bg-green-600 text-white shadow-sm'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'
                                                            }`}
                                                        title={startIndex === index ? 'Remove as start' : 'Set as start'}
                                                        aria-label={startIndex === index ? 'Remove as start point' : 'Set as start point'}
                                                    >
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="hidden sm:inline">Start</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setEndLocation(index)}
                                                        className={`px-2 py-1.5 text-xs rounded-lg transition-all duration-200 flex items-center gap-1 ${endIndex === index
                                                                ? 'bg-red-600 text-white shadow-sm'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700'
                                                            }`}
                                                        title={endIndex === index ? 'Remove as end' : 'Set as end'}
                                                        aria-label={endIndex === index ? 'Remove as end point' : 'Set as end point'}
                                                    >
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="hidden sm:inline">End</span>
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => removeLocation(index)}
                                                    className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-all duration-200"
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

// Extracted ActionButtons component for reuse
function ActionButtons({ selectedLocations, submitItinerary, isSubmitting, clearAllLocations }) {
    return (
        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
            {selectedLocations.length > 0 && (
                <>
                    <button
                        onClick={submitItinerary}
                        disabled={isSubmitting}
                        className={`w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium shadow-sm hover:from-blue-700 hover:to-blue-800 transition-all duration-200 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : 'hover:shadow-md'
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
                        className="w-full mt-2 py-2 px-4 text-gray-500 hover:text-red-600 text-sm transition-colors hover:bg-red-50 rounded-lg"
                    >
                        Clear All Locations
                    </button>
                </>
            )}
        </div>
    );
}
