import { Router } from 'express';
import { Conference } from '../models/Conference.js';

const router = Router();

router.get('/all', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [confSponsors] = await Promise.all([
      Conference.aggregate([
        { $unwind: { path: '$sponsors', preserveNullAndEmptyArrays: false } },
        { $match: { 'sponsors.name': { $ne: '' } } },
        {
          $project: {
            _id: 0,
            sponsorId: { $toString: '$_id' },
            name: '$sponsors.name',
            title: '$sponsors.title',
            logo: '$sponsors.logo',
            order: '$sponsors.order',
            eventTitle: '$title',
            eventType: { $literal: 'conference' },
            createdAt: '$createdAt',
          },
        },
      ]),
    ]);

    const all = [...confSponsors].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = all.length;
    const sponsors = all.slice(skip, skip + limit);

    res.json({
      sponsors,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Sponsors aggregation error:', error);
    res.status(500).json({ error: 'Failed to load sponsors' });
  }
});

export default router;
