import AppKit
import Foundation

let pasteboard = NSPasteboard.general
let beforeRevision = pasteboard.changeCount
let canonicalOrder = ["text/plain", "text/html", "text/rtf", "image/png"]

func canonicalFormat(_ raw: String) -> String? {
    switch raw {
    case NSPasteboard.PasteboardType.string.rawValue,
         "NSStringPboardType",
         "public.utf16-external-plain-text",
         "CorePasteboardFlavorType 0x75743136":
        return "text/plain"
    case NSPasteboard.PasteboardType.html.rawValue,
         "Apple HTML pasteboard type":
        return "text/html"
    case NSPasteboard.PasteboardType.rtf.rawValue,
         "NeXT Rich Text Format v1.0 pasteboard type":
        return "text/rtf"
    case NSPasteboard.PasteboardType.png.rawValue,
         "Apple PNG pasteboard type":
        return "image/png"
    default:
        return nil
    }
}

var items: [[String: Any]] = []
for (index, item) in (pasteboard.pasteboardItems ?? []).enumerated() {
    var canonical = Set<String>()
    var unsupported = 0
    for nativeType in item.types {
        if let mapped = canonicalFormat(nativeType.rawValue) {
            canonical.insert(mapped)
        } else {
            unsupported += 1
        }
    }
    items.append([
        "index": index,
        "formats": canonicalOrder.filter { canonical.contains($0) },
        "unsupportedFormatCount": unsupported,
    ])
}

let afterRevision = pasteboard.changeCount
if beforeRevision != afterRevision {
    let result: [String: Any] = [
        "ok": false,
        "state": "STALE",
        "error": "ORACLE_CLIPBOARD_CHANGED_DURING_OBSERVATION"
    ]
    let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(2)
}

let result: [String: Any] = [
    "ok": true,
    "revision": String(afterRevision),
    "items": items,
    "method": "independent-macos-clipboard-metadata-oracle"
]
let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data([0x0a]))
