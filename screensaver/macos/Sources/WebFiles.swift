import Foundation
import WebKit

/// Serves the web export inside the bundle at formtime://app/, the way the
/// desktop app serves it at app://form-time/: "/screensaver" is
/// screensaver.html, and absolute paths like /_expo/… resolve. Nothing
/// comes from the network.
final class WebFiles: NSObject, WKURLSchemeHandler {
    static let scheme = "formtime"
    static let origin = "formtime://app"

    /// Only the page's own files. Styles may be inline (React Native Web
    /// writes them so), and the page has one small inline script.
    private static let csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "media-src 'self' data: blob:",
        "object-src 'none'",
        "base-uri 'self'",
    ].joined(separator: "; ")

    private static let types: [String: String] = [
        "html": "text/html; charset=utf-8",
        "js": "text/javascript; charset=utf-8",
        "mjs": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8",
        "json": "application/json",
        "map": "application/json",
        "svg": "image/svg+xml",
        "png": "image/png",
        "jpg": "image/jpeg",
        "ico": "image/x-icon",
        "ttf": "font/ttf",
        "otf": "font/otf",
        "woff": "font/woff",
        "woff2": "font/woff2",
        "txt": "text/plain; charset=utf-8",
    ]

    private let root: URL

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL))
            return
        }
        guard let file = fileFor(url.path), let data = try? Data(contentsOf: file) else {
            let response = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: [:])!
            task.didReceive(response)
            task.didFinish()
            return
        }
        let type = Self.types[file.pathExtension.lowercased()] ?? "application/octet-stream"
        var headers = ["Content-Type": type, "Content-Length": String(data.count)]
        if type.hasPrefix("text/html") {
            headers["Content-Security-Policy"] = Self.csp
            headers["Cache-Control"] = "no-cache"
        }
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        // Files are answered at once; nothing to cancel.
    }

    /// The file for a path in the export: "/" is index.html, "/screensaver" is screensaver.html.
    private func fileFor(_ path: String) -> URL? {
        var rel = path.removingPercentEncoding ?? path
        while rel.hasPrefix("/") { rel.removeFirst() }
        if rel.isEmpty || rel.hasSuffix("/") { rel += "index.html" }
        let full = root.appendingPathComponent(rel).standardizedFileURL
        guard full.path.hasPrefix(root.path + "/") else { return nil } // outside the export
        let fm = FileManager.default
        var isDirectory: ObjCBool = false
        if fm.fileExists(atPath: full.path, isDirectory: &isDirectory), !isDirectory.boolValue { return full }
        let html = full.appendingPathExtension("html")
        if fm.fileExists(atPath: html.path) { return html }
        if !full.pathExtension.isEmpty { return nil } // a missing script or image
        return root.appendingPathComponent("index.html") // a client-side route
    }
}
