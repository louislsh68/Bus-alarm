#!/usr/bin/env node

const axios = require('axios');
const readline = require('readline');

// Define the available transport operators and their base URLs
const OPERATORS = {
  kmb: {
    name: 'KMB (九巴)',
    baseUrl: 'https://data.etabus.gov.hk/v1/transport/kmb'
  },
  ctb: {
    name: 'Citybus (城巴)',
    baseUrl: 'https://data.etabus.gov.hk/v1/transport/ctb'
  },
  nwfb: {
    name: 'NWFB (新巴)',
    baseUrl: 'https://data.etabus.gov.hk/v1/transport/nwfb'
  }
};

// Function to get route details (origins and destinations for both directions)
async function getRouteDetails(operator, route, serviceType = '1') {
  try {
    const API_URL = OPERATORS[operator].baseUrl;
    
    // Different operators may have different API structures
    if (operator === 'kmb') {
      // KMB uses the /route/ endpoint to get all routes and then filter
      const response = await axios.get(`${API_URL}/route/`);
      const allRoutes = response.data.data;
      
      // Filter for the specific route and service type
      const filteredRoutes = allRoutes.filter(detail => 
        detail.route === route && detail.service_type === serviceType
      );
      
      return filteredRoutes;
    } else if (operator === 'ctb' || operator === 'nwfb') {
      // Citybus and NWFB may have different API structures
      // Try the standard route endpoint first
      try {
        const response = await axios.get(`${API_URL}/route/${route}/${serviceType}`);
        
        // If successful, return the data in a compatible format
        if (response.data && response.data.data) {
          return response.data.data;
        }
      } catch (routeErr) {
        // If the direct route endpoint doesn't work, try other approaches
        console.log(`Note: ${OPERATORS[operator].name} API may have different access patterns than KMB.`);
        console.log(`Trying alternative methods for ${route}...`);
        
        // For now, return null to indicate this needs special handling
        return null;
      }
    }
  } catch (error) {
    console.error(`Error fetching route details for ${OPERATORS[operator].name}:`, error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

async function getRouteStops(operator, route, direction = 'outbound', serviceType = '1') {
  try {
    const API_URL = OPERATORS[operator].baseUrl;
    
    if (operator === 'kmb') {
      // Standard KMB API call
      const response = await axios.get(`${API_URL}/route-stop/${route}/${direction}/${serviceType}`);
      
      console.log(`Stops for Route ${route} (${OPERATORS[operator].name}), Direction: ${direction.toUpperCase()}, Service Type: ${serviceType}`);
      console.log(`Total stops: ${response.data.data.length}`);
      console.log('\nStop Sequence | Stop ID | Stop Name (English)');
      console.log('-------------|---------|-------------------');
      
      for (const stop of response.data.data) {
        try {
          // Get stop details to show the name
          const stopDetail = await axios.get(`${API_URL}/stop/${stop.stop}`);
          const stopName = stopDetail.data.data.name_en || 'Unknown';
          console.log(`${stop.seq.padEnd(13)}| ${stop.stop.substring(0, 10)}... | ${stopName}`);
        } catch (err) {
          console.log(`${stop.seq.padEnd(13)}| ${stop.stop.substring(0, 10)}... | [Unable to fetch name]`);
        }
      }
    } else {
      // For other operators, we may need different handling
      console.log(`Route stops for ${OPERATORS[operator].name} routes may require different API access methods.`);
      console.log(`Currently, only KMB routes are fully supported in the interactive mode.`);
      console.log(`You may need to use the direct API endpoints for ${OPERATORS[operator].name} routes.`);
    }
  } catch (error) {
    console.error(`Error fetching route stops for ${OPERATORS[operator].name}:`, error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Interactive function to get user input
function getUserChoice(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node find_stops.js [operator] <route_number> [direction] [service_type]');
    console.log('Operators: kmb (default), ctb (Citybus), nwfb (NWFB)');
    console.log('Example: node find_stops.js kmb 1 outbound 1');
    console.log('Note: If only route_number is provided, you will be prompted to select the direction interactively.');
    process.exit(1);
  }
  
  let operator = 'kmb';
  let routeIndex = 0;
  
  // Check if first argument is an operator
  if (args[0] in OPERATORS) {
    operator = args[0];
    routeIndex = 1;
  }
  
  const route = args[routeIndex];
  const serviceType = args[routeIndex + 2] || '1'; // Default to service type 1
  
  // If direction is provided as argument, use the old method
  if (args[routeIndex + 1]) {
    const direction = args[routeIndex + 1] || 'outbound';
    getRouteStops(operator, route, direction, serviceType);
  } else {
    // New interactive method using terminal names
    (async () => {
      console.log(`Fetching route details for ${OPERATORS[operator].name}, route ${route}...`);
      
      // Get route details to show terminal options
      const routeDetails = await getRouteDetails(operator, route, serviceType);
      
      if (!routeDetails || !Array.isArray(routeDetails) || routeDetails.length === 0) {
        console.error(`No route details found for route ${route} with operator ${OPERATORS[operator].name}`);
        console.log(`Note: Some operators (like Citybus) may have different API access methods or restrictions.`);
        process.exit(1);
      }
      
      // Filter for the service type we're interested in
      const filteredDetails = routeDetails.filter(detail => detail.service_type === serviceType);
      
      if (filteredDetails.length === 0) {
        console.error(`No route details found for route ${route} with service type ${serviceType} and operator ${OPERATORS[operator].name}`);
        process.exit(1);
      }
      
      // Group by bound (O for outbound, I for inbound)
      const outboundDetails = filteredDetails.find(detail => detail.bound === 'O');
      const inboundDetails = filteredDetails.find(detail => detail.bound === 'I');
      
      // Display options to user
      console.log(`\nRoute ${route} (${OPERATORS[operator].name}) has the following directions:`);
      let optionCount = 1;
      const options = [];
      
      if (outboundDetails) {
        console.log(`${optionCount}. To ${outboundDetails.dest_en} (from ${outboundDetails.orig_en}) - Outbound`);
        options.push({ choice: optionCount, direction: 'outbound', bound: 'O' });
        optionCount++;
      }
      
      if (inboundDetails) {
        console.log(`${optionCount}. To ${inboundDetails.dest_en} (from ${inboundDetails.orig_en}) - Inbound`);
        options.push({ choice: optionCount, direction: 'inbound', bound: 'I' });
        optionCount++;
      }
      
      if (options.length === 0) {
        console.error(`No valid directions found for route ${route} with operator ${OPERATORS[operator].name}`);
        process.exit(1);
      }
      
      // Get user's choice
      const userInput = await getUserChoice(`\nPlease select the direction (1-${options.length}): `);
      const selectedOption = options.find(opt => opt.choice === parseInt(userInput));
      
      if (!selectedOption) {
        console.error('Invalid selection. Please run the command again and select a valid option.');
        process.exit(1);
      }
      
      console.log(`\nFetching stops for Route ${route} (${OPERATORS[operator].name}), Direction: ${selectedOption.direction.toUpperCase()}...`);
      await getRouteStops(operator, route, selectedOption.direction, serviceType);
    })();
  }
}

module.exports = { getRouteStops };