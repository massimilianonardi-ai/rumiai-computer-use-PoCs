import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var panel: NSOpenPanel?
    var rootPath: String?

    func applicationDidFinishLaunching(_ notification: Notification) {
        rootPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : nil
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 260),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "RumiAI Native File Picker Observation Fixture"

        let label = NSTextField(labelWithString: "RumiAI native NSOpenPanel observation")
        label.frame = NSRect(x: 60, y: 155, width: 400, height: 30)
        label.alignment = .center
        window.contentView?.addSubview(label)

        let button = NSButton(title: "Show RumiAI File Picker", target: self, action: #selector(showPicker))
        button.frame = NSRect(x: 155, y: 90, width: 210, height: 40)
        button.bezelStyle = .rounded
        window.contentView?.addSubview(button)

        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func showPicker() {
        guard panel == nil else { return }
        let picker = NSOpenPanel()
        picker.title = "RumiAI Native File Picker"
        picker.message = "RumiAI file picker observation"
        picker.prompt = "Choose"
        picker.canChooseFiles = true
        picker.canChooseDirectories = true
        picker.allowsMultipleSelection = true
        picker.resolvesAliases = false
        if let rootPath {
            picker.directoryURL = URL(fileURLWithPath: rootPath, isDirectory: true)
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
