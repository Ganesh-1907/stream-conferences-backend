import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String },
  role: { type: String, required: true, enum: ['admin', 'mentor'] },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  resetOtp: { type: String },
  resetOtpExpiry: { type: Date },
  isTempPassword: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
