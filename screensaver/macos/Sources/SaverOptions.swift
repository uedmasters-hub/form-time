import Foundation
import ScreenSaver

/// A choice in the options sheet: the web app's id and its name.
struct Choice {
    let id: String
    let name: String
}

/// The screen saver's options, kept in ScreenSaverDefaults and passed to
/// the page in its address. The ids match the web app's settings
/// (settings.ts, dial-palettes.ts); anything unknown falls back there.
struct SaverOptions {
    static let faces = [
        Choice(id: "analog", name: "Analog"),
        Choice(id: "digital", name: "Digital"),
    ]
    static let appearances = [
        Choice(id: "system", name: "Match macOS"),
        Choice(id: "day", name: "Day"),
        Choice(id: "night", name: "Night"),
    ]
    static let dials = [
        Choice(id: "aqua", name: "Aqua"),
        Choice(id: "ivory", name: "Ivory"),
        Choice(id: "graphite", name: "White"),
        Choice(id: "turquoise", name: "Turquoise"),
        Choice(id: "glacier", name: "Glacier"),
        Choice(id: "ocean", name: "Ocean"),
        Choice(id: "pistachio", name: "Pistachio"),
        Choice(id: "sun", name: "Sun"),
        Choice(id: "salmon", name: "Salmon"),
        Choice(id: "lavender", name: "Lavender"),
        Choice(id: "slate", name: "Slate"),
    ]
    static let lumes = [
        Choice(id: "aqua", name: "Aqua"),
        Choice(id: "ice", name: "Ice blue"),
        Choice(id: "green", name: "Green"),
        Choice(id: "seafoam", name: "Seafoam"),
        Choice(id: "amber", name: "Amber"),
        Choice(id: "peach", name: "Peach"),
        Choice(id: "yellow", name: "Yellow"),
        Choice(id: "lavender", name: "Lavender"),
        Choice(id: "rose", name: "Rose"),
        Choice(id: "red", name: "Red"),
        Choice(id: "white", name: "White"),
    ]
    static let movements = [
        Choice(id: "smooth", name: "Smooth"),
        Choice(id: "mechanical", name: "Mechanical (8 beats a second)"),
        Choice(id: "quartz", name: "Quartz (one tick a second)"),
    ]
    static let sizes = [
        Choice(id: "classic", name: "Classic"),
        Choice(id: "compact", name: "Compact"),
    ]

    var face = "analog"
    var appearance = "system"
    var dial = "aqua"
    var lume = "aqua"
    var movement = "smooth"
    var size = "classic"
    var seconds = true
    var depth = true
    var date = true
    /// IANA time zone; empty for this Mac's.
    var timeZone = ""

    private static var defaults: ScreenSaverDefaults? {
        let id = Bundle(for: FormTimeSaverView.self).bundleIdentifier ?? "com.formtime.screensaver"
        return ScreenSaverDefaults(forModuleWithName: id)
    }

    static func load() -> SaverOptions {
        var o = SaverOptions()
        guard let d = defaults else { return o }
        func pick(_ key: String, _ allowed: [Choice], _ fallback: String) -> String {
            let value = d.string(forKey: key)
            return allowed.contains { $0.id == value } ? value! : fallback
        }
        func flag(_ key: String, _ fallback: Bool) -> Bool {
            d.object(forKey: key) == nil ? fallback : d.bool(forKey: key)
        }
        o.face = pick("face", faces, o.face)
        o.appearance = pick("appearance", appearances, o.appearance)
        o.dial = pick("dial", dials, o.dial)
        o.lume = pick("lume", lumes, o.lume)
        o.movement = pick("movement", movements, o.movement)
        o.size = pick("size", sizes, o.size)
        o.seconds = flag("seconds", o.seconds)
        o.depth = flag("depth", o.depth)
        o.date = flag("date", o.date)
        o.timeZone = d.string(forKey: "timeZone") ?? ""
        return o
    }

    func save() {
        guard let d = Self.defaults else { return }
        d.set(face, forKey: "face")
        d.set(appearance, forKey: "appearance")
        d.set(dial, forKey: "dial")
        d.set(lume, forKey: "lume")
        d.set(movement, forKey: "movement")
        d.set(size, forKey: "size")
        d.set(seconds, forKey: "seconds")
        d.set(depth, forKey: "depth")
        d.set(date, forKey: "date")
        d.set(timeZone, forKey: "timeZone")
        d.synchronize()
    }

    /// The page with these options, e.g. formtime://app/screensaver?face=analog&…
    var url: URL {
        var c = URLComponents(string: WebFiles.origin + "/screensaver")!
        c.queryItems = [
            URLQueryItem(name: "face", value: face),
            URLQueryItem(name: "appearance", value: appearance),
            URLQueryItem(name: "dial", value: dial),
            URLQueryItem(name: "lume", value: lume),
            URLQueryItem(name: "movement", value: movement),
            URLQueryItem(name: "size", value: size),
            URLQueryItem(name: "seconds", value: seconds ? "1" : "0"),
            URLQueryItem(name: "depth", value: depth ? "1" : "0"),
            URLQueryItem(name: "date", value: date ? "1" : "0"),
            URLQueryItem(name: "tz", value: timeZone.isEmpty ? TimeZone.current.identifier : timeZone),
        ]
        return c.url!
    }
}
