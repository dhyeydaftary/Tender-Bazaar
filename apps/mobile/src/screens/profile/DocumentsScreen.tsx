import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  FadeIn,
  SlideOutLeft,
  Layout,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import type { RootStackParamList } from '../../types/navigation';
import { useHaptic } from '../../hooks/useHaptic';

// ─── Colors ────────────────────────────────────────────────────────────────

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_TERTIARY = '#9CA3AF';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const BORDER = '#E8ECF1';
const DANGER = '#EF4444';
const SUCCESS = '#22C55E';
const WARNING = '#F59E0B';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Types ─────────────────────────────────────────────────────────────────

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  fileType: 'pdf' | 'jpg' | 'doc' | 'generic';
  status: 'verified' | 'pending' | 'expired' | 'not_uploaded';
  expiryDate?: string;
  uploadedAt?: string;
  fileSize?: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────

const DOCUMENTS: DocumentItem[] = [
  {
    id: '1',
    name: 'PAN Card',
    type: 'PAN_CARD',
    fileType: 'pdf',
    status: 'verified',
    uploadedAt: '05 Mar 2026',
    fileSize: '245 KB',
  },
  {
    id: '2',
    name: 'GST Certificate',
    type: 'GST_CERTIFICATE',
    fileType: 'pdf',
    status: 'verified',
    uploadedAt: '05 Mar 2026',
    fileSize: '512 KB',
  },
  {
    id: '3',
    name: 'MSME Certificate',
    type: 'MSME_CERTIFICATE',
    fileType: 'jpg',
    status: 'pending',
    uploadedAt: '08 Mar 2026',
    fileSize: '380 KB',
  },
  {
    id: '4',
    name: 'Balance Sheet 2025',
    type: 'FINANCIAL_STATEMENT',
    fileType: 'doc',
    status: 'verified',
    uploadedAt: '15 Jan 2026',
    fileSize: '1.2 MB',
  },
  {
    id: '5',
    name: 'ISO 9001 Certificate',
    type: 'ISO_CERTIFICATE',
    fileType: 'pdf',
    status: 'pending',
    uploadedAt: '20 Feb 2026',
    fileSize: '890 KB',
  },
  {
    id: '6',
    name: 'Experience Certificate',
    type: 'EXPERIENCE_CERTIFICATE',
    fileType: 'generic',
    status: 'not_uploaded',
  },
];

// ─── Status Config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string; bg: string }
> = {
  verified: {
    label: 'Verified',
    color: SUCCESS,
    icon: 'check-circle',
    bg: SUCCESS + '14',
  },
  pending: {
    label: 'Pending',
    color: WARNING,
    icon: 'clock-outline',
    bg: WARNING + '14',
  },
  expired: {
    label: 'Expired',
    color: DANGER,
    icon: 'alert-circle-outline',
    bg: DANGER + '14',
  },
  not_uploaded: {
    label: 'Not Uploaded',
    color: TEXT_TERTIARY,
    icon: 'cloud-upload-outline',
    bg: BORDER + '80',
  },
};

const FILE_TYPE_CONFIG: Record<
  string,
  { icon: string; color: string; bg: string }
> = {
  pdf: { icon: 'file-pdf-box', color: '#EF4444', bg: '#FEE2E2' },
  jpg: { icon: 'file-image-outline', color: '#3B82F6', bg: '#DBEAFE' },
  doc: { icon: 'file-word-box', color: '#2563EB', bg: '#DBEAFE' },
  generic: { icon: 'file-outline', color: TEXT_TERTIARY, bg: BORDER + '60' },
};

// ─── Animated Card Component ───────────────────────────────────────────────

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface DocumentCardProps {
  item: DocumentItem;
  index: number;
  onView: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
  onUpload: (doc: DocumentItem) => void;
}

const DocumentCard = React.memo<DocumentCardProps>(
  ({ item, index, onView, onDownload, onDelete, onUpload }) => {
    const status = STATUS_CONFIG[item.status];
    const fileType = FILE_TYPE_CONFIG[item.fileType];
    const isUploaded = item.status !== 'not_uploaded';

    const cardOpacity = useSharedValue(0);
    const cardTranslateY = useSharedValue(15);

    useEffect(() => {
      const delay = index * 80;
      cardOpacity.value = withDelay(
        delay,
        withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
      );
      cardTranslateY.value = withDelay(
        delay,
        withSpring(0, { damping: 18, stiffness: 200 }),
      );
    }, [cardOpacity, cardTranslateY, index]);

    const cardAnimatedStyle = useAnimatedStyle(() => ({
      opacity: cardOpacity.value,
      transform: [{ translateY: cardTranslateY.value }],
    }));

    return (
      <Animated.View
        style={[styles.docCard, cardAnimatedStyle]}
        layout={Layout.springify()}
        exiting={SlideOutLeft.duration(300).springify()}
      >
        {/* File type icon */}
        <View style={[styles.fileIconCircle, { backgroundColor: fileType.bg }]}>
          <Icon name={fileType.icon} size={26} color={fileType.color} />
        </View>

        {/* Document info */}
        <View style={styles.docInfo}>
          <Text style={styles.docName} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.docMetaRow}>
            <View style={[styles.typePill, { backgroundColor: BORDER + '80' }]}>
              <Text style={styles.typePillText}>
                {item.type.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>

          {isUploaded && (
            <Text style={styles.docMeta}>
              {item.uploadedAt}
              {item.fileSize ? `  ·  ${item.fileSize}` : ''}
            </Text>
          )}

          {/* Status badge */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Icon name={status.icon} size={13} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
            {item.expiryDate && item.status === 'expired' && (
              <Text style={styles.expiryText}>Expired {item.expiryDate}</Text>
            )}
          </View>

          {/* Action buttons */}
          {isUploaded ? (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onView(item)}
                activeOpacity={0.7}
              >
                <FeatherIcon name="eye" size={14} color={PRIMARY} />
                <Text style={[styles.actionText, { color: PRIMARY }]}>View</Text>
              </TouchableOpacity>
              <View style={styles.actionDivider} />
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onDownload(item)}
                activeOpacity={0.7}
              >
                <FeatherIcon name="download" size={14} color={SECONDARY} />
                <Text style={[styles.actionText, { color: SECONDARY }]}>
                  Download
                </Text>
              </TouchableOpacity>
              <View style={styles.actionDivider} />
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onDelete(item)}
                activeOpacity={0.7}
              >
                <FeatherIcon name="trash-2" size={14} color={DANGER} />
                <Text style={[styles.actionText, { color: DANGER }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => onUpload(item)}
              activeOpacity={0.8}
            >
              <FeatherIcon name="upload" size={14} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  },
);

// ─── Upload Progress Bar (mock) ────────────────────────────────────────────

const UploadProgressBar: React.FC<{ visible: boolean }> = React.memo(
  ({ visible }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      if (visible) {
        progress.value = 0;
        progress.value = withTiming(1, {
          duration: 2500,
          easing: Easing.out(Easing.cubic),
        });
      }
    }, [visible, progress]);

    const barStyle = useAnimatedStyle(() => ({
      width: `${progress.value * 100}%`,
    }));

    if (!visible) return null;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, barStyle]} />
        </View>
        <Text style={styles.progressText}>Uploading...</Text>
      </View>
    );
  },
);

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const haptic = useHaptic();

  const [documents, setDocuments] = useState<DocumentItem[]>(DOCUMENTS);
  const [isUploading, setIsUploading] = useState(false);

  // Upload area border pulse animation
  const borderPulse = useSharedValue(0);

  useEffect(() => {
    borderPulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [borderPulse]);

  const uploadAreaAnimatedStyle = useAnimatedStyle(() => {
    const borderOpacity = interpolate(borderPulse.value, [0, 1], [0.25, 0.6]);
    return {
      borderColor: `rgba(255, 107, 53, ${borderOpacity})`,
    };
  });

  // Document counter
  const uploadedCount = useMemo(
    () => documents.filter((d) => d.status !== 'not_uploaded').length,
    [documents],
  );
  const totalCount = documents.length;
  const progressPercent = totalCount > 0 ? (uploadedCount / totalCount) * 100 : 0;

  // Progress bar width animation
  const progressWidth = useSharedValue(0);
  useEffect(() => {
    progressWidth.value = withTiming(progressPercent, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [progressPercent, progressWidth]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleUploadTap = useCallback(() => {
    haptic('light');
    Alert.alert('Upload Document', 'Choose how to add your document', [
      { text: 'Take Photo', onPress: () => mockUpload() },
      { text: 'Choose File', onPress: () => mockUpload() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [haptic]);

  const mockUpload = useCallback(() => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      haptic('success');
    }, 2600);
  }, [haptic]);

  const handleView = useCallback(
    (_doc: DocumentItem) => {
      haptic('light');
      Alert.alert('View Document', `Opening ${_doc.name}...`);
    },
    [haptic],
  );

  const handleDownload = useCallback(
    (_doc: DocumentItem) => {
      haptic('light');
      Alert.alert('Download', `Downloading ${_doc.name}...`);
    },
    [haptic],
  );

  const handleDelete = useCallback(
    (doc: DocumentItem) => {
      haptic('warning');
      Alert.alert(
        'Delete Document',
        `Are you sure you want to delete "${doc.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              haptic('medium');
              setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            },
          },
        ],
      );
    },
    [haptic],
  );

  const handleUploadDoc = useCallback(
    (doc: DocumentItem) => {
      haptic('light');
      Alert.alert('Upload', `Upload ${doc.name}`, [
        { text: 'Take Photo', onPress: () => mockUpload() },
        { text: 'Choose File', onPress: () => mockUpload() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [haptic, mockUpload],
  );

  const handleFabPress = useCallback(() => {
    haptic('medium');
    handleUploadTap();
  }, [haptic, handleUploadTap]);

  // ── Render Item ────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: DocumentItem; index: number }) => (
      <DocumentCard
        item={item}
        index={index}
        onView={handleView}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onUpload={handleUploadDoc}
      />
    ),
    [handleView, handleDownload, handleDelete, handleUploadDoc],
  );

  const keyExtractor = useCallback((item: DocumentItem) => item.id, []);

  // ── Empty State ────────────────────────────────────────────────────────

  const renderEmptyState = useCallback(
    () => (
      <Animated.View
        entering={FadeIn.duration(400)}
        style={styles.emptyContainer}
      >
        <View style={styles.emptyIconCircle}>
          <FeatherIcon name="file-plus" size={48} color={TEXT_TERTIARY} />
        </View>
        <Text style={styles.emptyTitle}>Upload your first document</Text>
        <Text style={styles.emptySubtitle}>
          Add your business documents like PAN Card, GST Certificate, and more to
          streamline your tender applications.
        </Text>
        <TouchableOpacity
          style={styles.emptyUploadButton}
          onPress={handleUploadTap}
          activeOpacity={0.8}
        >
          <FeatherIcon name="upload" size={18} color="#FFFFFF" />
          <Text style={styles.emptyUploadText}>Upload Document</Text>
        </TouchableOpacity>
      </Animated.View>
    ),
    [handleUploadTap],
  );

  // ── Header Component ──────────────────────────────────────────────────

  const renderHeader = useCallback(
    () => (
      <View>
        {/* Upload Area */}
        <AnimatedTouchable
          style={[styles.uploadArea, uploadAreaAnimatedStyle]}
          onPress={handleUploadTap}
          activeOpacity={0.7}
        >
          <View style={styles.uploadIconCircle}>
            <FeatherIcon name="upload-cloud" size={32} color={PRIMARY} />
          </View>
          <Text style={styles.uploadTitle}>Tap to upload document</Text>
          <Text style={styles.uploadSubtitle}>
            PDF, JPG, PNG, DOC (max 10MB)
          </Text>
        </AnimatedTouchable>

        {/* Upload Progress */}
        <UploadProgressBar visible={isUploading} />

        {/* Document Counter */}
        <View style={styles.counterContainer}>
          <View style={styles.counterTextRow}>
            <Text style={styles.counterLabel}>
              {uploadedCount} of {totalCount} documents uploaded
            </Text>
            <Text style={styles.counterPercent}>
              {Math.round(progressPercent)}%
            </Text>
          </View>
          <View style={styles.counterBarBg}>
            <Animated.View
              style={[styles.counterBarFill, progressBarStyle]}
            />
          </View>
        </View>
      </View>
    ),
    [
      uploadAreaAnimatedStyle,
      handleUploadTap,
      isUploading,
      uploadedCount,
      totalCount,
      progressPercent,
      progressBarStyle,
    ],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <FeatherIcon name="arrow-left" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documents</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Document List */}
      <FlatList
        data={documents}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB Upload Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 110 }]}
        onPress={handleFabPress}
        activeOpacity={0.85}
      >
        <FeatherIcon name="plus" size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: BACKGROUND,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerRight: {
    width: 40,
  },

  // Upload Area
  uploadArea: {
    marginHorizontal: 20,
    marginTop: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: PRIMARY + '06',
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PRIMARY + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: PRIMARY,
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: TEXT_SECONDARY,
  },

  // Upload Progress
  progressContainer: {
    marginHorizontal: 20,
    marginTop: 12,
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: BORDER,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: fontFamilies.medium,
    color: TEXT_SECONDARY,
    marginTop: 6,
  },

  // Document Counter
  counterContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    ...shadows.sm,
  },
  counterTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  counterLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  counterPercent: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: PRIMARY,
  },
  counterBarBg: {
    height: 8,
    backgroundColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  counterBarFill: {
    height: 8,
    backgroundColor: ACCENT,
    borderRadius: 4,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
  },

  // Document Card
  docCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 14,
    ...shadows.sm,
  },
  fileIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typePillText: {
    fontSize: 10,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  docMeta: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: TEXT_TERTIARY,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
  },
  expiryText: {
    fontSize: 11,
    fontFamily: fontFamilies.regular,
    color: DANGER,
  },

  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
  },
  actionDivider: {
    width: 1,
    height: 18,
    backgroundColor: BORDER,
  },

  // Upload button (for not uploaded docs)
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  uploadButtonText: {
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xl,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: BORDER + '60',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  emptyUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    gap: 8,
  },
  emptyUploadText: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
