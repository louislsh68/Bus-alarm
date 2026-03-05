import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = BusAlarmViewModel()
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Bus Alarm")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                if viewModel.isLoggedIn {
                    DashboardView(viewModel: viewModel)
                } else {
                    LoginView(viewModel: viewModel)
                }
            }
            .padding()
            .onAppear {
                viewModel.checkLoginStatus()
            }
        }
    }
}

struct LoginView: View {
    @ObservedObject var viewModel: BusAlarmViewModel
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Welcome to Bus Alarm")
                .font(.title2)
            
            Button(action: {
                viewModel.loginWithGoogle()
            }) {
                HStack {
                    Image(systemName: "globe")
                        .foregroundColor(.white)
                    
                    Text("Sign in with Google")
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .cornerRadius(10)
            }
        }
    }
}

struct DashboardView: View {
    @ObservedObject var viewModel: BusAlarmViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack {
                Text("Welcome, \(viewModel.userName)")
                    .font(.headline)
                
                Spacer()
                
                Button("Logout") {
                    viewModel.logout()
                }
                .foregroundColor(.red)
            }
            
            Text("Your Bus Alarms")
                .font(.title2)
                .fontWeight(.semibold)
            
            if viewModel.schedules.isEmpty {
                Text("No alarms set yet")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(viewModel.schedules, id: \.id) { schedule in
                    ScheduleRowView(schedule: schedule)
                }
            }
            
            Spacer()
            
            NavigationLink(destination: AddScheduleView(viewModel: viewModel)) {
                Text("Add New Alarm")
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(10)
            }
        }
    }
}

struct ScheduleRowView: View {
    let schedule: Schedule
    
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text("\(schedule.companyId) - \(schedule.routeNumber)")
                    .font(.headline)
                Spacer()
                if schedule.isActive {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 10, height: 10)
                } else {
                    Circle()
                        .fill(Color.gray)
                        .frame(width: 10, height: 10)
                }
            }
            
            Text("Stop: \(schedule.stopName)")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            Text("Direction: \(schedule.direction)")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            Text("Scheduled: \(formattedScheduleTimes(schedule.scheduledTimes))")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 5)
    }
    
    private func formattedScheduleTimes(_ times: [ScheduledTime]) -> String {
        return times.map { time in
            let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            return "\(days[time.dayOfWeek]) \(String(format: "%02d:%02d", time.hour, time.minute))"
        }.joined(separator: ", ")
    }
}

struct AddScheduleView: View {
    @ObservedObject var viewModel: BusAlarmViewModel
    @Environment(\.presentationMode) var presentationMode
    
    @State private var routeNumber = ""
    @State private var stopName = ""
    @State private var direction = ""
    @State private var companyId = "CTB"
    @State private var selectedDay: Int = 0
    @State private var hour = 8
    @State private var minute = 0
    
    let companies = ["CTB", "KMB", "NWFB", "NLB"]
    let directions = ["O", "I"] // Outbound, Inbound
    let daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    
    var body: some View {
        Form {
            Section(header: Text("Route Information")) {
                Picker("Company", selection: $companyId) {
                    ForEach(companies, id: \.self) { company in
                        Text(company).tag(company)
                    }
                }
                
                TextField("Route Number", text: $routeNumber)
                TextField("Stop Name", text: $stopName)
                Picker("Direction", selection: $direction) {
                    ForEach(directions, id: \.self) { dir in
                        Text(dir).tag(dir)
                    }
                }
            }
            
            Section(header: Text("Schedule Time")) {
                Picker("Day", selection: $selectedDay) {
                    ForEach(0..<7, id: \.self) { index in
                        Text(daysOfWeek[index]).tag(index)
                    }
                }
                
                DatePicker(
                    "Time",
                    selection: Binding<Date>(
                        get: { 
                            let calendar = Calendar.current
                            var components = calendar.dateComponents([.year, .month, .day], from: Date())
                            components.hour = hour
                            components.minute = minute
                            return calendar.date(from: components) ?? Date()
                        },
                        set: { date in
                            let calendar = Calendar.current
                            hour = calendar.component(date, component: .hour)
                            minute = calendar.component(date, component: .minute)
                        }
                    ),
                    displayedComponents: [.hourAndMinute]
                )
            }
            
            Section {
                Button("Save Alarm") {
                    let newSchedule = Schedule(
                        id: UUID().uuidString,
                        userId: viewModel.userId,
                        routeNumber: routeNumber,
                        stopName: stopName,
                        direction: direction,
                        companyId: companyId,
                        scheduledTimes: [ScheduledTime(dayOfWeek: selectedDay, hour: hour, minute: minute)],
                        isActive: true
                    )
                    
                    viewModel.addSchedule(schedule: newSchedule)
                    presentationMode.wrappedValue.dismiss()
                }
                .disabled(!isFormValid)
            }
        }
        .navigationTitle("Add New Alarm")
    }
    
    private var isFormValid: Bool {
        !routeNumber.isEmpty && !stopName.isEmpty && !direction.isEmpty
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}