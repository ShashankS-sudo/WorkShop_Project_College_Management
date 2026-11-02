// OpenAI-Compatible AI Provider - Unifix
import { IAIProvider, AIIssueParseResult, CandidateTicket, AISimilarityResult, AIInsightResult } from './aiTypes';
import { MockAIProvider } from './mockProvider';
import logger from '../logger';

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class OpenAICompatibleProvider implements IAIProvider {
  readonly name: string;
  private readonly config: OpenAICompatibleConfig;
  private readonly fallback: MockAIProvider;

  constructor(config: OpenAICompatibleConfig) {
    this.config = {
      timeoutMs: 30000,
      maxRetries: 1,
      ...config,
    };
    this.name = `openai-compatible (${config.model || 'default'})`;
    this.fallback = new MockAIProvider();
  }

  private async callChatCompletion(messages: Array<{ role: string; content: string }>): Promise<string> {
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI inference endpoint returned ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return json.choices?.[0]?.message?.content || '{}';
    } finally {
      clearTimeout(timeout);
    }
  }

  async parseIssue(
    text: string,
    context?: { campusName?: string; existingCategories?: string[] }
  ): Promise<AIIssueParseResult> {
    try {
      const systemPrompt = `You are the Unifix Campus Issue Intelligence Assistant.
Analyze this user-reported facility or operational problem on campus and return a strictly structured JSON object.
Do NOT invent facts. Distinguish facts from recommendations.
Campus context: ${context?.campusName || 'General Campus'}
Permitted categories: ${context?.existingCategories?.join(', ') || 'Lighting & Electrical, Plumbing & Water, HVAC & Temperature, Safety Hazard & Emergency, Network & Connectivity, Custodial & Cleaning, Doors, Locks & Access'}

Required JSON structure:
{
  "suggestedTitle": "concise, professional title (under 70 chars)",
  "summary": "clean 1-2 sentence summary",
  "suggestedCategory": "category from permitted list",
  "extractedLocation": "extracted location or null if unclear",
  "suggestedSeverity": "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL",
  "suggestedImpact": "INDIVIDUAL" | "GROUP" | "BUILDING" | "CAMPUS",
  "suggestedUrgency": "LOW" | "NORMAL" | "HIGH" | "URGENT",
  "suggestedPriority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "missingInformation": ["item 1", "item 2"],
  "followUpQuestions": ["question 1", "question 2"],
  "confidence": 0.0 to 1.0
}`;

      const raw = await this.callChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ]);

      const parsed = JSON.parse(raw);

      return {
        suggestedTitle: parsed.suggestedTitle || text.slice(0, 50),
        summary: parsed.summary || text,
        suggestedCategory: parsed.suggestedCategory || 'Custodial & Cleaning',
        extractedLocation: parsed.extractedLocation || undefined,
        suggestedSeverity: parsed.suggestedSeverity || 'MODERATE',
        suggestedImpact: parsed.suggestedImpact || 'GROUP',
        suggestedUrgency: parsed.suggestedUrgency || 'NORMAL',
        suggestedPriority: parsed.suggestedPriority || 'MEDIUM',
        missingInformation: parsed.missingInformation || [],
        followUpQuestions: parsed.followUpQuestions || [],
        confidence: Number(parsed.confidence) || 0.8,
        modelUsed: this.name,
        isAiSuggestion: true,
      };
    } catch (err: any) {
      logger.warn(`Remote AI endpoint failed (${err.message}). Using resilient mock fallback.`);
      return this.fallback.parseIssue(text, context);
    }
  }

  async findSimilarTickets(
    newIssue: { title?: string; text: string; location?: string },
    candidates: CandidateTicket[]
  ): Promise<AISimilarityResult> {
    try {
      if (!candidates.length) {
        return { matches: [], summary: 'No active tickets on campus to compare.', modelUsed: this.name };
      }

      const systemPrompt = `Compare this newly reported facility problem against active campus tickets. Return JSON with ranked duplicate or related suggestions.
JSON format:
{
  "matches": [
    { "ticketId": "uuid", "similarityScore": 0.0 to 1.0, "explanation": "why this may be duplicate or related" }
  ],
  "summary": "brief overview of findings"
}`;

      const raw = await this.callChatCompletion([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            newIssue,
            candidates: candidates.slice(0, 10).map((c) => ({
              id: c.id,
              title: c.title,
              description: c.description.slice(0, 200),
              location: c.locationText,
              category: c.categoryName,
            })),
          }),
        },
      ]);

      const parsed = JSON.parse(raw);
      const matches = (parsed.matches || []).map((m: any) => {
        const found = candidates.find((c) => c.id === m.ticketId);
        return {
          ticketId: m.ticketId,
          title: found?.title || 'Related Ticket',
          similarityScore: Number(m.similarityScore) || 0.5,
          explanation: m.explanation || 'Shares similar symptom or location',
        };
      });

      return {
        matches,
        summary: parsed.summary || `Found ${matches.length} potentially related tickets.`,
        modelUsed: this.name,
      };
    } catch (err: any) {
      logger.warn(`Remote AI similarity endpoint failed (${err.message}). Falling back to local similarity engine.`);
      return this.fallback.findSimilarTickets(newIssue, candidates);
    }
  }

  async generateInsights(aggregatedStats: any): Promise<AIInsightResult[]> {
    try {
      const systemPrompt = `Analyze campus maintenance operational data and generate actionable management insights.
Distinguish observed facts from recommendations. Return JSON array:
[
  {
    "title": "insight title",
    "observedFacts": ["fact 1", "fact 2"],
    "recommendations": ["recommendation 1"],
    "affectedCampuses": ["campus name"],
    "confidence": 0.0 to 1.0
  }
]`;

      const raw = await this.callChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(aggregatedStats) },
      ]);

      const parsed = JSON.parse(raw);
      const timestamp = new Date().toISOString();

      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          ...item,
          generatedAt: timestamp,
          modelUsed: this.name,
        }));
      }

      return this.fallback.generateInsights(aggregatedStats);
    } catch (err: any) {
      logger.warn(`Remote AI insights generation failed (${err.message}). Falling back to rule-based insight engine.`);
      return this.fallback.generateInsights(aggregatedStats);
    }
  }
}
