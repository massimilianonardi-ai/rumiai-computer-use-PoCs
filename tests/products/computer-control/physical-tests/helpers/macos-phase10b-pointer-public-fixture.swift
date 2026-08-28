import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

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

private func line(_ value: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
}

private func near(_ a: CGPoint, _ b: CGPoint, tolerance: CGFloat = 2.0) -> Bool {
    abs(a.x - b.x) <= tolerance && abs(a.y - b.y) <= tolerance
}

private func pump(_ app: NSApplication, until deadline: Date) {
    while Date() < deadline {
        if let event = app.nextEvent(matching: .any, until: Date().addingTimeInterval(0.01), inMode: .default, dequeue: true) {
            app.sendEvent(event)
        }
    }
}

@main
struct Phase10BPointerPublicFixture {
    static func main() {
        guard AXIsProcessTrusted() else {
            line(["kind":"RESULT","ok":false,"state":"BLOCKED","error":"ACCESSIBILITY_NOT_TRUSTED"])
            exit(2)
        }
        guard let initialEvent = CGEvent(source: nil) else {
            line(["kind":"RESULT","ok":false,"state":"FAILED","error":"POINTER_LOCATION_UNAVAILABLE"])
            exit(1)
        }

        let original = initialEvent.location
        let previousApp = NSWorkspace.shared.frontmostApplication
        let bounds = CGDisplayBounds(CGMainDisplayID())
        guard bounds.width >= 400, bounds.height >= 300 else {
            line(["kind":"RESULT","ok":false,"state":"BLOCKED","error":"DISPLAY_TOO_SMALL_FOR_POINTER_FIXTURE"])
            exit(2)
        }

        let localTarget = CGPoint(x: floor(bounds.width / 2.0), y: floor(bounds.height / 2.0))
        let globalTarget = CGPoint(x: bounds.origin.x + localTarget.x, y: bounds.origin.y + localTarget.y)
        let appKitTarget = NSPoint(x: globalTarget.x, y: bounds.origin.y + bounds.height - (globalTarget.y - bounds.origin.y))
        let frame = NSRect(x: appKitTarget.x - 120, y: appKitTarget.y - 80, width: 240, height: 160)

        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let window = ProbeWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
        let probe = ProbeView(frame: NSRect(x: 0, y: 0, width: 240, height: 160))
        window.contentView = probe
        window.level = .floating
        window.backgroundColor = .windowBackgroundColor
        window.makeKeyAndOrderFront(nil)
        app.activate(ignoringOtherApps: true)
        pump(app, until: Date().addingTimeInterval(0.15))

        func cleanup() -> Bool {
            window.orderOut(nil)
            CGWarpMouseCursorPosition(original)
            pump(app, until: Date().addingTimeInterval(0.08))
            let restored = CGEvent(source: nil).map { near($0.location, original) } ?? false
            if let previousApp, previousApp.processIdentifier != ProcessInfo.processInfo.processIdentifier {
                _ = previousApp.activate(options: [.activateIgnoringOtherApps])
                pump(app, until: Date().addingTimeInterval(0.05))
            }
            return restored
        }

        line([
            "kind":"READY",
            "ok":true,
            "display":"primary",
            "x":localTarget.x,
            "y":localTarget.y,
            "fixtureOwned":true
        ])

        let deadline = Date().addingTimeInterval(12.0)
        while Date() < deadline {
            pump(app, until: Date().addingTimeInterval(0.02))
            if probe.leftDownCount >= 1 && probe.leftUpCount >= 1 && probe.rightDownCount >= 1 && probe.rightUpCount >= 1 { break }
        }

        let restored = cleanup()
        let exact = probe.leftDownCount == 1 && probe.leftUpCount == 1 && probe.rightDownCount == 1 && probe.rightUpCount == 1
        guard restored else {
            line(["kind":"RESULT","ok":false,"state":"FAILED","error":"POINTER_RESTORE_FAILED"])
            exit(1)
        }
        guard exact else {
            line([
                "kind":"RESULT","ok":false,"state":"FAILED","error":"PUBLIC_POINTER_BUTTON_DELIVERY_NOT_EXACT",
                "leftDownCount":probe.leftDownCount,"leftUpCount":probe.leftUpCount,
                "rightDownCount":probe.rightDownCount,"rightUpCount":probe.rightUpCount,
                "pointerRestored":true
            ])
            exit(1)
        }

        line([
            "kind":"RESULT","ok":true,"state":"OBSERVED",
            "leftDownCount":probe.leftDownCount,"leftUpCount":probe.leftUpCount,
            "rightDownCount":probe.rightDownCount,"rightUpCount":probe.rightUpCount,
            "pointerRestored":true,"fixtureOwned":true,"semanticConsequenceClaimed":false
        ])
        exit(0)
    }
}
