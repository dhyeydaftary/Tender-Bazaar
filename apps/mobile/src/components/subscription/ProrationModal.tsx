import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@/theme/typography';
import { usePreviewPlanChange } from '@/hooks/useSubscription';
import type { ProrationPreview } from '@/services/api/subscription';

interface ProrationModalProps {
  visible: boolean;
  targetPlanSlug: string;
  targetPlanName: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  onClose: () => void;
  onCheckout: (planSlug: string, billingCycle: 'MONTHLY' | 'YEARLY') => void;
}

function formatCurrency(amount: number): string {
  if (amount <= 0) return 'Free';
  if (amount >= 10000000) return `\u20B9${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `\u20B9${(amount / 100000).toFixed(2)} L`;
  return `\u20B9${amount.toLocaleString('en-IN')}`;
}

const CHANGE_TYPE_CONFIG = {
  upgrade: { icon: 'trending-up', label: 'Upgrade', color: '#00D4AA' },
  downgrade: { icon: 'trending-down', label: 'Downgrade', color: '#F59E0B' },
  cycle_change: { icon: 'refresh', label: 'Billing Change', color: '#3B82F6' },
  new: { icon: 'star-four-points-outline', label: 'New Subscription', color: '#FF6B35' },
  same: { icon: 'check', label: 'Current Plan', color: '#6B7280' },
};

export function ProrationModal({
  visible,
  targetPlanSlug,
  targetPlanName,
  billingCycle,
  onClose,
  onCheckout,
}: ProrationModalProps) {
  const previewMutation = usePreviewPlanChange();

  useEffect(() => {
    if (visible) {
      previewMutation.mutate({ planSlug: targetPlanSlug, billingCycle });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, targetPlanSlug, billingCycle]);

  const preview = previewMutation.data;
  const isLoading = previewMutation.isPending;
  const error = previewMutation.error;

  const config = preview
    ? CHANGE_TYPE_CONFIG[preview.changeType]
    : CHANGE_TYPE_CONFIG.new;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Switch to {targetPlanName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#FF6B35" />
              </View>
            ) : error ? (
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>
                  {(error as Error).message || 'Failed to load pricing preview'}
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.errorLink}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : preview ? (
              <>
                {/* Change type badge */}
                {preview.changeType !== 'same' && (
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.badgeIcon,
                        { backgroundColor: config.color + '15' },
                      ]}
                    >
                      <Icon
                        name={config.icon}
                        size={16}
                        color={config.color}
                      />
                    </View>
                    <Text style={[styles.badgeLabel, { color: config.color }]}>
                      {config.label}
                    </Text>
                    <Text style={styles.badgeSubtext}>
                      {preview.currentPlan} → {preview.targetPlan} (
                      {billingCycle.toLowerCase()})
                    </Text>
                  </View>
                )}

                {/* Pricing breakdown */}
                <View style={styles.pricingCard}>
                  <View style={styles.pricingRow}>
                    <Text style={styles.pricingLabel}>
                      {targetPlanName} ({billingCycle.toLowerCase()})
                    </Text>
                    <Text style={styles.pricingValue}>
                      {formatCurrency(preview.pricing.baseAmount)}
                    </Text>
                  </View>
                  <View style={styles.pricingRow}>
                    <Text style={styles.pricingLabel}>
                      GST ({preview.pricing.gstRate * 100}%)
                    </Text>
                    <Text style={styles.pricingValue}>
                      {formatCurrency(preview.pricing.gstAmount)}
                    </Text>
                  </View>

                  {preview.pricing.prorationCredit > 0 && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.pricingRow}>
                        <Text style={styles.pricingLabel}>Subtotal</Text>
                        <Text style={styles.pricingValue}>
                          {formatCurrency(preview.pricing.totalBeforeProration)}
                        </Text>
                      </View>
                      <View style={styles.pricingRow}>
                        <Text style={[styles.pricingLabel, { color: '#00D4AA' }]}>
                          Credit ({preview.proration?.daysRemaining} days)
                        </Text>
                        <Text style={[styles.pricingValue, { color: '#00D4AA' }]}>
                          -{formatCurrency(preview.pricing.prorationCredit)}
                        </Text>
                      </View>
                    </>
                  )}

                  <View style={[styles.divider, { marginTop: 12 }]} />
                  <View style={[styles.pricingRow, { marginTop: 12 }]}>
                    <Text style={styles.totalLabel}>Amount to pay</Text>
                    <Text style={styles.totalValue}>
                      {formatCurrency(preview.pricing.finalAmount)}
                    </Text>
                  </View>
                </View>

                {/* Downgrade note */}
                {preview.changeType === 'downgrade' && (
                  <View style={styles.warningCard}>
                    <Text style={styles.warningText}>
                      Downgrading will take effect at the end of your current
                      billing period
                      {preview.currentSubscriptionEnd &&
                        ` (${new Date(preview.currentSubscriptionEnd).toLocaleDateString('en-IN')})`}
                      . Some features may become unavailable.
                    </Text>
                  </View>
                )}

                {preview.changeType === 'same' && (
                  <Text style={styles.sameText}>
                    You are already on this plan with the same billing cycle.
                  </Text>
                )}
              </>
            ) : null}
          </ScrollView>

          {/* Footer */}
          {preview && preview.changeType !== 'same' && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkoutButton}
                onPress={() => onCheckout(targetPlanSlug, billingCycle)}
                activeOpacity={0.8}
              >
                <Text style={styles.checkoutText}>Proceed to Payment</Text>
                <Icon name="arrow-right" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF1',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.semiBold,
    color: '#0F1117',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  errorWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    color: '#EF4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorLink: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    color: '#FF6B35',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  badgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
  },
  badgeSubtext: {
    fontSize: 11,
    fontFamily: fontFamilies.regular,
    color: '#9CA3AF',
    flex: 1,
  },
  pricingCard: {
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pricingLabel: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: '#6B7280',
  },
  pricingValue: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    color: '#0F1117',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8ECF1',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    color: '#0F1117',
  },
  totalValue: {
    fontSize: 18,
    fontFamily: fontFamilies.bold,
    color: '#0F1117',
  },
  warningCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: '#92400E',
    lineHeight: 18,
  },
  sameText: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF1',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8ECF1',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    color: '#0F1117',
  },
  checkoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FF6B35',
  },
  checkoutText: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    color: '#FFFFFF',
  },
});
