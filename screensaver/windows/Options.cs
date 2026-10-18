using System;
using System.Collections.Generic;
using System.Text;
using Microsoft.Win32;

namespace FormTime.Screensaver
{
    /// <summary>A choice shown in the options dialog: the web app's id and its name.</summary>
    sealed class Choice
    {
        public readonly string Id;
        public readonly string Name;
        public Choice(string id, string name) { Id = id; Name = name; }
        public override string ToString() { return Name; }
    }

    /// <summary>
    /// The screensaver's options, kept for this Windows user in
    /// HKCU\Software\FORM TIME\Screensaver and passed to the page in its
    /// address. The ids match the web app's settings (settings.ts,
    /// dial-palettes.ts); anything unknown falls back to the defaults there.
    /// </summary>
    sealed class Options
    {
        const string KeyPath = @"Software\FORM TIME\Screensaver";

        public static readonly Choice[] Faces =
        {
            new Choice("analog", "Analog"),
            new Choice("digital", "Digital"),
        };

        public static readonly Choice[] Appearances =
        {
            new Choice("system", "Match Windows"),
            new Choice("day", "Day"),
            new Choice("night", "Night"),
        };

        public static readonly Choice[] Dials =
        {
            new Choice("aqua", "Aqua"),
            new Choice("ivory", "Ivory"),
            new Choice("graphite", "White"),
            new Choice("turquoise", "Turquoise"),
            new Choice("glacier", "Glacier"),
            new Choice("ocean", "Ocean"),
            new Choice("pistachio", "Pistachio"),
            new Choice("sun", "Sun"),
            new Choice("salmon", "Salmon"),
            new Choice("lavender", "Lavender"),
            new Choice("slate", "Slate"),
        };

        public static readonly Choice[] Lumes =
        {
            new Choice("aqua", "Aqua"),
            new Choice("ice", "Ice blue"),
            new Choice("green", "Green"),
            new Choice("seafoam", "Seafoam"),
            new Choice("amber", "Amber"),
            new Choice("peach", "Peach"),
            new Choice("yellow", "Yellow"),
            new Choice("lavender", "Lavender"),
            new Choice("rose", "Rose"),
            new Choice("red", "Red"),
            new Choice("white", "White"),
        };

        public static readonly Choice[] Movements =
        {
            new Choice("smooth", "Smooth"),
            new Choice("mechanical", "Mechanical (8 beats a second)"),
            new Choice("quartz", "Quartz (one tick a second)"),
        };

        public static readonly Choice[] Sizes =
        {
            new Choice("classic", "Classic"),
            new Choice("compact", "Compact"),
        };

        public string Face = "analog";
        public string Appearance = "system";
        public string Dial = "aqua";
        public string Lume = "aqua";
        public string Movement = "smooth";
        public string Size = "classic";
        public bool Seconds = true;
        public bool Depth = true;
        public bool Date = true;
        /// <summary>IANA time zone, e.g. "Asia/Kolkata"; empty for this computer's.</summary>
        public string TimeZone = "";

        public Options Clone() { return (Options)MemberwiseClone(); }

        public static Options Load()
        {
            var o = new Options();
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(KeyPath))
                {
                    if (key == null) return o;
                    o.Face = Pick(key, "Face", Faces, o.Face);
                    o.Appearance = Pick(key, "Appearance", Appearances, o.Appearance);
                    o.Dial = Pick(key, "Dial", Dials, o.Dial);
                    o.Lume = Pick(key, "Lume", Lumes, o.Lume);
                    o.Movement = Pick(key, "Movement", Movements, o.Movement);
                    o.Size = Pick(key, "Size", Sizes, o.Size);
                    o.Seconds = Flag(key, "Seconds", o.Seconds);
                    o.Depth = Flag(key, "Depth", o.Depth);
                    o.Date = Flag(key, "Date", o.Date);
                    o.TimeZone = (key.GetValue("TimeZone") as string ?? "").Trim();
                }
            }
            catch (Exception)
            {
                // Unreadable: the defaults are fine.
            }
            return o;
        }

        public void Save()
        {
            using (var key = Registry.CurrentUser.CreateSubKey(KeyPath))
            {
                key.SetValue("Face", Face);
                key.SetValue("Appearance", Appearance);
                key.SetValue("Dial", Dial);
                key.SetValue("Lume", Lume);
                key.SetValue("Movement", Movement);
                key.SetValue("Size", Size);
                key.SetValue("Seconds", Seconds ? 1 : 0, RegistryValueKind.DWord);
                key.SetValue("Depth", Depth ? 1 : 0, RegistryValueKind.DWord);
                key.SetValue("Date", Date ? 1 : 0, RegistryValueKind.DWord);
                key.SetValue("TimeZone", TimeZone ?? "");
            }
        }

        /// <summary>The page's query string, e.g. "face=analog&amp;appearance=night&amp;…".</summary>
        public string ToQuery()
        {
            var parts = new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("face", Face),
                new KeyValuePair<string, string>("appearance", Appearance),
                new KeyValuePair<string, string>("dial", Dial),
                new KeyValuePair<string, string>("lume", Lume),
                new KeyValuePair<string, string>("movement", Movement),
                new KeyValuePair<string, string>("size", Size),
                new KeyValuePair<string, string>("seconds", Seconds ? "1" : "0"),
                new KeyValuePair<string, string>("depth", Depth ? "1" : "0"),
                new KeyValuePair<string, string>("date", Date ? "1" : "0"),
                new KeyValuePair<string, string>("tz", string.IsNullOrWhiteSpace(TimeZone) ? "local" : TimeZone.Trim()),
            };
            var sb = new StringBuilder();
            foreach (var p in parts)
            {
                if (sb.Length > 0) sb.Append('&');
                sb.Append(Uri.EscapeDataString(p.Key)).Append('=').Append(Uri.EscapeDataString(p.Value));
            }
            return sb.ToString();
        }

        static string Pick(RegistryKey key, string name, Choice[] allowed, string fallback)
        {
            var value = key.GetValue(name) as string;
            foreach (var c in allowed)
                if (c.Id == value) return c.Id;
            return fallback;
        }

        static bool Flag(RegistryKey key, string name, bool fallback)
        {
            var value = key.GetValue(name);
            if (value is int) return (int)value != 0;
            return fallback;
        }
    }
}
