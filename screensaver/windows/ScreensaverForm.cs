using System;
using System.Drawing;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;

namespace FormTime.Screensaver
{
    /// <summary>
    /// One screen's clock: a borderless, top-most window covering a monitor
    /// (or, in a preview, a child of the Screen Saver Settings dialog's
    /// little monitor) with the page in WebView2.
    /// </summary>
    sealed class ScreensaverForm : Form
    {
        readonly IntPtr previewParent;
        readonly WebView2 view;
        readonly Action onInput;

        /// <param name="bounds">The monitor's bounds, or the preview's client area.</param>
        /// <param name="previewParent">The preview window to live inside, or zero for full screen.</param>
        /// <param name="onInput">Closes the screensaver; null in previews.</param>
        public ScreensaverForm(Rectangle bounds, IntPtr previewParent, Action onInput)
        {
            this.previewParent = previewParent;
            this.onInput = onInput;

            Text = "FORM / TIME";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            ShowInTaskbar = false;
            BackColor = Color.Black;
            Bounds = bounds;
            if (previewParent == IntPtr.Zero)
            {
                TopMost = true;
                KeyPreview = true;
            }

            view = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.Black };
            Controls.Add(view);
        }

        /// <summary>Live inside the preview window instead of being a top-level window.</summary>
        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                if (previewParent != IntPtr.Zero)
                {
                    cp.Style = Native.WS_CHILD | Native.WS_VISIBLE | Native.WS_CLIPCHILDREN;
                    cp.Parent = previewParent;
                    cp.ExStyle = 0;
                }
                return cp;
            }
        }

        public async void Start(WebHost host, string query)
        {
            var problem = host.Problem();
            if (problem != null)
            {
                ShowMessage(problem);
                return;
            }
            try
            {
                await host.Attach(view, query, onInput == null ? (Action)null : () => BeginInvoke(onInput));
                if (onInput != null) view.Focus();
            }
            catch (Exception)
            {
                ShowMessage("FORM / TIME couldn't start Microsoft Edge WebView2.");
            }
        }

        /// <summary>When the clock can't show: a quiet line on black instead of nothing.</summary>
        void ShowMessage(string text)
        {
            Controls.Remove(view);
            view.Dispose();
            var small = previewParent != IntPtr.Zero;
            var label = new Label
            {
                Text = small ? "FORM / TIME" : text,
                ForeColor = Color.FromArgb(150, 160, 165),
                BackColor = Color.Black,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter,
                Font = new Font("Segoe UI", small ? 8f : 14f),
            };
            if (onInput != null) label.MouseDown += (sender, e) => onInput();
            Controls.Add(label);
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (onInput != null) onInput();
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (onInput != null) onInput();
        }
    }
}
