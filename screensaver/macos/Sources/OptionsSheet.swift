import AppKit

/// System Settings → Screen Saver → FORM / TIME → Options…: the clock's look.
final class OptionsSheet: NSObject {
    let window: NSWindow
    private var options: SaverOptions
    private let onSave: (SaverOptions) -> Void

    private let face = OptionsSheet.popup(SaverOptions.faces)
    private let appearance = OptionsSheet.popup(SaverOptions.appearances)
    private let dial = OptionsSheet.popup(SaverOptions.dials)
    private let lume = OptionsSheet.popup(SaverOptions.lumes)
    private let movement = OptionsSheet.popup(SaverOptions.movements)
    private let size = OptionsSheet.popup(SaverOptions.sizes)
    private let timeZone = NSPopUpButton()
    private let seconds = NSButton(checkboxWithTitle: "Show seconds", target: nil, action: nil)
    private let depth = NSButton(checkboxWithTitle: "Shadows & glow", target: nil, action: nil)
    private let date = NSButton(checkboxWithTitle: "Show the date", target: nil, action: nil)

    init(options: SaverOptions, onSave: @escaping (SaverOptions) -> Void) {
        self.options = options
        self.onSave = onSave
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 440, height: 470),
            styleMask: [.titled],
            backing: .buffered,
            defer: true
        )
        super.init()
        window.title = "FORM / TIME"
        build()
        fill()
    }

    private func build() {
        let title = NSTextField(labelWithString: "FORM / TIME")
        title.font = .systemFont(ofSize: 17, weight: .semibold)
        let subtitle = NSTextField(labelWithString: "The clock on its own, while your Mac rests.")
        subtitle.textColor = .secondaryLabelColor

        timeZone.addItem(withTitle: "This Mac’s time zone")
        timeZone.lastItem?.representedObject = ""
        timeZone.menu?.addItem(.separator())
        for id in TimeZone.knownTimeZoneIdentifiers.sorted() {
            timeZone.addItem(withTitle: id.replacingOccurrences(of: "_", with: " "))
            timeZone.lastItem?.representedObject = id
        }

        for control in [appearance, face] {
            control.target = self
            control.action = #selector(changed)
        }

        let label = { (text: String) -> NSTextField in
            let field = NSTextField(labelWithString: text)
            field.alignment = .right
            return field
        }
        let grid = NSGridView(views: [
            [label("Face:"), face],
            [label("Appearance:"), appearance],
            [label("Day dial:"), dial],
            [label("Night lume:"), lume],
            [label("Movement:"), movement],
            [label("Size:"), size],
            [label("Time zone:"), timeZone],
            [NSGridCell.emptyContentView, seconds],
            [NSGridCell.emptyContentView, depth],
            [NSGridCell.emptyContentView, date],
        ])
        grid.rowSpacing = 10
        grid.columnSpacing = 10
        grid.column(at: 0).xPlacement = .trailing
        grid.rowAlignment = .firstBaseline
        for control in [face, appearance, dial, lume, movement, size, timeZone] {
            control.widthAnchor.constraint(equalToConstant: 240).isActive = true
        }

        let cancel = NSButton(title: "Cancel", target: self, action: #selector(cancelPressed))
        cancel.keyEquivalent = "\u{1b}"
        let ok = NSButton(title: "OK", target: self, action: #selector(okPressed))
        ok.keyEquivalent = "\r"
        let buttons = NSStackView(views: [cancel, ok])
        buttons.spacing = 12

        let header = NSStackView(views: [title, subtitle])
        header.orientation = .vertical
        header.alignment = .leading
        header.spacing = 4

        let stack = NSStackView(views: [header, grid, buttons])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 22
        stack.edgeInsets = NSEdgeInsets(top: 22, left: 24, bottom: 20, right: 24)
        stack.setCustomSpacing(26, after: grid)
        buttons.translatesAutoresizingMaskIntoConstraints = false

        let content = NSView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            stack.topAnchor.constraint(equalTo: content.topAnchor),
            stack.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            buttons.trailingAnchor.constraint(equalTo: stack.trailingAnchor, constant: -24),
        ])
        window.contentView = content
        // As tall as the choices need, whatever the system's text size.
        window.setContentSize(content.fittingSize)
    }

    private func fill() {
        OptionsSheet.select(face, options.face)
        OptionsSheet.select(appearance, options.appearance)
        OptionsSheet.select(dial, options.dial)
        OptionsSheet.select(lume, options.lume)
        OptionsSheet.select(movement, options.movement)
        OptionsSheet.select(size, options.size)
        OptionsSheet.select(timeZone, options.timeZone)
        seconds.state = options.seconds ? .on : .off
        depth.state = options.depth ? .on : .off
        date.state = options.date ? .on : .off
        changed()
    }

    /// Choices that don't apply to the current look are dimmed, not hidden.
    @objc private func changed() {
        let look = OptionsSheet.id(appearance, options.appearance)
        dial.isEnabled = look != "night"
        lume.isEnabled = look != "day"
        movement.isEnabled = OptionsSheet.id(face, options.face) == "analog"
    }

    @objc private func okPressed() {
        options.face = OptionsSheet.id(face, options.face)
        options.appearance = OptionsSheet.id(appearance, options.appearance)
        options.dial = OptionsSheet.id(dial, options.dial)
        options.lume = OptionsSheet.id(lume, options.lume)
        options.movement = OptionsSheet.id(movement, options.movement)
        options.size = OptionsSheet.id(size, options.size)
        options.timeZone = OptionsSheet.id(timeZone, "")
        options.seconds = seconds.state == .on
        options.depth = depth.state == .on
        options.date = date.state == .on
        options.save()
        onSave(options)
        close()
    }

    @objc private func cancelPressed() {
        close()
    }

    private func close() {
        if let parent = window.sheetParent {
            parent.endSheet(window)
        } else {
            NSApp.endSheet(window)
            window.orderOut(nil)
        }
    }

    private static func popup(_ choices: [Choice]) -> NSPopUpButton {
        let button = NSPopUpButton()
        for choice in choices {
            button.addItem(withTitle: choice.name)
            button.lastItem?.representedObject = choice.id
        }
        return button
    }

    private static func select(_ button: NSPopUpButton, _ id: String) {
        let index = button.itemArray.firstIndex { ($0.representedObject as? String) == id }
        button.selectItem(at: index ?? 0)
    }

    private static func id(_ button: NSPopUpButton, _ fallback: String) -> String {
        (button.selectedItem?.representedObject as? String) ?? fallback
    }
}
