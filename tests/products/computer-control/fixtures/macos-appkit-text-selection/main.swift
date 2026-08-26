import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!

    func makeTextView(frame: NSRect, label: String, identifier: String, text: String, selection: NSRange) -> NSScrollView {
        let scroll = NSScrollView(frame: frame)
        scroll.borderType = .bezelBorder
        scroll.hasVerticalScroller = true
        let textView = NSTextView(frame: scroll.bounds)
        textView.isEditable = true
        textView.isSelectable = true
        textView.font = NSFont.monospacedSystemFont(ofSize: 18, weight: .regular)
        textView.string = text
        textView.setAccessibilityLabel(label)
        textView.setAccessibilityIdentifier(identifier)
        textView.setSelectedRange(selection)
        scroll.documentView = textView
        return scroll
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 720, height: 420),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "RumiAI Native Text Selection Fixture"

        let root = NSView(frame: window.contentView!.bounds)
        root.autoresizingMask = [.width, .height]
        window.contentView = root

        let selectedLabel = NSTextField(labelWithString: "Selected text fixture")
        selectedLabel.frame = NSRect(x: 30, y: 360, width: 300, height: 24)
        root.addSubview(selectedLabel)

        let selected = makeTextView(
            frame: NSRect(x: 30, y: 220, width: 660, height: 130),
            label: "RumiAI Native Selected Text",
            identifier: "rumiai.native.text.selected",
            text: "A😀BCDE",
            selection: NSRange(location: 1, length: 2)
        )
        root.addSubview(selected)

        let caretLabel = NSTextField(labelWithString: "Caret fixture")
        caretLabel.frame = NSRect(x: 30, y: 180, width: 300, height: 24)
        root.addSubview(caretLabel)

        let caret = makeTextView(
            frame: NSRect(x: 30, y: 40, width: 660, height: 130),
            label: "RumiAI Native Caret Text",
            identifier: "rumiai.native.text.caret",
            text: "0123456",
            selection: NSRange(location: 3, length: 0)
        )
        root.addSubview(caret)

        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
