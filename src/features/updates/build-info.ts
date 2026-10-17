import Constants from 'expo-constants';

/**
 * Which FORM / TIME this is. The version comes from the app config
 * (app.json, kept in step with package.json by scripts/version.mjs); release
 * builds may pass it explicitly, along with the commit they were built from:
 *
 *   EXPO_PUBLIC_APP_VERSION=1.2.0 EXPO_PUBLIC_BUILD_ID=7978458 npx expo export …
 *
 * A build without a build ID is a local or development build.
 */
export const APP_VERSION =
  process.env.EXPO_PUBLIC_APP_VERSION || Constants.expoConfig?.version || '0.0.0';

export const BUILD_ID = process.env.EXPO_PUBLIC_BUILD_ID || '';

/** e.g. "1.2.0 (7978458)", or "1.2.0 (development)". */
export const VERSION_LABEL = `${APP_VERSION} (${BUILD_ID || 'development'})`;
