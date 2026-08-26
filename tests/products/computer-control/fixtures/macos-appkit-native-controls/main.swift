import AppKit

final class OutlineItem: NSObject {
    let title: String
    let children: [OutlineItem]
    init(_ title: String, _ children: [OutlineItem] = []) { self.title = title; self.children = children }
}

final class FlippedView: NSView { override var isFlipped: Bool { true } }

final class AppDelegate: NSObject, NSApplicationDelegate, NSOutlineViewDataSource, NSOutlineViewDelegate {
    var window: NSWindow!
    var disclosureExpanded = false
    let outlineRoot = OutlineItem("Native Parent", [OutlineItem("Native Child", [OutlineItem("Native Grandchild")])])

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 900, height: 720), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "RumiAI Native Controls Fixture"
        let root = NSView(frame: window.contentView!.bounds)
        root.autoresizingMask = [.width, .height]
        window.contentView = root

        let checkbox = NSButton(checkboxWithTitle: "RumiAI Native Checkbox", target: nil, action: nil)
        checkbox.frame = NSRect(x: 24, y: 660, width: 240, height: 28)
        checkbox.state = .off
        checkbox.setAccessibilityIdentifier("rumiai.native.checkbox")
        root.addSubview(checkbox)

        let radioA = NSButton(radioButtonWithTitle: "RumiAI Native Option A", target: self, action: #selector(selectRadio(_:)))
        radioA.frame = NSRect(x: 24, y: 620, width: 220, height: 24); radioA.state = .on; radioA.tag = 1
        radioA.setAccessibilityIdentifier("rumiai.native.radio.a")
        let radioB = NSButton(radioButtonWithTitle: "RumiAI Native Option B", target: self, action: #selector(selectRadio(_:)))
        radioB.frame = NSRect(x: 24, y: 590, width: 220, height: 24); radioB.state = .off; radioB.tag = 2
        radioB.setAccessibilityIdentifier("rumiai.native.radio.b")
        root.addSubview(radioA); root.addSubview(radioB)

        let slider = NSSlider(value: 50, minValue: 0, maxValue: 100, target: nil, action: nil)
        slider.frame = NSRect(x: 24, y: 540, width: 280, height: 28)
        slider.setAccessibilityLabel("RumiAI Native Slider")
        slider.setAccessibilityIdentifier("rumiai.native.slider")
        root.addSubview(slider)

        let stepper = NSStepper(frame: NSRect(x: 320, y: 540, width: 28, height: 28))
        stepper.minValue = 0; stepper.maxValue = 20; stepper.increment = 1; stepper.doubleValue = 10
        stepper.setAccessibilityLabel("RumiAI Native Stepper")
        stepper.setAccessibilityIdentifier("rumiai.native.stepper")
        root.addSubview(stepper)

        let popup = NSPopUpButton(frame: NSRect(x: 24, y: 490, width: 240, height: 30), pullsDown: false)
        popup.addItems(withTitles: ["Native Choice A", "Native Choice B", "Native Choice C"])
        popup.setAccessibilityLabel("RumiAI Native Popup")
        popup.setAccessibilityIdentifier("rumiai.native.popup")
        root.addSubview(popup)

        let disclosure = NSButton(title: "RumiAI Native Disclosure", target: self, action: #selector(toggleDisclosure(_:)))
        disclosure.frame = NSRect(x: 320, y: 490, width: 220, height: 30)
        disclosure.setAccessibilityExpanded(false)
        disclosure.setAccessibilityIdentifier("rumiai.native.disclosure")
        root.addSubview(disclosure)

        let outlineScroll = NSScrollView(frame: NSRect(x: 24, y: 220, width: 350, height: 240))
        outlineScroll.hasVerticalScroller = true
        let outline = NSOutlineView(frame: outlineScroll.bounds)
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("outline")); column.width = 330
        outline.addTableColumn(column); outline.outlineTableColumn = column; outline.headerView = nil
        outline.dataSource = self; outline.delegate = self
        outline.setAccessibilityLabel("RumiAI Native Outline")
        outline.setAccessibilityIdentifier("rumiai.native.outline")
        outlineScroll.documentView = outline
        root.addSubview(outlineScroll)
        outline.reloadData()

        let childrenParent = NSBox(frame: NSRect(x: 24, y: 20, width: 350, height: 170))
        childrenParent.title = ""
        childrenParent.setAccessibilityLabel("RumiAI Native Children Parent")
        childrenParent.setAccessibilityIdentifier("rumiai.native.children.parent")
        let childrenChild = NSBox(frame: NSRect(x: 18, y: 18, width: 310, height: 125))
        childrenChild.title = ""
        childrenChild.setAccessibilityLabel("RumiAI Native Child")
        childrenChild.setAccessibilityIdentifier("rumiai.native.children.child")
        let childrenGrandchild = NSButton(title: "RumiAI Native Grandchild", target: nil, action: nil)
        childrenGrandchild.frame = NSRect(x: 18, y: 18, width: 230, height: 32)
        childrenGrandchild.setAccessibilityIdentifier("rumiai.native.children.grandchild")
        childrenChild.contentView?.addSubview(childrenGrandchild)
        childrenParent.contentView?.addSubview(childrenChild)
        root.addSubview(childrenParent)

        let scroll = NSScrollView(frame: NSRect(x: 420, y: 220, width: 430, height: 468))
        scroll.hasVerticalScroller = true; scroll.hasHorizontalScroller = false; scroll.borderType = .bezelBorder
        scroll.setAccessibilityLabel("RumiAI Native Scroll Area")
        scroll.setAccessibilityIdentifier("rumiai.native.scroll")
        let doc = FlippedView(frame: NSRect(x: 0, y: 0, width: 400, height: 1800))
        let anchor = NSButton(title: "RumiAI Native Scroll Anchor", target: nil, action: nil)
        anchor.frame = NSRect(x: 30, y: 30, width: 240, height: 30); anchor.setAccessibilityIdentifier("rumiai.native.scroll.anchor")
        let deep = NSButton(title: "RumiAI Native Deep Target", target: nil, action: nil)
        deep.frame = NSRect(x: 30, y: 1450, width: 240, height: 30); deep.setAccessibilityIdentifier("rumiai.native.scroll.deep")
        for i in 0..<20 { let label = NSTextField(labelWithString: "Native Row \(i)"); label.frame = NSRect(x: 30, y: 100 + i * 60, width: 220, height: 22); doc.addSubview(label) }
        doc.addSubview(anchor); doc.addSubview(deep); scroll.documentView = doc; root.addSubview(scroll)

        window.center(); window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func selectRadio(_ sender: NSButton) {
        guard let root = window.contentView else { return }
        for view in root.subviews.compactMap({ $0 as? NSButton }).filter({ $0.tag == 1 || $0.tag == 2 }) { view.state = (view === sender) ? .on : .off }
    }

    @objc func toggleDisclosure(_ sender: NSButton) {
        disclosureExpanded.toggle()
        sender.setAccessibilityExpanded(disclosureExpanded)
    }

    func outlineView(_ outlineView: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int { (item as? OutlineItem)?.children.count ?? 1 }
    func outlineView(_ outlineView: NSOutlineView, child index: Int, ofItem item: Any?) -> Any { item == nil ? outlineRoot : (item as! OutlineItem).children[index] }
    func outlineView(_ outlineView: NSOutlineView, isItemExpandable item: Any) -> Bool { !(item as! OutlineItem).children.isEmpty }
    func outlineView(_ outlineView: NSOutlineView, rowViewForItem item: Any) -> NSTableRowView? {
        let model = item as! OutlineItem
        let row = NSTableRowView()
        row.setAccessibilityLabel("RumiAI \(model.title) Row")
        row.setAccessibilityIdentifier("rumiai.native.outline.row." + model.title.lowercased().replacingOccurrences(of: " ", with: "."))
        return row
    }
    func outlineView(_ outlineView: NSOutlineView, viewFor tableColumn: NSTableColumn?, item: Any) -> NSView? {
        let model = item as! OutlineItem
        let field = NSTextField(labelWithString: model.title)
        field.setAccessibilityLabel("RumiAI \(model.title) Row")
        field.setAccessibilityIdentifier("rumiai.native.outline.cell." + model.title.lowercased().replacingOccurrences(of: " ", with: "."))
        return field
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
