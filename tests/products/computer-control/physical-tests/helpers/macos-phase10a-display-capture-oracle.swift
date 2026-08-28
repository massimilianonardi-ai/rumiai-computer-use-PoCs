import AppKit
import CoreGraphics
import Foundation
import ScreenCaptureKit

private func emit(_ value: [String: Any], exitCode: Int32) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
    exit(exitCode)
}

private func blocked(_ code: String) -> Never {
    emit(["ok": false, "state": "BLOCKED", "error": code], exitCode: 2)
}

private func failed(_ code: String) -> Never {
    emit(["ok": false, "state": "FAILED", "error": code], exitCode: 1)
}

@main
struct Phase10ADisplayCaptureOracle {
    static func main() async {
        let raw = FileHandle.standardInput.readDataToEndOfFile()
        guard
            let object = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
            let dataBase64 = object["dataBase64"] as? String,
            let png = Data(base64Encoded: dataBase64),
            png.base64EncodedString() == dataBase64
        else { failed("ORACLE_INVALID_INPUT") }

        let signature = Data([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        guard png.count >= signature.count, png.prefix(signature.count) == signature else {
            failed("ORACLE_NOT_PNG")
        }
        guard let imageRep = NSBitmapImageRep(data: png), imageRep.pixelsWide > 0, imageRep.pixelsHigh > 0 else {
            failed("ORACLE_PNG_DECODE_FAILED")
        }

        guard CGPreflightScreenCaptureAccess() else {
            blocked("ORACLE_SCREEN_CAPTURE_PERMISSION_REQUIRED")
        }

        do {
            let mainDisplayID = CGMainDisplayID()
            let expectedWidth = Int(CGDisplayPixelsWide(mainDisplayID))
            let expectedHeight = Int(CGDisplayPixelsHigh(mainDisplayID))
            guard expectedWidth > 0, expectedHeight > 0 else {
                failed("ORACLE_MAIN_DISPLAY_DIMENSIONS_INVALID")
            }

            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            guard let display = content.displays.first(where: { $0.displayID == mainDisplayID }) else {
                failed("ORACLE_PRIMARY_DISPLAY_NOT_SHAREABLE")
            }
            let filter = SCContentFilter(display: display, excludingWindows: [])
            let configuration = SCStreamConfiguration()
            configuration.width = expectedWidth
            configuration.height = expectedHeight
            configuration.showsCursor = false
            let independent = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration)

            emit([
                "ok": true,
                "state": "VERIFIED",
                "method": "independent-screencapturekit-display-capture-oracle",
                "decodedWidth": imageRep.pixelsWide,
                "decodedHeight": imageRep.pixelsHigh,
                "decodedByteCount": png.count,
                "mainDisplayCaptureWidth": expectedWidth,
                "mainDisplayCaptureHeight": expectedHeight,
                "independentCaptureWidth": independent.width,
                "independentCaptureHeight": independent.height,
                "screenCapturePreflight": true,
                "cursorIncluded": false,
            ], exitCode: 0)
        } catch {
            failed("ORACLE_INDEPENDENT_CAPTURE_FAILED")
        }
    }
}
