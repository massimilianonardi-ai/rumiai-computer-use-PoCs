import AppKit
import Foundation

struct LogicalPoint: Codable {
    let x: Double
    let y: Double
}

struct Ready: Codable {
    let state: String
    let initialPointer: LogicalPoint?
}

func readyFilePath() -> String? {
    let args = CommandLine.arguments
    guard let index = args.firstIndex(of: "--ready-file"), index + 1 < args.count else {
        return nil
    }
    let value = args[index + 1].trimmingCharacters(in: .whitespacesAndNewlines)
    return value.isEmpty ? nil : value
}

func publishReady(_ ready: Ready) {
    guard let data = try? JSONEncoder().encode(ready) else { return }
    if let path = readyFilePath() {
        try? data.write(to: URL(fileURLWithPath: path), options: .atomic)
        return
    }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    fflush(stdout)
}

final class VisualOnlySurface: NSView {
    private var text = "RUMIAI VISUAL 517"

    override var isFlipped: Bool { true }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }

    override func mouseDown(with event: NSEvent) {
        text = "RUMIAI VISUAL DONE 864"
        needsDisplay = true
        displayIfNeeded()
    }

    override func draw(_ dirtyRect: NSRect) {
        NSColor.white.setFill()
        dirtyRect.fill()

        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedSystemFont(ofSize: 32, weight: .bold),
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
    var window: NSWindow?
    var visualPanel: NSPanel?
    var primaryScreen: NSScreen?

    func showVisualOnlyPanel() {
        guard visualPanel == nil, let screen = primaryScreen else { return }
        let screenFrame = screen.frame
        let visualWidth: CGFloat = 500
        let visualHeight: CGFloat = 130
        let logicalX: CGFloat = floor(screenFrame.width * 0.58)
        let logicalY: CGFloat = floor(screenFrame.height * 0.43)
        let visualRect = NSRect(
            x: screenFrame.minX + logicalX,
            y: screenFrame.maxY - logicalY - visualHeight,
            width: visualWidth,
            height: visualHeight
        )
        let panel = NSPanel(
            contentRect: visualRect,
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
        panel.contentView = VisualOnlySurface(frame: NSRect(x: 0, y: 0, width: visualWidth, height: visualHeight))
        panel.orderFrontRegardless()
        visualPanel = panel
        window?.makeKeyAndOrderFront(nil)
    }

    @objc func semanticOpen(_ sender: Any?) {
        window?.title = "RUMIAI SEMANTIC 731"
        showVisualOnlyPanel()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let screen = NSScreen.screens.first(where: {
            abs($0.frame.origin.x) < 0.5 && abs($0.frame.origin.y) < 0.5
        }) ?? NSScreen.main ?? NSScreen.screens.first else {
            fputs("fixture-error=no-primary-screen\n", stderr)
            NSApp.terminate(nil)
            return
        }
        primaryScreen = screen

        let screenFrame = screen.frame
        let windowWidth: CGFloat = 560
        let windowHeight: CGFloat = 260
        let windowRect = NSRect(
            x: screenFrame.minX + 70,
            y: screenFrame.maxY - 90 - windowHeight,
            width: windowWidth,
            height: windowHeight
        )
        let window = NSWindow(
            contentRect: windowRect,
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false,
            screen: screen
        )
        window.title = "RUMIAI P5C FIXTURE"

        let content = NSView(frame: NSRect(x: 0, y: 0, width: windowWidth, height: windowHeight))
        let button = NSButton(
            title: "RUMIAI SEMANTIC 731",
            target: self,
            action: #selector(semanticOpen(_:))
        )
        button.frame = NSRect(x: 110, y: 95, width: 340, height: 48)
        button.bezelStyle = .rounded
        button.setAccessibilityLabel("RUMIAI SEMANTIC 731")
        content.addSubview(button)
        window.contentView = content
        window.makeKeyAndOrderFront(nil)
        self.window = window

        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)

        let mouse = NSEvent.mouseLocation
        let pointerX = Double(mouse.x - screenFrame.minX)
        let pointerY = Double(screenFrame.maxY - mouse.y)
        let pointer: LogicalPoint? = (
            pointerX >= 0 && pointerX <= Double(screenFrame.width) &&
            pointerY >= 0 && pointerY <= Double(screenFrame.height)
        ) ? LogicalPoint(x: pointerX, y: pointerY) : nil

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            publishReady(Ready(state: "READY", initialPointer: pointer))
        }
    }
}

@main struct Main {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        let delegate = FixtureDelegate()
        app.delegate = delegate
        app.run()
        _ = delegate
    }
}
