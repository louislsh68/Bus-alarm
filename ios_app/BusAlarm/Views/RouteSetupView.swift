import SwiftUI
import Combine

struct RouteSetupView: View {
    @State private var routeNumber = ""
    @State private var stops: [String] = [] // Fetched from API
    @State private var selectedStop = ""
    @State private var directions: [String] = [] // Fetched from API
    @State private var selectedDirection = ""
    @State private var scheduleTime = "08:00" // Example default
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var isSaving = false
    @State private var isFetching = false
    
    @StateObject private var apiManager = APIManager()
    
    // Using a placeholder user ID for the prototype
    let userId = "testuser_ios"

    var body: some View {
        VStack {
            Text("Set Up Your Bus Route")
                .font(.title)
                .padding()

            TextField("Enter Route Number (e.g., 123)", text: $routeNumber)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .padding()

            Button(action: fetchRouteDetails) {
                Text("Fetch Stops & Directions")
                    .padding()
                    .background(Color.orange)
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }
            .disabled(routeNumber.isEmpty || isLoading)
            .padding()

            if isLoading {
                ProgressView("Loading...")
                    .padding()
            }

            if !errorMessage.isEmpty {
                Text(errorMessage)
                    .foregroundColor(.red)
                    .padding()
            }

            if !stops.isEmpty {
                Text("Select Stop:")
                    .font(.headline)
                    .padding(.top)
                
                Picker("Stop", selection: $selectedStop) {
                    ForEach(stops, id: \.self) { stop in
                        Text(stop).tag(stop)
                    }
                }
                .pickerStyle(MenuPickerStyle())
                .padding(.horizontal)
            }

            if !directions.isEmpty {
                Text("Select Direction:")
                    .font(.headline)
                    .padding(.top)
                
                Picker("Direction", selection: $selectedDirection) {
                    ForEach(directions, id: \.self) { direction in
                        Text(direction).tag(direction)
                    }
                }
                .pickerStyle(MenuPickerStyle())
                .padding(.horizontal)
            }
            
            // Simple schedule input (HH:MM format)
            TextField("Schedule Time (HH:MM, e.g., 08:00)", text: $scheduleTime)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .padding()

            HStack {
                Button(action: saveSettingsToBackend) {
                    Text("Save to Backend")
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }
                .disabled(isSaving || selectedStop.isEmpty || selectedDirection.isEmpty)

                Button(action: loadSettingsFromBackend) {
                    Text("Load from Backend")
                        .padding()
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }
                .disabled(isFetching)
            }
            .padding()

            if isSaving {
                ProgressView("Saving...")
                    .padding()
            }
            
            if isFetching {
                ProgressView("Fetching...")
                    .padding()
            }

            Spacer()
        }
        .padding()
        .onAppear {
            // Load settings when the view appears
            loadSettingsFromBackend()
        }
    }

    func fetchRouteDetails() {
        isLoading = true
        errorMessage = ""
        stops = []
        directions = []

        apiManager.fetchRouteDetails(routeNumber: routeNumber) { result in
            DispatchQueue.main.async {
                isLoading = false
                switch result {
                case .success(let data):
                    stops = data.stops
                    directions = data.directions
                case .failure(let error):
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    func saveSettingsToBackend() {
        isSaving = true
        errorMessage = ""
        
        let settings: [String: Any] = [
            "schedule": [
                [
                    "time": scheduleTime,
                    "days": ["Mon", "Tue", "Wed", "Thu", "Fri"] // Example default
                ]
            ],
            "routes": [
                [
                    "route": routeNumber,
                    "stop": selectedStop,
                    "direction": selectedDirection
                ]
            ]
        ]
        
        apiManager.saveUserSettings(userId: userId, settings: settings) { result in
            DispatchQueue.main.async {
                isSaving = false
                switch result {
                case .success(let success):
                    if success {
                        print("Settings saved to backend successfully!")
                        errorMessage = "Settings saved to backend successfully!"
                    }
                case .failure(let error):
                    errorMessage = "Failed to save settings: \\(error.localizedDescription)"
                }
            }
        }
    }
    
    func loadSettingsFromBackend() {
        isFetching = true
        errorMessage = ""
        
        apiManager.fetchUserSettings(userId: userId) { result in
            DispatchQueue.main.async {
                isFetching = false
                switch result {
                case .success(let settings):
                    print("Settings loaded from backend: \\(settings)")
                    // Extract values from the fetched settings
                    if let scheduleArray = settings["schedule"] as? [[String: Any]],
                       let firstSchedule = scheduleArray.first,
                       let time = firstSchedule["time"] as? String {
                        self.scheduleTime = time
                    }
                    
                    if let routesArray = settings["routes"] as? [[String: Any]],
                       let firstRoute = routesArray.first,
                       let route = firstRoute["route"] as? String,
                       let stop = firstRoute["stop"] as? String,
                       let direction = firstRoute["direction"] as? String {
                        self.routeNumber = route
                        self.selectedStop = stop
                        self.selectedDirection = direction
                        // Fetch stops/directions again to populate the picker lists if needed
                        // Or assume the loaded values are valid if the route hasn't changed
                        // For simplicity in this prototype, we'll just assign them and assume they're valid
                        // A full implementation would re-fetch the stops/directions for the loaded route.
                        fetchRouteDetails() // This ensures the lists are populated for the loaded route
                    }
                    
                case .failure(let error):
                    // It's okay if no settings are found (first time user)
                    if (error as NSError).code == 404 {
                         print("No existing settings found for user \\(userId). This is expected for a new user.")
                         errorMessage = "No existing settings found. You can save new ones."
                    } else {
                        errorMessage = "Failed to load settings: \\(error.localizedDescription)"
                    }
                }
            }
        }
    }
}

struct RouteSetupView_Previews: PreviewProvider {
    static var previews: some View {
        RouteSetupView()
    }
}