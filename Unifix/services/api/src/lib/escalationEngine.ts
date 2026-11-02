// 3-Week Stage Escalation Engine - Unifix
import prisma from './prisma';
import logger from './logger';
import { emitToCampus, emitToUser } from './socket';
import { SocketEvent } from '@unifix/shared-types';

export interface EscalationResult {
  ticketsChecked: number;
  escalationsTriggered: number;
  notificationsCreated: number;
}

/**
 * Run a full escalation check across all active tickets
 * Idempotent: safe to run repeatedly without creating duplicate alerts
 */
export async function runEscalationCheck(): Promise<EscalationResult> {
  const now = new Date();
  logger.info('Running ticket lifecycle escalation check...');

  // 1. Fetch all active (non-terminal) tickets
  const activeTickets = await prisma.ticket.findMany({
    where: {
      status: {
        notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'],
      },
    },
    include: {
      campus: true,
      reporter: { select: { id: true, email: true, isAnonymous: true } },
    },
  });

  let escalationsTriggered = 0;
  let notificationsCreated = 0;

  for (const ticket of activeTickets) {
    try {
      // Calculate stage expiration time
      const stageStart = new Date(ticket.stageStartTime).getTime();
      const stageDurationMs = ticket.stageDuration * 3600 * 1000;
      const isOverdue = now.getTime() > stageStart + stageDurationMs;

      if (!isOverdue) continue;

      // Check if an escalation event for this ticket and stage was already triggered recently (within 7 days)
      const recentEscalation = await prisma.escalationEvent.findFirst({
        where: {
          ticketId: ticket.id,
          stage: ticket.currentStage,
          triggeredAt: {
            gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000),
          },
        },
      });

      if (recentEscalation) {
        // Already escalated for this stage cycle; avoid spamming
        continue;
      }

      // Query management users for this campus
      const campusManagers = await prisma.campusMembership.findMany({
        where: {
          campusId: ticket.campusId,
          role: { in: ['MANAGEMENT', 'SUPERMANAGEMENT'] },
          isActive: true,
        },
        select: { userId: true },
      });

      const managerUserIds = campusManagers.map((m) => m.userId);

      // Days elapsed in current stage
      const daysElapsed = Math.floor((now.getTime() - stageStart) / (24 * 3600 * 1000));

      // Record escalation event and notifications transactionally
      await prisma.$transaction(async (tx) => {
        // 1. Increment escalation count on ticket
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            escalationCount: ticket.escalationCount + 1,
          },
        });

        // 2. Create EscalationEvent
        const escalation = await tx.escalationEvent.create({
          data: {
            ticketId: ticket.id,
            stage: ticket.currentStage,
            previousStage: ticket.currentStage,
            duration: ticket.stageDuration,
            triggeredAt: now,
            manualOverride: false,
            notifiedIds: managerUserIds,
          },
        });

        // 3. Create Notifications for each manager with idempotency key
        const title = ticket.isCritical
          ? `CRITICAL ESCALATION: Ticket ${ticket.title.slice(0, 40)}...`
          : `Stage Overdue Alert (${daysElapsed} days in ${ticket.currentStage})`;

        const message = ticket.isCritical
          ? `Critical ticket "${ticket.title}" has exceeded urgent resolution window (${ticket.stageDuration}h). Immediate management triage required.`
          : `Ticket "${ticket.title}" has remained in stage ${ticket.currentStage} for ${daysElapsed} days without verified progress. Please advance or update this issue.`;

        for (const mId of managerUserIds) {
          const idempotencyKey = `esc-${escalation.id}-${mId}`;
          const existingNotif = await tx.notification.findUnique({
            where: { idempotencyKey },
          });

          if (!existingNotif) {
            const notif = await tx.notification.create({
              data: {
                userId: mId,
                title,
                message,
                type: ticket.isCritical ? 'TICKET_ESCALATED' : 'STAGE_OVERDUE',
                relatedTicketId: ticket.id,
                idempotencyKey,
                metadata: {
                  stage: ticket.currentStage,
                  daysElapsed,
                  isCritical: ticket.isCritical,
                },
              },
            });
            notificationsCreated++;
            emitToUser(mId, SocketEvent.NOTIFICATION_NEW, {
              userId: mId,
              notification: notif,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // 4. Also notify reporter if non-anonymous and exists
        if (ticket.reporterId && !ticket.isAnonymous) {
          const reporterKey = `esc-rep-${escalation.id}-${ticket.reporterId}`;
          const existingRepNotif = await tx.notification.findUnique({
            where: { idempotencyKey: reporterKey },
          });

          if (!existingRepNotif) {
            const repNotif = await tx.notification.create({
              data: {
                userId: ticket.reporterId,
                title: `Update on your reported issue: Escalation Triggered`,
                message: `Your issue "${ticket.title}" has been escalated to campus management for prioritized review.`,
                type: 'TICKET_ESCALATED',
                relatedTicketId: ticket.id,
                idempotencyKey: reporterKey,
              },
            });
            notificationsCreated++;
            emitToUser(ticket.reporterId, SocketEvent.NOTIFICATION_NEW, {
              userId: ticket.reporterId,
              notification: repNotif,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // Emit real-time ticket escalation event to campus
        emitToCampus(ticket.campusId, SocketEvent.TICKET_ESCALATED, {
          campusId: ticket.campusId,
          ticketId: ticket.id,
          ticket: {
            id: ticket.id,
            status: ticket.status,
            currentStage: ticket.currentStage,
            escalationCount: ticket.escalationCount + 1,
            isCritical: ticket.isCritical,
          },
          action: 'ESCALATED',
          timestamp: new Date().toISOString(),
        });
      });

      escalationsTriggered++;
      logger.warn(`Escalation triggered for ticket ${ticket.id} (${ticket.title}) - ${daysElapsed} days in ${ticket.currentStage}`);
    } catch (err: any) {
      logger.error(`Error escalating ticket ${ticket.id}`, { error: err.message });
    }
  }

  logger.info(`Escalation check complete. Triggered: ${escalationsTriggered}, Notifications: ${notificationsCreated}`);

  return {
    ticketsChecked: activeTickets.length,
    escalationsTriggered,
    notificationsCreated,
  };
}

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Start the recurring background escalation runner
 */
export function startEscalationScheduler(intervalMs = 30 * 60 * 1000): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  logger.info(`Starting background ticket escalation scheduler (interval: ${intervalMs / 1000}s)`);

  // Run initial check after short warmup delay
  setTimeout(() => {
    runEscalationCheck().catch((err) => logger.error('Initial escalation check error', { error: err.message }));
  }, 10000);

  // Set recurring interval
  schedulerTimer = setInterval(() => {
    runEscalationCheck().catch((err) => logger.error('Recurring escalation check error', { error: err.message }));
  }, intervalMs);
}

export function stopEscalationScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('Stopped escalation scheduler');
  }
}
