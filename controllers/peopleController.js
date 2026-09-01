import { User } from '../models/User.js';
import { MentorProfile } from '../models/MentorProfile.js';

// Public endpoint for the user website: returns every user (admin + mentor)
// joined with their mentor profile so the frontend can split speakers from
// the organizing committee by role.
export async function listPeople(req, res) {
  try {
    const users = await User.find().sort({ role: 1, username: 1 });
    const profiles = await MentorProfile.find();
    const profileByUsername = new Map(profiles.map((p) => [p.username, p]));

    const people = users.map((u) => {
      const p = profileByUsername.get(u.username);
      return {
        username: u.username,
        role: u.role,
        fullName: p?.fullName || '',
        title: p?.title || '',
        bio: p?.bio || '',
        avatar: p?.avatar || '',
        email: p?.email || '',
        phone: p?.phone || '',
        location: p?.location || '',
        linkedin: p?.linkedin || '',
        website: p?.website || '',
        expertise: Array.isArray(p?.expertise) ? p.expertise : [],
        education: Array.isArray(p?.education) ? p.education : [],
        experiences: Array.isArray(p?.experiences) ? p.experiences : [],
        certifications: Array.isArray(p?.certifications) ? p.certifications : []
      };
    });

    res.json(people);
  } catch (error) {
    console.error('Fetch people error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
