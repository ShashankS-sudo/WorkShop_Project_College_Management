// Automated SLA Escalation Scheduler Worker - Unifix
import { runEscalationCheck, EscalationResult } from './escalationEngine';
import logger from './logger';

export interface SchedulerMetrics {
  status: 'RUNNING' | 'STOPPED' | 'PAUSED';
  intervalMs: number;
  totalRuns: number;
  totalEscalationsTriggered: number;
  totalNotificationsCreated: number;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  lastRunResult: EscalationResult | null;
  lastError: string | null;
  isRunInProgress: boolean;
}

class EscalationSchedulerWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunInProgress = false;
  private intervalMs: number;
  private status: 'RUNNING' | 'STOPPED' | 'PAUSED' = 'STOPPED';

  private metrics: SchedulerMetrics = {
    status: 'STOPPED',
    intervalMs: 15 * 60 * 1000,
    totalRuns: 0,
    totalEscalationsTriggered: 0,
    totalNotificationsCreated: 0,
    lastRunAt: null,
    lastRunDurationMs: null,
    lastRunResult: null,
    lastError: null,
    isRunInProgress: false,
  };

  constructor() {
    // Default: 5 minutes in dev, 15 minutes in production (configurable via env)
    const envInterval = process.env.ESCALATION_CHECK_INTERVAL_MS
      ? parseInt(process.env.ESCALATION_CHECK_INTERVAL_MS, 10)
      : null;

    if (envInterval && !isNaN(envInterval) && envInterval > 0) {
      this.intervalMs = envInterval;
    } else {
      this.intervalMs = process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 5 * 60 * 1000;
    }

    this.metrics.intervalMs = this.intervalMs;
  }

  /**
   * Starts the recurring background SLA worker
   */
  start(customIntervalMs?: number): void {
    if (this.status === 'RUNNING') {
      logger.info('Escalation scheduler is already active');
      return;
    }

    if (customIntervalMs && customIntervalMs > 0) {
      this.intervalMs = customIntervalMs;
      this.metrics.intervalMs = customIntervalMs;
    }

    this.status = 'RUNNING';
    this.metrics.status = 'RUNNING';

    logger.info(`Starting SLA Escalation Worker (Interval: ${this.intervalMs / 1000}s)`);

    // Initial warmup check after 5 seconds to let server & database initialize
    setTimeout(() => {
      if (this.status === 'RUNNING') {
        this.executeCycle('warmup');
      }
    }, 5000);

    // Recurring interval
    this.timer = setInterval(() => {
      if (this.status === 'RUNNING') {
        this.executeCycle('scheduled');
      }
    }, this.intervalMs);
  }

  /**
   * Stops the background worker
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = 'STOPPED';
    this.metrics.status = 'STOPPED';
    logger.info('Stopped SLA Escalation Worker');
  }

  /**
   * Pause execution without destroying interval
   */
  pause(): void {
    this.status = 'PAUSED';
    this.metrics.status = 'PAUSED';
    logger.info('Paused SLA Escalation Worker');
  }

  /**
   * Resume paused worker
   */
  resume(): void {
    if (this.status === 'PAUSED') {
      this.status = 'RUNNING';
      this.metrics.status = 'RUNNING';
      logger.info('Resumed SLA Escalation Worker');
    }
  }

  /**
   * Manually trigger an immediate escalation cycle
   */
  async forceRun(): Promise<EscalationResult> {
    logger.info('Manual escalation cycle triggered');
    return this.executeCycle('manual');
  }

  /**
   * Execute a single check cycle with concurrency guard & metric tracking
   */
  private async executeCycle(triggerSource: 'scheduled' | 'warmup' | 'manual'): Promise<EscalationResult> {
    if (this.isRunInProgress) {
      logger.warn(`Skipping SLA check (${triggerSource}): previous cycle still executing`);
      return {
        ticketsChecked: 0,
        escalationsTriggered: 0,
        notificationsCreated: 0,
      };
    }

    this.isRunInProgress = true;
    this.metrics.isRunInProgress = true;
    const start = Date.now();

    try {
      logger.info(`Executing SLA escalation cycle [source=${triggerSource}]`);
      const result = await runEscalationCheck();

      const duration = Date.now() - start;
      this.metrics.totalRuns += 1;
      this.metrics.totalEscalationsTriggered += result.escalationsTriggered;
      this.metrics.totalNotificationsCreated += result.notificationsCreated;
      this.metrics.lastRunAt = new Date().toISOString();
      this.metrics.lastRunDurationMs = duration;
      this.metrics.lastRunResult = result;
      this.metrics.lastError = null;

      logger.info(
        `SLA cycle completed in ${duration}ms: ${result.ticketsChecked} tickets checked, ${result.escalationsTriggered} escalated, ${result.notificationsCreated} notifications created`
      );

      return result;
    } catch (err: any) {
      const duration = Date.now() - start;
      this.metrics.lastError = err.message || 'Unknown error';
      this.metrics.lastRunDurationMs = duration;
      logger.error('Error in SLA escalation worker cycle', { error: err.message, stack: err.stack });

      return {
        ticketsChecked: 0,
        escalationsTriggered: 0,
        notificationsCreated: 0,
      };
    } finally {
      this.isRunInProgress = false;
      this.metrics.isRunInProgress = false;
    }
  }

  /**
   * Return real-time metrics and worker health status
   */
  getStatus(): SchedulerMetrics {
    return { ...this.metrics };
  }
}

export const escalationScheduler = new EscalationSchedulerWorker();
