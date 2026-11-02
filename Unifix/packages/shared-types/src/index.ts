// Shared type definitions for Unifix
// These are the base types shared across the entire application

/** 
 * Base entity with ID and timestamps
 */
export interface BaseEntity {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** 
 * Campus represents a physical campus location
 * Each campus is a security boundary
 */
export interface Campus extends BaseEntity {
  name: string;
  code: string; // Unique campus code (e.g., "PSTC", "MADI")
  isActive: boolean;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
}

/**
 * Campus Authorized Identity represents pre-approved identities eligible to register on a campus
 */
export interface CampusAuthorizedIdentity extends BaseEntity {
  campusId: string;
  email?: string | null;
  phone?: string | null;
  displayName: string;
  externalId?: string | null;
  role: 'REPORTER' | 'MANAGEMENT' | 'SUPERMANAGEMENT';
  department?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
}

/**
 * Department within a campus
 */
export interface Department extends BaseEntity {
  campusId: string;
  name: string;
  code?: string | null;
  isActive: boolean;
}

/**
 * Physical building within a campus
 */
export interface Building extends BaseEntity {
  campusId: string;
  name: string;
  code?: string | null;
  isActive: boolean;
}

/**
 * Specific location within a building/campus
 */
export interface Location extends BaseEntity {
  campusId: string;
  buildingId?: string | null;
  name: string;
  floor?: string | null;
  room?: string | null;
  description?: string | null;
  isActive: boolean;
}

/**
 * Issue category
 */
export interface Category extends BaseEntity {
  campusId?: string | null; // null means global
  name: string;
  description?: string | null;
  icon?: string | null;
  defaultPriority: TicketPriority;
  isActive: boolean;
}

/** 
 * User represents an authenticated individual
 * Can be anonymous reporter or authorized campus user
 */
export interface User extends BaseEntity {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  isAnonymous: boolean;
  emailVerified?: Date | string | null;
  phoneVerified?: Date | string | null;
  lastLogin?: Date | string | null;
}

/** 
 * CampusMembership links users to campuses
 * Defines what roles a user has at a campus
 */
export interface CampusMembership extends BaseEntity {
  userId: string;
  campusId: string;
  role: 'REPORTER' | 'MANAGEMENT' | 'SUPERMANAGEMENT';
  isActive: boolean;
}

/** 
 * RefreshSession tracks server-side refresh tokens for rotation & revocation
 */
export interface RefreshSession extends BaseEntity {
  userId: string;
  tokenHash: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  isRevoked: boolean;
  expiresAt: Date | string;
}

/** 
 * Ticket status in lifecycle
 */
export type TicketStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED'
  | 'DUPLICATE';

/** 
 * Ticket progress stage for 3-week escalation clock
 */
export type ProgressStage =
  | 'REPORTED'
  | 'ACKNOWLEDGED'
  | 'ACTIVE'
  | 'RESOLVING'
  | 'COMPLETED';

/** 
 * Ticket priority level
 */
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Severity level
 */
export type TicketSeverity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL';

/**
 * Impact level
 */
export type TicketImpact = 'INDIVIDUAL' | 'GROUP' | 'BUILDING' | 'CAMPUS';

/**
 * Urgency level
 */
export type TicketUrgency = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

/**
 * Ticket type
 */
export type TicketType = 'ISSUE' | 'SERVICE_REQUEST';

/** 
 * Ticket represents a reported issue or service request
 */
export interface Ticket extends BaseEntity {
  campusId: string;
  reporterId?: string | null;
  assigneeId?: string | null;
  departmentId?: string | null;
  categoryId?: string | null;
  locationId?: string | null;
  ticketType: TicketType;
  title: string;
  description: string;
  locationText?: string | null;
  severity: TicketSeverity;
  impact: TicketImpact;
  urgency: TicketUrgency;
  suggestedPriority: TicketPriority;
  priority: TicketPriority;
  status: TicketStatus;
  isCritical: boolean;
  isAnonymous: boolean;
  duplicateOfId?: string | null;
  escalationCount: number;
  currentStage: ProgressStage;
  stageStartTime: Date | string;
  stageDuration: number; // in hours (default 504 = 21 days)
  lastProgressAt: Date | string;
  acknowledgedAt?: Date | string | null;
  startedAt?: Date | string | null;
  waitingReason?: string | null;
  resolvedAt?: Date | string | null;
  resolutionSummary?: string | null;
  closedAt?: Date | string | null;
  reopenCount: number;
  reopenedAt?: Date | string | null;
  reopenReason?: string | null;
}

/**
 * Ticket assignment record
 */
export interface TicketAssignment {
  id: string;
  ticketId: string;
  assignedById: string;
  assigneeId?: string | null;
  departmentId?: string | null;
  notes?: string | null;
  createdAt: Date | string;
}

/** 
 * Comment on a ticket
 */
export interface Comment extends BaseEntity {
  ticketId: string;
  userId: string;
  content: string;
  isInternal: boolean; // Only visible to management
  authorName: string;
}

/** 
 * Attachment file metadata
 */
export interface Attachment extends BaseEntity {
  ticketId: string;
  userId: string;
  filename: string;
  filepath: string; // Supabase Storage path
  mimeType: string;
  size: number;
  isApproved: boolean;
  uploadedBy: string;
}

/** 
 * Ticket endorsement ("I have this issue too")
 */
export interface Endorsement {
  id: string;
  ticketId: string;
  endorserId: string;
  createdAt: Date | string;
}

/** 
 * Status history for audit trail
 */
export interface StatusHistory {
  id: string;
  ticketId: string;
  status: TicketStatus;
  previousStatus?: TicketStatus | null;
  changedById: string;
  notes?: string | null;
  createdAt: Date | string;
}

/**
 * Priority history for audit trail
 */
export interface PriorityHistory {
  id: string;
  ticketId: string;
  priority: TicketPriority;
  previousPriority?: TicketPriority | null;
  changedById: string;
  reason: string;
  createdAt: Date | string;
}

/**
 * Meaningful progress event that affects or tracks the 3-week lifecycle
 */
export interface TicketProgressEvent {
  id: string;
  ticketId: string;
  eventType: 
    | 'ACKNOWLEDGEMENT'
    | 'ASSIGNMENT'
    | 'INVESTIGATION_UPDATE'
    | 'MAINTENANCE_ACTION'
    | 'WAITING_STATE'
    | 'RESOLUTION_ATTEMPT';
  title: string;
  details: string;
  actorId: string;
  resetsStageTimer: boolean;
  createdAt: Date | string;
}

/** 
 * Escalation event record
 */
export interface EscalationEvent extends BaseEntity {
  ticketId: string;
  stage: ProgressStage;
  previousStage: ProgressStage;
  triggeredAt: Date | string;
  resolvedAt?: Date | string | null;
  duration: number; // in hours
  manualOverride: boolean;
  notifiedIds: string[];
}

/** 
 * Notification for users
 */
export interface Notification extends BaseEntity {
  userId: string;
  title: string;
  message: string;
  type: 
    | 'TICKET_CREATED'
    | 'TICKET_ACKNOWLEDGED'
    | 'TICKET_ASSIGNED'
    | 'TICKET_STATUS_CHANGE'
    | 'TICKET_PROGRESS_UPDATED'
    | 'TICKET_ESCALATED'
    | 'TICKET_RESOLVED'
    | 'TICKET_CLOSED'
    | 'TICKET_REOPENED'
    | 'COMMENT_ADDED'
    | 'STAGE_OVERDUE'
    | 'SYSTEM_ALERT';
  isRead: boolean;
  readAt?: Date | string | null;
  metadata?: Record<string, unknown> | null;
  relatedTicketId?: string | null;
  idempotencyKey?: string | null;
}

/**
 * Platform Audit Log
 */
export interface AuditLog {
  id: string;
  campusId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date | string;
}

/** 
 * AI analysis record
 */
export interface AIAnalysis extends BaseEntity {
  ticketId?: string | null;
  campusId?: string | null;
  userId?: string | null;
  analysisType: 'ISSUE_PARSING' | 'SIMILARITY' | 'INSIGHT';
  suggestedTitle?: string | null;
  suggestedCategory?: string | null;
  suggestedPriority?: TicketPriority | null;
  suggestedLocation?: string | null;
  similarTickets: string[];
  confidence?: number | null;
  modelUsed: string;
  tokensUsed?: number | null;
  durationMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  rawOutput?: string | null;
  parsedOutput?: Record<string, unknown> | null;
}

/** 
 * Database connection configuration
 */
export interface DatabaseConfig {
  url: string;
  directUrl?: string;
  poolTimeout?: number;
  maxPoolSize?: number;
  minPoolSize?: number;
  idleTimeout?: number;
  acquireTimeout?: number;
}

/** 
 * Authentication token payload
 */
export interface TokenPayload {
  userId: string;
  campusIds: string[];
  roles: CampusMembership['role'][];
  isAnonymous: boolean;
  iat?: number;
  exp?: number;
}

/** 
 * API error response
 */
export interface ApiError {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

/** 
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  metadata: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}


/**
 * Real-time socket event definitions
 */
export enum SocketEvent {
  // Ticket events
  TICKET_CREATED = 'ticket:created',
  TICKET_UPDATED = 'ticket:updated',
  TICKET_ENDORSED = 'ticket:endorsed',
  TICKET_ESCALATED = 'ticket:escalated',

  // Discussion & progress events
  COMMENT_ADDED = 'comment:added',
  PROGRESS_RECORDED = 'progress:recorded',

  // Notification events
  NOTIFICATION_NEW = 'notification:new',

  // Room management
  JOIN_ROOM = 'room:join',
  LEAVE_ROOM = 'room:leave',
}

export interface SocketTicketEventPayload {
  campusId: string;
  ticketId: string;
  ticket?: Partial<Ticket>;
  action?: string;
  timestamp: string;
}

export interface SocketCommentEventPayload {
  ticketId: string;
  comment: Comment;
  timestamp: string;
}

export interface SocketProgressEventPayload {
  ticketId: string;
  progressEvent: TicketProgressEvent;
  timestamp: string;
}

export interface SocketNotificationEventPayload {
  userId: string;
  notification: Notification;
  timestamp: string;
}
