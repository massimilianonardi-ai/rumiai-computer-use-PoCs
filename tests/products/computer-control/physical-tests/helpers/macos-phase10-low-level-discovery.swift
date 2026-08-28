import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

func point(_ value: CGPoint) -> [String: Double] {
    ["x": Double(value.x), "y": Double(value.y)]
}

func rect(_ value: CGRect) -> [String: Double] {
    [
        "x": Double(value.origin.x),
        "y": Double(value.origin.y),
        "width": Double(value.size.width),
        "height": Double(value.size.height),
    ]
}

func finite(_ value: CGFloat) -> Bool { value.isFinite }

let mainDisplay = CGMainDisplayID()
let mainBounds = CGDisplayBounds(mainDisplay)

var activeCount: UInt32 = 0
let countError = CGGetActiveDisplayList(0, nil, &activeCount)
var displays = Array(repeating: CGDirectDisplayID(0), count: Int(activeCount))
var returnedCount: UInt32 = 0
let listError = activeCount > 0 ? CGGetActiveDisplayList(activeCount, &displays, &returnedCount) : .success
if returnedCount < activeCount { displays = Array(displays.prefix(Int(returnedCount))) }

let currentEvent = CGEvent(source: nil)
guard let event = currentEvent else {
    let data = try! JSONSerialization.data(withJSONObject: [
        "ok": false,
        "state": "BLOCKED",
        "error": "PHASE10_CURRENT_EVENT_UNAVAILABLE",
    ], options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(2)
}

let quartzLocation = event.location
let unflippedLocation = event.unflippedLocation
let appKitLocation = NSEvent.mouseLocation
let relationTolerance = 1.0
let appKitMatchesUnflipped = abs(Double(appKitLocation.x - unflippedLocation.x)) <= relationTolerance && abs(Double(appKitLocation.y - unflippedLocation.y)) <= relationTolerance
let quartzFlipMatchesMainHeight = abs(Double(unflippedLocation.y - (mainBounds.height - quartzLocation.y))) <= relationTolerance

let mouseMove = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: quartzLocation, mouseButton: .left)
let leftDown = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: quartzLocation, mouseButton: .left)
let leftUp = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: quartzLocation, mouseButton: .left)
let rightDown = CGEvent(mouseEventSource: nil, mouseType: .rightMouseDown, mouseCursorPosition: quartzLocation, mouseButton: .right)
let rightUp = CGEvent(mouseEventSource: nil, mouseType: .rightMouseUp, mouseCursorPosition: quartzLocation, mouseButton: .right)
let scroll = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 2, wheel1: 1, wheel2: 1, wheel3: 0)
let keyDown = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true)
let keyUp = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false)

let accessibilityTrusted = AXIsProcessTrusted()
let screenCapturePreflight = CGPreflightScreenCaptureAccess()
var captureAttempted = false
var captureAvailable = false
var captureWidth: Int? = nil
var captureHeight: Int? = nil

if screenCapturePreflight {
    captureAttempted = true
    if let image = CGDisplayCreateImage(mainDisplay) {
        captureAvailable = true
        captureWidth = image.width
        captureHeight = image.height
    }
}

let windowInfo = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]]
let windowCount = windowInfo?.count ?? 0

let pointerFinite = finite(quartzLocation.x) && finite(quartzLocation.y) && finite(unflippedLocation.x) && finite(unflippedLocation.y) && finite(appKitLocation.x) && finite(appKitLocation.y)
let eventConstruction = [
    "mouseMove": mouseMove != nil,
    "leftDown": leftDown != nil,
    "leftUp": leftUp != nil,
    "rightDown": rightDown != nil,
    "rightUp": rightUp != nil,
    "scroll": scroll != nil,
    "keyDown": keyDown != nil,
    "keyUp": keyUp != nil,
]

let output: [String: Any] = [
    "ok": true,
    "state": "OBSERVED",
    "method": "independent-macos-phase10-low-level-discovery",
    "pointer": [
        "quartzGlobal": point(quartzLocation),
        "unflippedAppKitCompatible": point(unflippedLocation),
        "appKitGlobal": point(appKitLocation),
        "finite": pointerFinite,
        "appKitMatchesUnflipped": appKitMatchesUnflipped,
        "quartzFlipMatchesMainHeight": quartzFlipMatchesMainHeight,
    ],
    "display": [
        "activeCount": Int(activeCount),
        "returnedActiveCount": Int(returnedCount),
        "activeListError": Int(listError.rawValue),
        "activeCountError": Int(countError.rawValue),
        "mainBounds": rect(mainBounds),
        "mainPixelWidth": Int(CGDisplayPixelsWide(mainDisplay)),
        "mainPixelHeight": Int(CGDisplayPixelsHigh(mainDisplay)),
    ],
    "permissions": [
        "accessibilityTrusted": accessibilityTrusted,
        "screenCapturePreflight": screenCapturePreflight,
    ],
    "eventConstruction": eventConstruction,
    "screenCapture": [
        "preflight": screenCapturePreflight,
        "attempted": captureAttempted,
        "available": captureAvailable,
        "width": captureWidth as Any,
        "height": captureHeight as Any,
    ],
    "windowMetadata": [
        "onScreenNonDesktopCount": windowCount,
    ],
    "mutationDelivered": false,
    "screenPermissionRequested": false,
]

let data = try! JSONSerialization.data(withJSONObject: output, options: [.sortedKeys])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data([0x0a]))
