import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

private func emit(_ value: [String: Any], exitCode: Int32) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(exitCode)
}
private func blocked(_ code: String) -> Never { emit(["ok": false, "state": "BLOCKED", "error": code], exitCode: 2) }
private func failed(_ code: String) -> Never { emit(["ok": false, "state": "FAILED", "error": code], exitCode: 1) }
private func near(_ a: CGPoint, _ b: CGPoint, tolerance: CGFloat = 2.0) -> Bool { abs(a.x-b.x) <= tolerance && abs(a.y-b.y) <= tolerance }
private func pump(_ app: NSApplication, _ seconds: Double) {
    let deadline = Date().addingTimeInterval(seconds)
    while Date() < deadline {
        let until = Date().addingTimeInterval(0.01)
        if let event = app.nextEvent(matching: .any, until: until, inMode: .default, dequeue: true) { app.sendEvent(event) }
    }
}
private func direction(_ delta: CGFloat) -> String { delta > 0 ? "increasing-y" : "decreasing-y" }

private enum ProbeFailure: Error {
    case failed(String)
    var code: String { switch self { case .failed(let code): return code } }
}
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

@main
struct Phase10DWheelDeliveryDiscovery {
    static func main() {
        guard AXIsProcessTrusted() else { blocked("ACCESSIBILITY_NOT_TRUSTED") }
        guard let originalEvent = CGEvent(source: nil) else { failed("POINTER_LOCATION_UNAVAILABLE") }
        let original = originalEvent.location
        let previousApp = NSWorkspace.shared.frontmostApplication
        let bounds = CGDisplayBounds(CGMainDisplayID())
        guard bounds.width >= 700, bounds.height >= 500 else { blocked("DISPLAY_TOO_SMALL_FOR_WHEEL_FIXTURE") }

        let centerGlobal = CGPoint(x: bounds.midX, y: bounds.midY)
        let appKitCenter = NSPoint(x: centerGlobal.x, y: bounds.origin.y + bounds.height - (centerGlobal.y - bounds.origin.y))
        let frame = NSRect(x: appKitCenter.x - 210, y: appKitCenter.y - 150, width: 420, height: 300)
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let window = ProbeWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
        let scroll = ProbeScrollView(frame: NSRect(x: 30, y: 30, width: 360, height: 240))
        scroll.hasVerticalScroller = true
        scroll.hasHorizontalScroller = false
        scroll.autohidesScrollers = false
        scroll.verticalScrollElasticity = .none
        let document = FlippedDocumentView(frame: NSRect(x: 0, y: 0, width: 340, height: 2400))
        scroll.documentView = document
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

        do {
            let baseline = setBaseline()
            guard baseline > 100 && baseline < 1900 else { throw ProbeFailure.failed("WHEEL_BASELINE_NOT_INTERIOR") }
            guard let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: centerGlobal, mouseButton: .left) else { throw ProbeFailure.failed("WHEEL_TARGET_MOVE_CONSTRUCTION_FAILED") }
            move.post(tap: .cghidEventTap)
            pump(app, 0.08)
            guard let positioned = CGEvent(source: nil)?.location, near(positioned, centerGlobal) else { throw ProbeFailure.failed("WHEEL_TARGET_POSITION_NOT_OBSERVED") }

            let beforeNegativeCount = scroll.wheelEventCount
            guard let negative = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 1, wheel1: -3, wheel2: 0, wheel3: 0) else { throw ProbeFailure.failed("NEGATIVE_WHEEL_CONSTRUCTION_FAILED") }
            negative.post(tap: .cghidEventTap)
            pump(app, 0.22)
            let negativeCount = scroll.wheelEventCount - beforeNegativeCount
            let negativeDelta = scroll.documentVisibleRect.origin.y - baseline
            guard negativeCount >= 1 else { throw ProbeFailure.failed("NEGATIVE_WHEEL_DELIVERY_NOT_OBSERVED") }
            guard abs(negativeDelta) >= 1 else { throw ProbeFailure.failed("NEGATIVE_WHEEL_SCROLL_CONSEQUENCE_NOT_OBSERVED") }

            let reset = setBaseline()
            guard abs(reset - baseline) <= 1 else { throw ProbeFailure.failed("WHEEL_BASELINE_RESET_FAILED") }
            let beforePositiveCount = scroll.wheelEventCount
            guard let positive = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 1, wheel1: 3, wheel2: 0, wheel3: 0) else { throw ProbeFailure.failed("POSITIVE_WHEEL_CONSTRUCTION_FAILED") }
            positive.post(tap: .cghidEventTap)
            pump(app, 0.22)
            let positiveCount = scroll.wheelEventCount - beforePositiveCount
            let positiveDelta = scroll.documentVisibleRect.origin.y - baseline
            guard positiveCount >= 1 else { throw ProbeFailure.failed("POSITIVE_WHEEL_DELIVERY_NOT_OBSERVED") }
            guard abs(positiveDelta) >= 1 else { throw ProbeFailure.failed("POSITIVE_WHEEL_SCROLL_CONSEQUENCE_NOT_OBSERVED") }
            guard negativeDelta * positiveDelta < 0 else { throw ProbeFailure.failed("WHEEL_SIGNS_DID_NOT_PRODUCE_OPPOSITE_SCROLL") }

            let restored = cleanup()
            guard restored else { failed("POINTER_RESTORE_FAILED") }
            emit([
                "ok": true,
                "state": "OBSERVED",
                "method": "quartz-wheel-to-test-owned-appkit-scroll-fixture",
                "negativeWheelObservedCount": negativeCount,
                "negativeWheelContentDirection": direction(negativeDelta),
                "negativeWheelScrollChanged": true,
                "positiveWheelObservedCount": positiveCount,
                "positiveWheelContentDirection": direction(positiveDelta),
                "positiveWheelScrollChanged": true,
                "oppositeDirectionsObserved": true,
                "pointerRestored": true,
                "fixtureOwned": true,
                "userContentTouched": false,
                "semanticScrollClaimed": false
            ], exitCode: 0)
        } catch let error as ProbeFailure {
            let restored = cleanup()
            if !restored { failed("POINTER_RESTORE_FAILED_AFTER_\(error.code)") }
            emit([
                "ok": false,
                "state": "FAILED",
                "error": error.code,
                "pointerRestored": true,
                "fixtureOwned": true,
                "userContentTouched": false
            ], exitCode: 1)
        } catch {
            let restored = cleanup()
            if !restored { failed("POINTER_RESTORE_FAILED_AFTER_UNEXPECTED_WHEEL_ERROR") }
            failed("WHEEL_DISCOVERY_UNEXPECTED_ERROR")
        }
    }
}
