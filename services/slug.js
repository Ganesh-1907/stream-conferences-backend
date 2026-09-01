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
