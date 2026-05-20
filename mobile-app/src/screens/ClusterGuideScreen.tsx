import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, ArrowRightLeft, Briefcase, Building2, CheckCircle2, GitBranch, Link2, ShieldCheck, Users } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface Props {
  onBack: () => void;
}

type ModeCard = {
  key: string;
  title: string;
  icon: any;
  accent: string;
  summary: string;
  bestFor: string;
  howItWorks: string;
};

export default function ClusterGuideScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const modeCards: ModeCard[] = [
    {
      key: 'single',
      title: t('clusterGuide.single.title'),
      icon: Building2,
      accent: '#2563eb',
      summary: t('clusterGuide.single.summary'),
      bestFor: t('clusterGuide.single.bestFor'),
      howItWorks: t('clusterGuide.single.howItWorks'),
    },
    {
      key: 'cluster',
      title: t('clusterGuide.cluster.title'),
      icon: Users,
      accent: '#16a34a',
      summary: t('clusterGuide.cluster.summary'),
      bestFor: t('clusterGuide.cluster.bestFor'),
      howItWorks: t('clusterGuide.cluster.howItWorks'),
    },
    {
      key: 'transferable',
      title: t('clusterGuide.transferable.title'),
      icon: ArrowRightLeft,
      accent: '#d97706',
      summary: t('clusterGuide.transferable.summary'),
      bestFor: t('clusterGuide.transferable.bestFor'),
      howItWorks: t('clusterGuide.transferable.howItWorks'),
    },
  ];

  const workflowSteps = [
    t('clusterGuide.workflow.1'),
    t('clusterGuide.workflow.2'),
    t('clusterGuide.workflow.3'),
    t('clusterGuide.workflow.4'),
    t('clusterGuide.workflow.5'),
  ];

  const transferNotes = [
    t('clusterGuide.transferNotes.1'),
    t('clusterGuide.transferNotes.2'),
    t('clusterGuide.transferNotes.3'),
  ];

  const managePoints = [
    t('clusterGuide.managePoints.1'),
    t('clusterGuide.managePoints.2'),
    t('clusterGuide.managePoints.3'),
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <ArrowLeft size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: colors.text }]}>{t('clusterGuide.title')}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('clusterGuide.subtitle')}</Text>
        </View>
      </View>

      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.heroBadge, { backgroundColor: colors.primary + '18' }]}>
          <ShieldCheck size={16} color={colors.primary} />
          <Text style={[styles.heroBadgeText, { color: colors.primary }]}>{t('clusterGuide.operationalGuide')}</Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>{t('clusterGuide.heroTitle')}</Text>
        <Text style={[styles.heroBody, { color: colors.textSecondary }]}>{t('clusterGuide.heroBody')}</Text>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('clusterGuide.projectModes')}</Text>
        {modeCards.map((card) => {
          const Icon = card.icon;
          return (
            <View key={card.key} style={[styles.modeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modeHeader}>
                <View style={[styles.modeIcon, { backgroundColor: card.accent + '18' }]}>
                  <Icon size={18} color={card.accent} />
                </View>
                <Text style={[styles.modeTitle, { color: colors.text }]}>{card.title}</Text>
              </View>
              <Text style={[styles.modeSummary, { color: colors.textSecondary }]}>{card.summary}</Text>
              <Text style={[styles.modeLabel, { color: colors.text }]}>{t('clusterGuide.bestFor')}</Text>
              <Text style={[styles.modeBody, { color: colors.textSecondary }]}>{card.bestFor}</Text>
              <Text style={[styles.modeLabel, { color: colors.text }]}>{t('clusterGuide.howItWorks')}</Text>
              <Text style={[styles.modeBody, { color: colors.textSecondary }]}>{card.howItWorks}</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.infoHeader}>
          <GitBranch size={18} color={colors.primary} />
          <Text style={[styles.infoTitle, { color: colors.text }]}>{t('clusterGuide.clusterWorkflow')}</Text>
        </View>
        {workflowSteps.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <View style={[styles.stepBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.stepNumber, { color: colors.primary }]}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.textSecondary }]}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.infoHeader}>
          <Briefcase size={18} color={colors.primary} />
          <Text style={[styles.infoTitle, { color: colors.text }]}>{t('clusterGuide.whenTransferableMatters')}</Text>
        </View>
        {transferNotes.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <CheckCircle2 size={16} color={colors.primary} />
            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.infoHeader}>
          <Link2 size={18} color={colors.primary} />
          <Text style={[styles.infoTitle, { color: colors.text }]}>{t('clusterGuide.whereToManage')}</Text>
        </View>
        {managePoints.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <CheckCircle2 size={16} color={colors.primary} />
            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 32, paddingBottom: 40, gap: 12 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  heroCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  heroBadgeText: { fontSize: 12, fontWeight: '700' },
  heroTitle: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  heroBody: { fontSize: 13, lineHeight: 20 },
  sectionWrap: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  modeCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  modeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  modeSummary: { fontSize: 13, lineHeight: 20 },
  modeLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  modeBody: { fontSize: 13, lineHeight: 19 },
  infoCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTitle: { fontSize: 15, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumber: { fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 19 },
});