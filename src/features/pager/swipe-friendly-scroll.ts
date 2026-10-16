import { Platform, type ViewStyle } from 'react-native';

/**
 * Style for vertical ScrollViews inside the pager.
 *
 * On the web, a scroll container restarts the browser's touch-action chain,
 * so a ScrollView would otherwise claim horizontal touch drags itself (and
 * cancel the pager's swipe). `pan-y` keeps vertical scrolling native and
 * leaves horizontal drags to the pager. No effect on iOS or Android.
 */
export const swipeFriendlyScroll: ViewStyle | undefined =
  Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as unknown as ViewStyle) : undefined;
