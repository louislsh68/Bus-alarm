const axios = require('axios');

async function testCorrectGovAPI() {
  console.log('Testing Hong Kong government transport API with correct company codes...\n');
  
  // Different potential company codes for KMB
  const companyCodes = ['kmb', 'KMB', 'KT', 'gfb', 'nlb'];
  
  for (const code of companyCodes) {
    console.log(`Testing company code: ${code}`);
    try {
      const response = await axios.get(`https://rt.data.gov.hk/v2/transport/citybus/route/${code}`);
      console.log(`  ✓ Success with ${code}: Found ${response.data.data?.length || 0} routes`);
      if (response.data.data && response.data.data.length > 0) {
        console.log(`  Sample routes:`, response.data.data.slice(0, 3));
        break; // Found a working code, exit loop
      }
    } catch (error) {
      console.log(`  ✗ Failed with ${code}: ${error.message}`);
    }
    console.log(''); // Empty line for readability
  }
  
  // Let's also try the KMB-specific endpoint with various route numbers
  console.log('Testing KMB-specific endpoints...\n');
  
  // Try to get route details for some common routes
  const commonRoutes = ['1', '2', '2E', '2A', '5C', '10'];
  
  for (const route of commonRoutes) {
    console.log(`Testing KMB route ${route}:`);
    try {
      // Try the route-stop endpoint which might give us more info
      const response = await axios.get(`https://rt.data.gov.hk/v2/transport/kmb/route-stop/${route}/inbound`);
      console.log(`  ✓ Success for route ${route}`);
      console.log(`  Number of stops: ${response.data.data?.length || 0}`);
      break; // Found a working route, exit loop
    } catch (error) {
      console.log(`  ✗ Failed for route ${route}: ${error.message}`);
    }
    console.log('');
  }
  
  console.log('Testing completed.');
}

testCorrectGovAPI();