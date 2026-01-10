"""
Weather module for Pathwise.
Provides location clustering and Google Weather API integration.
"""

import os
import requests
from math import radians, sin, cos, sqrt, atan2
from typing import List, Dict, Any

GOOGLE_MAPS_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
WEATHER_API_BASE = "https://weather.googleapis.com/v1/forecast/days:lookup"

# Default clustering threshold in miles
DEFAULT_CLUSTER_THRESHOLD_MILES = 50


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth (in miles).
    """
    R = 3959  # Earth's radius in miles
    
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c


def reverse_geocode_region(lat: float, lng: float) -> str:
    """
    Use Google's Geocoding API to get a broader region name for coordinates.
    Returns a city/county level name instead of a specific place name.
    
    Args:
        lat: Latitude
        lng: Longitude
        
    Returns:
        A human-readable region name (e.g., "Los Angeles, CA" or "Cook County, IL")
    """
    if not GOOGLE_MAPS_API_KEY:
        return None
    
    url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={GOOGLE_MAPS_API_KEY}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if data.get('status') != 'OK' or not data.get('results'):
            return None
        
        # Extract address components from the first result
        components = data['results'][0].get('address_components', [])
        
        locality = None  # City
        admin_area_2 = None  # County
        admin_area_1 = None  # State
        
        for component in components:
            types = component.get('types', [])
            if 'locality' in types:
                locality = component.get('long_name')
            elif 'administrative_area_level_2' in types:
                admin_area_2 = component.get('long_name')
            elif 'administrative_area_level_1' in types:
                admin_area_1 = component.get('short_name')  # Use short name for state (e.g., "CA")
        
        # Build the region name with preference: City + State > County + State > State
        if locality and admin_area_1:
            return f"{locality}, {admin_area_1}"
        elif admin_area_2 and admin_area_1:
            return f"{admin_area_2}, {admin_area_1}"
        elif admin_area_1:
            return admin_area_1
        
        return None
        
    except Exception as e:
        print(f"Reverse geocoding error: {e}")
        return None


def cluster_locations(locations: List[Dict[str, Any]], threshold_miles: float = DEFAULT_CLUSTER_THRESHOLD_MILES) -> List[Dict[str, Any]]:
    """
    Cluster locations by distance using a simple greedy algorithm.
    
    Args:
        locations: List of location dicts with 'name', 'lat', 'lng' keys
        threshold_miles: Maximum distance for locations to be in same cluster
        
    Returns:
        List of cluster dicts, each with:
        - 'centroid': { 'name', 'lat', 'lng' } (first location in cluster)
        - 'locations': list of all locations in cluster
        - 'regionName': human-readable name for the region
    """
    if not locations:
        return []
    
    clusters = []
    
    for location in locations:
        lat = location['lat']
        lng = location['lng']
        
        # Find if this location belongs to an existing cluster
        assigned = False
        for cluster in clusters:
            centroid = cluster['centroid']
            distance = haversine_distance(lat, lng, centroid['lat'], centroid['lng'])
            
            if distance <= threshold_miles:
                cluster['locations'].append(location)
                assigned = True
                break
        
        # If no cluster found, create a new one
        if not assigned:
            # Use reverse geocoding to get a broader region name
            region_name = reverse_geocode_region(lat, lng)
            if not region_name:
                # Fallback to location name if reverse geocoding fails
                region_name = location['name']
            
            clusters.append({
                'centroid': {
                    'name': location['name'],
                    'lat': lat,
                    'lng': lng
                },
                'locations': [location],
                'regionName': f"{region_name} Area"
            })
    
    return clusters


def get_daily_forecast(lat: float, lng: float, days: int = 7) -> List[Dict[str, Any]]:
    """
    Fetch daily weather forecast from Google Weather API.
    
    Args:
        lat: Latitude
        lng: Longitude
        days: Number of days to fetch (max 10)
        
    Returns:
        List of daily forecast objects with weather data
    """
    if not GOOGLE_MAPS_API_KEY:
        raise ValueError("GOOGLE_MAPS_API_KEY environment variable not set")
    
    url = f"{WEATHER_API_BASE}?key={GOOGLE_MAPS_API_KEY}&location.latitude={lat}&location.longitude={lng}&days={days}"
    
    response = requests.get(url)
    response.raise_for_status()
    
    data = response.json()
    forecast_days = data.get('forecastDays', [])
    
    # Transform to simplified format
    simplified_forecast = []
    for day in forecast_days:
        display_date = day.get('displayDate', {})
        daytime = day.get('daytimeForecast', {})
        weather_condition = daytime.get('weatherCondition', {})
        precipitation = daytime.get('precipitation', {}).get('probability', {})
        
        simplified_forecast.append({
            'date': f"{display_date.get('year', '')}-{display_date.get('month', ''):02d}-{display_date.get('day', ''):02d}",
            'dayOfWeek': None,  # Will be computed on frontend
            'maxTemp': day.get('maxTemperature', {}).get('degrees'),
            'minTemp': day.get('minTemperature', {}).get('degrees'),
            'tempUnit': day.get('maxTemperature', {}).get('unit', 'CELSIUS'),
            'condition': weather_condition.get('description', {}).get('text', 'Unknown'),
            'conditionType': weather_condition.get('type', 'UNKNOWN'),
            'iconUrl': weather_condition.get('iconBaseUri', ''),
            'precipitationPercent': precipitation.get('percent', 0),
            'precipitationType': precipitation.get('type', 'NONE')
        })
    
    return simplified_forecast


def get_weather_for_clusters(clusters: List[Dict[str, Any]], days: int = 7) -> List[Dict[str, Any]]:
    """
    Fetch weather data for each cluster's centroid.
    
    Args:
        clusters: List of cluster objects from cluster_locations()
        days: Number of days to fetch
        
    Returns:
        List of weather region objects with forecast data
    """
    weather_regions = []
    
    for cluster in clusters:
        centroid = cluster['centroid']
        
        try:
            forecast = get_daily_forecast(centroid['lat'], centroid['lng'], days)
            weather_regions.append({
                'regionName': cluster['regionName'],
                'centroid': centroid,
                'locationCount': len(cluster['locations']),
                'forecast': forecast
            })
        except Exception as e:
            print(f"Error fetching weather for {cluster['regionName']}: {e}")
            weather_regions.append({
                'regionName': cluster['regionName'],
                'centroid': centroid,
                'locationCount': len(cluster['locations']),
                'forecast': [],
                'error': str(e)
            })
    
    return weather_regions


def get_weather_for_locations(locations: List[Dict[str, Any]], threshold_miles: float = DEFAULT_CLUSTER_THRESHOLD_MILES, days: int = 7) -> Dict[str, Any]:
    """
    Main entry point: cluster locations and fetch weather for each region.
    
    Args:
        locations: List of location dicts with 'name', 'lat', 'lng'
        threshold_miles: Distance threshold for clustering
        days: Number of forecast days
        
    Returns:
        Dict with 'regions' containing weather data for each cluster
    """
    clusters = cluster_locations(locations, threshold_miles)
    regions = get_weather_for_clusters(clusters, days)
    
    return {
        'regions': regions,
        'clusterCount': len(clusters),
        'thresholdMiles': threshold_miles
    }
