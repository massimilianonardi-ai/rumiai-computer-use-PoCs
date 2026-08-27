import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var panel: NSOpenPanel?
    var rootPath: String?
    var resultLabel: NSTextField!

    func applicationDidFinishLaunching(_ notification: Notification) {
        rootPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : nil
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 300),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "RumiAI Native File Picker Observation Fixture"

        let label = NSTextField(labelWithString: "RumiAI native NSOpenPanel observation")
        label.frame = NSRect(x: 60, y: 195, width: 400, height: 30)
        label.alignment = .center
        window.contentView?.addSubview(label)

        resultLabel = NSTextField(labelWithString: "Picker Result: none")
        resultLabel.frame = NSRect(x: 60, y: 150, width: 400, height: 30)
        resultLabel.alignment = .center
        window.contentView?.addSubview(resultLabel)

        let button = NSButton(title: "Show RumiAI File Picker", target: self, action: #selector(showPicker))
        button.frame = NSRect(x: 155, y: 85, width: 210, height: 40)
        button.bezelStyle = .rounded
        window.contentView?.addSubview(button)

        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func showPicker() {
        guard panel == nil else { return }
        resultLabel.stringValue = "Picker Result: pending"
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
        picker.beginSheetModal(for: window) { [weak self] response in
            guard let self else { return }
            if response == .OK {
                let names = picker.urls.map { $0.lastPathComponent }.sorted().joined(separator: ",")
                self.resultLabel.stringValue = "Picker Result: accepted \(names)"
            } else if response == .cancel {
                self.resultLabel.stringValue = "Picker Result: cancelled"
            } else {
                self.resultLabel.stringValue = "Picker Result: other \(response.rawValue)"
            }
            self.panel = nil
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
