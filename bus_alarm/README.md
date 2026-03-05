# Bus Alarm System

A real-time bus arrival notification system for Hong Kong KMB buses using the eTransport Data Room API.

## Features

- Real-time monitoring of bus arrival times
- Automatic alarm when bus is approaching
- Web interface to monitor status
- Configurable routes, stops, and thresholds

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your bus route and stop in `.env`:
```env
BUS_ROUTE=960          # Bus route number
STOP_CODE=461          # Stop sequence number
DIRECTION=O            # O=outbound, I=inbound
ALARM_THRESHOLD_MINUTES=5  # Alarm when bus is within X minutes
```

3. Start the application:
```bash
npm start
```

## Usage

- Visit `http://localhost:3000` to see the system status
- Check bus status: `GET /api/check-bus`
- View active alarms: `GET /api/alarms`
- Clear alarms: `DELETE /api/alarms`

## API Endpoints

- `GET /` - System status
- `GET /api/check-bus` - Check current bus status
- `GET /api/alarms` - Get active alarms
- `DELETE /api/alarms` - Clear all alarms
- `POST /api/refresh-routes` - Manually refresh route information
- `DELETE /api/routes-cache` - Clear route cache
- `GET /api/routes-info` - Get cached route information

## Configuration

To find the correct stop codes and routes, you can use the KMB API endpoints:
- `/route/${route_no}/${service_type}` - Get route details
- `/route-stop/${route_no}/${direction}/${service_type}` - Get stops for a route
  - Note: direction should be 'outbound' or 'inbound' (not 'O' or 'I')
  - service_type is typically '1'

The system will automatically map 'O' to 'outbound' and 'I' to 'inbound' when making API calls.

## Daily Route Information Refresh

The system automatically fetches the latest route and stop information daily to ensure accuracy. This ensures that any changes to bus routes or stops are reflected in the system without requiring manual intervention. The route information is cached and refreshed approximately every 24 hours, but can also be manually refreshed using the API endpoints.

### Finding Stop Sequences

Use the `find_stops.js` script to discover stop sequences for any route:

```bash
node find_stops.js <route_number> [direction] [service_type]
```

Example:
```bash
node find_stops.js 1 outbound 1
```

This will show all stops for route 1 in the outbound direction with their sequence numbers and names.

## Available Routes

The system works with all 805 KMB routes. Check `KMB_ROUTES_SUMMARY.md` for a complete overview of available routes.

## API Specifications

Check `API_SPECIFICATION.md` for complete technical documentation of the KMB eTransport Data Room API endpoints used by this system.