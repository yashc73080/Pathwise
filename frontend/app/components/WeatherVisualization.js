'use client';

import { useTrip } from '../context/TripContext';

/**
 * WeatherVisualization component displays 7-day weather forecasts
 * for each region cluster in the optimized route.
 */
export default function WeatherVisualization() {
    const { weatherData, isLoadingWeather } = useTrip();

    // Convert Celsius to Fahrenheit
    const toFahrenheit = (celsius) => {
        if (celsius === null || celsius === undefined) return '--';
        return Math.round((celsius * 9 / 5) + 32);
    };

    // Get day of week from date string
    const getDayOfWeek = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()];
    };

    // Get weather icon based on condition type
    const getWeatherIcon = (conditionType, iconUrl) => {
        // Use Google's weather icons if available
        if (iconUrl) {
            return `${iconUrl}.svg`;
        }
        // Fallback emoji icons
        const iconMap = {
            'CLEAR': '☀️',
            'MOSTLY_CLEAR': '🌤️',
            'PARTLY_CLOUDY': '⛅',
            'MOSTLY_CLOUDY': '🌥️',
            'CLOUDY': '☁️',
            'RAIN': '🌧️',
            'SCATTERED_SHOWERS': '🌦️',
            'SHOWERS': '🌧️',
            'THUNDERSTORM': '⛈️',
            'SNOW': '❄️',
            'SLEET': '🌨️',
            'FOG': '🌫️',
            'WINDY': '💨',
        };
        return iconMap[conditionType] || '🌡️';
    };

    // Loading skeleton
    if (isLoadingWeather) {
        return (
            <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-blue-200 animate-pulse"></div>
                    <div className="h-4 w-32 bg-blue-200 rounded animate-pulse"></div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {[...Array(7)].map((_, i) => (
                        <div
                            key={i}
                            className="flex-shrink-0 w-16 bg-white rounded-lg p-2 shadow-sm animate-pulse"
                        >
                            <div className="h-3 w-8 bg-gray-200 rounded mb-2 mx-auto"></div>
                            <div className="w-8 h-8 bg-gray-200 rounded-full mx-auto mb-2"></div>
                            <div className="h-3 w-10 bg-gray-200 rounded mx-auto mb-1"></div>
                            <div className="h-2 w-8 bg-gray-200 rounded mx-auto"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Filter out regions with errors
    const validRegions = weatherData?.regions?.filter(region => !region.error) || [];

    // No valid weather data (all regions had errors or no regions)
    if (validRegions.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 space-y-4">
            {validRegions.map((region, regionIndex) => (
                <div
                    key={regionIndex}
                    className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm"
                >
                    {/* Region Header */}
                    <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                        <h4 className="font-medium text-gray-800 text-sm">
                            {region.regionName}
                        </h4>
                        {region.locationCount > 1 && (
                            <span className="text-xs text-gray-500">
                                ({region.locationCount} locations)
                            </span>
                        )}
                    </div>

                    {/* 7-day forecast */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-blue-200">
                        {region.forecast.map((day, dayIndex) => {
                            const iconUrl = day.iconUrl;
                            const isEmoji = !iconUrl;
                            const icon = getWeatherIcon(day.conditionType, iconUrl);

                            return (
                                <div
                                    key={dayIndex}
                                    className="flex-shrink-0 w-16 bg-white rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow text-center"
                                >
                                    {/* Day of week */}
                                    <p className="text-xs font-medium text-gray-600 mb-1">
                                        {dayIndex === 0 ? 'Today' : getDayOfWeek(day.date)}
                                    </p>

                                    {/* Weather icon */}
                                    <div className="w-10 h-10 mx-auto mb-1 flex items-center justify-center">
                                        {isEmoji ? (
                                            <span className="text-2xl">{icon}</span>
                                        ) : (
                                            <img
                                                src={icon}
                                                alt={day.condition}
                                                className="w-10 h-10"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'block';
                                                }}
                                            />
                                        )}
                                        <span className="text-2xl hidden">🌡️</span>
                                    </div>

                                    {/* Temperature */}
                                    <p className="text-sm font-semibold text-gray-800">
                                        {toFahrenheit(day.maxTemp)}°
                                        <span className="text-gray-400 font-normal"> / </span>
                                        <span className="text-gray-500 font-normal">{toFahrenheit(day.minTemp)}°</span>
                                    </p>

                                    {/* Precipitation */}
                                    {day.precipitationPercent > 0 && (
                                        <p className="text-xs text-blue-500 mt-0.5 flex items-center justify-center gap-0.5">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm3.75-2.75a.75.75 0 001.5 0V9.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0l-3.25 3.5a.75.75 0 101.1 1.02l1.95-2.1v4.59z" clipRule="evenodd" />
                                            </svg>
                                            {day.precipitationPercent}%
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
