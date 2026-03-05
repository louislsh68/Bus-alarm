import Foundation
import ActivityKit
import SwiftUI

class LiveActivityManager: ObservableObject {
    @Published var activeActivities: [Activity<BusArrivalAttributes>] = []
    private var apiManager = APIManager()
    
    func startLiveActivity(routeNumber: String, stopName: String, direction: String) async {
        let initialContent = BusArrivalAttributes.ContentState(
            routeNumber: routeNumber,
            stopName: stopName,
            direction: direction,
            estimatedArrival: "Pending..."
        )
        
        let attributes = BusArrivalAttributes(name: "Bus Alarm")
        
        do {
            let activity = try Activity<BusArrivalAttributes>.request(
                attributes: attributes,
                contentState: initialContent,
                pushType: nil // We'll update via local timer/network calls
            )
            
            activeActivities.append(activity)
            
            print("Requested Live Activity with ID: \\(activity.id)")
            
            // Start a timer to periodically update the activity with mock arrival data
            await startUpdatingActivity(activity: activity, routeNumber: routeNumber, stopName: stopName, direction: direction)
            
        } catch {
            print("Error starting live activity: \\(error)")
        }
    }
    
    func endLiveActivity(_ activity: Activity<BusArrivalAttributes>) async {
        await activity.end(using: nil, dismissalPolicy: .immediate)
        activeActivities.removeAll { $0.id == activity.id }
    }
    
    private func startUpdatingActivity(activity: Activity<BusArrivalAttributes>, routeNumber: String, stopName: String, direction: String) async {
        // This simulates periodic updates. In a real app, you'd likely use a background task
        // or rely on push notifications from your backend to trigger updates.
        // For the prototype, we'll use a simple Timer-like mechanism within the app lifecycle.
        
        // For now, we'll just update the arrival time every 30 seconds with mock data.
        // This is a simplification for the prototype.
        Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { timer in
            Task {
                await self.updateLiveActivity(activity, routeNumber: routeNumber, stopName: stopName, direction: direction)
            }
        }
    }
    
    private func updateLiveActivity(_ activity: Activity<BusArrivalAttributes>, routeNumber: String, stopName: String, direction: String) async {
        apiManager.fetchArrivalTime(routeNumber: routeNumber, stopName: stopName, direction: direction) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let estimatedArrival):
                    let updatedContentState = BusArrivalAttributes.ContentState(
                        routeNumber: routeNumber,
                        stopName: stopName,
                        direction: direction,
                        estimatedArrival: estimatedArrival
                    )
                    
                    Task {
                        await activity.update(using: updatedContentState)
                        print("Updated Live Activity with new arrival time: \\(estimatedArrival)")
                    }
                case .failure(let error):
                    print("Error fetching arrival time for live activity update: \\(error)")
                    // Optionally update with an error message or last known time
                }
            }
        }
    }
}