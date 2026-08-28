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
private func near(_ a: CGPoint, _ b: CGPoint, tolerance: CGFloat = 8.0) -> Bool { abs(a.x-b.x) <= tolerance && abs(a.y-b.y) <= tolerance }
private func pump(_ app: NSApplication, _ seconds: Double) {
    let deadline = Date().addingTimeInterval(seconds)
    while Date() < deadline {
        let slice = min(deadline.timeIntervalSinceNow, 0.01)
        let until = Date().addingTimeInterval(max(slice, 0.001))
        if let event = app.nextEvent(matching: .any, until: until, inMode: .default, dequeue: true) {
            app.sendEvent(event)
        }
    }
}

private enum ProbeFailure: Error {
    case failed(String)
    var code: String { switch self { case .failed(let code): return code } }
}
private final class ProbeWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
private final class ProbeView: NSView {
    let marker = NSView(frame: NSRect(x: 0, y: 0, width: 28, height: 28))
    var leftDownCount = 0
    var leftUpCount = 0
    var draggedCount = 0
    var dragging = false

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        marker.wantsLayer = true
        addSubview(marker)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    func setMarkerCenter(_ point: NSPoint) {
        marker.frame.origin = NSPoint(x: point.x - marker.frame.width / 2.0, y: point.y - marker.frame.height / 2.0)
    }
    var markerCenter: NSPoint { NSPoint(x: marker.frame.midX, y: marker.frame.midY) }
    override func mouseDown(with event: NSEvent) {
        leftDownCount += 1
        dragging = true
    }
    override func mouseDragged(with event: NSEvent) {
        guard dragging else { return }
        draggedCount += 1
        setMarkerCenter(event.locationInWindow)
    }
    override func mouseUp(with event: NSEvent) {
        leftUpCount += 1
        if dragging { setMarkerCenter(event.locationInWindow) }
        dragging = false
    }
}

@main
struct Phase10CDragDeliveryDiscovery {
    static func main() {
        guard AXIsProcessTrusted() else { blocked("ACCESSIBILITY_NOT_TRUSTED") }
        guard let originalEvent = CGEvent(source: nil) else { failed("POINTER_LOCATION_UNAVAILABLE") }
        let original = originalEvent.location
        let previousApp = NSWorkspace.shared.frontmostApplication
        let bounds = CGDisplayBounds(CGMainDisplayID())
        guard bounds.width >= 700, bounds.height >= 500 else { blocked("DISPLAY_TOO_SMALL_FOR_DRAG_FIXTURE") }

        let centerGlobal = CGPoint(x: bounds.midX, y: bounds.midY)
        let sourceGlobal = CGPoint(x: centerGlobal.x - 70, y: centerGlobal.y)
        let destinationGlobal = CGPoint(x: centerGlobal.x + 70, y: centerGlobal.y)
        let appKitCenter = NSPoint(x: centerGlobal.x, y: bounds.origin.y + bounds.height - (centerGlobal.y - bounds.origin.y))
        let frame = NSRect(x: appKitCenter.x - 200, y: appKitCenter.y - 110, width: 400, height: 220)
        let sourceLocal = NSPoint(x: 130, y: 110)
        let destinationLocal = NSPoint(x: 270, y: 110)

        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let window = ProbeWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
        let probe = ProbeView(frame: NSRect(x: 0, y: 0, width: 400, height: 220))
        probe.setMarkerCenter(sourceLocal)
        window.contentView = probe
        window.level = .floating
        window.backgroundColor = .windowBackgroundColor
        window.ignoresMouseEvents = false
        window.makeKeyAndOrderFront(nil)
        app.activate(ignoringOtherApps: true)
        pump(app, 0.15)

        var buttonMayBeDown = false
        func cleanup() -> (restored: Bool, emergencyReleasePosted: Bool) {
            var emergencyReleasePosted = false
            if buttonMayBeDown {
                let releasePoint = CGEvent(source: nil)?.location ?? sourceGlobal
                if let emergencyUp = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: releasePoint, mouseButton: .left) {
                    emergencyUp.post(tap: .cghidEventTap)
                    emergencyReleasePosted = true
                    buttonMayBeDown = false
                    pump(app, 0.06)
                }
            }
            window.orderOut(nil)
            CGWarpMouseCursorPosition(original)
            pump(app, 0.08)
            let restored = CGEvent(source: nil).map { near($0.location, original, tolerance: 2.0) } ?? false
            if let previousApp, previousApp.processIdentifier != ProcessInfo.processInfo.processIdentifier {
                _ = previousApp.activate(options: [.activateIgnoringOtherApps])
                pump(app, 0.05)
            }
            return (restored, emergencyReleasePosted)
        }

        do {
            guard let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: sourceGlobal, mouseButton: .left) else {
                throw ProbeFailure.failed("DRAG_SOURCE_MOVE_CONSTRUCTION_FAILED")
            }
            move.post(tap: .cghidEventTap)
            pump(app, 0.10)
            guard let positioned = CGEvent(source: nil)?.location, near(positioned, sourceGlobal, tolerance: 2.0) else {
                throw ProbeFailure.failed("DRAG_SOURCE_POSITION_NOT_OBSERVED")
            }

            guard let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: sourceGlobal, mouseButton: .left) else {
                throw ProbeFailure.failed("DRAG_DOWN_CONSTRUCTION_FAILED")
            }
            down.post(tap: .cghidEventTap)
            buttonMayBeDown = true
            pump(app, 0.05)

            for step in 1...4 {
                let fraction = CGFloat(step) / 4.0
                let point = CGPoint(
                    x: sourceGlobal.x + (destinationGlobal.x - sourceGlobal.x) * fraction,
                    y: sourceGlobal.y + (destinationGlobal.y - sourceGlobal.y) * fraction
                )
                guard let dragged = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: point, mouseButton: .left) else {
                    throw ProbeFailure.failed("DRAG_EVENT_CONSTRUCTION_FAILED")
                }
                dragged.post(tap: .cghidEventTap)
                pump(app, 0.025)
            }

            guard let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: destinationGlobal, mouseButton: .left) else {
                throw ProbeFailure.failed("DRAG_UP_CONSTRUCTION_FAILED")
            }
            up.post(tap: .cghidEventTap)
            buttonMayBeDown = false
            pump(app, 0.16)

            guard probe.leftDownCount == 1 else { throw ProbeFailure.failed("DRAG_DOWN_NOT_OBSERVED_EXACTLY_ONCE") }
            guard probe.draggedCount >= 1 else { throw ProbeFailure.failed("DRAGGED_EVENT_NOT_OBSERVED") }
            guard probe.leftUpCount == 1 else { throw ProbeFailure.failed("DRAG_UP_NOT_OBSERVED_EXACTLY_ONCE") }
            guard near(probe.markerCenter, destinationLocal) else { throw ProbeFailure.failed("DRAG_FIXTURE_CONSEQUENCE_NOT_OBSERVED") }

            let cleaned = cleanup()
            guard cleaned.restored else { failed("POINTER_RESTORE_FAILED") }
            guard cleaned.emergencyReleasePosted == false else { failed("UNEXPECTED_EMERGENCY_RELEASE_ON_SUCCESS") }
            emit([
                "ok": true,
                "state": "OBSERVED",
                "method": "quartz-drag-to-test-owned-appkit-fixture",
                "leftDownCount": probe.leftDownCount,
                "draggedCount": probe.draggedCount,
                "leftUpCount": probe.leftUpCount,
                "fixtureConsequenceObserved": true,
                "pointerRestored": true,
                "emergencyReleasePosted": false,
                "fixtureOwned": true,
                "userContentTouched": false,
                "semanticConsequenceClaimed": false
            ], exitCode: 0)
        } catch let error as ProbeFailure {
            let cleaned = cleanup()
            if !cleaned.restored { failed("POINTER_RESTORE_FAILED_AFTER_\(error.code)") }
            emit([
                "ok": false,
                "state": "FAILED",
                "error": error.code,
                "leftDownCount": probe.leftDownCount,
                "draggedCount": probe.draggedCount,
                "leftUpCount": probe.leftUpCount,
                "fixtureConsequenceObserved": near(probe.markerCenter, destinationLocal),
                "pointerRestored": true,
                "emergencyReleasePosted": cleaned.emergencyReleasePosted,
                "fixtureOwned": true,
                "userContentTouched": false
            ], exitCode: 1)
        } catch {
            let cleaned = cleanup()
            if !cleaned.restored { failed("POINTER_RESTORE_FAILED_AFTER_UNEXPECTED_DRAG_ERROR") }
            failed("DRAG_DISCOVERY_UNEXPECTED_ERROR")
        }
    }
}
