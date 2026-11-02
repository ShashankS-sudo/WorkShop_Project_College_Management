import React, { useState } from 'react';
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
} from 'react-native';
import { styles, getStageCountdown, colors } from '../styles/theme';
import { Ticket, User } from '../types';

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
