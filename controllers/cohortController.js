import { CourseCohort } from '../models/CourseCohort.js';
import { Conference } from '../models/Conference.js';
import { getUserContext } from '../middleware/auth.js';
import {
  listCohorts,
  serializeCohort,
  setCurrentCohort,
  promoteLatestCohort,
  buildCohortId,
} from '../services/cohortService.js';
import { sanitizeSubdomain } from '../services/slug.js';

const COURSE_MODEL = {
  conference: Conference,
};

function parseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

async function courseExists(courseType, courseId) {
  const Model = COURSE_MODEL[courseType];
  if (!Model) return false;
  const doc = await Model.findById(courseId);
  return Boolean(doc);
}

export function listCohortsForCourse(courseType) {
  return async (req, res) => {
    const { id } = req.params;
    const { role, username } = getUserContext(req);
    try {
      if (!(await courseExists(courseType, id))) {
        return res.status(404).json({ error: 'Course not found' });
      }
      let cohorts = await listCohorts(courseType, id);
      if (role === 'mentor' && username) {
        cohorts = cohorts.filter(c => c.assignedMentor === username);
      }
      res.json(cohorts);
    } catch (error) {
      console.error('List cohorts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function createCohortForCourse(courseType) {
  return async (req, res) => {
    const { id } = req.params;
    const { year, batchNo, title, startDate, endDate, status, isCurrent, content, subdomain, assignedMentor } = req.body;
    try {
      const Model = COURSE_MODEL[courseType];
      if (!Model) {
        return res.status(404).json({ error: 'Invalid course type' });
      }
      const courseDoc = await Model.findById(id).lean();
      if (!courseDoc) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const startDateParsed = parseDate(startDate);
      const endDateParsed = parseDate(endDate);
      const yearNum = (year !== undefined && year !== null && !isNaN(Number(year)))
        ? Number(year)
        : (startDateParsed ? startDateParsed.getFullYear() : new Date().getFullYear());

      // Determine batchNo for this specific year
      let batchNum = (batchNo !== undefined && batchNo !== null && !isNaN(Number(batchNo)))
        ? Number(batchNo)
        : null;

      if (!batchNum) {
        const highestInYear = await CourseCohort.findOne({ courseType, courseId: id, year: yearNum })
          .sort({ batchNo: -1 })
          .select('batchNo')
          .lean();
        batchNum = (highestInYear && highestInYear.batchNo) ? highestInYear.batchNo + 1 : 1;
      }

      // Ensure (year, batchNo) and cohortId are both unique
      let existsYearBatch = await CourseCohort.findOne({ courseType, courseId: id, year: yearNum, batchNo: batchNum });
      let candidateId = await buildCohortId(courseType, id, batchNum);
      let existsCohortId = candidateId ? await CourseCohort.findOne({ cohortId: candidateId }) : null;

      while (existsYearBatch || existsCohortId) {
        batchNum++;
        existsYearBatch = await CourseCohort.findOne({ courseType, courseId: id, year: yearNum, batchNo: batchNum });
        candidateId = await buildCohortId(courseType, id, batchNum);
        existsCohortId = candidateId ? await CourseCohort.findOne({ cohortId: candidateId }) : null;
      }

      const cohortId = candidateId;
      const existingCount = await CourseCohort.countDocuments({ courseType, courseId: id });
      const willBeCurrent = Boolean(isCurrent) || existingCount === 0;

      let resolvedSubdomain = subdomain ? sanitizeSubdomain(subdomain) : null;
      if (resolvedSubdomain) {
        const parentSubdomain = courseDoc.subdomain || null;
        if (parentSubdomain && resolvedSubdomain.toLowerCase() === parentSubdomain.toLowerCase()) {
          resolvedSubdomain = null;
        } else {
          const subExistsConf = await Conference.findOne({ subdomain: resolvedSubdomain, _id: { $ne: id } });
          const subExistsCohort = await CourseCohort.findOne({ subdomain: resolvedSubdomain });
          if (subExistsConf || subExistsCohort) {
            resolvedSubdomain = null;
          }
        }
      }

      const extraContent = content ? { ...content } : {};
      const CONTENT_KEYS = [
        'description', 'theme', 'themeColor', 'location', 'venue', 'venueAddress', 'venueMapUrl',
        'startTime', 'endTime', 'speaker', 'brochureUrl', 'bannerUrl', 'logoUrl', 'subjectImageUrl', 'headerBanners',
        'fees', 'tracks', 'organizerContact', 'socialLinks', 'itinerary', 'speakers', 'program',
        'faqs', 'sponsors', 'exhibitors', 'partners', 'mediaPartners', 'guidelines',
        'scientificProgramUrl', 'termsAndConditions', 'organizingCommittee', 'venueDetails',
        'welcomeBannerTitle', 'welcomeBannerDescription', 'gtmCode', 'gaCode', 'mcCode',
        'metaTitle', 'metaDescription'
      ];
      for (const k of CONTENT_KEYS) {
        if (req.body[k] !== undefined && extraContent[k] === undefined) {
          extraContent[k] = req.body[k];
        }
      }

      const cohort = await CourseCohort.create({
        courseType,
        courseId: id,
        cohortId,
        year: yearNum,
        batchNo: batchNum,
        title: title || '',
        startDate: startDateParsed,
        endDate: endDateParsed,
        status: status || 'upcoming',
        isCurrent: false,
        subdomain: resolvedSubdomain || undefined,
        assignedMentor: assignedMentor || null,
        content: extraContent,
      });

      if (willBeCurrent) {
        await setCurrentCohort(courseType, id, cohort._id);
        cohort.isCurrent = true;
      }

      res.status(201).json(serializeCohort(cohort));
    } catch (error) {
      console.error('Create cohort error:', error);
      if (error && error.code === 11000) {
        const errmsg = String(error.errmsg || error.message || '');
        if (error.keyPattern?.subdomain || errmsg.includes('subdomain')) {
          return res.status(409).json({ error: 'This subdomain is already in use by another event or cohort' });
        }
        return res.status(409).json({ error: 'A cohort for this year and batch already exists' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export async function getCohort(req, res) {
  const { id } = req.params;
  try {
    const cohort = await CourseCohort.findById(id);
    if (!cohort) {
      return res.status(404).json({ error: 'Cohort not found' });
    }
    res.json(serializeCohort(cohort));
  } catch (error) {
    console.error('Get cohort error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateCohort(req, res) {
  const { id } = req.params;
  const { year, batchNo, title, startDate, endDate, status, isCurrent, content, subdomain, assignedMentor } = req.body;
  try {
    const cohort = await CourseCohort.findById(id);
    if (!cohort) {
      return res.status(404).json({ error: 'Cohort not found' });
    }

    if (year !== undefined) {
      const yearNum = Number(year);
      if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return res.status(400).json({ error: 'Year must be an integer between 2000 and 2100' });
      }
      cohort.year = yearNum;
    }
    if (batchNo !== undefined) {
      const batchNum = Number(batchNo);
      if (!Number.isInteger(batchNum) || batchNum < 1) {
        return res.status(400).json({ error: 'Batch number must be a positive integer' });
      }
      cohort.batchNo = batchNum;
    }
    if (title !== undefined) cohort.title = title || '';
    if (startDate !== undefined) cohort.startDate = parseDate(startDate);
    if (endDate !== undefined) cohort.endDate = parseDate(endDate);
    if (status !== undefined) cohort.status = status;
    if (content !== undefined) cohort.content = content || {};
    if (subdomain !== undefined) {
      let resolved = subdomain ? sanitizeSubdomain(subdomain) : null;
      if (resolved) {
        const Model = COURSE_MODEL[cohort.courseType];
        const parentDoc = Model ? await Model.findById(cohort.courseId).select('subdomain').lean() : null;
        if (parentDoc && parentDoc.subdomain && resolved.toLowerCase() === parentDoc.subdomain.toLowerCase()) {
          resolved = null;
        } else {
          const subExistsConf = await Conference.findOne({ subdomain: resolved, _id: { $ne: cohort.courseId } });
          const subExistsCohort = await CourseCohort.findOne({ subdomain: resolved, _id: { $ne: cohort._id } });
          if (subExistsConf || subExistsCohort) {
            resolved = null;
          }
        }
      }
      cohort.subdomain = resolved;
    }
    if (assignedMentor !== undefined) cohort.assignedMentor = assignedMentor || null;

    let becomeCurrent = false;
    if (isCurrent === true) {
      becomeCurrent = true;
    } else if (isCurrent === false) {
      cohort.isCurrent = false;
    }

    await cohort.save();

    if (becomeCurrent) {
      await setCurrentCohort(cohort.courseType, cohort.courseId, cohort._id);
      cohort.isCurrent = true;
    }

    res.json(serializeCohort(cohort));
  } catch (error) {
    console.error('Update cohort error:', error);
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'A cohort for this year and batch already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function setCohortCurrent(req, res) {
  const { id } = req.params;
  try {
    const cohort = await CourseCohort.findById(id);
    if (!cohort) {
      return res.status(404).json({ error: 'Cohort not found' });
    }
    await setCurrentCohort(cohort.courseType, cohort.courseId, cohort._id);
    res.json(serializeCohort(cohort));
  } catch (error) {
    console.error('Set cohort current error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function assignCohortMentor(req, res) {
  const { id } = req.params;
  const { assignedMentor } = req.body;
  try {
    const cohort = await CourseCohort.findById(id);
    if (!cohort) {
      return res.status(404).json({ error: 'Cohort not found' });
    }
    cohort.assignedMentor = assignedMentor || null;
    await cohort.save();
    res.json(serializeCohort(cohort));
  } catch (error) {
    console.error('Assign cohort mentor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteCohort(req, res) {
  const { id } = req.params;
  try {
    const cohort = await CourseCohort.findById(id);
    if (!cohort) {
      return res.status(404).json({ error: 'Cohort not found' });
    }

    const { courseType, courseId, isCurrent } = cohort;
    await CourseCohort.findByIdAndDelete(id);

    if (isCurrent) {
      await promoteLatestCohort(courseType, courseId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete cohort error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
