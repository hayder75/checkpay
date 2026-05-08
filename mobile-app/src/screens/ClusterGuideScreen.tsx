import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, ArrowRightLeft, Briefcase, Building2, CheckCircle2, GitBranch, Link2, ShieldCheck, Users } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';

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

  const modeCards: ModeCard[] = [
    {
      key: 'single',
      title: 'Single / Standalone',
      icon: Building2,
      accent: '#2563eb',
      summary: 'One owner or one team manages one project directly without sharing cluster ownership.',
      bestFor: 'Use this when the project belongs to one business and does not need to move between operators.',
      howItWorks: 'Transactions, verification, package usage, and responsibility stay under one account structure.',
    },
    {
      key: 'cluster',
      title: 'Cluster',
      icon: Users,
      accent: '#16a34a',
      summary: 'A developer links work to a business owner using the owner ID so transactions and project activity can be managed together.',
      bestFor: 'Use this when a developer operates for a business owner and both sides need visibility and controlled linking.',
      howItWorks: 'Developer sends a cluster request, owner reviews and accepts, then the project becomes an active linked cluster relationship.',
    },
    {
      key: 'transferable',
      title: 'Transferable',
      icon: ArrowRightLeft,
      accent: '#d97706',
      summary: 'A project is prepared so it can be handed over or reassigned without rebuilding the operating flow from zero.',
      bestFor: 'Use this when a project may change hands between teams, owners, or operating accounts later.',
      howItWorks: 'The project structure stays portable so ownership and management can move with less disruption to tracking and operations.',
    },
  ];

  const workflowSteps = [
    'Developer gets the business owner ID from the owner account.',
    'Developer creates or chooses the target project and sends the cluster request to that owner ID.',
    'Business owner reviews the incoming request from the Cluster section and accepts or rejects it.',
    'When accepted, the link becomes active and the project can be monitored as part of the owner-developer cluster relationship.',
    'If the relationship should end, the cluster link can be canceled, rejected, or removed later from the cluster details page.',
  ];

  const transferNotes = [
    'Single mode is simplest when no handover is expected.',
    'Cluster mode is best when a developer and owner need a live shared operating relationship.',
    'Transferable mode is best when the project may be reassigned and should remain portable.',
  ];

  const managePoints = [
    'Profile > Cluster shows pending requests and your current owner ID.',
    'View Full Cluster Details shows active links, pending requests, and recent history.',
    'Accept, reject, cancel, and remove actions all happen from the cluster management screens already in the app.',
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <ArrowLeft size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: colors.text }]}>CheckPay Modes Guide</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>How single, cluster, and transferable setups work in practice</Text>
        </View>
      </View>

      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.heroBadge, { backgroundColor: colors.primary + '18' }]}>
          <ShieldCheck size={16} color={colors.primary} />
          <Text style={[styles.heroBadgeText, { color: colors.primary }]}>Operational Guide</Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Choose the project mode based on ownership, control, and handover needs.</Text>
        <Text style={[styles.heroBody, { color: colors.textSecondary }]}>Single is direct ownership, Cluster is shared owner-developer linkage, and Transferable is structured for future reassignment.</Text>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Project Modes</Text>
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
              <Text style={[styles.modeLabel, { color: colors.text }]}>Best for</Text>
              <Text style={[styles.modeBody, { color: colors.textSecondary }]}>{card.bestFor}</Text>
              <Text style={[styles.modeLabel, { color: colors.text }]}>How it works</Text>
              <Text style={[styles.modeBody, { color: colors.textSecondary }]}>{card.howItWorks}</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.infoHeader}>
          <GitBranch size={18} color={colors.primary} />
          <Text style={[styles.infoTitle, { color: colors.text }]}>Cluster Workflow</Text>
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
          <Text style={[styles.infoTitle, { color: colors.text }]}>When Transferable Matters</Text>
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
          <Text style={[styles.infoTitle, { color: colors.text }]}>Where To Manage It In The App</Text>
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