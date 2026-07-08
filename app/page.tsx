'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define types
interface FlightData {
  FlightNo: string;
  Destination: string;
  DestinationName: string;
  Status: string;
  DepartureTime: string;
  Gate: string;
}

interface FlightWithHighlight extends FlightData {
  isHighlighted?: boolean;
  highlightType?: 'new' | 'changed' | 'removed';
}

export default function Home() {
  const [departure, setDeparture] = useState<string>('MNL');
  const [flights, setFlights] = useState<FlightWithHighlight[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevDepartureRef = useRef<string>('MNL');
  const isFirstLoadRef = useRef<boolean>(true);

  // Complete Airport names mapping
  const airportNames: { [key: string]: string } = {
    'MNL': 'Manila',
    'CEB': 'Cebu',
    'DVO': 'Davao',
    'ILO': 'Iloilo',
    'PPS': 'Puerto Princesa',
    'KLO': 'Kalibo',
    'TAG': 'Tagbilaran',
    'BKK': 'Bangkok',
    'HKG': 'Hong Kong',
    'SIN': 'Singapore',
    'NRT': 'Tokyo',
    'ICN': 'Seoul',
    'TPE': 'Taipei',
    'DPS': 'Bali',
    'KUL': 'Kuala Lumpur',
    'CGY': 'Cagayan de Oro',
    'CRK': 'Clark',
    'BCD': 'Bacolod',
    'DGT': 'Dumaguete',
    'IAO': 'Siargao',
    'MPH': 'Boracay (Caticlan)',
    'PAG': 'Pagadian',
    'OZC': 'Ozamiz',
    'TAC': 'Tacloban',
    'USU': 'Busuanga',
    'ZAM': 'Zamboanga',
    'BXU': 'Butuan',
    'DRP': 'Dipolog',
    'SJI': 'San Jose',
    'TUG': 'Tuguegarao',
    'WNP': 'Naga',
    'VRC': 'Virac',
    'BKI': 'Kota Kinabalu',
    'BSO': 'Basco',
    'BWN': 'Bandar Seri Begawan',
    'CAN': 'Guangzhou',
    'CBO': 'Cotabato',
    'CGK': 'Jakarta',
    'CGM': 'Camiguin',
    'CKG': 'Chongqing',
    'CSX': 'Changsha',
    'CTU': 'Chengdu',
    'CYP': 'Calbayog',
    'CYZ': 'Cauayan',
    'DPL': 'Dipolog',
    'DXB': 'Dubai',
    'FUK': 'Fukuoka',
    'GES': 'General Santos',
    'GUM': 'Guam',
    'HAN': 'Hanoi',
    'HGH': 'Hangzhou',
    'KIX': 'Osaka',
    'MBT': 'Masbate',
    'MEL': 'Melbourne',
    'MFM': 'Macau',
    'MRQ': 'Marinduque',
    'NGO': 'Nagoya',
    'PEK': 'Beijing',
    'PVG': 'Shanghai',
    'REP': 'Siem Reap',
    'RXS': 'Roxas',
    'SGN': 'Ho Chi Minh',
    'SUG': 'Surigao',
    'SYD': 'Sydney',
    'TBH': 'Tablas',
    'TWT': 'Tawitawi',
    'XMN': 'Xiamen',
    'LAO': 'Laoag',
    'CNX': 'Chiang Mai',
    'DAD': 'Da Nang',
    'DMK': 'Bangkok (Don Mueang)',
    'ENI': 'El Nido',
  };

  const fetchFlights = async () => {
    if (!isPageVisible) return;
    
    setIsRefreshing(true);
    setError(null);
    
    try {
      const url = `/api?departure=${departure}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      let newFlightsData: FlightData[] = [];
      
      if (Array.isArray(data)) {
        newFlightsData = data;
      } else if (data && data.flights && Array.isArray(data.flights)) {
        newFlightsData = data.flights;
      } else if (data && data.data && Array.isArray(data.data)) {
        newFlightsData = data.data;
      } else {
        const possibleArrays = Object.values(data).filter(val => Array.isArray(val));
        if (possibleArrays.length > 0) {
          newFlightsData = possibleArrays[0];
        } else {
          newFlightsData = [];
        }
      }
      
      // Filter flights to only show the selected departure airport's flights
      // The API should already filter by departure, but this ensures it
      const filteredFlights = newFlightsData.filter(flight => 
        flight.Destination !== departure // This filters out flights that have the same code as departure
        // Actually, we want to keep all flights that are departing from the selected airport
        // The API handles this, so we keep all flights returned
      );
      
      // Check if the airport changed or if it's the first load
      const airportChanged = prevDepartureRef.current !== departure;
      const isFirstLoad = isFirstLoadRef.current;
      
      // Update the refs
      prevDepartureRef.current = departure;
      if (isFirstLoad) {
        isFirstLoadRef.current = false;
      }
      
      if (airportChanged || isFirstLoad) {
        // Clear existing flights completely and set new ones
        const updatedFlights = newFlightsData.map(flight => ({
          ...flight,
          isHighlighted: true,
          highlightType: 'new' as const,
        }));
        setFlights(updatedFlights);
        
        // Clear highlights after 3 seconds
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
          setFlights(prev => prev.map(flight => ({
            ...flight,
            isHighlighted: false,
            highlightType: undefined,
          })));
        }, 3000);
      } else {
        // Same airport - do normal highlight update
        updateFlightsWithHighlights(newFlightsData);
      }
      
    } catch (err) {
      console.error('Error fetching flights:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch flight data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateFlightsWithHighlights = (newFlightsData: FlightData[]) => {
    // Create a map of existing flights for quick lookup
    const existingFlightMap = new Map<string, FlightWithHighlight>();
    flights.forEach(f => {
      const key = `${f.FlightNo}-${f.Destination}`;
      existingFlightMap.set(key, f);
    });
    
    // Create a map of new flights
    const newFlightMap = new Map<string, FlightData>();
    newFlightsData.forEach(f => {
      const key = `${f.FlightNo}-${f.Destination}`;
      newFlightMap.set(key, f);
    });
    
    const updatedFlights: FlightWithHighlight[] = [];
    
    // Process new flights
    newFlightsData.forEach(newFlight => {
      const key = `${newFlight.FlightNo}-${newFlight.Destination}`;
      const existingFlight = existingFlightMap.get(key);
      
      let highlightType: 'new' | 'changed' | undefined = undefined;
      
      if (!existingFlight) {
        highlightType = 'new';
      } else if (
        existingFlight.Status !== newFlight.Status ||
        existingFlight.DepartureTime !== newFlight.DepartureTime ||
        existingFlight.Gate !== newFlight.Gate
      ) {
        highlightType = 'changed';
      }
      
      updatedFlights.push({
        ...newFlight,
        isHighlighted: !!highlightType,
        highlightType: highlightType,
      });
    });
    
    // Check for removed flights - but only if they belong to the same departure airport
    // Since we don't track departure in the flight data, we just keep all existing flights
    // that might have been removed
    
    setFlights(updatedFlights);
    
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    highlightTimeoutRef.current = setTimeout(() => {
      setFlights(prev => prev.map(flight => ({
        ...flight,
        isHighlighted: false,
        highlightType: undefined,
      })));
    }, 3000);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    fetchFlights();
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      fetchFlights();
    }, 60000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, [departure, isPageVisible]);

  const airports: string[] = [
    "MNL", "BCD", "BKI", "BKK", "BSO", "BWN", "BXU", "CAN", "CBO", "CEB",
    "CGK", "CGM", "CGY", "CKG", "CRK", "CSX", "CTU", "CYP", "CYZ", "DGT",
    "DPL", "DPS", "DRP", "DVO", "DXB", "FUK", "GES", "GUM", "HAN", "HGH",
    "HKG", "IAO", "ICN", "ILO", "KIX", "KLO", "KUL", "MBT", "MEL", "MFM",
    "MPH", "MRQ", "NGO", "NRT", "OZC", "PAG", "PEK", "PPS", "PVG",
    "REP", "RXS", "SGN", "SIN", "SJI", "SUG", "SYD", "TAC", "TAG", "TBH",
    "TPE", "TUG", "TWT", "USU", "VRC", "WNP", "XMN", "ZAM", "LAO", "CNX",
    "DAD", "DMK", "ENI"
  ];

  const formatStatus = (status: string) => {
    if (!status) return 'Scheduled';
    if (status === 'Gate') return 'Proceed to Gate';
    if (status === 'Boarding') return 'Now Boarding';
    return status;
  };

  const getStatusColor = (status: string) => {
    const formattedStatus = formatStatus(status);
    if (formattedStatus === 'On Time') return 'text-green-600 dark:text-green-400';
    if (formattedStatus?.includes('Gate Closed')) return 'text-red-600 dark:text-red-400';
    if (formattedStatus?.includes('Proceed to Gate')) return 'text-yellow-600 dark:text-yellow-400 font-bold';
    if (formattedStatus?.includes('Now Boarding')) return 'text-blue-600 dark:text-blue-400 font-bold animate-fast-pulse';
    return 'text-blue-600 dark:text-blue-400';
  };

  const formatGate = (gate: string) => {
    if (!gate) return 'Gate: TBA';
    if (gate === 'To be Announced' || gate === 'TBA') return 'Gate: TBA';
    return `Gate: ${gate}`;
  };

  const getStatusAbbreviation = (status: string) => {
    const formattedStatus = formatStatus(status);
    if (formattedStatus === 'On Time') return 'On Time';
    if (formattedStatus?.includes('Gate Closed')) return 'Closed';
    if (formattedStatus?.includes('Proceed to Gate')) return 'Proceed to Gate';
    if (formattedStatus?.includes('Now Boarding')) return 'Now Boarding';
    return formattedStatus || 'Sched';
  };

  const getAirportDisplay = (code: string) => {
    return airportNames[code] || code;
  };

  const getHighlightClass = (flight: FlightWithHighlight) => {
    if (!flight.isHighlighted) return '';
    
    switch(flight.highlightType) {
      case 'new':
        return 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 dark:border-green-500 animate-pulse';
      case 'changed':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500';
      case 'removed':
        return 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 line-through opacity-60';
      default:
        return '';
    }
  };

  const getHighlightTextClass = (flight: FlightWithHighlight) => {
    if (!flight.isHighlighted) return '';
    
    switch(flight.highlightType) {
      case 'new':
        return 'text-green-700 dark:text-green-400 font-bold';
      case 'changed':
        return 'text-yellow-700 dark:text-yellow-400 font-bold';
      case 'removed':
        return 'text-red-700 dark:text-red-400';
      default:
        return '';
    }
  };

  const getHighlightIcon = (flight: FlightWithHighlight) => {
    if (!flight.isHighlighted) return null;
    
    switch(flight.highlightType) {
      case 'new':
        return <span className="ml-1 text-xs text-green-500 dark:text-green-400">✦ New</span>;
      case 'changed':
        return <span className="ml-1 text-xs text-yellow-500 dark:text-yellow-400">✦</span>;
      case 'removed':
        return <span className="ml-1 text-xs text-red-500 dark:text-red-400">✕</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans max-h-fit">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6 mx-auto">
          <Image 
            src="/ceb_logo.webp" 
            alt="Cebu Pacific Logo" 
            width={200}
            height={200}
            className="h-10 w-auto mx-auto"
            priority
          />
        </div>

        {/* Departure Selection with Refresh Button */}
        <div className="max-w-md mx-auto mb-6">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Departing from
          </label>
          <div className="flex gap-2">
            <div className="flex-1 h-10">
              <Select
                value={departure}
                onValueChange={(value) => setDeparture(value || '')}
              >
                <SelectTrigger className="w-full !h-10 text-sm bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700">
                  <SelectValue placeholder="Select airport" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] sm:max-h-[200px] bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                  {airports.map((code) => (
                    <SelectItem 
                      key={code} 
                      value={code}
                      className="py-3 sm:py-2 text-base sm:text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
                    >
                      {code} - {getAirportDisplay(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <button
              onClick={fetchFlights}
              disabled={isRefreshing}
              className="h-10 w-10 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:bg-orange-300 text-white rounded-lg transition-all duration-200 flex items-center justify-center flex-shrink-0 shadow-sm hover:shadow-md"
              title="Refresh flights"
            >
              <svg 
                className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 mt-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isRefreshing ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></span>
            {isRefreshing ? 'Refreshing...' : 'Auto-refresh every 1 minute'}
          </div>
        </div>

        {flights.length === 0 && loading && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading flights...
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-center text-sm">
            {error}
          </div>
        )}

        {flights.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 max-w-[620px] mx-auto rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
            {/* Desktop Header - Centered */}
            <div className="hidden sm:grid sm:grid-cols-[80px_1fr_120px_80px_100px] px-4 py-3 bg-zinc-100 dark:bg-zinc-700/50 border-b border-zinc-200 dark:border-zinc-700 font-semibold text-sm text-zinc-700 dark:text-zinc-300">
              <div className="flex items-center">Flight #</div>
              <div className="flex items-center justify-center">Destination</div>
              <div className="flex items-center justify-center">Status</div>
              <div className="flex items-center justify-center">ETD</div>
              <div className="flex items-center justify-center">Gate</div>
            </div>

            <div className="sm:hidden grid grid-cols-[70px_70px_1fr_80px] px-3 py-2.5 bg-zinc-100 dark:bg-zinc-700/50 border-b border-zinc-200 dark:border-zinc-700 font-semibold text-xs text-zinc-700 dark:text-zinc-300">
              <div className="flex items-center">Gate</div>
              <div className="flex items-center">Flight</div>
              <div className="flex items-center">To</div>
              <div className="flex items-center justify-center">ETD</div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
              {flights.map((flight, index) => {
                const highlightClass = getHighlightClass(flight);
                const textClass = getHighlightTextClass(flight);
                const icon = getHighlightIcon(flight);
                const isRemoved = flight.highlightType === 'removed';
                const formattedStatus = formatStatus(flight.Status);
                const statusColor = getStatusColor(flight.Status);
                
                if (isRemoved) return null;
                
                return (
                  <div 
                    key={`${flight.FlightNo || index}-${index}`}
                    className={`hidden sm:grid sm:grid-cols-[80px_1fr_120px_80px_100px] px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-all duration-500 text-sm items-center ${highlightClass}`}
                  >
                    <div className={`font-bold text-zinc-900 dark:text-zinc-100 truncate ${textClass}`}>
                      {flight.FlightNo || 'N/A'}
                      {icon}
                    </div>
                    <div className={`text-zinc-700 dark:text-zinc-300 truncate text-center ${textClass}`}>
                      {getAirportDisplay(flight.Destination)}
                    </div>
                    <div className={`font-medium truncate text-center ${statusColor}`}>
                      {formattedStatus}
                    </div>
                    <div className={`text-center text-zinc-700 dark:text-zinc-300 font-medium ${textClass}`}>
                      {flight.DepartureTime || 'TBD'}
                    </div>
                    <div className={`text-center text-zinc-700 dark:text-zinc-300 font-medium text-xs ${textClass}`}>
                      {formatGate(flight.Gate)}
                    </div>
                  </div>
                );
              })}

              {flights.map((flight, index) => {
                const highlightClass = getHighlightClass(flight);
                const textClass = getHighlightTextClass(flight);
                const icon = getHighlightIcon(flight);
                const isRemoved = flight.highlightType === 'removed';
                const statusColor = getStatusColor(flight.Status);
                const statusAbbr = getStatusAbbreviation(flight.Status);
                
                if (isRemoved) return null;
                
                return (
                  <div 
                    key={`mobile-${flight.FlightNo || index}-${index}`}
                    className={`sm:hidden grid grid-cols-[70px_70px_1fr_80px] px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-all duration-500 text-xs items-center ${highlightClass}`}
                  >
                    <div className={`text-left text-zinc-700 dark:text-zinc-300 font-medium text-[10px] ${textClass}`}>
                      {formatGate(flight.Gate)}
                    </div>
                    
                    <div className={`font-bold text-zinc-900 dark:text-zinc-100 truncate ${textClass}`}>
                      {flight.FlightNo || 'N/A'}
                      {icon}
                    </div>
                    
                    <div className={`text-zinc-700 dark:text-zinc-300 truncate ${textClass}`}>
                      <div className="font-medium">{flight.Destination}</div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                        {getAirportDisplay(flight.Destination)}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <div className={`text-zinc-700 dark:text-zinc-300 font-medium ${textClass}`}>
                        {flight.DepartureTime || 'TBD'}
                      </div>
                      <div className={`text-[10px] font-medium ${statusColor}`}>
                        {statusAbbr}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && flights.length === 0 && !error && (
          <div className="max-w-md mx-auto p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-center text-sm text-zinc-600 dark:text-zinc-400">
            No flights found for this airport
          </div>
        )}
      </div>
    </div>
  );
}