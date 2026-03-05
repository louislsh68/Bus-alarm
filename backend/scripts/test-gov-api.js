const axios = require('axios');

async function testGovAPI() {
  console.log('Testing direct calls to Hong Kong government transport API...\n');
  
  try {
    // Test 1: Try to get KMB routes from the government API
    console.log('1. Attempting to fetch KMB routes from government API...');
    try {
      // Using the same endpoint as in transportChecker.js
      const response = await axios.get('https://rt.data.gov.hk/v2/transport/citybus/route/KMB');
      console.log('   Success! Retrieved KMB routes from government API:');
      console.log('   Number of routes:', response.data.data?.length || 'Unknown');
      if (response.data.data && response.data.data.length > 0) {
        console.log('   First few routes:', response.data.data.slice(0, 5));
      }
    } catch (error) {
      console.log('   Failed to fetch KMB routes from government API:');
      console.log('   Error:', error.message);
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Data:', error.response.data);
      }
    }
    
    console.log('\n2. Trying alternative KMB route endpoint...');
    try {
      // Alternative endpoint for KMB routes
      const altResponse = await axios.get('https://rt.data.gov.hk/v2/transport/kmb/route');
      console.log('   Success! Retrieved KMB routes from alternative endpoint:');
      console.log('   Number of routes:', altResponse.data.data?.length || 'Unknown');
      if (altResponse.data.data && altResponse.data.data.length > 0) {
        console.log('   First few routes:', altResponse.data.data.slice(0, 5));
      }
    } catch (altError) {
      console.log('   Failed to fetch KMB routes from alternative endpoint:');
      console.log('   Error:', altError.message);
      if (altError.response) {
        console.log('   Status:', altError.response.status);
        console.log('   Data:', altError.response.data);
      }
    }
    
    console.log('\n3. Testing KMB 2E specific route info...');
    try {
      // Try to get info about 2E route specifically
      const route2EResponse = await axios.get('https://data.gov.hk/tc/data/transport/kmb/route-fare/latest/route_fare_list.json');
      console.log('   Success! Retrieved KMB route info from alternative source');
      console.log('   Data length:', route2EResponse.data.length || Object.keys(route2EResponse.data).length);
    } catch (route2EError) {
      console.log('   Failed to fetch KMB 2E route info from alternative source:');
      console.log('   Error:', route2EError.message);
      if (route2EError.response) {
        console.log('   Status:', route2EError.response.status);
      }
    }
    
  } catch (error) {
    console.error('General error:', error.message);
  }
  
  console.log('\nTesting complete.');
}

testGovAPI();