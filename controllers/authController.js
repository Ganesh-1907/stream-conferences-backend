import crypto from 'crypto';
import { User } from '../models/User.js';
import { sendMail } from '../services/mail.js';
import { MentorProfile } from '../models/MentorProfile.js';
import { getUserContext } from '../middleware/auth.js';

const ADMIN_BASE = process.env.ADMIN_BASE || 'http://localhost:5175';

export async function login(req, res) {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: username }
      ]
    });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administrator.' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isTempPassword: user.isTempPassword || false
      }
    });
  } catch (error) {
    console.error('Login endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function forgotPassword(req, res) {
  const { username } = req.body;
  try {
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      // Do not reveal whether the account exists.
      return res.json({ success: true, message: 'If the account exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${ADMIN_BASE}/reset-password?token=${token}`;
    const recipient = user.email || process.env.ADMIN_EMAIL;
    await sendMail({
      to: recipient,
      subject: 'Reset your Stream Conferences password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #0e7490;">Reset your password</h2>
          <p>Hi ${user.username},</p>
          <p>We received a request to reset your admin console password. Click the button below to choose a new password.</p>
          <p style="margin: 28px 0;">
            <a href="${resetUrl}" style="background: #0e7490; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: bold;">Reset password</a>
          </p>
          <p style="color: #666; font-size: 13px;">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `Hi ${user.username},\n\nReset your password here: ${resetUrl}\n\nThis link expires in 1 hour.`
    });

    res.json({ success: true, message: 'If the account exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resetPassword(req, res) {
  const { token, password } = req.body;
  try {
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ resetToken: token });
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired' });
    }

    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function registerMentor(req, res) {
  const { email, firstName, lastName } = req.body;
  try {
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'First name, last name and email are required' });
    }
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { username: email },
        { email: email }
      ]
    });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    // Generate random password
    const generatedPassword = Math.random().toString(36).slice(-8);

    // Create User
    const newUser = new User({
      username: email,
      email: email,
      password: generatedPassword,
      role: 'mentor',
      isTempPassword: true
    });
    await newUser.save();

    // Create Mentor Profile
    const newProfile = new MentorProfile({
      username: email,
      fullName: `${firstName} ${lastName}`,
      email: email
    });
    await newProfile.save();

    // Send email with credentials
    const adminLink = process.env.ADMIN_BASE || 'http://localhost:5175';
    await sendMail({
      to: email,
      subject: 'Your Stream Conferences Mentor Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; line-height: 1.6;">
          <h2 style="color: #0e7490;">Welcome to Stream Conferences</h2>
          <p>Hi ${firstName} ${lastName},</p>
          <p>You have been registered as a Mentor on Stream Conferences. Here are your temporary login credentials:</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0; font-family: monospace; color: #1f2937;">
            <p style="margin: 4px 0;"><strong>Username / Email:</strong> ${email}</p>
            <p style="margin: 4px 0;"><strong>Temporary Password:</strong> ${generatedPassword}</p>
          </div>
          <p>Please log in to the admin console using the link below, update your password, and set up your profile.</p>
          <p style="margin: 28px 0;">
            <a href="${adminLink}" style="background: #0e7490; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Admin Panel</a>
          </p>
          <p style="color: #666; font-size: 13px;">If you did not request this, please contact support.</p>
        </div>
      `,
      text: `Hi ${firstName} ${lastName},\n\nYou have been registered as a Mentor. Your username is ${email} and password is ${generatedPassword}.\n\nAccess the Admin Panel here: ${adminLink}`
    });

    res.json({ success: true, message: 'Registration successful! Credentials have been sent to your email.' });
  } catch (error) {
    console.error('Register mentor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function changePassword(req, res) {
  const { username } = getUserContext(req);
  const { newPassword } = req.body;
  try {
    if (!username) {
      return res.status(401).json({ error: 'Unauthorized: username context missing in headers' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.password = newPassword;
    user.isTempPassword = false;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function toggleMentorStatus(req, res) {
  const { username } = req.params;
  try {
    const user = await User.findOne({ username, role: 'mentor' });
    if (!user) {
      return res.status(404).json({ error: 'Mentor not found' });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.json({ 
      success: true, 
      message: `Mentor ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Toggle mentor status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
