using System;
using System.Drawing;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;

namespace FormTime.Screensaver
{
    /// <summary>
    /// "Settings…" in Windows' Screen Saver Settings: the clock's look, with a
    /// live preview beside the choices. Saved for this Windows user.
    /// </summary>
    sealed class OptionsForm : Form
    {
        readonly WebHost host;
        readonly Options options;

        readonly ComboBox face = Combo(Options.Faces);
        readonly ComboBox appearance = Combo(Options.Appearances);
        readonly ComboBox dial = Combo(Options.Dials);
        readonly ComboBox lume = Combo(Options.Lumes);
        readonly ComboBox movement = Combo(Options.Movements);
        readonly ComboBox size = Combo(Options.Sizes);
        readonly CheckBox seconds = Check("Show seconds");
        readonly CheckBox depth = Check("Shadows && glow");
        readonly CheckBox date = Check("Show the date");
        readonly TextBox timeZone = new TextBox();

        readonly Panel previewFrame = new Panel();
        WebView2 preview;
        bool previewReady;
        bool loading;
        readonly Timer refresh = new Timer { Interval = 250 };

        static readonly Font Body = new Font("Segoe UI", 9f);
        static readonly Color Muted = Color.FromArgb(96, 104, 110);

        public OptionsForm(WebHost host, Options options)
        {
            this.host = host;
            this.options = options.Clone();

            Text = "FORM / TIME Screensaver";
            Font = Body;
            AutoScaleDimensions = new SizeF(96f, 96f);
            AutoScaleMode = AutoScaleMode.Dpi;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = true;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(744, 452);
            BackColor = Color.FromArgb(247, 246, 242);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }

            Build();
            LoadOptions(this.options);
            refresh.Tick += (sender, e) =>
            {
                refresh.Stop();
                ShowPreview();
            };
        }

        void Build()
        {
            const int left = 24, labelWidth = 104, fieldLeft = left + labelWidth, fieldWidth = 196;
            var y = 22;

            var title = new Label
            {
                Text = "FORM / TIME",
                Font = new Font("Segoe UI Semibold", 15f),
                AutoSize = true,
                Location = new Point(left - 2, y),
            };
            Controls.Add(title);
            y += 34;
            Controls.Add(new Label
            {
                Text = "The clock on its own, while your computer rests.",
                ForeColor = Muted,
                AutoSize = true,
                Location = new Point(left, y),
            });
            y += 36;

            Action<string, Control> row = (text, field) =>
            {
                Controls.Add(new Label
                {
                    Text = text,
                    AutoSize = false,
                    TextAlign = ContentAlignment.MiddleLeft,
                    Location = new Point(left, y),
                    Size = new Size(labelWidth - 8, 24),
                });
                field.Location = new Point(fieldLeft, y);
                field.Width = fieldWidth;
                Controls.Add(field);
                y += 32;
            };
            row("Face", face);
            row("Appearance", appearance);
            row("Day dial", dial);
            row("Night lume", lume);
            row("Movement", movement);
            row("Size", size);
            row("Time zone", timeZone);
            Controls.Add(new Label
            {
                Text = "Blank for this computer's, or a name like Europe/London.",
                ForeColor = Muted,
                AutoSize = false,
                Location = new Point(fieldLeft, y - 6),
                Size = new Size(fieldWidth + 20, 32),
            });
            y += 28;

            var checks = new[] { seconds, depth, date };
            foreach (var c in checks)
            {
                c.Location = new Point(left, y);
                Controls.Add(c);
                y += 26;
            }

            // The preview: the real page, at the proportions of a wide screen.
            var previewLeft = 372;
            Controls.Add(new Label
            {
                Text = "Preview",
                ForeColor = Muted,
                AutoSize = true,
                Location = new Point(previewLeft, 92),
            });
            previewFrame.Location = new Point(previewLeft, 116);
            previewFrame.Size = new Size(348, 218);
            previewFrame.BackColor = Color.Black;
            Controls.Add(previewFrame);

            var version = Assembly.GetExecutingAssembly().GetName().Version;
            Controls.Add(new Label
            {
                Text = "Version " + version.Major + "." + version.Minor + "." + version.Build,
                ForeColor = Muted,
                AutoSize = true,
                Location = new Point(previewLeft, 344),
            });

            var ok = new Button { Text = "OK", DialogResult = DialogResult.OK, Size = new Size(88, 30) };
            var cancel = new Button { Text = "Cancel", DialogResult = DialogResult.Cancel, Size = new Size(88, 30) };
            ok.Location = new Point(ClientSize.Width - 24 - 88 * 2 - 8, ClientSize.Height - 24 - 30);
            cancel.Location = new Point(ClientSize.Width - 24 - 88, ClientSize.Height - 24 - 30);
            ok.Click += (sender, e) =>
            {
                Read();
                try
                {
                    options.Save();
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, "Couldn't save the options: " + ex.Message, Text,
                        MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    DialogResult = DialogResult.None;
                }
            };
            Controls.Add(ok);
            Controls.Add(cancel);
            AcceptButton = ok;
            CancelButton = cancel;

            EventHandler changed = (sender, e) =>
            {
                if (loading) return;
                Read();
                UpdateEnabled();
                refresh.Stop();
                refresh.Start();
            };
            foreach (var c in new[] { face, appearance, dial, lume, movement, size })
                c.SelectedIndexChanged += changed;
            foreach (var c in checks) c.CheckedChanged += changed;
            timeZone.TextChanged += changed;
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            var problem = host.Problem();
            if (problem != null)
            {
                previewFrame.Controls.Add(new Label
                {
                    Text = problem,
                    ForeColor = Color.FromArgb(170, 178, 182),
                    Dock = DockStyle.Fill,
                    TextAlign = ContentAlignment.MiddleCenter,
                    Padding = new Padding(12),
                });
                return;
            }
            preview = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.Black };
            previewFrame.Controls.Add(preview);
            ShowPreview();
        }

        async void ShowPreview()
        {
            if (preview == null) return;
            try
            {
                if (!previewReady)
                {
                    previewReady = true;
                    await host.Attach(preview, options.ToQuery(), null);
                }
                else if (preview.CoreWebView2 != null)
                {
                    preview.CoreWebView2.Navigate(WebHost.Origin + "/screensaver?" + options.ToQuery());
                }
            }
            catch (Exception)
            {
                // The preview is a nicety; the options still save.
            }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            refresh.Stop();
            if (preview != null) preview.Dispose();
            base.OnFormClosed(e);
        }

        void LoadOptions(Options o)
        {
            loading = true;
            SelectChoice(face, Options.Faces, o.Face);
            SelectChoice(appearance, Options.Appearances, o.Appearance);
            SelectChoice(dial, Options.Dials, o.Dial);
            SelectChoice(lume, Options.Lumes, o.Lume);
            SelectChoice(movement, Options.Movements, o.Movement);
            SelectChoice(size, Options.Sizes, o.Size);
            seconds.Checked = o.Seconds;
            depth.Checked = o.Depth;
            date.Checked = o.Date;
            timeZone.Text = o.TimeZone;
            loading = false;
            UpdateEnabled();
        }

        void Read()
        {
            options.Face = Id(face, options.Face);
            options.Appearance = Id(appearance, options.Appearance);
            options.Dial = Id(dial, options.Dial);
            options.Lume = Id(lume, options.Lume);
            options.Movement = Id(movement, options.Movement);
            options.Size = Id(size, options.Size);
            options.Seconds = seconds.Checked;
            options.Depth = depth.Checked;
            options.Date = date.Checked;
            options.TimeZone = timeZone.Text.Trim();
        }

        /// <summary>Choices that don't apply to the current look are greyed, not hidden.</summary>
        void UpdateEnabled()
        {
            dial.Enabled = options.Appearance != "night";
            lume.Enabled = options.Appearance != "day";
            movement.Enabled = options.Face == "analog";
        }

        static ComboBox Combo(Choice[] choices)
        {
            var box = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList };
            box.Items.AddRange(choices);
            return box;
        }

        static CheckBox Check(string text)
        {
            return new CheckBox { Text = text, AutoSize = true };
        }

        static void SelectChoice(ComboBox box, Choice[] choices, string id)
        {
            for (var i = 0; i < choices.Length; i++)
                if (choices[i].Id == id) { box.SelectedIndex = i; return; }
            box.SelectedIndex = 0;
        }

        static string Id(ComboBox box, string fallback)
        {
            var c = box.SelectedItem as Choice;
            return c == null ? fallback : c.Id;
        }
    }
}
