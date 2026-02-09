import * as FileSystem from 'expo-file-system';

const DATA_FILE = FileSystem.documentDirectory + 'bulk_url_opener_data.json';

const defaults = {
  urls: [],
  fileName: '',
  settings: {},
  openingIndex: 0,
};

async function readData() {
  try {
    const s = await FileSystem.readAsStringAsync(DATA_FILE);
    const data = JSON.parse(s);
    return { ...defaults, ...data };
  } catch {
    return { ...defaults };
  }
}

async function writeData(updates) {
  const current = await readData();
  const next = { ...current, ...updates };
  await FileSystem.writeAsStringAsync(DATA_FILE, JSON.stringify(next));
}

/** Load all persisted data in one read (for initial load) */
export async function loadAll() {
  return readData();
}

/** Save list + file name in one write (avoids race where fileName write overwrites urls) */
export async function saveListAndFileName(urls, fileName) {
  const current = await readData();
  await writeData({
    urls: Array.isArray(urls) ? urls : current.urls,
    fileName: fileName != null ? String(fileName) : current.fileName,
  });
}

export async function getItem(key) {
  const data = await readData();
  const map = {
    bulk_url_opener_urls: () => (data.urls.length ? JSON.stringify(data.urls) : null),
    bulk_url_opener_file_name: () => data.fileName || null,
    bulk_url_opener_settings: () => (Object.keys(data.settings || {}).length ? JSON.stringify(data.settings) : null),
    bulk_url_opener_opening_index: () => String(data.openingIndex ?? 0),
  };
  const fn = map[key];
  return fn ? fn() : null;
}

export async function setItem(key, value) {
  const data = await readData();
  if (key === 'bulk_url_opener_urls') {
    data.urls = value ? JSON.parse(value) : [];
    await writeData({ urls: data.urls, fileName: data.fileName });
  } else if (key === 'bulk_url_opener_file_name') {
    data.fileName = value || '';
    await writeData({ urls: data.urls, fileName: data.fileName });
  } else if (key === 'bulk_url_opener_settings') {
    data.settings = value ? JSON.parse(value) : {};
    await writeData({ settings: data.settings });
  } else if (key === 'bulk_url_opener_opening_index') {
    data.openingIndex = value != null ? parseInt(value, 10) : 0;
    await writeData({ openingIndex: data.openingIndex });
  }
}

const Storage = {
  getItem,
  setItem,
  loadAll,
  saveListAndFileName,
};
export default Storage;
