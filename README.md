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

#### 1. Desktop Development (Standard)

**Start the backend** (in `backend/` directory):
```bash
conda activate trip
python app.py
```

**Start the frontend** (in `frontend/` directory):
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the app.

---

#### 2. Mobile Browser Testing (No App Install Required)

Test on your phone by accessing the dev server over your local network:

**Start the backend:**
```bash
cd backend
conda activate trip
python app.py  # Runs on 0.0.0.0:5000
```

**Start the frontend with network access:**
```bash
cd frontend
npm run dev -- -H 0.0.0.0
```

**On your phone:**
1. Connect to the same WiFi as your computer
2. Find your computer's IP address:
   - Windows: `ipconfig` → look for IPv4 Address
   - Mac/Linux: `ifconfig` or `ip addr`
3. Visit `http://YOUR_COMPUTER_IP:3000` in your phone's browser

**⚠️ Note:** Make sure `frontend/.env.local` has:
```
NEXT_PUBLIC_BACKEND_URL=http://YOUR_COMPUTER_IP:5000
```

---

#### 3. Capacitor Native App (Production Build)

Build and run as a native Android/iOS app:

```bash
cd frontend

# Build the web app
npm run build

# Sync to native projects
npx cap sync

# Open in IDE
npx cap open android  # Opens Android Studio
npx cap open ios      # Opens Xcode (Mac only)
```

Then click **Run** in Android Studio/Xcode.

**For Android Emulator:** Update `.env.local` to use `10.0.2.2` instead of `localhost`:
```
NEXT_PUBLIC_BACKEND_URL=http://10.0.2.2:5000
```

---

#### 4. Capacitor Live Reload (Fast Development)

Edit and see changes instantly on your phone without rebuilding:

**1. Start the dev server:**
```bash
cd frontend
npm run dev -- -H 0.0.0.0
```

**2. Sync and run:**
```bash
npx cap sync
npx cap open android  # Then click Run in Android Studio
```

Now any code changes will hot-reload on your device!

**⚠️ Remember:** Remove the `server` block from `capacitor.config.ts` for production builds.

#### 5. Deployment

Deploy both frontend and backend to Firebase and Google Cloud Run respectively.

**Frontend:**
```bash
npm run build
firebase deploy
```

**Backend:**
```bash
gcloud run deploy pathwise-backend --source .
```
Select `[35] us-central1` as the region.

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
│   ├── ios/                # Capacitor iOS project
│   ├── android/            # Capacitor Android project
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

