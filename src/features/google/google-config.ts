/**
 * Google Calendar settings. The OAuth client ID is public (it identifies the
 * app, not a user); set it with EXPO_PUBLIC_GOOGLE_CLIENT_ID in .env. Without
 * one, Google Calendar stays switched off and Settings shows nothing new.
 *
 * The API and sign-in script addresses can be pointed elsewhere for testing.
 */
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export const GOOGLE_CALENDAR_API = (
  process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_API ?? 'https://www.googleapis.com/calendar/v3'
).replace(/\/+$/, '');

export const GOOGLE_GIS_SRC =
  process.env.EXPO_PUBLIC_GOOGLE_GIS_SRC ?? 'https://accounts.google.com/gsi/client';

/** Events on the user's calendars: read, create, change and delete. Nothing else. */
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

/** The calendar FORM / TIME syncs with. */
export const GOOGLE_CALENDAR_ID = 'primary';
