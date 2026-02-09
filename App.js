import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import Storage from './utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { parseUrlsFromText } from './utils/urlParser';
import { generateLaunchpadHtml } from './utils/launchpadHtml';

const STORAGE_URLS = 'bulk_url_opener_urls';
const STORAGE_FILE_NAME = 'bulk_url_opener_file_name';
const STORAGE_SETTINGS = 'bulk_url_opener_settings';
const LAUNCHPAD_FILENAME = 'launchpad.html';

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_DELAY_BETWEEN_LINKS_MS = 400;
const DEFAULT_DELAY_BETWEEN_BATCHES_MS = 2500;
const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 15;
const PAGE_SIZES = [20, 50, 100, 200, 500];
const DEFAULT_PAGE_SIZE = 50;
const SORT_ORDER = { order: 'Original order', 'url-asc': 'A → Z', 'url-desc': 'Z → A' };

export default function App() {
  const [urls, setUrls] = useState([]);
  const [fileName, setFileName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingLaunchpad, setGeneratingLaunchpad] = useState(false);
  const [batchSize, setBatchSize] = useState(String(DEFAULT_BATCH_SIZE));
  const [delayBetweenLinks, setDelayBetweenLinks] = useState(String(DEFAULT_DELAY_BETWEEN_LINKS_MS));
  const [delayBetweenBatches, setDelayBetweenBatches] = useState(String(DEFAULT_DELAY_BETWEEN_BATCHES_MS));
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('order');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const userHasLoadedFileRef = useRef(false);

  // Persist list and file name in one write so the list is never overwritten by a race
  useEffect(() => {
    if (urls.length === 0 && !fileName) return;
    Storage.saveListAndFileName(urls, fileName || '');
  }, [urls, fileName]);

  // Load persisted list and settings on mount (don't overwrite if user already loaded a file this session)
  useEffect(() => {
    (async () => {
      try {
        const data = await Storage.loadAll();
        const urlList = Array.isArray(data.urls) ? data.urls : [];
        if (!userHasLoadedFileRef.current) {
          if (urlList.length > 0) setUrls(urlList);
          if (data.fileName) setFileName(data.fileName);
        }
        const s = data.settings || {};
        if (s.batchSize != null) setBatchSize(String(s.batchSize));
        if (s.delayBetweenLinks != null) setDelayBetweenLinks(String(s.delayBetweenLinks));
        if (s.delayBetweenBatches != null) setDelayBetweenBatches(String(s.delayBetweenBatches));
        if (s.pageSize != null) setPageSize(Math.min(500, Math.max(20, Number(s.pageSize) || DEFAULT_PAGE_SIZE)));
      } catch (e) {
        console.warn('Load persisted data failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persist settings when they change
  useEffect(() => {
    Storage.setItem(
      STORAGE_SETTINGS,
      JSON.stringify({
        batchSize: parseInt(batchSize, 10) || DEFAULT_BATCH_SIZE,
        delayBetweenLinks: parseInt(delayBetweenLinks, 10) || DEFAULT_DELAY_BETWEEN_LINKS_MS,
        delayBetweenBatches: parseInt(delayBetweenBatches, 10) || DEFAULT_DELAY_BETWEEN_BATCHES_MS,
        pageSize,
      })
    );
  }, [batchSize, delayBetweenLinks, delayBetweenBatches, pageSize]);

  const pickFile = useCallback(async () => {
    userHasLoadedFileRef.current = true;
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        setLoading(false);
        return;
      }
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const parsed = parseUrlsFromText(content);
      setUrls(parsed);
      setFileName(file.name);
      setSearchQuery('');
      setSortBy('order');
      setCurrentPage(1);
      if (parsed.length === 0) {
        Alert.alert(
          'No URLs found',
          'The file was loaded but no http/https links were found. Check the file format (e.g. one URL per line, or lines like "1. https://...").'
        );
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to read file');
    } finally {
      setLoading(false);
    }
  }, []);

  const createLaunchpadAndOpen = useCallback(async () => {
    if (urls.length === 0) {
      Alert.alert('No URLs', 'Load a .txt file first (or open from Google Drive).');
      return;
    }
    setGeneratingLaunchpad(true);
    try {
      const batchSizeNum = Math.max(MIN_BATCH_SIZE, Math.min(MAX_BATCH_SIZE, parseInt(batchSize, 10) || DEFAULT_BATCH_SIZE));
      const linkDelay = Math.max(200, parseInt(delayBetweenLinks, 10) || DEFAULT_DELAY_BETWEEN_LINKS_MS);
      const batchDelay = Math.max(1000, parseInt(delayBetweenBatches, 10) || DEFAULT_DELAY_BETWEEN_BATCHES_MS);
      const html = generateLaunchpadHtml(urls, {
        batchSize: batchSizeNum,
        delayBetweenLinksMs: linkDelay,
        delayBetweenBatchesMs: batchDelay,
      });
      const path = FileSystem.documentDirectory + LAUNCHPAD_FILENAME;
      await FileSystem.writeAsStringAsync(path, html);
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/html',
          dialogTitle: 'Open Launchpad in browser',
        });
      } else {
        Alert.alert(
          'Launchpad created',
          'File saved. Open it in Chrome or your browser to run the opener.',
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not create launchpad file.');
    } finally {
      setGeneratingLaunchpad(false);
    }
  }, [urls, batchSize, delayBetweenLinks, delayBetweenBatches]);

  const clearList = useCallback(() => {
    setUrls([]);
    setFileName(null);
    setSearchQuery('');
    setCurrentPage(1);
    Storage.saveListAndFileName([], '');
  }, []);

  const filteredUrls = searchQuery.trim()
    ? urls.filter((u) => u.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : urls;
  const sortedUrls =
    sortBy === 'order'
      ? filteredUrls
      : [...filteredUrls].sort((a, b) => (sortBy === 'url-asc' ? a.localeCompare(b) : b.localeCompare(a)));
  const totalPages = Math.max(1, Math.ceil(sortedUrls.length / pageSize));
  const pageIndex = Math.max(1, Math.min(currentPage, totalPages));
  const pageUrls = sortedUrls.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  if (loading && urls.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconWrap}>
            <Ionicons name="link" size={28} color="#a5b4fc" />
          </View>
          <Text style={styles.title}>Bulk URL Opener</Text>
        </View>
        <Text style={styles.subtitle}>Load a .txt file, then create a Launchpad HTML to open all links in Chrome</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={pickFile}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonPrimaryText}>Open file (.txt or Drive)</Text>
          )}
        </TouchableOpacity>
        {urls.length > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={clearList}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonSecondaryText}>Clear list</Text>
          </TouchableOpacity>
        )}
      </View>

      {fileName && (
        <View style={styles.fileNamePill}>
          <Text style={styles.fileName} numberOfLines={1}>
            {fileName} · {urls.length} URL{urls.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <View style={styles.settings}>
        <Text style={styles.settingsTitle}>Launchpad batch settings</Text>
        <Text style={styles.settingsHint}>Used by the HTML page when you open it in the browser</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Links per batch</Text>
          <TextInput
            style={styles.input}
            value={batchSize}
            onChangeText={setBatchSize}
            keyboardType="number-pad"
            placeholder="5"
            placeholderTextColor="#6b6b80"
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Delay between links (ms)</Text>
          <TextInput
            style={styles.input}
            value={delayBetweenLinks}
            onChangeText={setDelayBetweenLinks}
            keyboardType="number-pad"
            placeholder="400"
            placeholderTextColor="#6b6b80"
          />
        </View>
        <View style={[styles.settingRow, styles.settingRowLast]}>
          <Text style={styles.settingLabel}>Delay between batches (ms)</Text>
          <TextInput
            style={styles.input}
            value={delayBetweenBatches}
            onChangeText={setDelayBetweenBatches}
            keyboardType="number-pad"
            placeholder="2500"
            placeholderTextColor="#6b6b80"
          />
        </View>
      </View>

      {urls.length > 0 && (
        <View style={styles.openRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonStart, generatingLaunchpad && styles.buttonStartActive]}
            onPress={createLaunchpadAndOpen}
            disabled={generatingLaunchpad}
            activeOpacity={0.85}
          >
            {generatingLaunchpad ? (
              <View style={styles.openingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.buttonStartText}> Creating…</Text>
              </View>
            ) : (
              <View style={styles.startButtonContent}>
                <Ionicons name="rocket" size={18} color="#fff" style={styles.startIcon} />
                <Text style={styles.buttonStartText}>
                  Create Launchpad · open in Chrome ({urls.length})
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.listPanel}>
        <View style={styles.listPanelHandle} />
        {urls.length > 0 && (
          <>
            <View style={styles.searchSortRow}>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color="#6b6b80" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={(t) => {
                    setSearchQuery(t);
                    setCurrentPage(1);
                  }}
                  placeholder="Search URLs…"
                  placeholderTextColor="#6b6b80"
                />
              </View>
            </View>
            <View style={styles.sortRow}>
              {Object.entries(SORT_ORDER).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.sortChip, sortBy === key && styles.sortChipActive]}
                  onPress={() => {
                    setSortBy(key);
                    setCurrentPage(1);
                  }}
                >
                  <Text style={[styles.sortChipText, sortBy === key && styles.sortChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.pageSizeRow}>
              <Text style={styles.pageSizeLabel}>Per page:</Text>
              {PAGE_SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[styles.pageSizeChip, pageSize === size && styles.pageSizeChipActive]}
                  onPress={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                >
                  <Text style={[styles.pageSizeChipText, pageSize === size && styles.pageSizeChipTextActive]}>
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {urls.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyCircle}>
                <Ionicons name="document-text-outline" size={40} color="#6b6b80" />
              </View>
              <Text style={styles.emptyText}>No links yet</Text>
              <Text style={styles.emptyHint}>Pick a .txt file to see URLs here</Text>
            </View>
          ) : sortedUrls.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No matches for "{searchQuery}"</Text>
            </View>
          ) : (
            <>
              {pageUrls.map((url, idx) => {
                const globalIndex = (pageIndex - 1) * pageSize + idx;
                return (
                  <View key={`${globalIndex}-${url}`} style={styles.listItem}>
                    <View style={styles.listNumberBadge}>
                      <Text style={styles.listNumber}>{globalIndex + 1}</Text>
                    </View>
                    <Text style={styles.listUrl} numberOfLines={1}>
                      {url}
                    </Text>
                  </View>
                );
              })}
              {totalPages > 1 && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[styles.pageButton, pageIndex <= 1 && styles.pageButtonDisabled]}
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={pageIndex <= 1}
                  >
                    <Ionicons name="chevron-back" size={20} color={pageIndex <= 1 ? '#4a4b5e' : '#a5b4fc'} />
                  </TouchableOpacity>
                  <Text style={styles.pageText}>
                    Page {pageIndex} of {totalPages} ({sortedUrls.length} total)
                  </Text>
                  <TouchableOpacity
                    style={[styles.pageButton, pageIndex >= totalPages && styles.pageButtonDisabled]}
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={pageIndex >= totalPages}
                  >
                    <Ionicons name="chevron-forward" size={20} color={pageIndex >= totalPages ? '#4a4b5e' : '#a5b4fc'} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16172c',
    paddingTop: Platform.OS === 'android' ? 52 : 60,
    paddingHorizontal: 24,
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f0f0f5',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#7c7d92',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    borderRadius: 10,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
    }),
  },
  buttonPrimary: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    flex: 1,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
  },
  buttonSecondaryText: {
    color: '#a8a9bd',
    fontWeight: '600',
    fontSize: 14,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  buttonStart: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 14,
    flex: 1,
    ...Platform.select({
      android: { elevation: 3 },
      ios: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
    }),
  },
  buttonStartActive: {
    backgroundColor: '#16a34a',
  },
  startButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startIcon: {
    marginRight: 8,
  },
  openingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonStartText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  fileNamePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  fileName: {
    fontSize: 13,
    color: '#a5b4fc',
    fontWeight: '500',
  },
  settings: {
    backgroundColor: 'rgba(37, 38, 56, 0.85)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 1 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
    }),
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8e8ef',
    marginBottom: 2,
  },
  settingsHint: {
    fontSize: 12,
    color: '#6b6b80',
    marginBottom: 18,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  settingRowLast: {
    marginBottom: 0,
  },
  settingLabel: {
    fontSize: 14,
    color: '#b8b9cc',
    flex: 1,
    marginRight: 12,
  },
  input: {
    backgroundColor: 'rgba(22, 23, 44, 0.8)',
    color: '#f0f0f5',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: 88,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  listPanel: {
    backgroundColor: '#1e1f36',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'android' ? 20 : 32,
    minHeight: 280,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
  },
  listPanelHandle: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginBottom: 10,
  },
  searchSortRow: {
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchIcon: {
    marginLeft: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    paddingRight: 16,
    fontSize: 15,
    color: '#f0f0f5',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 0,
    marginBottom: 12,
  },
  sortChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sortChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.35)',
  },
  sortChipText: {
    fontSize: 13,
    color: '#a0a0b0',
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: '#e0e0f0',
  },
  pageSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 0,
    marginBottom: 12,
  },
  pageSizeLabel: {
    fontSize: 13,
    color: '#6b6b80',
    marginRight: 4,
  },
  pageSizeChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pageSizeChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
  },
  pageSizeChipText: {
    fontSize: 13,
    color: '#a0a0b0',
  },
  pageSizeChipTextActive: {
    color: '#e0e0f0',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 4,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8a8b9e',
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 14,
    color: '#6b6b80',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  listNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  listNumber: {
    fontSize: 14,
    color: '#a5b4fc',
    fontWeight: '700',
  },
  listUrl: {
    flex: 1,
    fontSize: 14,
    color: '#c4c5d4',
    marginLeft: 4,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingVertical: 12,
  },
  pageButton: {
    padding: 8,
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageText: {
    fontSize: 14,
    color: '#a0a0b0',
    fontWeight: '500',
  },
});
