import AppKit
import CryptoKit
import Foundation

let method = "independent-macos-clipboard-typed-read-oracle"
let pasteboard = NSPasteboard.general
let arguments = CommandLine.arguments

func emit(_ object: [String: Any], exitCode: Int32) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(exitCode)
}

func fail(_ error: String, _ detail: String, state: String = "FAILED", exitCode: Int32 = 1) -> Never {
    emit(["ok": false, "state": state, "error": error, "detail": detail, "method": method], exitCode: exitCode)
}

guard arguments.count == 4 else {
    fail("ORACLE_INVALID_ARGUMENTS", "Expected revision, item index and canonical format")
}

let requestedRevision = arguments[1]
guard let itemIndex = Int(arguments[2]), itemIndex >= 0 else {
    fail("ORACLE_ITEM_INDEX_INVALID", "Expected non-negative item index")
}
let format = arguments[3]

let aliases: [String: [String]] = [
    "text/plain": [
        NSPasteboard.PasteboardType.string.rawValue,
        "NSStringPboardType",
        "public.utf16-external-plain-text",
        "CorePasteboardFlavorType 0x75743136",
    ],
    "text/html": [
        NSPasteboard.PasteboardType.html.rawValue,
        "Apple HTML pasteboard type",
    ],
    "text/rtf": [
        NSPasteboard.PasteboardType.rtf.rawValue,
        "NeXT Rich Text Format v1.0 pasteboard type",
    ],
    "image/png": [
        NSPasteboard.PasteboardType.png.rawValue,
        "Apple PNG pasteboard type",
    ],
]

guard let candidates = aliases[format] else {
    fail("ORACLE_FORMAT_UNSUPPORTED", "Unsupported canonical format")
}

let beforeRevision = String(pasteboard.changeCount)
guard beforeRevision == requestedRevision else {
    fail("ORACLE_REVISION_STALE", "Pasteboard revision does not match requested observation", state: "STALE", exitCode: 2)
}

guard let items = pasteboard.pasteboardItems, itemIndex < items.count else {
    fail("ORACLE_ITEM_NOT_FOUND", "Observed pasteboard item is unavailable")
}
let item = items[itemIndex]
let advertised = Set(item.types.map { $0.rawValue })
guard let selected = candidates.first(where: { advertised.contains($0) }) else {
    fail("ORACLE_FORMAT_NOT_AVAILABLE", "Canonical format is not advertised for the item")
}

guard let payload = item.data(forType: NSPasteboard.PasteboardType(selected)) else {
    fail("ORACLE_PAYLOAD_UNAVAILABLE", "Advertised payload could not be read")
}

let afterRevision = String(pasteboard.changeCount)
guard afterRevision == requestedRevision else {
    fail("ORACLE_CHANGED_DURING_READ", "Pasteboard changed while oracle read the payload", state: "STALE", exitCode: 2)
}

let digest = SHA256.hash(data: payload)
let sha256 = digest.map { String(format: "%02x", $0) }.joined()
emit([
    "ok": true,
    "state": "READ",
    "revision": afterRevision,
    "itemIndex": itemIndex,
    "format": format,
    "byteCount": payload.count,
    "sha256": sha256,
    "method": method,
], exitCode: 0)
