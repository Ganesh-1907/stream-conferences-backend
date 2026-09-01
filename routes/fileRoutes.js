import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { r2Enabled, getFromR2 } from '../services/r2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');

const router = Router();

// Serve uploaded files. When R2 is configured the object is streamed from
// Cloudflare R2; otherwise it falls back to the local uploads directory.
router.get('/:key', async (req, res) => {
  const key = req.params.key;
  // Prevent path traversal
  if (key.includes('..') || key.includes('/') || key.includes('\\')) {
    return res.status(400).json({ error: 'Invalid key' });
  }
  try {
    if (r2Enabled) {
      const obj = await getFromR2(key);
      const body = await obj.Body.transformToByteArray();
      res.setHeader('Content-Type', obj.ContentType || 'application/octet-stream');
      res.setHeader('Content-Length', obj.ContentLength ?? body.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(Buffer.from(body));
    }
    // Local fallback
    const filePath = path.join(uploadDir, key);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    return res.sendFile(filePath);
  } catch (error) {
    if (error && error.name === 'NoSuchKey') {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error('File serve error:', error);
    return res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;
