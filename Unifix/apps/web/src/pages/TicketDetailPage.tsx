import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { SocketEvent } from '@unifix/shared-types';
import {
  X,
  CheckCircle2,
  Flame,
  User,
  Send,
  Paperclip,
  UploadCloud,
  Trash2,
} from 'lucide-react';

interface TicketDetailPageProps {
  ticketId: string;
  onClose: () => void;
  onTicketUpdated: () => void;
}

export const TicketDetailPage: React.FC<TicketDetailPageProps> = ({
  ticketId,
  onClose,
  onTicketUpdated,
}) => {
  const { socket, joinRoom, leaveRoom } = useSocket();
  const [ticket, setTicket] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'details' | 'progress' | 'history' | 'comments' | 'attachments'>('details');
  const [commentText, setCommentText] = useState<string>('');
  const [isInternalComment, setIsInternalComment] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Action Modals State
  const [actionType, setActionType] = useState<
    'acknowledge' | 'assign' | 'progress' | 'priority' | 'resolve' | 'reopen' | 'duplicate' | null
  >(null);
  const [actionNote, setActionNote] = useState<string>('');
  const [overridePriorityVal, setOverridePriorityVal] = useState<string>('HIGH');
  const [progressEventType, setProgressEventType] = useState<string>('MAINTENANCE_ACTION');
  const [progressTitle, setProgressTitle] = useState<string>('');
  const [resetsTimer, setResetsTimer] = useState<boolean>(true);
  const [duplicateTargetId, setDuplicateTargetId] = useState<string>('');

  const loadTicket = async () => {
    setIsLoading(true);
    try {
      const res = await ApiClient.getTicket(ticketId);
      if (res.data) setTicket(res.data);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load ticket');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  // Live real-time updates for this focused ticket
  useEffect(() => {
    if (!socket || !ticketId) return;

    joinRoom(`ticket:${ticketId}`);

    const handleCommentAdded = (data: any) => {
      if (data.ticketId === ticketId && data.comment) {
        setTicket((prev: any) => {
          if (!prev) return prev;
          const exists = prev.comments?.some((c: any) => c.id === data.comment.id);
          if (exists) return prev;
          return {
            ...prev,
            comments: [...(prev.comments || []), data.comment],
          };
        });
      }
    };

    const handleProgressRecorded = (data: any) => {
      if (data.ticketId === ticketId && data.progressEvent) {
        setTicket((prev: any) => {
          if (!prev) return prev;
          const exists = prev.progressEvents?.some((p: any) => p.id === data.progressEvent.id);
          if (exists) return prev;
          return {
            ...prev,
            progressEvents: [...(prev.progressEvents || []), data.progressEvent],
          };
        });
      }
    };

    const handleTicketUpdated = (data: any) => {
      if (data.ticketId === ticketId) {
        loadTicket();
        onTicketUpdated();
      }
    };

    const handleTicketEndorsed = (data: any) => {
      if (data.ticketId === ticketId) {
        setTicket((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            _count: {
              ...(prev._count || {}),
              endorsements: data.totalEndorsements,
            },
          };
        });
      }
    };

    socket.on(SocketEvent.COMMENT_ADDED, handleCommentAdded);
    socket.on(SocketEvent.PROGRESS_RECORDED, handleProgressRecorded);
    socket.on(SocketEvent.TICKET_UPDATED, handleTicketUpdated);
    socket.on(SocketEvent.TICKET_ENDORSED, handleTicketEndorsed);

    return () => {
      leaveRoom(`ticket:${ticketId}`);
      socket.off(SocketEvent.COMMENT_ADDED, handleCommentAdded);
      socket.off(SocketEvent.PROGRESS_RECORDED, handleProgressRecorded);
      socket.off(SocketEvent.TICKET_UPDATED, handleTicketUpdated);
      socket.off(SocketEvent.TICKET_ENDORSED, handleTicketEndorsed);
    };
  }, [socket, ticketId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      await ApiClient.addComment(ticketId, commentText, isInternalComment);
      setCommentText('');
      loadTicket();
    } catch (err: any) {
      setActionError(err.message || 'Failed to post comment');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const uploadRes: any = await ApiClient.uploadAttachment(file);
      if (uploadRes?.data) {
        await ApiClient.addTicketAttachment(ticketId, {
          filename: uploadRes.data.filename,
          filepath: uploadRes.data.filepath,
          mimeType: uploadRes.data.mimeType,
          size: uploadRes.data.size,
        });
        await loadTicket();
        onTicketUpdated();
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;
    try {
      await ApiClient.deleteTicketAttachment(ticketId, attachmentId);
      await loadTicket();
      onTicketUpdated();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete attachment');
    }
  };

  const handleExecuteAction = async () => {
    setActionError(null);
    try {
      switch (actionType) {
        case 'acknowledge':
          await ApiClient.acknowledgeTicket(ticketId, actionNote);
          break;
        case 'assign':
          await ApiClient.assignTicket(ticketId, undefined, undefined, actionNote);
          break;
        case 'progress':
          await ApiClient.recordProgress(ticketId, progressEventType, progressTitle || 'Progress Update', actionNote, resetsTimer);
          break;
        case 'priority':
          await ApiClient.overridePriority(ticketId, overridePriorityVal, actionNote);
          break;
        case 'resolve':
          await ApiClient.resolveTicket(ticketId, actionNote);
          break;
        case 'reopen':
          await ApiClient.reopenTicket(ticketId, actionNote);
          break;
        case 'duplicate':
          await ApiClient.markDuplicate(ticketId, duplicateTargetId, actionNote);
          break;
      }

      setActionType(null);
      setActionNote('');
      loadTicket();
      onTicketUpdated();
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
    }
  };

  if (!ticket && !isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
        <div className="card p-6 bg-white text-sm text-gray-600 max-w-md w-full text-center space-y-3">
          <p className="text-red-600 font-medium">{actionError || 'Ticket could not be loaded.'}</p>
          <button onClick={onClose} className="btn-secondary text-xs px-4 py-1.5">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!ticket && isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="card p-6 bg-white text-sm text-gray-600">Loading ticket details...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-gray-500">#{ticket.id.slice(0, 8)}</span>
              <span
                className={`badge ${
                  ticket.priority === 'CRITICAL'
                    ? 'badge-critical'
                    : ticket.priority === 'HIGH'
                    ? 'badge-high'
                    : 'badge-medium'
                }`}
              >
                {ticket.priority} Priority
              </span>
              <span className="badge badge-overdue">{ticket.status}</span>
              {ticket.isCritical && (
                <span className="badge badge-critical flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Critical Safety
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-2">{ticket.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Management Action Bar */}
        <div className="px-6 py-2.5 bg-gray-100/75 border-b border-gray-200 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-gray-600 mr-2">Triage Actions:</span>
          {ticket.status === 'OPEN' && (
            <button
              onClick={() => {
                setActionType('acknowledge');
                setActionNote('Acknowledged and queued for inspection.');
              }}
              className="btn-primary py-1 px-2.5 text-xs bg-blue-600"
            >
              Acknowledge
            </button>
          )}

          <button
            onClick={() => {
              setActionType('assign');
              setActionNote('Assigned to facilities team.');
            }}
            className="btn-secondary py-1 px-2.5 text-xs"
          >
            Assign
          </button>

          <button
            onClick={() => {
              setActionType('progress');
              setProgressTitle('Investigation Findings');
              setActionNote('');
            }}
            className="btn-secondary py-1 px-2.5 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100"
          >
            Record Progress (Timer Reset)
          </button>

          <button
            onClick={() => {
              setActionType('priority');
              setActionNote('Severity elevated based on location criticality.');
            }}
            className="btn-secondary py-1 px-2.5 text-xs"
          >
            Override Priority
          </button>

          {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? (
            <button
              onClick={() => {
                setActionType('resolve');
                setActionNote('Repairs verified and tested successfully.');
              }}
              className="btn-primary py-1 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              Resolve Issue
            </button>
          ) : (
            <button
              onClick={() => {
                setActionType('reopen');
                setActionNote('Issue recurring. Reopening for follow-up.');
              }}
              className="btn-secondary py-1 px-2.5 text-xs text-amber-700 bg-amber-50"
            >
              Reopen Ticket
            </button>
          )}

          <button
            onClick={() => {
              setActionType('duplicate');
              setActionNote('Identified as duplicate.');
            }}
            className="btn-secondary py-1 px-2.5 text-xs text-gray-500"
          >
            Mark Duplicate
          </button>
        </div>

        {/* Action Prompt Popup if an action is selected */}
        {actionType && (
          <div className="p-4 bg-blue-50/80 border-b border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-blue-900">
                Execute Action: {actionType.toUpperCase()}
              </h4>
              <button
                onClick={() => setActionType(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>

            {actionType === 'progress' && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Event Type</label>
                  <select
                    value={progressEventType}
                    onChange={(e) => setProgressEventType(e.target.value)}
                    className="w-full p-1.5 border rounded bg-white"
                  >
                    <option value="INVESTIGATION_UPDATE">Investigation Update</option>
                    <option value="MAINTENANCE_ACTION">Maintenance Action / Repair</option>
                    <option value="WAITING_STATE">Waiting (Parts / Access)</option>
                    <option value="ACKNOWLEDGEMENT">Formal Acknowledgement</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Title</label>
                  <input
                    type="text"
                    value={progressTitle}
                    onChange={(e) => setProgressTitle(e.target.value)}
                    placeholder="Brief progress heading"
                    className="w-full p-1.5 border rounded"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="resets"
                    checked={resetsTimer}
                    onChange={(e) => setResetsTimer(e.target.checked)}
                  />
                  <label htmlFor="resets" className="font-medium text-gray-700">
                    Restart 21-day escalation stage timer (Meaningful work confirmed)
                  </label>
                </div>
              </div>
            )}

            {actionType === 'priority' && (
              <div className="text-xs">
                <label className="block font-semibold mb-1">New Priority</label>
                <select
                  value={overridePriorityVal}
                  onChange={(e) => setOverridePriorityVal(e.target.value)}
                  className="p-1.5 border rounded bg-white w-48 mb-2"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
            )}

            {actionType === 'duplicate' && (
              <div className="text-xs">
                <label className="block font-semibold mb-1">Canonical Ticket ID</label>
                <input
                  type="text"
                  value={duplicateTargetId}
                  onChange={(e) => setDuplicateTargetId(e.target.value)}
                  placeholder="Paste master ticket UUID"
                  className="w-full p-1.5 border rounded mb-2"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1">
                {actionType === 'resolve'
                  ? 'Mandatory Resolution Summary (min 10 chars)'
                  : 'Action Notes / Audit Reason'}
              </label>
              <textarea
                rows={2}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Document reason for audit log..."
                className="w-full p-2 border rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setActionType(null)} className="btn-secondary py-1 px-3 text-xs">
                Cancel
              </button>
              <button onClick={handleExecuteAction} className="btn-primary py-1 px-4 text-xs">
                Confirm & Record
              </button>
            </div>
          </div>
        )}

        {actionError && (
          <div className="p-3 bg-red-50 text-red-700 text-xs border-b border-red-200">
            {actionError}
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-gray-200 px-6 gap-6 text-xs font-semibold">
          {[
            { id: 'details', label: 'Issue Details' },
            { id: 'progress', label: `Progress Events (${ticket.progressEvents?.length || 0})` },
            { id: 'history', label: `Audit Trail (${ticket.statusHistories?.length || 0})` },
            { id: 'comments', label: `Discussion & Notes (${ticket.comments?.length || 0})` },
            { id: 'attachments', label: `Attachments (${ticket.attachments?.length || 0})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`py-3 border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Description */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Report Description
                </h4>
                <div className="p-4 bg-gray-50 rounded-xl text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </div>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Category</span>
                  <span className="font-semibold text-gray-800 text-xs mt-0.5 block">
                    {ticket.category?.name || 'General'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Location</span>
                  <span className="font-semibold text-gray-800 text-xs mt-0.5 block">
                    {ticket.location?.name || ticket.locationText || 'Campus Grounds'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Severity / Impact</span>
                  <span className="font-semibold text-gray-800 text-xs mt-0.5 block">
                    {ticket.severity} / {ticket.impact}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Stage Countdown</span>
                  <span className="font-semibold text-purple-700 text-xs mt-0.5 block">
                    {ticket.currentStage} (Limit: {ticket.stageDuration}h)
                  </span>
                </div>
              </div>

              {/* Reporter Identity (Management Privilege View) */}
              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-gray-900 text-xs">Reporter Identity</span>
                    {ticket.isAnonymous && (
                      <span className="badge badge-low text-[10px] py-0">Reported Anonymously</span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-700 space-y-0.5">
                    <div>
                      <span className="font-medium text-gray-500">Name: </span>
                      {ticket.reporter?.firstName} {ticket.reporter?.lastName}
                    </div>
                    {ticket.reporter?.email && (
                      <div>
                        <span className="font-medium text-gray-500">Email: </span>
                        {ticket.reporter.email}
                      </div>
                    )}
                    {ticket.reporter?.phone && (
                      <div>
                        <span className="font-medium text-gray-500">Phone: </span>
                        {ticket.reporter.phone}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 max-w-xs text-right">
                  Management Authorization: Ordinary reporters cannot view this identity.
                </div>
              </div>

              {/* Resolution Summary if resolved */}
              {ticket.resolvedAt && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    Resolved on {new Date(ticket.resolvedAt).toLocaleDateString()}
                  </div>
                  <p className="mt-1 text-xs text-emerald-900 leading-relaxed">
                    {ticket.resolutionSummary}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-4">
              <div className="text-xs text-gray-500">
                Structured lifecycle events (meaningful progress resets the 21-day stage escalation clock):
              </div>
              <div className="divide-y divide-gray-100">
                {ticket.progressEvents?.map((pe: any) => (
                  <div key={pe.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-xs">{pe.title}</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(pe.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-700">{pe.details}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <span className="badge badge-low text-[9px]">{pe.eventType}</span>
                      {pe.resetsStageTimer && (
                        <span className="text-emerald-700 font-semibold">Stage Timer Reset</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <h4 className="font-bold text-gray-700">Status & Priority Audit Trail</h4>
              <div className="space-y-2">
                {ticket.statusHistories?.map((sh: any) => (
                  <div key={sh.id} className="p-3 rounded-lg border bg-gray-50 text-xs">
                    <div className="flex justify-between font-semibold text-gray-800">
                      <span>Status changed to {sh.status}</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(sh.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {sh.notes && <div className="text-gray-600 mt-1 italic">{sh.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {ticket.comments?.map((c: any) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl border ${
                      c.isInternal ? 'bg-amber-50/60 border-amber-200' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-gray-800">{c.authorName}</span>
                      {c.isInternal && (
                        <span className="badge badge-high text-[9px]">Internal Management Only</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-700">{c.content}</p>
                  </div>
                ))}
              </div>

              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="pt-2 border-t space-y-2">
                <textarea
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment or internal work note..."
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-xs"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={isInternalComment}
                      onChange={(e) => setIsInternalComment(e.target.checked)}
                    />
                    Internal comment (hidden from student / reporter)
                  </label>
                  <button type="submit" className="btn-primary py-1 px-3 text-xs flex items-center gap-1">
                    <Send className="w-3 h-3" />
                    Post
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="space-y-4">
              {/* Upload Dropzone */}
              <div className="p-5 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 transition-colors bg-gray-50/50 flex flex-col items-center justify-center text-center">
                <UploadCloud className="w-8 h-8 text-blue-500 mb-2" />
                <p className="font-semibold text-gray-700 text-xs">Upload Photo or Document Attachment</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Supports JPEG, PNG, WEBP, GIF, HEIC, PDF (Max 10MB)</p>
                <label className="mt-3 btn-primary py-1.5 px-4 text-xs cursor-pointer inline-flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" />
                  {isUploading ? 'Uploading...' : 'Choose File'}
                  <input
                    type="file"
                    className="hidden"
                    disabled={isUploading}
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                  />
                </label>
                {uploadError && <p className="text-red-600 text-xs mt-2">{uploadError}</p>}
              </div>

              {/* Attachments List */}
              <div className="space-y-2">
                {!ticket.attachments || ticket.attachments.length === 0 ? (
                  <p className="text-gray-400 text-xs text-center py-6">No attachments uploaded for this ticket yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ticket.attachments.map((att: any) => {
                      const isImage = att.mimeType?.startsWith('image/');
                      const fileUrl = att.filepath?.startsWith('http')
                        ? att.filepath
                        : `/uploads/attachments/${att.filepath}`;

                      return (
                        <div
                          key={att.id}
                          className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow transition-shadow flex items-start gap-3"
                        >
                          {isImage ? (
                            <img
                              src={fileUrl}
                              alt={att.filename}
                              className="w-14 h-14 object-cover rounded-lg bg-gray-100 border flex-shrink-0"
                              onError={(e: any) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                              PDF
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs truncate" title={att.filename}>
                              {att.filename}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {(att.size / 1024).toFixed(1)} KB • {new Date(att.createdAt).toLocaleDateString()}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline text-[11px] font-medium"
                              >
                                View full
                              </a>
                              <span className="text-gray-300">•</span>
                              <button
                                onClick={() => handleDeleteAttachment(att.id)}
                                className="text-red-500 hover:text-red-700 text-[11px] flex items-center gap-0.5"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
