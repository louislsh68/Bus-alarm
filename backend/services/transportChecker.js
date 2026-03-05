const axios = require('axios');
const Schedule = require('../models/Schedule');
const { stopMap } = require('../data/loader'); // <-- Use the destructured stopMap

class TransportChecker {
  constructor() {
    this.apiBaseUrl = 'https://rt.data.gov.hk/v2/transport';
    this.routeStopMap = stopMap; // <-- CORRECT: Assign the destructured stopMap to instance
  }

  async getStopId(companyId, routeNumber, stopName) {
    try {
      // First, try to get the stop ID from our local map
      const localStopMap = this.routeStopMap[companyId]?.[routeNumber];
      if (localStopMap) {
        // Look for exact match first
        if (localStopMap[stopName]) {
          return localStopMap[stopName];
        }
        
        // Look for partial match in keys (stop names)
        const stopKeys = Object.keys(localStopMap);
        const exactMatch = stopKeys.find(key => key.toLowerCase() === stopName.toLowerCase());
        if (exactMatch) {
          return localStopMap[exactMatch];
        }
        
        // Look for partial matches
        const partialMatch = stopKeys.find(key => 
          key.toLowerCase().includes(stopName.toLowerCase()) || 
          stopName.toLowerCase().includes(key.toLowerCase())
        );
        if (partialMatch) {
          console.log(`Found partial match: ${partialMatch} for requested stop: ${stopName}`);
          return localStopMap[partialMatch];
        }
      }

      // If not found locally, fetch from API using route-stop endpoint with both directions
      try {
        const directions = ['inbound', 'outbound'];
        for (const direction of directions) {
          const routeStopUrl = `${this.apiBaseUrl}/citybus/route-stop/${companyId}/${routeNumber}/${direction}`;
          console.log(`Fetching route-stop data from: ${routeStopUrl}`);
          
          const response = await axios.get(routeStopUrl);
          const routeStops = response.data.data || [];
          
          // Find the stop by name in the route data
          const stop = routeStops.find(stop => 
            stop.stop.includes(stopName) || 
            stop.stop.toLowerCase().includes(stopName.toLowerCase()) ||
            stop.seq.toString() === stopName
          );
          
          if (stop) {
            console.log(`Found stop ID ${stop.stop} for ${companyId} route ${routeNumber} at "${stopName}" in direction ${direction}`);
            return stop.stop;
          }
        }
      } catch (apiError) {
        console.warn(`Could not fetch route-stop data from API for ${companyId} route ${routeNumber}:`, apiError.message);
      }
      
      console.warn(`Stop ID not found for ${companyId} route ${routeNumber} at "${stopName}"`);
      return null;
    } catch (error) {
      console.error(`Error looking up stop ID for ${companyId} R:${routeNumber} S:${stopName}`, error);
      return null;
    }
  }

  async getBusArrival(companyId, routeNumber, stopName) {
    try {
      const stopId = await this.getStopId(companyId, routeNumber, stopName); // <-- Look up the ID internally (async now)
      if (!stopId) {
          throw new Error(`Stop ID could not be found for stop name: ${stopName}`)
      }

      let url;
      const formattedCompanyId = companyId.toLowerCase();
      if (companyId === 'CTB' || companyId === 'NWFB') {
        url = `${this.apiBaseUrl}/citybus/eta/${formattedCompanyId}/${stopId}/${routeNumber}`;
      } else if (companyId === 'KMB') {
        url = `${this.apiBaseUrl}/kmb/eta/${stopId}/${routeNumber}`;
      } else if (companyId === 'MTR') {
        // Handle MTR if needed
        url = `${this.apiBaseUrl}/mtr/eta/${formattedCompanyId}/${stopId}/${routeNumber}`;
      }
      
      if (!url) {
        throw new Error(`Unsupported company ID: ${companyId}`);
      }
      
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching bus arrival for ${companyId} route ${routeNumber} at stop ${stopName} (stopId: ${stopName}):`, error.message);
      return null;
    }
  }

  async determineCompanyId(routeNumber, stopName) {
    // Check in order of priority/common usage
    if (this.routeStopMap['CTB']?.[routeNumber]) {
      return 'CTB';
    }
    if (this.routeStopMap['NWFB']?.[routeNumber]) {
      return 'NWFB';
    }
    if (this.routeStopMap['KMB']?.[routeNumber]) {
      return 'KMB';
    }
    if (this.routeStopMap['MTR']?.[routeNumber]) {
      return 'MTR';
    }
    console.warn(`Company ID for route ${routeNumber} not found in map. Defaulting to KMB.`);
    return 'KMB';
  }

  async checkAllSchedules() {
    try {
      const schedules = await Schedule.find({ isActive: true }).populate('userId');
      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      for (const schedule of schedules) {
        const matchedTime = schedule.scheduledTimes.find(time => 
          time.dayOfWeek === currentDay && 
          time.hour === currentHour && 
          time.minute === currentMinute
        );
        
        if (matchedTime) {
          await this.processScheduleTrigger(schedule);
        }
      }
    } catch (error) {
      console.error('Error checking schedules:', error);
    }
  }

  async processScheduleTrigger(schedule) {
    try {
      const arrivalData = await this.getBusArrival(schedule.companyId, schedule.routeNumber, schedule.stopName);
      console.log(`Arrival data for ${schedule.companyId} route ${schedule.routeNumber} at ${schedule.stopName}:`, arrivalData);
    } catch (error) {
      console.error('Error processing schedule trigger:', error);
    }
  }

  startScheduleChecker() {
    console.log('Starting schedule checker...');
    setInterval(() => this.checkAllSchedules(), 60000);
    this.checkAllSchedules();
  }
}

module.exports = new TransportChecker();
