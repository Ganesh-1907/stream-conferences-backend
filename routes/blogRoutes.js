import { Router } from 'express';
import {
  listBlogs,
  createBlog,
  updateBlog,
  deleteBlog
} from '../controllers/blogController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', listBlogs);
router.post('/', requireUser, createBlog);
router.put('/:id', requireUser, updateBlog);
router.delete('/:id', requireUser, deleteBlog);

export default router;
