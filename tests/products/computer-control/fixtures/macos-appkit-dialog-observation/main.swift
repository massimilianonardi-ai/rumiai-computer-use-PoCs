import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var alert: NSAlert?

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 220),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = ProcessInfo.processInfo.processName

        let label = NSTextField(labelWithString: "RumiAI native dialog observation fixture")
        label.frame = NSRect(x: 50, y: 130, width: 360, height: 30)
        label.alignment = .center
        window.contentView?.addSubview(label)

        let button = NSButton(title: "Show RumiAI Alert", target: self, action: #selector(showAlert))
        button.frame = NSRect(x: 135, y: 65, width: 190, height: 36)
        button.setAccessibilityLabel("Show RumiAI Alert")
        window.contentView?.addSubview(button)

        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func showAlert() {
        guard alert == nil else { return }
        let value = NSAlert()
        value.messageText = "RumiAI Native Alert"
        value.informativeText = "Physical dialog observation"
        value.alertStyle = .informational
        value.addButton(withTitle: "Continue")
        value.addButton(withTitle: "Cancel")
        alert = value
        value.beginSheetModal(for: window) { [weak self] _ in self?.alert = nil }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
