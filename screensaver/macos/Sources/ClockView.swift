import AppKit
import CoreImage

/// The screen saver's clock, drawn natively with ClockRenderer. Its layout
/// follows the web app's /screensaver page (ScreensaverPage.tsx): the
/// clock centred with a margin, the date on a band at the foot, a fade in
/// from black, and a small drift each minute against burn-in.
final class ClockView: NSView {
    var options: SaverOptions {
        didSet { needsDisplay = true; scheduleNext() }
    }

    private let started = Date()
    private var timer: Timer?
    private var dialCache: (key: String, image: CGImage)?
    private var glowCache: (key: String, image: CGImage, origin: CGPoint)?

    // ScreensaverPage.tsx
    private let margin: CGFloat = 0.06
    private let drift: CGFloat = 0.035
    private let driftMove: TimeInterval = 6
    private let fadeIn: TimeInterval = 0.9
    private let compactScale: CGFloat = 0.62
    private let tiny: CGFloat = 320

    init(frame: NSRect, options: SaverOptions) {
        self.options = options
        super.init(frame: frame)
        wantsLayer = true
        layerContentsRedrawPolicy = .onSetNeedsDisplay
    }

    required init?(coder: NSCoder) { nil }

    override var isFlipped: Bool { true }
    override var isOpaque: Bool { true }

    // MARK: Running

    func start() {
        scheduleNext()
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window == nil { stop() } else { start() }
    }

    private var reducedMotion: Bool { NSWorkspace.shared.accessibilityDisplayShouldReduceMotion }

    /// Smooth hands and moving parts redraw 30 times a second; otherwise the
    /// clock wakes on each step (a second, or an eighth for mechanical).
    private func scheduleNext() {
        timer?.invalidate()
        let now = Date()
        let animating = !reducedMotion && (now.timeIntervalSince(started) < fadeIn
            || now.timeIntervalSince1970.truncatingRemainder(dividingBy: 60) < driftMove)
        let step: TimeInterval
        if options.face == "digital" || !options.seconds || reducedMotion || options.movement == "quartz" {
            step = 1
        } else if options.movement == "mechanical" {
            step = 1.0 / 8
        } else {
            step = 0
        }
        var delay: TimeInterval
        if step == 0 || animating {
            delay = 1.0 / 30
        } else {
            let t = now.timeIntervalSince1970
            delay = step - t.truncatingRemainder(dividingBy: step) + 0.002
        }
        delay = max(0.01, delay)
        let timer = Timer(timeInterval: delay, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            self.needsDisplay = true
            self.scheduleNext()
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    // MARK: Drawing

    private var night: Bool {
        switch options.appearance {
        case "night": return true
        case "day": return false
        default: return effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        }
    }

    private var theme: DialTheme {
        night ? DialTheme.named(night: options.lume) : DialTheme.named(day: options.dial)
    }

    private var timeZone: TimeZone {
        TimeZone(identifier: options.timeZone) ?? .current
    }

    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }
        let theme = self.theme
        let now = Date()
        let w = bounds.width, h = bounds.height
        let shorter = min(w, h)

        ctx.setFillColor(theme.page)
        ctx.fill(bounds)
        guard shorter > 0 else { return }

        // Layout (ScreensaverPage.tsx).
        let m = shorter * margin
        let dateSize = (min(30, max(13, shorter * 0.022))).rounded()
        let showDate = options.date && shorter >= tiny
        let band = showDate ? dateSize * 2.2 + m : m
        let area = CGRect(x: m, y: band, width: w - m * 2, height: h - band * 2)

        ctx.saveGState()
        let offset = driftOffset(at: now, reach: shorter * drift)
        ctx.translateBy(x: offset.x, y: offset.y)

        if options.face == "digital" {
            drawDigital(ctx, theme: theme, area: area, now: now)
        } else {
            drawAnalog(ctx, theme: theme, area: area, now: now)
        }
        if showDate {
            drawDate(ctx, theme: theme, now: now, size: dateSize, bottom: h - m)
        }
        ctx.restoreGState()

        // Fade in from black.
        let t = reducedMotion ? 1 : min(1, now.timeIntervalSince(started) / fadeIn)
        let eased = 1 - (1 - t) * (1 - t)
        if eased < 1 {
            ctx.setFillColor(NSColor.black.withAlphaComponent(1 - eased).cgColor)
            ctx.fill(bounds)
        }
    }

    /// Where the clock rests this minute (driftAt in screensaver-options.ts),
    /// easing over from last minute's place in the minute's first seconds.
    private func driftOffset(at date: Date, reach: CGFloat) -> CGPoint {
        func at(_ step: Double) -> CGPoint {
            CGPoint(x: CGFloat(sin(step * 0.73)) * reach, y: CGFloat(cos(step * 0.47)) * reach)
        }
        let t = date.timeIntervalSince1970
        if reducedMotion { return at(floor(t / 300)) }
        let step = floor(t / 60)
        let into = t - step * 60
        let now = at(step)
        guard into < driftMove, date.timeIntervalSince(started) > driftMove else { return now }
        let before = at(step - 1)
        let k = CGFloat((1 - cos(.pi * into / driftMove)) / 2) // ease in-out sine
        return CGPoint(x: before.x + (now.x - before.x) * k, y: before.y + (now.y - before.y) * k)
    }

    private func wallTime(_ date: Date) -> (hour: Int, minute: Int, second: Double) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let c = calendar.dateComponents([.hour, .minute, .second, .nanosecond], from: date)
        return (c.hour ?? 0, c.minute ?? 0, Double(c.second ?? 0) + Double(c.nanosecond ?? 0) / 1e9)
    }

    private func drawAnalog(_ ctx: CGContext, theme: DialTheme, area: CGRect, now: Date) {
        let room = min(area.width, area.height)
        let size = floor(options.size == "compact" ? room * compactScale : room)
        guard size > 4 else { return }
        let rect = CGRect(x: area.midX - size / 2, y: area.midY - size / 2, width: size, height: size)
        let flat = !options.depth

        let scale = window?.backingScaleFactor ?? 2
        let pixels = Int((size * scale).rounded())
        let key = "\(options.dial)|\(options.lume)|\(night)|\(flat)|\(pixels)"
        if dialCache?.key != key, let image = ClockRenderer.dialImage(theme: theme, flat: flat, pixels: pixels) {
            dialCache = (key, image)
        }
        if let image = dialCache?.image {
            ctx.saveGState()
            ctx.interpolationQuality = .high
            ctx.translateBy(x: rect.minX, y: rect.maxY)
            ctx.scaleBy(x: 1, y: -1)
            ctx.draw(image, in: CGRect(origin: .zero, size: rect.size))
            ctx.restoreGState()
        }

        // getHandAngles (geometry.ts), stepped by the movement.
        let wall = wallTime(now)
        let reduce = reducedMotion || !options.seconds
        let step: Double = reduce || options.movement == "quartz" ? 1 : (options.movement == "mechanical" ? 1.0 / 8 : 0)
        let seconds = step > 0 ? floor(wall.second / step + 1e-6) * step : wall.second
        let minutes = Double(wall.minute) + seconds / 60
        let hours = Double(wall.hour % 12) + minutes / 60
        let angles = ClockRenderer.Angles(hour: CGFloat(hours * 30), minute: CGFloat(minutes * 6), second: CGFloat(seconds * 6))

        ctx.saveGState()
        ctx.translateBy(x: rect.minX, y: rect.minY)
        ctx.scaleBy(x: size / ClockRenderer.dialSize, y: size / ClockRenderer.dialSize)
        ClockRenderer.drawHands(ctx, theme: theme, flat: flat, angles: angles, seconds: options.seconds)
        ctx.restoreGState()
    }

    /// DigitalClock.tsx: the time in the dial's numerals, with seconds and
    /// AM/PM in a fixed column beside it, so nothing moves as digits change.
    private func drawDigital(_ ctx: CGContext, theme: DialTheme, area: CGRect, now: Date) {
        let hour12 = DateFormatter.dateFormat(fromTemplate: "j", options: 0, locale: .current)?.contains("a") ?? false
        let perUnit = ClockRenderer.timeWidth(["00", "00"], height: 100) / 100
        let sideShare: CGFloat = 0.46
        var numeral = min(area.width * 0.9 / (perUnit + sideShare), area.height * 0.55, 340)
        if options.size == "compact" { numeral *= 0.68 }
        numeral = max(24, floor(numeral))
        let mainStroke = max(2.4, numeral * 0.11)
        let small = (numeral * 0.27).rounded()
        let smallStroke = max(1.6, small * 0.11)
        let sideWidth = ceil(max(ClockRenderer.numeralWidth("00", tabular: true) / ClockRenderer.glyphHeight * small + smallStroke * 2,
                                 hour12 ? small * 1.3 : 0))

        let wall = wallTime(now)
        let parts = ClockRenderer.timeParts(hours: wall.hour, minutes: wall.minute, hour12: hour12)
        let mainWidth = ClockRenderer.timeWidth(parts, height: numeral)
        let rowHeight = numeral + mainStroke * 2
        let gap = numeral * 0.1
        let rowWidth = mainWidth + gap + sideWidth
        let origin = CGPoint(x: (area.midX - rowWidth / 2).rounded(), y: (area.midY - rowHeight / 2).rounded())

        // Night dials with depth: a soft halo beneath the numerals.
        if options.depth && theme.night && theme.numeralGlow > 0 {
            drawGlow(ctx, parts: parts, origin: origin, height: numeral, color: theme.lumeGlow,
                     opacity: min(0.6, theme.numeralGlow * 1.4))
        }
        ClockRenderer.drawTime(ctx, parts, origin: origin, height: numeral, color: theme.numeral)

        let side = CGRect(x: origin.x + mainWidth + gap, y: origin.y, width: sideWidth, height: rowHeight)
        if hour12 {
            let text = NSAttributedString(string: wall.hour >= 12 ? "PM" : "AM", attributes: [
                .font: NSFont.systemFont(ofSize: max(11, small * 0.5), weight: .semibold),
                .foregroundColor: NSColor(cgColor: theme.scale) ?? .gray,
                .kern: 1.6,
            ])
            text.draw(at: CGPoint(x: side.minX, y: side.minY + mainStroke))
        }
        if options.seconds {
            let text = String(format: "%02d", Int(wall.second))
            let inner = ClockRenderer.numeralWidth(text, tabular: true) / ClockRenderer.glyphHeight * small
            let boxTop = side.maxY - (mainStroke - smallStroke) - (small + smallStroke * 2)
            ClockRenderer.numeral(ctx, text, at: CGPoint(x: side.maxX - smallStroke - inner / 2, y: boxTop + small / 2 + smallStroke),
                                  height: small, stroke: smallStroke, rotation: 0, color: theme.scale, tabular: true)
        }
    }

    /// The numerals' halo (TimeNumerals' feGaussianBlur), made once a minute.
    private func drawGlow(_ ctx: CGContext, parts: [String], origin: CGPoint, height: CGFloat, color: CGColor, opacity: CGFloat) {
        let scale = window?.backingScaleFactor ?? 2
        let bleed = ceil(height * 0.25)
        let box = CGSize(width: ClockRenderer.timeWidth(parts, height: height) + bleed * 2,
                         height: height + ClockRenderer.timeStroke(height) * 2 + bleed * 2)
        let key = "\(parts.joined(separator: ":"))|\(height)|\(scale)|\(options.lume)"
        if glowCache?.key != key {
            let pw = Int(box.width * scale), ph = Int(box.height * scale)
            guard let layer = CGContext(data: nil, width: pw, height: ph, bitsPerComponent: 8, bytesPerRow: 0,
                                        space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
            layer.translateBy(x: 0, y: CGFloat(ph))
            layer.scaleBy(x: scale, y: -scale)
            ClockRenderer.drawTime(layer, parts, origin: CGPoint(x: bleed, y: bleed), height: height, color: color)
            guard let image = layer.makeImage(), let blur = CIFilter(name: "CIGaussianBlur") else { return }
            let input = CIImage(cgImage: image)
            blur.setValue(input, forKey: kCIInputImageKey)
            blur.setValue(height * 0.06 * scale, forKey: kCIInputRadiusKey)
            guard let out = blur.outputImage?.cropped(to: input.extent),
                  let result = CIContext().createCGImage(out, from: input.extent) else { return }
            glowCache = (key, result, .zero)
        }
        guard let image = glowCache?.image else { return }
        let rect = CGRect(x: origin.x - bleed, y: origin.y - bleed, width: box.width, height: box.height)
        ctx.saveGState()
        ctx.setAlpha(opacity)
        ctx.translateBy(x: rect.minX, y: rect.maxY)
        ctx.scaleBy(x: 1, y: -1)
        ctx.draw(image, in: CGRect(origin: .zero, size: rect.size))
        ctx.restoreGState()
    }

    /// The weekday and date, centred on a line at the foot (ScreensaverPage's DateLine).
    private func drawDate(_ ctx: CGContext, theme: DialTheme, now: Date, size: CGFloat, bottom: CGFloat) {
        let weekdayFormat = DateFormatter()
        weekdayFormat.timeZone = timeZone
        weekdayFormat.setLocalizedDateFormatFromTemplate("EEEE")
        let dateFormat = DateFormatter()
        dateFormat.timeZone = timeZone
        dateFormat.setLocalizedDateFormatFromTemplate("dMMMM")

        let weekday = NSAttributedString(string: weekdayFormat.string(from: now).uppercased(with: .current), attributes: [
            .font: NSFont.systemFont(ofSize: size * 0.72, weight: .medium),
            .foregroundColor: NSColor(cgColor: theme.scale) ?? .gray,
            .kern: 2.4,
        ])
        let date = NSAttributedString(string: dateFormat.string(from: now), attributes: [
            .font: NSFont.systemFont(ofSize: size, weight: .light),
            .foregroundColor: (NSColor(cgColor: theme.numeral) ?? .gray).withAlphaComponent(0.85),
            .kern: 0.3,
        ])
        let gap: CGFloat = 14
        let ws = weekday.size(), ds = date.size()
        let total = ws.width + gap + ds.width
        let top = bottom - size * 2.2
        // Baselines aligned, as the web row does.
        let dateFont = NSFont.systemFont(ofSize: size, weight: .light)
        let weekdayFont = NSFont.systemFont(ofSize: size * 0.72, weight: .medium)
        let baseline = top + dateFont.ascender
        let x = (bounds.width - total) / 2
        date.draw(at: CGPoint(x: x + ws.width + gap, y: baseline - dateFont.ascender))
        weekday.draw(at: CGPoint(x: x, y: baseline - weekdayFont.ascender))
    }
}
