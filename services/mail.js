import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || EMAIL_USER;

const transporter = SMTP_HOST && EMAIL_USER && EMAIL_PASSWORD
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD
      }
    })
  : null;

export const mailEnabled = Boolean(transporter);

/**
 * Send an email. Returns { sent, info, error } so callers can safely ignore
 * delivery failures without crashing the request flow.
 */
export async function sendMail({ to, subject, html, text, attachments }) {
  if (!transporter) {
    console.warn('[Mail] SMTP not configured. Skipping email:', subject);
    return { sent: false, error: 'SMTP not configured' };
  }
  try {
    const info = await transporter.sendMail({
      from: `"Stream Conferences" <${EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
      attachments
    });
    console.log(`[Mail] Sent "${subject}" to ${to}: ${info.messageId}`);
    return { sent: true, info };
  } catch (error) {
    console.error(`[Mail] Failed to send "${subject}" to ${to}:`, error);
    return { sent: false, error };
  }
}

export { ADMIN_EMAIL };
