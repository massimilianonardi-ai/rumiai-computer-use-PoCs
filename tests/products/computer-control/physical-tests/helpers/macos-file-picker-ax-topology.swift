import AppKit
import ApplicationServices
import Foundation

struct Node: Codable {
    let role: String?
    let subrole: String?
    let title: String?
    let description: String?
    let value: String?
    let identifier: String?
    let enabled: Bool?
    let focused: Bool?
    let selected: Bool?
    let children: [Node]
}

struct WindowRecord: Codable {
    let role: String?
    let subrole: String?
    let title: String?
    let document: String?
    let tree: Node
}

struct ProcessRecord: Codable {
    let pid: Int32
    let name: String?
    let bundleIdentifier: String?
    let activationPolicy: Int
    let windows: [WindowRecord]
    let markerMatches: [String]
}

struct Output: Codable {
    let ok: Bool
    let hostPid: Int32?
    let hostName: String?
    let hostBundleIdentifier: String?
    let focusedApplicationPid: Int32?
    let focusedApplicationName: String?
    let focusedApplicationBundleIdentifier: String?
    let candidates: [ProcessRecord]
    let markerTokens: [String]
    let method: String
}

func copyAttribute(_ element: AXUIElement, _ attribute: CFString) -> CFTypeRef? {
    var value: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, attribute, &value)
    return error == .success ? value : nil
}

func stringAttribute(_ element: AXUIElement, _ attribute: CFString) -> String? {
    guard let raw = copyAttribute(element, attribute) else { return nil }
    if CFGetTypeID(raw) == CFStringGetTypeID() { return raw as? String }
    if CFGetTypeID(raw) == CFURLGetTypeID(), let url = raw as? URL { return url.path }
    return nil
}

func boolAttribute(_ element: AXUIElement, _ attribute: CFString) -> Bool? {
    guard let raw = copyAttribute(element, attribute) else { return nil }
    if CFGetTypeID(raw) == CFBooleanGetTypeID() { return CFBooleanGetValue((raw as! CFBoolean)) }
    if let number = raw as? NSNumber { return number.boolValue }
    return nil
}

func elementArray(_ element: AXUIElement, _ attribute: CFString) -> [AXUIElement] {
    guard let raw = copyAttribute(element, attribute) else { return [] }
    return raw as? [AXUIElement] ?? []
}

func node(_ element: AXUIElement, depth: Int, budget: inout Int) -> Node {
    budget -= 1
    let role = stringAttribute(element, kAXRoleAttribute as CFString)
    let subrole = stringAttribute(element, kAXSubroleAttribute as CFString)
    let title = stringAttribute(element, kAXTitleAttribute as CFString)
    let description = stringAttribute(element, kAXDescriptionAttribute as CFString)
    let identifier = stringAttribute(element, kAXIdentifierAttribute as CFString)
    let enabled = boolAttribute(element, kAXEnabledAttribute as CFString)
    let focused = boolAttribute(element, kAXFocusedAttribute as CFString)
    let selected = boolAttribute(element, kAXSelectedAttribute as CFString)
    var value: String? = nil
    if let raw = copyAttribute(element, kAXValueAttribute as CFString), CFGetTypeID(raw) == CFStringGetTypeID() {
        value = raw as? String
    }
    var children: [Node] = []
    if depth > 0 && budget > 0 {
        for child in elementArray(element, kAXChildrenAttribute as CFString) {
            if budget <= 0 { break }
            children.append(node(child, depth: depth - 1, budget: &budget))
        }
    }
    return Node(role: role, subrole: subrole, title: title, description: description, value: value, identifier: identifier, enabled: enabled, focused: focused, selected: selected, children: children)
}

func flattenStrings(_ value: Node, into strings: inout [String]) {
    for part in [value.role, value.subrole, value.title, value.description, value.value, value.identifier] {
        if let part, !part.isEmpty { strings.append(part) }
    }
    for child in value.children { flattenStrings(child, into: &strings) }
}

func runningRecord(_ app: NSRunningApplication, markers: [String]) -> ProcessRecord? {
    let axApp = AXUIElementCreateApplication(app.processIdentifier)
    let windows = elementArray(axApp, kAXWindowsAttribute as CFString)
    if windows.isEmpty { return nil }
    var records: [WindowRecord] = []
    var matches = Set<String>()
    for window in windows.prefix(8) {
        var budget = 700
        let tree = node(window, depth: 8, budget: &budget)
        var strings: [String] = []
        flattenStrings(tree, into: &strings)
        let joined = strings.joined(separator: "\n")
        for marker in markers where joined.localizedCaseInsensitiveContains(marker) { matches.insert(marker) }
        records.append(WindowRecord(
            role: stringAttribute(window, kAXRoleAttribute as CFString),
            subrole: stringAttribute(window, kAXSubroleAttribute as CFString),
            title: stringAttribute(window, kAXTitleAttribute as CFString),
            document: stringAttribute(window, kAXDocumentAttribute as CFString),
            tree: tree
        ))
    }
    if matches.isEmpty { return nil }
    return ProcessRecord(
        pid: app.processIdentifier,
        name: app.localizedName,
        bundleIdentifier: app.bundleIdentifier,
        activationPolicy: app.activationPolicy.rawValue,
        windows: records,
        markerMatches: Array(matches).sorted()
    )
}

let hostBundle = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""
let markers = CommandLine.arguments.count > 2 ? Array(CommandLine.arguments.dropFirst(2)) : ["RumiAI Native File Picker", "RumiAI file picker discovery", "Alpha.txt", "Beta.txt", "FolderA", "Choose", "Cancel"]
let running = NSWorkspace.shared.runningApplications
let host = running.first(where: { $0.bundleIdentifier == hostBundle })

let systemWide = AXUIElementCreateSystemWide()
var focusedElementRaw: CFTypeRef?
let focusedError = AXUIElementCopyAttributeValue(systemWide, kAXFocusedApplicationAttribute as CFString, &focusedElementRaw)
var focusedPid: pid_t = 0
if focusedError == .success, let focusedRaw = focusedElementRaw {
    let focusedElement = focusedRaw as! AXUIElement
    AXUIElementGetPid(focusedElement, &focusedPid)
}
let focusedApp = running.first(where: { $0.processIdentifier == focusedPid })

var candidates: [ProcessRecord] = []
for app in running {
    if let record = runningRecord(app, markers: markers) { candidates.append(record) }
}
candidates.sort { lhs, rhs in
    if lhs.markerMatches.count != rhs.markerMatches.count { return lhs.markerMatches.count > rhs.markerMatches.count }
    return lhs.pid < rhs.pid
}

let output = Output(
    ok: host != nil && focusedPid > 0 && !candidates.isEmpty,
    hostPid: host?.processIdentifier,
    hostName: host?.localizedName,
    hostBundleIdentifier: host?.bundleIdentifier,
    focusedApplicationPid: focusedPid > 0 ? focusedPid : nil,
    focusedApplicationName: focusedApp?.localizedName,
    focusedApplicationBundleIdentifier: focusedApp?.bundleIdentifier,
    candidates: candidates,
    markerTokens: markers,
    method: "macos-systemwide-AX-file-picker-topology-discovery"
)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let data = try encoder.encode(output)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
exit(output.ok ? 0 : 1)
