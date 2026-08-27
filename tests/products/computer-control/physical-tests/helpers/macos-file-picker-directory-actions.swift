import ApplicationServices
import Foundation

struct NodeInfo: Codable {
    let role: String?
    let subrole: String?
    let identifier: String?
    let title: String?
    let value: String?
    let selected: Bool?
    let enabled: Bool?
    let actions: [String]
    let actionDescriptions: [String: String]
    let children: [NodeInfo]
}

struct Output: Codable {
    let ok: Bool
    let name: String
    let row: NodeInfo?
    let list: NodeInfo?
    let sheet: NodeInfo?
    let okButton: NodeInfo?
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
    return nil
}

func boolAttribute(_ element: AXUIElement, _ attribute: CFString) -> Bool? {
    guard let raw = copyAttribute(element, attribute) else { return nil }
    if CFGetTypeID(raw) == CFBooleanGetTypeID() { return CFBooleanGetValue(raw as! CFBoolean) }
    if let number = raw as? NSNumber { return number.boolValue }
    return nil
}

func elements(_ element: AXUIElement, _ attribute: CFString) -> [AXUIElement] {
    guard let raw = copyAttribute(element, attribute) else { return [] }
    return raw as? [AXUIElement] ?? []
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    elements(element, kAXChildrenAttribute as CFString)
}

func role(_ element: AXUIElement) -> String? {
    stringAttribute(element, kAXRoleAttribute as CFString)
}

func identifier(_ element: AXUIElement) -> String? {
    stringAttribute(element, kAXIdentifierAttribute as CFString)
}

func actionNames(_ element: AXUIElement) -> [String] {
    var raw: CFArray?
    guard AXUIElementCopyActionNames(element, &raw) == .success,
          let values = raw as? [String] else { return [] }
    return values
}

func actionDescriptions(_ element: AXUIElement, _ names: [String]) -> [String: String] {
    var result: [String: String] = [:]
    for name in names {
        var raw: CFString?
        if AXUIElementCopyActionDescription(element, name as CFString, &raw) == .success,
           let value = raw as String? {
            result[name] = value
        }
    }
    return result
}

func findFirst(_ root: AXUIElement, depth: Int = 12, predicate: (AXUIElement) -> Bool) -> AXUIElement? {
    if predicate(root) { return root }
    guard depth > 0 else { return nil }
    for child in children(root) {
        if let found = findFirst(child, depth: depth - 1, predicate: predicate) { return found }
    }
    return nil
}

func collect(_ root: AXUIElement, depth: Int = 12, predicate: (AXUIElement) -> Bool, into result: inout [AXUIElement]) {
    if predicate(root) { result.append(root) }
    guard depth > 0 else { return }
    for child in children(root) {
        collect(child, depth: depth - 1, predicate: predicate, into: &result)
    }
}

func hasDescendant(_ root: AXUIElement, identifier expected: String) -> Bool {
    findFirst(root, predicate: { identifier($0) == expected }) != nil
}

func isOpenPanel(_ element: AXUIElement) -> Bool {
    guard role(element) == (kAXSheetRole as String) else { return false }
    if identifier(element) == "open-panel" { return true }
    return hasDescendant(element, identifier: "ListView") &&
        hasDescendant(element, identifier: "OKButton") &&
        hasDescendant(element, identifier: "CancelButton")
}

func itemName(_ row: AXUIElement) -> String? {
    guard let field = findFirst(row, depth: 5, predicate: {
        role($0) == (kAXTextFieldRole as String) && stringAttribute($0, kAXValueAttribute as CFString) != nil
    }), let raw = stringAttribute(field, kAXValueAttribute as CFString) else { return nil }
    let name = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return name.isEmpty ? nil : name
}

func nodeInfo(_ element: AXUIElement, depth: Int) -> NodeInfo {
    let actions = actionNames(element)
    let rawValue = stringAttribute(element, kAXValueAttribute as CFString)
    let childInfos = depth > 0 ? children(element).map { nodeInfo($0, depth: depth - 1) } : []
    return NodeInfo(
        role: role(element),
        subrole: stringAttribute(element, kAXSubroleAttribute as CFString),
        identifier: identifier(element),
        title: stringAttribute(element, kAXTitleAttribute as CFString),
        value: rawValue,
        selected: boolAttribute(element, kAXSelectedAttribute as CFString),
        enabled: boolAttribute(element, kAXEnabledAttribute as CFString),
        actions: actions,
        actionDescriptions: actionDescriptions(element, actions),
        children: childInfos
    )
}

let pid: pid_t = CommandLine.arguments.count > 1 ? pid_t(CommandLine.arguments[1]) ?? 0 : 0
let requestedName = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "FolderA"
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]

func emit(_ output: Output, _ code: Int32) -> Never {
    if let data = try? encoder.encode(output) {
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data("\n".utf8))
    }
    exit(code)
}

func fail(_ error: String, _ detail: String) -> Never {
    emit(Output(ok: false, name: requestedName, row: nil, list: nil, sheet: nil, okButton: nil, error: error, detail: detail), 1)
}

guard pid > 0 else { fail("FILE_PICKER_TARGET_PID_UNAVAILABLE", "positive application pid required") }
guard !requestedName.isEmpty else { fail("FILE_PICKER_ITEM_NAME_REQUIRED", "non-empty item name required") }

let application = AXUIElementCreateApplication(pid)
let windows = elements(application, kAXWindowsAttribute as CFString)
var sheets: [AXUIElement] = []
for window in windows { collect(window, predicate: isOpenPanel, into: &sheets) }
guard sheets.count == 1 else {
    fail(sheets.isEmpty ? "FILE_PICKER_NOT_FOUND" : "FILE_PICKER_AMBIGUOUS", "expected exactly one picker; observed \(sheets.count)")
}
let sheet = sheets[0]
guard let list = findFirst(sheet, predicate: { identifier($0) == "ListView" }) else {
    fail("FILE_PICKER_LIST_UNAVAILABLE", "native picker list view unavailable")
}
var rows: [AXUIElement] = []
collect(list, depth: 3, predicate: { role($0) == (kAXRowRole as String) }, into: &rows)
let matches = rows.filter { itemName($0) == requestedName }
guard matches.count == 1 else {
    fail(matches.isEmpty ? "FILE_PICKER_ITEM_NOT_FOUND" : "FILE_PICKER_ITEM_AMBIGUOUS", "expected exactly one row named \(requestedName); observed \(matches.count)")
}
let row = matches[0]
let okButton = findFirst(sheet, predicate: { identifier($0) == "OKButton" })
emit(Output(
    ok: true,
    name: requestedName,
    row: nodeInfo(row, depth: 6),
    list: nodeInfo(list, depth: 0),
    sheet: nodeInfo(sheet, depth: 0),
    okButton: okButton.map { nodeInfo($0, depth: 0) },
    error: nil,
    detail: nil
), 0)
