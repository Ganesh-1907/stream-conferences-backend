import PDFDocument from 'pdfkit';

const ACCENT = '#0e7490';
const TEXT = '#1e293b';
const MUTED = '#64748b';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Generate a registration confirmation PDF.
 * Returns a Buffer.
 * @param {object} opts
 * @param {object} opts.registration - Registration document
 * @param {object} opts.order - Order document (optional)
 * @param {object} opts.event - Full event document (Conference/Webinar)
 */
export function generateRegistrationPDF({ registration, order, event }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const eventTitle = event?.title || 'Event';
    const startDate = formatDate(event?.startDate || event?.eventDate);
    const endDate = event?.endDate ? formatDate(event?.endDate) : null;
    const location = event?.location || event?.venueDetails?.name || '—';
    const venueAddress = [
      event?.venueDetails?.address,
      event?.venueDetails?.city,
      event?.venueDetails?.state,
      event?.venueDetails?.country,
      event?.venueDetails?.pincode,
    ].filter(Boolean).join(', ') || '';

    const regDate = registration?.createdAt ? formatDate(registration.createdAt) : formatDate(new Date());
    const curSym = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
    const orderCurrency = order?.currency || 'USD';
    const amount = order ? `${curSym[orderCurrency] || '$'}${(order.amount / 100).toFixed(2)} ${orderCurrency}` : '—';
    const paymentId = order?.paymentId || '—';
    const orderId = order?.orderId || '—';

    // Header line
    doc.rect(0, 0, doc.page.width, 80).fill(ACCENT);
    doc.fill('#ffffff').fontSize(22).font('Helvetica-Bold').text('Registration Confirmation', 50, 28, { align: 'center' });
    doc.fontSize(11).font('Helvetica').text(eventTitle, 50, 56, { align: 'center' });

    let y = 105;

    // Event details section
    doc.fill(TEXT).fontSize(13).font('Helvetica-Bold').text('Event Details', 50, y);
    y += 22;
    doc.fontSize(10).font('Helvetica');
    const eventDetails = [
      ['Event', eventTitle],
      ['Date', endDate ? `${startDate} – ${endDate}` : startDate],
      ['Location', location],
      venueAddress ? ['Venue', venueAddress] : null,
    ].filter(Boolean);
    for (const [label, value] of eventDetails) {
      doc.fill(MUTED).font('Helvetica-Bold').text(`${label}:`, 50, y, { width: 90 });
      doc.fill(TEXT).font('Helvetica').text(value, 145, y, { width: 350 });
      y += 18;
    }

    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    y += 15;

    // Registration details section
    doc.fill(TEXT).fontSize(13).font('Helvetica-Bold').text('Registration Details', 50, y);
    y += 22;
    doc.fontSize(10).font('Helvetica');
    const regDetails = [
      ['Name', registration?.name || '—'],
      ['Email', registration?.email || '—'],
      ['Phone', registration?.phone || '—'],
      ['Institution', registration?.institution || '—'],
      ['Country', registration?.country || '—'],
      ['Category', registration?.category || '—'],
      ['Abstract', registration?.presentingAbstract || 'No'],
      ['Registered On', regDate],
    ];
    for (const [label, value] of regDetails) {
      doc.fill(MUTED).font('Helvetica-Bold').text(`${label}:`, 50, y, { width: 110 });
      doc.fill(TEXT).font('Helvetica').text(value, 165, y, { width: 330 });
      y += 18;
    }

    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    y += 15;

    // Payment details section
    doc.fill(TEXT).fontSize(13).font('Helvetica-Bold').text('Payment Details', 50, y);
    y += 22;
    doc.fontSize(10).font('Helvetica');
    const payDetails = [
      ['Amount Paid', amount],
      ['Payment ID', paymentId],
      ['Order ID', orderId],
      ['Payment Status', order?.status === 'paid' ? 'Confirmed' : registration?.paymentStatus || 'Pending'],
    ];
    for (const [label, value] of payDetails) {
      doc.fill(MUTED).font('Helvetica-Bold').text(`${label}:`, 50, y, { width: 110 });
      doc.fill(TEXT).font('Helvetica').text(value, 165, y, { width: 330 });
      y += 18;
    }

    // Footer
    const footerY = doc.page.height - 60;
    doc.moveTo(50, footerY - 10).lineTo(545, footerY - 10).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(9).fill(MUTED).font('Helvetica')
      .text('This is a computer-generated registration confirmation. No signature is required.', 50, footerY, { align: 'center', width: 495 })
      .text(`Generated on ${formatDate(new Date())}`, 50, footerY + 14, { align: 'center', width: 495 });

    doc.end();
  });
}
