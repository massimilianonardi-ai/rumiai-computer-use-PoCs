import AppKit
import Foundation

struct Marker: Codable {
    let id: String
    let x: Double
    let y: Double
    let width: Double
    let height: Double
    let color: String
}

struct Ready: Codable {
    let state: String
    let displayWidth: Double
    let displayHeight: Double
    let markers: [Marker]
}

final class FixtureDelegate: NSObject, NSApplicationDelegate {
    var windows: [NSWindow] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let screen = NSScreen.screens.first(where: { abs($0.frame.origin.x) < 0.5 && abs($0.frame.origin.y) < 0.5 }) ?? NSScreen.main ?? NSScreen.screens.first else {
            fputs("fixture-error=no-primary-screen\n", stderr)
            NSApp.terminate(nil)
            return
        }

        let frame = screen.frame
        let w = Double(frame.width)
        let h = Double(frame.height)

        let markerA = Marker(
            id: "a",
            x: floor(w * 0.17),
            y: floor(h * 0.23),
            width: min(140.0, max(96.0, floor(w * 0.09))),
            height: min(110.0, max(72.0, floor(h * 0.08))),
            color: "magenta"
        )
        let markerB = Marker(
            id: "b",
            x: floor(w * 0.68),
            y: floor(h * 0.64),
            width: min(170.0, max(110.0, floor(w * 0.10))),
            height: min(120.0, max(80.0, floor(h * 0.09))),
            color: "cyan"
        )

        makeWindow(screen: screen, marker: markerA, color: NSColor(deviceRed: 1, green: 0, blue: 1, alpha: 1))
        makeWindow(screen: screen, marker: markerB, color: NSColor(deviceRed: 0, green: 1, blue: 1, alpha: 1))

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            let ready = Ready(state: "READY", displayWidth: w, displayHeight: h, markers: [markerA, markerB])
            let data = try! JSONEncoder().encode(ready)
            FileHandle.standardOutput.write(data)
            FileHandle.standardOutput.write(Data([0x0a]))
            fflush(stdout)
        }
    }

    private func makeWindow(screen: NSScreen, marker: Marker, color: NSColor) {
        let screenFrame = screen.frame
        let cocoaX = screenFrame.minX + marker.x
        let cocoaY = screenFrame.maxY - marker.y - marker.height
        let rect = NSRect(x: cocoaX, y: cocoaY, width: marker.width, height: marker.height)
        let window = NSWindow(
            contentRect: rect,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false,
            screen: screen
        )
        window.isOpaque = true
        window.backgroundColor = color
        window.hasShadow = false
        window.level = .screenSaver
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        window.ignoresMouseEvents = true
        window.orderFrontRegardless()
        windows.append(window)
    }
}

@main
struct Main {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let delegate = FixtureDelegate()
        app.delegate = delegate
        app.run()
        _ = delegate
    }
}
