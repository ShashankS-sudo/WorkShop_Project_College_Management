import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ApiClient } from '../api/client';
import { SocketEvent } from '@unifix/shared-types';
import {
  Inbox,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Hourglass,
  Flame,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';

interface DashboardStats {
  counts: {
    total: number;
    open: number;
    acknowledged: number;
    inProgress: number;
    waiting: number;
    resolved: number;
    closed: number;
    critical: number;
    overdue: number;
  };
  overdueQueue: Array<{
    id: string;
    title: string;
    status: string;
    currentStage: string;
    stageStartTime: string;
    escalationCount: number;
  }>;
  recentActivity: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    isCritical: boolean;
    currentStage: string;
    updatedAt: string;
    category?: { name: string };
  }>;
}

interface DashboardPageProps {
  onSelectTicket: (ticketId: string) => void;
  onNavigateToQueue: (filter?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onSelectTicket,
  onNavigateToQueue,
}) => {
  const { activeCampus } = useAuth();
  const { socket } = useSocket();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!activeCampus) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await ApiClient.getCampusDashboardStats(activeCampus.id);
      if (res.data) setStats(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [activeCampus]);

  // Real-time dashboard KPI listener
  useEffect(() => {
    if (!socket || !activeCampus) return;

    const handleCampusActivity = (data: any) => {
      if (data.campusId === activeCampus.id) {
        fetchStats();
      }
    };

    socket.on(SocketEvent.TICKET_CREATED, handleCampusActivity);
    socket.on(SocketEvent.TICKET_UPDATED, handleCampusActivity);
    socket.on(SocketEvent.TICKET_ESCALATED, handleCampusActivity);

    return () => {
      socket.off(SocketEvent.TICKET_CREATED, handleCampusActivity);
      socket.off(SocketEvent.TICKET_UPDATED, handleCampusActivity);
      socket.off(SocketEvent.TICKET_ESCALATED, handleCampusActivity);
    };
  }, [socket, activeCampus]);

  if (isLoading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading campus dashboard...
        </div>
      </div>
    );
  }

  const counts = stats?.counts || {
    total: 0,
    open: 0,
    acknowledged: 0,
    inProgress: 0,
    waiting: 0,
    resolved: 0,
    closed: 0,
    critical: 0,
    overdue: 0,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {activeCampus?.name} Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time facility status, 21-day stage monitoring, and operational workload
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => onNavigateToQueue()}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            View Ticket Queue
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3.5">
        <div
          onClick={() => onNavigateToQueue()}
          className="card p-4 cursor-pointer hover:border-gray-300 transition-all"
        >
          <div className="flex items-center justify-between text-gray-500 text-xs">
            <span>Total</span>
            <Inbox className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{counts.total}</div>
        </div>

        <div
          onClick={() => onNavigateToQueue('OPEN')}
          className="card p-4 cursor-pointer hover:border-blue-200 bg-blue-50/20"
        >
          <div className="flex items-center justify-between text-blue-600 text-xs font-medium">
            <span>New Open</span>
            <Inbox className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-2">{counts.open}</div>
        </div>

        <div
          onClick={() => onNavigateToQueue('ACKNOWLEDGED')}
          className="card p-4 cursor-pointer hover:border-gray-300"
        >
          <div className="flex items-center justify-between text-gray-500 text-xs">
            <span>Acknowledged</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold text-gray-800 mt-2">{counts.acknowledged}</div>
        </div>

        <div
          onClick={() => onNavigateToQueue('IN_PROGRESS')}
          className="card p-4 cursor-pointer hover:border-amber-200 bg-amber-50/20"
        >
          <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
            <span>In Progress</span>
            <Hourglass className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2">{counts.inProgress}</div>
        </div>

        <div
          onClick={() => onNavigateToQueue('WAITING')}
          className="card p-4 cursor-pointer hover:border-gray-300"
        >
          <div className="flex items-center justify-between text-gray-500 text-xs">
            <span>Waiting</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold text-gray-800 mt-2">{counts.waiting}</div>
        </div>

        <div
          onClick={() => onNavigateToQueue('RESOLVED')}
          className="card p-4 cursor-pointer hover:border-emerald-200 bg-emerald-50/20"
        >
          <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
            <span>Resolved</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 mt-2">{counts.resolved}</div>
        </div>

        <div
          onClick={() => onNavigateToQueue('overdue')}
          className="card p-4 cursor-pointer hover:border-purple-300 bg-purple-50/40 border-purple-200"
        >
          <div className="flex items-center justify-between text-purple-700 text-xs font-semibold">
            <span>21-Day Overdue</span>
            <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-900 mt-2">{counts.overdue}</div>
        </div>

        <div
          onClick={() => onNavigateToQueue('critical')}
          className="card p-4 cursor-pointer hover:border-red-300 bg-red-50/40 border-red-200"
        >
          <div className="flex items-center justify-between text-red-700 text-xs font-semibold">
            <span>Critical Issues</span>
            <Flame className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-900 mt-2">{counts.critical}</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Urgent Overdue Queue (2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Stage Escalation Queue (Action Required)
            </h2>
            <span className="text-xs text-gray-500">
              Issues exceeding 21 days in current stage
            </span>
          </div>

          <div className="card overflow-hidden">
            {stats?.overdueQueue && stats.overdueQueue.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {stats.overdueQueue.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectTicket(item.id)}
                    className="p-4 hover:bg-gray-50 flex items-center justify-between gap-4 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="badge badge-overdue text-[10px]">
                          Overdue ({item.currentStage})
                        </span>
                        {item.escalationCount > 0 && (
                          <span className="badge badge-critical text-[10px]">
                            {item.escalationCount}x Escalated
                          </span>
                        )}
                        <span className="text-xs font-medium text-gray-400">#{item.id.slice(0, 8)}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 truncate mt-1">
                        {item.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        In stage since {new Date(item.stageStartTime).toLocaleDateString()}
                      </p>
                    </div>
                    <button className="btn-secondary text-xs py-1 px-2.5 flex-shrink-0">
                      Triage
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span>No tickets currently overdue in this campus. All stage timers healthy!</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity (1 column) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
            <span className="text-xs text-gray-400">Latest updates</span>
          </div>

          <div className="card divide-y divide-gray-100">
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectTicket(item.id)}
                  className="p-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`badge text-[10px] ${
                        item.priority === 'CRITICAL'
                          ? 'badge-critical'
                          : item.priority === 'HIGH'
                          ? 'badge-high'
                          : 'badge-medium'
                      }`}
                    >
                      {item.priority}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(item.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-gray-800 truncate mt-1.5">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                    <span>{item.category?.name || 'General'}</span>
                    <span>•</span>
                    <span className="font-medium text-gray-700">{item.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-gray-400">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
