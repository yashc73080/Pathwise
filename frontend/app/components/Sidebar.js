'use client';

import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
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
        setEndLocation
    } = useTrip();

    const { userLoggedIn, openLoginModal } = useAuth();

    const handleDragEnd = (result) => {
        if (!result.destination) {
            return;
        }

        if (result.destination.index === result.source.index) {
            return;
        }

        reorderLocations(result.source.index, result.destination.index);
    };

    return (
        <>
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

            {/* Collapsible Left Panel */}
            <div
                className={`absolute top-20 left-4 w-88 bg-white rounded-lg shadow-xl flex flex-col z-10 transition-all duration-300 ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
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
                    {selectedLocations.length === 0 ? (
                        <div className="p-4">
                            <p className="text-gray-500 text-center py-8">Search and add locations to create your itinerary</p>
                        </div>
                    ) : (
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="locations">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="p-4 space-y-4"
                                    >
                                        {selectedLocations.map((location, index) => (
                                            <Draggable key={index} draggableId={`location-${index}`} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`bg-gray-50 rounded-lg p-3 border border-gray-100 shadow-sm ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                                        </svg>
                                                                    </div>
                                                                    {startIndex === index && (
                                                                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                                                            START
                                                                        </span>
                                                                    )}
                                                                    {endIndex === index && (
                                                                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                                                                            END
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="font-medium text-gray-900">{location.name}</p>
                                                                <p className="text-sm text-gray-500">{location.address}</p>
                                                            </div>
                                                            <div className="flex flex-col gap-2 items-end">
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => setStartLocation(index)}
                                                                        className={`px-2 py-1 text-xs rounded transition-colors ${startIndex === index
                                                                            ? 'bg-green-600 text-white'
                                                                            : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                                                                            }`}
                                                                        title={startIndex === index ? 'Remove as start' : 'Set as start'}
                                                                    >
                                                                        S
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEndLocation(index)}
                                                                        className={`px-2 py-1 text-xs rounded transition-colors ${endIndex === index
                                                                            ? 'bg-red-600 text-white'
                                                                            : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                                                                            }`}
                                                                        title={endIndex === index ? 'Remove as end' : 'Set as end'}
                                                                    >
                                                                        E
                                                                    </button>
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
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    )}
                </div>

                {/* Bottom Actions */}
                <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                    {selectedLocations.length > 0 && (
                        <>
                            <button
                                onClick={submitItinerary}
                                disabled={isSubmitting}
                                className={`w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
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

                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => {
                                        if (userLoggedIn) {
                                            // TODO: Implement actual save logic with logic to firestore
                                            toast.success('Trip saved successfully!');
                                        } else {
                                            openLoginModal();
                                        }
                                    }}
                                    className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium shadow-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                    </svg>
                                    Save Trip
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div >
        </>
    );
}
