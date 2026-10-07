import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
  ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  useAnimatedProps,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import type { RootStackParamList } from '../../types/navigation';
import { FeatureGate } from '../../components/subscription';

// ---------------------------------------------------------------------------
// Brand palette
// ---------------------------------------------------------------------------
const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const BORDER = '#E8ECF1';
const WARNING = '#F59E0B';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DocsRoute = RouteProp<RootStackParamList, 'TenderDocuments'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type DocType = 'pdf' | 'excel' | 'doc' | 'image';

interface TenderDoc {
  id: string;
  name: string;
  type: DocType;
  size: string;
  sizeBytes: number;
  uploadedAt: string;
  isCorrigendum: boolean;
  isNew: boolean;
}

// ---------------------------------------------------------------------------
// Mock data — 7 documents
// ---------------------------------------------------------------------------
const TODAY = new Date('2026-04-11');

const DOCS: TenderDoc[] = [
  {
    id: '1',
    name: 'Tender Notice.pdf',
    type: 'pdf',
    size: '2.4 MB',
    sizeBytes: 2516582,
    uploadedAt: '05 Apr 2026',
    isCorrigendum: false,
    isNew: false,
  },
  {
    id: '2',
    name: 'BOQ Sheet.xlsx',
    type: 'excel',
    size: '1.1 MB',
    sizeBytes: 1153434,
    uploadedAt: '05 Apr 2026',
    isCorrigendum: false,
    isNew: false,
  },
  {
    id: '3',
    name: 'Terms & Conditions.pdf',
    type: 'pdf',
    size: '845 KB',
    sizeBytes: 865280,
    uploadedAt: '05 Apr 2026',
    isCorrigendum: false,
    isNew: false,
  },
  {
    id: '4',
    name: 'Technical Specifications.pdf',
    type: 'pdf',
    size: '5.2 MB',
    sizeBytes: 5452595,
    uploadedAt: '06 Apr 2026',
    isCorrigendum: false,
    isNew: false,
  },
  {
    id: '5',
    name: 'Drawing - Site Plan.pdf',
    type: 'pdf',
    size: '12.3 MB',
    sizeBytes: 12897484,
    uploadedAt: '06 Apr 2026',
    isCorrigendum: false,
    isNew: false,
  },
  {
    id: '6',
    name: 'Corrigendum No. 1.pdf',
    type: 'pdf',
    size: '320 KB',
    sizeBytes: 327680,
    uploadedAt: '09 Apr 2026',
    isCorrigendum: true,
    isNew: true,
  },
  {
    id: '7',
    name: 'Pre-Bid Meeting Minutes.doc',
    type: 'doc',
    size: '780 KB',
    sizeBytes: 798720,
    uploadedAt: '10 Apr 2026',
    isCorrigendum: false,
    isNew: true,
  },
];

// ---------------------------------------------------------------------------
// Icon config per doc type
// ---------------------------------------------------------------------------
const DOC_ICONS: Record<DocType, { name: string; color: string }> = {
  pdf: { name: 'file-pdf-box', color: '#EF4444' },
  excel: { name: 'file-excel-box', color: '#22C55E' },
  doc: { name: 'file-word-box', color: '#3B82F6' },
  image: { name: 'file-image', color: '#7C3AED' },
};

// ---------------------------------------------------------------------------
// DocumentCard (memoized, animated)
// ---------------------------------------------------------------------------
interface DocumentCardProps {
  item: TenderDoc;
  index: number;
  onView: (doc: TenderDoc) => void;
  onDownload: (doc: TenderDoc) => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const DocumentCard = React.memo(function DocumentCard({
  item,
  index,
  onView,
  onDownload,
}: DocumentCardProps) {
  const translateY = useSharedValue(24);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const delay = index * 80;
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, translateY, opacity]);

  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.98, { duration: 120 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: 180 });
  }, [scale]);

  const iconConfig = DOC_ICONS[item.type] || DOC_ICONS.pdf;

  const handleView = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight');
    onView(item);
  }, [item, onView]);

  const handleDownload = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight');
    onDownload(item);
  }, [item, onDownload]);

  return (
    <Animated.View style={cardAnim}>
      <TouchableOpacity
        style={styles.docCard}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handleView}
      >
        {/* File icon */}
        <View
          style={[
            styles.docIconCircle,
            { backgroundColor: iconConfig.color + '14' },
          ]}
        >
          <Icon name={iconConfig.name} size={26} color={iconConfig.color} />
        </View>

        {/* Info */}
        <View style={styles.docInfo}>
          <View style={styles.docNameRow}>
            <Text style={styles.docName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>New</Text>
              </View>
            )}
          </View>
          <Text style={styles.docMeta}>
            {item.size}  ·  Added {item.uploadedAt}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.docActions}>
          <TouchableOpacity
            style={styles.docActionBtn}
            activeOpacity={0.7}
            onPress={handleView}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FeatherIcon name="eye" size={18} color={TEXT_SECONDARY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.docActionBtn, styles.docActionBtnDownload]}
            activeOpacity={0.7}
            onPress={handleDownload}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FeatherIcon name="download" size={18} color={PRIMARY} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
function TenderDocumentsScreen() {
  const route = useRoute<DocsRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const corrigendumDocs = useMemo(
    () => DOCS.filter((d) => d.isCorrigendum),
    [],
  );
  const regularDocs = useMemo(
    () => DOCS.filter((d) => !d.isCorrigendum),
    [],
  );

  const totalSize = useMemo(() => {
    const bytes = DOCS.reduce((sum, d) => sum + d.sizeBytes, 0);
    return (bytes / (1024 * 1024)).toFixed(1);
  }, []);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleView = useCallback((doc: TenderDoc) => {
    Alert.alert('Open Document', `Opening "${doc.name}" in viewer...`, [
      { text: 'OK' },
    ]);
  }, []);

  const handleDownload = useCallback((doc: TenderDoc) => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    Alert.alert('Download', `"${doc.name}" (${doc.size}) will be downloaded.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Download', style: 'default' },
    ]);
  }, []);

  const handleDownloadAll = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    Alert.alert(
      'Download All',
      `Download all ${DOCS.length} files (${totalSize} MB)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download All', style: 'default' },
      ],
    );
  }, [totalSize]);

  // We render corrigendum + regular in a single FlatList via ListHeaderComponent
  const renderHeader = useCallback(() => {
    if (corrigendumDocs.length === 0) return null;
    return (
      <View style={styles.corrigendumSection}>
        <View style={styles.corrigendumHeader}>
          <Icon name="alert-circle-outline" size={18} color={WARNING} />
          <Text style={styles.corrigendumTitle}>Corrigendum</Text>
        </View>
        {corrigendumDocs.map((doc, idx) => (
          <DocumentCard
            key={doc.id}
            item={doc}
            index={idx}
            onView={handleView}
            onDownload={handleDownload}
          />
        ))}
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionDividerText}>All Documents</Text>
        </View>
      </View>
    );
  }, [corrigendumDocs, handleView, handleDownload]);

  const renderFooter = useCallback(() => {
    return (
      <View>
        {/* Total size footer */}
        <View style={styles.totalFooter}>
          <View style={styles.totalLeft}>
            <Icon name="folder-outline" size={18} color={TEXT_SECONDARY} />
            <Text style={styles.totalText}>
              Total: {totalSize} MB ({DOCS.length} files)
            </Text>
          </View>
        </View>

        {/* Download All button */}
        <TouchableOpacity
          style={styles.downloadAllBtn}
          activeOpacity={0.85}
          onPress={handleDownloadAll}
        >
          <Icon name="download-multiple" size={20} color="#FFFFFF" />
          <Text style={styles.downloadAllText}>Download All Documents</Text>
        </TouchableOpacity>

        {/* Bottom spacer for floating tab bar */}
        <View style={{ height: 100 }} />
      </View>
    );
  }, [totalSize, handleDownloadAll]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<TenderDoc>) => (
      <DocumentCard
        item={item}
        index={index + corrigendumDocs.length}
        onView={handleView}
        onDownload={handleDownload}
      />
    ),
    [corrigendumDocs.length, handleView, handleDownload],
  );

  const keyExtractor = useCallback((item: TenderDoc) => item.id, []);

  const itemSeparator = useCallback(
    () => <View style={styles.itemSeparator} />,
    [],
  );

  return (
    <FeatureGate feature="documentDownload" fallbackVariant="card">
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={SECONDARY} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.7}
          onPress={handleGoBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <FeatherIcon name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tender Documents</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{DOCS.length}</Text>
        </View>
      </View>

      <FlatList
        data={regularDocs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ItemSeparatorComponent={itemSeparator}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
    </FeatureGate>
  );
}

export default React.memo(TenderDocumentsScreen);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SECONDARY,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerBadgeText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Corrigendum section
  corrigendumSection: {
    marginBottom: 4,
  },
  corrigendumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingLeft: 4,
  },
  corrigendumTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: WARNING,
  },

  // Section divider
  sectionDivider: {
    marginTop: 16,
    marginBottom: 12,
    paddingLeft: 4,
  },
  sectionDividerText: {
    fontSize: 16,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
  },

  // Document card
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadows.sm,
  },
  docIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  docName: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flexShrink: 1,
  },
  newBadge: {
    backgroundColor: WARNING + '1A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 10,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: WARNING,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  docMeta: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: TEXT_MUTED,
  },

  // Actions
  docActions: {
    flexDirection: 'row',
    gap: 6,
  },
  docActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docActionBtnDownload: {
    backgroundColor: PRIMARY + '14',
  },

  // Separator
  itemSeparator: {
    height: 10,
  },

  // Total footer
  totalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  totalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalText: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },

  // Download all
  downloadAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    height: 52,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
    ...shadows.sm,
  },
  downloadAllText: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
