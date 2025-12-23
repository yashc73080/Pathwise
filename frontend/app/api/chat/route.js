// NOT BEING USED ANYMORE

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import axios from 'axios';

const systemPrompt = `
You are TripWhiz AI, an AI travel assistant with advanced action-taking capabilities. Your primary goal is to help users plan and execute their travel itineraries seamlessly.

Action-Taking Guidelines:
1. When a user requests route planning or location-based actions, break down the task into specific steps
2. Identify locations mentioned in the request
3. Use available backend functions to:
   - Geocode locations
   - Optimize travel routes
   - Add locations to the user's map
   - Generate a comprehensive travel itinerary

Action Detection:
- Look for keywords like "route", "plan", "travel", "visit", "go to"
- Recognize lists of locations or travel destinations
- Understand user intent for trip planning

Example Actions:
User: "I want to go to empire state, willis tower, and golden gate bridge. Plan the best route for me."
Action Steps:
1. Geocode locations
2. Calculate optimal route
3. Add locations to map
4. Generate route summary with distances and estimated travel time

Always provide a clear, actionable response that helps the user understand the next steps in their travel planning.
`;

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function geocodeLocations(locations) {
  try {
    // Dynamically determine backend URL
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
      (typeof window !== 'undefined' ? 
        `${window.location.protocol}//${window.location.host}` : 
        'http://localhost:5000');
    
    const response = await axios.post(`${backendUrl}/geocode`, { locations });
    return response.data.geocoded_locations;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

async function optimizeRoute(locations) {
  try {
    // Dynamically determine backend URL
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
      (typeof window !== 'undefined' ? 
        `${window.location.protocol}//${window.location.host}` : 
        'http://localhost:5000');
    
    const response = await axios.post(`${backendUrl}/optimize_route`, { locations });
    return response.data;
  } catch (error) {
    console.error('Route optimization error:', error);
    return null;
  }
}

export async function POST(req) {
  const data = await req.json();
  const lastMessage = data[data.length - 1];

  // Check if the message requires action-taking
  const actionCompletion = await openai.chat.completions.create({
    model: "meta-llama/llama-3.1-8b-instruct:free",
    messages: [
      { role: 'system', content: systemPrompt },
      ...data,
      { 
        role: 'user', 
        content: 'Analyze the previous message and determine if it requires location-based actions. If so, extract the list of locations and confirm the action steps.' 
      }
    ],
    max_tokens: 300
  });

  const actionAnalysis = actionCompletion.choices[0].message.content;
  
  // If action is detected, process the locations
  if (actionAnalysis.toLowerCase().includes('action required')) {
    const locations = actionAnalysis.match(/Locations:\s*(.+)/)?.[1].split(',').map(loc => loc.trim());
    
    if (locations && locations.length > 0) {
      const geocodedLocations = await geocodeLocations(locations);
      const optimizedRoute = await optimizeRoute(geocodedLocations);

      // Prepare detailed response with route details
      const routeResponse = `I've planned your route for the following locations:
${optimizedRoute.route.map((loc, index) => `${index + 1}. ${loc.name}`).join('\n')}

Total Distance: ${optimizedRoute.total_distance} miles
Estimated Travel Time: ${optimizedRoute.total_time}

Would you like me to add these locations to your map and generate a detailed itinerary?`;

      return NextResponse.json({ 
        type: 'route_plan',
        message: routeResponse,
        locations: optimizedRoute.route.map(loc => ({
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng
        })),
        itinerary: {
          totalDistance: optimizedRoute.total_distance,
          totalTime: optimizedRoute.total_time,
          stops: optimizedRoute.route.map((loc, index) => ({
            order: index + 1,
            name: loc.name,
            coordinates: {
              lat: loc.lat,
              lng: loc.lng
            }
          }))
        }
      });
    }
  }

  // Default chat completion if no action is required
  const chatCompletion = await openai.chat.completions.create({
    model: "meta-llama/llama-3.1-8b-instruct:free",
    messages: [{ role: 'system', content: systemPrompt }, ...data],
    stream: true,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of chatCompletion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream);
}