# KMB eTransport Data Room API Specification

This document describes the API endpoints for accessing KMB (Kowloon Motor Bus) route and stop information from the eTransport Data Room.

## Base URL
```
https://data.etabus.gov.hk/v1/transport/kmb/
```

## API Endpoints

### 1. Get All Routes
**Endpoint:** `GET /route/`

**Description:** Retrieves the complete list of all KMB routes with their directions and destinations.

**Parameters:** None

**Response Format:**
```json
{
  "type": "RouteList",
  "version": "1.0",
  "generated_timestamp": "2026-02-05T13:39:02+08:00",
  "data": [
    {
      "route": "1",
      "bound": "O",
      "service_type": "1",
      "orig_en": "CHUK YUEN ESTATE",
      "orig_tc": "竹園邨",
      "orig_sc": "竹园邨",
      "dest_en": "STAR FERRY",
      "dest_tc": "尖沙咀碼頭",
      "dest_sc": "尖沙咀码头"
    }
  ]
}
```

**Fields:**
- `route`: Bus route number (string)
- `bound`: Direction ('O' for outbound, 'I' for inbound)
- `service_type`: Service type (typically 1 for regular service)
- `orig_*`: Origin location in different languages
- `dest_*`: Destination location in different languages

### 2. Get Route Stops
**Endpoint:** `GET /route-stop/{route}/{direction}/{service_type}`

**Description:** Retrieves the list of stops for a specific route in a particular direction.

**URL Parameters:**
- `{route}`: The bus route number (e.g., "1", "296C", "960")
- `{direction}`: Direction as text ('outbound' or 'inbound', not 'O' or 'I')
- `{service_type}`: Service type number (typically "1")

**Example:** `GET /route-stop/1/outbound/1`

**Response Format:**
```json
{
  "type": "RouteStop",
  "version": "1.0",
  "generated_timestamp": "2026-02-05T13:43:01+08:00",
  "data": [
    {
      "route": "1",
      "bound": "O",
      "service_type": "1",
      "seq": "1",
      "stop": "18492910339410B1"
    }
  ]
}
```

**Fields:**
- `route`: Bus route number
- `bound`: Direction ('O' for outbound, 'I' for inbound)
- `service_type`: Service type number
- `seq`: Stop sequence number (string) - indicates the order of stops
- `stop`: Unique stop ID used to get ETA information

### 3. Get Stop ETA (Estimated Time of Arrival)
**Endpoint:** `GET /stop-eta/{stop_id}`

**Description:** Retrieves the estimated arrival times for all buses at a specific stop.

**URL Parameters:**
- `{stop_id}`: The unique stop ID obtained from the route-stop endpoint

**Example:** `GET /stop-eta/18492910339410B1`

**Response Format:**
```json
{
  "type": "StopETA",
  "version": "1.0",
  "generated_timestamp": "2026-02-05T13:40:28+08:00",
  "data": [
    {
      "co": "KMB",
      "route": "1",
      "dir": "O",
      "service_type": 1,
      "seq": 1,
      "dest_tc": "尖沙咀碼頭",
      "dest_sc": "尖沙咀码头",
      "dest_en": "STAR FERRY",
      "eta_seq": 1,
      "eta": "2026-02-05T13:42:00+08:00",
      "rmk_tc": "原定班次",
      "rmk_sc": "原定班次",
      "rmk_en": "Scheduled Bus",
      "data_timestamp": "2026-02-05T13:40:16+08:00"
    }
  ]
}
```

**Fields:**
- `co`: Company code ('KMB' for Kowloon Motor Bus)
- `route`: Bus route number
- `dir`: Direction ('O' for outbound, 'I' for inbound)
- `service_type`: Service type number
- `seq`: Stop sequence number
- `dest_*`: Destination in different languages
- `eta_seq`: ETA sequence (order of upcoming buses)
- `eta`: Estimated arrival time in ISO 8601 format
- `rmk_*`: Remarks in different languages
- `data_timestamp`: Timestamp when the data was generated

### 4. Get Stop Details
**Endpoint:** `GET /stop/{stop_id}`

**Description:** Retrieves detailed information about a specific stop.

**URL Parameters:**
- `{stop_id}`: The unique stop ID

**Response Format:**
```json
{
  "type": "Stop",
  "version": "1.0",
  "generated_timestamp": "2026-02-05T13:39:21+08:00",
  "data": {
    "stop": "18492910339410B1",
    "name_en": "CHUK YUEN ESTATE BUS TERMINUS (WT916)",
    "name_tc": "竹園邨總站 (WT916)",
    "name_sc": "竹园邨总站 (WT916)",
    "lat": "22.345415",
    "long": "114.192640"
  }
}
```

## Common Issues and Solutions

1. **Invalid direction errors:** Use 'outbound'/'inbound' for route-stop endpoints, but 'O'/'I' for filtering ETA data
2. **Missing parameters:** Always include service_type in route-stop calls
3. **Rate limiting:** The API appears to be rate-limited; implement appropriate delays between requests

## Usage Notes

- The API does not require authentication or API keys
- Data is updated regularly (usually every few minutes)
- The `generated_timestamp` field indicates when the data was last refreshed
- Stop IDs are UUID-like strings that are unique identifiers for each physical bus stop
- Route data includes both regular and express services
- Service types: 1=regular, 2=express, 3=night services, etc.