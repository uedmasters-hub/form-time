import AppKit
import ScreenSaver
import WebKit

/// FORM / TIME as a macOS screen saver: the web app's /screensaver page,
/// from the copy of the web export inside this bundle, in a WKWebView.
/// System Settings → Screen Saver → Options… sets the clock's look.
///
/// macOS starts one view per display (and a small one for the preview in
/// System Settings). The screen-saver engine closes it on any input, so the
/// page itself never takes the mouse or keyboard.
@objc(FormTimeSaverView)
final class FormTimeSaverView: ScreenSaverView, WKNavigationDelegate {
    private var webView: WKWebView?
    private var sheet: OptionsSheet?
    private var options = SaverOptions.load()
    private var status: NSTextField?
    private var loaded = false
    private var reloads = 0

    /// A thumbnail-sized view is a preview, whatever `isPreview` says
    /// (macOS 14+ doesn't always report it).
    private var looksLikePreview: Bool { isPreview || bounds.width < 400 }

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        setUp()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUp()
    }

    private func setUp() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
        // The page animates itself; the engine needn't call us often.
        animationTimeInterval = 1
        log("start \(Int(bounds.width))×\(Int(bounds.height)) preview=\(isPreview) macOS \(ProcessInfo.processInfo.operatingSystemVersionString)")
        // macOS 14+ doesn't always call startAnimation (or stopAnimation), so
        // the clock starts with the view, and lets go when the screen saver ends.
        loadClock()
        DistributedNotificationCenter.default().addObserver(
            self,
            selector: #selector(screenSaverWillStop(_:)),
            name: Notification.Name("com.apple.screensaver.willstop"),
            object: nil
        )
    }

    deinit {
        DistributedNotificationCenter.default().removeObserver(self)
    }

    override func startAnimation() {
        super.startAnimation()
        if webView == nil { loadClock() }
    }

    override func stopAnimation() {
        super.stopAnimation()
        if !looksLikePreview { removeClock() }
    }

    override func animateOneFrame() {
        // Nothing to draw here: the page runs its own clock.
    }

    override func draw(_ rect: NSRect) {
        NSColor.black.setFill()
        rect.fill()
    }

    @objc private func screenSaverWillStop(_ note: Notification) {
        guard !looksLikePreview else { return }
        removeClock()
    }

    // MARK: The clock

    private func loadClock() {
        let bundle = Bundle(for: FormTimeSaverView.self)
        guard let root = bundle.resourceURL?.appendingPathComponent("web", isDirectory: true),
              FileManager.default.fileExists(atPath: root.appendingPathComponent("screensaver.html").path)
        else {
            report("The clock's files are missing from \(bundle.bundlePath). Reinstall the FORM / TIME screen saver.")
            return
        }

        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(WebFiles(root: root, log: { [weak self] in self?.log($0) }), forURLScheme: WebFiles.scheme)
        // The page reports its own errors here (shown on screen if it fails).
        let script = """
        window.addEventListener('error', function (e) {
          try { window.webkit.messageHandlers.formtime.postMessage('script error: ' + e.message + ' (' + (e.filename || '') + ':' + (e.lineno || 0) + ')'); } catch (_) {}
        });
        window.addEventListener('unhandledrejection', function (e) {
          try { window.webkit.messageHandlers.formtime.postMessage('unhandled rejection: ' + String(e.reason)); } catch (_) {}
        });
        """
        configuration.userContentController.addUserScript(
            WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController.add(MessageRelay { [weak self] in self?.report($0) }, name: "formtime")

        let view = PassiveWebView(frame: bounds, configuration: configuration)
        view.autoresizingMask = [.width, .height]
        view.navigationDelegate = self
        if #available(macOS 12.0, *) { view.underPageBackgroundColor = .black }
        addSubview(view, positioned: .below, relativeTo: status)
        webView = view
        loaded = false
        log("loading \(options.url.absoluteString)")
        view.load(URLRequest(url: options.url))

        // If the clock hasn't appeared after a while, say what the page shows.
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self, weak view] in
            guard let self = self, let view = view, view === self.webView else { return }
            self.checkPage(view)
        }
    }

    private func removeClock() {
        webView?.stopLoading()
        webView?.navigationDelegate = nil
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "formtime")
        webView?.removeFromSuperview()
        webView = nil
    }

    private func checkPage(_ view: WKWebView) {
        let js = "(function(){var r=document.querySelector('[aria-label=\"FORM / TIME screensaver\"]');" +
            "return (r?'page ok':'no clock element')+', svgs '+document.querySelectorAll('svg').length+', '+location.href;})()"
        view.evaluateJavaScript(js) { [weak self] result, error in
            guard let self = self else { return }
            let text = (result as? String) ?? "no answer: \(error.map { "\($0)" } ?? "?")"
            self.log("check after 8 s: \(text), finished=\(self.loaded)")
            if !text.hasPrefix("page ok") || text.contains("svgs 0") {
                self.report("The clock didn't load (\(text)).")
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        log("page loaded")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        report("The page failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        report("The page couldn't open: \(error.localizedDescription)")
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        log("web content process ended")
        reloads += 1
        if reloads <= 3 {
            webView.reload()
        } else {
            report("The page keeps stopping (its web process ended \(reloads) times).")
        }
    }

    /// Unified log (Console.app, or: log show --last 10m --predicate 'eventMessage CONTAINS "FORM TIME"').
    private func log(_ text: String) {
        NSLog("FORM TIME screen saver: %@", text)
    }

    /// Something went wrong: log it, and say so quietly on screen instead of a blank screen.
    private func report(_ text: String) {
        log(text)
        let label = status ?? {
            let field = NSTextField(wrappingLabelWithString: "")
            field.textColor = NSColor(white: 0.62, alpha: 1)
            field.alignment = .center
            field.autoresizingMask = [.width, .minYMargin, .maxYMargin]
            addSubview(field)
            status = field
            return field
        }()
        let small = looksLikePreview
        label.font = .systemFont(ofSize: small ? 8 : 15)
        label.stringValue = "FORM / TIME — " + text
        label.frame = bounds.insetBy(dx: bounds.width * 0.08, dy: small ? bounds.height * 0.25 : bounds.height * 0.4)
    }

    // MARK: Options…

    override var hasConfigureSheet: Bool { true }

    override var configureSheet: NSWindow? {
        let sheet = OptionsSheet(options: SaverOptions.load()) { [weak self] saved in
            guard let self = self else { return }
            self.options = saved
            // The preview in System Settings shows the new look at once.
            self.webView?.load(URLRequest(url: saved.url))
        }
        self.sheet = sheet
        return sheet.window
    }
}

/// Passes the page's messages on without the content controller keeping
/// the view alive.
final class MessageRelay: NSObject, WKScriptMessageHandler {
    private let handle: (String) -> Void
    init(_ handle: @escaping (String) -> Void) { self.handle = handle }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        handle("\(message.body)")
    }
}

/// The page is for looking at: clicks and keys go to the screen-saver
/// engine (which closes it), never into the page.
final class PassiveWebView: WKWebView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override var acceptsFirstResponder: Bool { false }
}
