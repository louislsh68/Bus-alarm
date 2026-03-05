import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            Text("Bus Alarm")
                .font(.largeTitle)
                .padding()
            
            // Placeholder for setting up routes, stops, and schedules
            NavigationLink(destination: RouteSetupView()) {
                Text("Set Up Bus Route")
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }
            
            // Placeholder for managing live activities
            NavigationLink(destination: LiveActivityManagerView()) {
                Text("Manage Live Activities")
                    .padding()
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }
        }
        .padding()
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}