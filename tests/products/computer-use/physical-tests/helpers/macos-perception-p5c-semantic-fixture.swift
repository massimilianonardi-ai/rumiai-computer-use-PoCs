import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var targetButton: NSButton!

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 220),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = ProcessInfo.processInfo.processName

        let label = NSTextField(labelWithString: "RumiAI P5C semantic-first fixture")
        label.frame = NSRect(x: 50, y: 130, width: 360, height: 30)
        label.alignment = .center
        window.contentView?.addSubview(label)

        let button = NSButton(radioButtonWithTitle: "RUMIAI SEMANTIC 731", target: self, action: #selector(openSemanticTarget(_:)))
        button.frame = NSRect(x: 125, y: 65, width: 210, height: 36)
        button.state = .off
        button.setAccessibilityLabel("RUMIAI SEMANTIC 731")
        window.contentView?.addSubview(button)
        targetButton = button

        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func openSemanticTarget(_ sender: NSButton) {
        sender.state = .on
        window.title = "RUMIAI SEMANTIC 731"
        window.makeKeyAndOrderFront(nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
