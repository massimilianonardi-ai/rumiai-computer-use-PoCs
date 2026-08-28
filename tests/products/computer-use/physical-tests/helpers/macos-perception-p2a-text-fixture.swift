import AppKit
import Foundation

struct TextTarget: Codable {
    let id: String
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct Ready: Codable {
    let state: String
    let displayWidth: Double
    let displayHeight: Double
    let targets: [TextTarget]
}

final class FixtureDelegate: NSObject, NSApplicationDelegate {
    var windows: [NSWindow] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let screen = NSScreen.screens.first(where: {
            abs($0.frame.origin.x) < 0.5 && abs($0.frame.origin.y) < 0.5
        }) ?? NSScreen.main ?? NSScreen.screens.first else {
            fputs("fixture-error=no-primary-screen\n", stderr)
            NSApp.terminate(nil)
            return
        }

        let frame = screen.frame
        let width = Double(frame.width)
        let height = Double(frame.height)
        let alpha = TextTarget(
            id: "alpha",
            x: floor(width * 0.14),
            y: floor(height * 0.28),
            width: 360,
            height: 96
        )
        let beta = TextTarget(
            id: "beta",
            x: floor(width * 0.58),
            y: floor(height * 0.62),
            width: 390,
            height: 96
        )

        makeWindow(screen: screen, target: alpha, text: "RUMIAI ALPHA 731")
        makeWindow(screen: screen, target: beta, text: "RUMIAI BETA 942")

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            let ready = Ready(
                state: "READY",
                displayWidth: width,
                displayHeight: height,
                targets: [alpha, beta]
            )
            let data = try! JSONEncoder().encode(ready)
            FileHandle.standardOutput.write(data)
            FileHandle.standardOutput.write(Data([0x0a]))
            fflush(stdout)
        }
    }

    private func makeWindow(screen: NSScreen, target: TextTarget, text: String) {
        let screenFrame = screen.frame
        let cocoaX = screenFrame.minX + target.x
        let cocoaY = screenFrame.maxY - target.y - target.height
        let rect = NSRect(
            x: cocoaX,
            y: cocoaY,
            width: target.width,
            height: target.height
        )
        let window = NSWindow(
            contentRect: rect,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false,
            screen: screen
        )
        window.isOpaque = true
        window.backgroundColor = .white
        window.hasShadow = false
        window.level = .screenSaver
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        window.ignoresMouseEvents = true

        let contentView = NSView(frame: NSRect(origin: .zero, size: rect.size))
        contentView.wantsLayer = true
        contentView.layer?.backgroundColor = NSColor.white.cgColor

        let label = NSTextField(labelWithString: text)
        label.font = NSFont.monospacedSystemFont(ofSize: 34, weight: .bold)
        label.textColor = .black
        label.alignment = .center
        label.frame = NSRect(x: 8, y: 20, width: target.width - 16, height: 56)
        contentView.addSubview(label)
        window.contentView = contentView

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
