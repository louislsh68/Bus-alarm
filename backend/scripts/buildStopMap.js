
const fs = require('fs');
const path = require('path');

const routeFareListPath = path.join(__dirname, '..', '..', 'route_fare_list.json');
const outputPath = path.join(__dirname, '..', 'data', 'routeStopMap.json');

console.log(`Reading data from: ${routeFareListPath}`);

fs.readFile(routeFareListPath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading file: ${err}`);
    return;
  }

  try {
    console.log('Parsing JSON data...');
    const fullData = JSON.parse(data);
    const { routeList, stopList, stopMap: originalStopMap } = fullData;

    if (!routeList || !stopList || !originalStopMap) {
      console.error('`routeList`, `stopList`, or `stopMap` not found.');
      return;
    }

    console.log('Building the route-stop map...');
    const finalMap = {};

    // Iterate over each route defined in the routeList
    for (const routeKey in routeList) {
      const routeInfo = routeList[routeKey];
      const company = routeInfo.co[0];
      const routeNumber = routeKey.split('+')[0];

      if (!company || !routeNumber) continue;

      if (!finalMap[company]) {
        finalMap[company] = {};
      }
      if (!finalMap[company][routeNumber]) {
        finalMap[company][routeNumber] = {};
      }

      // Find the stops for this route in the separate stopMap object
      const routeStopIds = originalStopMap[routeKey];
      if (routeStopIds) {
          for (const direction in routeStopIds) {
              const stopIds = routeStopIds[direction];
              for (const stopId of Object.keys(stopIds)) {
                const stopDetails = stopList[stopId];
                if (stopDetails && stopDetails.en) {
                    finalMap[company][routeNumber][stopDetails.en] = stopId;
                }
              }
          }
      }
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(finalMap, null, 2));
    console.log(`✅ Successfully built and saved the new, correct map to ${outputPath}`);

  } catch (parseErr) {
    console.error(`Error processing JSON: ${parseErr}`);
  }
});
