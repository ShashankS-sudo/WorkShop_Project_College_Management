import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { styles, colors } from '../styles/theme';
import { Campus, AIAnalysisResult } from '../types';
import { MobileApiClient } from '../api/mobileClient';

interface UploadedMedia {
  filename: string;
  filepath: string;
  url: string;
  mimeType: string;
  size: number;
}

interface ReportScreenProps {
  campus: Campus | null;
  onTicketCreated: () => void;
  onEndorseExisting: (ticketId: string) => Promise<void>;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  campus,
  onTicketCreated,
  onEndorseExisting,
}) => {
  const [reportingMode, setReportingMode] = useState<'ai' | 'manual'>('ai');
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [similarTickets, setSimilarTickets] = useState<any[]>([]);
  const [isCheckingSimilarity, setIsCheckingSimilarity] = useState<boolean>(false);
  const [similarityIgnored, setSimilarityIgnored] = useState<boolean>(false);
  const [endorsingTicketId, setEndorsingTicketId] = useState<string | null>(null);
  const [endorsedTicketIds, setEndorsedTicketIds] = useState<string[]>([]);

  const handleEndorseClick = async (ticketId: string) => {
    if (endorsingTicketId) return;
    setEndorsingTicketId(ticketId);
    try {
      await onEndorseExisting(ticketId);
      setEndorsedTicketIds((prev) => [...prev, ticketId]);
    } catch (err: any) {
      if (err?.message && String(err.message).toLowerCase().includes('already endorsed')) {
        setEndorsedTicketIds((prev) => [...prev, ticketId]);
      }
    } finally {
      setEndorsingTicketId(null);
    }
  };

  // Form Fields
  const [reportTitle, setReportTitle] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');
  const [reportLocation, setReportLocation] = useState<string>('');
  const [reportSeverity, setReportSeverity] = useState<string>('MODERATE');
  const [reportIsAnonymous, setReportIsAnonymous] = useState<boolean>(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);

  // Media Attachments
  const [attachments, setAttachments] = useState<UploadedMedia[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const notifyUser = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleCaptureCameraPhoto = () => {
    setUploadError(null);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      // Triggers physical mobile camera immediately
      input.setAttribute('capture', 'environment');
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;

        setIsUploadingMedia(true);
        try {
          const formData = new FormData();
          formData.append('file', file, `camera_capture_${Date.now()}.jpg`);
          const res: any = await MobileApiClient.uploadAttachment(formData);
          if (res?.data) {
            setAttachments((prev) => [...prev, res.data]);
          }
        } catch (err: any) {
          setUploadError(err.message || 'Failed to capture photo from camera.');
        } finally {
          setIsUploadingMedia(false);
        }
      };
      input.click();
    } else {
      notifyUser('Notice', 'Direct camera capture is available in mobile browser preview.');
    }
  };

  const handlePickAndUploadMedia = () => {
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
          const res: any = await MobileApiClient.uploadAttachment(formData);
          if (res?.data) {
            setAttachments((prev) => [...prev, res.data]);
          }
        } catch (err: any) {
          setUploadError(err.message || 'Failed to upload media file.');
        } finally {
          setIsUploadingMedia(false);
        }
      };
      input.click();
    } else {
      notifyUser('Notice', 'Media upload is available in web preview or with camera roll permissions.');
    }
  };

  const handleRemoveAttachment = (filepath: string) => {
    setAttachments((prev) => prev.filter((a) => a.filepath !== filepath));
  };

  // Support pasting images from clipboard (Ctrl+V) on web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handlePaste = async (e: any) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            setIsUploadingMedia(true);
            setUploadError(null);
            try {
              const formData = new FormData();
              formData.append('file', file, `pasted_image_${Date.now()}.png`);
              const res: any = await MobileApiClient.uploadAttachment(formData);
              if (res?.data) {
                setAttachments((prev) => [...prev, res.data]);
              }
            } catch (err: any) {
              setUploadError(err.message || 'Failed to upload pasted image');
            } finally {
              setIsUploadingMedia(false);
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Debounced real-time similarity check on both AI prompt and manual inputs
  useEffect(() => {
    if (!campus || similarityIgnored) return;

    const query = reportingMode === 'ai'
      ? aiPrompt.trim()
      : `${reportTitle} ${reportDescription} ${reportLocation}`.trim();

    if (query.length < 4) {
      setSimilarTickets([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingSimilarity(true);
      try {
        const simRes: any = await MobileApiClient.checkSimilarityWithAI(
          campus.id,
          query,
          reportingMode === 'ai' ? undefined : reportTitle,
          reportingMode === 'ai' ? undefined : reportLocation
        );
        const matches = Array.isArray(simRes?.data)
          ? simRes.data
          : simRes?.data?.matches || simRes?.matches || [];
        setSimilarTickets(matches);
      } catch {
        // Non-fatal
      } finally {
        setIsCheckingSimilarity(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [aiPrompt, reportTitle, reportDescription, reportLocation, campus?.id, reportingMode, similarityIgnored]);

  const handleAnalyzeWithAI = async () => {
    if (!aiPrompt.trim() || !campus) return;

    setIsAnalyzing(true);
    setSimilarTickets([]);
    setSimilarityIgnored(false);
    setAiAnalysisResult(null);

    try {
      // 1. Natural Language Parse
      const parseRes: any = await MobileApiClient.parseWithAI(aiPrompt.trim(), campus.id);
      const parsed = parseRes.data;

      if (parsed) {
        setAiAnalysisResult(parsed);
        setReportTitle(parsed.suggestedTitle || aiPrompt.trim().slice(0, 60));
        setReportDescription(parsed.summary || aiPrompt.trim());
        setReportLocation(parsed.extractedLocation || '');
        setReportSeverity(parsed.suggestedSeverity || 'MODERATE');

        // 2. Similarity Check to prevent duplicates
        try {
          const simRes: any = await MobileApiClient.checkSimilarityWithAI(
            campus.id,
            aiPrompt.trim(),
            parsed.suggestedTitle,
            parsed.extractedLocation
          );
          const matches = Array.isArray(simRes?.data)
            ? simRes.data
            : simRes?.data?.matches || simRes?.matches || [];
          setSimilarTickets(matches);
        } catch {
          // Similarity check non-fatal
        }
      }
    } catch (err: any) {
      notifyUser('AI Processing Error', err.message || 'Could not parse issue. Please use the manual form.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitTicket = async () => {
    const finalTitle = (reportTitle || aiAnalysisResult?.suggestedTitle || aiPrompt || '').trim();
    if (!finalTitle || finalTitle.length < 3) {
      notifyUser('Validation Error', 'Please enter an issue title (minimum 3 characters).');
      return;
    }

    let finalDesc = (reportDescription || aiPrompt || finalTitle).trim();
    if (finalDesc.length < 5) {
      finalDesc = `${finalTitle}: ${finalDesc}`.trim();
    }
    if (finalDesc.length < 5) {
      finalDesc = finalDesc.padEnd(5, '.');
    }

    if (!campus) return;

    setIsSubmittingReport(true);
    try {
      await MobileApiClient.createTicket({
        campusId: campus.id,
        title: finalTitle,
        description: finalDesc,
        severity: reportSeverity,
        locationDetails: (reportLocation || aiAnalysisResult?.suggestedLocation || '').trim() || undefined,
        categoryName: aiAnalysisResult?.suggestedCategory || undefined,
        isAnonymous: reportIsAnonymous,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          filepath: a.filepath,
          mimeType: a.mimeType,
          size: a.size,
        })),
      });

      notifyUser('Success', 'Your issue report has been queued for campus maintenance action.');

      // Reset
      setAiPrompt('');
      setReportTitle('');
      setReportDescription('');
      setReportLocation('');
      setAiAnalysisResult(null);
      setSimilarTickets([]);
      setSimilarityIgnored(false);
      setAttachments([]);

      onTicketCreated();
    } catch (err: any) {
      notifyUser('Submission Failed', err.message || 'Could not submit issue.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const renderMediaUploader = () => {
    const host = MobileApiClient.getHost();

    return (
      <View style={{ marginTop: 12, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Photo / Video Evidence (Optional)</Text>
          <Text style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>Optional • Ctrl+V to paste</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          {/* Direct Mobile Camera Button */}
          <TouchableOpacity
            onPress={handleCaptureCameraPhoto}
            disabled={isUploadingMedia}
            style={{
              flex: 1,
              backgroundColor: '#2563eb',
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>
              📸 Take Photo
            </Text>
            <Text style={{ color: '#bfdbfe', fontSize: 10, marginTop: 2 }}>
              Direct camera snap
            </Text>
          </TouchableOpacity>

          {/* Files / Gallery Button */}
          <TouchableOpacity
            onPress={handlePickAndUploadMedia}
            disabled={isUploadingMedia}
            style={{
              flex: 1,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: '#93c5fd',
              backgroundColor: '#eff6ff',
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#2563eb', fontSize: 13, fontWeight: '700' }}>
              📁 Choose File
            </Text>
            <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
              Gallery, Video, PDF
            </Text>
          </TouchableOpacity>
        </View>

        {isUploadingMedia && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, padding: 8, backgroundColor: '#eff6ff', borderRadius: 8 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ marginLeft: 8, color: '#1e40af', fontSize: 12, fontWeight: '600' }}>
              Uploading evidence to server...
            </Text>
          </View>
        )}

        {uploadError && (
          <View style={{ backgroundColor: '#fee2e2', borderRadius: 6, padding: 8, marginTop: 8 }}>
            <Text style={{ color: '#b91c1c', fontSize: 12 }}>⚠️ {uploadError}</Text>
          </View>
        )}

        {attachments.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {attachments.map((att, idx) => {
              const isImg = att.mimeType?.startsWith('image/');
              const isVideo = att.mimeType?.startsWith('video/');
              const imgUri = att.url?.startsWith('http')
                ? att.url
                : `${host}${att.url?.startsWith('/') ? '' : '/'}${att.url || ''}`;

              return (
              <View key={idx} style={{ marginRight: 10, alignItems: 'center', width: 84 }}>
                <View
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 8,
                    overflow: 'hidden',
                    backgroundColor: '#e2e8f0',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                  }}
                >
                  {isImg ? (
                    <Image source={{ uri: imgUri }} style={{ width: 76, height: 76 }} />
                  ) : isVideo ? (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 22 }}>🎥</Text>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#1e293b' }}>VIDEO</Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 22 }}>📄</Text>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#1e293b' }}>PDF</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => handleRemoveAttachment(att.filepath)}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>×</Text>
                  </TouchableOpacity>
                </View>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 10, color: '#475569', marginTop: 4, width: 76, textAlign: 'center' }}
                >
                  {att.filename}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Mode Switcher */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          onPress={() => {
            setReportingMode('ai');
            setSimilarityIgnored(false);
          }}
          style={[styles.modeTab, reportingMode === 'ai' && styles.modeTabActive]}
        >
          <Text style={[styles.modeTabText, reportingMode === 'ai' && styles.modeTabTextActive]}>
            ✨ AI-Assisted Report
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setReportingMode('manual');
            setSimilarityIgnored(false);
          }}
          style={[styles.modeTab, reportingMode === 'manual' && styles.modeTabActive]}
        >
          <Text style={[styles.modeTabText, reportingMode === 'manual' && styles.modeTabTextActive]}>
            Manual Form
          </Text>
        </TouchableOpacity>
      </View>

      {reportingMode === 'ai' ? (
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Describe the issue in your own words</Text>
          <Text style={styles.cardSubheading}>
            e.g., "The hallway light outside Chemistry Lab 301 has been flickering loudly and sparking since this morning."
          </Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={4}
            value={aiPrompt}
            onChangeText={setAiPrompt}
            placeholder="What is the problem and where is it located?"
          />

          <TouchableOpacity
            onPress={handleAnalyzeWithAI}
            disabled={isAnalyzing || !aiPrompt.trim()}
            style={styles.primaryButton}
          >
            {isAnalyzing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Analyze Issue with AI</Text>
            )}
          </TouchableOpacity>

          {/* Similar Tickets Warning */}
          {similarTickets.length > 0 && !similarityIgnored && (
            <View style={styles.duplicateBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.duplicateTitle}>⚡ Similar Issue Already Reported</Text>
                {isCheckingSimilarity && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
              <Text style={styles.duplicateSubtitle}>
                Campus maintenance is already tracking this! Save time by endorsing it instead:
              </Text>
              {similarTickets.map((st) => (
                <View key={st.ticketId} style={styles.duplicateItem}>
                  <Text style={styles.duplicateItemTitle}>{st.title}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                    {st.categoryName && (
                      <View style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: '#3730a3', fontWeight: '600' }}>{st.categoryName}</Text>
                      </View>
                    )}
                    {st.locationText && (
                      <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: '#92400e', fontWeight: '600' }}>📍 {st.locationText}</Text>
                      </View>
                    )}
                    {st.status && (
                      <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: '#166534', fontWeight: '600' }}>{st.status}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.duplicateItemReason}>{st.explanation}</Text>
                  {st.hasEndorsed || endorsedTicketIds.includes(st.ticketId) ? (
                    <View style={[styles.endorseButton, { backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={styles.endorseButtonText}>✅ You have endorsed this issue</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleEndorseClick(st.ticketId)}
                      disabled={endorsingTicketId === st.ticketId}
                      style={[
                        styles.endorseButton,
                        endorsingTicketId === st.ticketId && { opacity: 0.7 },
                      ]}
                    >
                      {endorsingTicketId === st.ticketId ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                          <Text style={styles.endorseButtonText}>Recording Endorsement...</Text>
                        </View>
                      ) : (
                        <Text style={styles.endorseButtonText}>👍 I have this issue too (Endorse)</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setSimilarityIgnored(true)}
                style={{ marginTop: 8, paddingVertical: 4, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 11, color: '#6b7280', textDecorationLine: 'underline' }}>
                  My issue is different, proceed with submission
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* AI Extracted Confirmation Screen */}
          {aiAnalysisResult && (
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmationTitle}>Review Before Submission</Text>
              <Text style={styles.confirmationNotice}>
                AI extracted the fields below. You can edit them before confirming:
              </Text>

              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.input}
                value={reportTitle}
                onChangeText={setReportTitle}
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.readOnlyBadge}>
                <Text style={styles.badgeText}>{aiAnalysisResult.suggestedCategory}</Text>
              </View>

              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.input}
                value={reportLocation}
                onChangeText={setReportLocation}
                placeholder="Room, floor, or building..."
              />

              <Text style={styles.fieldLabel}>Detailed Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={reportDescription}
                onChangeText={setReportDescription}
                placeholder="Details of the issue..."
              />

              {/* Follow-up Clarification Questions */}
              {aiAnalysisResult.followUpQuestions && aiAnalysisResult.followUpQuestions.length > 0 && (
                <View style={styles.questionsBox}>
                  <Text style={styles.questionHeading}>Clarification Needed:</Text>
                  {aiAnalysisResult.followUpQuestions.map((q: string, idx: number) => (
                    <Text key={idx} style={styles.questionText}>• {q}</Text>
                  ))}
                </View>
              )}

              {/* Photo / Video Uploader */}
              {renderMediaUploader()}

              <TouchableOpacity
                onPress={() => setReportIsAnonymous(!reportIsAnonymous)}
                style={styles.anonToggle}
              >
                <View style={[styles.checkbox, reportIsAnonymous && styles.checkboxActive]} />
                <Text style={styles.anonText}>Submit as Anonymous Report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmitTicket}
                disabled={isSubmittingReport}
                style={[styles.primaryButton, { backgroundColor: colors.success }]}
              >
                {isSubmittingReport ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Confirm & Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        /* Mode B: Manual Form */
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Manual Issue Form</Text>

          <Text style={styles.fieldLabel}>Issue Title *</Text>
          <TextInput
            style={styles.input}
            value={reportTitle}
            onChangeText={setReportTitle}
            placeholder="Short, descriptive headline"
          />

          <Text style={styles.fieldLabel}>Detailed Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={4}
            value={reportDescription}
            onChangeText={setReportDescription}
            placeholder="Explain what is broken or malfunctioning..."
          />

          {/* Interactive Similar Issues Warning for Manual Form */}
          {similarTickets.length > 0 && !similarityIgnored && (
            <View style={styles.duplicateBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.duplicateTitle}>⚡ Similar Issue Already Reported Nearby</Text>
                {isCheckingSimilarity && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
              <Text style={styles.duplicateSubtitle}>
                Campus maintenance is already tracking this issue. You can endorse it instead of creating a duplicate:
              </Text>
              {similarTickets.map((st) => (
                <View key={st.ticketId} style={styles.duplicateItem}>
                  <Text style={styles.duplicateItemTitle}>{st.title}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                    {st.categoryName && (
                      <View style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: '#3730a3', fontWeight: '600' }}>{st.categoryName}</Text>
                      </View>
                    )}
                    {st.locationText && (
                      <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: '#92400e', fontWeight: '600' }}>📍 {st.locationText}</Text>
                      </View>
                    )}
                    {st.status && (
                      <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: '#166534', fontWeight: '600' }}>{st.status}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.duplicateItemReason}>{st.explanation}</Text>
                  {st.hasEndorsed || endorsedTicketIds.includes(st.ticketId) ? (
                    <View style={[styles.endorseButton, { backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={styles.endorseButtonText}>✅ You have endorsed this issue</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleEndorseClick(st.ticketId)}
                      disabled={endorsingTicketId === st.ticketId}
                      style={[
                        styles.endorseButton,
                        endorsingTicketId === st.ticketId && { opacity: 0.7 },
                      ]}
                    >
                      {endorsingTicketId === st.ticketId ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                          <Text style={styles.endorseButtonText}>Recording Endorsement...</Text>
                        </View>
                      ) : (
                        <Text style={styles.endorseButtonText}>👍 I have this issue too (Endorse)</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setSimilarityIgnored(true)}
                style={{ marginTop: 8, paddingVertical: 4, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 11, color: '#6b7280', textDecorationLine: 'underline' }}>
                  My issue is different, proceed with submission
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.fieldLabel}>Location (Building / Floor / Room)</Text>
          <TextInput
            style={styles.input}
            value={reportLocation}
            onChangeText={setReportLocation}
            placeholder="e.g. Science Hall 3rd Floor"
          />

          <Text style={styles.fieldLabel}>Severity</Text>
          <View style={styles.severityRow}>
            {['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'].map((sev) => (
              <TouchableOpacity
                key={sev}
                onPress={() => setReportSeverity(sev)}
                style={[
                  styles.severityPill,
                  reportSeverity === sev && styles.severityPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.severityPillText,
                    reportSeverity === sev && styles.severityPillTextActive,
                  ]}
                >
                  {sev}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Photo / Video Uploader */}
          {renderMediaUploader()}

          <TouchableOpacity
            onPress={() => setReportIsAnonymous(!reportIsAnonymous)}
            style={styles.anonToggle}
          >
            <View style={[styles.checkbox, reportIsAnonymous && styles.checkboxActive]} />
            <Text style={styles.anonText}>Submit Anonymously</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmitTicket}
            disabled={isSubmittingReport}
            style={styles.primaryButton}
          >
            {isSubmittingReport ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};
