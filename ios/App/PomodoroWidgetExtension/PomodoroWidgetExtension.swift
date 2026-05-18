import ActivityKit
import WidgetKit
import SwiftUI

let appText = Color(red: 0.33, green: 0.36, blue: 0.50)
let appMuted = Color(red: 0.56, green: 0.57, blue: 0.66)
let appBg = Color(red: 0.90, green: 0.88, blue: 0.88)
let focusColor = Color(red: 0.77, green: 0.36, blue: 0.36)
let breakColor = Color(red: 0.36, green: 0.55, blue: 0.41)
let amberColor = Color(red: 0.66, green: 0.52, blue: 0.38)

func formatSeconds(_ s: Int) -> String {
    let m = s / 60
    let sec = s % 60
    return String(format: "%d:%02d", m, sec)
}

struct PomodoroLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PomodoroActivityAttributes.self) { context in
            // Lock Screen
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.mode == "focus" ? "Focusing" : "Break")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(context.state.mode == "focus" ? appText : breakColor)
                    if !context.state.isRunning {
                        Text("Paused")
                            .font(.system(size: 12))
                            .foregroundColor(amberColor)
                    }
                }
                Spacer()
                if context.state.isRunning {
                    Text(timerInterval: Date.now...context.state.endTime, countsDown: true)
                        .font(.system(size: 32, weight: .bold, design: .monospaced))
                        .foregroundColor(appText)
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                } else {
                    Text(formatSeconds(context.state.remainingSeconds))
                        .font(.system(size: 32, weight: .bold, design: .monospaced))
                        .foregroundColor(amberColor)
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .activityBackgroundTint(appBg)
            .activitySystemActionForegroundColor(appText)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.mode == "focus" ? "Focusing" : "Break")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(context.state.mode == "focus" ? appText : breakColor)
                        if !context.state.isRunning {
                            Text("Paused")
                                .font(.system(size: 11))
                                .foregroundColor(amberColor)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.isRunning {
                        Text(timerInterval: Date.now...context.state.endTime, countsDown: true)
                            .monospacedDigit()
                            .font(.system(size: 24, weight: .bold, design: .monospaced))
                            .multilineTextAlignment(.trailing)
                    } else {
                        Text(formatSeconds(context.state.remainingSeconds))
                            .monospacedDigit()
                            .font(.system(size: 24, weight: .bold, design: .monospaced))
                            .foregroundColor(amberColor)
                            .multilineTextAlignment(.trailing)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {}
            } compactLeading: {
                Text(context.state.mode == "focus" ? "Focus" : "Break")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(context.state.mode == "focus" ? focusColor : breakColor)
            } compactTrailing: {
                if context.state.isRunning {
                    Text(timerInterval: Date.now...context.state.endTime, countsDown: true)
                        .monospacedDigit()
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .frame(width: 48)
                        .multilineTextAlignment(.trailing)
                } else {
                    Text(formatSeconds(context.state.remainingSeconds))
                        .monospacedDigit()
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundColor(amberColor)
                        .frame(width: 48)
                        .multilineTextAlignment(.trailing)
                }
            } minimal: {
                if context.state.isRunning {
                    Text(timerInterval: Date.now...context.state.endTime, countsDown: true)
                        .monospacedDigit()
                        .font(.caption2)
                } else {
                    Image(systemName: "pause.fill")
                        .font(.caption2)
                        .foregroundColor(amberColor)
                }
            }
        }
    }
}

@main
struct PomodoroWidgetBundle: WidgetBundle {
    var body: some Widget {
        PomodoroLiveActivity()
    }
}
