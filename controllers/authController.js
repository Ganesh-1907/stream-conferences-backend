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
  const { username, email } = req.body;
  const identifier = username || email;
  try {
    if (!identifier) {
      return res.status(400).json({ error: 'Username or email address is required' });
    }

    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier }
      ]
    });

    if (!user) {
      return res.json({
        success: true,
        message: 'If the account exists, a password reset email has been dispatched.'
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        error: 'This account has been deactivated. Please contact the administrator.'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetToken = token;
    user.resetTokenExpiry = expiry;
    user.resetOtp = otp;
    user.resetOtpExpiry = expiry;
    await user.save();

    const resetUrl = `${ADMIN_BASE}/reset-password?token=${token}`;
    const recipient = user.email || user.username || process.env.ADMIN_EMAIL;

    const mailRes = await sendMail({
      to: recipient,
      subject: 'Stream Conferences Password Reset - OTP & Verification Link',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; line-height: 1.6; color: #333333;">
          <h2 style="color: #0e7490;">Reset Your Password</h2>
          <p>Hi ${user.username},</p>
          <p>We received a request to reset your password for the Stream Conferences Portal.</p>
          
          <div style="background: #f0fdfa; border: 1px solid #99f6e4; padding: 18px; border-radius: 10px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #0f766e; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Your 6-Digit OTP Code</p>
            <p style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #0f766e; margin: 0; font-family: monospace;">${otp}</p>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #6b7280;">Valid for 1 hour</p>
          </div>

          <p style="margin-top: 20px;">Alternatively, you can click the button below to directly reset your password in your web browser:</p>
          <p style="margin: 24px 0; text-align: center;">
            <a href="${resetUrl}" style="background: #0e7490; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password Directly</a>
          </p>
          <p style="color: #666; font-size: 13px;">If you did not request this password reset, please ignore this email.</p>
        </div>
      `,
      text: `Hi ${user.username},\n\nYour 6-Digit OTP for password reset is: ${otp}\n\nAlternatively, reset your password here: ${resetUrl}\n\nThis OTP and link expire in 1 hour.`
    });

    console.log(`[Auth] Password reset initiated for ${user.username} (OTP: ${otp}) - Email sent: ${mailRes.sent}`);

    res.json({
      success: true,
      message: `Password reset OTP and link have been dispatched to ${recipient}.`,
      email: recipient
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function verifyOtp(req, res) {
  const { username, email, otp } = req.body;
  const identifier = username || email;
  try {
    if (!identifier || !otp) {
      return res.status(400).json({ error: 'Username/email and OTP code are required' });
    }

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
      resetOtp: otp.toString().trim()
    });

    if (!user || !user.resetOtpExpiry || user.resetOtpExpiry.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired OTP code. Please check and try again.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact the administrator.' });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully.',
      token: user.resetToken
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resetPassword(req, res) {
  const { token, otp, email, username, password } = req.body;
  try {
    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    let user = null;

    if (otp) {
      const identifier = username || email;
      if (!identifier) {
        return res.status(400).json({ error: 'Username or email is required with OTP' });
      }
      user = await User.findOne({
        $or: [{ username: identifier }, { email: identifier }],
        resetOtp: otp.toString().trim()
      });
      if (!user || !user.resetOtpExpiry || user.resetOtpExpiry.getTime() < Date.now()) {
        return res.status(400).json({ error: 'Invalid or expired OTP code' });
      }
    } else if (token) {
      user = await User.findOne({ resetToken: token });
      if (!user || !user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) {
        return res.status(400).json({ error: 'Reset link is invalid or has expired' });
      }
    } else {
      return res.status(400).json({ error: 'Reset token or OTP is required' });
    }

    // Update password
    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    user.isTempPassword = false;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully. You can now log in.'
    });
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
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
      role: 'mentor'
    });
    if (!user) {
      return res.status(404).json({ error: 'Mentor user account not found' });
    }
    const currentStatus = user.isActive !== false;
    user.isActive = !currentStatus;
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
