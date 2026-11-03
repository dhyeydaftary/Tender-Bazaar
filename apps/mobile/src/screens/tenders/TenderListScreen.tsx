/**
 * TenderBazaar — Tender List Screen
 *
 * Full listing behind the home-page "See all" buttons:
 *   - kind "recommended": open tenders recommended for the user (GET /tenders/recommended)
 *   - kind "expiring":    open tenders closing soon, nearest deadline first (GET /tenders/expiring)
 *
 * Filtering and ordering happen on the API; this screen only paginates.
 */

import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TenderCard from '../../components/tender/TenderCard';
import TenderCardSkeleton from '../../components/tender/TenderCardSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { useTenderListInfinite, type TenderListKind } from '../../hooks/useTenders';
import { toTenderCardData } from '../../utils/tenderCard';
import type { TenderListItem } from '../../services/api/tenders';
import type { RootStackParamList } from '../../types/navigation';

const PRIMARY = '#FF6B35';
const BACKGROUND = '#F7F8FA';
const TEXT_SECONDARY = '#6B7280';

export const TENDER_LIST_TITLES: Record<TenderListKind, string> = {
  recommended: 'Recommended for you',
  expiring: 'Expiring soon',
};

const EMPTY_COPY: Record<TenderListKind, { title: string; message: string }> = {
  recommended: {
    title: 'No recommendations right now',
    message: 'There are no open tenders matching your profile at the moment.',
  },
  expiring: {
    title: 'Nothing expiring soon',
    message: 'No open tenders close within the next 7 days.',
  },
};

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ListRoute = RouteProp<RootStackParamList, 'TenderList'>;

export default function TenderListScreen(): React.JSX.Element {
  const navigation = useNavigation<NavProp>();
  const { kind } = useRoute<ListRoute>().params;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTenderListInfinite(kind);

  const tenders = useMemo(() => data?.pages.flatMap((page) => page.tenders) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;
  const locked = data?.pages[0]?.paginationLocked ?? false;

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: TenderListItem }) => (
      <TenderCard
        tender={toTenderCardData(item)}
        onPress={() => navigation.navigate('TenderDetail', { id: item.id })}
        style={styles.card}
      />
    ),
    [navigation],
  );

  if (isLoading) {
    return (
      <View style={styles.container} testID="tender-list-loading">
        <View style={styles.content}>
          <TenderCardSkeleton style={styles.card} />
          <TenderCardSkeleton style={styles.card} />
          <TenderCardSkeleton style={styles.card} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <ErrorState
          title="Couldn't load tenders"
          message={error instanceof Error ? error.message : 'Please check your connection and try again.'}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={tenders.length === 0 ? styles.emptyContent : styles.content}
      data={tenders}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[PRIMARY]} tintColor={PRIMARY} />
      }
      ListHeaderComponent={
        tenders.length > 0 ? (
          <Text style={styles.countText}>
            {total.toLocaleString('en-IN')} {total === 1 ? 'tender' : 'tenders'}
          </Text>
        ) : null
      }
      ListEmptyComponent={<EmptyState title={EMPTY_COPY[kind].title} message={EMPTY_COPY[kind].message} />}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator color={PRIMARY} style={styles.footer} />
        ) : locked && total > tenders.length ? (
          <Text style={styles.footerText}>
            Showing {tenders.length} of {total.toLocaleString('en-IN')}. Upgrade your plan to see more.
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  content: {
    padding: 16,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  countText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 12,
  },
  footer: {
    marginVertical: 16,
  },
  footerText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginVertical: 16,
  },
});
