import AppKit
import ApplicationServices
import Foundation

struct Node: Codable {
    let depth: Int
    let role: String?
    let subrole: String?
    let title: String?
    let value: String?
    let desc: String?
    let identifier: String?
    let enabled: Bool?
    let actions: [String]
    let attributes: [String]
    let childCount: Int
}

struct Surface: Codable {
    let label: String
    let bundleIdentifier: String
    let runningCount: Int
    let localizedName: String?
    let pid: Int32?
    let appRole: String?
    let extrasMenuBarPresent: Bool
    let extrasMenuBarRole: String?
    let nodes: [Node]
    let extrasNodes: [Node]
}

struct Output: Codable {
    let ok: Bool
    let method: String
    let dock: Surface
    let menuExtraCandidates: [Surface]
    let error: String?
    let detail: String?
}

func copyAttribute(_ element: AXUIElement, _ attribute: CFString) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, attribute, &value) == .success ? value : nil
}

func stringAttribute(_ element: AXUIElement, _ attribute: CFString) -> String? {
    guard let raw = copyAttribute(element, attribute) else { return nil }
    if CFGetTypeID(raw) == CFStringGetTypeID() { return raw as? String }
    if CFGetTypeID(raw) == CFURLGetTypeID(), let url = raw as? URL { return url.absoluteString }
    return nil
}

func boolAttribute(_ element: AXUIElement, _ attribute: CFString) -> Bool? {
    guard let raw = copyAttribute(element, attribute) else { return nil }
    if CFGetTypeID(raw) == CFBooleanGetTypeID() { return CFBooleanGetValue(raw as! CFBoolean) }
    if let number = raw as? NSNumber { return number.boolValue }
    return nil
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    guard let raw = copyAttribute(element, kAXChildrenAttribute as CFString) else { return [] }
    return raw as? [AXUIElement] ?? []
}

func actionNames(_ element: AXUIElement) -> [String] {
    var names: CFArray?
    guard AXUIElementCopyActionNames(element, &names) == .success, let values = names as? [String] else { return [] }
    return values.sorted()
}

func attributeNames(_ element: AXUIElement) -> [String] {
    var names: CFArray?
    guard AXUIElementCopyAttributeNames(element, &names) == .success, let values = names as? [String] else { return [] }
    return values.sorted()
}

func snapshot(_ root: AXUIElement, maxDepth: Int = 6, maxNodes: Int = 1500) -> [Node] {
    var result: [Node] = []
    func visit(_ element: AXUIElement, depth: Int) {
        if result.count >= maxNodes || depth > maxDepth { return }
        let kids = children(element)
        result.append(Node(
            depth: depth,
            role: stringAttribute(element, kAXRoleAttribute as CFString),
            subrole: stringAttribute(element, kAXSubroleAttribute as CFString),
            title: stringAttribute(element, kAXTitleAttribute as CFString),
            value: stringAttribute(element, kAXValueAttribute as CFString),
            desc: stringAttribute(element, kAXDescriptionAttribute as CFString),
            identifier: stringAttribute(element, kAXIdentifierAttribute as CFString),
            enabled: boolAttribute(element, kAXEnabledAttribute as CFString),
            actions: actionNames(element),
            attributes: attributeNames(element),
            childCount: kids.count
        ))
        for child in kids { visit(child, depth: depth + 1) }
    }
    visit(root, depth: 0)
    return result
}

func runningApplications(_ bundleIdentifier: String) -> [NSRunningApplication] {
    return NSRunningApplication.runningApplications(withBundleIdentifier: bundleIdentifier)
}

func surface(label: String, bundleIdentifier: String) -> Surface {
    let running = runningApplications(bundleIdentifier)
    guard let instance = running.first else {
        return Surface(label: label, bundleIdentifier: bundleIdentifier, runningCount: 0, localizedName: nil, pid: nil, appRole: nil, extrasMenuBarPresent: false, extrasMenuBarRole: nil, nodes: [], extrasNodes: [])
    }
    let pid = instance.processIdentifier
    let app = AXUIElementCreateApplication(pid)
    let extras = copyAttribute(app, kAXExtrasMenuBarAttribute as CFString) as! AXUIElement?
    return Surface(
        label: label,
        bundleIdentifier: bundleIdentifier,
        runningCount: running.count,
        localizedName: instance.localizedName,
        pid: pid,
        appRole: stringAttribute(app, kAXRoleAttribute as CFString),
        extrasMenuBarPresent: extras != nil,
        extrasMenuBarRole: extras.flatMap { stringAttribute($0, kAXRoleAttribute as CFString) },
        nodes: snapshot(app),
        extrasNodes: extras.map { snapshot($0) } ?? []
    )
}

let method = "macos-system-chrome-read-only-topology-discovery"
let dock = surface(label: "dock", bundleIdentifier: "com.apple.dock")
let candidates = [
    surface(label: "system-ui-server", bundleIdentifier: "com.apple.systemuiserver"),
    surface(label: "control-center", bundleIdentifier: "com.apple.controlcenter")
]
let output = Output(ok: true, method: method, dock: dock, menuExtraCandidates: candidates, error: nil, detail: nil)
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
let data = try encoder.encode(output)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
