import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 180),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = ProcessInfo.processInfo.processName
        let label = NSTextField(labelWithString: "RumiAI application lifecycle fixture")
        label.frame = NSRect(x: 40, y: 70, width: 340, height: 30)
        label.alignment = .center
        window.contentView?.addSubview(label)
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

#if REFUSE_TERMINATION
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        return .terminateCancel
    }
#endif

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
