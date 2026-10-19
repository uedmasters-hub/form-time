import AppKit
import ScreenSaver

/// FORM / TIME as a macOS screen saver. The clock is drawn natively
/// (ClockView, ClockRenderer): macOS 26.4 and later blank out web content
/// inside screen savers after a few seconds, so this doesn't use WebKit.
/// System Settings → Screen Saver → Options… sets the clock's look.
///
/// macOS creates one view per display (and a small one for the preview in
/// System Settings), and on recent versions creates new views each time
/// without always stopping the old ones, so each view stops its own clock
/// when the screen saver ends.
@objc(FormTimeSaverView)
final class FormTimeSaverView: ScreenSaverView {
    private var clock: ClockView?
    private var sheet: OptionsSheet?

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
        // The clock keeps its own time; the engine needn't call us often.
        animationTimeInterval = 1
        let clock = ClockView(frame: bounds, options: SaverOptions.load())
        clock.autoresizingMask = [.width, .height]
        addSubview(clock)
        self.clock = clock
        NSLog("FORM TIME screen saver: started %.0f×%.0f, preview %d", bounds.width, bounds.height, isPreview ? 1 : 0)
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
        clock?.start()
    }

    override func stopAnimation() {
        super.stopAnimation()
        if !looksLikePreview { clock?.stop() }
    }

    override func animateOneFrame() {
        // Nothing here: the clock runs its own timer (the engine's frame
        // calls have been unreliable since macOS 14).
    }

    override func draw(_ rect: NSRect) {
        NSColor.black.setFill()
        rect.fill()
    }

    @objc private func screenSaverWillStop(_ note: Notification) {
        guard !looksLikePreview else { return }
        clock?.stop()
    }

    // MARK: Options…

    override var hasConfigureSheet: Bool { true }

    override var configureSheet: NSWindow? {
        let sheet = OptionsSheet(options: SaverOptions.load()) { [weak self] saved in
            // The preview in System Settings shows the new look at once.
            self?.clock?.options = saved
        }
        self.sheet = sheet
        return sheet.window
    }
}
