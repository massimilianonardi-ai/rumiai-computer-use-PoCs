import AppKit
import ApplicationServices
import Carbon.HIToolbox
import CoreGraphics
import Foundation

private final class ProbeWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

private final class ProbeTextView: NSTextView {
    var keyDownCount = 0
    var keyUpCount = 0
    var returnDownCount = 0
    var returnUpCount = 0
    var shiftedADownCount = 0
    var shiftOnCount = 0
    var shiftOffCount = 0

    override func keyDown(with event: NSEvent) {
        keyDownCount += 1
        if event.keyCode == CGKeyCode(kVK_Return) { returnDownCount += 1 }
        if event.keyCode == CGKeyCode(kVK_ANSI_A) && event.modifierFlags.contains(.shift) { shiftedADownCount += 1 }
        super.keyDown(with: event)
    }

    override func keyUp(with event: NSEvent) {
        keyUpCount += 1
        if event.keyCode == CGKeyCode(kVK_Return) { returnUpCount += 1 }
        super.keyUp(with: event)
    }

    override func flagsChanged(with event: NSEvent) {
        if event.keyCode == CGKeyCode(kVK_Shift) {
            if event.modifierFlags.contains(.shift) { shiftOnCount += 1 }
            else { shiftOffCount += 1 }
        }
        super.flagsChanged(with: event)
    }
}

private func emit(_ value: [String: Any], exitCode: Int32) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(exitCode)
}
private func blocked(_ code: String) -> Never { emit(["ok": false, "state": "BLOCKED", "error": code], exitCode: 2) }
private func failed(_ code: String) -> Never { emit(["ok": false, "state": "FAILED", "error": code], exitCode: 1) }
private func pump(_ app: NSApplication, _ seconds: Double) {
    let deadline = Date().addingTimeInterval(seconds)
    while Date() < deadline {
        if let event = app.nextEvent(matching: .any, until: Date().addingTimeInterval(0.01), inMode: .default, dequeue: true) { app.sendEvent(event) }
    }
}
private func keyboardEvent(_ key: Int, down: Bool, flags: CGEventFlags = []) -> CGEvent? {
    guard let event = CGEvent(keyboardEventSource: nil, virtualKey: CGKeyCode(key), keyDown: down) else { return nil }
    event.flags = flags
    return event
}

@main
struct Phase10EKeyboardDeliveryDiscovery {
    static func main() {
        guard AXIsProcessTrusted() else { blocked("ACCESSIBILITY_NOT_TRUSTED") }
        let previousApp = NSWorkspace.shared.frontmostApplication
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let window = ProbeWindow(contentRect: NSRect(x: 180, y: 180, width: 460, height: 260), styleMask: [.borderless], backing: .buffered, defer: false)
        let scroll = NSScrollView(frame: NSRect(x: 30, y: 30, width: 400, height: 200))
        let text = ProbeTextView(frame: NSRect(x: 0, y: 0, width: 380, height: 200))
        text.isEditable = true
        text.isSelectable = true
        text.string = ""
        scroll.documentView = text
        window.contentView = scroll
        window.level = .floating
        window.backgroundColor = .windowBackgroundColor
        window.makeKeyAndOrderFront(nil)
        app.activate(ignoringOtherApps: true)
        window.makeFirstResponder(text)
        pump(app, 0.16)

        var shiftMayBeDown = false
        var emergencyShiftReleasePosted = false
        func cleanup() -> Bool {
            if shiftMayBeDown {
                if let release = keyboardEvent(kVK_Shift, down: false) {
                    release.post(tap: .cghidEventTap)
                    emergencyShiftReleasePosted = true
                    shiftMayBeDown = false
                    pump(app, 0.05)
                }
            }
            window.orderOut(nil)
            if let previousApp, previousApp.processIdentifier != ProcessInfo.processInfo.processIdentifier {
                _ = previousApp.activate(options: [.activateIgnoringOtherApps])
                pump(app, 0.06)
            }
            return NSWorkspace.shared.frontmostApplication?.processIdentifier == previousApp?.processIdentifier || previousApp == nil
        }

        guard
            let aDown = keyboardEvent(kVK_ANSI_A, down: true),
            let aUp = keyboardEvent(kVK_ANSI_A, down: false),
            let returnDown = keyboardEvent(kVK_Return, down: true),
            let returnUp = keyboardEvent(kVK_Return, down: false),
            let shiftDown = keyboardEvent(kVK_Shift, down: true, flags: .maskShift),
            let shiftedADown = keyboardEvent(kVK_ANSI_A, down: true, flags: .maskShift),
            let shiftedAUp = keyboardEvent(kVK_ANSI_A, down: false, flags: .maskShift),
            let shiftUp = keyboardEvent(kVK_Shift, down: false)
        else {
            _ = cleanup(); failed("KEYBOARD_EVENT_CONSTRUCTION_FAILED")
        }

        let beforePlainDown = text.keyDownCount, beforePlainUp = text.keyUpCount
        aDown.post(tap: .cghidEventTap); pump(app, 0.04); aUp.post(tap: .cghidEventTap); pump(app, 0.12)
        let plainDown = text.keyDownCount - beforePlainDown
        let plainUp = text.keyUpCount - beforePlainUp
        guard plainDown >= 1 && plainUp >= 1 && text.string == "a" else {
            _ = cleanup(); failed("PRINTABLE_KEY_DELIVERY_NOT_OBSERVED")
        }

        text.string = ""
        let beforeReturnDown = text.returnDownCount, beforeReturnUp = text.returnUpCount
        returnDown.post(tap: .cghidEventTap); pump(app, 0.04); returnUp.post(tap: .cghidEventTap); pump(app, 0.12)
        let specialDown = text.returnDownCount - beforeReturnDown
        let specialUp = text.returnUpCount - beforeReturnUp
        guard specialDown >= 1 && specialUp >= 1 && text.string == "\n" else {
            _ = cleanup(); failed("RETURN_KEY_DELIVERY_NOT_OBSERVED")
        }

        text.string = ""
        let beforeShiftOn = text.shiftOnCount, beforeShiftOff = text.shiftOffCount, beforeShiftedA = text.shiftedADownCount
        shiftDown.post(tap: .cghidEventTap); shiftMayBeDown = true; pump(app, 0.05)
        shiftedADown.post(tap: .cghidEventTap); pump(app, 0.04); shiftedAUp.post(tap: .cghidEventTap); pump(app, 0.04)
        shiftUp.post(tap: .cghidEventTap); shiftMayBeDown = false; pump(app, 0.14)
        let shiftOn = text.shiftOnCount - beforeShiftOn
        let shiftOff = text.shiftOffCount - beforeShiftOff
        let shiftedA = text.shiftedADownCount - beforeShiftedA
        guard shiftOn >= 1 && shiftOff >= 1 && shiftedA >= 1 && text.string == "A" else {
            _ = cleanup(); failed("SHIFT_MODIFIER_DELIVERY_NOT_OBSERVED")
        }

        let restored = cleanup()
        guard restored else { failed("FRONTMOST_APP_RESTORE_FAILED") }
        emit([
            "ok": true,
            "state": "OBSERVED",
            "printableKeyDownCount": plainDown,
            "printableKeyUpCount": plainUp,
            "printableTextConsequence": true,
            "specialKeyDownCount": specialDown,
            "specialKeyUpCount": specialUp,
            "specialKeyConsequence": true,
            "shiftOnCount": shiftOn,
            "shiftOffCount": shiftOff,
            "shiftedKeyDownCount": shiftedA,
            "shiftedTextConsequence": true,
            "emergencyShiftReleasePosted": emergencyShiftReleasePosted,
            "frontmostApplicationRestored": true,
            "fixtureOwned": true,
            "userContentTouched": false,
            "semanticTextSuccessClaimed": false
        ], exitCode: 0)
    }
}
