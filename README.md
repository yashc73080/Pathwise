# 🗺️ Pathwise

**An AI-powered travel itinerary planner with route optimization**

Pathwise helps you plan multi-destination trips with ease. Add locations to your itinerary, optimize the route using the Christofides algorithm, and get AI-powered recommendations—all in one seamless experience.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-orange?logo=firebase)
![Google Cloud](https://img.shields.io/badge/Google%20Cloud-Vertex%20AI-blue?logo=google-cloud)

---

## ✨ Features

- **🔍 Location Search** - Search for places using Google Maps integration
- **📋 Drag-and-Drop Itinerary** - Easily reorder your destinations
- **🚀 Route Optimization** - Uses the Christofides algorithm to find the optimal path
- **📍 Start/End Points** - Designate specific start and end locations for your trip
- **🤖 AI Travel Assistant** - Chat with Pathwise AI agent powered by Google Vertex AI (Gemini)
- **📍 AI Location Cards** - Get structured place recommendations you can add directly to your map
- **💾 Save & Load Trips** - Store your itineraries with Firebase for later access
- **🏷️ AI-Generated Trip Names** - Trips automatically get creative names like "Manhattan Art Walk"
- **📤 Export to Google Maps** - Open your optimized route directly in Google Maps

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** with React 18
- **Tailwind CSS** for styling
- **Firebase SDK** for authentication and data storage
- **@hello-pangea/dnd** for drag-and-drop functionality
- **react-hot-toast** for notifications

### Backend
- **Python 3.11** with Flask
- **Google Cloud Vertex AI** (Gemini 2.5 Flash Lite) for AI features
- **Google Maps API** for geocoding and place search
- **NetworkX** for graph algorithms (Christofides TSP)
- **Firebase Admin SDK** for server-side auth and Firestore

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Google Cloud account with APIs enabled:
  - Maps JavaScript API
  - Places API
  - Geocoding API
  - Vertex AI API
- Firebase project with Authentication and Firestore enabled

### Clone the Repository

```bash
git clone https://github.com/yashc73080/Pathwise.git
cd Pathwise
```

### Backend Setup

```bash
cd backend

# Create and activate conda environment
conda create --name trip python=3.11
conda activate trip

# Install dependencies
pip install -r requirements.txt

# Create .env.local with your credentials
# NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
# GOOGLE_CLOUD_PROJECT=your_project_id
# GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local with your credentials
# NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
# NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
# NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_key
# (and other Firebase config vars)
```

### Run the Application

**Start the backend** (in `backend/` directory):
```bash
python app.py
```

**Start the frontend** (in `frontend/` directory):
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the app.

---

## 📁 Project Structure

```
Pathwise/
├── frontend/               # Next.js frontend
│   ├── app/
│   │   ├── components/     # React components (Map, Sidebar, ChatWidget, etc.)
│   │   ├── context/        # React Context (TripContext, AuthContext)
│   │   ├── firebase/       # Firebase config and Firestore helpers
│   │   └── page.js         # Main page
│   └── package.json
│
├── backend/                # Flask backend
│   ├── app.py              # Main Flask application
│   ├── agent.py            # Vertex AI agent with tool calling
│   ├── trip_naming.py      # AI trip name generation
│   ├── christofides.py     # TSP route optimization algorithm
│   ├── session_service.py  # Chat session persistence
│   └── requirements.txt
│
└── README.md
```

---

## 🗺️ How It Works

1. **Search & Add Locations** - Use the search bar to find places and add them to your itinerary
2. **Organize Your Trip** - Drag and drop to reorder, set start/end points if needed
3. **Optimize Route** - Click "Optimize" to calculate the most efficient path using the Christofides algorithm
4. **Chat with AI** - Ask Pathwise AI for recommendations; add suggested places directly to your map
5. **Save Your Trip** - Log in to save trips with auto-generated AI names
6. **Export** - Open your route in Google Maps for navigation

