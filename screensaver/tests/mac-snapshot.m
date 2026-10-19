// CI check for the macOS screen saver: loads "FORM TIME.saver" the way the
// screen-saver engine does (NSBundle, principal class), shows it in a window
// with several looks, and saves each as a PNG, plus the Options sheet. Each
// result is also printed as a GitHub annotation, with a small JPEG of it in
// base64 so the run can be checked without downloading anything.
//
//   clang -fobjc-arc -framework AppKit -framework ScreenSaver \
//     mac-snapshot.m -o mac-snapshot
//   ./mac-snapshot "screensaver/build/FORM TIME.saver" out-dir
#import <AppKit/AppKit.h>
#import <ScreenSaver/ScreenSaver.h>

static NSString *outDir;
static Class saverClass;
static int failures = 0;
static NSMutableArray *keep;

static void setOptions(NSDictionary *options) {
    ScreenSaverDefaults *d = [ScreenSaverDefaults defaultsForModuleWithName:@"com.formtime.screensaver"];
    for (NSString *key in @[@"face", @"appearance", @"dial", @"lume", @"movement", @"size", @"seconds", @"depth", @"date", @"timeZone"]) {
        [d removeObjectForKey:key];
    }
    [options enumerateKeysAndObjectsUsingBlock:^(id key, id value, BOOL *stop) { [d setObject:value forKey:key]; }];
    [d synchronize];
}

static NSBitmapImageRep *render(NSView *view) {
    NSBitmapImageRep *rep = [view bitmapImageRepForCachingDisplayInRect:view.bounds];
    [view cacheDisplayInRect:view.bounds toBitmapImageRep:rep];
    return rep;
}

/// Share of sampled pixels that differ from the top-left corner: the clock drew.
static double drawnShare(NSBitmapImageRep *rep) {
    NSColor *corner = [[rep colorAtX:2 y:2] colorUsingColorSpace:NSColorSpace.sRGBColorSpace];
    long drawn = 0, total = 0;
    for (NSInteger y = 0; y < rep.pixelsHigh; y += 3) {
        for (NSInteger x = 0; x < rep.pixelsWide; x += 3) {
            NSColor *c = [[rep colorAtX:x y:y] colorUsingColorSpace:NSColorSpace.sRGBColorSpace];
            double d = fabs(c.redComponent - corner.redComponent) + fabs(c.greenComponent - corner.greenComponent) +
                       fabs(c.blueComponent - corner.blueComponent);
            if (d > 0.08) drawn++;
            total++;
        }
    }
    return total ? 100.0 * drawn / total : 0;
}

static void report(NSBitmapImageRep *rep, NSString *name, CGFloat thumbWidth) {
    NSData *png = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
    [png writeToFile:[outDir stringByAppendingPathComponent:[name stringByAppendingString:@".png"]] atomically:YES];
    double share = drawnShare(rep);
    printf("::notice title=%s::%ldx%ld, drawn %.1f%%\n", name.UTF8String, (long)rep.pixelsWide, (long)rep.pixelsHigh, share);
    if (share < 1.0) { printf("::error::FAIL %s: nothing drawn\n", name.UTF8String); failures++; }

    // A small JPEG, inline, for checking the look from the run's annotations.
    CGFloat w = MIN(thumbWidth, rep.pixelsWide), h = round(w * rep.pixelsHigh / rep.pixelsWide);
    NSBitmapImageRep *small = [[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL pixelsWide:(NSInteger)w pixelsHigh:(NSInteger)h
                                                                  bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO
                                                                 colorSpaceName:NSCalibratedRGBColorSpace bytesPerRow:0 bitsPerPixel:0];
    [NSGraphicsContext saveGraphicsState];
    NSGraphicsContext.currentContext = [NSGraphicsContext graphicsContextWithBitmapImageRep:small];
    NSGraphicsContext.currentContext.imageInterpolation = NSImageInterpolationHigh;
    [rep drawInRect:NSMakeRect(0, 0, w, h)];
    [NSGraphicsContext restoreGraphicsState];
    NSData *jpeg = [small representationUsingType:NSBitmapImageFileTypeJPEG properties:@{NSImageCompressionFactor: @0.72}];
    printf("::notice title=thumb-%s::%s\n", name.UTF8String, [jpeg base64EncodedStringWithOptions:0].UTF8String);
}

static void check(NSString *name, NSDictionary *options, NSSize size, BOOL preview, void (^next)(void)) {
    setOptions(options);
    NSRect rect = NSMakeRect(0, 0, size.width, size.height);
    NSWindow *window = [[NSWindow alloc] initWithContentRect:rect styleMask:NSWindowStyleMaskBorderless
                                                     backing:NSBackingStoreBuffered defer:NO];
    ScreenSaverView *view = [[saverClass alloc] initWithFrame:rect isPreview:preview];
    if (!view) { printf("::error::FAIL: init\n"); exit(1); }
    [keep addObject:window];
    [keep addObject:view];
    window.contentView = view;
    [window orderFront:nil];
    [view startAnimation];
    // After the fade-in, and long enough for a few redraws.
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        report(render(view), name, preview ? 240 : 400);
        [view stopAnimation];
        [window orderOut:nil];
        next();
    });
}

static void sheetSnapshot(void) {
    setOptions(@{});
    ScreenSaverView *view = [[saverClass alloc] initWithFrame:NSMakeRect(0, 0, 400, 300) isPreview:YES];
    NSWindow *sheet = view.configureSheet;
    NSView *content = sheet.contentView;
    if (!content) { printf("::error::FAIL: no options sheet\n"); failures++; return; }
    [keep addObject:view];
    [sheet makeKeyAndOrderFront:nil];
    [content layoutSubtreeIfNeeded];
    NSBitmapImageRep *rep = render(content);
    report(rep, @"options-sheet", 360);
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

        NSDictionary *day = @{@"face": @"analog", @"appearance": @"day", @"dial": @"aqua", @"timeZone": @"Asia/Kolkata"};
        NSDictionary *night = @{@"face": @"analog", @"appearance": @"night", @"lume": @"aqua", @"timeZone": @"Asia/Kolkata"};
        NSDictionary *flat = @{@"face": @"analog", @"appearance": @"day", @"dial": @"ivory", @"depth": @NO, @"timeZone": @"Asia/Kolkata"};
        NSDictionary *digital = @{@"face": @"digital", @"appearance": @"night", @"lume": @"amber", @"timeZone": @"Asia/Kolkata"};
        NSDictionary *digitalDay = @{@"face": @"digital", @"appearance": @"day", @"dial": @"ocean", @"date": @NO, @"timeZone": @"Asia/Kolkata"};

        check(@"analog-day-aqua", day, NSMakeSize(1440, 900), NO, ^{
        check(@"analog-night-aqua", night, NSMakeSize(1440, 900), NO, ^{
        check(@"analog-flat-ivory", flat, NSMakeSize(1440, 900), NO, ^{
        check(@"digital-night-amber", digital, NSMakeSize(1440, 900), NO, ^{
        check(@"digital-day-ocean", digitalDay, NSMakeSize(1280, 800), NO, ^{
        check(@"preview", day, NSMakeSize(300, 186), YES, ^{
            sheetSnapshot();
            printf(failures == 0 ? "::notice::PASS\n" : "::error::FAILED: %d\n", failures);
            exit(failures == 0 ? 0 : 1);
        }); }); }); }); }); });
        [NSApp run];
    }
    return 0;
}
