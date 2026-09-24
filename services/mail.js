import nodemailer from 'nodemailer';

let transporterInstance = null;

function getTransporter() {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
  const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

  if (!SMTP_HOST || !EMAIL_USER || !EMAIL_PASSWORD) {
    return null;
  }

  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD
      }
    });
  }
  return transporterInstance;
}

export function mailEnabled() {
  return Boolean(getTransporter());
}

/**
 * Send an email. Returns { sent, info, error } so callers can safely ignore
 * delivery failures without crashing the request flow.
 */
export async function sendMail({ to, subject, html, text, attachments }) {
  const EMAIL_USER = process.env.EMAIL_USER;
  const transporter = getTransporter();

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

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
