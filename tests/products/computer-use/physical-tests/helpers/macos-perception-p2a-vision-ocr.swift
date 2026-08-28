import AppKit
import Foundation
import Vision

struct Box: Codable { let x: Double; let y: Double; let width: Double; let height: Double }
struct Item: Codable { let text: String; let confidence: Float; let box: Box }
struct Result: Codable { let state: String; let width: Int; let height: Int; let items: [Item] }

@main struct Main {
    static func main() throws {
        let data = FileHandle.standardInput.readDataToEndOfFile()
        guard let image = NSImage(data:data) else { throw NSError(domain:"P2A",code:1,userInfo:[NSLocalizedDescriptionKey:"IMAGE_DECODE_FAILED"]) }
        var rect = NSRect(origin:.zero,size:image.size)
        guard let cg = image.cgImage(forProposedRect:&rect,context:nil,hints:nil) else { throw NSError(domain:"P2A",code:2,userInfo:[NSLocalizedDescriptionKey:"CGIMAGE_FAILED"]) }
        let width=cg.width, height=cg.height
        let request=VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.minimumTextHeight = 0.015
        let handler=VNImageRequestHandler(cgImage:cg,options:[:])
        try handler.perform([request])
        let observations=(request.results ?? [])
        let items:[Item]=observations.compactMap { observation in
            guard let candidate=observation.topCandidates(1).first else { return nil }
            let b=observation.boundingBox
            return Item(
                text:candidate.string,
                confidence:candidate.confidence,
                box:Box(
                    x:b.minX*Double(width),
                    y:(1.0-b.maxY)*Double(height),
                    width:b.width*Double(width),
                    height:b.height*Double(height)
                )
            )
        }
        let encoded=try JSONEncoder().encode(Result(state:"OBSERVED",width:width,height:height,items:items))
        FileHandle.standardOutput.write(encoded); FileHandle.standardOutput.write(Data([0x0a]))
    }
}
