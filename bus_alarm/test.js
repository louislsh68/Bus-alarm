// Test script for Bus Alarm system
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testBusAlarm() {
  console.log('Testing Bus Alarm System...\n');
  
  try {
    // Test root endpoint
    console.log('1. Testing root endpoint...');
    const rootResponse = await axios.get(`${BASE_URL}/`);
    console.log('✓ Server is running');
    console.log(`  Status: ${rootResponse.data.message}`);
    console.log(`  Route: ${rootResponse.data.route}\n`);
    
    // Test bus check endpoint
    console.log('2. Testing bus check endpoint...');
    const busResponse = await axios.get(`${BASE_URL}/api/check-bus`);
    console.log('✓ Bus status retrieved');
    console.log(`  Active alarms: ${busResponse.data.activeAlarms.length}`);
    console.log(`  Bus status: ${JSON.stringify(busResponse.data.busStatus, null, 2)}\n`);
    
    // Test alarms endpoint
    console.log('3. Testing alarms endpoint...');
    const alarmsResponse = await axios.get(`${BASE_URL}/api/alarms`);
    console.log('✓ Alarms retrieved');
    console.log(`  Number of alarms: ${alarmsResponse.data.length}\n`);
    
    console.log('All tests passed! 🚌');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testBusAlarm();