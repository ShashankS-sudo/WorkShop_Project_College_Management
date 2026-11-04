import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { styles, getStageCountdown, colors } from '../styles/theme';
import { Ticket, User } from '../types';
import { MobileApiClient } from '../api/mobileClient';

interface TicketDetailModalProps {
  visible: boolean;
  ticket: Ticket | null;
  currentUser: User | null;
  isLoading: boolean;
  onClose: () => void;
  onEndorse: (ticketId: string) => Promise<void>;
  onAddComment: (content: string) => Promise<void>;
  onReopen: (reason: string) => Promise<void>;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  visible,
  ticket,
  currentUser,
  isLoading,
  onClose,
  onEndorse,
  onAddComment,
  onReopen,
}) => {
  const [commentInput, setCommentInput] = useState<string>('');
  const [isPostingComment, setIsPostingComment] = useState<boolean>(false);
  const [isReopening, setIsReopening] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [isSubmittingReopen, setIsSubmittingReopen] = useState<boolean>(false);

  // Attachments State
  const [attachments, setAttachments] = useState<any[]>(ticket?.attachments || []);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setAttachments(ticket?.attachments || []);
    setUploadError(null);
  }, [ticket?.id, ticket?.attachments]);

  const handleCaptureCamera = () => {
    if (!ticket) return;
    setUploadError(null);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('capture', 'environment');
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;

        setIsUploadingMedia(true);
        try {
          const formData = new FormData();
          formData.append('file', file, `camera_capture_${Date.now()}.jpg`);
          const uploadRes: any = await MobileApiClient.uploadAttachment(formData);
          if (uploadRes?.data) {
            const { filename, filepath, mimeType, size } = uploadRes.data;
            const attachRes: any = await MobileApiClient.addTicketAttachment(ticket.id, {
              filename,
              filepath,
              mimeType,
              size,
            });
            const newAtt = attachRes.attachment || attachRes.data || uploadRes.data;
            setAttachments((prev) => [...prev, newAtt]);
          }
        } catch (err: any) {
          setUploadError(err.message || 'Failed to capture photo from camera.');
        } finally {
          setIsUploadingMedia(false);
        }
      };
      input.click();
    } else {
      Alert.alert('Notice', 'Direct camera capture is available in mobile browser preview.');
    }
  };

  const handleAddMedia = () => {
    if (!ticket) return;
    setUploadError(null);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*,application/pdf';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;

        setIsUploadingMedia(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes: any = await MobileApiClient.uploadAttachment(formData);
          if (uploadRes?.data) {
            const { filename, filepath, mimeType, size } = uploadRes.data;
            const attachRes: any = await MobileApiClient.addTicketAttachment(ticket.id, {
              filename,
              filepath,
              mimeType,
              size,
            });
            const newAtt = attachRes.attachment || attachRes.data || uploadRes.data;
            setAttachments((prev) => [...prev, newAtt]);
          }
        } catch (err: any) {
          setUploadError(err.message || 'Failed to upload attachment.');
        } finally {
          setIsUploadingMedia(false);
        }
      };
      input.click();
    } else {
      Alert.alert('Notice', 'Media upload is available in web preview or with camera roll permissions.');
    }
  };

  const handlePostComment = async () => {
    if (!commentInput.trim() || isPostingComment) return;
    setIsPostingComment(true);
    try {
      await onAddComment(commentInput.trim());
      setCommentInput('');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleConfirmReopen = async () => {
    if (!reopenReason.trim() || isSubmittingReopen) return;
    setIsSubmittingReopen(true);
    try {
      await onReopen(reopenReason.trim());
      setIsReopening(false);
      setReopenReason('');
    } finally {
      setIsSubmittingReopen(false);
    }
  };

  const isReporter = currentUser && ticket && ticket.reporter?.id === currentUser.id;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Issue Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {isLoading || !ticket ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
          ) : (
            <ScrollView contentContainerStyle={styles.modalContent}>
              {/* Badges */}
              <View style={styles.badgeRow}>
                <View style={styles.statusPillBadge}>
                  <Text style={styles.ticketStatus}>{ticket.status}</Text>
                </View>
                <View style={styles.statusPillBadge}>
                  <Text style={[styles.ticketStatus, { color: colors.primary }]}>
                    {ticket.priority} PRIORITY
                  </Text>
                </View>
                {ticket.isCritical && (
                  <View style={[styles.statusPillBadge, { backgroundColor: '#fee2e2' }]}>
                    <Text style={[styles.ticketStatus, { color: colors.danger }]}>CRITICAL</Text>
                  </View>
                )}
              </View>

              <Text style={styles.detailTitle}>{ticket.title}</Text>
              <Text style={styles.detailDesc}>{ticket.description}</Text>

              {/* Stage Countdown Timer */}
              <View style={styles.stageCountdownCard}>
                <Text style={styles.stageCountdownTitle}>Stage: {ticket.currentStage}</Text>
                <Text style={styles.stageCountdownSub}>
                  Managed under 21-day stage escalation lifecycle
                </Text>
                <Text style={styles.stageCountdownAlert}>
                  {getStageCountdown(ticket.stageStartTime, ticket.isCritical)}
                </Text>
              </View>

              {/* Metadata Card */}
              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Category</Text>
                  <Text style={styles.metaValue}>{ticket.category?.name || 'General'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Location</Text>
                  <Text style={styles.metaValue}>{ticket.location?.name || 'Not specified'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Reporter</Text>
                  <Text style={styles.metaValue}>
                    {ticket.isAnonymous
                      ? 'Anonymous Reporter'
                      : ticket.reporter?.displayName ||
                        `${ticket.reporter?.firstName || ''} ${ticket.reporter?.lastName || ''}`.trim() ||
                        'Campus Member'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Endorsements</Text>
                  <Text style={styles.metaValue}>
                    {ticket._count?.endorsements || 0} members affected
                  </Text>
                </View>
              </View>

              {/* Endorse Action */}
              <TouchableOpacity
                onPress={() => onEndorse(ticket.id)}
                style={styles.endorseActionBtn}
              >
                <Text style={styles.endorseActionText}>
                  👍 I am affected by this issue ({ticket._count?.endorsements || 0})
                </Text>
              </TouchableOpacity>

              {/* Attachments Section */}
              <View style={[styles.metaCard, { marginTop: 12 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={[styles.metaLabel, { fontSize: 13, marginBottom: 0 }]}>
                    Photo & Video Evidence ({attachments.length})
                  </Text>
                  {ticket.status !== 'CLOSED' && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={handleCaptureCamera}
                        disabled={isUploadingMedia}
                        style={{
                          backgroundColor: '#2563eb',
                          paddingHorizontal: 8,
                          paddingVertical: 5,
                          borderRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#ffffff' }}>
                          📸 Camera
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleAddMedia}
                        disabled={isUploadingMedia}
                        style={{
                          backgroundColor: '#eff6ff',
                          paddingHorizontal: 8,
                          paddingVertical: 5,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#bfdbfe',
                        }}
                      >
                        {isUploadingMedia ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>
                            📁 Upload
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {uploadError && (
                  <View style={{ backgroundColor: '#fee2e2', borderRadius: 6, padding: 8, marginBottom: 8 }}>
                    <Text style={{ color: '#b91c1c', fontSize: 12 }}>⚠️ {uploadError}</Text>
                  </View>
                )}

                {attachments.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {attachments.map((att: any) => {
                      const host = MobileApiClient.getHost();
                      const isImg = att.mimeType?.startsWith('image/');
                      const isVideo = att.mimeType?.startsWith('video/');
                      const cleanPath = (att.filepath || att.url || '').replace(/^\/+/, '');
                      const imgUri = att.filepath?.startsWith('http')
                        ? att.filepath
                        : att.url?.startsWith('http')
                        ? att.url
                        : cleanPath.startsWith('uploads/attachments/')
                        ? `${host}/${cleanPath}`
                        : `${host}/uploads/attachments/${cleanPath}`;
                      return (
                        <View key={att.id || att.filepath} style={{ marginRight: 10, alignItems: 'center', width: 84 }}>
                          {isImg ? (
                            <Image
                              source={{ uri: imgUri }}
                              style={{ width: 76, height: 76, borderRadius: 8, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e2e8f0' }}
                            />
                          ) : isVideo ? (
                            <View
                              style={{
                                width: 76,
                                height: 76,
                                borderRadius: 8,
                                backgroundColor: '#f1f5f9',
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: '#cbd5e1',
                              }}
                            >
                              <Text style={{ fontSize: 24 }}>🎥</Text>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: '#334155', marginTop: 2 }}>VIDEO</Text>
                            </View>
                          ) : (
                            <View
                              style={{
                                width: 76,
                                height: 76,
                                borderRadius: 8,
                                backgroundColor: '#e0f2fe',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>PDF</Text>
                            </View>
                          )}
                          <Text
                            numberOfLines={1}
                            style={{ fontSize: 10, color: '#4b5563', marginTop: 4, width: 76, textAlign: 'center' }}
                          >
                            {att.filename}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 4 }}>
                    No photos or videos attached to this issue yet.
                  </Text>
                )}
              </View>

              {/* Resolution Box & Reopening Workflow */}
              {ticket.status === 'RESOLVED' && (
                <View style={styles.resolutionBox}>
                  <Text style={styles.resolutionTitle}>Issue Resolved</Text>
                  <Text style={styles.resolutionDetails}>
                    {ticket.resolutionSummary || 'Maintenance team marked this issue resolved.'}
                  </Text>

                  {isReporter && !isReopening && (
                    <TouchableOpacity
                      onPress={() => setIsReopening(true)}
                      style={[styles.reopenPromptBtn, { marginTop: 12 }]}
                    >
                      <Text style={styles.reopenPromptText}>Issue still persists? Reopen</Text>
                    </TouchableOpacity>
                  )}

                  {isReopening && (
                    <View style={styles.reopenFormBox}>
                      <Text style={styles.reopenFormHeading}>Explain why issue persists:</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        multiline
                        placeholder="Describe current status (minimum 10 characters)..."
                        value={reopenReason}
                        onChangeText={setReopenReason}
                      />
                      <View style={styles.reopenButtonsRow}>
                        <TouchableOpacity
                          onPress={() => setIsReopening(false)}
                          style={styles.cancelBtn}
                        >
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleConfirmReopen}
                          disabled={isSubmittingReopen || reopenReason.trim().length < 10}
                          style={styles.confirmReopenBtn}
                        >
                          {isSubmittingReopen ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.confirmReopenText}>Submit Reopen</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Comments Section */}
              <View style={styles.commentsSection}>
                <Text style={styles.commentsHeading}>
                  Comments ({ticket.comments?.length || 0})
                </Text>
                {ticket.comments?.map((c: any) => (
                  <View key={c.id} style={styles.commentItem}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{c.authorName || 'Campus Member'}</Text>
                      <Text style={styles.commentDate}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.commentContent}>{c.content}</Text>
                  </View>
                ))}

                <View style={styles.addCommentBox}>
                  <TextInput
                    style={[styles.input, styles.commentInput]}
                    placeholder="Add a public comment or update..."
                    value={commentInput}
                    onChangeText={setCommentInput}
                  />
                  <TouchableOpacity
                    onPress={handlePostComment}
                    disabled={isPostingComment || !commentInput.trim()}
                    style={styles.postCommentBtn}
                  >
                    {isPostingComment ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.postCommentBtnText}>Post</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};
