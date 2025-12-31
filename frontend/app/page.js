'use client';

import { TripProvider } from './context/TripContext';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import Search from './components/Search';
import RoutePanel from './components/RoutePanel';
import ChatWidget from './components/ChatWidget';


export default function Page() {
  return (
    <TripProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        {/* Main Content Container */}
        <div className="flex-1 flex relative">
          {/* Map Container */}
          <div className="flex-1 relative">

            <Search />

            <Sidebar />

            <Map />

            <RoutePanel />

            <ChatWidget />


          </div>
        </div>
      </div>
    </TripProvider>
  );
}