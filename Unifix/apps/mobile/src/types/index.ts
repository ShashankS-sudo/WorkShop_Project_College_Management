// Mobile Application Type Definitions
export interface Campus {
  id: string;
  name: string;
  code: string;
}

export interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  isAnonymous?: boolean;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  currentStage: string;
  priority: string;
  severity: string;
  isCritical: boolean;
  isAnonymous: boolean;
  stageStartTime?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolutionSummary?: string;
  category?: { id: string; name: string };
  location?: { id: string; name: string; floor?: string; room?: string };
  reporter?: { id?: string; displayName?: string; firstName?: string; lastName?: string };
  _count?: {
    endorsements?: number;
    comments?: number;
  };
  comments?: Comment[];
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  filename: string;
  filepath: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  isInternal?: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  relatedTicketId?: string;
}

export interface AIAnalysisResult {
  suggestedTitle: string;
  suggestedCategory: string;
  suggestedSeverity: string;
  suggestedPriority: string;
  suggestedLocation: string;
  confidence: number;
  followUpQuestions?: string[];
  rawAnalysis?: any;
}
