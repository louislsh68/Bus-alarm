const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Based on the transportChecker.js, the KMB API structure is different
const API_BASE_URL = 'https://rt.data.gov.hk/v2/transport';

async function fetchKMBRouteData() {
  try {
    console.log('Fetching KMB routes...');
    
    // According to transportChecker.js, KMB uses a different API endpoint structure
    // For KMB, the route API might be under kmb instead of citybus
    try {
      // Try the KMB specific route endpoint
      const routesResponse = await axios.get(`${API_BASE_URL}/kmb/route`);
      const routes = routesResponse.data.data || [];
      
      console.log(`Found ${routes.length} KMB routes total`);
      
      // Filter for route 2E specifically
      const route2E = routes.filter(route => route.route === '2E');
      console.log(`Found ${route2E.length} routes matching 2E`);
      
      if (route2E.length > 0) {
        console.log('Route 2E details:', route2E[0]);
        
        // Now get the stops for this route
        const routeNumber = '2E';
        const bound = route2E[0].bound || 'inbound'; // Default to 'inbound' if bound not specified
        
        console.log(`Fetching stops for KMB route ${routeNumber}, bound: ${bound}`);
        
        try {
          const stopsResponse = await axios.get(`${API_BASE_URL}/kmb/route-stop/${routeNumber}/${bound}`);
          const stops = stopsResponse.data.data || [];
          
          console.log(`Found ${stops.length} stops for KMB route ${routeNumber}:`);
          console.log(stops.map(stop => ({
            stopId: stop.stop,
            sequence: stop.seq,
            name_en: stop.stop_name_en,
            name_tc: stop.stop_name_tc
          })));
        } catch (stopsError) {
          console.error(`Error fetching stops for route ${routeNumber}:`, stopsError.message);
          
          // Try with different bound values if the first attempt fails
          const alternateBounds = ['inbound', 'outbound', 'I', 'O', 'i', 'o'];
          for (const altBound of alternateBounds) {
            try {
              console.log(`Trying alternate bound: ${altBound}`);
              const altStopsResponse = await axios.get(`${API_BASE_URL}/kmb/route-stop/${routeNumber}/${altBound}`);
              const altStops = altStopsResponse.data.data || [];
              
              console.log(`Found ${altStops.length} stops for KMB route ${routeNumber} with bound ${altBound}:`);
              console.log(altStops.map(stop => ({
                stopId: stop.stop,
                sequence: stop.seq,
                name_en: stop.stop_name_en,
                name_tc: stop.stop_name_tc
              })));
              break; // Exit the loop if successful
            } catch (altError) {
              console.log(`Failed with bound ${altBound}:`, altError.message);
            }
          }
        }
      } else {
        console.log('Route 2E not found in the general routes list.');
        console.log('Available KMB routes (first 10):', routes.slice(0, 10));
      }
    } catch (kmbError) {
      console.error('KMB specific endpoint failed:', kmbError.message);
      
      // Try using the citybus endpoint for KMB (as used in transportChecker.js)
      console.log('Trying citybus endpoint for KMB data...');
      try {
        const citybusRoutesResponse = await axios.get(`${API_BASE_URL}/citybus/route/KMB`);
        const routes = citybusRoutesResponse.data.data || [];
        
        console.log(`Found ${routes.length} KMB routes via citybus endpoint`);
        
        const route2E = routes.filter(route => route.route === '2E');
        console.log(`Found ${route2E.length} routes matching 2E via citybus endpoint`);
        
        if (route2E.length > 0) {
          console.log('Route 2E details:', route2E[0]);
          
          const routeNumber = '2E';
          const direction = route2E[0].dir || 'inbound'; // Direction might be in 'dir' field
          
          console.log(`Fetching stops for KMB route ${routeNumber}, direction: ${direction}`);
          
          try {
            const stopsResponse = await axios.get(`${API_BASE_URL}/citybus/route-stop/KMB/${routeNumber}/${direction}`);
            const stops = stopsResponse.data.data || [];
            
            console.log(`Found ${stops.length} stops for KMB route ${routeNumber}:`);
            console.log(stops.map(stop => ({
              stopId: stop.stop,
              sequence: stop.seq,
              name_en: stop.stop_name_en,
              name_tc: stop.stop_name_tc
            })));
          } catch (stopsError) {
            console.error(`Error fetching stops via citybus endpoint for route ${routeNumber}:`, stopsError.message);
          }
        } else {
          console.log('Route 2E not found via citybus endpoint either.');
          console.log('Available KMB routes via citybus endpoint (first 10):', routes.slice(0, 10));
        }
      } catch (citybusError) {
        console.error('Citybus endpoint for KMB also failed:', citybusError.message);
        console.log('Attempting direct ETA lookup for KMB 2E to see if that API works...');
        
        // Try to get ETA data directly for KMB 2E at a known stop
        // We'll try with a common stop name that might be on route 2E
        try {
          // First, let's try to find a valid stop ID for testing
          // We'll use a known stop ID format based on the CTB data
          const stopId = '001140'; // Using a sample stop ID from CTB data
          const etaResponse = await axios.get(`${API_BASE_URL}/kmb/eta/${stopId}/2E`);
          console.log('ETA Response:', etaResponse.data);
        } catch (etaError) {
          console.log('Direct ETA lookup also failed:', etaError.message);
        }
      }
    }
  } catch (error) {
    console.error('Error in fetchKMBRouteData:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

fetchKMBRouteData();