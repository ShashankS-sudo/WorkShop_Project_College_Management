// Create Ticket Modal with AI Parsing & Duplicate Detection - Unifix Web
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../api/client';
import {
  X,
  Sparkles,
  AlertTriangle,
  ThumbsUp,
  RefreshCw,
  Paperclip,
  Trash2,
  Video,
  Image as ImageIcon,
} from 'lucide-react';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: () => void;
  onSelectTicket?: (ticketId: string) => void;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  onTicketCreated,
  onSelectTicket,
}) => {
  const { activeCampus } = useAuth();
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [locationText, setLocationText] = useState<string>('');
  const [severity, setSeverity] = useState<string>('MODERATE');
  const [urgency, setUrgency] = useState<string>('NORMAL');
  const [isCritical, setIsCritical] = useState<boolean>(false);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);

  // Attachments state
  const [attachments, setAttachments] = useState<Array<{ filename: string; filepath: string; url: string; mimeType: string; size: number }>>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);

  // AI & Similarity states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [similarTickets, setSimilarTickets] = useState<any[]>([]);
  const [isCheckingSimilarity, setIsCheckingSimilarity] = useState<boolean>(false);
  const [similarityIgnored, setSimilarityIgnored] = useState<boolean>(false);
  const [isAiParsing, setIsAiParsing] = useState<boolean>(false);

  // Debounced similarity detection
  useEffect(() => {
    if (!isOpen || !activeCampus || similarityIgnored) return;

    const query = `${title} ${description}`.trim();
    if (query.length < 8) {
      setSimilarTickets([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingSimilarity(true);
      try {
        const res = await ApiClient.checkSimilarity(
          description || title,
          activeCampus.id,
          title,
          locationText
        );
        if (res.data && res.data.length > 0) {
          setSimilarTickets(res.data);
        } else {
          setSimilarTickets([]);
        }
      } catch {
        // Non-fatal
      } finally {
        setIsCheckingSimilarity(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [title, description, locationText, activeCampus?.id, isOpen, similarityIgnored]);

  if (!isOpen) return null;

  const handleAiParse = async () => {
    if (!description.trim() || !activeCampus) return;
    setIsAiParsing(true);
    setError(null);
    try {
      const res = await ApiClient.parseIssueWithAI(description.trim(), activeCampus.id);
      if (res.data) {
        if (res.data.suggestedTitle) setTitle(res.data.suggestedTitle);
        if (res.data.suggestedLocation) setLocationText(res.data.suggestedLocation);
        if (res.data.suggestedSeverity) setSeverity(res.data.suggestedSeverity);
        if (res.data.suggestedUrgency) setUrgency(res.data.suggestedUrgency);
        if (res.data.isCriticalSafety) setIsCritical(true);
      }
    } catch (err: any) {
      setError(err.message || 'AI parsing failed');
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleEndorseExisting = async (ticketId: string) => {
    try {
      await ApiClient.endorseTicket(ticketId);
      onClose();
      if (onSelectTicket) onSelectTicket(ticketId);
    } catch (err: any) {
      setError(err.message || 'Failed to endorse ticket');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingMedia(true);
    setMediaUploadError(null);
    try {
      const uploadRes: any = await ApiClient.uploadAttachment(file);
      if (uploadRes?.data) {
        setAttachments((prev) => [...prev, uploadRes.data]);
      }
    } catch (err: any) {
      setMediaUploadError(err.message || 'Failed to upload media file');
    } finally {
      setIsUploadingMedia(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (filepath: string) => {
    setAttachments((prev) => prev.filter((a) => a.filepath !== filepath));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !activeCampus) {
      setError('Please provide both an issue headline and detailed description.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await ApiClient.createTicket({
        campusId: activeCampus.id,
        title: title.trim(),
        description: description.trim(),
        locationText: locationText.trim() || undefined,
        severity,
        urgency,
        isCritical,
        isAnonymous,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          filepath: a.filepath,
          mimeType: a.mimeType,
          size: a.size,
        })),
      });

      // Reset
      setTitle('');
      setDescription('');
      setLocationText('');
      setSimilarTickets([]);
      setSimilarityIgnored(false);
      setAttachments([]);

      onTicketCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Report Campus Facility Issue</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Submit an issue to {activeCampus?.name || 'campus facilities'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* Description with AI Assistant button */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-gray-700">Detailed Problem Description *</label>
              <button
                type="button"
                onClick={handleAiParse}
                disabled={isAiParsing || !description.trim()}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isAiParsing ? 'Analyzing...' : 'AI Auto-Fill Fields'}
              </button>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what is malfunctioning, hazard conditions, and room/hallway details..."
              className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Issue Title */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Issue Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Broken water fountain on 2nd floor Engineering Hall"
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* AI Similar Tickets Warning */}
          {similarTickets.length > 0 && !similarityIgnored && (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Similar Active Issue Already Reported Nearby
                </span>
                {isCheckingSimilarity && <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />}
              </div>
              <p className="text-[11px] text-amber-800">
                A similar issue is already queued in maintenance. You can endorse it instead of creating duplicate records:
              </p>
              {similarTickets.map((st: any) => (
                <div
                  key={st.ticketId}
                  className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center justify-between"
                >
                  <div className="pr-3">
                    <p className="font-semibold text-gray-900">{st.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{st.explanation}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEndorseExisting(st.ticketId)}
                    className="btn-primary py-1 px-3 text-xs bg-amber-600 hover:bg-amber-700 flex items-center gap-1 flex-shrink-0"
                  >
                    <ThumbsUp className="w-3 h-3" />
                    Endorse Issue
                  </button>
                </div>
              ))}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setSimilarityIgnored(true)}
                  className="text-gray-500 hover:text-gray-700 underline text-[11px]"
                >
                  My issue is different, proceed with submission
                </button>
              </div>
            </div>
          )}

          {/* Location & Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Location Details</label>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Building, Floor, Room number"
                className="w-full p-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg bg-white"
              >
                <option value="LOW">LOW</option>
                <option value="MODERATE">MODERATE</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          {/* Photo & Video Evidence Attachments */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Photo or Video Evidence (Optional)
            </label>
            <div className="border border-dashed border-gray-300 rounded-xl p-3 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors shadow-sm">
                  {isUploadingMedia ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  ) : (
                    <Paperclip className="w-3.5 h-3.5" />
                  )}
                  {isUploadingMedia ? 'Uploading...' : 'Attach Image or Video'}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,application/pdf"
                    onChange={handleFileUpload}
                    disabled={isUploadingMedia}
                  />
                </label>
                <span className="text-[11px] text-gray-400">
                  Images (PNG, JPG, WEBP), Videos (MP4, MOV), & PDF up to 50MB
                </span>
              </div>

              {mediaUploadError && (
                <p className="text-red-500 text-xs mt-2">⚠️ {mediaUploadError}</p>
              )}

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-gray-100">
                  {attachments.map((att, idx) => {
                    const isImg = att.mimeType.startsWith('image/');
                    const isVideo = att.mimeType.startsWith('video/');
                    const previewUrl = att.url?.startsWith('http') ? att.url : `/uploads/attachments/${att.filepath}`;
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-1.5 bg-white border border-gray-200 rounded-lg text-xs shadow-sm max-w-[200px]"
                      >
                        {isImg ? (
                          <img
                            src={previewUrl}
                            alt={att.filename}
                            className="w-7 h-7 rounded object-cover flex-shrink-0"
                          />
                        ) : isVideo ? (
                          <div className="w-7 h-7 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Video className="w-4 h-4 text-blue-600" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                        <span className="truncate text-gray-700 font-medium" title={att.filename}>
                          {att.filename}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.filepath)}
                          className="text-gray-400 hover:text-red-500 p-0.5 rounded flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Checkboxes */}
          <div className="pt-2 border-t border-gray-100 flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isCritical}
                onChange={(e) => setIsCritical(e.target.checked)}
                className="rounded"
              />
              Mark as Critical Safety Hazard (Fast 48h Escalation)
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded"
              />
              Submit Anonymously
            </label>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary py-1.5 px-4">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary py-1.5 px-5 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Create Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
