// CI check for the macOS screen saver: loads "FORM TIME.saver" the way the
// screen-saver engine does (NSBundle, principal class), shows it in a
// window, and saves what the page drew, plus the Options sheet, as PNGs.
//
//   clang -fobjc-arc -framework AppKit -framework ScreenSaver -framework WebKit \
//     mac-snapshot.m -o mac-snapshot
//   ./mac-snapshot "screensaver/build/FORM TIME.saver" out-dir
#import <AppKit/AppKit.h>
#import <ScreenSaver/ScreenSaver.h>
#import <WebKit/WebKit.h>

static NSString *outDir;
static Class saverClass;
static int failures = 0;
static NSMutableArray *keep;

static void writePNG(NSBitmapImageRep *rep, NSString *name) {
    NSData *data = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
    [data writeToFile:[outDir stringByAppendingPathComponent:name] atomically:YES];
    printf("wrote %s\n", name.UTF8String);
}

static WKWebView *findWebView(NSView *view) {
    if ([view isKindOfClass:[WKWebView class]]) return (WKWebView *)view;
    for (NSView *sub in view.subviews) {
        WKWebView *found = findWebView(sub);
        if (found) return found;
    }
    return nil;
}

static void check(NSString *name, NSSize size, BOOL preview, double wait, void (^next)(void)) {
    NSRect rect = NSMakeRect(0, 0, size.width, size.height);
    NSWindow *window = [[NSWindow alloc] initWithContentRect:rect
                                                   styleMask:NSWindowStyleMaskTitled
                                                     backing:NSBackingStoreBuffered
                                                       defer:NO];
    ScreenSaverView *view = [[saverClass alloc] initWithFrame:rect isPreview:preview];
    if (!view) { printf("::error::FAIL: init\n"); exit(1); }
    [keep addObject:window];
    [keep addObject:view];
    window.contentView = view;
    [window makeKeyAndOrderFront:nil];
    [view startAnimation];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(wait * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        WKWebView *web = findWebView(view);
        if (!web) { printf("::error::FAIL %s: no web view\n", name.UTF8String); failures++; next(); return; }
        NSString *js = @"(() => { const r = document.querySelector('[aria-label=\"FORM / TIME screensaver\"]'); "
                        "return JSON.stringify({ found: !!r, svgs: document.querySelectorAll('svg').length, "
                        "text: r ? r.innerText.replace(/\\n/g, ' | ') : '', bg: r ? getComputedStyle(r).backgroundColor : '', "
                        "path: location.pathname, search: location.search }); })()";
        [web evaluateJavaScript:js completionHandler:^(id result, NSError *error) {
            NSString *s = [result isKindOfClass:[NSString class]] ? result : @"";
            printf("::notice::%s page: %s %s\n", name.UTF8String, s.UTF8String, error ? error.description.UTF8String : "");
            if (![s containsString:@"\"found\":true"] || [s containsString:@"\"svgs\":0"]) {
                printf("::error::FAIL %s: the clock isn't on the page\n", name.UTF8String);
                failures++;
            }
            [web takeSnapshotWithConfiguration:nil completionHandler:^(NSImage *image, NSError *err) {
                NSBitmapImageRep *rep = image ? [NSBitmapImageRep imageRepWithData:image.TIFFRepresentation] : nil;
                if (rep) {
                    writePNG(rep, [name stringByAppendingString:@".png"]);
                    // How much of the picture isn't background: the clock really drew.
                    NSColor *corner = [[rep colorAtX:2 y:2] colorUsingColorSpace:NSColorSpace.sRGBColorSpace];
                    long drawn = 0, total = 0;
                    for (NSInteger y = 0; y < rep.pixelsHigh; y += 4) {
                        for (NSInteger x = 0; x < rep.pixelsWide; x += 4) {
                            NSColor *c = [[rep colorAtX:x y:y] colorUsingColorSpace:NSColorSpace.sRGBColorSpace];
                            double d = fabs(c.redComponent - corner.redComponent) + fabs(c.greenComponent - corner.greenComponent) + fabs(c.blueComponent - corner.blueComponent);
                            if (d > 0.08) drawn++;
                            total++;
                        }
                    }
                    double share = total ? 100.0 * drawn / total : 0;
                    printf("::notice::%s snapshot %ldx%ld, background %s, drawn %.1f%%\n", name.UTF8String,
                           (long)rep.pixelsWide, (long)rep.pixelsHigh, corner.description.UTF8String, share);
                    if (share < 1.0) { printf("::error::FAIL %s: the snapshot is blank\n", name.UTF8String); failures++; }
                }
                else { printf("::error::FAIL %s: snapshot %s\n", name.UTF8String, err.description.UTF8String); failures++; }
                [view stopAnimation];
                next();
            }];
        }];
    });
}

static void sheetSnapshot(void) {
    ScreenSaverView *view = [[saverClass alloc] initWithFrame:NSMakeRect(0, 0, 400, 300) isPreview:YES];
    printf("hasConfigureSheet %d\n", view.hasConfigureSheet);
    NSWindow *sheet = view.configureSheet;
    NSView *content = sheet.contentView;
    if (!content) { printf("::error::FAIL: no options sheet\n"); failures++; return; }
    [keep addObject:view];
    [sheet makeKeyAndOrderFront:nil];
    [content layoutSubtreeIfNeeded];
    printf("::notice::options sheet %.0fx%.0f\n", content.bounds.size.width, content.bounds.size.height);
    NSBitmapImageRep *rep = [content bitmapImageRepForCachingDisplayInRect:content.bounds];
    if (rep) {
        [content cacheDisplayInRect:content.bounds toBitmapImageRep:rep];
        writePNG(rep, @"options-sheet.png");
    }
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 3) { printf("usage: mac-snapshot <saver> <out-dir>\n"); return 2; }
        outDir = [NSString stringWithUTF8String:argv[2]];
        [[NSFileManager defaultManager] createDirectoryAtPath:outDir withIntermediateDirectories:YES attributes:nil error:nil];
        keep = [NSMutableArray array];

        [NSApplication sharedApplication];
        [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];

        NSBundle *bundle = [NSBundle bundleWithPath:[NSString stringWithUTF8String:argv[1]]];
        NSError *error = nil;
        if (![bundle loadAndReturnError:&error]) { printf("::error::FAIL: the bundle didn't load: %s\n", error.description.UTF8String); return 1; }
        saverClass = bundle.principalClass;
        if (![saverClass isSubclassOfClass:[ScreenSaverView class]]) { printf("::error::FAIL: no ScreenSaverView principal class\n"); return 1; }
        printf("loaded %s, version %s\n", NSStringFromClass(saverClass).UTF8String,
               [[bundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"] UTF8String]);

        check(@"full-1440x900", NSMakeSize(1440, 900), NO, 8, ^{
            check(@"preview-300x186", NSMakeSize(300, 186), YES, 6, ^{
                sheetSnapshot();
                printf(failures == 0 ? "::notice::PASS\n" : "::error::FAILED: %d\n", failures);
                exit(failures == 0 ? 0 : 1);
            });
        });
        [NSApp run];
    }
    return 0;
}
