import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Conference } from './models/Conference.js';
import { Blog } from './models/Blog.js';
import { Abstract } from './models/Abstract.js';
import { Registration } from './models/Registration.js';
import { Order } from './models/Order.js';
import { CourseCohort } from './models/CourseCohort.js';
import { MentorProfile } from './models/MentorProfile.js';
import { generateSlug } from './services/slug.js';
import { ensureInitialCohort, buildCohortId, extractContent, setCurrentCohort } from './services/cohortService.js';

const MONGO_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/stream-conf';
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const d = (offsetDays, hour = 9) => {
  const dt = new Date(NOW + offsetDays * DAY);
  dt.setHours(hour, 0, 0, 0);
  return dt;
};

// ---------------------------------------------------------------------------
// USERS (admin + mentors)
// ---------------------------------------------------------------------------
const admin = { username: 'admin', password: 'admin123', email: 'admin@yopmail.com', role: 'admin' };

const mentorUsers = [
  ['drsarahchen', 'sarah@yopmail.com', 'Dr. Sarah Chen'],
  ['drleilamorgan', 'leila@yopmail.com', 'Dr. Leila Morgan'],
  ['dralexwong', 'alexwong@yopmail.com', 'Dr. Alex Wong'],
  ['drkenjitanaka', 'kenji@yopmail.com', 'Dr. Kenji Tanaka'],
  ['profdanielokafor', 'daniel@yopmail.com', 'Prof. Daniel Okafor'],
  ['drkatrinschmidt', 'katrin@yopmail.com', 'Dr. Katrin Schmidt'],
  ['drsofialindberg', 'sofia@yopmail.com', 'Dr. Sofia Lindberg'],
  ['drarlenaramirez', 'arlena@yopmail.com', 'Dr. Arlena Ramirez'],
  ['drrajivmehta', 'rajiv@yopmail.com', 'Dr. Rajiv Mehta'],
  ['drgraceodoi', 'grace@yopmail.com', 'Dr. Grace Odoi'],
];

const mentorProfiles = [
  ['drsarahchen', 'Dr. Sarah Chen', 'Director of Translational Oncology', 'Leading researcher in precision oncology and immuno-oncology with over 15 years of clinical trial leadership.', 'Boston, USA', ['Oncology', 'Immunotherapy', 'Clinical Trials']],
  ['drleilamorgan', 'Dr. Leila Morgan', 'Professor of Public Health', 'Public health strategist focused on evidence-based policy and global health equity.', 'Copenhagen, Denmark', ['Public Health', 'Epidemiology', 'Health Policy']],
  ['dralexwong', 'Dr. Alex Wong', 'Head of Bioinformatics', 'Computational biologist specialising in genomics and large-scale biological data analysis.', 'San Francisco, USA', ['Genomics', 'Bioinformatics', 'Data Science']],
  ['drkenjitanaka', 'Dr. Kenji Tanaka', 'Cardiology & Digital Therapeutics', 'Interventional cardiologist advancing wearable-based cardiovascular care.', 'Tokyo, Japan', ['Cardiology', 'Digital Health', 'Wearables']],
  ['profdanielokafor', 'Prof. Daniel Okafor', 'Chair, AI & Emerging Tech', 'Pioneer in applied artificial intelligence for sustainable urban and health systems.', 'Singapore', ['Artificial Intelligence', 'Sustainability', 'Smart Cities']],
  ['drkatrinschmidt', 'Dr. Katrin Schmidt', 'Neuroscientist', 'Cognitive neuroscientist exploring brain imaging and neuroplasticity.', 'Berlin, Germany', ['Neuroscience', 'Brain Imaging', 'Cognitive Science']],
  ['drsofialindberg', 'Dr. Sofia Lindberg', 'Regenerative Medicine Lead', 'Stem cell biologist translating regenerative therapies into clinical practice.', 'Stockholm, Sweden', ['Regenerative Medicine', 'Stem Cells', 'Cell Therapy']],
  ['drarlenaramirez', 'Dr. Arlena Ramirez', 'Nanomedicine Scientist', 'Nanotechnology researcher developing targeted drug delivery platforms.', 'Barcelona, Spain', ['Nanomedicine', 'Drug Delivery', 'Biomaterials']],
  ['drrajivmehta', 'Dr. Rajiv Mehta', 'Genomics & Rare Diseases', 'Geneticist focused on rare disease diagnostics and gene therapy.', 'Mumbai, India', ['Genomics', 'Rare Diseases', 'Gene Therapy']],
  ['drgraceodoi', 'Dr. Grace Odoi', 'Pediatric Immunology', 'Pediatric immunologist advancing childhood vaccination and immunotherapy.', 'Nairobi, Kenya', ['Pediatrics', 'Immunology', 'Vaccinology']],
];

// ---------------------------------------------------------------------------
// TRACKS (10-20 per event)
// ---------------------------------------------------------------------------
const CONFERENCE_TRACK_POOL = [
  'Artificial Intelligence & Machine Learning',
  'Precision Medicine & Genomics',
  'Digital Health & Telemedicine',
  'Regenerative Medicine & Stem Cells',
  'Immunology & Immunotherapy',
  'Neuroscience & Brain Imaging',
  'Cardiovascular Innovations',
  'Nanomedicine & Drug Delivery',
  'Bioinformatics & Data Science',
  'Public Health & Epidemiology',
  'Pediatric Research',
  'Oncology Frontiers',
  'Healthcare Informatics',
  'Biomedical Engineering',
  'Rare Diseases & Gene Therapy',
  'Clinical Trials & Ethics',
  'Medical Education & Mentorship',
  'Wearable & Biosensor Technology',
  'Microbiome Research',
  'Translational Research',
];

function buildTracks(pool, count) {
  return pool.slice(0, count).map((title, i) => ({
    title,
    description: `This track covers cutting-edge developments in ${title.toLowerCase()} with invited talks, workshops, and panel discussions.`,
    referenceLinks: [
      { label: 'Official page', url: `https://example.com/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` },
      { label: 'Submission guide', url: 'https://example.com/submit' },
    ],
  }));
}

function buildFees() {
  return [
    { type: 'Student', dateLabel: 'on/before 25 Dec', deadline: '2026-12-25', usd: 255, gbp: 277, eur: 299 },
    { type: 'Student', dateLabel: 'on/before 30 Jan', deadline: '2027-01-30', usd: 190, gbp: 190, eur: 199 },
    { type: 'Student', dateLabel: 'Final', deadline: null, usd: 190, gbp: 788, eur: 890 },
    { type: 'Academic', dateLabel: 'on/before 25 Dec', deadline: '2026-12-25', usd: 355, gbp: 377, eur: 399 },
    { type: 'Academic', dateLabel: 'on/before 30 Jan', deadline: '2027-01-30', usd: 290, gbp: 290, eur: 299 },
    { type: 'Industry Delegate', dateLabel: 'on/before 25 Dec', deadline: '2026-12-25', usd: 555, gbp: 577, eur: 599 },
  ];
}

function buildSpeakers(count, eventIndex) {
  const firstNames = ['Ananya', 'Marcus', 'Priya', 'Oliver', 'Fatima', 'Hiroshi', 'Isabella', 'Kwame', 'Lucia', 'Noah'];
  const lastNames = ['Iyer', 'Bennett', 'Kapoor', 'Sato', 'Alves', 'Novak', 'Kaur', 'Mensah', 'Rossi', 'Brooks'];
  const orgs = ['Harvard Medical School', 'Max Planck Institute', 'Johns Hopkins', 'National University of Singapore', 'Karolinska Institute', 'University of Cape Town', 'MIT', 'ETH Zurich', 'University of Oxford', 'Stanford University'];
  return Array.from({ length: count }, (_, i) => ({
    name: `Dr. ${firstNames[(i + eventIndex) % 10]} ${lastNames[(i + eventIndex * 2) % 10]}`,
    designation: i % 3 === 0 ? 'Keynote Speaker' : 'Invited Speaker',
    organization: orgs[(i + eventIndex) % 10],
    bio: `Renowned expert in the field with ${10 + i} years of research and clinical experience.`,
    topic: `Advances in ${['Precision Medicine', 'Digital Health', 'Immunology', 'Genomics', 'Neuroscience'][i % 5]}`,
    isKeynote: i % 4 === 0,
  }));
}

function buildFaqs(eventTitle) {
  return [
    { question: 'How do I register for the event?', answer: `Visit the registration page for "${eventTitle}" and complete the online form. You will receive a confirmation email.`, category: 'general', order: 0 },
    { question: 'Is there a student discount?', answer: 'Yes, students receive a discounted rate. A valid student ID is required at check-in.', category: 'fees', order: 1 },
    { question: 'Can I submit an abstract?', answer: 'Abstracts can be submitted through the dedicated submission portal before the deadline.', category: 'abstracts', order: 2 },
    { question: 'What is the refund policy?', answer: 'Full refunds are available up to 30 days before the event. After that, a 50% refund applies.', category: 'fees', order: 3 },
    { question: 'Will sessions be recorded?', answer: 'Yes, all approved sessions will be recorded and shared with registered attendees.', category: 'general', order: 4 },
    { question: 'Are there networking opportunities?', answer: 'Several dedicated networking breaks and a formal dinner are scheduled.', category: 'general', order: 5 },
  ];
}

function buildProgram(startDate, days = 2) {
  return Array.from({ length: days }, (_, di) => ({
    dayNumber: di + 1,
    date: new Date(new Date(startDate).getTime() + di * DAY),
    title: `Day ${di + 1} Sessions`,
    description: `Core program for day ${di + 1}.`,
    sessions: [
      { time: '09:00', title: 'Registration & Welcome', description: 'On-site check-in and welcome refreshments.', type: 'break' },
      { time: '10:00', title: 'Keynote Address', description: 'Opening keynote by a leading researcher.', speaker: 'Keynote Speaker', type: 'keynote' },
      { time: '11:30', title: 'Technical Session I', description: 'Parallel track sessions.', track: 'Artificial Intelligence & Machine Learning', type: 'session' },
      { time: '13:00', title: 'Lunch & Networking', description: 'Lunch break with exhibitors.', type: 'break' },
      { time: '14:30', title: 'Panel Discussion', description: 'Expert panel on emerging trends.', type: 'panel' },
      { time: '16:30', title: 'Closing Remarks', description: 'Wrap-up and next-day preview.', type: 'session' },
    ],
  }));
}

function buildOrganizingCommittee(eventIndex) {
  const names = [['Dr. Nandini Rao', 'Ph.D', 'Genomics'], ['Dr. Samuel Adeyemi', 'M.D.', 'Cardiology'], ['Dr. Mei Lin', 'Ph.D', 'Bioinformatics'], ['Dr. Pablo Ortega', 'M.D.', 'Immunology']];
  return names.map((m, i) => ({
    name: m[0],
    degree: m[1],
    specialization: m[2],
    country: ['India', 'Nigeria', 'China', 'Spain'][i % 4],
    biography: `${m[0]} is a distinguished member of the organizing committee.`,
    researchArea: m[2],
  }));
}

// ---------------------------------------------------------------------------
// CONFERENCES (5)
// ---------------------------------------------------------------------------
const conferenceDefs = [
  { title: 'International Conference on Medical, Life & Health Sciences', slug: 'icmlhs', location: '', day: '12–14', month: 'MAR 27', offset: 200, startH: 9, endH: '17:30', contact: 'Dr. Sarah Chen', trackCount: 16, speakerCount: 8 },
  { title: 'Global Forum on Research Translation', slug: 'global-forum', location: '', day: '18–20', month: 'NOV 27', offset: 400, startH: 9, endH: '17:00', contact: 'Dr. Leila Morgan', trackCount: 12, speakerCount: 7 },
  { title: 'Next-Gen Bioinformatics & Genomics Congress', slug: 'bioinformatics', location: '', day: '15–17', month: 'JUN 27', offset: 290, startH: 9, endH: '17:00', contact: 'Dr. Alex Wong', trackCount: 14, speakerCount: 8 },
  { title: 'Cardiovascular Medicine & Digital Therapeutics Summit', slug: 'cardiovascular-digital', location: '', day: '02–03', month: 'OCT 27', offset: 350, startH: 9, endH: '17:30', contact: 'Dr. Kenji Tanaka', trackCount: 10, speakerCount: 6 },
  { title: 'Applied Intelligence & Emerging Technologies Forum', slug: 'applied-intelligence', location: '', day: '08–09', month: 'MAY 27', offset: 260, startH: 9, endH: '18:00', contact: 'Prof. Daniel Okafor', trackCount: 12, speakerCount: 7 },
];

// ---------------------------------------------------------------------------
// BLOGS (5) — richer content
// ---------------------------------------------------------------------------
const blogDefs = [
  {
    title: 'Understanding CRISPR-Cas9 in Modern Medicine',
    label: 'research',
    copy: 'CRISPR-Cas9 is transforming how we approach genetic disorders, from proof-of-concept to early clinical trials.',
    content: `
<h2>Introduction</h2>
<p>CRISPR-Cas9 has emerged as the most versatile gene-editing tool of our generation. Its precision, low cost, and adaptability have opened the door to treating conditions once considered intractable.</p>
<h2>How It Works</h2>
<p>The Cas9 enzyme is guided by a synthetic RNA sequence to a specific location in the genome, where it creates a double-stranded break. The cell's repair machinery then introduces targeted edits.</p>
<h2>Clinical Applications</h2>
<ul><li>Sickle cell disease and beta-thalassemia therapies</li><li>CAR-T cell engineering for oncology</li><li>Inherited retinal disease correction</li></ul>
<h2>Ethical Considerations</h2>
<p>Germline editing remains highly debated, with most regulatory bodies calling for moratoria until safety and ethical frameworks mature.</p>
<p><strong>Key takeaway:</strong> CRISPR is moving from the lab to the clinic faster than expected, but governance must keep pace.</p>`,
  },
  {
    title: 'The Future of Telemedicine Post-2024',
    label: 'opinion',
    copy: 'Telemedicine has moved from a convenience to a necessity. What happens now that the emergency has passed?',
    content: `
<h2>The Shift to Virtual Care</h2>
<p>The pandemic accelerated telehealth adoption by a decade in a matter of months. Patients and providers alike discovered the value of remote consultations.</p>
<h2>What's Working</h2>
<p>Remote patient monitoring, asynchronous consultations, and specialist access for rural populations continue to deliver measurable outcomes.</p>
<h2>Challenges Ahead</h2>
<ul><li>Reimbursement parity remains inconsistent</li><li>Digital literacy gaps persist among older adults</li><li>Data interoperability across platforms</li></ul>
<p>The future belongs to hybrid care models that blend the best of virtual and in-person medicine.</p>`,
  },
  {
    title: 'How AI is Transforming Medical Imaging',
    label: 'technology',
    copy: 'From radiology to pathology, deep learning models are matching and sometimes exceeding human diagnostic accuracy.',
    content: `
<h2>Deep Learning in Radiology</h2>
<p>Convolutional neural networks trained on millions of annotated scans now flag anomalies with remarkable sensitivity, acting as a safety net for radiologists.</p>
<h2>Beyond Detection</h2>
<p>AI is also assisting with segmentation, treatment response assessment, and workflow prioritization.</p>
<h2>Regulatory Landscape</h2>
<p>Regulators are establishing clearer pathways for AI-enabled medical devices, though concerns around algorithmic bias and generalizability remain.</p>
<p>Used responsibly, AI can reduce burnout and improve patient outcomes.</p>`,
  },
  {
    title: 'A Beginner Guide to Publishing in Peer-Reviewed Journals',
    label: 'howto',
    copy: 'Navigating the peer-review process can feel daunting. This guide breaks it down into actionable steps.',
    content: `
<h2>Choosing the Right Journal</h2>
<p>Target journals that align with your research scope and audience. Consider impact factor, indexing, and review speed.</p>
<h2>Structuring Your Manuscript</h2>
<ol><li>Clear and concise title</li><li>Structured abstract</li><li>Introduction with a defined gap</li><li>Methods that allow replication</li><li>Results presented logically</li><li>Discussion that interprets, not repeats</li></ol>
<h2>Responding to Reviewers</h2>
<p>Always respond respectfully and systematically. A point-by-point rebuttal letter significantly improves your chances of acceptance.</p>`,
  },
  {
    title: 'Global Trends in Antibiotic Resistance',
    label: 'research',
    copy: 'Antimicrobial resistance is one of the greatest threats to global health. New stewardship strategies are emerging.',
    content: `
<h2>The Scale of the Problem</h2>
<p>Drug-resistant infections claim over a million lives each year, and the number is rising as antibiotics lose effectiveness.</p>
<h2>Drivers of Resistance</h2>
<ul><li>Over-prescription in human medicine</li><li>Agricultural antibiotic use</li><li>Poor infection control</li></ul>
<h2>Emerging Solutions</h2>
<p>Rapid diagnostics, phage therapy, and novel antimicrobial compounds offer hope, but require coordinated global investment.</p>
<p>Combating resistance demands a One Health approach spanning human, animal, and environmental health.</p>`,
  },
];

// ---------------------------------------------------------------------------
// SEEDING
// ---------------------------------------------------------------------------
async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`[Seed] Connected to ${MONGO_URI}`);

    // 1. Users
    await User.deleteMany({});
    await MentorProfile.deleteMany({});
    await User.create(admin);
    console.log('[Seed] Admin created');
    for (const [username, email, fullName] of mentorUsers) {
      await User.create({ username, email, password: 'mentor123', role: 'mentor' });
    }
    console.log(`[Seed] ${mentorUsers.length} mentor users created`);

    // 2. Mentor profiles
    for (const [username, fullName, title, bio, location, expertise] of mentorProfiles) {
      await MentorProfile.create({
        username,
        fullName,
        title,
        bio,
        location,
        expertise,
        email: `${username}@yopmail.com`,
        phone: '+1 555 010 0000',
        linkedin: `https://linkedin.com/in/${username}`,
        website: `https://${username}.example.com`,
        education: [
          { degree: 'Ph.D', institution: 'University of Excellence', year: '2010' },
          { degree: 'M.D.', institution: 'Global Medical College', year: '2004' },
        ],
        experiences: [
          { title: 'Lead Researcher', organization: 'National Research Institute', duration: '2015 - Present', description: 'Leading multidisciplinary research teams.' },
          { title: 'Senior Scientist', organization: 'Biotech Labs', duration: '2008 - 2015', description: 'Focused on translational research.' },
        ],
        certifications: [
          { name: 'Board Certified Specialist', issuer: 'Medical Board', year: '2012' },
          { name: 'Advanced Research Leadership', issuer: 'Academy of Science', year: '2018' },
        ],
      });
    }
    console.log(`[Seed] ${mentorProfiles.length} mentor profiles created`);

    // 3. Clear event data
    await Conference.deleteMany({});
    await Blog.deleteMany({});
    await CourseCohort.deleteMany({});
    await Abstract.deleteMany({});
    await Registration.deleteMany({});
    await Order.deleteMany({});
    console.log('[Seed] Cleared prior data');

    // 4. Conferences
    const confDocs = [];
    for (const def of conferenceDefs) {
      const startDate = d(def.offset, def.startH);
      const endDate = new Date(startDate.getTime() + 2 * DAY);
      const tracks = buildTracks(CONFERENCE_TRACK_POOL, def.trackCount);
      const speakers = buildSpeakers(def.speakerCount, confDocs.length);
      const doc = await Conference.create({
        title: def.title,
        slug: def.slug,
        description: `Official announcement and registration portal for ${def.title}. Join leading researchers, clinicians and industry experts for keynote lectures, technical sessions and networking.`,
        theme: 'Innovation · Collaboration · Impact',
        day: def.day,
        month: def.month,
        location: def.location,
        venue: '',
        venueAddress: '',
        eventDate: startDate,
        startDate,
        endDate,
        subdomain: def.slug,
        startTime: `${String(def.startH).padStart(2, '0')}:00`,
        endTime: def.endH,
        fees: buildFees(),
        tracks,
        speakers,
        program: buildProgram(startDate),
        faqs: buildFaqs(def.title),
        partners: [
          { title: 'Gold Sponsor', order: 0 },
          { title: 'Silver Sponsor', order: 1 },
          { title: 'Exhibitor A', order: 2 },
        ],
        organizerContact: { name: def.contact, email: 'organizer@streamconferences.com', phone: '+1 555 010 0000', website: 'https://streamconferences.com', address: '' },
        organizingCommittee: buildOrganizingCommittee(confDocs.length),
        guidelines: `<h3>Submission Guidelines</h3><p>All abstracts must be submitted through the online portal by the stated deadline. Word limit: 300 words.</p>`,
        termsAndConditions: `<h3>Terms &amp; Conditions</h3><p>By registering, you agree to the event policies, including data processing and photography consent.</p>`,
        venueDetails: {},
        announcedBy: 'admin',
        assignedMentor: mentorUsers[confDocs.length % mentorUsers.length][0],
      });
      confDocs.push(doc);
      console.log(`[Seed] Conference: ${def.title} -> ${doc.eventId} (${def.trackCount} tracks, ${def.speakerCount} speakers)`);
    }

    // 5. Blogs
    for (const def of blogDefs) {
      const doc = await Blog.create({
        title: def.title,
        label: def.label,
        copy: def.copy,
        content: def.content,
        announcedBy: 'admin',
      });
      console.log(`[Seed] Blog: ${def.title} -> ${doc.eventId}`);
    }

    // 6. Cohorts
    // Initial cohort for every conference
    for (const c of confDocs) {
      await ensureInitialCohort('conference', c);
    }

    // Extra cohorts: 2 conferences get a 2nd cohort
    const extraConferenceCohorts = [confDocs[0], confDocs[1]];

    const createExtraCohort = async (courseType, course, batchNo) => {
      const year = (course.startDate || course.eventDate) ? new Date(course.startDate || course.eventDate).getFullYear() : new Date().getFullYear();
      const cohortId = await buildCohortId(courseType, course._id, batchNo);
      const cohort = await CourseCohort.create({
        courseType,
        courseId: course._id,
        cohortId,
        year,
        batchNo,
        title: `Batch ${batchNo}`,
        startDate: course.startDate || null,
        endDate: course.endDate || null,
        status: 'upcoming',
        isCurrent: false,
        assignedMentor: course.assignedMentor || null,
        content: extractContent(course),
      });
      return cohort;
    };

    for (const c of extraConferenceCohorts) {
      await createExtraCohort('conference', c, 2);
      console.log(`[Seed] Conference extra cohort added: ${c.eventId}-2`);
    }

    // 7. Abstracts & registrations attached to first conference
    const abstractSeeds = [
      ['Alice', 'Martin', 'alice.martin@example.com', 'MIT', 'United States', 'Artificial Intelligence & Machine Learning', 'pending'],
      ['Ravi', 'Patel', 'ravi.patel@example.com', 'IIT Bombay', 'India', 'Bioinformatics', 'approved'],
      ['Elena', 'Rossi', 'elena.rossi@example.com', 'University of Milan', 'Italy', 'Immunology', 'approved'],
      ['Kenji', 'Watanabe', 'kenji.w@example.com', 'University of Tokyo', 'Japan', 'Digital Health', 'pending'],
      ['Maria', 'Gomez', 'maria.gomez@example.com', 'Complutense Madrid', 'Spain', 'Oncology', 'rejected'],
    ];
    const conf0 = confDocs[0];
    const conf0Cohort1 = await CourseCohort.findOne({ courseType: 'conference', courseId: conf0._id, batchNo: 1 });
    const conf0Cohort2 = await CourseCohort.findOne({ courseType: 'conference', courseId: conf0._id, batchNo: 2 });

    for (let ai = 0; ai < abstractSeeds.length; ai++) {
      const [firstName, lastName, email, institution, country, track, status] = abstractSeeds[ai];
      const cohort = ai % 2 === 0 && conf0Cohort1 ? conf0Cohort1 : (conf0Cohort2 || conf0Cohort1);
      await Abstract.create({
        firstName, lastName,
        name: `${firstName} ${lastName}`,
        email, institution, country, track,
        summary: `Abstract on ${track} submitted for review.`,
        eventType: 'conference',
        eventId: conf0._id.toString(),
        eventTitle: conf0.title,
        cohortId: cohort?.cohortId || null,
        status,
      });
    }
    console.log(`[Seed] ${abstractSeeds.length} abstracts created`);

    const participantSeeds = [
      ['Alice Martin', 'alice.martin@example.com', '+1 555 0101', 'MIT', 'United States', 'Student', 'Yes'],
      ['Ravi Patel', 'ravi.patel@example.com', '+91 98765 43210', 'IIT Bombay', 'India', 'Academic', 'Yes'],
      ['Elena Rossi', 'elena.rossi@example.com', '+39 333 1234567', 'University of Milan', 'Italy', 'Industry Delegate', 'No'],
      ['Kenji Watanabe', 'kenji.w@example.com', '+81 90 1234 5678', 'University of Tokyo', 'Japan', 'Academic', 'Yes'],
      ['Maria Gomez', 'maria.gomez@example.com', '+34 600 123 456', 'Complutense Madrid', 'Spain', 'Virtual Attendee', 'No'],
    ];
    const CATEGORY_PRICING = { Student: 24500, Academic: 39500, 'Industry Delegate': 52000, 'Virtual Attendee': 14500 };
    for (let i = 0; i < participantSeeds.length; i++) {
      const [name, email, phone, institution, country, category, presentingAbstract] = participantSeeds[i];
      const paid = i % 2 === 0;
      const cohort = i % 3 === 0 && conf0Cohort2 ? conf0Cohort2 : conf0Cohort1;
      const reg = await Registration.create({
        name, email, phone, institution, country, category, presentingAbstract,
        eventId: conf0._id.toString(),
        eventType: 'conference',
        eventTitle: conf0.title,
        eventSlug: conf0.slug,
        cohortId: cohort?.cohortId || null,
        paymentStatus: paid ? 'paid' : 'unpaid',
      });
      if (paid) {
        await Order.create({
          orderId: `order_seed_${conf0.eventId}_${i}_${Date.now()}`,
          paymentId: `pay_seed_${conf0.eventId}_${i}`,
          signature: `sig_seed_${conf0.eventId}_${i}`,
          name, email, phone, category,
          amount: CATEGORY_PRICING[category] || 24500,
          currency: 'INR',
          registrationId: reg._id.toString(),
          eventId: conf0._id.toString(),
          eventType: 'conference',
          eventTitle: conf0.title,
          eventSlug: conf0.slug,
          cohortId: cohort?.cohortId || null,
          status: 'paid',
          mode: 'mock',
        });
      }
    }
    console.log(`[Seed] ${participantSeeds.length} participants added`);

    // 8. Summary
    const summary = {
      users: await User.countDocuments(),
      mentors: await MentorProfile.countDocuments(),
      conferences: await Conference.countDocuments(),
      blogs: await Blog.countDocuments(),
      cohorts: await CourseCohort.countDocuments(),
      abstracts: await Abstract.countDocuments(),
      registrations: await Registration.countDocuments(),
      orders: await Order.countDocuments(),
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
