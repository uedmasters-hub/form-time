using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;

namespace FormTime.Screensaver
{
    /// <summary>
    /// A Windows screensaver is a program Windows starts with one of:
    ///   /s           show it, full screen (also what "Preview" and double-clicking do)
    ///   /p &lt;hwnd&gt;    draw it inside the Screen Saver Settings dialog's little monitor
    ///   /c[:hwnd]    show its options (no argument at all means the same)
    /// </summary>
    static class Program
    {
        /// <summary>Input during the first moments is the click or key that started it.</summary>
        const int GraceMs = 700;
        /// <summary>Pointer travel (pixels) that counts as the person being back.</summary>
        const int MoveThreshold = 10;

        [STAThread]
        static int Main(string[] args)
        {
            IntPtr handle;
            var mode = ParseArgs(args, out handle);

            Native.SetDpiAwareness(mode != 'c');
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            switch (mode)
            {
                case 's': return Show();
                case 'p': return Preview(handle);
                default: return Configure(handle);
            }
        }

        /// <summary>"/s", "-S", "/p 1234", "/p:1234", "/c:1234", "/c", or nothing.</summary>
        static char ParseArgs(string[] args, out IntPtr handle)
        {
            handle = IntPtr.Zero;
            if (args.Length == 0) return 'c';
            var first = args[0].Trim().ToLowerInvariant();
            var mode = first.Length >= 2 && (first[0] == '/' || first[0] == '-') ? first[1] : 'c';
            string number = null;
            var colon = first.IndexOf(':');
            if (colon >= 0) number = first.Substring(colon + 1);
            else if (args.Length > 1) number = args[1];
            long value;
            if (number != null && long.TryParse(number.Trim(), out value)) handle = new IntPtr(value);
            if (mode != 's' && mode != 'p') mode = 'c';
            if (mode == 'p' && handle == IntPtr.Zero) return 'c';
            return mode;
        }

        static int Show()
        {
            bool first;
            using (new Mutex(true, @"Local\FormTimeScreensaver.Show", out first))
            {
                if (!first) return 0; // already showing

                var host = new WebHost();
                var query = Options.Load().ToQuery();
                var started = Stopwatch.StartNew();
                var closing = false;
                Action close = () =>
                {
                    if (closing || started.ElapsedMilliseconds < GraceMs) return;
                    closing = true;
                    Application.Exit();
                };

                var forms = new List<ScreensaverForm>();
                foreach (var screen in Screen.AllScreens)
                {
                    var form = new ScreensaverForm(screen.Bounds, IntPtr.Zero, close);
                    forms.Add(form);
                }

                // The pointer moving (more than a twitch) brings the desktop back.
                var origin = Cursor.Position;
                var watch = new System.Windows.Forms.Timer { Interval = 100 };
                watch.Tick += (sender, e) =>
                {
                    var p = Cursor.Position;
                    if (Math.Abs(p.X - origin.X) > MoveThreshold || Math.Abs(p.Y - origin.Y) > MoveThreshold) close();
                };

                Cursor.Hide();
                foreach (var form in forms)
                {
                    form.Show();
                    form.Start(host, query);
                }
                if (forms.Count > 0) forms[0].Activate();
                watch.Start();
                Application.Run();
                watch.Stop();
                return 0;
            }
        }

        static int Preview(IntPtr parent)
        {
            Native.RECT rect;
            if (!Native.IsWindow(parent) || !Native.GetClientRect(parent, out rect)) return 0;
            var form = new ScreensaverForm(new Rectangle(0, 0, rect.Right - rect.Left, rect.Bottom - rect.Top), parent, null);

            // The dialog closes or picks another screensaver: its window goes, and so
            // do we, at once (a preview has nothing to save, and a tidy shutdown
            // would wait on a window that no longer exists).
            var watch = new System.Windows.Forms.Timer { Interval = 250 };
            watch.Tick += (sender, e) =>
            {
                if (!Native.IsWindow(parent)) Leave();
            };
            // Destroying the dialog's window destroys ours with it.
            form.HandleDestroyed += (sender, e) =>
            {
                if (!form.RecreatingHandle) Leave();
            };
            form.Show();
            form.Start(new WebHost(), Options.Load().ToQuery());
            watch.Start();
            Application.Run();
            return 0;
        }

        /// <summary>Ends a preview straight away: there's nothing to save.</summary>
        static void Leave()
        {
            Process.GetCurrentProcess().Kill();
        }

        static int Configure(IntPtr owner)
        {
            using (var dialog = new OptionsForm(new WebHost(), Options.Load()))
            {
                if (owner != IntPtr.Zero && Native.IsWindow(owner)) dialog.ShowDialog(new Native.Owner(owner));
                else dialog.ShowDialog();
            }
            return 0;
        }
    }
}
