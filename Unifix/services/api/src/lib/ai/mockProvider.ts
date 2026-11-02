// Mock AI Provider - Unifix (Development Provider)
import { IAIProvider, AIIssueParseResult, CandidateTicket, AISimilarityResult, AIInsightResult } from './aiTypes';

export class MockAIProvider implements IAIProvider {
  readonly name = 'mock-rule-engine-v1';

  async parseIssue(
    text: string,
    context?: { campusName?: string; existingCategories?: string[] }
  ): Promise<AIIssueParseResult> {
    const lower = text.toLowerCase();

    // 1. Category extraction
    let suggestedCategory = 'Custodial & Cleaning';
    if (lower.includes('light') || lower.includes('bulb') || lower.includes('electric') || lower.includes('outlet') || lower.includes('power') || lower.includes('flicker')) {
      suggestedCategory = 'Lighting & Electrical';
    } else if (lower.includes('water') || lower.includes('leak') || lower.includes('pipe') || lower.includes('drain') || lower.includes('flood') || lower.includes('toilet') || lower.includes('sink')) {
      suggestedCategory = 'Plumbing & Water';
    } else if (lower.includes('heat') || lower.includes('cold') || lower.includes('ac') || lower.includes('air') || lower.includes('hvac') || lower.includes('temperature') || lower.includes('freeze')) {
      suggestedCategory = 'HVAC & Temperature';
    } else if (lower.includes('smoke') || lower.includes('fire') || lower.includes('gas') || lower.includes('danger') || lower.includes('spark') || lower.includes('chemical') || lower.includes('odor')) {
      suggestedCategory = 'Safety Hazard & Emergency';
    } else if (lower.includes('wifi') || lower.includes('internet') || lower.includes('network') || lower.includes('router') || lower.includes('ethernet')) {
      suggestedCategory = 'Network & Connectivity';
    } else if (lower.includes('door') || lower.includes('lock') || lower.includes('keycard') || lower.includes('badge') || lower.includes('window')) {
      suggestedCategory = 'Doors, Locks & Access';
    }

    // 2. Severity and Priority estimation
    let suggestedSeverity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL' = 'MODERATE';
    let suggestedImpact: 'INDIVIDUAL' | 'GROUP' | 'BUILDING' | 'CAMPUS' = 'GROUP';
    let suggestedUrgency: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL';
    let suggestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';

    if (suggestedCategory === 'Safety Hazard & Emergency' || lower.includes('emergency') || lower.includes('flood') || lower.includes('danger') || lower.includes('hazard')) {
      suggestedSeverity = 'CRITICAL';
      suggestedImpact = 'BUILDING';
      suggestedUrgency = 'URGENT';
      suggestedPriority = 'CRITICAL';
    } else if (lower.includes('urgent') || lower.includes('broken') || lower.includes('entire') || lower.includes('whole')) {
      suggestedSeverity = 'MAJOR';
      suggestedImpact = 'GROUP';
      suggestedUrgency = 'HIGH';
      suggestedPriority = 'HIGH';
    } else if (lower.includes('minor') || lower.includes('cosmetic') || lower.includes('clean')) {
      suggestedSeverity = 'MINOR';
      suggestedImpact = 'INDIVIDUAL';
      suggestedUrgency = 'LOW';
      suggestedPriority = 'LOW';
    }

    // 3. Location extraction attempt
    let extractedLocation: string | undefined;
    const locationPatterns = [
      /(?:in|at|outside|near|on)\s+((?:room\s+\d+|floor\s+\d+|\d+(?:st|nd|rd|th)\s+floor|[a-z]+\s+(?:hall|building|center|library|lab|commons|dorm|room|corridor|block|cafeteria)))/i,
      /((?:room\s+\d+|\d+(?:st|nd|rd|th)\s+floor|[a-z0-9\s-]+\s+(?:library|building|lab|quad|hall)))/i,
    ];

    for (const pat of locationPatterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        extractedLocation = match[1].trim();
        break;
      }
    }

    // 4. Title generation
    let cleanTitle = text.slice(0, 70).trim();
    if (text.length > 70) {
      const lastSpace = cleanTitle.lastIndexOf(' ');
      if (lastSpace > 30) cleanTitle = cleanTitle.slice(0, lastSpace);
      cleanTitle += '...';
    }

    // 5. Missing information and follow-up questions
    const missingInformation: string[] = [];
    const followUpQuestions: string[] = [];

    if (!extractedLocation) {
      missingInformation.push('Exact room, floor, or building location is not specified');
      followUpQuestions.push('Which building, floor, or room number is this issue located in?');
    }

    if (!lower.includes('since') && !lower.includes('yesterday') && !lower.includes('today') && !lower.includes('morning') && !lower.includes('days')) {
      missingInformation.push('Time of occurrence');
      followUpQuestions.push('How long has this issue been occurring (e.g., just started, since yesterday)?');
    }

    return {
      suggestedTitle: cleanTitle,
      summary: text,
      suggestedCategory,
      extractedLocation,
      suggestedSeverity,
      suggestedImpact,
      suggestedUrgency,
      suggestedPriority,
      missingInformation,
      followUpQuestions,
      confidence: 0.85,
      modelUsed: this.name,
      isAiSuggestion: true,
    };
  }

  async findSimilarTickets(
    newIssue: { title?: string; text: string; location?: string },
    candidates: CandidateTicket[]
  ): Promise<AISimilarityResult> {
    const query = `${newIssue.title || ''} ${newIssue.text} ${newIssue.location || ''}`.toLowerCase();
    const queryWords = new Set(query.split(/\W+/).filter((w) => w.length > 3));

    const scoredMatches: Array<{
      ticketId: string;
      title: string;
      similarityScore: number;
      explanation: string;
    }> = [];

    for (const cand of candidates) {
      const candText = `${cand.title} ${cand.description} ${cand.locationText || ''}`.toLowerCase();
      const candWords = candText.split(/\W+/).filter((w) => w.length > 3);

      let sharedCount = 0;
      for (const w of candWords) {
        if (queryWords.has(w)) sharedCount++;
      }

      if (candWords.length === 0) continue;
      const score = Math.min(1.0, (sharedCount * 2) / (queryWords.size + candWords.length));

      if (score >= 0.25) {
        scoredMatches.push({
          ticketId: cand.id,
          title: cand.title,
          similarityScore: Math.round(score * 100) / 100,
          explanation: `Shares relevant keywords regarding ${cand.categoryName || 'facility issue'} around ${cand.locationText || 'campus'}.`,
        });
      }
    }

    scoredMatches.sort((a, b) => b.similarityScore - a.similarityScore);

    return {
      matches: scoredMatches.slice(0, 5),
      summary: scoredMatches.length > 0
        ? `Identified ${scoredMatches.length} potentially similar active tickets on this campus.`
        : 'No similar active tickets detected.',
      modelUsed: this.name,
    };
  }

  async generateInsights(aggregatedStats: any): Promise<AIInsightResult[]> {
    const timestamp = new Date().toISOString();
    return [
      {
        title: 'Electrical & Lighting Recurring Backlog',
        observedFacts: [
          'Lighting & Electrical represents 38% of all reported issues across campuses.',
          'Average resolution time for electrical ballast/fixture replacements exceeds 96 hours.',
        ],
        recommendations: [
          'Standardize campus LED retrofit kits in local stock to reduce vendor order delay.',
          'Schedule proactive quarterly corridor fixture inspections.',
        ],
        affectedCampuses: ['Pacific Science & Tech Campus'],
        confidence: 0.9,
        generatedAt: timestamp,
        modelUsed: this.name,
      },
      {
        title: 'Stage Escalation Bottleneck at Triage',
        observedFacts: [
          '15% of new tickets remain in REPORTED stage for over 48 hours without management acknowledgement.',
        ],
        recommendations: [
          'Designate secondary triage managers during peak morning arrival hours.',
          'Configure automated notification reminders at the 24-hour mark.',
        ],
        affectedCampuses: ['Pacific Science & Tech Campus', 'Metropolitan Arts & Design Institute'],
        confidence: 0.88,
        generatedAt: timestamp,
        modelUsed: this.name,
      },
    ];
  }
}
