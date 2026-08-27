import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var panel: NSOpenPanel?

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 240),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "RumiAI Native File Picker Discovery Fixture"

        let label = NSTextField(labelWithString: "RumiAI native NSOpenPanel topology discovery")
        label.frame = NSRect(x: 60, y: 125, width: 400, height: 30)
        label.alignment = .center
        window.contentView?.addSubview(label)

        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.showPicker()
        }
    }

    func showPicker() {
        guard panel == nil else { return }
        let picker = NSOpenPanel()
        picker.title = "RumiAI Native File Picker"
        picker.message = "RumiAI file picker discovery"
        picker.prompt = "Choose"
        picker.canChooseFiles = true
        picker.canChooseDirectories = true
        picker.allowsMultipleSelection = true
        picker.resolvesAliases = false

        if CommandLine.arguments.count > 1 {
            picker.directoryURL = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        }

        panel = picker
        picker.beginSheetModal(for: window) { [weak self] _ in
            self?.panel = nil
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
