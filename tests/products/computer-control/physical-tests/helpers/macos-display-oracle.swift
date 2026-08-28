import AppKit
import CoreGraphics
import Foundation

func rect(_ value: NSRect) -> [String: Any] {
    [
        "x": Double(value.origin.x),
        "y": Double(value.origin.y),
        "width": Double(value.size.width),
        "height": Double(value.size.height)
    ]
}

let mainNumber = NSScreen.main?.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber
let mainID = mainNumber.map { CGDirectDisplayID($0.uint32Value) }

var displays: [[String: Any]] = []
for screen in NSScreen.screens {
    guard let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else { continue }
    let id = CGDirectDisplayID(number.uint32Value)
    displays.append([
        "displayID": Int(id),
        "name": screen.localizedName,
        "frame": rect(screen.frame),
        "visibleFrame": rect(screen.visibleFrame),
        "backingScaleFactor": Double(screen.backingScaleFactor),
        "rotationDegrees": Double(CGDisplayRotation(id)),
        "main": mainID == id,
        "builtin": CGDisplayIsBuiltin(id) != 0,
        "active": CGDisplayIsActive(id) != 0,
        "online": CGDisplayIsOnline(id) != 0
    ])
}

let result: [String: Any] = [
    "ok": true,
    "method": "independent-appkit-coregraphics-display-oracle",
    "displays": displays
]
let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data([0x0A]))
