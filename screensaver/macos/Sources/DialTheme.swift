import AppKit

/// A dial's colours, from dial-themes.json (generated from the web app's
/// dial-palettes.ts by scripts/export-themes.mjs, so both always match).
struct DialTheme {
    struct Flat {
        let face, index, indexInsert, hand, handInsert, second, cap, pin: CGColor
    }

    let night: Bool
    let page, dialCenter, dialEdge, scale, numeral: CGColor
    let lume, lumeHighlight, lumeGlow: CGColor
    let steelHighlight, steelLight, steelMid, steelShade, steelEdge, screw, shadow: CGColor
    let handGlow, indexGlow, contactShadow, numeralGlow, lumeHighlightOpacity: CGFloat
    let flat: Flat

    private static var cache: [String: Any]?

    /// The day dial `dial`, or the night dial in `lume`; Aqua if unknown.
    static func named(day dial: String) -> DialTheme { load(group: "day", id: dial) }
    static func named(night lume: String) -> DialTheme { load(group: "night", id: lume) }

    private static func load(group: String, id: String) -> DialTheme {
        if cache == nil,
           let url = Bundle(for: FormTimeSaverView.self).url(forResource: "dial-themes", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            cache = json
        }
        let themes = cache?[group] as? [String: [String: Any]] ?? [:]
        let raw = themes[id] ?? themes["aqua"] ?? [:]
        return DialTheme(raw)
    }

    private init(_ r: [String: Any]) {
        func c(_ key: String, in dict: [String: Any]? = nil) -> CGColor {
            DialTheme.color((dict ?? r)[key] as? String ?? "#808080")
        }
        func n(_ key: String) -> CGFloat { CGFloat((r[key] as? NSNumber)?.doubleValue ?? 0) }
        night = (r["mode"] as? String) == "night"
        page = c("page"); dialCenter = c("dialCenter"); dialEdge = c("dialEdge")
        scale = c("scale"); numeral = c("numeral")
        lume = c("lume"); lumeHighlight = c("lumeHighlight"); lumeGlow = c("lumeGlow")
        steelHighlight = c("steelHighlight"); steelLight = c("steelLight"); steelMid = c("steelMid")
        steelShade = c("steelShade"); steelEdge = c("steelEdge"); screw = c("screw"); shadow = c("shadow")
        handGlow = n("handGlow"); indexGlow = n("indexGlow"); contactShadow = n("contactShadow")
        numeralGlow = n("numeralGlow"); lumeHighlightOpacity = n("lumeHighlightOpacity")
        let f = r["flat"] as? [String: Any] ?? [:]
        flat = Flat(face: c("face", in: f), index: c("index", in: f), indexInsert: c("indexInsert", in: f),
                    hand: c("hand", in: f), handInsert: c("handInsert", in: f), second: c("second", in: f),
                    cap: c("cap", in: f), pin: c("pin", in: f))
    }

    /// "#RRGGBB" → an sRGB colour.
    static func color(_ hex: String) -> CGColor {
        var h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        if h.count == 3 { h = h.map { "\($0)\($0)" }.joined() }
        let v = UInt32(h, radix: 16) ?? 0x808080
        return CGColor(srgbRed: CGFloat((v >> 16) & 255) / 255,
                       green: CGFloat((v >> 8) & 255) / 255,
                       blue: CGFloat(v & 255) / 255, alpha: 1)
    }
}
