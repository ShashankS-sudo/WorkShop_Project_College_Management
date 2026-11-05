// AI Controller - Unifix
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getAIProvider } from '../lib/ai/aiService';
import logger from '../lib/logger';

/**
 * AI Mode B: Natural Language Issue Parsing
 * Extracts title, category, location, severity, and generates clarification questions
 */
export async function parseIssueDescription(req: Request, res: Response) {
  try {
    const { text, campusId } = req.body;

    if (!text || !campusId) {
      return res.status(400).json({ error: 'text and campusId are required' });
    }

    const campus = await prisma.campus.findUnique({
      where: { id: campusId },
      include: {
        categories: { where: { isActive: true }, select: { name: true } },
      },
    });

    if (!campus) {
      return res.status(404).json({ error: 'Campus not found' });
    }

    const globalCategories = await prisma.category.findMany({
      where: { campusId: null, isActive: true },
      select: { name: true },
    });

    const categoryNames = [
      ...campus.categories.map((c) => c.name),
      ...globalCategories.map((c) => c.name),
    ];

    const ai = getAIProvider();
    const result = await ai.parseIssue(String(text).trim(), {
      campusName: campus.name,
      existingCategories: categoryNames,
    });

    // Optionally save AI analysis record for auditing
    const userId = (req as any).userId;
    await prisma.aIAnalysis.create({
      data: {
        campusId,
        userId: userId || null,
        analysisType: 'ISSUE_PARSING',
        suggestedTitle: result.suggestedTitle,
        suggestedCategory: result.suggestedCategory,
        suggestedPriority: result.suggestedPriority,
        suggestedLocation: result.extractedLocation,
        confidence: result.confidence,
        modelUsed: result.modelUsed,
        rawOutput: JSON.stringify(result),
        parsedOutput: result as any,
      },
    });

    return res.json({ data: result });
  } catch (error: any) {
    logger.error('Error in AI issue parsing', { error: error.message });
    return res.status(500).json({
      error: 'AI analysis temporarily unavailable',
      fallback: 'Please proceed with manual reporting.',
    });
  }
}

/**
 * AI-assisted Duplicate & Similarity Detection
 * Compares new issue against active tickets strictly within the same campus
 */
export async function checkSimilarity(req: Request, res: Response) {
  try {
    const { campusId, title, text, location } = req.body;
    const callerId = (req as any).userId;

    if (!campusId || (!text && !title)) {
      return res.status(400).json({ error: 'campusId and issue text are required' });
    }

    // Scoped strictly to the requested campus!
    const activeCandidates = await prisma.ticket.findMany({
      where: {
        campusId,
        status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] },
      },
      select: {
        id: true,
        title: true,
        description: true,
        locationText: true,
        status: true,
        category: { select: { name: true } },
        endorsements: { select: { endorserId: true } },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const candidates = activeCandidates.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      locationText: c.locationText,
      categoryName: c.category?.name || null,
      status: c.status,
      hasEndorsed: callerId ? c.endorsements?.some((e) => e.endorserId === callerId) : false,
      endorsementsCount: c.endorsements?.length || 0,
    }));

    const ai = getAIProvider();
    const result = await ai.findSimilarTickets(
      {
        title,
        text: text || '',
        location,
      },
      candidates
    );

    return res.json({
      data: result.matches,
      matches: result.matches,
      summary: result.summary,
      rawResult: result,
    });
  } catch (error: any) {
    logger.error('Error in AI similarity check', { error: error.message });
    return res.status(500).json({ error: 'Failed to perform similarity check' });
  }
}

/**
 * AI Management & Supermanagement Insights
 */
export async function getManagementInsights(req: Request, res: Response) {
  try {
    const { campusId } = req.query;

    // Fetch operational statistics
    const where: any = {};
    if (campusId) where.campusId = String(campusId);

    const [totalTickets, activeTickets, criticalTickets, overdueTickets, categoryCounts] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.count({ where: { ...where, status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] } } }),
      prisma.ticket.count({ where: { ...where, isCritical: true, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      prisma.ticket.count({
        where: {
          ...where,
          status: { notIn: ['RESOLVED', 'CLOSED'] },
          stageStartTime: { lt: new Date(Date.now() - 21 * 24 * 3600 * 1000) },
        },
      }),
      prisma.ticket.groupBy({
        by: ['categoryId'],
        where,
        _count: { id: true },
      }),
    ]);

    const stats = {
      totalTickets,
      activeTickets,
      criticalTickets,
      overdueTickets,
      categoryDistribution: categoryCounts,
    };

    const ai = getAIProvider();
    const insights = await ai.generateInsights(stats);

    return res.json({
      data: {
        statistics: stats,
        insights,
      },
    });
  } catch (error: any) {
    logger.error('Error generating AI insights', { error: error.message });
    return res.status(500).json({ error: 'Failed to generate insights' });
  }
}
