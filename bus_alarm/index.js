require('dotenv').config();
const express = require('express');
const axios = require('axios');
const moment = require('moment');

// Initialize express app
const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3000;
const OPERATOR = process.env.BUS_OPERATOR || 'kmb'; // Default to KMB, can be kmb, ctb, or nwfb
const OPERATORS = {
  kmb: {
    name: 'KMB (九巴)',
    baseUrl: 'https://data.etabus.gov.hk/v1/transport/kmb'
  },
  ctb: {
    name: 'Citybus (城巴)',
    baseUrl: 'https://rt.data.gov.hk/v2/transport/citybus'
  },
  nwfb: {
    name: 'NWFB (新巴)',
    baseUrl: 'https://rt.data.gov.hk/v2/transport/citybus', // NWFB merged with Citybus
    note: 'NWFB routes now operated by Citybus, use CTB API'
  }
};
const API_URL = OPERATORS[OPERATOR]?.baseUrl || 'https://data.etabus.gov.hk/v1/transport/kmb';
const ROUTE = process.env.BUS_ROUTE || '960'; // Default to route 960
const STOP_CODE = process.env.STOP_CODE || '1'; // Default to stop sequence 1
const DIRECTION = process.env.DIRECTION || 'O'; // O=outbound, I=inbound

// Store active alarms
let activeAlarms = [];

// Function to get bus ETA data
async function getBusETA() {
  try {
    console.log(`Fetching route stops for ${OPERATORS[OPERATOR].name} route ${ROUTE}, direction ${DIRECTION}, service_type 1`);
    
    // Get route information (this will use cached data or fetch fresh data)
    const routeData = await getRouteInformation(ROUTE, DIRECTION, '1');
    
    if (!routeData) {
      console.error(`Could not retrieve route data for ${OPERATORS[OPERATOR].name}`);
      return null;
    }
    
    console.log(`Found ${routeData.length} stops for ${OPERATORS[OPERATOR].name} route ${ROUTE}`);
    
    // Find the stop with the matching stop_seq
    const stopData = routeData.find(stop => stop.seq === STOP_CODE.toString());
    
    if (!stopData) {
      console.warn(`Stop sequence ${STOP_CODE} not found for ${OPERATORS[OPERATOR].name} route ${ROUTE}. Available stops:`, 
        routeData.map(s => ({ seq: s.seq, stop_id: s.stop })));
      
      // If the specific stop sequence isn't found, use the first stop as fallback for testing
      if (routeData.length > 0) {
        console.log(`Using first available stop as fallback: seq ${routeData[0].seq}, id ${routeData[0].stop}`);
        return await getETAByStopId(routeData[0].stop, ROUTE, DIRECTION);
      }
      return null;
    }

    console.log(`Found stop: seq ${stopData.seq}, id ${stopData.stop}`);
    
    // Get detailed stop information including ETAs using the actual stop ID
    return await getETAByStopId(stopData.stop, ROUTE, DIRECTION);
  } catch (error) {
    console.error(`Error fetching bus data for ${OPERATORS[OPERATOR].name}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

// Helper function to get ETA by stop ID
async function getETAByStopId(stopId, route, direction) {
  try {
    // Handle different API structures for different operators
    if (OPERATOR === 'kmb') {
      // KMB API structure
      const stopDetailResponse = await axios.get(`${API_URL}/stop-eta/${stopId}`);
      // Use the original direction format ('O' or 'I') for filtering
      const directionFilter = direction.toUpperCase();
      const etas = stopDetailResponse.data.data.filter(eta => 
        eta.route === route && eta.dir === directionFilter
      );
      return etas;
    } else if (OPERATOR === 'ctb') {
      // Citybus API V2 structure: /v2/transport/citybus/eta/CTB/{stop_id}/{route_no}
      const etaResponse = await axios.get(`${API_URL}/eta/${OPERATOR.toUpperCase()}/${stopId}/${route}`);
      if (etaResponse.data && etaResponse.data.data) {
        return etaResponse.data.data;
      }
      return [];
    } else if (OPERATOR === 'nwfb') {
      // NWFB is now merged with Citybus, use same API
      console.log(`ℹ️ NWFB routes are now operated by Citybus. Using CTB API.`);
      const etaResponse = await axios.get(`${API_URL}/eta/CTB/${stopId}/${route}`);
      if (etaResponse.data && etaResponse.data.data) {
        return etaResponse.data.data;
      }
      return [];
    }
  } catch (error) {
    console.error(`Error fetching ETA by stop ID for ${OPERATORS[OPERATOR].name}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

// Function to check if bus is arriving soon
function isBusArrivingSoon(etas, thresholdMinutes = 5) {
  if (!etas || etas.length === 0) return false;

  for (const eta of etas) {
    if (eta.eta) {
      const etaTime = moment(eta.eta);
      const now = moment();
      const diffMinutes = etaTime.diff(now, 'minutes');
      
      if (diffMinutes <= thresholdMinutes && diffMinutes >= 0) {
        return {
          arriving: true,
          minutes: diffMinutes,
          eta: eta.eta,
          vehicle: eta.coach_no || 'Unknown'
        };
      }
    }
  }
  
  return { arriving: false };
}

// Function to trigger alarm
function triggerAlarm(busInfo) {
  console.log(`🚨 BUS ALARM: Route ${ROUTE} arriving in ${busInfo.minutes} minutes!`);
  console.log(`Expected arrival: ${busInfo.eta}`);
  console.log(`Coach number: ${busInfo.vehicle}`);
  
  // Add to active alarms
  activeAlarms.push({
    id: Date.now(),
    route: ROUTE,
    minutes: busInfo.minutes,
    eta: busInfo.eta,
    timestamp: new Date().toISOString()
  });
  
  // Here you could add additional alarm mechanisms (audio, notifications, etc.)
  // For example, play a sound, send a notification, etc.
}

// Check bus status endpoint
app.get('/api/check-bus', async (req, res) => {
  try {
    const etas = await getBusETA();
    const busStatus = isBusArrivingSoon(etas);
    
    if (busStatus.arriving) {
      triggerAlarm(busStatus);
    }
    
    res.json({
      operator: OPERATOR,
      operatorName: OPERATORS[OPERATOR].name,
      route: ROUTE,
      stopCode: STOP_CODE,
      direction: DIRECTION,
      etas: etas,
      busStatus: busStatus,
      activeAlarms: activeAlarms
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active alarms
app.get('/api/alarms', (req, res) => {
  res.json(activeAlarms);
});

// Clear alarms
app.delete('/api/alarms', (req, res) => {
  activeAlarms = [];
  res.json({ message: 'Alarms cleared' });
});

// Function to clear route cache
function clearRouteCache() {
  cachedRoutes = {};
  lastRouteRefresh = null;
  console.log('🗑️ Route cache cleared');
}

// Endpoint to manually refresh route information
app.post('/api/refresh-routes', async (req, res) => {
  try {
    await refreshRouteInformation();
    res.json({ 
      message: 'Route information refreshed successfully',
      lastRefresh: lastRouteRefresh,
      cachedRoutes: Object.keys(cachedRoutes)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to clear route cache
app.delete('/api/routes-cache', (req, res) => {
  clearRouteCache();
  res.json({ message: 'Route cache cleared' });
});

// Get route information
app.get('/api/routes-info', (req, res) => {
  res.json({
    operator: OPERATOR,
    operatorName: OPERATORS[OPERATOR].name,
    cachedRoutes: cachedRoutes,
    lastRouteRefresh: lastRouteRefresh,
    route: ROUTE,
    stopCode: STOP_CODE,
    direction: DIRECTION
  });
});

// Get operator support status
app.get('/api/operator-status', (req, res) => {
  res.json({
    operator: OPERATOR,
    operatorName: OPERATORS[OPERATOR].name,
    status: {
      kmb: {
        status: 'fully_supported',
        description: 'KMB API works with standard endpoints',
        documentation: 'https://data.etabus.gov.hk/',
        endpoints: {
          'route-stop': '/v1/transport/kmb/route-stop/{route}/{direction}/{service_type}',
          'stop-eta': '/v1/transport/kmb/stop-eta/{stop_id}',
          'route': '/v1/transport/kmb/route/'
        }
      },
      ctb: {
        status: 'investigation_needed',
        description: 'Citybus API endpoints return "Invalid/Missing parameter(s)" errors when accessed using documented patterns',
        notes: [
          'Tested endpoints like /v1/transport/ctb/route/company/CTB and others return 422 errors',
          'API may require special authentication or access credentials',
          'Documentation may be outdated or different from actual implementation',
          'Alternative access methods or credentials may be required'
        ],
        documentation: 'https://www.citybus.com.hk/datagovhk/bus_eta_api_specifications.pdf',
        testedEndpoints: [
          '/v1/transport/ctb/route/company/CTB',
          '/v1/transport/ctb/route-stop/company/CTB/route/{route}',
          '/v1/transport/ctb/eta/company/CTB/route/{route}/stop/{stop}',
          '/v2/transport/citybus/route-list',
          '/v2/transport/citybus/route?company_id=CTB'
        ]
      },
      nwfb: {
        status: 'investigation_needed',
        description: 'NWFB API (merged with Citybus) endpoints return "Invalid/Missing parameter(s)" errors when accessed using documented patterns',
        notes: [
          'Tested endpoints like /v1/transport/nwfb/route/company/NWFB and others return 422 errors',
          'API may require special authentication or access credentials',
          'Follows same access pattern challenges as Citybus API',
          'Alternative access methods or credentials may be required'
        ],
        documentation: 'Same as Citybus API documentation',
        testedEndpoints: [
          '/v1/transport/nwfb/route/company/NWFB',
          '/v1/transport/nwfb/route-stop/company/NWFB/route/{route}',
          '/v1/transport/nwfb/eta/company/NWFB/route/{route}/stop/{stop}'
        ]
      }
    },
    currentConfig: {
      route: ROUTE,
      stopCode: STOP_CODE,
      direction: DIRECTION
    },
    lastRouteRefresh: lastRouteRefresh,
    cachedRoutesCount: Object.keys(cachedRoutes).length
  });
});

// Cache for route information with timestamps
let cachedRoutes = {};
let lastRouteRefresh = null;

// Function to refresh route information daily
// Helper to fetch stop details (name) for Citybus/NWFB
async function getStopDetails(stopId) {
  try {
    // Citybus stop details endpoint
    const resp = await axios.get(`${API_URL}/stop/${stopId}`);
    if (resp.data && resp.data.data) {
      return resp.data.data; // contains name_tc, name_en, name_sc, lat, long, etc.
    }
    return null;
  } catch (e) {
    console.error(`Error fetching stop details for ${stopId}:`, e.message);
    return null;
  }
}
async function refreshRouteInformation() {
  try {
    console.log(`🔄 Refreshing route information for ${OPERATORS[OPERATOR].name}...`);
    
    let routeDetails = [];
    
    if (OPERATOR === 'kmb') {
      // KMB API structure
      const directionParam = DIRECTION.toLowerCase() === 'o' ? 'outbound' : 
                           DIRECTION.toLowerCase() === 'i' ? 'inbound' : DIRECTION.toLowerCase();
      
      const routeResponse = await axios.get(`${API_URL}/route-stop/${ROUTE}/${directionParam}/1`); // service type 1
      routeDetails = routeResponse.data.data;
      
      if (routeDetails && Array.isArray(routeDetails)) {
        // Update cache with fresh route information
        cachedRoutes[ROUTE] = {
          data: routeDetails,
          timestamp: new Date().toISOString()
        };
        
        console.log(`✓ Updated route information for ${OPERATORS[OPERATOR].name} ${ROUTE}. Found ${routeDetails.length} stops.`);
        lastRouteRefresh = new Date();
      } else {
        console.log(`⚠️ Could not fetch route details for ${OPERATORS[OPERATOR].name} ${ROUTE}`);
      }
    } else if (OPERATOR === 'ctb' || OPERATOR === 'nwfb') {
      // Citybus API V2 structure: /v2/transport/citybus/route-stop/CTB/{route_no}/{direction}
      const directionParam = DIRECTION.toLowerCase() === 'o' ? 'outbound' : 
                           DIRECTION.toLowerCase() === 'i' ? 'inbound' : DIRECTION.toLowerCase();
      
      const company = OPERATOR === 'nwfb' ? 'CTB' : 'CTB'; // NWFB routes now under CTB
      const routeResponse = await axios.get(`${API_URL}/route-stop/${company}/${ROUTE}/${directionParam}`);
      
      if (routeResponse.data && routeResponse.data.data && Array.isArray(routeResponse.data.data)) {
        routeDetails = routeResponse.data.data;
        // Enrich each stop with its name using stop endpoint
        for (let i = 0; i < routeDetails.length; i++) {
          const stopId = routeDetails[i].stop;
          const details = await getStopDetails(stopId);
          if (details) {
            routeDetails[i].name_tc = details.name_tc;
            routeDetails[i].name_en = details.name_en;
            routeDetails[i].name_sc = details.name_sc;
          }
        }
        // Update cache with fresh route information (now includes names)
        cachedRoutes[ROUTE] = {
          data: routeDetails,
          timestamp: new Date().toISOString()
        };
        
        console.log(`✓ Updated route information for ${OPERATORS[OPERATOR].name} ${ROUTE}. Found ${routeDetails.length} stops (with names).`);
        lastRouteRefresh = new Date();
      } else {
        console.log(`⚠️ Could not fetch route details for ${OPERATORS[OPERATOR].name} ${ROUTE}`);
      }
    }
  } catch (error) {
    console.error(`Error refreshing route information for ${OPERATORS[OPERATOR].name}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Function to get route information (with caching)
async function getRouteInformation(route, direction = 'O', serviceType = '1') {
  // Check if we need to refresh (daily)
  const now = new Date();
  if (!lastRouteRefresh || now.getDate() !== lastRouteRefresh.getDate()) {
    await refreshRouteInformation();
  }
  
  // If we have cached data, use it
  if (cachedRoutes[route]) {
    return cachedRoutes[route].data;
  }
  
  // Otherwise fetch fresh data
  try {
    if (OPERATOR === 'kmb') {
      // KMB API structure
      const directionParam = direction.toLowerCase() === 'o' ? 'outbound' : 
                           direction.toLowerCase() === 'i' ? 'inbound' : direction.toLowerCase();
      
      const response = await axios.get(`${API_URL}/route-stop/${route}/${directionParam}/${serviceType}`);
      return response.data.data;
    } else if (OPERATOR === 'ctb' || OPERATOR === 'nwfb') {
      // Citybus/NWFB API appears to have different structure than documented
      // The API endpoints tested return "Invalid/Missing parameter(s)" errors
      console.log(`⚠️ ${OPERATORS[OPERATOR].name} API requires special handling. Current endpoints may not be publicly accessible in the same way as KMB.`);
      console.log(`💡 Possible solutions: Special API keys, different authentication, or different endpoint structure.`);
      return null; // Return null as we cannot fetch data with current understanding
    }
  } catch (error) {
    console.error(`Error fetching route information for ${OPERATORS[OPERATOR].name}:`, error.message);
    return null;
  }
}

// Start monitoring automatically
async function startMonitoring() {
  console.log(`🚌 Bus Alarm System Started`);
  console.log(`Operator: ${OPERATORS[OPERATOR].name}, Route: ${ROUTE}, Stop: ${STOP_CODE}, Direction: ${DIRECTION}`);
  console.log(`Checking bus status every 30 seconds...`);
  
  // Refresh route information initially
  await refreshRouteInformation();
  
  // Schedule daily refresh of route information
  setInterval(async () => {
    await refreshRouteInformation();
  }, 24 * 60 * 60 * 1000); // Refresh every 24 hours
  
  setInterval(async () => {
    try {
      const etas = await getBusETA();
      const busStatus = isBusArrivingSoon(etas);
      
      if (busStatus.arriving) {
        triggerAlarm(busStatus);
      } else {
        console.log(`No buses arriving soon for ${OPERATORS[OPERATOR].name} ${ROUTE}. Next check in 30 seconds.`);
      }
    } catch (error) {
      console.error(`Error during monitoring for ${OPERATORS[OPERATOR].name}:`, error.message);
    }
  }, 30000); // Check every 30 seconds
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Bus Alarm System Running',
    route: ROUTE,
    stopCode: STOP_CODE,
    direction: DIRECTION,
    activeAlarmsCount: activeAlarms.length
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Bus Alarm Server running on port ${PORT}`);
  startMonitoring(); // Start automatic monitoring
});