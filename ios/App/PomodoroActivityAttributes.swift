import ActivityKit
import Foundation

struct PomodoroActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var endTime: Date
        var mode: String
        var isRunning: Bool
        var remainingSeconds: Int
    }
    var sessionId: String
}
