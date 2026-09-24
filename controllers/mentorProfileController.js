import { MentorProfile } from '../models/MentorProfile.js';
import { User } from '../models/User.js';
import { getUserContext } from '../middleware/auth.js';
import { sendMail } from '../services/mail.js';

// Public endpoint for the user website: returns only mentors with a profile.
export async function listMentors(req, res) {
  try {
    const [profiles, mentorUsers] = await Promise.all([
      MentorProfile.find().sort({ fullName: 1 }),
      User.find({ role: 'mentor' }).select('username email isActive password').lean()
    ]);
    
    const userMap = new Map(mentorUsers.map(u => [u.username, u]));
    const profileUsernames = new Set(profiles.map(p => p.username));

    const result = profiles.map(profile => {
      const u = userMap.get(profile.username) || {};
      return {
        ...profile.toJSON(),
        isActive: u.isActive !== false,
        password: u.password || '',
      };
    });

    // If there are mentor users without a profile yet, include fallback
    for (const u of mentorUsers) {
      if (!profileUsernames.has(u.username)) {
        result.push({
          _id: u._id.toString(),
          username: u.username,
          fullName: u.username,
          email: u.email || u.username,
          isActive: u.isActive !== false,
          password: u.password || '',
          title: '',
          bio: '',
          avatar: '',
        });
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Fetch mentors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMentorByUsername(req, res) {
  const { username } = req.params;
  try {
    const profile = await MentorProfile.findOne({
      $or: [{ username }, { email: username }]
    });
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
    let profile = await MentorProfile.findOne({
      $or: [{ username }, { email: username }]
    });
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
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });
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
      { $or: [{ username }, { email: username }] },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(profile);
  } catch (error) {
    console.error('Upsert profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function adminUpdateMentor(req, res) {
  const { username } = req.params;
  const {
    fullName,
    firstName,
    lastName,
    email,
    newUsername,
    password,
    title,
    bio,
    avatar,
    phone,
    location,
    linkedin,
    website,
    isActive
  } = req.body || {};

  try {
    const targetUsername = username;
    const user = await User.findOne({ 
      $or: [{ username: targetUsername }, { email: targetUsername }],
      role: 'mentor'
    });

    const finalFullName = fullName || (firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : '');
    const finalEmail = email || newUsername;

    if (user) {
      if (password) {
        user.password = password;
      }
      if (typeof isActive === 'boolean') {
        user.isActive = isActive;
      }
      if (finalEmail && finalEmail !== user.username) {
        const conflict = await User.findOne({
          _id: { $ne: user._id },
          $or: [{ username: finalEmail }, { email: finalEmail }]
        });
        if (conflict) {
          return res.status(400).json({ error: 'Another user already exists with this email/username' });
        }
        user.username = finalEmail;
        user.email = finalEmail;
      }
      await user.save();
    }

    let profile = await MentorProfile.findOne({
      $or: [{ username: targetUsername }, { email: targetUsername }]
    });

    if (!profile) {
      profile = new MentorProfile({
        username: finalEmail || (user ? user.username : targetUsername),
        email: finalEmail || (user ? user.email : targetUsername),
        fullName: finalFullName || targetUsername
      });
    }

    if (finalFullName) profile.fullName = finalFullName;
    if (finalEmail) {
      profile.username = finalEmail;
      profile.email = finalEmail;
    }
    if (title !== undefined) profile.title = title;
    if (bio !== undefined) profile.bio = bio;
    if (avatar !== undefined) profile.avatar = avatar;
    if (phone !== undefined) profile.phone = phone;
    if (location !== undefined) profile.location = location;
    if (linkedin !== undefined) profile.linkedin = linkedin;
    if (website !== undefined) profile.website = website;
    profile.updatedAt = new Date();

    await profile.save();

    // Send email notification to mentor with updated credentials and link
    const emailRecipient = finalEmail || (user ? user.email : targetUsername);
    const mentorPassword = user ? user.password : (password || '—');
    const mentorName = finalFullName || (profile ? profile.fullName : 'Mentor');
    const adminLink = process.env.ADMIN_BASE || 'http://localhost:5175';

    if (emailRecipient) {
      try {
        await sendMail({
          to: emailRecipient,
          subject: 'Your Updated Stream Conferences Mentor Credentials',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; line-height: 1.6; color: #333333;">
              <h2 style="color: #0e7490;">Your Mentor Account Details Have Been Updated</h2>
              <p>Hi ${mentorName},</p>
              <p>Your Stream Conferences mentor account details and login credentials have been updated by the administrator. Here are your latest login credentials:</p>
              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0; font-family: monospace; color: #1f2937; border: 1px solid #e5e7eb;">
                <p style="margin: 4px 0;"><strong>Username / Email:</strong> ${emailRecipient}</p>
                <p style="margin: 4px 0;"><strong>Password:</strong> ${mentorPassword}</p>
              </div>
              <p>Please log in to the admin console using the link below to access your mentor dashboard:</p>
              <p style="margin: 28px 0;">
                <a href="${adminLink}" style="background: #0e7490; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Admin Panel</a>
              </p>
              <p style="color: #666666; font-size: 13px;">If you did not request this update, please contact the administrator support team immediately.</p>
            </div>
          `,
          text: `Hi ${mentorName},\n\nYour Stream Conferences mentor account details have been updated. Your username is ${emailRecipient} and password is ${mentorPassword}.\n\nAccess the Admin Panel here: ${adminLink}`
        });
      } catch (mailError) {
        console.error('Failed to send updated credentials email to mentor:', mailError);
      }
    }

    res.json({
      success: true,
      message: 'Mentor updated successfully! Updated credentials email sent.',
      mentor: {
        ...profile.toJSON(),
        isActive: user ? user.isActive !== false : true,
        password: user ? user.password : ''
      }
    });
  } catch (error) {
    console.error('Admin update mentor error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function adminDeleteMentor(req, res) {
  const { username } = req.params;
  try {
    await Promise.all([
      User.deleteMany({
        $or: [{ username }, { email: username }],
        role: 'mentor'
      }),
      MentorProfile.deleteMany({
        $or: [{ username }, { email: username }]
      })
    ]);

    res.json({ success: true, message: 'Mentor deleted successfully' });
  } catch (error) {
    console.error('Admin delete mentor error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
