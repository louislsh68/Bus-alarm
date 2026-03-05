# Bus Alarm Configuration Examples

This file provides examples of different bus routes and stops you can monitor with the Bus Alarm system.

## Popular Routes to/from Sheung Wan/Tsim Sha Tsui

### Route 960 (Tuen Mun -> Central)
- Direction O (Outbound): Tuen Mun -> Central
- Direction I (Inbound): Central -> Tuen Mun
- Typical stop codes: 461, 462

### Route 968 (Yuen Long -> Causeway Bay)
- Direction O: Yuen Long -> Causeway Bay  
- Direction I: Causeway Bay -> Yuen Long

### Route 260X (Tuen Mun -> Mong Kok)
- Direction O: Tuen Mun -> Mong Kok
- Direction I: Mong Kok -> Tuen Mun

### Route N368 (Night Bus - Yuen Long -> Hung Hom)
- Direction O: Yuen Long -> Hung Hom
- Direction I: Hung Hom -> Yuen Long

## How to Find Stop Codes

To find the right stop code for your location:

1. Use the KMB API to get route stops:
   ```
   GET https://data.etabus.gov.hk/v1/transport/kmb/route-stop/{route}/{direction}
   ```

2. Look for stops near your location and note the `stop_seq` number

3. Update your `.env` file with the route and stop sequence

## Sample .env configurations

### For Tuen Mun to Central (Route 960)
```env
BUS_ROUTE=960
STOP_CODE=1
DIRECTION=O
ALARM_THRESHOLD_MINUTES=5
```

### For Central to Tuen Mun (Route 960)
```env
BUS_ROUTE=960
STOP_CODE=1
DIRECTION=I
ALARM_THRESHOLD_MINUTES=5
```

### Working Example (Route 1 - Tested)
```env
BUS_ROUTE=1
STOP_CODE=1
DIRECTION=O
ALARM_THRESHOLD_MINUTES=5
```

### For Yuen Long to Mong Kok (Route 260X)
```env
BUS_ROUTE=260X
STOP_CODE=123
DIRECTION=O
ALARM_THRESHOLD_MINUTES=7
```

## Finding Your Stop

The easiest way to find your stop code is:

1. Go to the [KMB Journey Planner](https://journeyplanner.kmb.hk/)
2. Enter your start/end points
3. Note the route and stops
4. Use the API to get the exact stop_seq numbers for that route

Example API call to find stops for a route:
```
curl "https://data.etabus.gov.hk/v1/transport/kmb/route-stop/960/O"
```