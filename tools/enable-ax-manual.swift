import Cocoa
import ApplicationServices
import Foundation

let args = CommandLine.arguments
if args.count < 2 {
    fputs("usage: enable-ax-manual <bundle-id|-> [name]\n", stderr)
    exit(2)
}

let bundleID = args[1] == "-" ? nil : args[1]
let fallbackName = args.count >= 3 ? args[2] : nil

var app: NSRunningApplication? = nil

if let bundleID = bundleID {
    app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).first
}

if app == nil, let fallbackName = fallbackName {
    app = NSWorkspace.shared.runningApplications.first(where: {
        $0.localizedName == fallbackName ||
        $0.executableURL?.lastPathComponent == fallbackName
    })
}

guard let running = app else {
    fputs("application not found\n", stderr)
    exit(3)
}

let axApp = AXUIElementCreateApplication(running.processIdentifier)
let attribute = "AXManualAccessibility" as CFString
let result = AXUIElementSetAttributeValue(axApp, attribute, kCFBooleanTrue)

print("pid=\(running.processIdentifier) result=\(result.rawValue)")
exit(result == .success ? 0 : 4)
