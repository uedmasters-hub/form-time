import AppKit
import CoreImage

/// The FORM / TIME clock drawn with Core Graphics: a line-for-line port of
/// the web app's ClockDial.tsx, ClockHands.tsx, hands.ts, numerals.ts and
/// TimeNumerals.tsx, in the same 1000-unit dial space, so it looks the
/// same without a web view. (macOS 26.4 and later blank out web content
/// inside screen savers.)
///
/// All drawing assumes a y-down context (SVG's), like the web.
enum ClockRenderer {
    // MARK: Geometry (geometry.ts)

    static let dialSize: CGFloat = 1000
    static let center: CGFloat = 500
    static let faceRadius: CGFloat = 492
    static let outerScaleRadius: CGFloat = 455
    static let tickOuter: CGFloat = 410
    static let tickInner: CGFloat = 383
    static let indexOuter: CGFloat = 415
    static let indexInner: CGFloat = 339
    static let hourNumeralRadius: CGFloat = 276

    static let indexLength = indexOuter - indexInner
    static let indexMid = (indexOuter + indexInner) / 2
    static let indexWidth: CGFloat = 15
    static let indexLumeWidth: CGFloat = 8.6

    /// Point at `radius` from the centre, `degrees` clockwise from 12.
    static func polar(_ radius: CGFloat, _ degrees: CGFloat) -> CGPoint {
        let r = degrees * .pi / 180
        return CGPoint(x: center + radius * sin(r), y: center - radius * cos(r))
    }

    private static let srgb = CGColorSpace(name: CGColorSpace.sRGB)!

    private static func gradient(_ stops: [(CGFloat, CGColor)]) -> CGGradient {
        CGGradient(colorsSpace: srgb, colors: stops.map { $0.1 } as CFArray, locations: stops.map { $0.0 })!
    }

    // MARK: The dial (ClockDial.tsx)

    /// The static dial, drawn once per size and look into an image.
    static func dialImage(theme: DialTheme, flat: Bool, pixels: Int) -> CGImage? {
        guard let ctx = bitmap(pixels) else { return nil }
        let s = CGFloat(pixels) / dialSize
        ctx.scaleBy(x: s, y: s)

        // Face. Its edge colour matches the page, so it has no visible boundary.
        let face = CGPath(ellipseIn: CGRect(x: center - faceRadius, y: center - faceRadius,
                                            width: faceRadius * 2, height: faceRadius * 2), transform: nil)
        if flat {
            ctx.addPath(face)
            ctx.setFillColor(theme.flat.face)
            ctx.fillPath()
        } else {
            // RadialGradient cx 50% cy 46% r 54% of the face's box.
            let box = faceRadius * 2
            let c = CGPoint(x: center - faceRadius + 0.5 * box, y: center - faceRadius + 0.46 * box)
            ctx.saveGState()
            ctx.addPath(face)
            ctx.clip()
            ctx.drawRadialGradient(gradient([(0, theme.dialCenter), (1, theme.dialEdge)]),
                                   startCenter: c, startRadius: 0, endCenter: c, endRadius: 0.54 * box,
                                   options: [.drawsAfterEndLocation])
            ctx.restoreGState()
        }

        // Minute track; the hours are carried by the applied indices.
        ctx.setLineCap(.round)
        ctx.setStrokeColor(theme.scale)
        ctx.setLineWidth(4.6)
        for m in 0..<60 where m % 5 != 0 {
            ctx.move(to: polar(tickInner, CGFloat(m * 6)))
            ctx.addLine(to: polar(tickOuter, CGFloat(m * 6)))
        }
        ctx.strokePath()

        if !flat {
            // Lume halo behind every index.
            blurred(into: ctx, pixels: pixels, sigma: 9, opacity: theme.indexGlow) { g in
                g.setLineCap(.round)
                g.setStrokeColor(theme.lumeGlow)
                g.setLineWidth(indexWidth + 6)
                for h in 0..<12 {
                    g.move(to: polar(indexInner + 4, CGFloat(h * 30)))
                    g.addLine(to: polar(indexOuter - 4, CGFloat(h * 30)))
                }
                g.strokePath()
            }
            // Contact shadow: the indices sit slightly above the face.
            if theme.contactShadow > 0 {
                blurred(into: ctx, pixels: pixels, sigma: 3, opacity: theme.contactShadow) { g in
                    g.translateBy(x: 2, y: 4)
                    g.setLineCap(.round)
                    g.setStrokeColor(theme.shadow)
                    g.setLineWidth(indexWidth)
                    for h in 0..<12 {
                        g.move(to: polar(indexInner, CGFloat(h * 30)))
                        g.addLine(to: polar(indexOuter, CGFloat(h * 30)))
                    }
                    g.strokePath()
                }
            }
        }

        // Applied indices: a steel frame with a lume insert (flat: two capsules).
        for h in 0..<12 {
            let p = polar(indexMid, CGFloat(h * 30))
            ctx.saveGState()
            ctx.translateBy(x: p.x, y: p.y)
            ctx.rotate(by: CGFloat(h * 30) * .pi / 180)
            let frame = capsule(x: -indexWidth / 2, y: -indexLength / 2, w: indexWidth, h: indexLength)
            let inset = (indexWidth - indexLumeWidth) / 2
            if flat {
                ctx.addPath(frame)
                ctx.setFillColor(theme.flat.index)
                ctx.fillPath()
                ctx.addPath(capsule(x: -indexLumeWidth / 2 + 1.5, y: -indexLength / 2 + inset + 1.5,
                                    w: indexLumeWidth - 3, h: indexLength - inset * 2 - 3))
                ctx.setFillColor(theme.flat.indexInsert)
                ctx.fillPath()
            } else {
                ctx.saveGState()
                ctx.addPath(frame)
                ctx.clip()
                ctx.drawLinearGradient(gradient([(0, theme.steelShade), (0.28, theme.steelHighlight),
                                                 (0.62, theme.steelMid), (1, theme.steelShade)]),
                                       start: CGPoint(x: -indexWidth / 2, y: 0), end: CGPoint(x: indexWidth / 2, y: 0),
                                       options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
                ctx.restoreGState()
                stroke(ctx, frame, theme.steelEdge, 0.8)

                let insert = capsule(x: -indexLumeWidth / 2, y: -indexLength / 2 + inset,
                                     w: indexLumeWidth, h: indexLength - inset * 2)
                ctx.addPath(insert)
                ctx.setFillColor(theme.lume)
                ctx.fillPath()
                stroke(ctx, insert, theme.steelShade, 0.9)

                ctx.setAlpha(theme.lumeHighlightOpacity)
                ctx.addPath(capsule(x: -1.8, y: -indexLength / 2 + 9, w: 2.4, h: indexLength - 18))
                ctx.setFillColor(theme.lumeHighlight)
                ctx.fillPath()
                ctx.setAlpha(1)
            }
            ctx.restoreGState()
        }

        // Outer minute scale, set radially.
        for h in 0..<12 {
            let value = h * 5
            let label = value == 0 ? "60" : String(format: "%02d", value)
            let p = polar(outerScaleRadius, CGFloat(h * 30))
            numeral(ctx, label, at: p, height: 17.5, stroke: 3.5, rotation: CGFloat(h * 30), color: theme.scale)
        }

        // Night dials: the hour numerals glow (a blurred copy beneath them).
        if !flat && theme.numeralGlow > 0 {
            blurred(into: ctx, pixels: pixels, sigma: 9, opacity: theme.numeralGlow) { g in
                for h in 0..<12 { hourNumeral(g, h, color: theme.lumeGlow) }
            }
        }
        for h in 0..<12 { hourNumeral(ctx, h, color: theme.numeral) }

        return ctx.makeImage()
    }

    private static func hourNumeral(_ ctx: CGContext, _ position: Int, color: CGColor) {
        let p = polar(hourNumeralRadius, CGFloat(position * 30))
        numeral(ctx, String(position == 0 ? 12 : position), at: p, height: 38.5, stroke: 6.8, rotation: 0, color: color)
    }

    // MARK: The hands (ClockHands.tsx, hands.ts)

    private static let hourHand = HandSpec(length: 262, rootHalf: 13, neckRadius: 34, neckHalf: 7.6,
                                           bladeStart: 80, bladeHalf: 7.4, taperStart: 200,
                                           lumeStart: 96, lumeEnd: 222, lumeHalf: 3.8)
    private static let minuteHand = HandSpec(length: 405, rootHalf: 12, neckRadius: 34, neckHalf: 6.8,
                                             bladeStart: 84, bladeHalf: 6.6, taperStart: 335,
                                             lumeStart: 100, lumeEnd: 360, lumeHalf: 3.3)
    private static let hourPath = SVGPath.parse(handOutline(hourHand))
    private static let minutePath = SVGPath.parse(handOutline(minuteHand))
    private static let secondPath = SVGPath.parse(secondHandOutline())

    /// Cast-shadow offsets (light from the upper left).
    private static let shadowHour = CGSize(width: 4, height: 8)
    private static let shadowMinute = CGSize(width: 5, height: 10)
    private static let shadowSecond = CGSize(width: 6, height: 12)
    private static let shadowHub = CGSize(width: 3, height: 8)
    /// Widening, faint strokes that together read as a soft blur.
    private static let shadowPasses: [(CGFloat, CGFloat)] = [
        (56, 0.008), (46, 0.01), (36, 0.012), (27, 0.014), (18, 0.016), (10, 0.018),
    ]

    struct Angles {
        var hour: CGFloat
        var minute: CGFloat
        var second: CGFloat
    }

    /// The moving layer, in dial units (the context is already scaled to the dial).
    static func drawHands(_ ctx: CGContext, theme: DialTheme, flat: Bool, angles a: Angles, seconds: Bool) {
        ctx.setLineCap(.round)
        ctx.setLineJoin(.round)
        if flat {
            let f = theme.flat
            for (path, spec, angle) in [(hourPath, hourHand, a.hour), (minutePath, minuteHand, a.minute)] {
                rotated(ctx, angle) {
                    ctx.addPath(path); ctx.setFillColor(f.hand); ctx.fillPath()
                    line(ctx, 0, -spec.lumeStart, 0, -spec.lumeEnd, f.handInsert, max(2, spec.lumeHalf * 2 - 1))
                }
            }
            disc(ctx, center, center, 24, f.hand)
            if seconds {
                rotated(ctx, a.second) { ctx.addPath(secondPath); ctx.setFillColor(f.second); ctx.fillPath() }
            }
            disc(ctx, center, center, 9, f.cap)
            disc(ctx, center, center, 3.2, f.pin)
            return
        }

        // Shadows first, so no hand is ever shaded by its own shadow.
        softShadow(ctx, hourPath, a.hour, shadowHour, theme.lumeGlow, theme.handGlow)
        softShadow(ctx, minutePath, a.minute, shadowMinute, theme.lumeGlow, theme.handGlow)
        if seconds { softShadow(ctx, secondPath, a.second, shadowSecond, theme.lumeGlow, 0.2 * theme.handGlow) }
        ctx.setAlpha(min(0.15, 0.025 * theme.handGlow))
        disc(ctx, center + shadowHub.width, center + shadowHub.height, 40, theme.lumeGlow)
        ctx.setAlpha(min(0.18, 0.03 * theme.handGlow))
        disc(ctx, center + shadowHub.width, center + shadowHub.height, 32, theme.lumeGlow)
        ctx.setAlpha(1)

        let steel = gradient([(0, theme.steelMid), (0.3, theme.steelHighlight), (0.62, theme.steelLight), (1, theme.steelMid)])
        sculptedHand(ctx, hourPath, hourHand, a.hour, theme, steel)
        sculptedHand(ctx, minutePath, minuteHand, a.minute, theme, steel)

        // Hub: hour and minute collars stacked under the second hand.
        let dome = gradient([(0, theme.steelHighlight), (0.55, theme.steelLight), (1, theme.steelShade)])
        domed(ctx, center, center + 5, 26, dome, cx: 0.42, cy: 0.38, r: 0.65, edge: theme.steelEdge, width: 0.9)
        domed(ctx, center, center + 2.5, 25, dome, cx: 0.42, cy: 0.38, r: 0.65, edge: theme.steelEdge, width: 0.9)
        domed(ctx, center, center, 24, dome, cx: 0.42, cy: 0.38, r: 0.65, edge: theme.steelEdge, width: 1)
        ctx.setAlpha(0.6)
        stroke(ctx, circle(center, center, 16), theme.steelShade, 1.2)
        ctx.setAlpha(1)

        if seconds {
            rotated(ctx, a.second) {
                fillGradient(ctx, secondPath, steel, halfWidth: 3.8)
                stroke(ctx, secondPath, theme.night ? theme.scale : theme.steelEdge, theme.night ? 1 : 0.7)
            }
        }

        // Cap: a polished domed screw.
        ctx.setAlpha(0.6)
        disc(ctx, center + 0.5, center + 1.5, 10, theme.steelShade)
        ctx.setAlpha(1)
        domed(ctx, center, center, 9, dome, cx: 0.42, cy: 0.38, r: 0.65, edge: theme.steelEdge, width: 0.9)
        let screw = gradient([(0, theme.steelMid), (0.6, theme.screw), (1, theme.steelEdge)])
        domed(ctx, center, center, 6.4, screw, cx: 0.4, cy: 0.35, r: 0.7, edge: nil, width: 0)
        ctx.setAlpha(0.8)
        disc(ctx, center - 1.8, center - 2.2, 1.8, theme.steelHighlight)
        ctx.setAlpha(1)
    }

    private static func softShadow(_ ctx: CGContext, _ path: CGPath, _ angle: CGFloat, _ offset: CGSize,
                                   _ color: CGColor, _ strength: CGFloat) {
        ctx.saveGState()
        ctx.translateBy(x: center + offset.width, y: center + offset.height)
        ctx.rotate(by: angle * .pi / 180)
        for (width, opacity) in shadowPasses {
            ctx.addPath(path)
            ctx.setStrokeColor(color.copy(alpha: min(1, opacity * strength)) ?? color)
            ctx.setLineWidth(width * min(1, 0.5 + strength / 2))
            ctx.strokePath()
        }
        ctx.restoreGState()
    }

    private static func sculptedHand(_ ctx: CGContext, _ path: CGPath, _ spec: HandSpec, _ angle: CGFloat,
                                     _ theme: DialTheme, _ steel: CGGradient) {
        rotated(ctx, angle) {
            fillGradient(ctx, path, steel, halfWidth: spec.rootHalf)
            ctx.setLineJoin(.round)
            stroke(ctx, path, theme.steelEdge, 1.1)
            // Recessed channel, lume, and a catch-light along the lume.
            line(ctx, 0, -spec.lumeStart, 0, -spec.lumeEnd, theme.steelShade, spec.lumeHalf * 2 + 1.8)
            line(ctx, 0, -spec.lumeStart, 0, -spec.lumeEnd, theme.lume, spec.lumeHalf * 2)
            ctx.setAlpha(theme.lumeHighlightOpacity)
            let x = -spec.lumeHalf * 0.3
            line(ctx, x, -(spec.lumeStart + 6), x, -(spec.lumeEnd - 6), theme.lumeHighlight, 1.6)
            ctx.setAlpha(1)
        }
    }

    struct HandSpec {
        let length, rootHalf, neckRadius, neckHalf, bladeStart, bladeHalf, taperStart: CGFloat
        let lumeStart, lumeEnd, lumeHalf: CGFloat
    }

    /// hands.ts handOutline: flared root easing into the blade, ogival point.
    static func handOutline(_ s: HandSpec) -> String {
        func f(_ n: CGFloat) -> String { String(format: "%.2f", Double(n)) }
        let neckRise = s.bladeStart - s.neckRadius
        let point = s.length - s.taperStart
        let x = { (v: CGFloat) in f(v) }
        return [
            "M \(f(s.rootHalf)) 0",
            "C \(x(s.rootHalf)) \(f(-s.neckRadius * 0.45)) \(x(s.neckHalf)) \(f(-s.neckRadius * 0.6)) \(x(s.neckHalf)) \(f(-s.neckRadius))",
            "C \(x(s.neckHalf)) \(f(-(s.neckRadius + neckRise * 0.55))) \(x(s.bladeHalf)) \(f(-(s.bladeStart - neckRise * 0.25))) \(x(s.bladeHalf)) \(f(-s.bladeStart))",
            "L \(x(s.bladeHalf)) \(f(-s.taperStart))",
            "C \(x(s.bladeHalf)) \(f(-(s.taperStart + point * 0.5))) \(x(s.bladeHalf * 0.3)) \(f(-(s.length - point * 0.12))) 0 \(f(-s.length))",
            "C \(f(-s.bladeHalf * 0.3)) \(f(-(s.length - point * 0.12))) \(f(-s.bladeHalf)) \(f(-(s.taperStart + point * 0.5))) \(f(-s.bladeHalf)) \(f(-s.taperStart))",
            "L \(f(-s.bladeHalf)) \(f(-s.bladeStart))",
            "C \(f(-s.bladeHalf)) \(f(-(s.bladeStart - neckRise * 0.25))) \(f(-s.neckHalf)) \(f(-(s.neckRadius + neckRise * 0.55))) \(f(-s.neckHalf)) \(f(-s.neckRadius))",
            "C \(f(-s.neckHalf)) \(f(-s.neckRadius * 0.6)) \(f(-s.rootHalf)) \(f(-s.neckRadius * 0.45)) \(f(-s.rootHalf)) 0",
            "A \(f(s.rootHalf)) \(f(s.rootHalf)) 0 0 0 \(f(s.rootHalf)) 0",
            "Z",
        ].joined(separator: " ")
    }

    /// hands.ts secondHandOutline: a slim blade with a rounded counterbalancing tail.
    static func secondHandOutline() -> String {
        let length: CGFloat = 418, tail: CGFloat = 104, tipHalf: CGFloat = 1, rootHalf: CGFloat = 3.2, tailHalf: CGFloat = 3.8
        return [
            "M \(-tailHalf) \(tail)",
            "L \(-rootHalf) 0",
            "L \(-tipHalf) \(-length)",
            "Q 0 \(-length - 2) \(tipHalf) \(-length)",
            "L \(rootHalf) 0",
            "L \(tailHalf) \(tail)",
            "A \(tailHalf) \(tailHalf) 0 0 1 \(-tailHalf) \(tail)",
            "Z",
        ].joined(separator: " ")
    }

    // MARK: Numerals (numerals.ts, Numeral.tsx)

    private static let glyphs: [Character: (width: CGFloat, d: String)] = [
        "0": (106, "M53 0 A53 50 0 1 1 53 100 A53 50 0 1 1 53 0 Z"),
        "1": (0, "M0 0 V100"),
        "2": (94, "M2.2 28.3 A45 31 0 1 1 87.8 44.1 C84 60 26 70 2 100 H94"),
        "3": (92, "M10.3 17.05 A38 23 0 1 1 47 46 A45 27 0 1 1 4.7 82.2"),
        "4": (96, "M70 100 V0 L0 68 H96"),
        "5": (94, "M90 0 H11 L10.8 51.04 A45 32 0 1 1 10.03 84"),
        "6": (104, "M2 70 A50 30 0 1 1 102 70 A50 30 0 1 1 2 70 V42 C2 15 20 0 50 0 C71 0 87 5 97 14"),
        "7": (90, "M0 0 H90 L30 100"),
        "8": (92, "M46 0 A38 23 0 1 1 46 46 A38 23 0 1 1 46 0 M46 46 A46 27 0 1 1 46 100 A46 27 0 1 1 46 46"),
        "9": (104, "M102 30 A50 30 0 1 1 2 30 A50 30 0 1 1 102 30 V58 C102 85 84 100 54 100 C33 100 17 95 7 86"),
    ]
    private static let tabularOne: (width: CGFloat, d: String) = (64, "M2 34 L58 0 V100")
    private static let tracking: CGFloat = 36
    private static let tabularCell: CGFloat = 106
    static let glyphHeight: CGFloat = 100
    private static var glyphPaths: [String: CGPath] = [:]

    private static func glyphPath(_ d: String) -> CGPath {
        if let p = glyphPaths[d] { return p }
        let p = SVGPath.parse(d)
        glyphPaths[d] = p
        return p
    }

    /// Width of a string of numerals, in glyph units (100 tall).
    static func numeralWidth(_ text: String, tabular: Bool = false) -> CGFloat {
        var cursor: CGFloat = 0
        for (i, ch) in text.enumerated() {
            let g = tabular && ch == "1" ? tabularOne : (glyphs[ch] ?? glyphs["0"]!)
            if i > 0 { cursor += tracking }
            cursor += tabular ? tabularCell : g.width
        }
        return cursor
    }

    /// A string of numerals centred on `at`, `height` tall, stroked `stroke` wide.
    static func numeral(_ ctx: CGContext, _ text: String, at p: CGPoint, height: CGFloat, stroke: CGFloat,
                        rotation: CGFloat, color: CGColor, tabular: Bool = false) {
        let scale = height / glyphHeight
        let width = numeralWidth(text, tabular: tabular)
        ctx.saveGState()
        ctx.translateBy(x: p.x, y: p.y)
        ctx.rotate(by: rotation * .pi / 180)
        ctx.scaleBy(x: scale, y: scale)
        ctx.translateBy(x: -width / 2, y: -glyphHeight / 2)
        ctx.setStrokeColor(color)
        ctx.setLineWidth(stroke / scale)
        ctx.setLineCap(.round)
        ctx.setLineJoin(.round)
        var cursor: CGFloat = 0
        for (i, ch) in text.enumerated() {
            let g = tabular && ch == "1" ? tabularOne : (glyphs[ch] ?? glyphs["0"]!)
            if i > 0 { cursor += tracking }
            let cell = tabular ? tabularCell : g.width
            ctx.saveGState()
            ctx.translateBy(x: cursor + (cell - g.width) / 2, y: 0)
            ctx.addPath(glyphPath(g.d))
            ctx.strokePath()
            ctx.restoreGState()
            cursor += cell
        }
        ctx.restoreGState()
    }

    // MARK: The digital time (TimeNumerals.tsx)

    static let colonShare: CGFloat = 0.36
    static func timeStroke(_ height: CGFloat) -> CGFloat { max(2.4, height * 0.11) }

    /// The digit groups shown: "9", "41" (12-hour) or "09", "41" (24-hour).
    static func timeParts(hours: Int, minutes: Int, hour12: Bool) -> [String] {
        let hour = hour12 ? (hours % 12 == 0 ? 12 : hours % 12) : hours
        return [hour12 ? String(hour) : String(format: "%02d", hour), String(format: "%02d", minutes)]
    }

    static func timeWidth(_ parts: [String], height: CGFloat) -> CGFloat {
        let digits = parts.reduce(0) { $0 + numeralWidth($1, tabular: true) / glyphHeight * height }
        return digits + height * colonShare * CGFloat(parts.count - 1) + timeStroke(height) * 2
    }

    /// "9:41" in the dial's numerals, its box's top-left at `origin`.
    static func drawTime(_ ctx: CGContext, _ parts: [String], origin: CGPoint, height: CGFloat, color: CGColor) {
        let stroke = timeStroke(height)
        let mid = origin.y + (height + stroke * 2) / 2
        var x = origin.x + stroke
        for (i, text) in parts.enumerated() {
            let w = numeralWidth(text, tabular: true) / glyphHeight * height
            numeral(ctx, text, at: CGPoint(x: x + w / 2, y: mid), height: height, stroke: stroke,
                    rotation: 0, color: color, tabular: true)
            x += w
            if i < parts.count - 1 {
                let colon = height * colonShare
                disc(ctx, x + colon / 2, mid - height * 0.2, stroke * 0.6, color)
                disc(ctx, x + colon / 2, mid + height * 0.2, stroke * 0.6, color)
                x += colon
            }
        }
    }

    // MARK: Drawing helpers

    private static func bitmap(_ pixels: Int) -> CGContext? {
        guard let ctx = CGContext(data: nil, width: pixels, height: pixels, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: srgb, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        // y down, like SVG.
        ctx.translateBy(x: 0, y: CGFloat(pixels))
        ctx.scaleBy(x: 1, y: -1)
        ctx.setShouldAntialias(true)
        ctx.interpolationQuality = .high
        return ctx
    }

    /// Draws `content` into a layer of its own, blurs it (SVG feGaussianBlur,
    /// `sigma` in dial units) and lays it into `ctx` at `opacity`.
    private static func blurred(into ctx: CGContext, pixels: Int, sigma: CGFloat, opacity: CGFloat,
                                _ content: (CGContext) -> Void) {
        guard let layer = bitmap(pixels) else { return }
        let s = CGFloat(pixels) / dialSize
        layer.scaleBy(x: s, y: s)
        content(layer)
        guard let image = layer.makeImage() else { return }
        let input = CIImage(cgImage: image)
        guard let filter = CIFilter(name: "CIGaussianBlur") else { return }
        filter.setValue(input, forKey: kCIInputImageKey)
        filter.setValue(sigma * s, forKey: kCIInputRadiusKey)
        guard let output = filter.outputImage?.cropped(to: input.extent),
              let result = CIContext(options: [.workingColorSpace: srgb]).createCGImage(output, from: input.extent)
        else { return }
        // The dial context is scaled to dial units and flipped; draw the
        // image in device pixels, upright.
        ctx.saveGState()
        ctx.setAlpha(opacity)
        ctx.scaleBy(x: 1 / s, y: 1 / s)
        ctx.translateBy(x: 0, y: CGFloat(pixels))
        ctx.scaleBy(x: 1, y: -1)
        ctx.draw(result, in: CGRect(x: 0, y: 0, width: pixels, height: pixels))
        ctx.restoreGState()
    }

    private static func capsule(x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat) -> CGPath {
        let r = min(w, h) / 2
        return CGPath(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerWidth: r, cornerHeight: r, transform: nil)
    }

    private static func circle(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat) -> CGPath {
        CGPath(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2), transform: nil)
    }

    private static func disc(_ ctx: CGContext, _ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ color: CGColor) {
        ctx.addPath(circle(x, y, r))
        ctx.setFillColor(color)
        ctx.fillPath()
    }

    private static func stroke(_ ctx: CGContext, _ path: CGPath, _ color: CGColor, _ width: CGFloat) {
        ctx.addPath(path)
        ctx.setStrokeColor(color)
        ctx.setLineWidth(width)
        ctx.strokePath()
    }

    private static func line(_ ctx: CGContext, _ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat,
                             _ color: CGColor, _ width: CGFloat) {
        ctx.move(to: CGPoint(x: x1, y: y1))
        ctx.addLine(to: CGPoint(x: x2, y: y2))
        ctx.setStrokeColor(color)
        ctx.setLineWidth(width)
        ctx.setLineCap(.round)
        ctx.strokePath()
    }

    /// Runs `draw` with the context at the dial centre, turned `degrees` clockwise.
    private static func rotated(_ ctx: CGContext, _ degrees: CGFloat, _ draw: () -> Void) {
        ctx.saveGState()
        ctx.translateBy(x: center, y: center)
        ctx.rotate(by: degrees * .pi / 180)
        draw()
        ctx.restoreGState()
    }

    /// Fills `path` with a horizontal gradient across its width (objectBoundingBox x 0 → 1).
    private static func fillGradient(_ ctx: CGContext, _ path: CGPath, _ g: CGGradient, halfWidth: CGFloat) {
        ctx.saveGState()
        ctx.addPath(path)
        ctx.clip()
        ctx.drawLinearGradient(g, start: CGPoint(x: -halfWidth, y: 0), end: CGPoint(x: halfWidth, y: 0),
                               options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
        ctx.restoreGState()
    }

    /// A disc filled with a radial gradient placed as SVG's objectBoundingBox
    /// cx / cy / r would place it, with an optional edge.
    private static func domed(_ ctx: CGContext, _ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ g: CGGradient,
                              cx: CGFloat, cy: CGFloat, r rr: CGFloat, edge: CGColor?, width: CGFloat) {
        let disc = circle(x, y, r)
        let c = CGPoint(x: x - r + cx * 2 * r, y: y - r + cy * 2 * r)
        ctx.saveGState()
        ctx.addPath(disc)
        ctx.clip()
        ctx.drawRadialGradient(g, startCenter: c, startRadius: 0, endCenter: c, endRadius: rr * 2 * r,
                               options: [.drawsAfterEndLocation])
        ctx.restoreGState()
        if let edge = edge { stroke(ctx, disc, edge, width) }
    }
}
