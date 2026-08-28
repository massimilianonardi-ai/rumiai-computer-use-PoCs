import AppKit
import Foundation

struct TextTarget: Codable {
    let id: String
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct Ready: Codable {
    let state: String
    let displayWidth: Double
    let displayHeight: Double
    let targets: [TextTarget]
}

final class FixtureDelegate: NSObject, NSApplicationDelegate {
    var windows: [NSWindow] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let screen = NSScreen.screens.first(where: { abs($0.frame.origin.x) < 0.5 && abs($0.frame.origin.y) < 0.5 }) ?? NSScreen.main ?? NSScreen.screens.first else {
            fputs("fixture-error=no-primary-screen\n", stderr)
            NSApp.terminate(nil)
            return
        }
        let frame = screen.frame
        let w = Double(frame.width), h = Double(frame.height)
        let a = TextTarget(id:"alpha", x:floor(w*0.14), y:floor(h*0.28), width:360, height:96)
        let b = TextTarget(id:"beta", x:floor(w*0.58), y:floor(h*0.62), width:390, height:96)
        makeWindow(screen:screen,target:a,text:"RUMIAI ALPHA 731")
        makeWindow(screen:screen,target:b,text:"RUMIAI BETA 942")
        DispatchQueue.main.asyncAfter(deadline:.now()+1.0) {
            let ready=Ready(state:"READY",displayWidth:w,displayHeight:h,targets:[a,b])
            let data=try! JSONEncoder().encode(ready)
            FileHandle.standardOutput.write(data); FileHandle.standardOutput.write(Data([0x0a])); fflush(stdout)
        }
    }

    private func makeWindow(screen:NSScreen,target:TextTarget,text:String) {
        let sf=screen.frame
        let rect=NSRect(x:sf.minX+target.x,y:sf.maxY-target.y-target.height,width:target.width,height:target.height)
        let window=NSWindow(contentRect:rect,styleMask:[.borderless],backing:.buffered,defer:false,screen:screen)
        window.isOpaque=true; window.backgroundColor=.white; window.hasShadow=false; window.level=.screenSaver
        window.collectionBehavior=[.canJoinAllSpaces,.stationary,.ignoresCycle]; window.ignoresMouseEvents=true
        let label=NSTextField(labelWithString:text)
        label.font=NSFont.monospacedSystemFont(ofSize:34,weight:.bold)
        label.textColor=.black; label.alignment=.center
        label.frame=NSRect(x:8,y:20,width:target.width-16,height:56)
        window.contentView=NSView(frame:NSRect(x:0,y:0,width:target.width,height:target.height))
        window.contentView?.wantsLayer=true; window.contentView?.layer?.backgroundColor=NSColor.white.cgColor
        window.contentView?.addSubview(label)
        window.orderFrontRegardless(); windows.append(window)
    }
}

@main struct Main {
    static func main() {
        let app=NSApplication.shared; app.setActivationPolicy(.accessory)
        let delegate=FixtureDelegate(); app.delegate=delegate; app.run(); _=delegate
    }
}
