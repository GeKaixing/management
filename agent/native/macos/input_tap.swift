import Foundation
import CoreGraphics

struct EventPayload: Codable {
    let type: String
    let action: String?
    let keycode: Int?
    let rawcode: Int?
    let button: Int?
    let x: Int?
    let y: Int?
    let amount: Int?
    let rotation: Int?
    let direction: Int?
    let timestamp: String
}

func isoTimestamp() -> String {
    let formatter = ISO8601DateFormatter()
    return formatter.string(from: Date())
}

func emit(_ payload: EventPayload) {
    let encoder = JSONEncoder()
    if let data = try? encoder.encode(payload), let text = String(data: data, encoding: .utf8) {
        print(text)
        fflush(stdout)
    }
}

let mask = (1 << CGEventType.keyDown.rawValue)
    | (1 << CGEventType.leftMouseDown.rawValue)
    | (1 << CGEventType.leftMouseUp.rawValue)
    | (1 << CGEventType.rightMouseDown.rawValue)
    | (1 << CGEventType.rightMouseUp.rawValue)
    | (1 << CGEventType.otherMouseDown.rawValue)
    | (1 << CGEventType.otherMouseUp.rawValue)
    | (1 << CGEventType.scrollWheel.rawValue)

guard let eventTap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .defaultTap,
    eventsOfInterest: CGEventMask(mask),
    callback: { (_, type, event, _) -> Unmanaged<CGEvent>? in
        switch type {
        case .keyDown:
            let keycode = Int(event.getIntegerValueField(.keyboardEventKeycode))
            emit(EventPayload(
                type: "keyboard",
                action: "keydown",
                keycode: keycode,
                rawcode: keycode,
                button: nil,
                x: nil,
                y: nil,
                amount: nil,
                rotation: nil,
                direction: nil,
                timestamp: isoTimestamp()
            ))
        case .leftMouseDown, .rightMouseDown, .otherMouseDown:
            let button = Int(event.getIntegerValueField(.mouseEventButtonNumber))
            let x = Int(event.location.x)
            let y = Int(event.location.y)
            emit(EventPayload(
                type: "mouse",
                action: "mousedown",
                keycode: nil,
                rawcode: nil,
                button: button,
                x: x,
                y: y,
                amount: nil,
                rotation: nil,
                direction: nil,
                timestamp: isoTimestamp()
            ))
        case .leftMouseUp, .rightMouseUp, .otherMouseUp:
            let button = Int(event.getIntegerValueField(.mouseEventButtonNumber))
            let x = Int(event.location.x)
            let y = Int(event.location.y)
            emit(EventPayload(
                type: "mouse",
                action: "mouseup",
                keycode: nil,
                rawcode: nil,
                button: button,
                x: x,
                y: y,
                amount: nil,
                rotation: nil,
                direction: nil,
                timestamp: isoTimestamp()
            ))
        case .scrollWheel:
            let amount = Int(event.getIntegerValueField(.scrollWheelEventPointDeltaAxis1))
            let rotation = Int(event.getIntegerValueField(.scrollWheelEventDeltaAxis1))
            let direction = amount >= 0 ? 3 : 4
            let x = Int(event.location.x)
            let y = Int(event.location.y)
            emit(EventPayload(
                type: "mouse",
                action: "wheel",
                keycode: nil,
                rawcode: nil,
                button: nil,
                x: x,
                y: y,
                amount: amount,
                rotation: rotation,
                direction: direction,
                timestamp: isoTimestamp()
            ))
        default:
            break
        }
        return Unmanaged.passUnretained(event)
    },
    userInfo: nil
) else {
    fputs("Failed to create event tap. Grant Accessibility/Input Monitoring permissions to node.\n", stderr)
    exit(1)
}

let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: eventTap, enable: true)
CFRunLoopRun()
