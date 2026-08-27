import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var resultLabel: NSTextField!

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 280),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "RumiAI Menu Bar Discovery Fixture"

        let title = NSTextField(labelWithString: "RumiAI native menu bar discovery")
        title.frame = NSRect(x: 60, y: 175, width: 400, height: 30)
        title.alignment = .center
        window.contentView?.addSubview(title)

        resultLabel = NSTextField(labelWithString: "Menu Result: none")
        resultLabel.frame = NSRect(x: 60, y: 125, width: 400, height: 30)
        resultLabel.alignment = .center
        window.contentView?.addSubview(resultLabel)

        let mainMenu = NSMenu()
        mainMenu.autoenablesItems = false

        let appItem = NSMenuItem(title: "RumiAI Menu Fixture", action: nil, keyEquivalent: "")
        let appMenu = NSMenu(title: "RumiAI Menu Fixture")
        appMenu.autoenablesItems = false
        appMenu.addItem(NSMenuItem(title: "About RumiAI Menu Fixture", action: nil, keyEquivalent: ""))
        appMenu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit RumiAI Menu Fixture", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenu.addItem(quit)
        appItem.submenu = appMenu
        mainMenu.addItem(appItem)

        let actionsItem = NSMenuItem(title: "RumiAI Actions", action: nil, keyEquivalent: "")
        let actionsMenu = NSMenu(title: "RumiAI Actions")
        actionsMenu.autoenablesItems = false

        let alpha = NSMenuItem(title: "Alpha Action", action: #selector(alphaAction), keyEquivalent: "a")
        alpha.target = self
        alpha.isEnabled = true
        actionsMenu.addItem(alpha)

        let disabled = NSMenuItem(title: "Disabled Action", action: #selector(disabledAction), keyEquivalent: "")
        disabled.target = self
        disabled.isEnabled = false
        actionsMenu.addItem(disabled)

        let submenuItem = NSMenuItem(title: "Nested Group", action: nil, keyEquivalent: "")
        let submenu = NSMenu(title: "Nested Group")
        submenu.autoenablesItems = false
        let nested = NSMenuItem(title: "Nested Action", action: #selector(nestedAction), keyEquivalent: "n")
        nested.target = self
        nested.isEnabled = true
        submenu.addItem(nested)
        submenuItem.submenu = submenu
        actionsMenu.addItem(submenuItem)

        actionsItem.submenu = actionsMenu
        mainMenu.addItem(actionsItem)
        NSApp.mainMenu = mainMenu

        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func alphaAction() {
        resultLabel.stringValue = "Menu Result: alpha"
    }

    @objc func disabledAction() {
        resultLabel.stringValue = "Menu Result: disabled"
    }

    @objc func nestedAction() {
        resultLabel.stringValue = "Menu Result: nested"
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
