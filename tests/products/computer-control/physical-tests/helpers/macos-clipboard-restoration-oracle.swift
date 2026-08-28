import AppKit
import Foundation

let method = "independent-nspasteboard-general-restoration-discovery"
let maxBackupBytes = 64 * 1024 * 1024

struct TypeSnapshot {
    let type: NSPasteboard.PasteboardType
    let data: Data
}
struct ItemSnapshot {
    let types: [TypeSnapshot]
}
struct Snapshot {
    let revision: Int
    let items: [ItemSnapshot]
    let totalBytes: Int
    let totalTypes: Int
}
struct SnapshotFailure: Error {
    let code: String
}

func emit(_ object: [String: Any], code: Int32) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(code)
}

func snapshot(_ pasteboard: NSPasteboard) -> Result<Snapshot, SnapshotFailure> {
    let revision = pasteboard.changeCount
    var items: [ItemSnapshot] = []
    var totalBytes = 0
    var totalTypes = 0
    for item in pasteboard.pasteboardItems ?? [] {
        var types: [TypeSnapshot] = []
        for type in item.types {
            guard let data = item.data(forType: type) else {
                return .failure(SnapshotFailure(code: "CLIPBOARD_RESTORATION_BACKUP_UNMATERIALIZABLE"))
            }
            totalBytes += data.count
            totalTypes += 1
            if totalBytes > maxBackupBytes {
                return .failure(SnapshotFailure(code: "CLIPBOARD_RESTORATION_BACKUP_TOO_LARGE"))
            }
            types.append(TypeSnapshot(type: type, data: data))
        }
        items.append(ItemSnapshot(types: types))
    }
    guard pasteboard.changeCount == revision else {
        return .failure(SnapshotFailure(code: "CLIPBOARD_CHANGED_DURING_RESTORATION_BACKUP"))
    }
    return .success(Snapshot(revision: revision, items: items, totalBytes: totalBytes, totalTypes: totalTypes))
}

func restore(_ pasteboard: NSPasteboard, from original: Snapshot) -> Bool {
    pasteboard.clearContents()
    if original.items.isEmpty { return (pasteboard.pasteboardItems ?? []).isEmpty }
    var objects: [NSPasteboardItem] = []
    for itemSnapshot in original.items {
        let item = NSPasteboardItem()
        for entry in itemSnapshot.types {
            guard item.setData(entry.data, forType: entry.type) else { return false }
        }
        objects.append(item)
    }
    return pasteboard.writeObjects(objects)
}

func equal(_ a: Snapshot, _ b: Snapshot) -> Bool {
    guard a.items.count == b.items.count, a.totalTypes == b.totalTypes, a.totalBytes == b.totalBytes else { return false }
    for (leftItem, rightItem) in zip(a.items, b.items) {
        guard leftItem.types.count == rightItem.types.count else { return false }
        for (left, right) in zip(leftItem.types, rightItem.types) {
            guard left.type.rawValue == right.type.rawValue, left.data == right.data else { return false }
        }
    }
    return true
}

let pasteboard = NSPasteboard.general
let originalResult = snapshot(pasteboard)
let original: Snapshot
switch originalResult {
case .failure(let error):
    emit([
        "ok": false,
        "state": "BLOCKED",
        "error": error.code,
        "mutated": false,
        "method": method,
    ], code: 2)
case .success(let value):
    original = value
}

let marker = Data("RumiAI clipboard restoration discovery marker".utf8)
var mutationDelivered = false
var mutationObserved = false
var mutationError: String? = nil

pasteboard.clearContents()
if pasteboard.setData(marker, forType: .string) {
    mutationDelivered = true
    mutationObserved = pasteboard.data(forType: .string) == marker
    if !mutationObserved { mutationError = "CLIPBOARD_RESTORATION_DISCOVERY_MUTATION_UNVERIFIED" }
} else {
    mutationError = "CLIPBOARD_RESTORATION_DISCOVERY_MUTATION_FAILED"
}

let restoreDelivered = restore(pasteboard, from: original)
let restoredResult = snapshot(pasteboard)
var restoredExact = false
var restoredItemCount = -1
var restoredTypeCount = -1
var restoredByteCount = -1
var restoreError: String? = nil

switch restoredResult {
case .failure(let error):
    restoreError = error.code
case .success(let restored):
    restoredItemCount = restored.items.count
    restoredTypeCount = restored.totalTypes
    restoredByteCount = restored.totalBytes
    restoredExact = equal(original, restored)
    if !restoredExact { restoreError = "CLIPBOARD_RESTORATION_NOT_EXACT" }
}

if !restoreDelivered && restoreError == nil { restoreError = "CLIPBOARD_RESTORATION_DELIVERY_FAILED" }

let success = mutationDelivered && mutationObserved && mutationError == nil && restoreDelivered && restoredExact && restoreError == nil
emit([
    "ok": success,
    "state": success ? "RESTORED" : "FAILED",
    "error": success ? NSNull() : (restoreError ?? mutationError ?? "CLIPBOARD_RESTORATION_DISCOVERY_FAILED"),
    "mutated": true,
    "mutationDelivered": mutationDelivered,
    "mutationObserved": mutationObserved,
    "restoreDelivered": restoreDelivered,
    "restoredExact": restoredExact,
    "originalItemCount": original.items.count,
    "originalTypeCount": original.totalTypes,
    "originalByteCount": original.totalBytes,
    "restoredItemCount": restoredItemCount,
    "restoredTypeCount": restoredTypeCount,
    "restoredByteCount": restoredByteCount,
    "method": method,
], code: success ? 0 : 1)
