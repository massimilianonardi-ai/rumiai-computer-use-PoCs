import Foundation
import ApplicationServices
import Darwin

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
    let childCount: Int
}

struct Output: Codable {
    let ok: Bool
    let menuBarPresent: Bool
    let menuBarRole: String?
    let nodes: [Node]
    let error: String?
    let detail: String?
}

func copyAttribute(_ element: AXUIElement, _ attribute: CFString) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, attribute, &value) == .success ? value : nil
}

func stringAttribute(_ element: AXUIElement, _ attribute: CFString) -> String? {
    guard let value = copyAttribute(element, attribute) else { return nil }
    return value as? String
}

func boolAttribute(_ element: AXUIElement, _ attribute: CFString) -> Bool? {
    guard let value = copyAttribute(element, attribute) else { return nil }
    if let number = value as? NSNumber { return number.boolValue }
    return nil
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    guard let value = copyAttribute(element, kAXChildrenAttribute as CFString) else { return [] }
    return value as? [AXUIElement] ?? []
}

func actionNames(_ element: AXUIElement) -> [String] {
    var names: CFArray?
    guard AXUIElementCopyActionNames(element, &names) == .success, let names else { return [] }
    return (names as? [String]) ?? []
}

func emit(_ output: Output, exitCode: Int32 = 0) -> Never {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    if let data = try? encoder.encode(output), let text = String(data: data, encoding: .utf8) { print(text) }
    Darwin.exit(exitCode)
}

guard CommandLine.arguments.count == 2 else {
    emit(Output(ok:false,menuBarPresent:false,menuBarRole:nil,nodes:[],error:"INVALID_ARGUMENTS",detail:"usage: helper <pid>"), exitCode:2)
}
guard AXIsProcessTrusted() else {
    emit(Output(ok:false,menuBarPresent:false,menuBarRole:nil,nodes:[],error:"ACCESSIBILITY_PERMISSION_REQUIRED",detail:"macOS Accessibility permission is required"), exitCode:3)
}
guard let pid = Int32(CommandLine.arguments[1]), pid > 0 else {
    emit(Output(ok:false,menuBarPresent:false,menuBarRole:nil,nodes:[],error:"INVALID_PID",detail:"positive pid required"), exitCode:2)
}

let app = AXUIElementCreateApplication(pid_t(pid))
guard let menuBarValue = copyAttribute(app, kAXMenuBarAttribute as CFString), CFGetTypeID(menuBarValue) == AXUIElementGetTypeID() else {
    emit(Output(ok:true,menuBarPresent:false,menuBarRole:nil,nodes:[],error:nil,detail:nil))
}
let menuBar = unsafeBitCast(menuBarValue, to: AXUIElement.self)
let menuBarRole = stringAttribute(menuBar, kAXRoleAttribute as CFString)

var nodes: [Node] = []
var queue: [(AXUIElement, Int)] = [(menuBar, 0)]
var visited = 0
while !queue.isEmpty && visited < 5000 {
    let (element, depth) = queue.removeFirst()
    visited += 1
    let kids = children(element)
    nodes.append(Node(
        depth: depth,
        role: stringAttribute(element, kAXRoleAttribute as CFString),
        subrole: stringAttribute(element, kAXSubroleAttribute as CFString),
        title: stringAttribute(element, kAXTitleAttribute as CFString),
        value: stringAttribute(element, kAXValueAttribute as CFString),
        desc: stringAttribute(element, kAXDescriptionAttribute as CFString),
        identifier: stringAttribute(element, kAXIdentifierAttribute as CFString),
        enabled: boolAttribute(element, kAXEnabledAttribute as CFString),
        actions: actionNames(element),
        childCount: kids.count
    ))
    if depth < 10 {
        for child in kids { queue.append((child, depth + 1)) }
    }
}

emit(Output(ok:true,menuBarPresent:true,menuBarRole:menuBarRole,nodes:nodes,error:nil,detail:nil))
