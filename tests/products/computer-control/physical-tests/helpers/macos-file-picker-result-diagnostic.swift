import ApplicationServices
import Foundation
import Darwin

struct Output: Codable {
    let ok: Bool
    let values: [String]
    let error: String?
}

func copyAttribute(_ element: AXUIElement, _ attribute: CFString) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, attribute, &value) == .success ? value : nil
}
func stringAttribute(_ element: AXUIElement, _ attribute: CFString) -> String? {
    guard let raw = copyAttribute(element, attribute), CFGetTypeID(raw) == CFStringGetTypeID() else { return nil }
    return raw as? String
}
func children(_ element: AXUIElement) -> [AXUIElement] {
    guard let raw = copyAttribute(element, kAXChildrenAttribute as CFString) else { return [] }
    return raw as? [AXUIElement] ?? []
}
func emit(_ output: Output, _ code: Int32) -> Never {
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    if let data = try? encoder.encode(output) { FileHandle.standardOutput.write(data); FileHandle.standardOutput.write(Data("\n".utf8)) }
    Darwin.exit(code)
}

guard CommandLine.arguments.count == 2, let parsed = Int32(CommandLine.arguments[1]), parsed > 0 else {
    emit(Output(ok:false, values:[], error:"INVALID_PID"), 2)
}
guard AXIsProcessTrusted() else {
    emit(Output(ok:false, values:[], error:"ACCESSIBILITY_PERMISSION_REQUIRED"), 3)
}
let app = AXUIElementCreateApplication(pid_t(parsed))
var queue: [AXUIElement] = [app]
var values: [String] = []
var visited = 0
while !queue.isEmpty && visited < 20000 {
    let element = queue.removeFirst(); visited += 1
    let role = stringAttribute(element, kAXRoleAttribute as CFString) ?? ""
    if role == (kAXStaticTextRole as String) || role == (kAXTextFieldRole as String) {
        if let value = stringAttribute(element, kAXValueAttribute as CFString), value.hasPrefix("Picker Result:") {
            values.append(value)
        }
    }
    queue.append(contentsOf: children(element))
}
emit(Output(ok:true, values:Array(Set(values)).sorted(), error:nil), 0)
