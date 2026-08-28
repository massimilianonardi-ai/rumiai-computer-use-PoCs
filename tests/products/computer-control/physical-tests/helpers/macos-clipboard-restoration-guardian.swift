import AppKit
import Foundation

let method = "independent-nspasteboard-general-restoration-guardian"
let maxBackupBytes = 64 * 1024 * 1024

struct SnapshotFailure: Error {
    let code: String
}
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

func emit(_ object: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
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

func nativeType(for canonical: String) -> NSPasteboard.PasteboardType? {
    switch canonical {
    case "text/plain": return .string
    case "text/html": return .html
    case "text/rtf": return .rtf
    case "image/png": return .png
    default: return nil
    }
}

let pasteboard = NSPasteboard.general
let original: Snapshot
switch snapshot(pasteboard) {
case .failure(let failure):
    emit(["ok": false, "state": "BLOCKED", "error": failure.code, "mutated": false, "method": method])
    exit(2)
case .success(let value):
    original = value
}

emit([
    "ok": true,
    "state": "READY",
    "originalRevision": String(original.revision),
    "itemCount": original.items.count,
    "typeCount": original.totalTypes,
    "byteCount": original.totalBytes,
    "method": method,
])

var restored = false
func restoreIfNeeded() -> Bool {
    if restored { return true }
    if pasteboard.changeCount == original.revision {
        restored = true
        return true
    }
    let delivered = restore(pasteboard, from: original)
    guard delivered else { return false }
    switch snapshot(pasteboard) {
    case .failure:
        return false
    case .success(let current):
        restored = equal(original, current)
        return restored
    }
}

while let line = readLine() {
    guard let input = line.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: input) as? [String: Any],
          let command = object["command"] as? String else {
        emit(["ok": false, "state": "FAILED", "error": "GUARDIAN_INVALID_COMMAND", "method": method])
        continue
    }

    if command == "verify" {
        guard let canonical = object["format"] as? String,
              let type = nativeType(for: canonical),
              let encoded = object["dataBase64"] as? String,
              let expected = Data(base64Encoded: encoded) else {
            emit(["ok": false, "state": "FAILED", "error": "GUARDIAN_INVALID_VERIFY_REQUEST", "method": method])
            continue
        }
        let revision = pasteboard.changeCount
        let items = pasteboard.pasteboardItems ?? []
        guard items.count == 1, let observed = items[0].data(forType: type) else {
            emit(["ok": false, "state": "FAILED", "error": "GUARDIAN_FORMAT_NOT_OBSERVED", "revision": String(revision), "itemCount": items.count, "method": method])
            continue
        }
        guard pasteboard.changeCount == revision else {
            emit(["ok": false, "state": "FAILED", "error": "GUARDIAN_CLIPBOARD_CHANGED_DURING_VERIFY", "method": method])
            continue
        }
        emit([
            "ok": observed == expected,
            "state": observed == expected ? "VERIFIED" : "FAILED",
            "error": observed == expected ? NSNull() : "GUARDIAN_PAYLOAD_MISMATCH",
            "revision": String(revision),
            "itemCount": items.count,
            "byteCount": observed.count,
            "format": canonical,
            "method": method,
        ])
        continue
    }

    if command == "restore" {
        let success = restoreIfNeeded()
        var restoredItemCount = -1
        var restoredTypeCount = -1
        var restoredByteCount = -1
        if success, case .success(let current) = snapshot(pasteboard) {
            restoredItemCount = current.items.count
            restoredTypeCount = current.totalTypes
            restoredByteCount = current.totalBytes
        }
        emit([
            "ok": success,
            "state": success ? "RESTORED" : "FAILED",
            "error": success ? NSNull() : "CLIPBOARD_RESTORATION_NOT_EXACT",
            "itemCount": restoredItemCount,
            "typeCount": restoredTypeCount,
            "byteCount": restoredByteCount,
            "method": method,
        ])
        exit(success ? 0 : 1)
    }

    emit(["ok": false, "state": "FAILED", "error": "GUARDIAN_UNKNOWN_COMMAND", "method": method])
}

let eofRestored = restoreIfNeeded()
exit(eofRestored ? 0 : 1)
