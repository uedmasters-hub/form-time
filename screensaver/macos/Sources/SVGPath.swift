import CoreGraphics
import Foundation

/// Builds a CGPath from SVG path data, so the screen saver draws the very
/// outlines the web app draws (hands.ts, numerals.ts). Supports the commands
/// those use: M L H V C Q A Z, absolute coordinates.
enum SVGPath {
    static func parse(_ d: String) -> CGPath {
        let path = CGMutablePath()
        var tokens = tokenize(d)[...]
        var command: Character = "M"
        var current = CGPoint.zero
        var start = CGPoint.zero

        func number() -> CGFloat {
            guard case .number(let n)? = tokens.first else { return 0 }
            tokens = tokens.dropFirst()
            return n
        }
        func nextIsNumber() -> Bool {
            if case .number? = tokens.first { return true }
            return false
        }

        while !tokens.isEmpty {
            if case .command(let c)? = tokens.first {
                command = c
                tokens = tokens.dropFirst()
                if c == "Z" || c == "z" {
                    path.closeSubpath()
                    current = start
                    continue
                }
            } else if !nextIsNumber() {
                break
            }
            switch command {
            case "M":
                current = CGPoint(x: number(), y: number())
                start = current
                path.move(to: current)
                command = "L" // further pairs are lines
            case "L":
                current = CGPoint(x: number(), y: number())
                path.addLine(to: current)
            case "H":
                current = CGPoint(x: number(), y: current.y)
                path.addLine(to: current)
            case "V":
                current = CGPoint(x: current.x, y: number())
                path.addLine(to: current)
            case "C":
                let c1 = CGPoint(x: number(), y: number())
                let c2 = CGPoint(x: number(), y: number())
                current = CGPoint(x: number(), y: number())
                path.addCurve(to: current, control1: c1, control2: c2)
            case "Q":
                let c = CGPoint(x: number(), y: number())
                current = CGPoint(x: number(), y: number())
                path.addQuadCurve(to: current, control: c)
            case "A":
                let rx = number(), ry = number(), rotation = number()
                let large = number() != 0, sweep = number() != 0
                let end = CGPoint(x: number(), y: number())
                addArc(path, from: current, to: end, rx: rx, ry: ry,
                       rotation: rotation, large: large, sweep: sweep)
                current = end
            default:
                tokens = tokens.dropFirst() // unsupported: skip
            }
        }
        return path
    }

    private enum Token {
        case command(Character)
        case number(CGFloat)
    }

    private static func tokenize(_ d: String) -> [Token] {
        var tokens: [Token] = []
        var buffer = ""
        func flush() {
            if !buffer.isEmpty, let n = Double(buffer) { tokens.append(.number(CGFloat(n))) }
            buffer = ""
        }
        for ch in d {
            if ch.isLetter && ch != "e" && ch != "E" {
                flush()
                tokens.append(.command(ch))
            } else if ch == " " || ch == "," || ch == "\n" || ch == "\t" {
                flush()
            } else if ch == "-" && !buffer.isEmpty && !buffer.hasSuffix("e") && !buffer.hasSuffix("E") {
                flush()
                buffer.append(ch)
            } else if ch == "." && buffer.contains(".") {
                flush()
                buffer.append(ch)
            } else {
                buffer.append(ch)
            }
        }
        flush()
        return tokens
    }

    /// SVG's endpoint arc, converted to a centre arc (SVG 1.1, appendix F.6.5).
    private static func addArc(
        _ path: CGMutablePath, from p1: CGPoint, to p2: CGPoint,
        rx rxIn: CGFloat, ry ryIn: CGFloat, rotation: CGFloat, large: Bool, sweep: Bool
    ) {
        var rx = abs(rxIn), ry = abs(ryIn)
        if p1 == p2 { return }
        if rx == 0 || ry == 0 { path.addLine(to: p2); return }
        let phi = rotation * .pi / 180
        let cosPhi = cos(phi), sinPhi = sin(phi)
        let dx2 = (p1.x - p2.x) / 2, dy2 = (p1.y - p2.y) / 2
        let x1p = cosPhi * dx2 + sinPhi * dy2
        let y1p = -sinPhi * dx2 + cosPhi * dy2

        let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
        if lambda > 1 {
            let s = sqrt(lambda)
            rx *= s
            ry *= s
        }
        let num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
        let den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
        let coef = (large == sweep ? -1 : 1) * sqrt(max(0, num / den))
        let cxp = coef * (rx * y1p / ry)
        let cyp = coef * (-ry * x1p / rx)
        let cx = cosPhi * cxp - sinPhi * cyp + (p1.x + p2.x) / 2
        let cy = sinPhi * cxp + cosPhi * cyp + (p1.y + p2.y) / 2

        func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
            atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        }
        let ux = (x1p - cxp) / rx, uy = (y1p - cyp) / ry
        let vx = (-x1p - cxp) / rx, vy = (-y1p - cyp) / ry
        let theta1 = angle(1, 0, ux, uy)
        var delta = angle(ux, uy, vx, vy)
        if !sweep && delta > 0 { delta -= 2 * .pi }
        if sweep && delta < 0 { delta += 2 * .pi }

        let transform = CGAffineTransform(translationX: cx, y: cy)
            .rotated(by: phi)
            .scaledBy(x: rx, y: ry)
        path.addArc(center: .zero, radius: 1, startAngle: theta1, endAngle: theta1 + delta,
                    clockwise: delta < 0, transform: transform)
    }
}
