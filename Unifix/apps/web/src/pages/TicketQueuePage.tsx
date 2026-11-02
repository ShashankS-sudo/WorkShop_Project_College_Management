import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ApiClient } from '../api/client';
import { SocketEvent } from '@unifix/shared-types';
import {
  Search,
  RefreshCw,
  Flame,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
} from 'lucide-react';

interface TicketItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  isCritical: boolean;
  isAnonymous: boolean;
  currentStage: string;
  stageStartTime: string;
  createdAt: string;
  category?: { name: string };
  location?: { name: string };
  assignee?: { firstName: string; lastName: string };
  _count?: { endorsements: number; comments: number };
}

interface TicketQueuePageProps {
  onSelectTicket: (ticketId: string) => void;
  initialFilter?: string;
}

export const TicketQueuePage: React.FC<TicketQueuePageProps> = ({
  onSelectTicket,
  initialFilter,
}) => {
  const { activeCampus } = useAuth();
  const { socket } = useSocket();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>(
    initialFilter && initialFilter !== 'overdue' && initialFilter !== 'critical'
      ? initialFilter
      : ''
  );
  const [isOverdueOnly, setIsOverdueOnly] = useState<boolean>(initialFilter === 'overdue');
  const [isCriticalOnly, setIsCriticalOnly] = useState<boolean>(initialFilter === 'critical');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (initialFilter === 'overdue') {
      setIsOverdueOnly(true);
      setIsCriticalOnly(false);
      setStatusFilter('');
    } else if (initialFilter === 'critical') {
      setIsCriticalOnly(true);
      setIsOverdueOnly(false);
      setStatusFilter('');
    } else if (initialFilter) {
      setStatusFilter(initialFilter);
      setIsOverdueOnly(false);
      setIsCriticalOnly(false);
    }
    setPage(1);
  }, [initialFilter]);

  const fetchTickets = async () => {
    if (!activeCampus) return;
    setIsLoading(true);
    try {
      const params: any = {
        campusId: activeCampus.id,
        page,
        limit: 15,
        search,
      };

      if (statusFilter) params.status = statusFilter;
      if (isOverdueOnly) params.overdue = 'true';
      if (isCriticalOnly) params.isCritical = 'true';

      const res = await ApiClient.getTickets(params);
      if (res.data) {
        setTickets(res.data);
        setTotal(res.metadata?.total || 0);
        setTotalPages(res.metadata?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch tickets', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [activeCampus, statusFilter, isOverdueOnly, isCriticalOnly, page]);

  // Real-time queue event listeners
  useEffect(() => {
    if (!socket || !activeCampus) return;

    const handleTicketCreated = (data: any) => {
      if (data.campusId === activeCampus.id) {
        // Prepend new ticket or refetch
        fetchTickets();
      }
    };

    const handleTicketUpdated = (data: any) => {
      if (data.campusId === activeCampus.id) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === data.ticketId ? { ...t, ...data.ticket } : t
          )
        );
      }
    };

    const handleTicketEndorsed = (data: any) => {
      if (data.campusId === activeCampus.id) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === data.ticketId
              ? {
                  ...t,
                  _count: {
                    comments: t._count?.comments || 0,
                    endorsements: data.totalEndorsements,
                  },
                }
              : t
          )
        );
      }
    };

    socket.on(SocketEvent.TICKET_CREATED, handleTicketCreated);
    socket.on(SocketEvent.TICKET_UPDATED, handleTicketUpdated);
    socket.on(SocketEvent.TICKET_ENDORSED, handleTicketEndorsed);

    return () => {
      socket.off(SocketEvent.TICKET_CREATED, handleTicketCreated);
      socket.off(SocketEvent.TICKET_UPDATED, handleTicketUpdated);
      socket.off(SocketEvent.TICKET_ENDORSED, handleTicketEndorsed);
    };
  }, [socket, activeCampus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTickets();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Ticket Queue</h1>
          <p className="text-xs text-gray-500 mt-1">
            Active maintenance triage, assignments, and historical records ({total} issues)
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles, descriptions, locations..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { label: 'All Active', value: '' },
            { label: 'Open', value: 'OPEN' },
            { label: 'Acknowledged', value: 'ACKNOWLEDGED' },
            { label: 'In Progress', value: 'IN_PROGRESS' },
            { label: 'Waiting', value: 'WAITING' },
            { label: 'Resolved (Historical)', value: 'RESOLVED' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setIsOverdueOnly(false);
                setIsCriticalOnly(false);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.value && !isOverdueOnly && !isCriticalOnly
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Special Filter Badges */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsOverdueOnly(!isOverdueOnly);
              setStatusFilter('');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isOverdueOnly
                ? 'bg-purple-600 text-white border-purple-600'
                : 'text-purple-700 bg-purple-50/50 border-purple-200 hover:bg-purple-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            21-Day Overdue
          </button>

          <button
            onClick={() => {
              setIsCriticalOnly(!isCriticalOnly);
              setStatusFilter('');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isCriticalOnly
                ? 'bg-red-600 text-white border-red-600'
                : 'text-red-700 bg-red-50/50 border-red-200 hover:bg-red-100'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Critical Only
          </button>
        </div>
      </div>

      {/* Ticket Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-16 text-center text-sm text-gray-400">
            No tickets match your selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Category & Location</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status & Stage</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Endorsements</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTicket(t.id)}
                    className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-gray-400">#{t.id.slice(0, 6)}</span>
                        {t.isCritical && (
                          <span className="badge badge-critical text-[9px] py-0 px-1.5">Emergency</span>
                        )}
                        {t.isAnonymous && (
                          <span className="badge badge-low text-[9px] py-0 px-1.5">Anon</span>
                        )}
                      </div>
                      <div className="font-semibold text-gray-900 truncate mt-1">{t.title}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Reported {new Date(t.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-gray-800">{t.category?.name || 'General'}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{t.location?.name || 'Campus Grounds'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`badge ${
                          t.priority === 'CRITICAL'
                            ? 'badge-critical'
                            : t.priority === 'HIGH'
                            ? 'badge-high'
                            : t.priority === 'LOW'
                            ? 'badge-low'
                            : 'badge-medium'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900">{t.status}</div>
                      <div className="text-[10px] text-purple-700 font-medium mt-0.5">
                        Stage: {t.currentStage}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {t.assignee ? (
                        <span className="font-medium text-gray-800">
                          {t.assignee.firstName} {t.assignee.lastName}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-gray-600 font-medium">
                        <ThumbsUp className="w-3 h-3 text-gray-400" />
                        {t._count?.endorsements || 0}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button className="btn-secondary text-xs py-1 px-3">
                        Triage & Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div>
              Page {page} of {totalPages} ({total} total tickets)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1 rounded border disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1 rounded border disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
