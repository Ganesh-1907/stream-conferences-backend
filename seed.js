import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Conference } from './models/Conference.js';
import { Webinar } from './models/Webinar.js';
import { Blog } from './models/Blog.js';
import { Abstract } from './models/Abstract.js';
import { Registration } from './models/Registration.js';
import { Order } from './models/Order.js';
import { generateSlug } from './services/slug.js';

const MONGO_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/stream-conf';
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const d = (offsetDays, hour = 9) => {
  const dt = new Date(NOW + offsetDays * DAY);
  dt.setHours(hour, 0, 0, 0);
  return dt;
};

const users = [
  { username: 'admin', password: 'admin123', email: 'admin@yopmail.com', role: 'admin' },
  { username: 'mentor', password: 'mentor123', email: 'mentor@yopmail.com', role: 'mentor' }
];

const conferenceTitles = [
  ['International Conference on Medical, Life & Health Sciences', 'icmlhs-2027', 'Boston, Massachusetts · Hybrid', '12–14', 'MAR 27', 200, 9, '17:30', 'Dr. Sarah Chen'],
  ['Global Forum on Research Translation', 'global-forum-2025', 'Copenhagen · Hybrid', '18–20', 'NOV 25', -280, 9, '17:00', 'Dr. Leila Morgan'],
  ['Next-Gen Bioinformatics & Genomics Congress', 'bioinformatics-2027', 'San Francisco, California · In person', '15–17', 'JUN 27', 290, 9, '17:00', 'Dr. Alex Wong'],
  ['Cardiovascular Medicine & Digital Therapeutics Summit', 'cardiovascular-digital-2027', 'Tokyo, Japan · In person', '02–03', 'OCT 27', 400, 9, '17:30', 'Dr. Kenji Tanaka'],
  ['Applied Intelligence & Emerging Technologies Forum', 'applied-intelligence-2027', 'Singapore · In person', '08–09', 'MAY 27', 260, 9, '18:00', 'Prof. Daniel Okafor'],
  ['Digital Health & Wearable Systems Summit', 'digital-health-2026', 'London · In person', '21', 'SEP 26', 30, 10, '16:30', 'Maya Chen'],
  ['Oncology Frontiers & Immunology Symposium', 'oncology-frontiers-2027', 'Zurich, Switzerland · Hybrid', '04–05', 'JUL 27', 310, 9, '18:00', 'Prof. Hans Mueller'],
  ['Cognitive Neuroscience & Brain Imaging Workshop', 'neuroscience-workshop-2027', 'Berlin, Germany · Hybrid', '18', 'AUG 27', 350, 10, '16:00', 'Dr. Katrin Schmidt'],
  ['Healthcare Informatics & Patient Care Systems Expo', 'healthcare-informatics-2027', 'Sydney, Australia · In person', '12–13', 'NOV 27', 440, 9, '17:00', 'Rachel Green'],
  ['Pediatric Health & Immunology Excellence Forum', 'pediatric-excellence-2027', 'Toronto, Canada · Hybrid', '05–07', 'DEC 27', 470, 9, '16:30', 'Dr. Emily Vance'],
  ['Regenerative Medicine & Stem Cell Conference', 'regenerative-medicine-2027', 'Amsterdam, Netherlands · Hybrid', '22–24', 'JAN 28', 510, 9, '17:30', 'Dr. Sofia Lindberg'],
  ['Genomics of Rare Diseases Congress', 'genomics-rare-2027', 'Berlin, Germany · In person', '14–16', 'FEB 28', 540, 9, '17:00', 'Dr. Lucas Ferreira'],
  ['Nanomedicine & Drug Delivery Symposium', 'nanomedicine-2027', 'Barcelona, Spain · Hybrid', '09–11', 'MAR 28', 580, 9, '18:00', 'Dr. Elena Rossi'],
  ['Personalized Precision Medicine Forum', 'precision-medicine-2027', 'Chicago, USA · In person', '25–27', 'APR 28', 620, 9, '17:00', 'Dr. Alex Morgan']
];

const webinarTitles = [
  ['Precision systems: turning data into better decisions', 'precision-systems', 'Dr. Amina Rao', 55, 14, '15:30'],
  ['Engineering resilient cities under pressure', 'resilient-cities', 'Prof. Daniel Okafor', 100, 16, '17:30'],
  ['The evidence gap: building trust in public health', 'evidence-gap', 'Dr. Leila Morgan', 450, 13, '14:30'],
  ['AI in drug discovery: accelerating the pipeline', 'ai-drug-discovery', 'Dr. Sarah Chen', 139, 15, '16:30'],
  ['Quantum computing in biotechnology', 'quantum-biotech', 'Dr. Katrin Schmidt', 184, 10, '11:30'],
  ['Telemedicine expansion in rural areas', 'telemedicine-rural', 'Rachel Green', 194, 11, '12:30'],
  ['Epigenetics and environmental factors in health', 'epigenetics-health', 'Dr. Alex Wong', 239, 14, '15:30'],
  ['Cybersecurity in digital healthcare infrastructure', 'cybersecurity-healthcare', 'Maya Chen', 252, 16, '17:30'],
  ['Climate change impacts on infectious diseases', 'climate-infectious-diseases', 'Prof. Daniel Okafor', 297, 13, '14:30'],
  ['Microbiome therapies and clinical translations', 'microbiome-therapies', 'Dr. Elena Rossi', 315, 15, '16:30'],
  ['AI-assisted medical imaging diagnostics', 'ai-medical-imaging', 'Dr. Kenji Tanaka', 340, 12, '13:30'],
  ['Wearable biosensors for continuous monitoring', 'wearable-biosensors', 'Dr. Sofia Lindberg', 365, 14, '15:30'],
  ['Gene editing: CRISPR clinical applications', 'gene-editing-crispr', 'Dr. Alex Wong', 390, 15, '16:30']
];

const blogTitles = [
  ['Understanding CRISPR-Cas9 in Modern Medicine', 'research'],
  ['The Future of Telemedicine Post-2024', 'opinion'],
  ['How AI is Transforming Medical Imaging', 'technology'],
  ['A Beginner Guide to Publishing in Peer-Reviewed Journals', 'howto'],
  ['Global Trends in Antibiotic Resistance', 'research'],
  ['The Role of Medical Mentorship in Early Careers', 'mentorship'],
  ['Breakthroughs in mRNA Vaccine Technology', 'research'],
  ['Designing Effective Clinical Trials', 'howto'],
  ['Digital Twins in Personalized Healthcare', 'technology'],
  ['The Ethics of AI in Healthcare Decision Making', 'opinion'],
  ['Stem Cell Therapies: Current Clinical Landscape', 'research'],
  ['Navigating the Postdoc-to-Industry Transition', 'mentorship'],
  ['Understanding Health Data Privacy Regulations', 'howto'],
  ['Innovations in Remote Patient Monitoring', 'technology']
];

const abstractSeeds = [
  ['Alice', 'Martin', 'alice.martin@example.com', 'MIT', 'United States', 'Artificial Intelligence & Machine Learning', 'pending'],
  ['Ravi', 'Patel', 'ravi.patel@example.com', 'IIT Bombay', 'India', 'Bioinformatics', 'approved'],
  ['Elena', 'Rossi', 'elena.rossi@example.com', 'University of Milan', 'Italy', 'Immunology', 'approved'],
  ['Kenji', 'Watanabe', 'kenji.w@example.com', 'University of Tokyo', 'Japan', 'Digital Health', 'pending'],
  ['Maria', 'Gomez', 'maria.gomez@example.com', 'Complutense Madrid', 'Spain', 'Oncology', 'rejected'],
  ['James', 'Ochieng', 'j.ochieng@example.com', 'University of Nairobi', 'Kenya', 'Public Health', 'pending'],
  ['Sofia', 'Lindberg', 'sofia.l@example.com', 'Karolinska Institute', 'Sweden', 'Regenerative Medicine', 'approved'],
  ['Chen', 'Wei', 'chen.wei@example.com', 'Tsinghua University', 'China', 'Genomics', 'pending'],
  ['Amara', 'Diallo', 'amara.d@example.com', 'UCAD Dakar', 'Senegal', 'Pediatrics', 'approved'],
  ['Lucas', 'Ferreira', 'lucas.f@example.com', 'USP São Paulo', 'Brazil', 'Nanomedicine', 'pending'],
  ['Priya', 'Sharma', 'priya.sharma@example.com', 'IIT Delhi', 'India', 'Cardiology', 'approved'],
  ['Tom', 'Browne', 'tom.browne@example.com', 'Trinity College Dublin', 'Ireland', 'Neuroscience', 'pending'],
  ['Aisha', 'Khan', 'aisha.khan@example.com', "King's College London", 'United Kingdom', 'Public Health', 'approved'],
  ['Diego', 'Hernandez', 'diego.h@example.com', 'UNAM', 'Mexico', 'Oncology', 'pending']
];

const participantSeeds = [
  ['Alice Martin', 'alice.martin@example.com', '+1 555 0101', 'MIT', 'United States', 'Student', 'Yes'],
  ['Ravi Patel', 'ravi.patel@example.com', '+91 98765 43210', 'IIT Bombay', 'India', 'Academic', 'Yes'],
  ['Elena Rossi', 'elena.rossi@example.com', '+39 333 1234567', 'University of Milan', 'Italy', 'Industry Delegate', 'No'],
  ['Kenji Watanabe', 'kenji.w@example.com', '+81 90 1234 5678', 'University of Tokyo', 'Japan', 'Academic', 'Yes'],
  ['Maria Gomez', 'maria.gomez@example.com', '+34 600 123 456', 'Complutense Madrid', 'Spain', 'Virtual Attendee', 'No'],
  ['James Ochieng', 'j.ochieng@example.com', '+254 712 345678', 'University of Nairobi', 'Kenya', 'Student', 'No'],
  ['Sofia Lindberg', 'sofia.l@example.com', '+46 70 123 45 67', 'Karolinska Institute', 'Sweden', 'Industry Delegate', 'Yes'],
  ['Chen Wei', 'chen.wei@example.com', '+86 138 0013 8000', 'Tsinghua University', 'China', 'Academic', 'Yes'],
  ['Amara Diallo', 'amara.d@example.com', '+221 77 123 45 67', 'UCAD Dakar', 'Senegal', 'Student', 'No'],
  ['Lucas Ferreira', 'lucas.f@example.com', '+55 11 91234 5678', 'USP São Paulo', 'Brazil', 'Academic', 'Yes'],
  ['Priya Sharma', 'priya.sharma@example.com', '+91 99887 76655', 'IIT Delhi', 'India', 'Student', 'Yes'],
  ['Tom Browne', 'tom.browne@example.com', '+353 87 123 4567', 'Trinity College Dublin', 'Ireland', 'Academic', 'No'],
  ['Aisha Khan', 'aisha.khan@example.com', '+44 20 7946 0011', "King's College London", 'United Kingdom', 'Industry Delegate', 'Yes'],
  ['Diego Hernandez', 'diego.h@example.com', '+52 55 1234 5678', 'UNAM', 'Mexico', 'Student', 'No']
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

    for (const u of users) {
      const exists = await User.findOne({ username: u.username });
      if (!exists) {
        await User.create(u);
        console.log(`[Seed] User created: ${u.username} (${u.role})`);
      } else {
        console.log(`[Seed] User exists: ${u.username}`);
      }
    }

    await Conference.deleteMany({});
    await Webinar.deleteMany({});
    await Blog.deleteMany({});
    await Abstract.deleteMany({});
    await Registration.deleteMany({});
    await Order.deleteMany({});
    console.log('[Seed] Cleared prior data (conferences, webinars, blogs, abstracts, registrations, orders)');

    // Conferences
    const confIds = [];
    for (const [title, slug, location, day, month, offset, startH, endH, contact] of conferenceTitles) {
      const startDate = d(offset, startH);
      const endDate = new Date(startDate.getTime() + DAY);
      const doc = await Conference.create({
        title,
        slug,
        description: `Official announcement and registration portal for ${title}.`,
        day,
        month,
        location,
        eventDate: startDate,
        startDate,
        endDate,
        startTime: `${String(startH).padStart(2, '0')}:00`,
        endTime: endH,
        fees: [
          { label: 'Student', amount: 15000 },
          { label: 'Academic', amount: 35000 },
          { label: 'Industry Delegate', amount: 48000 }
        ],
        organizerContact: { name: contact, email: 'organizer@streamconferences.com', phone: '+1 555 010 0000' },
        announcedBy: 'admin'
      });
      confIds.push(doc);
      console.log(`[Seed] Conference created: ${title} -> ${doc.eventId}`);
    }

    // Webinars
    const webIds = [];
    for (const [title, slug, speaker, offset, startH, endH] of webinarTitles) {
      const startDate = d(offset, startH);
      const doc = await Webinar.create({
        title,
        slug,
        description: `Live online webinar: ${title}.`,
        day: String(startDate.getDate()),
        month: `${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][startDate.getMonth()]} ${String(startDate.getFullYear()).slice(-2)}`,
        location: `Online · ${String(startH).padStart(2, '0')}:00 UTC`,
        eventDate: startDate,
        startDate,
        endDate: startDate,
        subdomain: slug,
        startTime: `${String(startH).padStart(2, '0')}:00`,
        endTime: endH,
        speaker,
        fees: [{ label: 'Standard', amount: 1500 }],
        organizerContact: { name: speaker, email: 'webinars@streamconferences.com', phone: '+91 98765 43210' },
        announcedBy: 'admin'
      });
      webIds.push(doc);
      console.log(`[Seed] Webinar created: ${title} -> ${doc.eventId}`);
    }

    // Blogs
    for (const [title, label] of blogTitles) {
      const doc = await Blog.create({
        title,
        label,
        copy: `An in-depth exploration of ${title}. This excerpt provides a summary of key insights, findings, and practical takeaways for researchers and practitioners.`,
        content: `<h1>${title}</h1><p>Full blog content goes here. This is a detailed article about ${title}.</p>`,
        announcedBy: 'admin'
      });
      console.log(`[Seed] Blog created: ${title}`);
    }

    // Abstracts
    for (const [firstName, lastName, email, institution, country, track, status] of abstractSeeds) {
      const doc = await Abstract.create({
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        email,
        phone: '+1 555 010 0000',
        institution,
        country,
        track,
        summary: `${firstName} ${lastName} submitted an abstract on ${track} for the conference.`,
        eventType: 'conference',
        eventTitle: 'International Conference on Medical, Life & Health Sciences',
        status
      });
      console.log(`[Seed] Abstract created: ${firstName} ${lastName} (${status})`);
    }

    // Participants - attach to first two conferences
    const confToSeed = confIds.slice(0, 2);
    for (let ci = 0; ci < confToSeed.length; ci++) {
      const conf = confToSeed[ci];
      for (let i = 0; i < participantSeeds.length; i++) {
        const p = participantSeeds[i];
        const [name, email, phone, institution, country, category, presentingAbstract] = p;
        const paid = i % 2 === 0;
        const reg = await Registration.create({
          name, email, phone, institution, country, category, presentingAbstract,
          eventId: conf.eventId,
          eventType: 'conference',
          eventTitle: conf.title,
          eventSlug: conf.slug,
          paymentStatus: paid ? 'paid' : 'unpaid'
        });
        if (paid) {
          await Order.create({
            orderId: `order_seed_${conf.eventId}_${i}_${Date.now()}`,
            paymentId: `pay_seed_${conf.eventId}_${i}`,
            signature: `sig_seed_${conf.eventId}_${i}`,
            name, email, phone, category,
            amount: CATEGORY_PRICING[category] || 24500,
            currency: 'INR',
            registrationId: reg._id.toString(),
            eventId: conf.eventId,
            eventType: 'conference',
            eventTitle: conf.title,
            eventSlug: conf.slug,
            status: 'paid',
            mode: 'mock'
          });
        }
      }
      console.log(`[Seed] ${participantSeeds.length} participants added to ${conf.title}`);
    }

    const summary = {
      users: await User.countDocuments(),
      conferences: await Conference.countDocuments(),
      webinars: await Webinar.countDocuments(),
      blogs: await Blog.countDocuments(),
      abstracts: await Abstract.countDocuments(),
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
