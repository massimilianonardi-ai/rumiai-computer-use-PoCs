import AppKit
import CoreGraphics
import Foundation

struct RectSnapshot: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct DisplaySnapshot: Codable {
    let displayID: UInt32
    let name: String
    let frame: RectSnapshot
    let visibleFrame: RectSnapshot
    let pixelWidth: Int
    let pixelHeight: Int
    let backingScaleFactor: Double
    let rotationDegrees: Double
    let main: Bool
    let builtin: Bool
    let active: Bool
    let online: Bool
}

struct GeneralPasteboardSnapshot: Codable {
    let changeCount: Int
    let itemCount: Int
    let itemTypes: [[String]]
    let uniqueTypes: [String]
}

struct IsolatedFormatProbe: Codable {
    let type: String
    let writeAccepted: Bool
    let readbackMatched: Bool
    let byteCount: Int?
}

struct IsolatedPasteboardSnapshot: Codable {
    let advertisedTypes: [String]
    let probes: [IsolatedFormatProbe]
}

struct Output: Codable {
    let ok: Bool
    let method: String
    let displays: [DisplaySnapshot]
    let generalPasteboardBefore: GeneralPasteboardSnapshot
    let generalPasteboardAfter: GeneralPasteboardSnapshot
    let generalPasteboardUnchanged: Bool
    let isolatedPasteboard: IsolatedPasteboardSnapshot
    let error: String?
    let detail: String?
}

func rectSnapshot(_ rect: NSRect) -> RectSnapshot {
    RectSnapshot(
        x: Double(rect.origin.x),
        y: Double(rect.origin.y),
        width: Double(rect.size.width),
        height: Double(rect.size.height)
    )
}

func displayID(_ screen: NSScreen) -> CGDirectDisplayID? {
    let key = NSDeviceDescriptionKey("NSScreenNumber")
    guard let number = screen.deviceDescription[key] as? NSNumber else { return nil }
    return CGDirectDisplayID(number.uint32Value)
}

func displaySnapshots() -> [DisplaySnapshot] {
    let mainID = CGMainDisplayID()
    return NSScreen.screens.compactMap { screen in
        guard let id = displayID(screen) else { return nil }
        return DisplaySnapshot(
            displayID: id,
            name: screen.localizedName,
            frame: rectSnapshot(screen.frame),
            visibleFrame: rectSnapshot(screen.visibleFrame),
            pixelWidth: CGDisplayPixelsWide(id),
            pixelHeight: CGDisplayPixelsHigh(id),
            backingScaleFactor: Double(screen.backingScaleFactor),
            rotationDegrees: CGDisplayRotation(id),
            main: id == mainID,
            builtin: CGDisplayIsBuiltin(id) != 0,
            active: CGDisplayIsActive(id) != 0,
            online: CGDisplayIsOnline(id) != 0
        )
    }
}

func pasteboardSnapshot(_ pasteboard: NSPasteboard) -> GeneralPasteboardSnapshot {
    let itemTypes = (pasteboard.pasteboardItems ?? []).map { item in
        item.types.map(\.rawValue).sorted()
    }
    let uniqueTypes = Array(Set(itemTypes.flatMap { $0 })).sorted()
    return GeneralPasteboardSnapshot(
        changeCount: pasteboard.changeCount,
        itemCount: itemTypes.count,
        itemTypes: itemTypes,
        uniqueTypes: uniqueTypes
    )
}

func isolatedPasteboardProbe() -> IsolatedPasteboardSnapshot {
    let pasteboard = NSPasteboard.withUniqueName()
    let text = "RumiAI Phase 9D isolated text"
    let html = "<p>RumiAI <strong>Phase 9D</strong></p>"
    let rtf = Data("{\\rtf1\\ansi RumiAI Phase 9D}".utf8)
    let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!

    pasteboard.clearContents()
    pasteboard.declareTypes([.string, .html, .rtf, .png], owner: nil)

    let textWrite = pasteboard.setString(text, forType: .string)
    let htmlWrite = pasteboard.setString(html, forType: .html)
    let rtfWrite = pasteboard.setData(rtf, forType: .rtf)
    let pngWrite = pasteboard.setData(png, forType: .png)

    let probes = [
        IsolatedFormatProbe(
            type: NSPasteboard.PasteboardType.string.rawValue,
            writeAccepted: textWrite,
            readbackMatched: pasteboard.string(forType: .string) == text,
            byteCount: pasteboard.data(forType: .string)?.count
        ),
        IsolatedFormatProbe(
            type: NSPasteboard.PasteboardType.html.rawValue,
            writeAccepted: htmlWrite,
            readbackMatched: pasteboard.string(forType: .html) == html,
            byteCount: pasteboard.data(forType: .html)?.count
        ),
        IsolatedFormatProbe(
            type: NSPasteboard.PasteboardType.rtf.rawValue,
            writeAccepted: rtfWrite,
            readbackMatched: pasteboard.data(forType: .rtf) == rtf,
            byteCount: pasteboard.data(forType: .rtf)?.count
        ),
        IsolatedFormatProbe(
            type: NSPasteboard.PasteboardType.png.rawValue,
            writeAccepted: pngWrite,
            readbackMatched: pasteboard.data(forType: .png) == png,
            byteCount: pasteboard.data(forType: .png)?.count
        )
    ]

    let advertisedTypes = (pasteboard.types ?? []).map(\.rawValue).sorted()
    pasteboard.clearContents()
    return IsolatedPasteboardSnapshot(advertisedTypes: advertisedTypes, probes: probes)
}

let method = "macos-phase9d-display-and-clipboard-read-only-safe-discovery"
let general = NSPasteboard.general
let before = pasteboardSnapshot(general)
let isolated = isolatedPasteboardProbe()
let after = pasteboardSnapshot(general)
let unchanged = before.changeCount == after.changeCount && before.itemCount == after.itemCount && before.itemTypes == after.itemTypes
let displays = displaySnapshots()

let output = Output(
    ok: true,
    method: method,
    displays: displays,
    generalPasteboardBefore: before,
    generalPasteboardAfter: after,
    generalPasteboardUnchanged: unchanged,
    isolatedPasteboard: isolated,
    error: nil,
    detail: nil
)
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
let data = try encoder.encode(output)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
