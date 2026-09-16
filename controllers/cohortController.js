import { CourseCohort } from '../models/CourseCohort.js';
import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';
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
  webinar: Webinar,
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
      if (!(await courseExists(courseType, id))) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const yearNum = Number(year);
      if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return res.status(400).json({ error: 'Year must be an integer between 2000 and 2100' });
      }
      const batchNum = batchNo === undefined ? 1 : Number(batchNo);
      if (!Number.isInteger(batchNum) || batchNum < 1) {
        return res.status(400).json({ error: 'Batch number must be a positive integer' });
      }

      const duplicate = await CourseCohort.findOne({ courseType, courseId: id, year: yearNum, batchNo: batchNum });
      if (duplicate) {
        return res.status(409).json({ error: 'A cohort for this year and batch already exists' });
      }

      const existingCount = await CourseCohort.countDocuments({ courseType, courseId: id });
      const cohortId = await buildCohortId(courseType, id, batchNum);
      const willBeCurrent = Boolean(isCurrent) || existingCount === 0;

      let resolvedSubdomain = subdomain ? sanitizeSubdomain(subdomain) : null;

      const cohort = await CourseCohort.create({
        courseType,
        courseId: id,
        cohortId,
        year: yearNum,
        batchNo: batchNum,
        title: title || '',
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
        status: status || 'upcoming',
        isCurrent: false,
        subdomain: resolvedSubdomain || undefined,
        assignedMentor: assignedMentor || null,
        content: content || {},
      });

      if (willBeCurrent) {
        await setCurrentCohort(courseType, id, cohort._id);
        cohort.isCurrent = true;
      }

      res.status(201).json(serializeCohort(cohort));
    } catch (error) {
      console.error('Create cohort error:', error);
      if (error && error.code === 11000) {
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
    if (subdomain !== undefined) cohort.subdomain = subdomain ? sanitizeSubdomain(subdomain) : null;
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
