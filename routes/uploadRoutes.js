import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireUser } from '../middleware/auth.js';
import { r2Enabled, uploadToR2, r2Status } from '../services/r2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Keep file in memory so we can stream it to R2 (or fall back to disk).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB
});

const router = Router();

function fileExtension(mimetype, originalname) {
  if (originalname && originalname.includes('.')) {
    const ext = originalname.split('.').pop();
    if (ext && ext.length <= 5 && /^[a-zA-Z0-9]+$/.test(ext)) return `.${ext.toLowerCase()}`;
  }
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf'
  };
  return map[mimetype] || '';
}

// Upload a single file. When R2 is configured the file is stored in Cloudflare R2
// and served via GET /api/files/:key. Otherwise it falls back to local disk.
router.post(['/', '/upload'], requireUser, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ext = fileExtension(req.file.mimetype, req.file.originalname);
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    if (r2Enabled) {
      await uploadToR2(key, req.file.buffer, req.file.mimetype);
      return res.status(201).json({ url: `/api/files/${key}`, storage: 'r2', key });
    }

    // Local fallback
    fs.writeFileSync(path.join(uploadDir, key), req.file.buffer);
    return res.status(201).json({ url: `/uploads/${key}`, storage: 'local', key });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Storage status (helpful for verifying R2 integration)
router.get('/status', (req, res) => {
  res.json(r2Status());
});

export default router;
