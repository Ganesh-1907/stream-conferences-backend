export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'event';
}

export function generateSlug(title, type = 'event') {
  const base = slugify(title) || type;
  return `${base}-${Date.now().toString(36)}`;
}

// Lowercase, alphanumeric + hyphens only. Subdomains must start/end with alphanumeric.
export function sanitizeSubdomain(text) {
  const cleaned = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  return cleaned || 'event';
}

export function generateSubdomain(title) {
  return sanitizeSubdomain(title || 'event');
}
