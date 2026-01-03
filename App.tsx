
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Hospital, ViewMode, TriageMessage, UserLocation, Booking } from './types';
import { INITIAL_HOSPITALS } from './constants';
import EmergencyMap from './components/EmergencyMap';
import AdminPanel from './components/AdminPanel';
import { GeminiService } from './services/geminiService';

const LUCKNOW_CENTER = { lat: 26.8467, lng: 80.9462 };

const App: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>(INITIAL_HOSPITALS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.PATIENT);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | undefined>();
  const [triageHistory, setTriageHistory] = useState<TriageMessage[]>([]);
  const [triageInput, setTriageInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeAdminId, setActiveAdminId] = useState<string>(INITIAL_HOSPITALS[0].id);
  const [filter, setFilter] = useState<'ALL' | 'ICU_ONLY' | 'GENERAL_ONLY'>('ALL');
  
  // Booking Form State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingFormData, setBookingFormData] = useState({ name: '', phone: '', type: 'Emergency' });
  const [lastBookingId, setLastBookingId] = useState<string | null>(null);

  // Location States
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const gemini = useMemo(() => new GeminiService(), []);

  // Distance calculator (Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return parseFloat((R * c).toFixed(1));
  };

  const requestLocation = () => {
    setIsLocating(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setIsLocating(false);
      setUserLocation(LUCKNOW_CENTER);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLocating(false);
      },
      (error) => {
        console.error("Location error:", error);
        setLocationError("Permission denied or location unavailable. Using Lucknow city center.");
        setIsLocating(false);
        setUserLocation(LUCKNOW_CENTER);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const updateBeds = useCallback((hospitalId: string, type: 'general' | 'icu', delta: number) => {
    setHospitals(prev => prev.map(h => {
      if (h.id !== hospitalId) return h;
      const key = type === 'general' ? 'generalBeds' : 'icuBeds';
      const newVal = Math.max(0, Math.min(h[key].total, h[key].available + delta));
      return {
        ...h,
        lastUpdated: new Date(),
        [key]: { ...h[key], available: newVal }
      };
    }));
  }, []);

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospitalId || !bookingFormData.name || !bookingFormData.phone) return;

    const hospital = hospitals.find(h => h.id === selectedHospitalId);
    if (!hospital || (hospital.generalBeds.available === 0 && hospital.icuBeds.available === 0)) {
       alert("No beds currently available at this facility.");
       return;
    }

    const newBooking: Booking = {
      id: Math.random().toString(36).substr(2, 9),
      hospitalId: selectedHospitalId,
      patientName: bookingFormData.name,
      contactNumber: bookingFormData.phone,
      emergencyType: bookingFormData.type,
      timestamp: new Date(),
      status: 'PENDING'
    };

    setBookings(prev => [...prev, newBooking]);
    // Automatically decrement a general bed for the booking
    updateBeds(selectedHospitalId, 'general', -1);
    
    setLastBookingId(newBooking.id);
    setIsBookingModalOpen(false);
    setBookingFormData({ name: '', phone: '', type: 'Emergency' });
  };

  const updateBookingStatus = (bookingId: string, status: Booking['status']) => {
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
  };

  const handleTriageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triageInput.trim()) return;

    const userMsg: TriageMessage = { role: 'user', content: triageInput, timestamp: new Date() };
    setTriageHistory(prev => [...prev, userMsg]);
    setTriageInput('');
    setIsAiLoading(true);

    const advice = await gemini.getTriageAdvice(triageInput, hospitals);
    const assistantMsg: TriageMessage = { role: 'assistant', content: advice, timestamp: new Date() };
    setTriageHistory(prev => [...prev, assistantMsg]);
    setIsAiLoading(false);
  };

  const filteredHospitals = useMemo(() => {
    let list = hospitals.map(h => ({
      ...h,
      distance: userLocation 
        ? calculateDistance(userLocation.lat, userLocation.lng, h.lat, h.lng)
        : h.distance
    }));

    if (filter === 'ICU_ONLY') list = list.filter(h => h.icuBeds.available > 0);
    if (filter === 'GENERAL_ONLY') list = list.filter(h => h.generalBeds.available > 0);
    
    return list.sort((a, b) => a.distance - b.distance);
  }, [hospitals, filter, userLocation]);

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  // Location Request Screen
  if (viewMode === ViewMode.PATIENT && !userLocation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center border border-slate-100">
          <div className="w-20 h-20 bg-rose-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-rose-200 mx-auto mb-8 ring-8 ring-rose-50">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight uppercase">Emergency Locator</h1>
          <p className="text-slate-500 font-medium mb-10 leading-relaxed">
            Please share your location to find the nearest emergency facility in your area.
          </p>

          <div className="space-y-4">
            <button 
              onClick={requestLocation}
              disabled={isLocating}
              className={`w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isLocating ? 'opacity-70' : 'hover:bg-slate-800'}`}
            >
              {isLocating ? (
                <>
                  <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Locating...
                </>
              ) : 'Use Current Location'}
            </button>
            
            <button 
              onClick={() => setUserLocation(LUCKNOW_CENTER)}
              className="w-full py-5 bg-white border-2 border-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-50 transition-all"
            >
              Skip (Default to Lucknow)
            </button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-2 grayscale opacity-20">
            <div className="w-5 h-5 bg-slate-800 rounded-md"></div>
            <span className="font-black text-slate-800 uppercase tracking-widest text-[10px]">LifeLine Secure</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfdfe]">
      {/* Booking Success Overlay */}
      {lastBookingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase">Bed Reserved</h3>
            <p className="text-slate-500 mt-2 text-sm font-medium">Your request has been sent. The hospital staff is preparing for your arrival.</p>
            <button 
              onClick={() => setLastBookingId(null)}
              className="mt-8 w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase tracking-widest text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Booking Form Modal */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-6">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reserve a Bed</h3>
              <button onClick={() => setIsBookingModalOpen(false)} className="text-slate-400 hover:text-slate-900">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Informing: {hospitals.find(h => h.id === selectedHospitalId)?.name}</p>
            
            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Patient Name</label>
                <input 
                  required
                  type="text" 
                  value={bookingFormData.name}
                  onChange={e => setBookingFormData({...bookingFormData, name: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Emergency Contact</label>
                <input 
                  required
                  type="tel" 
                  value={bookingFormData.phone}
                  onChange={e => setBookingFormData({...bookingFormData, phone: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Primary Symptom</label>
                <select 
                  value={bookingFormData.type}
                  onChange={e => setBookingFormData({...bookingFormData, type: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option>Respiratory Distress</option>
                  <option>High Fever</option>
                  <option>Accident / Trauma</option>
                  <option>Cardiac Concern</option>
                  <option>Other Emergency</option>
                </select>
              </div>
              <button 
                type="submit"
                className="w-full mt-4 py-5 bg-rose-600 text-white font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95"
              >
                Confirm Reservation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Precision Header */}
      <header className={`py-4 px-6 sticky top-0 z-50 transition-all border-b ${viewMode === ViewMode.PATIENT ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 text-white'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg ring-4 ring-rose-50">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">LifeLine</h1>
              <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${viewMode === ViewMode.PATIENT ? 'text-slate-400' : 'text-slate-500'}`}>Emergency Response MVP</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button 
              onClick={() => setViewMode(ViewMode.PATIENT)}
              className={`px-5 py-2 rounded-lg text-xs font-black uppercase transition-all ${viewMode === ViewMode.PATIENT ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Public Map
            </button>
            <button 
              onClick={() => setViewMode(ViewMode.ADMIN)}
              className={`px-5 py-2 rounded-lg text-xs font-black uppercase transition-all ${viewMode === ViewMode.ADMIN ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Admin Portal
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full p-6">
        {viewMode === ViewMode.PATIENT ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left: Map & Triage */}
            <div className="lg:col-span-8 space-y-6">
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Interactive Coverage Area</h3>
                   <div className="flex gap-2">
                     {['ALL', 'GENERAL_ONLY', 'ICU_ONLY'].map((f) => (
                       <button 
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${filter === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                       >
                         {f.replace('_ONLY', '').replace('ALL', 'Show All')}
                       </button>
                     ))}
                   </div>
                </div>
                <EmergencyMap 
                  hospitals={hospitals} 
                  selectedHospitalId={selectedHospitalId}
                  onSelectHospital={setSelectedHospitalId}
                  userLocation={userLocation}
                />
              </section>

              {/* Triage Assistant Card */}
              <section className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-900/40">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Rapid Triage Assistant</h3>
                      <p className="text-rose-400 text-xs font-bold uppercase tracking-widest">Medical Routing AI v1.0</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {triageHistory.length === 0 ? (
                      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 text-center">
                        <p className="text-slate-400 text-sm font-medium">Describe the symptoms or emergency. I'll check bed availability and route you to the best facility.</p>
                      </div>
                    ) : (
                      triageHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] px-5 py-4 rounded-2xl text-sm font-medium leading-relaxed ${msg.role === 'user' ? 'bg-rose-600 shadow-lg' : 'bg-slate-800 border border-slate-700'}`}>
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}
                    {isAiLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex gap-2">
                           <div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce"></div>
                           <div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                           <div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleTriageSubmit} className="relative group">
                    <input 
                      type="text" 
                      value={triageInput}
                      onChange={(e) => setTriageInput(e.target.value)}
                      placeholder="e.g., I have a child with high fever and trouble breathing..."
                      className="w-full pl-6 pr-14 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all shadow-inner"
                    />
                    <button type="submit" className="absolute right-3 top-3 p-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all active:scale-95">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </form>
                </div>
              </section>
            </div>

            {/* Right Sidebar: Ranked Availability */}
            <div className="lg:col-span-4 space-y-6">
              <div className="flex justify-between items-center px-2">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Nearby Results</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{filteredHospitals.length} Found</span>
              </div>
              
              <div className="space-y-4 max-h-[1000px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredHospitals.map(h => (
                  <div 
                    key={h.id}
                    onClick={() => setSelectedHospitalId(h.id)}
                    className={`p-6 rounded-3xl border-2 transition-all group cursor-pointer ${selectedHospitalId === h.id ? 'bg-white border-rose-600 shadow-xl' : 'bg-white border-transparent shadow-sm hover:border-slate-200 hover:shadow-md'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-grow">
                        <h4 className="font-black text-slate-900 group-hover:text-rose-600 transition-colors text-lg leading-tight">{h.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{h.distance} KM AWAY</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">Updated {getTimeAgo(h.lastUpdated)}</span>
                        </div>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full ring-4 ${h.generalBeds.available + h.icuBeds.available > 0 ? 'bg-emerald-500 ring-emerald-50' : 'bg-rose-500 ring-rose-50'}`}></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ward</span>
                        <span className={`text-2xl font-black ${h.generalBeds.available > 0 ? 'text-slate-900' : 'text-rose-500'}`}>{h.generalBeds.available}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ICU</span>
                        <span className={`text-2xl font-black ${h.icuBeds.available > 0 ? 'text-slate-900' : 'text-rose-500'}`}>{h.icuBeds.available}</span>
                      </div>
                    </div>

                    {selectedHospitalId === h.id && (
                      <div className="mt-6 space-y-3 pt-6 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsBookingModalOpen(true); }}
                          className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg active:scale-95"
                        >
                          Book Bed Now
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                          <button 
                             onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`); }}
                             className="flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all"
                          >
                            Route
                          </button>
                          <a href={`tel:${h.contact}`} className="flex items-center justify-center gap-2 py-3 bg-white border-2 border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 transition-all">
                            Info
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ADMIN VIEW */
          <div className="max-w-4xl mx-auto py-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Facility Management</h2>
              <p className="text-slate-500 font-medium mt-2">Authenticated Hospital Staff Access Only</p>
            </div>
            
            <div className="mb-12 max-w-md mx-auto">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 px-1">Select Active Facility</label>
              <div className="relative">
                <select 
                  value={activeAdminId}
                  onChange={(e) => setActiveAdminId(e.target.value)}
                  className="w-full p-5 bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-800 shadow-sm focus:border-slate-900 focus:ring-0 outline-none appearance-none transition-all cursor-pointer"
                >
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {hospitals.filter(h => h.id === activeAdminId).map(h => (
              <AdminPanel 
                key={h.id}
                hospital={h}
                bookings={bookings}
                onUpdate={updateBeds}
                onUpdateBookingStatus={updateBookingStatus}
              />
            ))}
          </div>
        )}
      </main>

      {/* Persistent Call to Action */}
      {viewMode === ViewMode.PATIENT && (
        <a 
          href="tel:112"
          className="fixed bottom-8 right-8 lg:bottom-12 lg:right-12 bg-rose-600 text-white px-8 py-5 rounded-3xl shadow-2xl flex items-center gap-4 font-black hover:bg-rose-700 hover:-translate-y-1 transition-all z-50 ring-8 ring-rose-50 group"
        >
          <div className="bg-white/20 p-2 rounded-xl">
             <svg className="w-8 h-8 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
               <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
             </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-xs opacity-80 leading-none mb-1">EMERGENCY SOS</span>
            <span className="text-xl tracking-tight leading-none">CALL 112 NOW</span>
          </div>
        </a>
      )}

      <footer className="bg-white border-t border-slate-100 py-12 px-6 text-center">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
           <div className="flex items-center gap-2 grayscale opacity-30">
              <div className="w-6 h-6 bg-slate-800 rounded-md"></div>
              <span className="font-black text-slate-800 uppercase tracking-widest text-xs">LifeLine Systems</span>
           </div>
           <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] max-w-md leading-loose">
             &copy; 2024 LifeLine MVP Framework. This application is a prototype for demonstration purposes and is not a substitute for professional medical care.
           </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
