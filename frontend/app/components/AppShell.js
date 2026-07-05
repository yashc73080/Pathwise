'use client';

import { TripProvider, useTrip } from '../context/TripContext';
import { ThemeProvider } from '../context/ThemeContext';
import Map from './Map';
import Sidebar from './Sidebar';
import Search from './Search';
import RoutePanel from './RoutePanel';
import ChatWidget from './ChatWidget';
import MobileNav from './MobileNav';

import { AuthProvider } from '../context/authContext';
import LoginModal from './LoginModal';
import ProfileMenu from './ProfileMenu';

import SavedTripsModal from './SavedTripsModal';

// Mobile Optimize Button Component
function MobileOptimizeButton() {
  const { submitItinerary, isSubmitting, hasOptimizableDay, needsTripOptimization, activePanel } = useTrip();

  // Show when:
  // - At least one day has 2+ locations
  // - No panel is open
  // - At least one day needs a fresh optimization

  if (!hasOptimizableDay || !needsTripOptimization || activePanel !== 'none') return null;

  const handleOptimize = async () => {
    await submitItinerary();
  };

  return (
    <button
      onClick={handleOptimize}
      disabled={isSubmitting}
      className={`
        md:hidden fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30
        px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full
        shadow-lg font-medium flex items-center gap-2
        transition-all duration-200
        ${isSubmitting ? 'opacity-75 cursor-not-allowed' : 'hover:from-blue-700 hover:to-blue-800 hover:scale-105'}
      `}
    >
      {isSubmitting ? (
        <>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Optimizing...
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Optimize Route
        </>
      )}
    </button>
  );
}

// Shared application shell rendered by both / and /trip/. `children` mounts
// inside the provider tree so route-specific logic (e.g. the share-URL trip
// loader) can use trip/auth context.
export default function AppShell({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <TripProvider>
          <div className="flex h-[100dvh] w-screen overflow-hidden">
            {/* Main Content Container */}
            <div className="flex-1 flex relative">
              {/* Map Container */}
              <div className="flex-1 relative pb-16 md:pb-0">

                <Search />
                <Sidebar />
                <Map />
                <RoutePanel />
                <ChatWidget />
                <LoginModal />
                <ProfileMenu />
                <SavedTripsModal />

                {/* Mobile Optimize Button */}
                <MobileOptimizeButton />

                {/* Mobile Navigation */}
                <MobileNav />

                {children}
              </div>
            </div>
          </div>
        </TripProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
