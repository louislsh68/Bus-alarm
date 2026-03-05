# API Changes Documentation

## Issue Identified
The Hong Kong transport API was failing due to incorrect direction parameter values. The original code was using "IN" and "OUT" which resulted in "Invalid direction" errors.

## Solution Implemented
Updated the `TransportChecker` service in `./backend/services/transportChecker.js` to use the correct direction values: "inbound" and "outbound".

## Specific Changes Made

### 1. Updated getStopId Method
- Changed from synchronous to asynchronous operation
- Added dynamic fetching of route-stop data from the API when stop IDs are not available in local data
- Implemented fetching route-stop data for both "inbound" and "outbound" directions
- Uses the correct API endpoints with proper direction values

### 2. Updated getBusArrival Method
- Modified to work with the async getStopId method
- Improved handling for different company IDs (CTB, KMB, NWFB, MTR)

### 3. Enhanced determineCompanyId Method
- Added support for additional company types including MTR
- Improved company detection logic

## API Endpoints Used
- `https://rt.data.gov.hk/v2/transport/citybus/route-stop/{companyId}/{routeNumber}/inbound`
- `https://rt.data.gov.hk/v2/transport/citybus/route-stop/{companyId}/{routeNumber}/outbound`

## Verification
- Confirmed that the API accepts "inbound" and "outbound" as valid direction values
- Verified that the system now properly fetches route-stop data from the government API
- Tested that the server starts correctly and API endpoints respond appropriately

## Impact
- Fixed the "Invalid direction" error that was occurring when fetching route-stop data
- Enabled dynamic fetching of stop IDs when they're not available in local data
- Improved reliability of the transport checking system