import Foundation
import ApplicationServices
import Darwin

struct ReadResult: Codable {
    let ok: Bool
    let value: String?
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

func elementName(_ element: AXUIElement) -> String? {
    for attribute in [kAXTitleAttribute, kAXDescriptionAttribute, kAXIdentifierAttribute, kAXHelpAttribute] {
        if let value = stringAttribute(element, attribute as CFString), !value.isEmpty { return value }
    }
    return nil
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    guard let value = copyAttribute(element, kAXChildrenAttribute as CFString) else { return [] }
    return value as? [AXUIElement] ?? []
}

func isTextElement(_ element: AXUIElement) -> Bool {
    let role = stringAttribute(element, kAXRoleAttribute as CFString) ?? ""
    return role == "AXTextArea" || role == "AXTextField" || role == "AXComboBox"
}

func emit(_ result: ReadResult, exitCode: Int32 = 0) -> Never {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    if let data = try? encoder.encode(result), let text = String(data: data, encoding: .utf8) { print(text) }
    Darwin.exit(exitCode)
}

guard CommandLine.arguments.count == 3 else {
    emit(ReadResult(ok:false,value:nil,error:"INVALID_ARGUMENTS",detail:"usage: observer <pid> <accessible-name>"), exitCode:2)
}
guard AXIsProcessTrusted() else {
    emit(ReadResult(ok:false,value:nil,error:"ACCESSIBILITY_PERMISSION_REQUIRED",detail:"macOS Accessibility permission is required"), exitCode:3)
}
guard let pid = Int32(CommandLine.arguments[1]), pid > 0 else {
    emit(ReadResult(ok:false,value:nil,error:"INVALID_PID",detail:"positive pid required"), exitCode:2)
}
let requestedName = CommandLine.arguments[2]
let app = AXUIElementCreateApplication(pid_t(pid))
var queue: [AXUIElement] = [app]
var matches: [AXUIElement] = []
var visited = 0
while !queue.isEmpty && visited < 20000 {
    let element = queue.removeFirst()
    visited += 1
    if isTextElement(element), elementName(element) == requestedName {
        matches.append(element)
        if matches.count > 1 { break }
    }
    queue.append(contentsOf: children(element))
}
if matches.isEmpty {
    emit(ReadResult(ok:false,value:nil,error:"TEXT_TARGET_NOT_FOUND",detail:"no native AX text element matched the accessible name"), exitCode:4)
}
if matches.count > 1 {
    emit(ReadResult(ok:false,value:nil,error:"TEXT_TARGET_AMBIGUOUS",detail:"multiple native AX text elements matched the accessible name"), exitCode:5)
}
guard let value = stringAttribute(matches[0], kAXValueAttribute as CFString) else {
    emit(ReadResult(ok:false,value:nil,error:"TEXT_VALUE_UNAVAILABLE",detail:"AXValue is unavailable"), exitCode:6)
}
emit(ReadResult(ok:true,value:value,error:nil,detail:nil))
