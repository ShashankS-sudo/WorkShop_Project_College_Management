// AI Provider Interfaces and Types - Unifix

export interface AIIssueParseResult {
  suggestedTitle: string;
  summary: string;
  suggestedCategory?: string;
  extractedLocation?: string;
  suggestedSeverity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL';
  suggestedImpact: 'INDIVIDUAL' | 'GROUP' | 'BUILDING' | 'CAMPUS';
  suggestedUrgency: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  suggestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  missingInformation: string[];
  followUpQuestions: string[];
  confidence: number;
  modelUsed: string;
  isAiSuggestion: true;
}

export interface CandidateTicket {
  id: string;
  title: string;
  description: string;
  locationText?: string | null;
  categoryName?: string | null;
  status: string;
}

export interface AISimilarityResult {
  matches: Array<{
    ticketId: string;
    title: string;
    similarityScore: number; // 0.0 to 1.0
    explanation: string;
  }>;
  summary: string;
  modelUsed: string;
}

export interface AIInsightResult {
  title: string;
  observedFacts: string[];
  recommendations: string[];
  affectedCampuses: string[];
  confidence: number;
  generatedAt: string;
  modelUsed: string;
}

export interface IAIProvider {
  readonly name: string;
  parseIssue(
    text: string,
    context?: { campusName?: string; existingCategories?: string[] }
  ): Promise<AIIssueParseResult>;

  findSimilarTickets(
    newIssue: { title?: string; text: string; location?: string },
    candidates: CandidateTicket[]
  ): Promise<AISimilarityResult>;

  generateInsights(aggregatedStats: any): Promise<AIInsightResult[]>;
}
