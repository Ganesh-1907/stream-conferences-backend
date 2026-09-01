import { Router } from 'express';
import {
  getOrCreateSession,
  getVisitorHistory,
  listSessions,
  getMessages,
  sendAdminMessage,
  markRead,
  setSessionStatus
} from '../controllers/chatController.js';

const router = Router();

// Public: the visitor widget creates/fetches its session
router.post('/session', getOrCreateSession);
router.get('/visitor/:visitorId/history', getVisitorHistory);

// Team members (admin/mentor) access these
router.get('/sessions', listSessions);
router.get('/sessions/:sessionId/messages', getMessages);
router.post('/sessions/:sessionId/messages', sendAdminMessage);
router.post('/sessions/:sessionId/read', markRead);
router.post('/sessions/:sessionId/status', setSessionStatus);

export default router;
