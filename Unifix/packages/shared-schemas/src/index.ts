// Shared Zod validation schemas for Unifix
// These schemas validate API requests and responses

import { z } from 'zod';

export const baseSchema = z.object({
  id: z.string(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

// ========== CAMPUS SCHEMAS ==========

/** Schema for creating a new campus */
export const createCampusSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(10).toUpperCase(),
  isActive: z.boolean().default(true),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timezone: z.string().default('UTC').optional(),
});

/** Schema for updating campus */
export const updateCampusSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timezone: z.string().optional(),
});

/** Campus response schema */
export const campusSchema = baseSchema.extend({
  name: z.string(),
  code: z.string(),
  isActive: z.boolean(),
  address: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  timezone: z.string().nullable().optional(),
});

// ========== AUTHORIZED IDENTITY SCHEMAS ==========

export const campusMembershipRoleSchema = z.enum([
  'REPORTER',
  'MANAGEMENT',
  'SUPERMANAGEMENT',
]);

export const createAuthorizedIdentitySchema = z.object({
  campusId: z.string().uuid(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  displayName: z.string().min(2).max(100),
  externalId: z.string().optional(),
  role: campusMembershipRoleSchema.default('REPORTER'),
  department: z.string().optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export const authorizedIdentitySchema = baseSchema.extend({
  campusId: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  displayName: z.string(),
  externalId: z.string().nullable().optional(),
  role: campusMembershipRoleSchema,
  department: z.string().nullable().optional(),
  isActive: z.boolean(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

// ========== DEPARTMENT & LOCATION SCHEMAS ==========

export const createDepartmentSchema = z.object({
  campusId: z.string().uuid(),
  name: z.string().min(2).max(100),
  code: z.string().max(20).optional(),
  isActive: z.boolean().default(true),
});

export const createBuildingSchema = z.object({
  campusId: z.string().uuid(),
  name: z.string().min(2).max(100),
  code: z.string().max(20).optional(),
  isActive: z.boolean().default(true),
});

export const createLocationSchema = z.object({
  campusId: z.string().uuid(),
  buildingId: z.string().uuid().optional(),
  name: z.string().min(2).max(100),
  floor: z.string().optional(),
  room: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const createCategorySchema = z.object({
  campusId: z.string().uuid().optional(),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  defaultPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  isActive: z.boolean().default(true),
});

// ========== USER SCHEMAS ==========

/** Schema for creating an anonymous user */
export const createAnonymousUserSchema = z.object({
  isAnonymous: z.literal(true),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  campusId: z.string().uuid(),
});

/** Schema for creating an authenticated user */
export const createAuthenticatedUserSchema = z.object({
  isAnonymous: z.literal(false),
  email: z.string().email(),
  phone: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  campusId: z.string().uuid(),
});

/** Schema for updating user profile */
export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
});

/** User response schema */
export const userSchema = baseSchema.extend({
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  isActive: z.boolean(),
  isAnonymous: z.boolean(),
  emailVerified: z.union([z.date(), z.string()]).nullable().optional(),
  phoneVerified: z.union([z.date(), z.string()]).nullable().optional(),
  lastLogin: z.union([z.date(), z.string()]).nullable().optional(),
});

// ========== CAMPUS MEMBERSHIP SCHEMAS ==========

export const createCampusMembershipSchema = z.object({
  userId: z.string().uuid(),
  campusId: z.string().uuid(),
  role: campusMembershipRoleSchema,
  isActive: z.boolean().default(true),
});

export const campusMembershipSchema = baseSchema.extend({
  userId: z.string(),
  campusId: z.string(),
  role: campusMembershipRoleSchema,
  isActive: z.boolean(),
});

// ========== TICKET SCHEMAS ==========

export const ticketStatusSchema = z.enum([
  'OPEN',
  'ACKNOWLEDGED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'DUPLICATE',
]);

export const progressStageSchema = z.enum([
  'REPORTED',
  'ACKNOWLEDGED',
  'ACTIVE',
  'RESOLVING',
  'COMPLETED',
]);

export const ticketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const ticketSeveritySchema = z.enum(['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL']);
export const ticketImpactSchema = z.enum(['INDIVIDUAL', 'GROUP', 'BUILDING', 'CAMPUS']);
export const ticketUrgencySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const ticketTypeSchema = z.enum(['ISSUE', 'SERVICE_REQUEST']);

/** Schema for creating a new ticket (Report) */
export const createTicketSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  campusId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  locationText: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  ticketType: ticketTypeSchema.default('ISSUE'),
  severity: ticketSeveritySchema.default('MODERATE'),
  impact: ticketImpactSchema.default('INDIVIDUAL'),
  urgency: ticketUrgencySchema.default('NORMAL'),
  isCritical: z.boolean().default(false),
  isAnonymous: z.boolean().default(false),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        filepath: z.string(),
        mimeType: z.string(),
        size: z.number(),
      })
    )
    .optional(),
});

/** Schema for updating ticket */
export const updateTicketSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  locationText: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  severity: ticketSeveritySchema.optional(),
  impact: ticketImpactSchema.optional(),
  urgency: ticketUrgencySchema.optional(),
  priority: ticketPrioritySchema.optional(),
  status: ticketStatusSchema.optional(),
  isCritical: z.boolean().optional(),
});

/** Schema for acknowledging a ticket */
export const acknowledgeTicketSchema = z.object({
  notes: z.string().optional(),
  priority: ticketPrioritySchema.optional(),
});

/** Schema for assigning a ticket */
export const assignTicketSchema = z.object({
  assigneeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

/** Schema for recording progress */
export const recordProgressSchema = z.object({
  eventType: z.enum([
    'ACKNOWLEDGEMENT',
    'ASSIGNMENT',
    'INVESTIGATION_UPDATE',
    'MAINTENANCE_ACTION',
    'WAITING_STATE',
    'RESOLUTION_ATTEMPT',
  ]),
  title: z.string().min(3).max(100),
  details: z.string().min(5).max(2000),
  resetsStageTimer: z.boolean().default(false),
});

/** Schema for overriding priority */
export const overridePrioritySchema = z.object({
  priority: ticketPrioritySchema,
  reason: z.string().min(5).max(500),
});

/** Schema for marking as duplicate */
export const markDuplicateSchema = z.object({
  canonicalTicketId: z.string().uuid(),
  reason: z.string().optional(),
});

/** Schema for resolving a ticket */
export const resolveTicketSchema = z.object({
  resolutionSummary: z.string().min(10).max(2000),
});

/** Schema for closing a ticket */
export const closeTicketSchema = z.object({
  notes: z.string().optional(),
});

/** Schema for reopening a ticket */
export const reopenTicketSchema = z.object({
  reason: z.string().min(10).max(1000),
});

/** Ticket response schema */
export const ticketSchema = baseSchema.extend({
  campusId: z.string(),
  reporterId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  locationId: z.string().nullable().optional(),
  ticketType: ticketTypeSchema,
  title: z.string(),
  description: z.string(),
  locationText: z.string().nullable().optional(),
  severity: ticketSeveritySchema,
  impact: ticketImpactSchema,
  urgency: ticketUrgencySchema,
  suggestedPriority: ticketPrioritySchema,
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  isCritical: z.boolean(),
  isAnonymous: z.boolean(),
  duplicateOfId: z.string().nullable().optional(),
  escalationCount: z.number(),
  currentStage: progressStageSchema,
  stageStartTime: z.union([z.date(), z.string()]),
  stageDuration: z.number(),
  lastProgressAt: z.union([z.date(), z.string()]),
  acknowledgedAt: z.union([z.date(), z.string()]).nullable().optional(),
  startedAt: z.union([z.date(), z.string()]).nullable().optional(),
  waitingReason: z.string().nullable().optional(),
  resolvedAt: z.union([z.date(), z.string()]).nullable().optional(),
  resolutionSummary: z.string().nullable().optional(),
  closedAt: z.union([z.date(), z.string()]).nullable().optional(),
  reopenCount: z.number(),
  reopenedAt: z.union([z.date(), z.string()]).nullable().optional(),
  reopenReason: z.string().nullable().optional(),
});

// ========== COMMENT SCHEMAS ==========

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  isInternal: z.boolean().default(false),
});

export const commentSchema = baseSchema.extend({
  ticketId: z.string(),
  userId: z.string(),
  content: z.string(),
  isInternal: z.boolean(),
  authorName: z.string(),
});

// ========== ATTACHMENT SCHEMAS ==========

export const uploadAttachmentSchema = z.object({
  filename: z.string(),
  filepath: z.string(),
  mimeType: z.string(),
  size: z.number().positive(),
});

export const attachmentSchema = baseSchema.extend({
  ticketId: z.string(),
  userId: z.string(),
  filename: z.string(),
  filepath: z.string(),
  mimeType: z.string(),
  size: z.number(),
  isApproved: z.boolean(),
  uploadedBy: z.string(),
});

// ========== ENDORSEMENT SCHEMAS ==========

export const endorsementSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  endorserId: z.string(),
  createdAt: z.union([z.date(), z.string()]),
});

// ========== PROGRESS EVENT SCHEMAS ==========

export const progressEventSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  eventType: z.string(),
  title: z.string(),
  details: z.string(),
  actorId: z.string(),
  resetsStageTimer: z.boolean(),
  createdAt: z.union([z.date(), z.string()]),
});

// ========== NOTIFICATION SCHEMAS ==========

export const notificationTypeSchema = z.enum([
  'TICKET_CREATED',
  'TICKET_ACKNOWLEDGED',
  'TICKET_ASSIGNED',
  'TICKET_STATUS_CHANGE',
  'TICKET_PROGRESS_UPDATED',
  'TICKET_ESCALATED',
  'TICKET_RESOLVED',
  'TICKET_CLOSED',
  'TICKET_REOPENED',
  'COMMENT_ADDED',
  'STAGE_OVERDUE',
  'SYSTEM_ALERT',
]);

export const notificationSchema = baseSchema.extend({
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  type: notificationTypeSchema,
  isRead: z.boolean(),
  readAt: z.union([z.date(), z.string()]).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  relatedTicketId: z.string().nullable().optional(),
});

// ========== AUTHENTICATION SCHEMAS ==========

export const requestOTPSchema = z.object({
  identifier: z.string().min(3), // phone or email
  campusId: z.string().uuid(),
  isAnonymous: z.boolean().default(false),
});

export const verifyOTPSchema = z.object({
  identifier: z.string().min(3),
  code: z.string().length(6),
  campusId: z.string().uuid(),
  isAnonymous: z.boolean().default(false),
  displayName: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

// ========== AI SCHEMAS ==========

export const aiParseRequestSchema = z.object({
  campusId: z.string().uuid(),
  text: z.string().min(5).max(3000),
});

export const aiFollowUpRequestSchema = z.object({
  originalText: z.string(),
  question: z.string(),
  answer: z.string(),
});

export const aiSimilarityRequestSchema = z.object({
  campusId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().min(5),
  location: z.string().optional(),
});

// ========== PAGINATION & COMMON ==========

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const apiResponseSchema = z.object({
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ========== INFERRED TYPES ==========

export type CreateCampus = z.infer<typeof createCampusSchema>;
export type UpdateCampus = z.infer<typeof updateCampusSchema>;
export type Campus = z.infer<typeof campusSchema>;

export type CreateAuthorizedIdentity = z.infer<typeof createAuthorizedIdentitySchema>;
export type AuthorizedIdentity = z.infer<typeof authorizedIdentitySchema>;

export type CreateDepartment = z.infer<typeof createDepartmentSchema>;
export type CreateBuilding = z.infer<typeof createBuildingSchema>;
export type CreateLocation = z.infer<typeof createLocationSchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;

export type CreateTicket = z.infer<typeof createTicketSchema>;
export type UpdateTicket = z.infer<typeof updateTicketSchema>;
export type Ticket = z.infer<typeof ticketSchema>;

export type CreateComment = z.infer<typeof createCommentSchema>;
export type Comment = z.infer<typeof commentSchema>;

export type RequestOTP = z.infer<typeof requestOTPSchema>;
export type VerifyOTP = z.infer<typeof verifyOTPSchema>;
export type RefreshToken = z.infer<typeof refreshTokenSchema>;
