import Foundation

class APIManager: ObservableObject {
    // Base URL for our local backend prototype
    private let backendBaseURL = "http://localhost:3000" // Change this if your backend runs on a different port/IP

    // MARK: - Backend API Functions
    
    // Function to save user settings to the backend
    func saveUserSettings(userId: String, settings: [String: Any], completion: @escaping (Result<Bool, Error>) -> Void) {
        guard let url = URL(string: "\\(backendBaseURL)/api/users/\\(userId)/settings") else {
            completion(.failure(NSError(domain: "APIManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: settings)
        } catch {
            completion(.failure(error))
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
                completion(.failure(NSError(domain: "APIManager", code: (response as? HTTPURLResponse)?.statusCode ?? -1, userInfo: [NSLocalizedDescriptionKey: "Server error"])))
                return
            }
            
            // Assuming success if we get a 2xx response
            completion(.success(true))
        }.resume()
    }
    
    // Function to fetch user settings from the backend
    func fetchUserSettings(userId: String, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        guard let url = URL(string: "\\(backendBaseURL)/api/users/\\(userId)/settings") else {
            completion(.failure(NSError(domain: "APIManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
                // If 404, it means no settings found, which is not necessarily an error for fetching
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 404 {
                     completion(.failure(NSError(domain: "APIManager", code: 404, userInfo: [NSLocalizedDescriptionKey: "No settings found for user \\(userId)"])))
                     return
                }
                completion(.failure(NSError(domain: "APIManager", code: (response as? HTTPURLResponse)?.statusCode ?? -1, userInfo: [NSLocalizedDescriptionKey: "Server error"])))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "APIManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "No data received"])))
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    completion(.success(json))
                } else {
                    completion(.failure(NSError(domain: "APIManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON format"])))
                }
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    // MARK: - KMB/Citybus API Functions (Mocked for Prototype)
    
    // Mock function to fetch route details
    // In a real implementation, you would replace this with actual network calls
    func fetchRouteDetails(routeNumber: String, completion: @escaping (Result<(stops: [String], directions: [String]), Error>) -> Void) {
        
        // Simulate network delay
        DispatchQueue.global(qos: .background).async {
            sleep(1) // Simulate API call delay
            
            DispatchQueue.main.async {
                // Mock data based on route number
                let stops: [String]
                let directions: [String]
                
                switch routeNumber {
                case "123":
                    stops = ["Airport", "Tsing Yi", "Lai King", "Mei Foo", "Prince Edward", "Mong Kok", "Tai Kok Tsui", "Cheung Sha Wan", "Shek Kip Mei", "Yau Ma Tei", "Jordan", "Tsim Sha Tsui"]
                    directions = ["Tsim Sha Tsui", "Airport"]
                case "234":
                    stops = ["Star Ferry", "Exchange Square", "IFC Mall", "MTR Central Station", "Legislative Council", "Harbour City", "Clock Tower"]
                    directions = ["Clock Tower", "Star Ferry"]
                default:
                    stops = []
                    directions = []
                }
                
                if stops.isEmpty {
                    completion(.failure(NSError(domain: "APIManager", code: 404, userInfo: [NSLocalizedDescriptionKey: "Route \\(routeNumber) not found"])))
                } else {
                    completion(.success((stops: stops, directions: directions)))
                }
            }
        }
    }
    
    // Mock function to fetch arrival time
    // In a real implementation, you would replace this with actual network calls
    func fetchArrivalTime(routeNumber: String, stopName: String, direction: String, completion: @escaping (Result<String, Error>) -> Void) {
        
        // Simulate network delay
        DispatchQueue.global(qos: .background).async {
            sleep(1) // Simulate API call delay
            
            DispatchQueue.main.async {
                // Mock arrival time based on route, stop, and direction
                let estimatedArrival: String
                
                // This is a very simplified mock - real API would return dynamic data
                if routeNumber == "123" && stopName == "Mong Kok" && direction == "Airport" {
                    estimatedArrival = "3 min"
                } else if routeNumber == "234" && stopName == "Clock Tower" && direction == "Star Ferry" {
                    estimatedArrival = "Arrived"
                } else {
                    estimatedArrival = "\\(Int.random(in: 1...10)) min"
                }
                
                completion(.success(estimatedArrival))
            }
        }
    }
}