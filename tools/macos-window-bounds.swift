import Cocoa
import ApplicationServices
import Foundation

typealias Bounds = [String: Double]

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

func pointAttribute(_ element: AXUIElement, _ attribute: CFString) -> CGPoint? {
    guard let raw = copyAttribute(element, attribute),
          CFGetTypeID(raw) == AXValueGetTypeID() else { return nil }
    let value = raw as! AXValue
    guard AXValueGetType(value) == .cgPoint else { return nil }
    var point = CGPoint.zero
    guard AXValueGetValue(value, .cgPoint, &point) else { return nil }
    return point
}

func sizeAttribute(_ element: AXUIElement, _ attribute: CFString) -> CGSize? {
    guard let raw = copyAttribute(element, attribute),
          CFGetTypeID(raw) == AXValueGetTypeID() else { return nil }
    let value = raw as! AXValue
    guard AXValueGetType(value) == .cgSize else { return nil }
    var size = CGSize.zero
    guard AXValueGetValue(value, .cgSize, &size) else { return nil }
    return size
}

func bounds(_ element: AXUIElement) -> Bounds? {
    guard let point = pointAttribute(element, kAXPositionAttribute as CFString),
          let size = sizeAttribute(element, kAXSizeAttribute as CFString) else {
        return nil
    }
    return [
        "x": Double(point.x),
        "y": Double(point.y),
        "width": Double(size.width),
        "height": Double(size.height),
    ]
}

func cgRect(_ value: Bounds) -> CGRect {
    return CGRect(
        x: value["x"] ?? 0,
        y: value["y"] ?? 0,
        width: value["width"] ?? 0,
        height: value["height"] ?? 0
    )
}

func axVisibleFrame(_ screen: NSScreen, primaryTop: CGFloat) -> CGRect {
    let visible = screen.visibleFrame
    return CGRect(
        x: visible.origin.x,
        y: primaryTop - visible.maxY,
        width: visible.width,
        height: visible.height
    )
}

func visibleFrameForWindow(_ current: CGRect) -> CGRect? {
    guard let primary = NSScreen.screens.first else { return nil }
    let primaryTop = primary.frame.maxY
    let center = CGPoint(x: current.midX, y: current.midY)
    let candidates = NSScreen.screens.map { axVisibleFrame($0, primaryTop: primaryTop) }

    if let containing = candidates.first(where: { $0.contains(center) }) {
        return containing
    }

    return candidates.max { left, right in
        left.intersection(current).width * left.intersection(current).height <
        right.intersection(current).width * right.intersection(current).height
    }
}

func setBounds(_ element: AXUIElement, _ desired: CGRect) -> AXError {
    var position = desired.origin
    var size = desired.size
    guard let positionValue = AXValueCreate(.cgPoint, &position),
          let sizeValue = AXValueCreate(.cgSize, &size) else {
        return .failure
    }

    let positionResult = AXUIElementSetAttributeValue(
        element,
        kAXPositionAttribute as CFString,
        positionValue
    )
    guard positionResult == .success else { return positionResult }

    let sizeResult = AXUIElementSetAttributeValue(
        element,
        kAXSizeAttribute as CFString,
        sizeValue
    )
    guard sizeResult == .success else { return sizeResult }

    // Some applications constrain the origin while resizing. Reapply the
    // desired position so the final state is driven toward the same frame.
    return AXUIElementSetAttributeValue(
        element,
        kAXPositionAttribute as CFString,
        positionValue
    )
}

func dictionary(_ rect: CGRect) -> Bounds {
    return [
        "x": Double(rect.origin.x),
        "y": Double(rect.origin.y),
        "width": Double(rect.width),
        "height": Double(rect.height),
    ]
}

let args = CommandLine.arguments
if args.count < 4 {
    emit([
        "ok": false,
        "error": "USAGE",
        "detail": "usage: macos-window-bounds <pid> <exact-title> <observe|maximize|set> [x y width height]",
    ], exitCode: 2)
}

guard let parsedPid = Int32(args[1]), parsedPid > 0 else {
    emit(["ok": false, "error": "INVALID_PID"], exitCode: 3)
}

let expectedTitle = args[2]
let mode = args[3]
guard ["observe", "maximize", "set"].contains(mode) else {
    emit(["ok": false, "error": "INVALID_MODE", "mode": mode], exitCode: 4)
}

if mode == "set" && args.count != 8 {
    emit(["ok": false, "error": "SET_BOUNDS_REQUIRED"], exitCode: 5)
}

let app = AXUIElementCreateApplication(parsedPid)
var windowsValue: CFTypeRef?
let windowsResult = AXUIElementCopyAttributeValue(
    app,
    kAXWindowsAttribute as CFString,
    &windowsValue
)

guard windowsResult == .success,
      let rawWindows = windowsValue,
      let windows = rawWindows as? [AXUIElement] else {
    emit([
        "ok": false,
        "error": "WINDOWS_UNAVAILABLE",
        "axError": windowsResult.rawValue,
        "pid": Int(parsedPid),
    ], exitCode: 6)
}

let matches = windows.filter {
    stringAttribute($0, kAXTitleAttribute as CFString) == expectedTitle
}

guard matches.count == 1 else {
    emit([
        "ok": false,
        "error": matches.isEmpty ? "WINDOW_NOT_FOUND" : "WINDOW_AMBIGUOUS",
        "pid": Int(parsedPid),
        "title": expectedTitle,
        "matchCount": matches.count,
    ], exitCode: matches.isEmpty ? 7 : 8)
}

let window = matches[0]
guard let before = bounds(window) else {
    emit([
        "ok": false,
        "error": "WINDOW_BOUNDS_UNAVAILABLE",
        "pid": Int(parsedPid),
        "title": expectedTitle,
    ], exitCode: 9)
}

var positionSettable = DarwinBoolean(false)
var sizeSettable = DarwinBoolean(false)
let positionSettableResult = AXUIElementIsAttributeSettable(
    window,
    kAXPositionAttribute as CFString,
    &positionSettable
)
let sizeSettableResult = AXUIElementIsAttributeSettable(
    window,
    kAXSizeAttribute as CFString,
    &sizeSettable
)

var desired: CGRect? = nil
if mode == "maximize" {
    desired = visibleFrameForWindow(cgRect(before))
    if desired == nil {
        emit(["ok": false, "error": "VISIBLE_SCREEN_UNAVAILABLE"], exitCode: 10)
    }
} else if mode == "set" {
    guard let x = Double(args[4]),
          let y = Double(args[5]),
          let width = Double(args[6]),
          let height = Double(args[7]),
          width > 0,
          height > 0 else {
        emit(["ok": false, "error": "INVALID_BOUNDS"], exitCode: 11)
    }
    desired = CGRect(x: x, y: y, width: width, height: height)
}

if let target = desired {
    guard positionSettableResult == .success,
          sizeSettableResult == .success,
          positionSettable.boolValue,
          sizeSettable.boolValue else {
        emit([
            "ok": false,
            "error": "WINDOW_BOUNDS_NOT_SETTABLE",
            "positionSettable": positionSettable.boolValue,
            "sizeSettable": sizeSettable.boolValue,
            "positionAxError": positionSettableResult.rawValue,
            "sizeAxError": sizeSettableResult.rawValue,
            "before": before,
        ], exitCode: 12)
    }

    let result = setBounds(window, target)
    guard result == .success else {
        emit([
            "ok": false,
            "error": "WINDOW_BOUNDS_SET_FAILED",
            "axError": result.rawValue,
            "before": before,
            "desired": dictionary(target),
        ], exitCode: 13)
    }
}

let after = bounds(window)
emit([
    "ok": true,
    "pid": Int(parsedPid),
    "title": expectedTitle,
    "mode": mode,
    "matchCount": matches.count,
    "positionSettable": positionSettableResult == .success ? positionSettable.boolValue : false,
    "sizeSettable": sizeSettableResult == .success ? sizeSettable.boolValue : false,
    "before": before,
    "desired": desired == nil ? NSNull() : dictionary(desired!),
    "after": after ?? NSNull(),
    "method": "AXWindows exact-title + AXPosition + AXSize",
], exitCode: 0)
