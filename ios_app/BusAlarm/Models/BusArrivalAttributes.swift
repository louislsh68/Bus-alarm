import Foundation
import ActivityKit

// Define the data structure for the Live Activity
struct BusArrivalAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // These properties will be displayed in the Live Activity
        var routeNumber: String
        var stopName: String
        var direction: String
        var estimatedArrival: String // e.g., "5 min", "Arrived"
    }

    var name: String
}