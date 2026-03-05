import Foundation
import AuthenticationServices
import Combine

// MARK: - Data Models
struct User: Codable {
    let id: String
    let displayName: String
    let email: String
}

struct ScheduledTime: Codable, Identifiable {
    let id = UUID()
    let dayOfWeek: Int  // 0 = Sunday, 1 = Monday, etc.
    let hour: Int
    let minute: Int
}

struct Schedule: Codable, Identifiable {
    let id: String
    let userId: String
    var routeNumber: String
    var stopName: String
    var direction: String
    var companyId: String
    var scheduledTimes: [ScheduledTime]
    var isActive: Bool
}

// MARK: - ViewModel
class BusAlarmViewModel: ObservableObject {
    @Published var isLoggedIn = false
    @Published var userName = ""
    @Published var userId = ""
    @Published var schedules: [Schedule] = []
    
    private let backendURL = "http://localhost:5000" // Replace with your backend URL
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        // Initialize the view model
    }
    
    func checkLoginStatus() {
        // Check if we have a stored session/token
        // This would typically check UserDefaults or Keychain
        let storedUserId = UserDefaults.standard.string(forKey: "userId")
        let storedUserName = UserDefaults.standard.string(forKey: "userName")
        
        if let userId = storedUserId, let userName = storedUserName {
            self.userId = userId
            self.userName = userName
            self.isLoggedIn = true
            fetchSchedules()
        }
    }
    
    func loginWithGoogle() {
        // In a real implementation, this would redirect to your backend's Google auth endpoint
        // For now, simulate a successful login
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.simulateLoginSuccess()
        }
    }
    
    private func simulateLoginSuccess() {
        // Simulate successful login with mock data
        self.userId = "mock_user_id_123"
        self.userName = "Louis User"
        self.isLoggedIn = true
        
        // Store user info
        UserDefaults.standard.set(self.userId, forKey: "userId")
        UserDefaults.standard.set(self.userName, forKey: "userName")
        
        // Fetch schedules
        fetchSchedules()
    }
    
    func logout() {
        // Clear stored session
        UserDefaults.standard.removeObject(forKey: "userId")
        UserDefaults.standard.removeObject(forKey: "userName")
        
        // Reset state
        isLoggedIn = false
        userName = ""
        userId = ""
        schedules = []
    }
    
    // MARK: - Schedule Management
    
    func fetchSchedules() {
        guard isLoggedIn else { return }
        
        // In a real implementation, this would make a network call to your backend
        // For now, simulate with mock data
        let mockSchedules = [
            Schedule(
                id: "1",
                userId: userId,
                routeNumber: "2E",
                stopName: "Sham Shui Po Med Ctr",
                direction: "O",
                companyId: "KMB",
                scheduledTimes: [ScheduledTime(dayOfWeek: 1, hour: 8, minute: 30)], // Mon 8:30 AM
                isActive: true
            ),
            Schedule(
                id: "2",
                userId: userId,
                routeNumber: "12A",
                stopName: "Mong Kok",
                direction: "I",
                companyId: "CTB",
                scheduledTimes: [ScheduledTime(dayOfWeek: 1, hour: 17, minute: 45)], // Mon 5:45 PM
                isActive: true
            )
        ]
        
        DispatchQueue.main.async {
            self.schedules = mockSchedules
        }
    }
    
    func addSchedule(schedule: Schedule) {
        // In a real implementation, this would make a network call to your backend
        // For now, add to local array
        DispatchQueue.main.async {
            self.schedules.append(schedule)
        }
    }
    
    func updateSchedule(schedule: Schedule) {
        // In a real implementation, this would make a network call to your backend
        // For now, update local array
        DispatchQueue.main.async {
            if let index = self.schedules.firstIndex(where: { $0.id == schedule.id }) {
                self.schedules[index] = schedule
            }
        }
    }
    
    func deleteSchedule(id: String) {
        // In a real implementation, this would make a network call to your backend
        // For now, remove from local array
        DispatchQueue.main.async {
            self.schedules.removeAll { $0.id == id }
        }
    }
    
    // MARK: - Real-time Arrival Data
    
    func fetchArrivalData(for schedule: Schedule) -> AnyPublisher<[ArrivalData], Error> {
        // This would connect to your backend to get real-time arrival data
        // For now, return mock data
        let mockData = [
            ArrivalData(vehicleId: "12345", estimatedArrival: Date().addingTimeInterval(300), isScheduleAdhered: true),
            ArrivalData(vehicleId: "12346", estimatedArrival: Date().addingTimeInterval(600), isScheduleAdhered: true)
        ]
        
        return Just(mockData)
            .setFailureType(to: Error.self)
            .eraseToAnyPublisher()
    }
}

// MARK: - Arrival Data Model
struct ArrivalData: Codable {
    let vehicleId: String
    let estimatedArrival: Date
    let isScheduleAdhered: Bool
}