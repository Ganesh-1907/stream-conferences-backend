import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Conference } from './models/Conference.js';
import { Webinar } from './models/Webinar.js';
import { Blog } from './models/Blog.js';
import { Registration } from './models/Registration.js';
import { Order } from './models/Order.js';
import { generateSlug } from './services/slug.js';

const MONGO_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/stream-conf';
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

// Deterministic dates relative to today so upcoming/past status is always correct
const d = (offsetDays, hour = 9) => {
  const dt = new Date(NOW + offsetDays * DAY);
  dt.setHours(hour, 0, 0, 0);
  return dt;
};

const users = [
  { username: 'admin', password: 'admin123', email: 'anilkumardevarakonda03@gmail.com', role: 'admin' },
  { username: 'mentor', password: 'mentor123', email: 'laxmiganesh1907@gmail.com', role: 'mentor' },
  { username: 'scientist', password: 'scientist123', email: 'laxmiganesh1907@gmail.com', role: 'mentor' }
];

const conferences = [
  {
    title: 'International Conference on Medical, Life & Health Sciences',
    slug: 'icmlhs-2027',
    description: 'The flagship ICMLHS 2027 summit connecting medicine, life sciences, technology and academia across three days in Boston.',
    day: '12–14',
    month: 'MAR 27',
    location: 'Boston, Massachusetts · Hybrid',
    eventDate: d(200, 9),
    startTime: '09:00',
    endTime: '17:30',
    fees: [
      { label: 'Student', amount: 24500 },
      { label: 'Academic', amount: 39500 },
      { label: 'Industry Delegate', amount: 52000 },
      { label: 'Virtual Attendee', amount: 14500 }
    ],
    organizerContact: { name: 'Dr. Sarah Chen', email: 'icmlhs@streamconferences.com', phone: '+1 (617) 555-0100' },
    announcedBy: 'admin'
  },
  {
    title: 'Applied Intelligence & Emerging Technologies Forum',
    slug: 'applied-intelligence-2027',
    description: 'A cross-disciplinary forum where data, systems engineering and applied research meet industry.',
    day: '08–09',
    month: 'MAY 27',
    location: 'Singapore · In person',
    eventDate: d(260, 9),
    startTime: '09:30',
    endTime: '18:00',
    fees: [
      { label: 'Student', amount: 18000 },
      { label: 'Regular', amount: 32000 }
    ],
    organizerContact: { name: 'Prof. Daniel Okafor', email: 'aietf@streamconferences.com', phone: '+65 6123 4567' },
    announcedBy: 'mentor'
  },
  {
    title: 'Global Forum on Research Translation',
    slug: 'global-forum-2025',
    description: 'Past edition proceedings on translating discovery into clinical and market impact.',
    day: '18–20',
    month: 'NOV 25',
    location: 'Copenhagen · Hybrid',
    eventDate: d(-280, 9),
    startTime: '09:00',
    endTime: '17:00',
    fees: [
      { label: 'Academic', amount: 39500 }
    ],
    organizerContact: { name: 'Dr. Leila Morgan', email: 'gft@streamconferences.com', phone: '+45 33 55 01 02' },
    announcedBy: 'admin'
  },
  {
    title: 'Digital Health & Wearable Systems Summit',
    slug: 'digital-health-2026',
    description: 'Bringing clinical and consumer health technology into one rigorous conversation.',
    day: '21',
    month: 'SEP 26',
    location: 'London · In person',
    eventDate: d(30, 9),
    startTime: '10:00',
    endTime: '16:30',
    fees: [
      { label: 'Student', amount: 12000 },
      { label: 'Industry Delegate', amount: 28000 }
    ],
    organizerContact: { name: 'Maya Chen', email: 'dhwss@streamconferences.com', phone: '+44 20 7946 0958' },
    announcedBy: 'scientist'
  },
  {
    title: 'Next-Gen Bioinformatics & Genomics Congress',
    slug: 'bioinformatics-2027',
    description: 'Exploring computational biology, sequence alignment, and algorithmic advances in healthcare.',
    day: '15–17',
    month: 'JUN 27',
    location: 'San Francisco, California · In person',
    eventDate: d(290, 9),
    startTime: '09:00',
    endTime: '17:00',
    fees: [
      { label: 'Academic', amount: 35000 },
      { label: 'Industry Delegate', amount: 48000 }
    ],
    organizerContact: { name: 'Dr. Alex Wong', email: 'genomics@streamconferences.com', phone: '+1 (415) 555-0199' },
    announcedBy: 'admin'
  },
  {
    title: 'Oncology Frontiers & Immunology Symposium',
    slug: 'oncology-frontiers-2027',
    description: 'A global meeting focusing on cancer immunotherapy, clinical trials, and breakthrough treatments.',
    day: '04–05',
    month: 'JUL 27',
    location: 'Zurich, Switzerland · Hybrid',
    eventDate: d(310, 9),
    startTime: '08:30',
    endTime: '18:00',
    fees: [
      { label: 'Student', amount: 22000 },
      { label: 'Regular', amount: 42000 }
    ],
    organizerContact: { name: 'Prof. Hans Mueller', email: 'oncology@streamconferences.com', phone: '+41 44 234 5678' },
    announcedBy: 'mentor'
  },
  {
    title: 'Cognitive Neuroscience & Brain Imaging Workshop',
    slug: 'neuroscience-workshop-2027',
    description: 'Hands-on workshop on fMRI data analysis, brain mapping, and cognitive models.',
    day: '18',
    month: 'AUG 27',
    location: 'Berlin, Germany · Hybrid',
    eventDate: d(350, 9),
    startTime: '10:00',
    endTime: '16:00',
    fees: [
      { label: 'Standard', amount: 15000 }
    ],
    organizerContact: { name: 'Dr. Katrin Schmidt', email: 'brain@streamconferences.com', phone: '+49 30 1234 567' },
    announcedBy: 'scientist'
  },
  {
    title: 'Cardiovascular Medicine & Digital Therapeutics Summit',
    slug: 'cardiovascular-digital-2027',
    description: 'Innovative technologies, AI-powered diagnostics, and digital therapeutics in cardiology.',
    day: '02–03',
    month: 'OCT 27',
    location: 'Tokyo, Japan · In person',
    eventDate: d(400, 9),
    startTime: '09:00',
    endTime: '17:30',
    fees: [
      { label: 'Student', amount: 20000 },
      { label: 'Industry Delegate', amount: 45000 }
    ],
    organizerContact: { name: 'Dr. Kenji Tanaka', email: 'cardio@streamconferences.com', phone: '+81 3 5555 0122' },
    announcedBy: 'admin'
  },
  {
    title: 'Healthcare Informatics & Patient Care Systems Expo',
    slug: 'healthcare-informatics-2027',
    description: 'Bringing together hospital administrators, software engineers, and medical informatics experts.',
    day: '12–13',
    month: 'NOV 27',
    location: 'Sydney, Australia · In person',
    eventDate: d(440, 9),
    startTime: '09:00',
    endTime: '17:00',
    fees: [
      { label: 'Standard', amount: 30000 }
    ],
    organizerContact: { name: 'Rachel Green', email: 'informatics@streamconferences.com', phone: '+61 2 9876 5432' },
    announcedBy: 'mentor'
  },
  {
    title: 'Pediatric Health & Immunology Excellence Forum',
    slug: 'pediatric-excellence-2027',
    description: 'Dedicated to pediatric care, vaccination strategies, and childhood immune system research.',
    day: '05–07',
    month: 'DEC 27',
    location: 'Toronto, Canada · Hybrid',
    eventDate: d(470, 9),
    startTime: '08:30',
    endTime: '16:30',
    fees: [
      { label: 'Student', amount: 18000 },
      { label: 'Academic', amount: 28000 }
    ],
    organizerContact: { name: 'Dr. Emily Vance', email: 'pediatrics@streamconferences.com', phone: '+1 (416) 555-0188' },
    announcedBy: 'scientist'
  }
];

const webinars = [
  {
    title: 'Precision systems: turning data into better decisions',
    slug: 'precision-systems',
    description: 'A focused online panel on precision decision-making with real-world data.',
    day: '22',
    month: 'OCT 26',
    location: 'Online · 14:00 UTC',
    eventDate: d(55, 14),
    speaker: 'Dr. Amina Rao',
    startTime: '14:00',
    endTime: '15:30',
    fees: [
      { label: 'Standard', amount: 1500 },
      { label: 'Student', amount: 500 }
    ],
    organizerContact: { name: 'Dr. Amina Rao', email: 'webinars@streamconferences.com', phone: '+91 98765 43210' },
    announcedBy: 'mentor'
  },
  {
    title: 'Engineering resilient cities under pressure',
    slug: 'resilient-cities',
    description: 'Digital clinical and engineering seminar on building resilience under pressure.',
    day: '04',
    month: 'DEC 26',
    location: 'Online · 16:00 UTC',
    eventDate: d(100, 16),
    speaker: 'Prof. Daniel Okafor',
    startTime: '16:00',
    endTime: '17:30',
    fees: [
      { label: 'Standard', amount: 2000 }
    ],
    organizerContact: { name: 'Prof. Daniel Okafor', email: 'webinars@streamconferences.com', phone: '+234 701 234 5678' },
    announcedBy: 'scientist'
  },
  {
    title: 'The evidence gap: building trust in public health',
    slug: 'evidence-gap',
    description: 'Archived webinar exploring trust, evidence and public health communication.',
    day: '07',
    month: 'JUN 25',
    location: 'Online · 13:00 UTC',
    eventDate: d(-450, 13),
    speaker: 'Dr. Leila Morgan',
    startTime: '13:00',
    endTime: '14:30',
    fees: [
      { label: 'Standard', amount: 1000 }
    ],
    organizerContact: { name: 'Dr. Leila Morgan', email: 'webinars@streamconferences.com', phone: '+44 20 7946 0958' },
    announcedBy: 'admin'
  },
  {
    title: 'AI in drug discovery: accelerating the pipeline',
    slug: 'ai-drug-discovery',
    description: 'Learn how deep learning models are predicting protein-ligand interactions and shortening timelines.',
    day: '15',
    month: 'JAN 27',
    location: 'Online · 15:00 UTC',
    eventDate: d(139, 15),
    speaker: 'Dr. Sarah Chen',
    startTime: '15:00',
    endTime: '16:30',
    fees: [
      { label: 'Standard', amount: 1200 }
    ],
    organizerContact: { name: 'Dr. Sarah Chen', email: 'webinars@streamconferences.com', phone: '+1 (617) 555-0100' },
    announcedBy: 'admin'
  },
  {
    title: 'Quantum computing in biotechnology',
    slug: 'quantum-biotech',
    description: 'How quantum simulation can solve complex chemical reactions impossible for classical computers.',
    day: '29',
    month: 'FEB 27',
    location: 'Online · 10:00 UTC',
    eventDate: d(184, 10),
    speaker: 'Dr. Katrin Schmidt',
    startTime: '10:00',
    endTime: '11:30',
    fees: [
      { label: 'Standard', amount: 2500 }
    ],
    organizerContact: { name: 'Dr. Katrin Schmidt', email: 'webinars@streamconferences.com', phone: '+49 30 1234 567' },
    announcedBy: 'scientist'
  },
  {
    title: 'Telemedicine expansion in rural areas',
    slug: 'telemedicine-rural',
    description: 'Discussing technological requirements, network stability, and doctor-patient trust building.',
    day: '11',
    month: 'MAR 27',
    location: 'Online · 11:00 UTC',
    eventDate: d(194, 11),
    speaker: 'Rachel Green',
    startTime: '11:00',
    endTime: '12:30',
    fees: [
      { label: 'Standard', amount: 1000 },
      { label: 'Student', amount: 300 }
    ],
    organizerContact: { name: 'Rachel Green', email: 'webinars@streamconferences.com', phone: '+61 2 9876 5432' },
    announcedBy: 'mentor'
  },
  {
    title: 'Epigenetics and environmental factors in health',
    slug: 'epigenetics-health',
    description: 'Understanding how diet, lifestyle, and pollution influence gene expression without altering DNA.',
    day: '25',
    month: 'APR 27',
    location: 'Online · 14:00 UTC',
    eventDate: d(239, 14),
    speaker: 'Dr. Alex Wong',
    startTime: '14:00',
    endTime: '15:30',
    fees: [
      { label: 'Standard', amount: 1800 }
    ],
    organizerContact: { name: 'Dr. Alex Wong', email: 'webinars@streamconferences.com', phone: '+1 (415) 555-0199' },
    announcedBy: 'admin'
  },
  {
    title: 'Cybersecurity in digital healthcare infrastructure',
    slug: 'cybersecurity-healthcare',
    description: 'Protecting patient records, defending against ransomware, and implementing secure API channels.',
    day: '08',
    month: 'MAY 27',
    location: 'Online · 16:00 UTC',
    eventDate: d(252, 16),
    speaker: 'Maya Chen',
    startTime: '16:00',
    endTime: '17:30',
    fees: [
      { label: 'Standard', amount: 2000 }
    ],
    organizerContact: { name: 'Maya Chen', email: 'webinars@streamconferences.com', phone: '+44 20 7946 0958' },
    announcedBy: 'scientist'
  },
  {
    title: 'Climate change impacts on infectious diseases',
    slug: 'climate-infectious-diseases',
    description: 'Analysing vector migrations and outbreak patterns driven by shifting temperature ranges.',
    day: '22',
    month: 'JUN 27',
    location: 'Online · 13:00 UTC',
    eventDate: d(297, 13),
    speaker: 'Prof. Daniel Okafor',
    startTime: '13:00',
    endTime: '14:30',
    fees: [
      { label: 'Standard', amount: 1500 }
    ],
    organizerContact: { name: 'Prof. Daniel Okafor', email: 'webinars@streamconferences.com', phone: '+234 701 234 5678' },
    announcedBy: 'mentor'
  },
  {
    title: 'Microbiome therapies and clinical translations',
    slug: 'microbiome-therapies',
    description: 'Fecal microbiota transplants, probiotics, and targeted gut biome adjustments in clinical settings.',
    day: '10',
    month: 'JUL 27',
    location: 'Online · 15:00 UTC',
    eventDate: d(315, 15),
    speaker: 'Dr. Elena Rossi',
    startTime: '15:00',
    endTime: '16:30',
    fees: [
      { label: 'Standard', amount: 1600 }
    ],
    organizerContact: { name: 'Dr. Elena Rossi', email: 'webinars@streamconferences.com', phone: '+39 333 1234567' },
    announcedBy: 'scientist'
  }
];

const participantSeed = [
  { name: 'Alice Martin', email: 'alice.martin@example.com', phone: '+1 555 0101', institution: 'MIT', country: 'United States', category: 'Student', presentingAbstract: 'Yes' },
  { name: 'Ravi Patel', email: 'ravi.patel@example.com', phone: '+91 98765 43210', institution: 'IIT Bombay', country: 'India', category: 'Academic', presentingAbstract: 'Yes' },
  { name: 'Dr. Elena Rossi', email: 'elena.rossi@example.com', phone: '+39 333 1234567', institution: 'University of Milan', country: 'Italy', category: 'Industry Delegate', presentingAbstract: 'No' },
  { name: 'Kenji Watanabe', email: 'kenji.w@example.com', phone: '+81 90 1234 5678', institution: 'University of Tokyo', country: 'Japan', category: 'Academic', presentingAbstract: 'Yes' },
  { name: 'Maria Gomez', email: 'maria.gomez@example.com', phone: '+34 600 123 456', institution: 'Complutense Madrid', country: 'Spain', category: 'Virtual Attendee', presentingAbstract: 'No' },
  { name: 'James Ochieng', email: 'j.ochieng@example.com', phone: '+254 712 345678', institution: 'University of Nairobi', country: 'Kenya', category: 'Student', presentingAbstract: 'No' },
  { name: 'Dr. Sofia Lindberg', email: 'sofia.l@example.com', phone: '+46 70 123 45 67', institution: 'Karolinska Institute', country: 'Sweden', category: 'Industry Delegate', presentingAbstract: 'Yes' },
  { name: 'Chen Wei', email: 'chen.wei@example.com', phone: '+86 138 0013 8000', institution: 'Tsinghua University', country: 'China', category: 'Academic', presentingAbstract: 'Yes' },
  { name: 'Amara Diallo', email: 'amara.d@example.com', phone: '+221 77 123 45 67', institution: 'UCAD Dakar', country: 'Senegal', category: 'Student', presentingAbstract: 'No' },
  { name: 'Dr. Lucas Ferreira', email: 'lucas.f@example.com', phone: '+55 11 91234 5678', institution: 'USP São Paulo', country: 'Brazil', category: 'Academic', presentingAbstract: 'Yes' }
];

const CATEGORY_PRICING = {
  'Student': 24500,
  'Academic': 39500,
  'Industry Delegate': 52000,
  'Virtual Attendee': 14500
};

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`[Seed] Connected to ${MONGO_URI}`);

    // Users
    for (const u of users) {
      const exists = await User.findOne({ username: u.username });
      if (!exists) {
        await User.create(u);
        console.log(`[Seed] User created: ${u.username} (${u.role})`);
      } else {
        console.log(`[Seed] User exists: ${u.username}`);
      }
    }

    // Clear prior state to start fresh and ensure eventId sequence (C1000001 / W1000001) starts correctly
    await Conference.deleteMany({});
    await Webinar.deleteMany({});
    await Registration.deleteMany({});
    await Order.deleteMany({});
    console.log('[Seed] Cleared prior database state (conferences, webinars, registrations, orders)');

    // Conferences
    const confIds = {};
    for (const c of conferences) {
      const doc = await Conference.create({ ...c, slug: c.slug || generateSlug(c.title, 'conf') });
      console.log(`[Seed] Conference created: ${c.title} -> ${doc.eventId} (/register?event=${doc.eventId})`);
      confIds[c.slug] = doc._id.toString();
    }

    // Webinars
    const webIds = {};
    for (const w of webinars) {
      const doc = await Webinar.create({ ...w, slug: w.slug || generateSlug(w.title, 'web') });
      console.log(`[Seed] Webinar created: ${w.title} -> ${doc.eventId} (/register?event=${doc.eventId})`);
      webIds[w.slug] = doc._id.toString();
    }

    // Blogs are created exclusively through the admin panel. No seed blogs are inserted.

    // Linked registrations + orders per event (deterministic slices of the participant pool)
    const events = [
      { id: confIds['icmlhs-2027'], type: 'conference', title: 'International Conference on Medical, Life & Health Sciences', slug: 'icmlhs-2027', slices: [0, 1, 2, 3], paid: [0, 1, 2] },
      { id: confIds['applied-intelligence-2027'], type: 'conference', title: 'Applied Intelligence & Emerging Technologies Forum', slug: 'applied-intelligence-2027', slices: [4, 5, 6], paid: [4] },
      { id: confIds['digital-health-2026'], type: 'conference', title: 'Digital Health & Wearable Systems Summit', slug: 'digital-health-2026', slices: [7, 8], paid: [7, 8] },
      { id: confIds['global-forum-2025'], type: 'conference', title: 'Global Forum on Research Translation', slug: 'global-forum-2025', slices: [9], paid: [9] },
      { id: webIds['precision-systems'], type: 'webinar', title: 'Precision systems: turning data into better decisions', slug: 'precision-systems', slices: [0, 2, 4], paid: [0, 2] },
      { id: webIds['resilient-cities'], type: 'webinar', title: 'Engineering resilient cities under pressure', slug: 'resilient-cities', slices: [3, 5], paid: [] },
      { id: webIds['evidence-gap'], type: 'webinar', title: 'The evidence gap: building trust in public health', slug: 'evidence-gap', slices: [6, 8], paid: [8] }
    ];

    for (const ev of events) {
      for (const idx of ev.slices) {
        const p = participantSeed[idx];
        const paid = ev.paid.includes(idx);

        const reg = await Registration.create({
          ...p,
          eventId: ev.id,
          eventType: ev.type,
          eventTitle: ev.title,
          eventSlug: ev.slug,
          paymentStatus: paid ? 'paid' : 'unpaid'
        });

        if (paid) {
          await Order.create({
            orderId: `order_mock_seed_${ev.slug}_${idx}_${Date.now()}`,
            paymentId: `pay_mock_seed_${ev.slug}_${idx}`,
            signature: `sig_seed_${ev.slug}_${idx}`,
            name: p.name,
            email: p.email,
            phone: p.phone,
            category: p.category,
            amount: CATEGORY_PRICING[p.category] || 24500,
            currency: 'INR',
            registrationId: reg._id.toString(),
            eventId: ev.id,
            eventType: ev.type,
            eventTitle: ev.title,
            eventSlug: ev.slug,
            status: 'paid',
            mode: 'mock'
          });
          console.log(`[Seed] Paid registration + order: ${p.name} -> ${ev.title}`);
        } else {
          console.log(`[Seed] Registration (unpaid): ${p.name} -> ${ev.title}`);
        }
      }
    }

    const summary = {
      users: await User.countDocuments(),
      conferences: await Conference.countDocuments(),
      webinars: await Webinar.countDocuments(),
      blogs: await Blog.countDocuments(),
      registrations: await Registration.countDocuments(),
      orders: await Order.countDocuments()
    };
    console.log('\n[Seed] === SEED SUMMARY ===');
    console.log(summary);
    console.log('[Seed] Done.');
  } catch (err) {
    console.error('[Seed] Failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
