import Foundation
import Capacitor
import ActivityKit

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private var currentActivityId: String?

    @objc func start(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                call.reject("Live Activities not authorized")
                return
            }

            let remainingSeconds = call.getDouble("remainingSeconds") ?? 0
            let mode = call.getString("mode") ?? "focus"
            let endTime = Date.now.addingTimeInterval(remainingSeconds)

            let attrs = PomodoroActivityAttributes(sessionId: UUID().uuidString)
            let state = PomodoroActivityAttributes.ContentState(
                endTime: endTime,
                mode: mode,
                isRunning: true,
                remainingSeconds: Int(remainingSeconds)
            )

            do {
                let activity = try Activity<PomodoroActivityAttributes>.request(
                    attributes: attrs,
                    content: .init(state: state, staleDate: endTime.addingTimeInterval(60)),
                    pushType: nil
                )
                currentActivityId = activity.id
                call.resolve(["activityId": activity.id])
            } catch {
                call.reject("Failed to start: \(error.localizedDescription)")
            }
        } else {
            call.reject("Requires iOS 16.2+")
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            guard let activityId = currentActivityId else { call.resolve(); return }

            let remainingSeconds = call.getDouble("remainingSeconds") ?? 0
            let mode = call.getString("mode") ?? "focus"
            let isRunning = call.getBool("isRunning") ?? true
            let endTime = Date.now.addingTimeInterval(remainingSeconds)

            let state = PomodoroActivityAttributes.ContentState(
                endTime: endTime,
                mode: mode,
                isRunning: isRunning,
                remainingSeconds: Int(remainingSeconds)
            )

            Task {
                for activity in Activity<PomodoroActivityAttributes>.activities where activity.id == activityId {
                    await activity.update(.init(state: state, staleDate: endTime.addingTimeInterval(60)))
                    break
                }
                call.resolve()
            }
        } else {
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            guard let activityId = currentActivityId else { call.resolve(); return }

            let mode = call.getString("mode") ?? "focus"
            let finalState = PomodoroActivityAttributes.ContentState(
                endTime: Date.now,
                mode: mode,
                isRunning: false,
                remainingSeconds: 0
            )

            Task {
                for activity in Activity<PomodoroActivityAttributes>.activities where activity.id == activityId {
                    await activity.end(.init(state: finalState, staleDate: nil), dismissalPolicy: .after(Date.now.addingTimeInterval(5)))
                    break
                }
                self.currentActivityId = nil
                call.resolve()
            }
        } else {
            call.resolve()
        }
    }
}
