import { Router } from 'express';
import {
  getOrCreateSession,
  getVisitorHistory,
  sendVisitorMessage,
  listSessions,
  getMessages,
  sendAdminMessage,
  markRead,
  setSessionStatus
} from '../controllers/chatController.js';

const router = Router();

// Public: the visitor widget creates/fetches its session and sends messages
router.post('/session', getOrCreateSession);
router.get('/visitor/:visitorId/history', getVisitorHistory);
router.post('/visitor/message', sendVisitorMessage);

// Team members (admin/mentor) access these
router.get('/sessions', listSessions);
router.get('/sessions/:sessionId/messages', getMessages);
router.post('/sessions/:sessionId/messages', sendAdminMessage);
router.post('/sessions/:sessionId/read', markRead);
router.post('/sessions/:sessionId/status', setSessionStatus);

export default router;
