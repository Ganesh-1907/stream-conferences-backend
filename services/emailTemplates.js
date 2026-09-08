/**
 * Shared email template wrapper with conference-specific branding.
 * All emails use the event's logoUrl for branding, not a generic logo.
 */

const ACCENT = '#0e7490';
const BG = '#f8fafc';
const TEXT = '#334155';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Build the full HTML email body.
 * @param {object} opts
 * @param {string} opts.heading - Email heading
 * @param {string} opts.body - Inner HTML content
 * @param {object} [opts.event] - Full event document (Conference/Webinar)
 * @param {string} [opts.preheader] - Short preview text
 * @param {string} [opts.footerText] - Custom footer text
 */
export function emailTemplate({ heading, body, event, preheader, footerText }) {
  const logoUrl = event?.logoUrl || '';
  const eventTitle = event?.title || '';
  const startDate = formatDate(event?.startDate || event?.eventDate);
  const endDate = formatDate(event?.endDate);
  const location = event?.location || event?.venueDetails?.name || '';
  const dateRange = startDate ? (endDate && endDate !== startDate ? `${startDate} – ${endDate}` : startDate) : '';
  const contactEmail = event?.organizerContact?.email || '';
  const contactPhone = event?.organizerContact?.phone || '';
  const website = event?.organizerContact?.website || '';

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${eventTitle}" style="max-height:60px; max-width:200px; object-fit:contain; margin-bottom:16px;" />`
    : `<h1 style="margin:0; font-size:20px; color:${ACCENT}; font-family:Arial,sans-serif;">${eventTitle || 'Stream Conferences'}</h1>`;

  const eventMetaHtml = (dateRange || location)
    ? `<div style="background:${BG}; border:1px solid ${BORDER}; border-radius:8px; padding:14px 18px; margin:18px 0; font-family:Arial,sans-serif; font-size:13px; color:${TEXT};">
        ${dateRange ? `<div style="margin-bottom:4px;"><strong style="color:${ACCENT};">Date:</strong> ${dateRange}</div>` : ''}
        ${location ? `<div><strong style="color:${ACCENT};">Location:</strong> ${location}</div>` : ''}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family:Arial,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="padding:28px 32px 20px; border-bottom:1px solid ${BORDER}; text-align:center;">
          ${logoHtml}
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          <h2 style="margin:0 0 14px; font-size:20px; color:${ACCENT}; font-family:Arial,sans-serif;">${heading}</h2>
          <div style="font-size:15px; line-height:1.65; color:${TEXT}; font-family:Arial,sans-serif;">
            ${body}
          </div>
          ${eventMetaHtml}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:18px 32px; background:${BG}; border-top:1px solid ${BORDER}; font-size:12px; color:${MUTED}; font-family:Arial,sans-serif; text-align:center; line-height:1.6;">
          ${footerText || ''}
          ${contactEmail ? `<div>Email: ${contactEmail}${contactPhone ? ` | Phone: ${contactPhone}` : ''}</div>` : ''}
          ${website ? `<div><a href="${website}" style="color:${ACCENT}; text-decoration:none;">${website}</a></div>` : ''}
          <div style="margin-top:8px; font-size:11px; color:#94a3b8;">© ${new Date().getFullYear()} Stream Conferences. All rights reserved.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
