const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'https://rt.data.gov.hk/v2/transport';

async function fetchAndSaveRouteStops() {
  try {
    // Companies to fetch data for
    const companies = ['CTB', 'NWFB', 'KMB']; // Start with Citybus
    
    // Initialize our data structure
    const stopMap = {};
    const destinationsMap = {};

    for (const company of companies) {
      console.log(`Fetching data for company: ${company}`);
      stopMap[company] = {};
      destinationsMap[company] = {};

      try {
        // First, get all routes for the company
        const routesResponse = await axios.get(`${API_BASE_URL}/citybus/route/${company}`);
        const routes = routesResponse.data.data || [];

        console.log(`Found ${routes.length} routes for ${company}`);

        // Process each route
        for (let i = 0; i < Math.min(routes.length, 10); i++) { // Limit to first 10 routes to avoid rate limits
          const route = routes[i];
          const routeNumber = route.route;
          
          console.log(`Processing route: ${routeNumber}`);
          
          // Fetch stops for both directions
          for (const direction of ['inbound', 'outbound']) {
            try {
              const routeStopResponse = await axios.get(`${API_BASE_URL}/citybus/route-stop/${company}/${routeNumber}/${direction}`);
              
              if (routeStopResponse.data && routeStopResponse.data.data) {
                const stops = routeStopResponse.data.data;
                
                // Initialize the route in our maps if not already
                if (!stopMap[company][routeNumber]) {
                  stopMap[company][routeNumber] = {};
                  destinationsMap[company][routeNumber] = [];
                }
                
                // Process each stop
                for (const stop of stops) {
                  const stopName = stop.stop; // This might need adjustment based on actual response structure
                  
                  // Add to stopMap with stop ID as value
                  stopMap[company][routeNumber][stopName] = stop.stop;
                  
                  // Add to destinationsMap if not already present
                  if (!destinationsMap[company][routeNumber].includes(stopName)) {
                    destinationsMap[company][routeNumber].push(stopName);
                  }
                }
              }
            } catch (dirError) {
              console.warn(`Could not fetch ${direction} data for ${company} route ${routeNumber}:`, dirError.message);
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching routes for ${company}:`, error.message);
      }
    }

    // Write the updated data to files
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create the updated loader.js file
    const loaderContent = `
const fs = require('fs');
const path = require('path');

// Dynamically generated stop and destination mappings
const stopMap = ${JSON.stringify(stopMap, null, 2)};

const destinationsMap = ${JSON.stringify(destinationsMap, null, 2)};

module.exports = { stopMap, destinationsMap };
`;

    fs.writeFileSync(path.join(dataDir, 'loader.js'), loaderContent.trim());
    console.log('✅ Updated loader.js with new stop and destination mappings');
    
    // Also save as separate JSON files for easier debugging
    fs.writeFileSync(path.join(dataDir, 'stopMap.json'), JSON.stringify(stopMap, null, 2));
    fs.writeFileSync(path.join(dataDir, 'destinationsMap.json'), JSON.stringify(destinationsMap, null, 2));
    console.log('✅ Saved stopMap.json and destinationsMap.json for reference');

  } catch (error) {
    console.error('Error in fetchAndSaveRouteStops:', error.message);
  }
}

// Run the update
fetchAndSaveRouteStops();