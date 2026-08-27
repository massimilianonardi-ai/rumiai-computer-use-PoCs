import ApplicationServices
import Foundation

struct Output: Codable {
    let ok: Bool
    let name: String
    let rowRole: String?
    let rowSubrole: String?
    let beforeDisclosing: Bool?
    let afterDisclosing: Bool?
    let disclosureRole: String?
    let disclosureIdentifier: String?
    let disclosureActions: [String]
    let pressCode: Int32?
    let visibleNamesAfter: [String]
    let nestedVisible: Bool
    let error: String?
    let detail: String?
}

func copyAttribute(_ element: AXUIElement, _ attribute: CFString) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, attribute, &value) == .success ? value : nil
}
func stringAttribute(_ element: AXUIElement, _ attribute: CFString) -> String? {
    guard let raw = copyAttribute(element, attribute) else { return nil }
    return CFGetTypeID(raw) == CFStringGetTypeID() ? raw as? String : nil
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
func children(_ element: AXUIElement) -> [AXUIElement] { elements(element, kAXChildrenAttribute as CFString) }
func role(_ element: AXUIElement) -> String? { stringAttribute(element, kAXRoleAttribute as CFString) }
func identifier(_ element: AXUIElement) -> String? { stringAttribute(element, kAXIdentifierAttribute as CFString) }
func actionNames(_ element: AXUIElement) -> [String] {
    var raw: CFArray?
    guard AXUIElementCopyActionNames(element, &raw) == .success, let raw else { return [] }
    return raw as? [String] ?? []
}
func findFirst(_ root: AXUIElement, depth: Int = 12, predicate: (AXUIElement) -> Bool) -> AXUIElement? {
    if predicate(root) { return root }
    if depth <= 0 { return nil }
    for child in children(root) { if let found = findFirst(child, depth: depth - 1, predicate: predicate) { return found } }
    return nil
}
func collect(_ root: AXUIElement, depth: Int = 12, predicate: (AXUIElement) -> Bool, into result: inout [AXUIElement]) {
    if predicate(root) { result.append(root) }
    if depth <= 0 { return }
    for child in children(root) { collect(child, depth: depth - 1, predicate: predicate, into: &result) }
}
func hasDescendant(_ root: AXUIElement, identifier expected: String) -> Bool {
    findFirst(root, predicate: { identifier($0) == expected }) != nil
}
func isOpenPanel(_ element: AXUIElement) -> Bool {
    guard role(element) == (kAXSheetRole as String) else { return false }
    if identifier(element) == "open-panel" { return true }
    return hasDescendant(element, identifier: "ListView") && hasDescendant(element, identifier: "OKButton") && hasDescendant(element, identifier: "CancelButton")
}
func itemName(_ row: AXUIElement) -> String? {
    guard let field = findFirst(row, depth: 5, predicate: { role($0) == (kAXTextFieldRole as String) && stringAttribute($0, kAXValueAttribute as CFString) != nil }), let raw = stringAttribute(field, kAXValueAttribute as CFString) else { return nil }
    let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return value.isEmpty ? nil : value
}
func visibleRowNames(_ list: AXUIElement) -> [String] {
    var rows: [AXUIElement] = []
    collect(list, depth: 5, predicate: { role($0) == (kAXRowRole as String) }, into: &rows)
    return rows.compactMap(itemName)
}

let pid: pid_t = CommandLine.arguments.count > 1 ? pid_t(CommandLine.arguments[1]) ?? 0 : 0
let requestedName = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : ""
let nestedName = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : "Nested.txt"
let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
func emit(_ output: Output, _ code: Int32) -> Never {
    if let data = try? encoder.encode(output) { FileHandle.standardOutput.write(data); FileHandle.standardOutput.write(Data("\n".utf8)) }
    exit(code)
}
func fail(_ error: String, _ detail: String) -> Never {
    emit(Output(ok:false,name:requestedName,rowRole:nil,rowSubrole:nil,beforeDisclosing:nil,afterDisclosing:nil,disclosureRole:nil,disclosureIdentifier:nil,disclosureActions:[],pressCode:nil,visibleNamesAfter:[],nestedVisible:false,error:error,detail:detail),1)
}

guard pid > 0 else { fail("INVALID_PID", "positive pid required") }
guard !requestedName.isEmpty else { fail("ITEM_NAME_REQUIRED", "directory item name required") }
let app = AXUIElementCreateApplication(pid)
var sheets: [AXUIElement] = []
for window in elements(app, kAXWindowsAttribute as CFString) { collect(window, predicate: isOpenPanel, into: &sheets) }
guard sheets.count == 1 else { fail("PICKER_COUNT", "expected one picker; observed \(sheets.count)") }
guard let list = findFirst(sheets[0], predicate: { identifier($0) == "ListView" }) else { fail("LIST_NOT_FOUND", "ListView missing") }
var rows: [AXUIElement] = []
collect(list, depth: 5, predicate: { role($0) == (kAXRowRole as String) }, into: &rows)
let matches = rows.filter { itemName($0) == requestedName }
guard matches.count == 1 else { fail("ROW_MATCH", "expected one row named \(requestedName); observed \(matches.count)") }
let row = matches[0]
guard let triangle = findFirst(row, depth: 5, predicate: { role($0) == (kAXDisclosureTriangleRole as String) }) else { fail("DISCLOSURE_NOT_FOUND", "directory row has no AXDisclosureTriangle") }
let actions = actionNames(triangle)
guard actions.contains(kAXPressAction as String) else { fail("DISCLOSURE_PRESS_UNAVAILABLE", "disclosure triangle does not advertise AXPress") }
let before = boolAttribute(row, kAXDisclosingAttribute as CFString)
let pressed = AXUIElementPerformAction(triangle, kAXPressAction as CFString)
Thread.sleep(forTimeInterval: 0.75)
var reboundRows: [AXUIElement] = []
collect(list, depth: 5, predicate: { role($0) == (kAXRowRole as String) }, into: &reboundRows)
let rebound = reboundRows.first(where: { itemName($0) == requestedName })
let after = rebound.flatMap { boolAttribute($0, kAXDisclosingAttribute as CFString) }
let names = visibleRowNames(list)
emit(Output(ok:true,name:requestedName,rowRole:role(row),rowSubrole:stringAttribute(row,kAXSubroleAttribute as CFString),beforeDisclosing:before,afterDisclosing:after,disclosureRole:role(triangle),disclosureIdentifier:identifier(triangle),disclosureActions:actions,pressCode:pressed.rawValue,visibleNamesAfter:names,nestedVisible:names.contains(nestedName),error:nil,detail:nil),0)
