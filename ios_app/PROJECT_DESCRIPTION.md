# Bus Alarm iOS App Prototype

This is a basic iOS app prototype built with SwiftUI and Xcode.

## Project Structure

```
BusAlarm/
├── Assets.xcassets/
├── Preview Content/
│   └── Preview Assets.xcassets/
├── Models/
│   └── BusArrivalAttributes.swift
├── Services/
│   ├── APIManager.swift
│   └── LiveActivityManager.swift
├── Views/
│   ├── ContentView.swift
│   ├── RouteSetupView.swift
│   └── LiveActivityManagerView.swift
├── BusAlarmApp.swift
├── Info.plist
└── ...
```

## Key Components

1.  **BusAlarmApp.swift**: The main entry point for the app.
2.  **ContentView.swift**: The main navigation view.
3.  **RouteSetupView.swift**: Allows users to input route, stop, and direction.
4.  **LiveActivityManagerView.swift**: Manages the Live Activity lifecycle.
5.  **BusArrivalAttributes.swift**: Defines the data structure for the Live Activity.
6.  **APIManager.swift**: Handles communication with the local backend and mock KMB/Citybus APIs.
7.  **LiveActivityManager.swift**: Handles the `ActivityKit` interactions.
8.  **Info.plist**: Contains app configuration, including Live Activity setup.

## Live Activity Setup (Important!)

To enable Live Activity, ensure the following is configured in your Xcode project:

1.  **Target Membership**: Ensure `BusArrivalAttributes.swift` is added to the main App target AND an App Extension target (usually named `<AppName> Live Activity Extension`). If the extension doesn't exist, create one using Xcode's template (App / Widget Extension / Live Activity).
2.  **Info.plist**: The Live Activity Extension target's `Info.plist` needs specific keys defining the supported activities.

Example for the Live Activity Extension's `Info.plist`:
```
<key>NSExtension</key>
<dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
</dict>
```

## How to Run

1.  Open this project in Xcode.
2.  Ensure the iOS Simulator or a physical device is selected as the target.
3.  Build and run the project.
4.  Interact with the UI to set up a route and trigger the Live Activity.
5.  Ensure the backend server (running on localhost:3000) is active for the API calls to work.