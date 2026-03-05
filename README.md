# Bus Alarm iOS App

An iOS application that allows users to set bus arrival alarms for Hong Kong public transportation, with real-time arrival information displayed in Live Activities.

## Project Structure

```
backend/
├── app.js                 # Main server entry point
├── server.js              # Server configuration
├── .env                   # Environment variables
├── package.json           # Dependencies
├── config/
│   └── passport.js        # Google OAuth strategy
├── models/
│   ├── User.js            # User model
│   └── Schedule.js        # Schedule model
├── routes/
│   ├── auth.js            # Authentication routes
│   └── api.js             # API routes
├── middleware/
│   └── auth.js            # Authentication middleware
└── services/
    └── transportChecker.js # Transport data checker
ios/
├── BustAlarm/
│   ├── App.swift          # App entry point
│   ├── ContentView.swift  # Main UI
│   ├── ViewModel.swift    # Data management
│   ├── Info.plist         # App configuration
│   └── Assets.xcassets    # Asset catalog
└── BustAlarm.xcodeproj    # Xcode project
```

## Features

### Backend
- Google OAuth authentication
- User management with MongoDB
- Schedule storage and retrieval
- Integration with DATA.GOV.HK transport API
- Scheduled checker for real-time arrival data
- Improved company ID detection logic

### iOS Frontend
- Google sign-in integration
- Dashboard to view current alarms
- Form to add new bus alarms
- Display of scheduled routes and times
- Simulated real-time arrival data

## Setup Instructions

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your configuration:
   ```
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/busalarm
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   SESSION_SECRET=your_session_secret_here
   FRONTEND_URL=http://localhost:3000
   ```

4. Run the server:
   ```bash
   npm start
   ```

### iOS Setup
1. Open the project in Xcode:
   ```bash
   open ios/BustAlarm.xcodeproj
   ```

2. Build and run the project

## API Endpoints

- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Handle Google OAuth callback
- `GET /auth/logout` - Logout user
- `GET /api/schedules` - Get user schedules
- `POST /api/schedules` - Create new schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule
- `GET /api/bus-arrival/:companyId/:routeNumber/:stopName/:direction` - Get real-time arrival data

## Company ID Detection Logic

The system uses improved logic to distinguish between CTB and KMB routes:

1. First checks if the route/stop/direction combination exists in CTB static map
2. Then checks KMB static map if not found in CTB
3. Falls back to heuristic pattern matching if both fail
4. Maintains a list of common CTB routes that might conflict with KMB

## Data Sources

- Real-time transport data from DATA.GOV.HK API
- Static route/stop mapping (would be populated with actual data)

## Next Steps

1. Implement the actual DATA.GOV.HK API integration in the transport checker
2. Complete the iOS Live Activities integration
3. Add push notification support
4. Implement proper stop ID mapping for accurate arrival data
5. Add error handling and validation