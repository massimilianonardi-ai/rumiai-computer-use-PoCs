import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

private final class ProbeWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
private final class HitTransparentMarker: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}
private final class ProbeView: NSView {
    let marker = HitTransparentMarker(frame: NSRect(x: 0, y: 0, width: 28, height: 28))
    var leftDownCount = 0
    var leftUpCount = 0
    var draggedCount = 0
    var dragging = false
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        marker.wantsLayer = true
        addSubview(marker)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    func setMarkerCenter(_ point: NSPoint) { marker.frame.origin = NSPoint(x: point.x-marker.frame.width/2.0,y: point.y-marker.frame.height/2.0) }
    var markerCenter: NSPoint { NSPoint(x: marker.frame.midX,y: marker.frame.midY) }
    override func mouseDown(with event: NSEvent) { leftDownCount += 1; dragging = true }
    override func mouseDragged(with event: NSEvent) { if dragging { draggedCount += 1; setMarkerCenter(event.locationInWindow) } }
    override func mouseUp(with event: NSEvent) { leftUpCount += 1; if dragging { setMarkerCenter(event.locationInWindow) }; dragging = false }
}
private func line(_ value:[String:Any]) { let data=try! JSONSerialization.data(withJSONObject:value,options:[.sortedKeys]);FileHandle.standardOutput.write(data);FileHandle.standardOutput.write(Data([0x0a])) }
private func near(_ a:CGPoint,_ b:CGPoint,tolerance:CGFloat=8)->Bool { abs(a.x-b.x)<=tolerance && abs(a.y-b.y)<=tolerance }
private func near(_ a:NSPoint,_ b:NSPoint,tolerance:CGFloat=8)->Bool { abs(a.x-b.x)<=tolerance && abs(a.y-b.y)<=tolerance }
private func pump(_ app:NSApplication,until deadline:Date){while Date()<deadline{if let event=app.nextEvent(matching:.any,until:Date().addingTimeInterval(0.01),inMode:.default,dequeue:true){app.sendEvent(event)}}}

@main
struct Phase10CDragPublicFixture {
    static func main(){
        guard AXIsProcessTrusted() else { line(["kind":"RESULT","ok":false,"state":"BLOCKED","error":"ACCESSIBILITY_NOT_TRUSTED"]);exit(2) }
        guard let initialEvent=CGEvent(source:nil) else { line(["kind":"RESULT","ok":false,"state":"FAILED","error":"POINTER_LOCATION_UNAVAILABLE"]);exit(1) }
        let original=initialEvent.location
        let previousApp=NSWorkspace.shared.frontmostApplication
        let bounds=CGDisplayBounds(CGMainDisplayID())
        guard bounds.width>=700,bounds.height>=500 else { line(["kind":"RESULT","ok":false,"state":"BLOCKED","error":"DISPLAY_TOO_SMALL_FOR_DRAG_FIXTURE"]);exit(2) }

        let centerLocal=CGPoint(x:floor(bounds.width/2.0),y:floor(bounds.height/2.0))
        let sourceDisplay=CGPoint(x:centerLocal.x-70,y:centerLocal.y)
        let destinationDisplay=CGPoint(x:centerLocal.x+70,y:centerLocal.y)
        let centerGlobal=CGPoint(x:bounds.origin.x+centerLocal.x,y:bounds.origin.y+centerLocal.y)
        let appKitCenter=NSPoint(x:centerGlobal.x,y:bounds.origin.y+bounds.height-(centerGlobal.y-bounds.origin.y))
        let frame=NSRect(x:appKitCenter.x-200,y:appKitCenter.y-110,width:400,height:220)
        let sourceView=NSPoint(x:130,y:110),destinationView=NSPoint(x:270,y:110)

        let app=NSApplication.shared;app.setActivationPolicy(.accessory)
        let window=ProbeWindow(contentRect:frame,styleMask:[.borderless],backing:.buffered,defer:false)
        let probe=ProbeView(frame:NSRect(x:0,y:0,width:400,height:220));probe.setMarkerCenter(sourceView)
        window.contentView=probe;window.level = .floating;window.backgroundColor = .windowBackgroundColor;window.ignoresMouseEvents=false
        window.makeKeyAndOrderFront(nil);app.activate(ignoringOtherApps:true);pump(app,until:Date().addingTimeInterval(0.15))

        func cleanup()->(restored:Bool,emergencyReleasePosted:Bool){
            var emergency=false
            if probe.leftDownCount>probe.leftUpCount {
                let point=CGEvent(source:nil)?.location ?? CGPoint(x:bounds.origin.x+destinationDisplay.x,y:bounds.origin.y+destinationDisplay.y)
                if let up=CGEvent(mouseEventSource:nil,mouseType:.leftMouseUp,mouseCursorPosition:point,mouseButton:.left){up.post(tap:.cghidEventTap);emergency=true;pump(app,until:Date().addingTimeInterval(0.06))}
            }
            window.orderOut(nil);CGWarpMouseCursorPosition(original);pump(app,until:Date().addingTimeInterval(0.08))
            let restored=CGEvent(source:nil).map{near($0.location,original,tolerance:2)} ?? false
            if let previousApp,previousApp.processIdentifier != ProcessInfo.processInfo.processIdentifier {_ = previousApp.activate(options:[.activateIgnoringOtherApps]);pump(app,until:Date().addingTimeInterval(0.05))}
            return(restored,emergency)
        }

        line(["kind":"READY","ok":true,"display":"primary","sourceX":sourceDisplay.x,"sourceY":sourceDisplay.y,"destinationX":destinationDisplay.x,"destinationY":destinationDisplay.y,"fixtureOwned":true])
        let deadline=Date().addingTimeInterval(12)
        while Date()<deadline { pump(app,until:Date().addingTimeInterval(0.02));if probe.leftDownCount>=1 && probe.draggedCount>=1 && probe.leftUpCount>=1 && near(probe.markerCenter,destinationView){break} }
        let consequence=near(probe.markerCenter,destinationView)
        let cleaned=cleanup()
        guard cleaned.restored else { line(["kind":"RESULT","ok":false,"state":"FAILED","error":"POINTER_RESTORE_FAILED"]);exit(1) }
        let exact=probe.leftDownCount==1 && probe.draggedCount>=1 && probe.leftUpCount==1 && consequence && !cleaned.emergencyReleasePosted
        guard exact else { line(["kind":"RESULT","ok":false,"state":"FAILED","error":"PUBLIC_DRAG_DELIVERY_NOT_VERIFIED","leftDownCount":probe.leftDownCount,"draggedCount":probe.draggedCount,"leftUpCount":probe.leftUpCount,"fixtureConsequenceObserved":consequence,"pointerRestored":true,"emergencyReleasePosted":cleaned.emergencyReleasePosted]);exit(1) }
        line(["kind":"RESULT","ok":true,"state":"OBSERVED","leftDownCount":probe.leftDownCount,"draggedCount":probe.draggedCount,"leftUpCount":probe.leftUpCount,"fixtureConsequenceObserved":true,"pointerRestored":true,"emergencyReleasePosted":false,"fixtureOwned":true,"semanticConsequenceClaimed":false])
        exit(0)
    }
}
