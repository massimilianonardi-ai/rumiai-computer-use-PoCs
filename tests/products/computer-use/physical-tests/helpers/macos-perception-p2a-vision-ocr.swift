import AppKit
import Foundation
import Vision

struct Box: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct Item: Codable {
    let text: String
    let confidence: Float
    let box: Box
}

struct Result: Codable {
    let state: String
    let width: Int
    let height: Int
    let items: [Item]
}

@main
struct Main {
    static func main() throws {
        let data = FileHandle.standardInput.readDataToEndOfFile()
        guard let image = NSImage(data: data) else {
            throw NSError(
                domain: "P2A",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "IMAGE_DECODE_FAILED"]
            )
        }

        var rect = NSRect(origin: .zero, size: image.size)
        guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
            throw NSError(
                domain: "P2A",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "CGIMAGE_FAILED"]
            )
        }

        let width = cgImage.width
        let height = cgImage.height
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.minimumTextHeight = 0.015

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        try handler.perform([request])

        let observations = request.results ?? []
        let items: [Item] = observations.compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            let bounds = observation.boundingBox
            return Item(
                text: candidate.string,
                confidence: candidate.confidence,
                box: Box(
                    x: Double(bounds.minX) * Double(width),
                    y: (1.0 - Double(bounds.maxY)) * Double(height),
                    width: Double(bounds.width) * Double(width),
                    height: Double(bounds.height) * Double(height)
                )
            )
        }

        let result = Result(state: "OBSERVED", width: width, height: height, items: items)
        let encoded = try JSONEncoder().encode(result)
        FileHandle.standardOutput.write(encoded)
        FileHandle.standardOutput.write(Data([0x0a]))
    }
}
