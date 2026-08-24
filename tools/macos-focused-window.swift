import Cocoa
import ApplicationServices
import Foundation

func copyAttribute(_ element: AXUIElement, _ attribute: CFString) -> CFTypeRef? {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, attribute, &value)
    guard result == .success else { return nil }
    return value
}

func stringAttribute(_ element: AXUIElement, _ attribute: CFString) -> String? {
    guard let value = copyAttribute(element, attribute) else { return nil }
    if let string = value as? String { return string }
    return String(describing: value)
}

func numberAttribute(_ element: AXUIElement, _ attribute: CFString) -> NSNumber? {
    guard let value = copyAttribute(element, attribute) else { return nil }
    return value as? NSNumber
}

func jsonValue(_ value: String?) -> Any {
    return value ?? NSNull()
}

func jsonNumber(_ value: NSNumber?) -> Any {
    return value ?? NSNull()
}

func emit(_ object: [String: Any], exitCode: Int32) -> Never {
    do {
        let data = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        if let text = String(data: data, encoding: .utf8) {
            print(text)
        }
    } catch {
        fputs("{\"ok\":false,\"error\":\"JSON_SERIALIZATION_FAILED\"}\n", stderr)
    }
    exit(exitCode)
}

// Do not ask the system-wide AX object for AXFocusedApplication here.
// v65 physical diagnostic on macOS returned kAXErrorCannotComplete (-25204)
// for that messaging path even though the same session could access TextEdit
// through agent-ctrl. AppKit already exposes the OS frontmost application as
// the app receiving key events, so resolve that process first and then perform
// the window observation through the application's own AX object.
guard let running = NSWorkspace.shared.frontmostApplication else {
    emit([
        "ok": false,
        "error": "FRONTMOST_APPLICATION_UNAVAILABLE",
        "method": "NSWorkspace.frontmostApplication",
    ], exitCode: 2)
}

let appPid = running.processIdentifier
guard appPid > 0 else {
    emit([
        "ok": false,
        "error": "FRONTMOST_APPLICATION_PID_UNAVAILABLE",
        "method": "NSWorkspace.frontmostApplication",
    ], exitCode: 3)
}

let focusedApp = AXUIElementCreateApplication(appPid)
var focusedWindowValue: CFTypeRef?
let windowResult = AXUIElementCopyAttributeValue(
    focusedApp,
    kAXFocusedWindowAttribute as CFString,
    &focusedWindowValue
)

guard windowResult == .success, let windowValue = focusedWindowValue else {
    emit([
        "ok": false,
        "error": "FOCUSED_WINDOW_UNAVAILABLE",
        "pid": Int(appPid),
        "process": jsonValue(running.localizedName),
        "bundle": jsonValue(running.bundleIdentifier),
        "axError": windowResult.rawValue,
        "method": "NSWorkspace.frontmostApplication + AXFocusedWindow",
    ], exitCode: 4)
}

let focusedWindow = windowValue as! AXUIElement
var windowPid: pid_t = 0
let windowPidResult = AXUIElementGetPid(focusedWindow, &windowPid)
let effectivePid = windowPidResult == .success && windowPid > 0 ? windowPid : appPid

let title = stringAttribute(focusedWindow, kAXTitleAttribute as CFString)
let identifier = stringAttribute(focusedWindow, kAXIdentifierAttribute as CFString)
let role = stringAttribute(focusedWindow, kAXRoleAttribute as CFString)
let subrole = stringAttribute(focusedWindow, kAXSubroleAttribute as CFString)
let windowNumber = numberAttribute(focusedWindow, "AXWindowNumber" as CFString)

emit([
    "ok": true,
    "pid": Int(effectivePid),
    "process": jsonValue(running.localizedName),
    "bundle": jsonValue(running.bundleIdentifier),
    "title": jsonValue(title),
    "identifier": jsonValue(identifier),
    "windowNumber": jsonNumber(windowNumber),
    "role": jsonValue(role),
    "subrole": jsonValue(subrole),
    "method": "NSWorkspace.frontmostApplication + AXFocusedWindow",
], exitCode: 0)
