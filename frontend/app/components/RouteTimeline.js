'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function formatTimeRange(stop) {
    if (stop.arrivalTime && stop.departureTime) return `${stop.arrivalTime} – ${stop.departureTime}`;
    if (stop.arrivalTime) return `arrive ${stop.arrivalTime}`;
    if (stop.departureTime) return `leave ${stop.departureTime}`;
    return null;
}

// Timeline for one day's optimized route: drag to reorder, expand a stop to
// edit its arrival/departure times and notes. Shared by the desktop sidebar
// route tab and the mobile route panel.
export default function RouteTimeline({ stops, dayColor, onReorder, onUpdateStop, droppableId }) {
    const [expandedStopId, setExpandedStopId] = useState(null);

    const handleDragEnd = (result) => {
        if (!result.destination || result.destination.index === result.source.index) return;
        onReorder(result.source.index, result.destination.index);
    };

    const renderRow = (provided, snapshot, stop, index) => {
        const isExpanded = expandedStopId === stop.id;
        const timeRange = formatTimeRange(stop);

        return (
            <div
                ref={provided.innerRef}
                {...provided.draggableProps}
                style={{ ...provided.draggableProps.style }}
                className={`bg-gray-50 dark:bg-gray-800 rounded-lg transition-all duration-200 ${snapshot.isDragging ? 'shadow-lg scale-[1.02] bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
                <div className="flex items-center gap-3 p-2">
                    <div
                        {...provided.dragHandleProps}
                        className="p-1 cursor-grab active:cursor-grabbing touch-none"
                        style={{ touchAction: 'none' }}
                    >
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                    </div>
                    <span
                        className="w-7 h-7 text-white rounded-full flex items-center justify-center text-sm font-medium shadow-sm shrink-0"
                        style={{ backgroundColor: dayColor.bg, border: `2px solid ${dayColor.border}` }}
                    >
                        {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-gray-700 dark:text-gray-200 text-sm truncate">{stop.name}</p>
                        {(timeRange || stop.notes) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {[timeRange, stop.notes].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => setExpandedStopId(isExpanded ? null : stop.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-all shrink-0"
                        title={isExpanded ? 'Hide details' : 'Edit times & notes'}
                        aria-label={isExpanded ? 'Hide stop details' : 'Edit stop times and notes'}
                    >
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {isExpanded && (
                    <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex gap-2">
                            <label className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                                Arrive
                                <input
                                    type="time"
                                    value={stop.arrivalTime || ''}
                                    onChange={(e) => onUpdateStop(stop.id, { arrivalTime: e.target.value || null })}
                                    className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </label>
                            <label className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                                Depart
                                <input
                                    type="time"
                                    value={stop.departureTime || ''}
                                    onChange={(e) => onUpdateStop(stop.id, { departureTime: e.target.value || null })}
                                    className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </label>
                        </div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400">
                            Notes
                            <textarea
                                value={stop.notes || ''}
                                onChange={(e) => onUpdateStop(stop.id, { notes: e.target.value || null })}
                                placeholder="Tickets, reservations, reminders..."
                                rows={2}
                                className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </label>
                    </div>
                )}
            </div>
        );
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable
                droppableId={droppableId}
                renderClone={(provided, snapshot, rubric) =>
                    renderRow(provided, snapshot, stops[rubric.source.index], rubric.source.index)
                }
            >
                {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {stops.map((stop, index) => (
                            <Draggable key={stop.id} draggableId={stop.id} index={index}>
                                {(provided, snapshot) => renderRow(provided, snapshot, stop, index)}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
}
