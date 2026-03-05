import SwiftUI
import ActivityKit

struct LiveActivityManagerView: View {
    @StateObject private var liveActivityManager = LiveActivityManager()
    @State private var simulatedArrivalTime = "5 min"
    
    // Example route details (in a real app, these would come from user input or saved settings)
    let exampleRouteNumber = "123"
    let exampleStopName = "Mong Kok"
    let exampleDirection = "Airport"
    
    var body: some View {
        VStack {
            Text("Live Activity Manager")
                .font(.title)
                .padding()

            if !liveActivityManager.activeActivities.isEmpty {
                Text("Live Activity is Active!")
                    .foregroundColor(.green)
                    .padding()
                
                Button(action: endLiveActivity) {
                    Text("End Live Activity")
                        .padding()
                        .background(Color.red)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }
            } else {
                Text("No Live Activity Running")
                    .foregroundColor(.red)
                    .padding()
                
                Button(action: startLiveActivity) {
                    Text("Start Live Activity")
                        .padding()
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }
            }

            // Simulate updating arrival time
            Stepper(value: .constant(0), step: 1) {
                Text("Simulate Arrival Time: \(simulatedArrivalTime)")
            }
            .padding()

            Button(action: updateLiveActivity) {
                Text("Update Live Activity")
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }
            .disabled(liveActivityManager.activeActivities.isEmpty)

            Spacer()
        }
        .padding()
    }

    func startLiveActivity() {
        Task {
            await liveActivityManager.startLiveActivity(
                routeNumber: exampleRouteNumber,
                stopName: exampleStopName,
                direction: exampleDirection
            )
        }
    }

    func endLiveActivity() {
        Task {
            if let activity = liveActivityManager.activeActivities.first {
                await liveActivityManager.endLiveActivity(activity)
            }
        }
    }

    func updateLiveActivity() {
        // In the prototype, updates are handled automatically by the LiveActivityManager
        // whenever the timer ticks or new data arrives from the API.
        // This button is kept for UI consistency but doesn't trigger an immediate update itself.
        print("Update button pressed. Actual update handled by timer/API polling.")
    }
}

struct LiveActivityManagerView_Previews: PreviewProvider {
    static var previews: some View {
        LiveActivityManagerView()
    }
}