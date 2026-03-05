const axios = require('axios');

async function testAlternativeAPI() {
  console.log('Testing alternative approaches to HK transport API...\n');
  
  // Try to get general transport info first
  try {
    console.log('Testing base transport API endpoint...');
    const response = await axios.get('https://rt.data.gov.hk/');
    console.log('Direct base endpoint failed as expected (usually returns HTML)');
  } catch (error) {
    console.log('✓ Base endpoint appropriately returns error as expected\n');
  }
  
  // Try different approach - maybe we need to look at the API structure differently
  // Let's try the MTR endpoint to see if the API structure is consistent
  try {
    console.log('Testing MTR route endpoint (as reference)...');
    const mtrResponse = await axios.get('https://rt.data.gov.hk/v2/transport/mtr/route/EAL');
    console.log('MTR endpoint result:', mtrResponse.data);
  } catch (mtrError) {
    console.log('MTR endpoint failed (may not be publicly accessible):', mtrError.message);
  }
  
  console.log('');
  
  // Let's try the KMB ETAv2 endpoint which might be more accessible
  try {
    console.log('Testing KMB ETA endpoint (with sample data)...');
    // We'll use a known stop and route combination
    const etaResponse = await axios.get('https://rt.data.gov.hk/v2/transport/kmb/eta/001140/2E');
    console.log('KMB ETA endpoint result:');
    console.log('Status:', etaResponse.status);
    console.log('Data:', etaResponse.data);
  } catch (etaError) {
    console.log('KMB ETA endpoint failed:', etaError.message);
    if (etaError.response) {
      console.log('Status:', etaError.response.status);
      if (etaError.response.data) {
        console.log('Response data:', etaError.response.data);
      }
    }
  }
  
  console.log('');
  
  // Let's try to get ALL routes regardless of company to see if we can discover the structure
  try {
    console.log('Testing general route endpoint...');
    // Some APIs have a general endpoint for all routes
    const generalResponse = await axios.get('https://rt.data.gov.hk/v2/transport/citybus/route');
    console.log('General route endpoint result:', generalResponse.data);
  } catch (generalError) {
    console.log('General route endpoint failed:', generalError.message);
  }
  
  console.log('\nTesting completed.');
}

testAlternativeAPI();