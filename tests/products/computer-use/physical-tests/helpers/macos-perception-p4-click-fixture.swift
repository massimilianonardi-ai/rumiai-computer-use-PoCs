import AppKit
import Foundation

struct LogicalPoint: Codable {
    let x: Double
    let y: Double
}

struct TargetRect: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct Ready: Codable {
    let state: String
    let target: TargetRect
    let initialPointer: LogicalPoint?
}

final class ClickSurface: NSView {
    private var text = "RUMIAI CLICK 517"

    override var isFlipped: Bool { true }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }

    override func mouseDown(with event: NSEvent) {
        text = "RUMIAI DONE 864"
        needsDisplay = true
        displayIfNeeded()
    }

    override func draw(_ dirtyRect: NSRect) {
        NSColor.white.setFill()
        dirtyRect.fill()

        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedSystemFont(ofSize: 34, weight: .bold),
            .foregroundColor: NSColor.black,
        ]
        let attributed = NSAttributedString(string: text, attributes: attributes)
        let size = attributed.size()
        let point = NSPoint(
            x: max(CGFloat(8), (bounds.width - size.width) / 2),
            y: max(CGFloat(8), (bounds.height - size.height) / 2)
        )
        attributed.draw(at: point)
    }
}

final class FixtureDelegate: NSObject, NSApplicationDelegate {
    var panel: NSPanel?

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let screen = NSScreen.screens.first(where: {
            abs($0.frame.origin.x) < 0.5 && abs($0.frame.origin.y) < 0.5
        }) ?? NSScreen.main ?? NSScreen.screens.first else {
            fputs("fixture-error=no-primary-screen\n", stderr)
            NSApp.terminate(nil)
            return
        }

        let screenFrame = screen.frame
        let width: CGFloat = 430
        let height: CGFloat = 120
        let logicalX: CGFloat = floor(screenFrame.width * 0.34)
        let logicalY: CGFloat = floor(screenFrame.height * 0.39)
        let rect = NSRect(
            x: screenFrame.minX + logicalX,
            y: screenFrame.maxY - logicalY - height,
            width: width,
            height: height
        )

        let panel = NSPanel(
            contentRect: rect,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false,
            screen: screen
        )
        panel.isOpaque = true
        panel.backgroundColor = .white
        panel.hasShadow = false
        panel.level = .screenSaver
        panel.hidesOnDeactivate = false
        panel.isFloatingPanel = true
        panel.becomesKeyOnlyIfNeeded = true
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        panel.ignoresMouseEvents = false
        panel.contentView = ClickSurface(frame: NSRect(x: 0, y: 0, width: width, height: height))
        panel.orderFrontRegardless()
        self.panel = panel

        let mouse = NSEvent.mouseLocation
        let pointerX = Double(mouse.x - screenFrame.minX)
        let pointerY = Double(screenFrame.maxY - mouse.y)
        let pointer: LogicalPoint? = (
            pointerX >= 0 && pointerX <= Double(screenFrame.width) &&
            pointerY >= 0 && pointerY <= Double(screenFrame.height)
        ) ? LogicalPoint(x: pointerX, y: pointerY) : nil

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            let ready = Ready(
                state: "READY",
                target: TargetRect(
                    x: Double(logicalX),
                    y: Double(logicalY),
                    width: Double(width),
                    height: Double(height)
                ),
                initialPointer: pointer
            )
            if let data = try? JSONEncoder().encode(ready) {
                FileHandle.standardOutput.write(data)
                FileHandle.standardOutput.write(Data([0x0a]))
                fflush(stdout)
            }
        }
    }
}

@main struct Main {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let delegate = FixtureDelegate()
        app.delegate = delegate
        app.run()
        _ = delegate
    }
}
