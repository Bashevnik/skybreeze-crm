// For local work the frontend uses the same origin. Set this to the HTTPS API
// endpoint before publishing public/ to GitHub Pages, for example:
// The local preview talks to its local server. GitHub Pages points to the
// protected HTTPS API; the access token is entered per browser session.
const isLocalPreview = ["127.0.0.1", "localhost"].includes(
  window.location.hostname,
);
window.CRM_API_BASE =
  window.CRM_API_BASE ||
  (isLocalPreview ? "" : "https://crm.8.235.24.47.sslip.io");
