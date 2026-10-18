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
        // macOS 14+: the engine may never call stopAnimation, and keeps its
        // process (and every old view) alive. When the screen saver ends,
        // let go of the clock and quit; macOS starts a fresh process next time.
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
        if #available(macOS 14.0, *) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { exit(0) }
        }
    }

    // MARK: The clock

    private func loadClock() {
        let bundle = Bundle(for: FormTimeSaverView.self)
        guard let root = bundle.resourceURL?.appendingPathComponent("web", isDirectory: true),
              FileManager.default.fileExists(atPath: root.appendingPathComponent("screensaver.html").path)
        else {
            showMessage("The clock's files are missing. Reinstall the FORM / TIME screen saver.")
            return
        }

        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(WebFiles(root: root), forURLScheme: WebFiles.scheme)
        configuration.suppressesIncrementalRendering = true
        configuration.websiteDataStore = .nonPersistent()

        let view = PassiveWebView(frame: bounds, configuration: configuration)
        view.autoresizingMask = [.width, .height]
        view.navigationDelegate = self
        if #available(macOS 12.0, *) { view.underPageBackgroundColor = .black }
        // Shown once the page has loaded, so there's no white flash.
        view.alphaValue = 0
        addSubview(view)
        webView = view
        view.load(URLRequest(url: options.url))
    }

    private func removeClock() {
        webView?.stopLoading()
        webView?.navigationDelegate = nil
        webView?.removeFromSuperview()
        webView = nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.25
            webView.animator().alphaValue = 1
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        // Stay on the clock: nothing navigates away.
        decisionHandler(navigationAction.request.url?.scheme == WebFiles.scheme ? .allow : .cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    private func showMessage(_ text: String) {
        let label = NSTextField(wrappingLabelWithString: looksLikePreview ? "FORM / TIME" : text)
        label.textColor = NSColor(white: 0.62, alpha: 1)
        label.alignment = .center
        label.font = .systemFont(ofSize: looksLikePreview ? 9 : 18)
        label.frame = bounds.insetBy(dx: bounds.width * 0.1, dy: bounds.height * 0.42)
        label.autoresizingMask = [.width, .minYMargin, .maxYMargin]
        addSubview(label)
    }

    // MARK: Options…

    override var hasConfigureSheet: Bool { true }

    override var configureSheet: NSWindow? {
        let sheet = OptionsSheet(options: SaverOptions.load()) { [weak self] saved in
            guard let self = self else { return }
            self.options = saved
            // The preview in System Settings shows the new look at once.
            if let view = self.webView {
                view.alphaValue = 0
                view.load(URLRequest(url: saved.url))
            }
        }
        self.sheet = sheet
        return sheet.window
    }
}

/// The page is for looking at: clicks and keys go to the screen-saver
/// engine (which closes it), never into the page.
final class PassiveWebView: WKWebView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override var acceptsFirstResponder: Bool { false }
}
