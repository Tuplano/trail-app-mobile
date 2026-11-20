/**
 * The Web OAuth client ID from Google Cloud (project "Trailing"). The app asks
 * Google for an ID token made out to this ID, and the API accepts only tokens
 * for the IDs in its GOOGLE_CLIENT_IDS, so the two must match.
 *
 * It isn't a secret: it ships inside every app build. The Android clients
 * (package name + SHA-1 of each signing key) live in Google Cloud only;
 * Google recognises the app by them, so nothing else goes in the app.
 */
export const GOOGLE_WEB_CLIENT_ID =
  '968179867407-02k1fpngsug1v43mq5gl97ajp22en2be.apps.googleusercontent.com';
