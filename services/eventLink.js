// Build the public URL for an event, preferring its dedicated subdomain.
export function eventUrl(event) {
  const subdomain = event?.subdomain;
  const root = process.env.ROOT_DOMAIN;
  if (subdomain && root) {
    const protocol = root === 'localhost' ? 'http' : 'https';
    return `${protocol}://${subdomain}.${root}`;
  }
  const base = process.env.REGISTRATION_BASE || 'http://localhost:5174/register';
  const ref = event?.eventId || event?.eventSlug || event?.eventCustomId || event?.slug || '';
  return `${base}?event=${encodeURIComponent(ref)}`;
}

// Backwards-compatible registration link alias used across controllers.
export function registrationLink(event) {
  return eventUrl(event);
}
