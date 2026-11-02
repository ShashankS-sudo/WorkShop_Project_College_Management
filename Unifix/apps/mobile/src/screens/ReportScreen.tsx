import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { styles, colors } from '../styles/theme';
import { Campus, AIAnalysisResult } from '../types';
import { MobileApiClient } from '../api/mobileClient';

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

  // Form Fields
  const [reportTitle, setReportTitle] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');
  const [reportLocation, setReportLocation] = useState<string>('');
  const [reportSeverity, setReportSeverity] = useState<string>('MODERATE');
  const [reportIsAnonymous, setReportIsAnonymous] = useState<boolean>(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);

  const handleAnalyzeWithAI = async () => {
    if (!aiPrompt.trim() || !campus) return;

    setIsAnalyzing(true);
    setSimilarTickets([]);
    setAiAnalysisResult(null);

    try {
      // 1. Natural Language Parse
      const parseRes: any = await MobileApiClient.parseWithAI(aiPrompt.trim(), campus.id);
      const parsed = parseRes.data;

      if (parsed) {
        setAiAnalysisResult(parsed);
        setReportTitle(parsed.suggestedTitle || '');
        setReportDescription(aiPrompt.trim());
        setReportLocation(parsed.suggestedLocation || '');
        setReportSeverity(parsed.suggestedSeverity || 'MODERATE');

        // 2. Similarity Check to prevent duplicates
        try {
          const simRes: any = await MobileApiClient.checkSimilarity(aiPrompt.trim(), campus.id);
          if (simRes.data && simRes.data.length > 0) {
            setSimilarTickets(simRes.data);
          }
        } catch {
          // Similarity check non-fatal
        }
      }
    } catch (err: any) {
      Alert.alert('AI Processing Error', err.message || 'Could not parse issue. Please use the manual form.');
      setReportingMode('manual');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!reportTitle.trim()) {
      Alert.alert('Validation Error', 'Please enter an issue title.');
      return;
    }
    if (!reportDescription.trim()) {
      Alert.alert('Validation Error', 'Please describe the problem.');
      return;
    }
    if (!campus) return;

    setIsSubmittingReport(true);
    try {
      await MobileApiClient.createTicket({
        campusId: campus.id,
        title: reportTitle.trim(),
        description: reportDescription.trim(),
        severity: reportSeverity,
        locationDetails: reportLocation.trim() || undefined,
        isAnonymous: reportIsAnonymous,
      });

      Alert.alert('Success', 'Your issue report has been queued for campus maintenance action.');

      // Reset
      setAiPrompt('');
      setReportTitle('');
      setReportDescription('');
      setReportLocation('');
      setAiAnalysisResult(null);
      setSimilarTickets([]);

      onTicketCreated();
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Could not submit issue.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Mode Switcher */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          onPress={() => setReportingMode('ai')}
          style={[styles.modeTab, reportingMode === 'ai' && styles.modeTabActive]}
        >
          <Text style={[styles.modeTabText, reportingMode === 'ai' && styles.modeTabTextActive]}>
            ✨ AI-Assisted Report
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setReportingMode('manual')}
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
          {similarTickets.length > 0 && (
            <View style={styles.duplicateBox}>
              <Text style={styles.duplicateTitle}>Similar Existing Reports Detected</Text>
              <Text style={styles.duplicateSubtitle}>
                Has someone already reported this? Tap "I have this issue too" to endorse it:
              </Text>
              {similarTickets.map((st) => (
                <View key={st.ticketId} style={styles.duplicateItem}>
                  <Text style={styles.duplicateItemTitle}>{st.title}</Text>
                  <Text style={styles.duplicateItemReason}>{st.explanation}</Text>
                  <TouchableOpacity
                    onPress={() => onEndorseExisting(st.ticketId)}
                    style={styles.endorseButton}
                  >
                    <Text style={styles.endorseButtonText}>I have this issue too</Text>
                  </TouchableOpacity>
                </View>
              ))}
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

              {/* Follow-up Clarification Questions */}
              {aiAnalysisResult.followUpQuestions && aiAnalysisResult.followUpQuestions.length > 0 && (
                <View style={styles.questionsBox}>
                  <Text style={styles.questionHeading}>Clarification Needed:</Text>
                  {aiAnalysisResult.followUpQuestions.map((q: string, idx: number) => (
                    <Text key={idx} style={styles.questionText}>• {q}</Text>
                  ))}
                </View>
              )}

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
        /* Mode A: Manual Form */
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
