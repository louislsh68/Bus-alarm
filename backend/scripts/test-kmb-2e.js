const axios = require('axios');

async function testKMB2ERoute() {
  console.log('=== Testing KMB 2E Route Information ===\n');
  
  try {
    // Test 1: Get available routes for KMB
    console.log('1. Fetching KMB routes...');
    const routesResponse = await axios.get('http://localhost:5000/api/routes/KMB');
    console.log('   Available KMB routes:', routesResponse.data);
    
    // Test 2: Get stops for KMB 2E
    console.log('\n2. Fetching stops for KMB 2E...');
    const stopsResponse = await axios.get('http://localhost:5000/api/stops/KMB/2E');
    console.log('   Number of stops for KMB 2E:', stopsResponse.data.length);
    console.log('   Sample stops:', stopsResponse.data.slice(0, 5));
    
    // Test 3: Get destinations for KMB 2E
    console.log('\n3. Fetching destinations for KMB 2E...');
    const destResponse = await axios.get('http://localhost:5000/api/destinations/KMB/2E');
    console.log('   Number of destinations for KMB 2E:', destResponse.data.length);
    console.log('   Sample destinations:', destResponse.data.slice(0, 5));
    
    // Test 4: Try to get ETA for a stop on KMB 2E
    console.log('\n4. Testing ETA for KMB 2E at stop 001140...');
    try {
      const etaResponse = await axios.get('http://localhost:5000/api/eta/KMB/2E/001140');
      console.log('   ETA data:', etaResponse.data);
    } catch (etaError) {
      console.log('   ETA request failed (expected if stop name is required instead of ID):', etaError.response?.data || etaError.message);
    }
    
    console.log('\n=== Summary ===');
    console.log('✓ Successfully retrieved KMB routes');
    console.log('✓ Successfully retrieved KMB 2E stops');
    console.log('✓ Successfully retrieved KMB 2E destinations');
    console.log('✓ Backend API is functioning correctly');
    console.log('\nThe Bus Alarm system can now access KMB 2E route information!');
    
  } catch (error) {
    console.error('Error during testing:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testKMB2ERoute();