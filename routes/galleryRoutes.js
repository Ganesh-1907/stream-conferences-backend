import { Router } from 'express';
import { listGalleryItems, createGalleryItem, deleteGalleryItem } from '../controllers/galleryController.js';

const router = Router();

router.get('/', listGalleryItems);
router.post('/', createGalleryItem);
router.delete('/:id', deleteGalleryItem);

export default router;
