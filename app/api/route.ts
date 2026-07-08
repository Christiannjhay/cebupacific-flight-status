import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const departure = searchParams.get('departure') || 'MNL';
  
  try {
    const url = `https://flightlocator.cebupacificair.com/flightlocator/Flights/GateFlights?TimeZone=Local&departureStation=${departure}&timeZone=Local`;
    
    console.log('Fetching URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      }
    });
    
    if (!response.ok) {
      console.error('Response not OK:', response.status);
      return NextResponse.json(
        { error: `HTTP error! status: ${response.status}` },
        { status: response.status }
      );
    }
    
    const html = await response.text();
    console.log('HTML received, length:', html.length);
    
    // Parse HTML with Cheerio
    const flights = parseFlightsFromHTML(html);
    
    console.log(`Extracted ${flights.length} flights`);
    
    // Return as JSON
    return NextResponse.json(flights);
    
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch flight data' },
      { status: 500 }
    );
  }
}

function parseFlightsFromHTML(html: string): any[] {
  const $ = cheerio.load(html);
  const flights: any[] = [];
  
  // Find all flight card containers
  $('.card__container').each((index, element) => {
    const flight: any = {};
    
    // Extract flight number from h3 with class 'flight-number'
    const flightNumber = $(element).find('.card--head .flight-number').text().trim();
    if (flightNumber) {
      flight.FlightNo = flightNumber;
    } else {
      return; // Skip if no flight number
    }
    
    // Extract destination code from h1 with class 'destination'
    const destination = $(element).find('.card--head .destination').text().trim();
    if (destination) {
      flight.Destination = destination;
    }
    
    // Extract destination name from h5 with class 'airport'
    const destinationName = $(element).find('.card--head .airport').text().trim();
    if (destinationName) {
      flight.DestinationName = destinationName;
    }
    
    // Extract status from span with class 'now-boarding' or any span in status
    const statusElement = $(element).find('.card--head .status span');
    if (statusElement.length > 0) {
      flight.Status = statusElement.text().trim();
    } else {
      // Try to find status text in the status paragraph
      const statusText = $(element).find('.card--head .status').text().trim();
      if (statusText) {
        flight.Status = statusText;
      }
    }
    
    // Extract departure time - check for both regular and "New Departure Time"
    const timeElement = $(element).find('.card--body .detail--block .value');
    if (timeElement.length > 0) {
      flight.DepartureTime = timeElement.first().text().trim();
    }
    
    // Check if it's a new departure time
    const newTimeLabel = $(element).find('.card--body .detail--block .title .new');
    if (newTimeLabel.length > 0) {
      flight.IsNewTime = true;
    }
    
    // Extract gate
    const gateElement = $(element).find('.card--body .detail--block .gate span');
    if (gateElement.length > 0) {
      flight.Gate = gateElement.text().trim();
    } else {
      // Try to find gate in the gate h5
      const gateText = $(element).find('.card--body .detail--block .gate').text().trim();
      if (gateText) {
        flight.Gate = gateText;
      }
    }
    
    // Only add if we have at least a flight number and destination
    if (flight.FlightNo && flight.Destination) {
      flights.push(flight);
    }
  });
  
  // If Cheerio didn't find any flights with the class selectors, try a fallback method
  if (flights.length === 0) {
    console.log('Class-based parsing found no flights, trying fallback...');
    return parseFlightsWithFallback($);
  }
  
  return flights;
}

function parseFlightsWithFallback($: any): any[] {
  const flights: any[] = [];
  
  // Look for flight cards using more generic selectors
  $('.card__block, .flight-card, .flight-item').each((index: number, element: any) => {
    const text = $(element).text().trim();
    
    // Try to extract data using regex patterns
    const flightMatch = text.match(/(5J\s*\d+)/);
    const destMatch = text.match(/([A-Z]{3})/);
    const statusMatch = text.match(/(Gate Closed|Proceed to Gate|On Time|Delayed|Cancelled|Boarding|Final Call)/);
    const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/);
    const gateMatch = text.match(/Gate\s*([^\s]+)/);
    
    if (flightMatch) {
      const flight: any = {
        FlightNo: flightMatch[1].replace(/\s/g, ''),
        Destination: destMatch ? destMatch[1] : '',
        DestinationName: '',
        Status: statusMatch ? statusMatch[1] : 'Scheduled',
        DepartureTime: timeMatch ? timeMatch[1] : 'TBD',
        Gate: gateMatch ? gateMatch[1].trim() : 'TBA'
      };
      
      if (flight.FlightNo && flight.Destination) {
        flights.push(flight);
      }
    }
  });
  
  return flights;
}