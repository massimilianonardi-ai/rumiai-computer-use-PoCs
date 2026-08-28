import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

private final class ProbeWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
private final class FlippedDocumentView: NSView {
    override var isFlipped: Bool { true }
}
private final class ProbeScrollView: NSScrollView {
    var wheelEventCount = 0
    override func scrollWheel(with event: NSEvent) {
        wheelEventCount += 1
        super.scrollWheel(with: event)
    }
}
private func line(_ value: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
}
private func near(_ a: CGPoint, _ b: CGPoint, tolerance: CGFloat = 2.0) -> Bool {
    abs(a.x-b.x) <= tolerance && abs(a.y-b.y) <= tolerance
}
private func pump(_ app: NSApplication, _ seconds: Double) {
    let deadline = Date().addingTimeInterval(seconds)
    while Date() < deadline {
        if let event = app.nextEvent(matching: .any, until: Date().addingTimeInterval(0.01), inMode: .default, dequeue: true) {
            app.sendEvent(event)
        }
    }
}
private func direction(_ delta: CGFloat) -> String { delta > 0 ? "increasing-y" : "decreasing-y" }

@main
struct Phase10DWheelPublicFixture {
    static func main() {
        guard AXIsProcessTrusted() else { line(["kind":"RESULT","ok":false,"state":"BLOCKED","error":"ACCESSIBILITY_NOT_TRUSTED"]); exit(2) }
        guard let originalEvent = CGEvent(source: nil) else { line(["kind":"RESULT","ok":false,"state":"FAILED","error":"POINTER_LOCATION_UNAVAILABLE"]); exit(1) }
        let original = originalEvent.location
        let previousApp = NSWorkspace.shared.frontmostApplication
        let bounds = CGDisplayBounds(CGMainDisplayID())
        guard bounds.width >= 700, bounds.height >= 500 else { line(["kind":"RESULT","ok":false,"state":"BLOCKED","error":"DISPLAY_TOO_SMALL_FOR_WHEEL_FIXTURE"]); exit(2) }

        let targetGlobal = CGPoint(x: bounds.midX, y: bounds.midY)
        let targetLocal = CGPoint(x: targetGlobal.x-bounds.origin.x, y: targetGlobal.y-bounds.origin.y)
        let appKitCenter = NSPoint(x: targetGlobal.x, y: bounds.origin.y+bounds.height-(targetGlobal.y-bounds.origin.y))
        let frame = NSRect(x: appKitCenter.x-210, y: appKitCenter.y-150, width: 420, height: 300)

        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let window = ProbeWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
        let scroll = ProbeScrollView(frame: NSRect(x: 30, y: 30, width: 360, height: 240))
        scroll.hasVerticalScroller = true
        scroll.hasHorizontalScroller = false
        scroll.autohidesScrollers = false
        scroll.verticalScrollElasticity = .none
        scroll.documentView = FlippedDocumentView(frame: NSRect(x: 0, y: 0, width: 340, height: 2400))
        let root = NSView(frame: NSRect(x: 0, y: 0, width: 420, height: 300))
        root.addSubview(scroll)
        window.contentView = root
        window.level = .floating
        window.backgroundColor = .windowBackgroundColor
        window.ignoresMouseEvents = false
        window.makeKeyAndOrderFront(nil)
        app.activate(ignoringOtherApps: true)
        pump(app, 0.15)

        let baselinePoint = NSPoint(x: 0, y: 900)
        func setBaseline() -> CGFloat {
            scroll.contentView.scroll(to: baselinePoint)
            scroll.reflectScrolledClipView(scroll.contentView)
            pump(app, 0.08)
            return scroll.documentVisibleRect.origin.y
        }
        func cleanup() -> Bool {
            window.orderOut(nil)
            CGWarpMouseCursorPosition(original)
            pump(app, 0.08)
            let restored = CGEvent(source: nil).map { near($0.location, original) } ?? false
            if let previousApp, previousApp.processIdentifier != ProcessInfo.processInfo.processIdentifier {
                _ = previousApp.activate(options: [.activateIgnoringOtherApps])
                pump(app, 0.05)
            }
            return restored
        }
        func finishFailure(_ code: String) -> Never {
            let restored = cleanup()
            line(["kind":"RESULT","ok":false,"state":"FAILED","error":restored ? code : "POINTER_RESTORE_FAILED_AFTER_\(code)","pointerRestored":restored,"fixtureOwned":true,"userContentTouched":false])
            exit(1)
        }

        let baseline = setBaseline()
        guard baseline > 100 && baseline < 1900 else { finishFailure("WHEEL_BASELINE_NOT_INTERIOR") }
        line(["kind":"READY","ok":true,"display":"primary","x":targetLocal.x,"y":targetLocal.y,"fixtureOwned":true])

        let firstBeforeCount = scroll.wheelEventCount
        var firstDelta: CGFloat = 0
        let firstDeadline = Date().addingTimeInterval(10)
        while Date() < firstDeadline {
            pump(app, 0.02)
            firstDelta = scroll.documentVisibleRect.origin.y-baseline
            if scroll.wheelEventCount > firstBeforeCount && abs(firstDelta) >= 1 { break }
        }
        let firstCount = scroll.wheelEventCount-firstBeforeCount
        guard firstCount >= 1 else { finishFailure("FIRST_PUBLIC_WHEEL_DELIVERY_NOT_OBSERVED") }
        guard abs(firstDelta) >= 1 else { finishFailure("FIRST_PUBLIC_WHEEL_CONSEQUENCE_NOT_OBSERVED") }
        pump(app, 0.08)

        let reset = setBaseline()
        guard abs(reset-baseline) <= 1 else { finishFailure("PUBLIC_WHEEL_BASELINE_RESET_FAILED") }
        line(["kind":"SECOND_READY","ok":true,"firstWheelObservedCount":firstCount,"firstContentDirection":direction(firstDelta),"baselineReset":true])

        let secondBeforeCount = scroll.wheelEventCount
        var secondDelta: CGFloat = 0
        let secondDeadline = Date().addingTimeInterval(10)
        while Date() < secondDeadline {
            pump(app, 0.02)
            secondDelta = scroll.documentVisibleRect.origin.y-baseline
            if scroll.wheelEventCount > secondBeforeCount && abs(secondDelta) >= 1 { break }
        }
        let secondCount = scroll.wheelEventCount-secondBeforeCount
        guard secondCount >= 1 else { finishFailure("SECOND_PUBLIC_WHEEL_DELIVERY_NOT_OBSERVED") }
        guard abs(secondDelta) >= 1 else { finishFailure("SECOND_PUBLIC_WHEEL_CONSEQUENCE_NOT_OBSERVED") }
        guard firstDelta*secondDelta < 0 else { finishFailure("PUBLIC_WHEEL_DIRECTIONS_NOT_OPPOSITE") }

        let restored = cleanup()
        guard restored else { line(["kind":"RESULT","ok":false,"state":"FAILED","error":"POINTER_RESTORE_FAILED","fixtureOwned":true,"userContentTouched":false]); exit(1) }
        line([
            "kind":"RESULT","ok":true,"state":"OBSERVED",
            "firstWheelObservedCount":firstCount,
            "firstContentDirection":direction(firstDelta),
            "secondWheelObservedCount":secondCount,
            "secondContentDirection":direction(secondDelta),
            "oppositeDirectionsObserved":true,
            "baselineReset":true,
            "pointerRestored":true,
            "fixtureOwned":true,
            "userContentTouched":false,
            "semanticConsequenceClaimed":false
        ])
        exit(0)
    }
}
