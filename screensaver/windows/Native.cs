using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace FormTime.Screensaver
{
    /// <summary>The few Win32 calls a screensaver needs.</summary>
    static class Native
    {
        public const int WS_CHILD = 0x40000000;
        public const int WS_VISIBLE = 0x10000000;
        public const int WS_CLIPCHILDREN = 0x02000000;

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left, Top, Right, Bottom;
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool SetProcessDpiAwarenessContext(IntPtr value);

        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        static readonly IntPtr SystemAware = new IntPtr(-2);
        static readonly IntPtr PerMonitorAwareV2 = new IntPtr(-4);

        /// <summary>
        /// Per monitor for the full-screen clock (sharp on every display);
        /// system-wide for the options dialog, which WinForms scales well.
        /// Must run before the first window is created.
        /// </summary>
        public static void SetDpiAwareness(bool perMonitor)
        {
            try
            {
                if (SetProcessDpiAwarenessContext(perMonitor ? PerMonitorAwareV2 : SystemAware)) return;
            }
            catch (EntryPointNotFoundException)
            {
                // Older than Windows 10 1703.
            }
            try { SetProcessDPIAware(); } catch (EntryPointNotFoundException) { }
        }

        /// <summary>A window handle (e.g. the Screen Saver Settings dialog) as a dialog owner.</summary>
        public sealed class Owner : IWin32Window
        {
            public Owner(IntPtr handle) { Handle = handle; }
            public IntPtr Handle { get; private set; }
        }
    }
}
