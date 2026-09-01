export function getUserContext(req) {
  const role = req.headers['x-user-role'] || req.query.role;
  const username = req.headers['x-user-name'] || req.query.username;
  return { role, username };
}

export function requireUser(req, res, next) {
  const { username } = getUserContext(req);
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized: username context missing in headers' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  const { role } = getUserContext(req);
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Only administrators can perform this action' });
  }
  next();
}
