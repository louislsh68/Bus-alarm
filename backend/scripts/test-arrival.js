
const TransportChecker = require('../services/transportChecker');

const testArrival = async () => {
  const companyId = 'KMB';
  const routeNumber = '2E';
  const stopName = 'Chinese Public Dispensary';

  console.log(`Testing arrival for: ${companyId} route ${routeNumber} at "${stopName}"`);

  // 1. Get Stop ID
  const stopId = await TransportChecker.getStopId(companyId, routeNumber, stopName);
  if (!stopId) {
    console.error("Could not find the stop ID. Please check the stop name.");
    // Let's try a common alternative name from the mock data, just in case.
    const alternativeStopName = "Sham Shui Po Med Ctr";
    console.log(`Trying alternative: "${alternativeStopName}"`);
    const alternativeStopId = await TransportChecker.getStopId(companyId, routeNumber, alternativeStopName);
    if(!alternativeStopId) {
         console.error("Could not find the stop ID for the alternative name either.");
         return;
    }
    console.log(`Found alternative stop ID: ${alternativeStopId}`);
    // 2. Get Arrival Time
    const arrivalData = await TransportChecker.getBusArrival(companyId, routeNumber, alternativeStopId);

    // 3. Display Results
    if (arrivalData && arrivalData.data && arrivalData.data.length > 0) {
        console.log("--- Arrival Times ---");
        arrivalData.data.forEach((eta, index) => {
            console.log(`Bus #${index + 1}:`);
            console.log(`  > ETA: ${eta.eta}`);
            console.log(`  > From: ${eta.dest_en}`);
            console.log(`  > Remarks: ${eta.rmk_en}`);
        });
        console.log("---------------------");
    } else {
        console.log("No arrival time data found for this stop.");
    }
    return;
  }

  console.log(`Found stop ID: ${stopId}`);

  // 2. Get Arrival Time
  const arrivalData = await TransportChecker.getBusArrival(companyId, routeNumber, stopId);

  // 3. Display Results
  if (arrivalData && arrivalData.data && arrivalData.data.length > 0) {
    console.log("--- Arrival Times ---");
    arrivalData.data.forEach((eta, index) => {
        console.log(`Bus #${index + 1}:`);
        console.log(`  > ETA: ${eta.eta}`);
        console.log(`  > From: ${eta.dest_en}`);
        console.log(`  > Remarks: ${eta.rmk_en}`);
    });
    console.log("---------------------");
  } else {
    console.log("No arrival time data found for this stop.");
  }
};

testArrival();
