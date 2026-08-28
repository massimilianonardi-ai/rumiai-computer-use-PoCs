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
private func spin(_ seconds: Double) { RunLoop.current.run(until: Date().addingTimeInterval(seconds)) }
private func near(_ a: CGPoint, _ b: CGPoint, tolerance: CGFloat = 2.0) -> Bool { abs(a.x-b.x) <= tolerance && abs(a.y-b.y) <= tolerance }

private enum ProbeFailure: Error {
    case failed(String)
    var code: String { switch self { case .failed(let code): return code } }
}
private final class ProbeWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
private final class ProbeView: NSView {
    var leftDownCount = 0
    var leftUpCount = 0
    var rightDownCount = 0
    var rightUpCount = 0
    override func mouseDown(with event: NSEvent) { leftDownCount += 1 }
    override func mouseUp(with event: NSEvent) { leftUpCount += 1 }
    override func rightMouseDown(with event: NSEvent) { rightDownCount += 1 }
    override func rightMouseUp(with event: NSEvent) { rightUpCount += 1 }
}

@main
struct Phase10BPointerDeliveryDiscovery {
    static func main() {
        guard AXIsProcessTrusted() else { blocked("ACCESSIBILITY_NOT_TRUSTED") }
        guard let originalEvent = CGEvent(source: nil) else { failed("POINTER_LOCATION_UNAVAILABLE") }
        let original = originalEvent.location
        let previousApp = NSWorkspace.shared.frontmostApplication
        let displayID = CGMainDisplayID()
        let bounds = CGDisplayBounds(displayID)
        guard bounds.width >= 400, bounds.height >= 300 else { blocked("DISPLAY_TOO_SMALL_FOR_POINTER_FIXTURE") }

        let target = CGPoint(x: bounds.midX, y: bounds.midY)
        let appKitTarget = NSPoint(x: target.x, y: bounds.origin.y + bounds.height - (target.y - bounds.origin.y))
        let frame = NSRect(x: appKitTarget.x - 120, y: appKitTarget.y - 80, width: 240, height: 160)
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let window = ProbeWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
        let probe = ProbeView(frame: NSRect(x: 0, y: 0, width: 240, height: 160))
        window.contentView = probe
        window.level = .floating
        window.backgroundColor = .windowBackgroundColor
        window.acceptsMouseMovedEvents = true
        window.makeKeyAndOrderFront(nil)
        app.activate(ignoringOtherApps: true)
        spin(0.15)

        func cleanup() -> Bool {
            window.orderOut(nil)
            CGWarpMouseCursorPosition(original)
            spin(0.08)
            let restored = CGEvent(source: nil).map { near($0.location, original) } ?? false
            if let previousApp, previousApp.processIdentifier != ProcessInfo.processInfo.processIdentifier {
                _ = previousApp.activate(options: [.activateIgnoringOtherApps])
                spin(0.05)
            }
            return restored
        }

        do {
            guard let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: target, mouseButton: .left) else { throw ProbeFailure.failed("MOVE_EVENT_CONSTRUCTION_FAILED") }
            move.post(tap: .cghidEventTap)
            spin(0.12)
            guard let moved = CGEvent(source: nil)?.location, near(moved, target) else { throw ProbeFailure.failed("MOVE_DELIVERY_NOT_OBSERVED") }

            guard
                let leftDown = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: target, mouseButton: .left),
                let leftUp = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: target, mouseButton: .left),
                let rightDown = CGEvent(mouseEventSource: nil, mouseType: .rightMouseDown, mouseCursorPosition: target, mouseButton: .right),
                let rightUp = CGEvent(mouseEventSource: nil, mouseType: .rightMouseUp, mouseCursorPosition: target, mouseButton: .right)
            else { throw ProbeFailure.failed("BUTTON_EVENT_CONSTRUCTION_FAILED") }

            leftDown.post(tap: .cghidEventTap); leftUp.post(tap: .cghidEventTap)
            rightDown.post(tap: .cghidEventTap); rightUp.post(tap: .cghidEventTap)
            spin(0.18)
            guard probe.leftDownCount == 1, probe.leftUpCount == 1, probe.rightDownCount == 1, probe.rightUpCount == 1 else {
                throw ProbeFailure.failed("BUTTON_DELIVERY_NOT_OBSERVED_BY_FIXTURE")
            }

            let restored = cleanup()
            guard restored else { failed("POINTER_RESTORE_FAILED") }
            emit([
                "ok": true,
                "state": "OBSERVED",
                "method": "quartz-post-to-test-owned-appkit-fixture",
                "moveDelivered": true,
                "leftDownCount": probe.leftDownCount,
                "leftUpCount": probe.leftUpCount,
                "rightDownCount": probe.rightDownCount,
                "rightUpCount": probe.rightUpCount,
                "pointerRestored": true,
                "fixtureOwned": true,
                "semanticConsequenceClaimed": false
            ], exitCode: 0)
        } catch let error as ProbeFailure {
            let restored = cleanup()
            if !restored { failed("POINTER_RESTORE_FAILED_AFTER_\(error.code)") }
            failed(error.code)
        } catch {
            let restored = cleanup()
            if !restored { failed("POINTER_RESTORE_FAILED_AFTER_UNEXPECTED_ERROR") }
            failed("POINTER_DISCOVERY_UNEXPECTED_ERROR")
        }
    }
}
