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

let systemWide = AXUIElementCreateSystemWide()
var focusedAppValue: CFTypeRef?
let appResult = AXUIElementCopyAttributeValue(
    systemWide,
    kAXFocusedApplicationAttribute as CFString,
    &focusedAppValue
)

guard appResult == .success, let appValue = focusedAppValue else {
    emit([
        "ok": false,
        "error": "FOCUSED_APPLICATION_UNAVAILABLE",
        "axError": appResult.rawValue,
    ], exitCode: 2)
}

let focusedApp = appValue as! AXUIElement
var appPid: pid_t = 0
let appPidResult = AXUIElementGetPid(focusedApp, &appPid)

guard appPidResult == .success, appPid > 0 else {
    emit([
        "ok": false,
        "error": "FOCUSED_APPLICATION_PID_UNAVAILABLE",
        "axError": appPidResult.rawValue,
    ], exitCode: 3)
}

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
        "axError": windowResult.rawValue,
    ], exitCode: 4)
}

let focusedWindow = windowValue as! AXUIElement
var windowPid: pid_t = 0
let windowPidResult = AXUIElementGetPid(focusedWindow, &windowPid)
let effectivePid = windowPidResult == .success && windowPid > 0 ? windowPid : appPid

let running = NSRunningApplication(processIdentifier: effectivePid)
let title = stringAttribute(focusedWindow, kAXTitleAttribute as CFString)
let identifier = stringAttribute(focusedWindow, kAXIdentifierAttribute as CFString)
let role = stringAttribute(focusedWindow, kAXRoleAttribute as CFString)
let subrole = stringAttribute(focusedWindow, kAXSubroleAttribute as CFString)
let windowNumber = numberAttribute(focusedWindow, "AXWindowNumber" as CFString)

emit([
    "ok": true,
    "pid": Int(effectivePid),
    "process": jsonValue(running?.localizedName),
    "bundle": jsonValue(running?.bundleIdentifier),
    "title": jsonValue(title),
    "identifier": jsonValue(identifier),
    "windowNumber": jsonNumber(windowNumber),
    "role": jsonValue(role),
    "subrole": jsonValue(subrole),
], exitCode: 0)
