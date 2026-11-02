// API Routes - Unifix v1
import express from 'express';
import { authenticate, authorize } from './middleware/auth';
import { validateBody } from './middleware/validate';
import {
  requestOTPSchema,
  verifyOTPSchema,
  refreshTokenSchema,
  createCampusSchema,
  createTicketSchema,
  acknowledgeTicketSchema,
  assignTicketSchema,
  recordProgressSchema,
  overridePrioritySchema,
  resolveTicketSchema,
  reopenTicketSchema,
  markDuplicateSchema,
  createCommentSchema,
  uploadAttachmentSchema,
  aiParseRequestSchema,
  aiSimilarityRequestSchema,
} from '@unifix/shared-schemas';
import * as authController from './controllers/authController';
import * as campusController from './controllers/campusController';
import * as ticketController from './controllers/ticketController';
import * as aiController from './controllers/aiController';
import * as managementController from './controllers/managementController';
import * as notificationController from './controllers/notificationController';
import * as attachmentController from './controllers/attachmentController';
import { runEscalationCheck } from './lib/escalationEngine';

const router = express.Router();

// ==========================================
// 1. Operational Endpoints
// ==========================================
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'unifix-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.post(
  '/operational/escalation-check',
  authenticate,
  authorize(['SUPERMANAGEMENT', 'MANAGEMENT']),
  async (req, res) => {
    try {
      const result = await runEscalationCheck();
      res.json({ data: result });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to run escalation check', details: err.message });
    }
  }
);

// ==========================================
// 2. Authentication & Onboarding
// ==========================================
router.post('/auth/request-otp', validateBody(requestOTPSchema), authController.requestOTP);
router.post('/auth/verify-otp', validateBody(verifyOTPSchema), authController.verifyOTP);
router.post('/auth/refresh', validateBody(refreshTokenSchema), authController.refreshToken);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', authenticate, authController.getCurrentUser);

// ==========================================
// 3. Campus Registry
// ==========================================
router.get('/campuses', campusController.listCampuses);
router.get('/campuses/:campusId', campusController.getCampusDetails);
router.post('/campuses/:campusId/check-eligibility', campusController.checkEligibility);
router.post(
  '/campuses',
  authenticate,
  authorize(['SUPERMANAGEMENT']),
  validateBody(createCampusSchema),
  campusController.createCampus
);

// ==========================================
// 4. Ticket System (Campus Boundary Enforced)
// ==========================================
router.get('/tickets', authenticate, ticketController.listTickets);
router.post('/tickets', authenticate, validateBody(createTicketSchema), ticketController.createTicket);
router.get('/tickets/:ticketId', authenticate, ticketController.getTicketDetails);
router.post('/tickets/:ticketId/endorse', authenticate, ticketController.endorseTicket);
router.post(
  '/tickets/:ticketId/comments',
  authenticate,
  validateBody(createCommentSchema),
  ticketController.addComment
);
router.post(
  '/tickets/:ticketId/reopen',
  authenticate,
  validateBody(reopenTicketSchema),
  ticketController.reopenTicket
);

// Ticket Attachments & Media
router.post(
  '/tickets/attachments/upload',
  authenticate,
  attachmentController.uploadMiddleware,
  attachmentController.uploadAttachment
);
router.post(
  '/tickets/attachments/presign',
  authenticate,
  attachmentController.getPresignedUploadUrl
);
router.get(
  '/tickets/:ticketId/attachments',
  authenticate,
  attachmentController.listTicketAttachments
);
router.post(
  '/tickets/:ticketId/attachments',
  authenticate,
  validateBody(uploadAttachmentSchema),
  attachmentController.attachToTicket
);
router.delete(
  '/tickets/:ticketId/attachments/:attachmentId',
  authenticate,
  attachmentController.deleteAttachment
);

// Management Ticket Operations
router.post(
  '/tickets/:ticketId/acknowledge',
  authenticate,
  authorize(['MANAGEMENT', 'SUPERMANAGEMENT']),
  validateBody(acknowledgeTicketSchema),
  ticketController.acknowledgeTicket
);
router.post(
  '/tickets/:ticketId/assign',
  authenticate,
  authorize(['MANAGEMENT', 'SUPERMANAGEMENT']),
  validateBody(assignTicketSchema),
  ticketController.assignTicket
);
router.post(
  '/tickets/:ticketId/progress',
  authenticate,
  authorize(['MANAGEMENT', 'SUPERMANAGEMENT']),
  validateBody(recordProgressSchema),
  ticketController.recordProgress
);
router.post(
  '/tickets/:ticketId/priority',
  authenticate,
  authorize(['MANAGEMENT', 'SUPERMANAGEMENT']),
  validateBody(overridePrioritySchema),
  ticketController.overridePriority
);
router.post(
  '/tickets/:ticketId/resolve',
  authenticate,
  authorize(['MANAGEMENT', 'SUPERMANAGEMENT']),
  validateBody(resolveTicketSchema),
  ticketController.resolveTicket
);
router.post(
  '/tickets/:ticketId/duplicate',
  authenticate,
  authorize(['MANAGEMENT', 'SUPERMANAGEMENT']),
  validateBody(markDuplicateSchema),
  ticketController.markDuplicate
);

// ==========================================
// 5. AI Intelligence Endpoints
// ==========================================
router.post(
  '/ai/parse',
  authenticate,
  validateBody(aiParseRequestSchema),
  aiController.parseIssueDescription
);
router.post(
  '/ai/similarity',
  authenticate,
  validateBody(aiSimilarityRequestSchema),
  aiController.checkSimilarity
);
router.get(
  '/ai/insights',
  authenticate,
  authorize(['MANAGEMENT', 'SUPERMANAGEMENT']),
  aiController.getManagementInsights
);

// ==========================================
// 6. Management & Supermanagement Dashboards
// ==========================================
router.get(
  '/management/campuses/:campusId/stats',
  authenticate,
  authorize(['MANAGEMENT', 'SUPERMANAGEMENT']),
  managementController.getCampusDashboardStats
);
router.get(
  '/management/global-overview',
  authenticate,
  authorize(['SUPERMANAGEMENT']),
  managementController.getGlobalOverview
);

// ==========================================
// 7. In-App Notifications
// ==========================================
router.get('/notifications', authenticate, notificationController.listNotifications);
router.patch('/notifications/:notificationId/read', authenticate, notificationController.markAsRead);
router.post('/notifications/read-all', authenticate, notificationController.markAllAsRead);

export default router;
