import Cocoa
import ApplicationServices
import Foundation

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

func boolAttribute(_ element: AXUIElement, _ attribute: CFString) -> Bool? {
    guard let value = copyAttribute(element, attribute) else { return nil }
    if let number = value as? NSNumber { return number.boolValue }
    return nil
}

let args = CommandLine.arguments
if args.count != 4 {
    emit([
        "ok": false,
        "error": "USAGE",
        "detail": "usage: macos-window-minimized <pid> <exact-title> <observe|minimize|restore>"
    ], exitCode: 2)
}

guard let parsedPid = Int32(args[1]), parsedPid > 0 else {
    emit([
        "ok": false,
        "error": "INVALID_PID"
    ], exitCode: 3)
}

let expectedTitle = args[2]
let mode = args[3]
let validModes = ["observe", "minimize", "restore"]
if !validModes.contains(mode) {
    emit([
        "ok": false,
        "error": "INVALID_MODE",
        "mode": mode
    ], exitCode: 4)
}

let app = AXUIElementCreateApplication(parsedPid)
var windowsValue: CFTypeRef?
let windowsResult = AXUIElementCopyAttributeValue(
    app,
    kAXWindowsAttribute as CFString,
    &windowsValue
)

guard windowsResult == .success, let rawWindows = windowsValue else {
    emit([
        "ok": false,
        "error": "WINDOWS_UNAVAILABLE",
        "axError": windowsResult.rawValue,
        "pid": Int(parsedPid)
    ], exitCode: 5)
}

guard let windows = rawWindows as? [AXUIElement] else {
    emit([
        "ok": false,
        "error": "WINDOWS_INVALID_TYPE",
        "pid": Int(parsedPid)
    ], exitCode: 6)
}

let matches = windows.filter { window in
    stringAttribute(window, kAXTitleAttribute as CFString) == expectedTitle
}

if matches.isEmpty {
    emit([
        "ok": false,
        "error": "WINDOW_NOT_FOUND",
        "pid": Int(parsedPid),
        "title": expectedTitle,
        "matchCount": 0
    ], exitCode: 7)
}

if matches.count != 1 {
    emit([
        "ok": false,
        "error": "WINDOW_AMBIGUOUS",
        "pid": Int(parsedPid),
        "title": expectedTitle,
        "matchCount": matches.count
    ], exitCode: 8)
}

let window = matches[0]
let minimizedBefore = boolAttribute(window, kAXMinimizedAttribute as CFString)

var settable = DarwinBoolean(false)
let settableResult = AXUIElementIsAttributeSettable(
    window,
    kAXMinimizedAttribute as CFString,
    &settable
)

if mode != "observe" {
    guard settableResult == .success, settable.boolValue else {
        emit([
            "ok": false,
            "error": "MINIMIZED_ATTRIBUTE_NOT_SETTABLE",
            "pid": Int(parsedPid),
            "title": expectedTitle,
            "mode": mode,
            "settableAxError": settableResult.rawValue,
            "settable": settable.boolValue,
            "minimizedBefore": minimizedBefore as Any
        ], exitCode: 9)
    }

    let desired: CFBoolean = mode == "minimize" ? kCFBooleanTrue : kCFBooleanFalse
    let setResult = AXUIElementSetAttributeValue(
        window,
        kAXMinimizedAttribute as CFString,
        desired
    )

    guard setResult == .success else {
        emit([
            "ok": false,
            "error": "MINIMIZED_ATTRIBUTE_SET_FAILED",
            "pid": Int(parsedPid),
            "title": expectedTitle,
            "mode": mode,
            "axError": setResult.rawValue,
            "settable": settable.boolValue,
            "minimizedBefore": minimizedBefore as Any
        ], exitCode: 10)
    }
}

let minimizedAfter = boolAttribute(window, kAXMinimizedAttribute as CFString)

emit([
    "ok": true,
    "pid": Int(parsedPid),
    "title": expectedTitle,
    "mode": mode,
    "matchCount": matches.count,
    "settable": settableResult == .success ? settable.boolValue : false,
    "settableAxError": settableResult.rawValue,
    "minimizedBefore": minimizedBefore as Any,
    "minimizedAfter": minimizedAfter as Any,
    "method": "AXWindows exact-title + AXMinimized"
], exitCode: 0)
