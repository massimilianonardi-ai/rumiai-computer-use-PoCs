import AppKit
import ApplicationServices
import Carbon.HIToolbox
import CoreGraphics
import Foundation

private final class ProbeWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
private final class ProbeTextView: NSTextView {
    var aDownCount=0, aUpCount=0, returnDownCount=0, returnUpCount=0
    var shiftedADownCount=0, shiftedAUpCount=0, shiftOnCount=0, shiftOffCount=0
    override func keyDown(with event:NSEvent){
        if event.keyCode==CGKeyCode(kVK_ANSI_A) {
            if event.modifierFlags.contains(.shift){shiftedADownCount += 1}else{aDownCount += 1}
        }
        if event.keyCode==CGKeyCode(kVK_Return){returnDownCount += 1}
        super.keyDown(with:event)
    }
    override func keyUp(with event:NSEvent){
        if event.keyCode==CGKeyCode(kVK_ANSI_A) {
            if event.modifierFlags.contains(.shift){shiftedAUpCount += 1}else{aUpCount += 1}
        }
        if event.keyCode==CGKeyCode(kVK_Return){returnUpCount += 1}
        super.keyUp(with:event)
    }
    override func flagsChanged(with event:NSEvent){
        if event.keyCode==CGKeyCode(kVK_Shift){if event.modifierFlags.contains(.shift){shiftOnCount += 1}else{shiftOffCount += 1}}
        super.flagsChanged(with:event)
    }
}
private func line(_ value:[String:Any]){let data=try! JSONSerialization.data(withJSONObject:value,options:[.sortedKeys]);FileHandle.standardOutput.write(data);FileHandle.standardOutput.write(Data([0x0a]))}
private func pump(_ app:NSApplication,_ seconds:Double){let deadline=Date().addingTimeInterval(seconds);while Date()<deadline{if let event=app.nextEvent(matching:.any,until:Date().addingTimeInterval(0.01),inMode:.default,dequeue:true){app.sendEvent(event)}}}
private func waitUntil(_ app:NSApplication,seconds:Double,_ condition:()->Bool)->Bool{let deadline=Date().addingTimeInterval(seconds);while Date()<deadline{if condition(){return true};pump(app,0.02)};return condition()}
private func shiftRelease()->CGEvent?{let event=CGEvent(keyboardEventSource:nil,virtualKey:CGKeyCode(kVK_Shift),keyDown:false);return event}

@main
struct Phase10EKeyboardPublicFixture {
    static func main(){
        guard AXIsProcessTrusted() else {line(["kind":"RESULT","ok":false,"state":"BLOCKED","error":"ACCESSIBILITY_NOT_TRUSTED"]);exit(2)}
        let previousApp=NSWorkspace.shared.frontmostApplication
        let app=NSApplication.shared;app.setActivationPolicy(.accessory)
        let window=ProbeWindow(contentRect:NSRect(x:180,y:180,width:460,height:260),styleMask:[.borderless],backing:.buffered,defer:false)
        let scroll=NSScrollView(frame:NSRect(x:30,y:30,width:400,height:200));let text=ProbeTextView(frame:NSRect(x:0,y:0,width:380,height:200));text.isEditable=true;text.isSelectable=true;text.string="";scroll.documentView=text;window.contentView=scroll;window.level = .floating;window.backgroundColor = .windowBackgroundColor;window.makeKeyAndOrderFront(nil);app.activate(ignoringOtherApps:true);window.makeFirstResponder(text);pump(app,0.16)
        var emergencyShiftReleasePosted=false
        func cleanup()->Bool{
            if text.shiftOnCount>text.shiftOffCount,let release=shiftRelease(){release.post(tap:.cghidEventTap);emergencyShiftReleasePosted=true;pump(app,0.06)}
            window.orderOut(nil)
            if let previousApp,previousApp.processIdentifier != ProcessInfo.processInfo.processIdentifier{_ = previousApp.activate(options:[.activateIgnoringOtherApps]);pump(app,0.06)}
            return previousApp == nil || NSWorkspace.shared.frontmostApplication?.processIdentifier == previousApp?.processIdentifier
        }

        line(["kind":"READY","ok":true,"fixtureOwned":true])
        let plain=waitUntil(app,seconds:8){text.aDownCount>=1 && text.aUpCount>=1 && text.string=="a"}
        guard plain else {_ = cleanup();line(["kind":"RESULT","ok":false,"state":"FAILED","error":"PUBLIC_PLAIN_KEY_NOT_OBSERVED"]);exit(1)}
        line(["kind":"PLAIN_OBSERVED","ok":true,"downCount":text.aDownCount,"upCount":text.aUpCount,"textConsequenceObserved":true])
        text.string=""

        let enter=waitUntil(app,seconds:8){text.returnDownCount>=1 && text.returnUpCount>=1 && text.string=="\n"}
        guard enter else {_ = cleanup();line(["kind":"RESULT","ok":false,"state":"FAILED","error":"PUBLIC_ENTER_KEY_NOT_OBSERVED"]);exit(1)}
        line(["kind":"ENTER_OBSERVED","ok":true,"downCount":text.returnDownCount,"upCount":text.returnUpCount,"newlineConsequenceObserved":true])
        text.string=""

        let shifted=waitUntil(app,seconds:8){text.shiftOnCount>=1 && text.shiftOffCount>=1 && text.shiftedADownCount>=1 && text.shiftedAUpCount>=1 && text.string=="A"}
        guard shifted else {let restored=cleanup();line(["kind":"RESULT","ok":false,"state":"FAILED","error":"PUBLIC_SHIFTED_KEY_NOT_OBSERVED","frontmostApplicationRestored":restored,"emergencyShiftReleasePosted":emergencyShiftReleasePosted]);exit(1)}
        let restored=cleanup()
        guard restored else {line(["kind":"RESULT","ok":false,"state":"FAILED","error":"FRONTMOST_APP_RESTORE_FAILED","emergencyShiftReleasePosted":emergencyShiftReleasePosted]);exit(1)}
        let exact=text.aDownCount==1 && text.aUpCount==1 && text.returnDownCount==1 && text.returnUpCount==1 && text.shiftOnCount==1 && text.shiftOffCount==1 && text.shiftedADownCount==1 && text.shiftedAUpCount==1 && !emergencyShiftReleasePosted
        guard exact else {line(["kind":"RESULT","ok":false,"state":"FAILED","error":"PUBLIC_KEYBOARD_COUNTS_NOT_EXACT","plainDownCount":text.aDownCount,"plainUpCount":text.aUpCount,"enterDownCount":text.returnDownCount,"enterUpCount":text.returnUpCount,"shiftOnCount":text.shiftOnCount,"shiftOffCount":text.shiftOffCount,"shiftedDownCount":text.shiftedADownCount,"shiftedUpCount":text.shiftedAUpCount,"emergencyShiftReleasePosted":emergencyShiftReleasePosted]);exit(1)}
        line(["kind":"RESULT","ok":true,"state":"OBSERVED","plainDownCount":1,"plainUpCount":1,"enterDownCount":1,"enterUpCount":1,"shiftOnCount":1,"shiftOffCount":1,"shiftedDownCount":1,"shiftedUpCount":1,"plainTextConsequenceObserved":true,"newlineConsequenceObserved":true,"shiftedTextConsequenceObserved":true,"emergencyShiftReleasePosted":false,"frontmostApplicationRestored":true,"fixtureOwned":true,"userContentTouched":false,"semanticTextSuccessClaimed":false])
        exit(0)
    }
}
