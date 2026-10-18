using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace FormTime.Screensaver
{
    /// <summary>
    /// Serves the web app's static export (the "web" folder beside the .scr)
    /// to WebView2 under https://form-time.screensaver/, the way the desktop
    /// app serves it under app://form-time/: "/screensaver" is
    /// screensaver.html, and absolute paths like /_expo/… resolve. Nothing is
    /// fetched from the internet, and nothing else may load.
    /// </summary>
    sealed class WebHost
    {
        public const string Host = "form-time.screensaver";
        public const string Origin = "https://" + Host;

        /// <summary>
        /// Only the app's own files; no network at all. Styles may be inline
        /// (React Native Web writes them so) and the page has one small inline script.
        /// </summary>
        const string Csp =
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' data: blob:; " +
            "object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

        /// <summary>Anything the person does in the page closes the screensaver.</summary>
        const string InputScript =
            "(function(){" +
            "var send=function(){try{window.chrome.webview.postMessage('input');}catch(e){}};" +
            "addEventListener('keydown',send,true);" +
            "addEventListener('pointerdown',send,true);" +
            "addEventListener('wheel',send,{capture:true,passive:true});" +
            "addEventListener('contextmenu',function(e){e.preventDefault();},true);" +
            "})();";

        static readonly Dictionary<string, string> Types = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { ".html", "text/html; charset=utf-8" },
            { ".js", "text/javascript; charset=utf-8" },
            { ".mjs", "text/javascript; charset=utf-8" },
            { ".css", "text/css; charset=utf-8" },
            { ".json", "application/json" },
            { ".map", "application/json" },
            { ".svg", "image/svg+xml" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".ico", "image/x-icon" },
            { ".ttf", "font/ttf" },
            { ".otf", "font/otf" },
            { ".woff", "font/woff" },
            { ".woff2", "font/woff2" },
            { ".txt", "text/plain; charset=utf-8" },
        };

        public readonly string WebRoot;
        Task<CoreWebView2Environment> environment;

        public WebHost()
        {
            WebRoot = Path.Combine(AppDirectory, "web");
        }

        public static string AppDirectory
        {
            get { return Path.GetDirectoryName(Application.ExecutablePath); }
        }

        /// <summary>WebView2's own data (cache), kept per user, never beside the .scr.</summary>
        static string UserDataFolder
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "FORM TIME", "Screensaver", "WebView2");
            }
        }

        /// <summary>Why the clock can't show, or null when it can.</summary>
        public string Problem()
        {
            if (!File.Exists(Path.Combine(WebRoot, "screensaver.html")))
                return "The clock's files are missing. Reinstall the FORM / TIME screensaver.";
            try
            {
                CoreWebView2Environment.GetAvailableBrowserVersionString();
            }
            catch (WebView2RuntimeNotFoundException)
            {
                return "FORM / TIME needs the Microsoft Edge WebView2 Runtime.\nGet it from go.microsoft.com/fwlink/p/?LinkId=2124703";
            }
            catch (Exception)
            {
                return "FORM / TIME couldn't start Microsoft Edge WebView2.";
            }
            return null;
        }

        Task<CoreWebView2Environment> SharedEnvironment()
        {
            if (environment == null)
            {
                Directory.CreateDirectory(UserDataFolder);
                environment = CoreWebView2Environment.CreateAsync(null, UserDataFolder);
            }
            return environment;
        }

        /// <summary>Shows the screensaver page with these options in a WebView2 control.</summary>
        /// <param name="onInput">Called on a key, click or scroll in the page; null in previews.</param>
        public async Task Attach(WebView2 view, string query, Action onInput)
        {
            view.DefaultBackgroundColor = Color.Black;
            var env = await SharedEnvironment();
            await view.EnsureCoreWebView2Async(env);
            var core = view.CoreWebView2;

            var s = core.Settings;
            s.AreDevToolsEnabled = false;
            s.AreDefaultContextMenusEnabled = false;
            s.AreDefaultScriptDialogsEnabled = false;
            s.IsStatusBarEnabled = false;
            s.IsZoomControlEnabled = false;
            s.IsPinchZoomEnabled = false;
            s.IsSwipeNavigationEnabled = false;
            s.AreBrowserAcceleratorKeysEnabled = false;
            s.IsGeneralAutofillEnabled = false;
            s.IsPasswordAutosaveEnabled = false;

            core.AddWebResourceRequestedFilter(Origin + "/*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += (sender, e) => e.Response = Respond(env, e.Request.Uri);
            // Stay on the clock: no new windows, no navigating away.
            core.NewWindowRequested += (sender, e) => e.Handled = true;
            core.NavigationStarting += (sender, e) =>
            {
                if (!e.Uri.StartsWith(Origin + "/", StringComparison.OrdinalIgnoreCase)) e.Cancel = true;
            };

            if (onInput != null)
            {
                await core.AddScriptToExecuteOnDocumentCreatedAsync(InputScript);
                core.WebMessageReceived += (sender, e) => onInput();
            }

            core.Navigate(Origin + "/screensaver?" + query);
        }

        CoreWebView2WebResourceResponse Respond(CoreWebView2Environment env, string uri)
        {
            try
            {
                var file = FileFor(new Uri(uri).AbsolutePath);
                if (file == null) return env.CreateWebResourceResponse(null, 404, "Not Found", "");
                var type = Types.ContainsKey(Path.GetExtension(file)) ? Types[Path.GetExtension(file)] : "application/octet-stream";
                var headers = "Content-Type: " + type;
                if (type.StartsWith("text/html", StringComparison.Ordinal))
                    headers += "\r\nContent-Security-Policy: " + Csp + "\r\nCache-Control: no-cache";
                // Read now: WebView2 reads the stream later, on its own schedule.
                var bytes = File.ReadAllBytes(file);
                return env.CreateWebResourceResponse(new MemoryStream(bytes), 200, "OK", headers);
            }
            catch (Exception)
            {
                return env.CreateWebResourceResponse(null, 500, "Error", "");
            }
        }

        /// <summary>The file for a path in the export: "/" is index.html, "/screensaver" is screensaver.html.</summary>
        string FileFor(string path)
        {
            var rel = Uri.UnescapeDataString(path).Replace('/', Path.DirectorySeparatorChar).TrimStart(Path.DirectorySeparatorChar);
            if (rel.Length == 0 || rel.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal)) rel += "index.html";
            var root = Path.GetFullPath(WebRoot);
            var full = Path.GetFullPath(Path.Combine(root, rel));
            if (!full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) return null;
            if (File.Exists(full)) return full;
            if (File.Exists(full + ".html")) return full + ".html";
            if (Path.HasExtension(full)) return null; // a missing script or image
            return Path.Combine(root, "index.html"); // a client-side route
        }
    }
}
