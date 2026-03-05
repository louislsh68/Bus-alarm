# KMB Routes Summary

## Overview
- Total unique routes: 805
- Total route instances (with different bounds/service types): 1,608
- Most common service type: 1 (1,322 routes)
- Available directions: I (Inbound), O (Outbound)

## Service Types Distribution
- Service Type 1: 1,322 routes (most common)
- Service Type 2: 180 routes
- Service Type 3: 71 routes
- Service Type 4: 16 routes
- Service Type 5: 11 routes
- Service Type 6: 5 routes
- Service Type 7: 1 route
- Service Type 9: 2 routes

## Sample Routes
1. **Route 1**: CHUK YUEN ESTATE ↔ STAR FERRY
2. **Route 1A**: STAR FERRY ↔ SAU MAU PING (CENTRAL)
3. **Route 2**: STAR FERRY ↔ CHEUNG SHA WAN (SO UK ESTATE)
4. **Route 2A**: LOK WAH ↔ MEI FOO
5. **Route 2B**: CHEUNG SHA WAN ↔ CHUK YUEN ESTATE
6. **Route 2D**: WONG TAI SIN ↔ CHAK ON ESTATE
7. **Route 2E**: KOWLOON CITY FERRY ↔ PAK TIN (NORTH)
8. **Route 2F**: CHEUNG SHA WAN ↔ TSZ WAN SHAN (NORTH)
9. **Route 2P**: CHEUNG SHA WAN ↔ TSZ WAN SHAN (NORTH) (Outbound only)
10. **Route 2X**: MEI FOO ↔ CHOI FOOK

## Popular Routes
Some of the most commonly used routes in Hong Kong:
- Routes 1-11: Core urban routes
- Routes 12-99: Major urban routes
- Routes 100+: Express and special routes
- Routes with letters (e.g., 2A, 2B, etc.): Variant routes
- Routes starting with N (e.g., N1, N2): Night routes

## Directions
- **O** (Outbound): Typically from urban centers to suburbs
- **I** (Inbound): Typically from suburbs to urban centers

## Using Routes with Bus Alarm System
To configure the bus alarm system for any route:
1. Set BUS_ROUTE to the desired route number (e.g., "1", "960", "2A")
2. Set DIRECTION to "O" or "I" (which maps to "outbound" or "inbound" in API calls)
3. Find appropriate STOP_CODE by checking route stops via the API
4. Adjust ALARM_THRESHOLD_MINUTES as needed

Note: The bus alarm system works with all 805 routes in the KMB network.