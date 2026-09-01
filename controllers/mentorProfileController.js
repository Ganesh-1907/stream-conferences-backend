import { MentorProfile } from '../models/MentorProfile.js';
import { User } from '../models/User.js';
import { getUserContext } from '../middleware/auth.js';

// Public endpoint for the user website: returns only mentors with a profile.
export async function listMentors(req, res) {
  try {
    const profiles = await MentorProfile.find().sort({ fullName: 1 });
    res.json(profiles);
  } catch (error) {
    console.error('Fetch mentors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMentorByUsername(req, res) {
  const { username } = req.params;
  try {
    const profile = await MentorProfile.findOne({ username });
    if (!profile) {
      return res.status(404).json({ error: 'Mentor profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Get mentor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Returns the profile for the currently logged-in user (or 404 if none).
export async function getMyProfile(req, res) {
  const { username } = getUserContext(req);
  try {
    let profile = await MentorProfile.findOne({ username });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function upsertMyProfile(req, res) {
  const { username } = getUserContext(req);
  const body = req.body || {};
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = {
      fullName: body.fullName ?? '',
      title: body.title ?? '',
      bio: body.bio ?? '',
      avatar: body.avatar ?? '',
      email: body.email ?? '',
      phone: body.phone ?? '',
      location: body.location ?? '',
      linkedin: body.linkedin ?? '',
      website: body.website ?? '',
      expertise: Array.isArray(body.expertise) ? body.expertise : [],
      education: Array.isArray(body.education) ? body.education : [],
      experiences: Array.isArray(body.experiences) ? body.experiences : [],
      certifications: Array.isArray(body.certifications) ? body.certifications : [],
      updatedAt: new Date()
    };

    let profile = await MentorProfile.findOneAndUpdate(
      { username },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(profile);
  } catch (error) {
    console.error('Upsert profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
