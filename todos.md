## Phase 1: Refactoring & Stability
- [x] Refactor `frontend/app/page.js`: Extract Map, Sidebar, and Search into separate components
- [x] Implement Context API for state management (avoid prop drilling)
- [x] Make map markers clickable to trigger "Add to Itinerary"
- [x] Replace `alert()` with toast notifications for errors

## Phase 2: Core Features
- [x] Implement Drag-and-Drop reordering for itinerary list (@hello-pangea/dnd)
- [x] Add UI controls to designate specific "Start" and "End" locations
- [x] Update `backend/christofides.py` to handle fixed start/end points

## Phase 2.5: Firebase Integration
- [x] Integrate Firebase Auth (Sign up/Login)
- [x] Create Firebase 'itineraries' table to save/load user trips

## Phase 3: AI Agent Upgrade
- [x] specific: Switch backend AI provider to Google Vertex AI
- [x] Implement Function Calling (Tool Use) in backend to return structured JSON
- [x] Ensure AI tool calls return valid Google Maps Place IDs
- [ ] Update `ChatInterface.js` to render "Location Cards" from structured AI responses
- [ ] Add "Add to Map" button on AI Location Cards

## Phase 4: Mobile & Capacitor
- [ ] Responsive Design: Optimize Sidebar/Map layout for mobile screens
- [ ] Initialize Capacitor project (iOS/Android)
- [ ] Evaluate Map Strategy: Implement conditional rendering for `@capacitor/google-maps` (Native) vs Google Maps JS API (Web)