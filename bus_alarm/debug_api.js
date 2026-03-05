const axios = require('axios');

const API_URL = 'https://data.etabus.gov.hk/v1/transport/kmb';

async function testApiCalls() {
  console.log('Testing various API formats...\n');
  
  // Test route-stop API with different formats
  const formats = [
    `${API_URL}/route-stop/1/1/O`,
    `${API_URL}/route-stop/1/1/I`, 
    `${API_URL}/route-stop/1/1/o`,
    `${API_URL}/route-stop/1/1/i`,
    `${API_URL}/route-stop/1/O`,
    `${API_URL}/route-stop/1/I`,
  ];
  
  for (const format of formats) {
    console.log(`Testing: ${format}`);
    try {
      const response = await axios.get(format);
      console.log(`✓ Success! Got ${response.data.data.length} stops\n`);
      break;
    } catch (error) {
      console.log(`✗ Failed: ${error.response?.data?.message || error.message}\n`);
    }
  }
  
  // Test stop-eta with a known stop
  console.log('Testing stop-eta API...');
  try {
    const response = await axios.get(`${API_URL}/stop-eta/18492910339410B1`);
    console.log(`✓ Stop ETA success! Got ${response.data.data.length} ETAs\n`);
  } catch (error) {
    console.log(`✗ Stop ETA failed: ${error.response?.data?.message || error.message}\n`);
  }
  
  console.log('Testing completed.');
}

testApiCalls();