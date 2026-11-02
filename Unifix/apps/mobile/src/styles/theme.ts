import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#0071e3',
  primaryLight: '#eaf3ff',
  background: '#fbfbfd',
  card: '#ffffff',
  text: '#1d1d1f',
  textSecondary: '#6e6e73',
  textMuted: '#86868b',
  border: '#e5e5ea',
  inputBg: '#f5f5f7',
  danger: '#ff3b30',
  warning: '#ff9500',
  success: '#34c759',
  purple: '#af52de',
  yellowBg: '#fff8ea',
  yellowBorder: '#ffe0b2',
  yellowText: '#b76e00',
  greenBg: '#f0fdf4',
  greenBorder: '#bbf7d0',
  greenText: '#166534',
};

/**
 * Calculate stage countdown (21-day standard SLA / 48h critical SLA)
 */
export function getStageCountdown(stageStartTime?: string, isCritical?: boolean): string {
  if (!stageStartTime) return 'Active Stage Timer Running';
  const start = new Date(stageStartTime).getTime();
  const maxHours = isCritical ? 48 : 21 * 24;
  const elapsedHours = (Date.now() - start) / (1000 * 3600);
  const remainingHours = Math.max(0, Math.floor(maxHours - elapsedHours));

  if (remainingHours === 0) {
    return '⚠️ Stage Escalation Overdue';
  }

  if (isCritical) {
    return `Critical Fast-Track: ${remainingHours}h remaining`;
  }

  const remainingDays = Math.ceil(remainingHours / 24);
  return `Stage Escalation Clock: ${remainingDays} days remaining`;
}

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  authContainer: { flex: 1, backgroundColor: colors.background },
  authScroll: { padding: 24, alignItems: 'center' },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  logoText: { color: '#ffffff', fontSize: 32, fontWeight: 'bold' },
  appTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 16 },
  appSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, textAlign: 'center' },
  authCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  campusPickerContainer: { marginTop: 6, gap: 8 },
  campusOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  campusOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  campusOptionText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  campusOptionTextSelected: { color: colors.primary, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
    color: colors.text,
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  otpInput: { textAlign: 'center', fontSize: 22, fontWeight: 'bold', letterSpacing: 6 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '500' },
  infoBanner: { backgroundColor: colors.primaryLight, padding: 10, borderRadius: 8, marginBottom: 12 },
  infoBannerText: { color: colors.primary, fontSize: 12, fontWeight: '500' },
  anonToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, borderColor: '#c7c7cc' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  anonText: { fontSize: 13, color: colors.textSecondary },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  headerSubtitle: { fontSize: 11, color: colors.textMuted },
  logoutButton: { padding: 6 },
  logoutText: { fontSize: 12, color: colors.danger, fontWeight: '500' },

  // Main Body
  mainContent: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: colors.text },
  refreshBtn: { padding: 4 },
  refreshBtnText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  modeTabs: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 10, padding: 2, marginBottom: 14 },
  modeTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  modeTabActive: { backgroundColor: colors.card },
  modeTabText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  modeTabTextActive: { color: colors.text, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardHeading: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSubheading: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 10 },

  // Duplicate box
  duplicateBox: { backgroundColor: colors.yellowBg, borderWidth: 1, borderColor: colors.yellowBorder, borderRadius: 12, padding: 12, marginTop: 14 },
  duplicateTitle: { fontSize: 13, fontWeight: '700', color: colors.yellowText },
  duplicateSubtitle: { fontSize: 11, color: '#8c5300', marginTop: 2, marginBottom: 8 },
  duplicateItem: { backgroundColor: colors.card, borderRadius: 8, padding: 10, marginBottom: 6 },
  duplicateItemTitle: { fontSize: 12, fontWeight: '600', color: colors.text },
  duplicateItemReason: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  endorseButton: { backgroundColor: '#ff9f0a', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginTop: 6, alignSelf: 'flex-start' },
  endorseButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },

  // Confirmation box
  confirmationBox: { backgroundColor: colors.greenBg, borderWidth: 1, borderColor: colors.greenBorder, borderRadius: 12, padding: 12, marginTop: 14 },
  confirmationTitle: { fontSize: 14, fontWeight: '700', color: colors.greenText },
  confirmationNotice: { fontSize: 11, color: '#15803d', marginTop: 2, marginBottom: 8 },
  readOnlyBadge: { backgroundColor: '#dcfce7', borderRadius: 6, padding: 8, marginTop: 4 },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.greenText },
  questionsBox: { backgroundColor: colors.card, borderRadius: 8, padding: 10, marginTop: 8 },
  questionHeading: { fontSize: 11, fontWeight: '700', color: '#b45309' },
  questionText: { fontSize: 11, color: '#78350f', marginTop: 2 },

  // Severity row
  severityRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  severityPill: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.inputBg, alignItems: 'center' },
  severityPillActive: { backgroundColor: colors.primary },
  severityPillText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  severityPillTextActive: { color: '#ffffff' },

  // Ticket card
  ticketCard: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  ticketCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketCategory: { fontSize: 11, fontWeight: '600', color: colors.primary },
  ticketStatus: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  statusPillBadge: { backgroundColor: colors.inputBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ticketTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
  ticketDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderColor: colors.inputBg },
  ticketLocation: { fontSize: 11, color: colors.textMuted },
  smallEndorseBtn: { backgroundColor: colors.inputBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  smallEndorseText: { fontSize: 11, fontWeight: '600', color: colors.text },
  stageBadge: { fontSize: 11, fontWeight: '700', color: colors.purple },
  countdownBanner: { backgroundColor: colors.inputBg, padding: 8, borderRadius: 6, marginTop: 8 },
  countdownText: { fontSize: 11, fontWeight: '500', color: colors.text },
  resolutionNotice: { fontSize: 11, fontWeight: '600', color: colors.success, marginTop: 6 },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: 40 },

  // Notifications
  notifCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  notifCardUnread: { backgroundColor: '#f0f7ff', borderColor: '#bfe0ff' },
  notifHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  notifBody: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  notifTime: { fontSize: 10, color: colors.textMuted, marginTop: 6 },

  // Bottom Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 10,
    paddingBottom: 20,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabText: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  badgeIndicator: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: colors.card },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  closeBtn: { padding: 4 },
  closeBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  modalContent: { padding: 20, paddingBottom: 40 },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  detailTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  detailDesc: { fontSize: 14, color: '#424245', lineHeight: 20, marginBottom: 16 },
  metaCard: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  metaValue: { fontSize: 12, color: colors.text, fontWeight: '600' },
  stageCountdownCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  stageCountdownTitle: { fontSize: 13, fontWeight: '700', color: colors.purple },
  stageCountdownSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  stageCountdownAlert: { fontSize: 12, fontWeight: '500', color: colors.text, marginTop: 6 },
  endorseActionBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  endorseActionText: { color: colors.primary, fontWeight: '600', fontSize: 13 },

  // Resolution & Reopen
  resolutionBox: {
    backgroundColor: colors.greenBg,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  resolutionTitle: { fontSize: 14, fontWeight: '700', color: colors.greenText },
  resolutionDetails: { fontSize: 12, color: '#15803d', marginTop: 4 },
  reopenPromptBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reopenPromptText: { color: colors.warning, fontWeight: '600', fontSize: 12 },
  reopenFormBox: { marginTop: 8 },
  reopenFormHeading: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 },
  reopenButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  cancelBtn: { padding: 8 },
  cancelBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  confirmReopenBtn: {
    backgroundColor: colors.warning,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmReopenText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },

  // Comments
  commentsSection: { marginTop: 12, borderTopWidth: 1, borderColor: colors.border, paddingTop: 16 },
  commentsHeading: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  commentItem: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentAuthor: { fontSize: 12, fontWeight: '600', color: colors.text },
  commentDate: { fontSize: 10, color: colors.textMuted },
  commentContent: { fontSize: 13, color: '#333336' },
  addCommentBox: { flexDirection: 'row', gap: 8, marginTop: 8 },
  commentInput: { flex: 1, marginTop: 0 },
  postCommentBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postCommentBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
});
