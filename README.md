# Bulk URL Opener

An **Android app** (Expo / React Native) that loads a list of URLs from a `.txt` file (or from Google Drive), lets you search, sort, and paginate them, then **generates a Launchpad HTML page**. You open that page in **Chrome** (or any browser), and the browser opens all links in new tabs in batches—no backgrounded app or OS limits.

---

## Table of contents

- [Architecture](#architecture)
- [Features](#features)
- [Setup](#setup)
- [How to use the app](#how-to-use-the-app)
- [Supported file format](#supported-file-format)
- [Batch settings](#batch-settings)
- [Launchpad page (in the browser)](#launchpad-page-in-the-browser)
- [Tech stack](#tech-stack)
- [Sample file](#sample-file)

---

## Architecture

1. **App** reads your `.txt` from device storage or Google Drive, parses URLs, and stores them.
2. **App** lets you search, sort, and paginate the list. You can change batch settings (links per batch, delays).
3. When you tap **Create Launchpad**, the app generates a single **HTML file** that contains:
   - The full list of URLs
   - Your batch size and delay settings
   - A small JavaScript loop that opens each URL in a new tab with delays
4. The app **shares** this HTML file (system share sheet). You choose **Chrome** (or another browser).
5. **Chrome** opens the file. You tap **“Start opening”** on the Launchpad page. The script runs inside the browser and opens all links in new tabs with the configured delays. The browser handles this natively, so there’s no freezing or background-app issues.

---

## Features

- **Open file**: Pick a `.txt` from device storage or **Google Drive** (system document picker).
- **URL parsing**: Supports numbered lists (`1. https://...`, `2) https://...`), bullet-style (`-`, `*`, `•`), or plain URLs (see [Supported file format](#supported-file-format)).
- **Search**: Filter the list by typing in the search box (matches URL text).
- **Sort**: Original order, A→Z by URL, or Z→A by URL.
- **Pagination**: Choose how many links per page (20, 50, 100, 200, 500). Navigate with “Page X of Y” and prev/next. Total count is shown (e.g. “350 total”).
- **Launchpad**: One tap creates an HTML file; share it to Chrome to open all links in the browser in batches.
- **Batch settings**: “Links per batch” and “Delay between links / between batches” are saved in the app and written into the Launchpad HTML.
- **Persistence**: Loaded URL list, file name, and settings are saved locally (file-based storage) and restored when you reopen the app.

---

## Setup

1. **Clone or download** the project, then install dependencies:
   ```bash
   npm install
   ```
2. **Start the Expo dev server**:
   ```bash
   npx expo start
   ```
3. **Run on Android**:
   - Press **`a`** in the terminal to open in the Android emulator, or  
   - Scan the **QR code** with the **Expo Go** app on your phone.

---

## How to use the app

### 1. Load a URL list

- Tap **“Open file (.txt or Drive)”**.
- Choose **“Open from”** and pick:
  - **Device** (Downloads, etc.), or  
  - **Google Drive** (or another provider if available).
- Select a `.txt` file. The app parses it and shows the list.

If the file has no `http://` or `https://` links, you’ll see an alert: *“No URLs found”*. Check that the file has one URL per line (or one of the [supported formats](#supported-file-format)).

### 2. Review the list (search, sort, paginate)

- **Search**: Type in the search box to filter URLs. Pagination resets to page 1.
- **Sort**: Tap **Original order**, **A → Z**, or **Z → A** to change sort. Pagination resets to page 1.
- **Per page**: Tap **20**, **50**, **100**, **200**, or **500** to set how many links appear per page.
- **Pages**: Use the **&lt;** and **&gt;** buttons and the “Page X of Y (N total)” text to move between pages.

The **Create Launchpad** button always uses the **full** list (all loaded URLs), not only the current page or search result.

### 3. Adjust batch settings (optional)

In **“Launchpad batch settings”** you can change:

- **Links per batch**: How many tabs to open before a longer pause (e.g. 5).
- **Delay between links (ms)**: Pause between each new tab (e.g. 400).
- **Delay between batches (ms)**: Longer pause after each “batch” (e.g. 2500).

These values are saved and are written into the Launchpad HTML when you create it.

### 4. Create the Launchpad and open in Chrome

- Tap **“Create Launchpad · open in Chrome (N)”** (N = total number of links).
- The app generates `launchpad.html` and opens the **share sheet**.
- Choose **Chrome** (or “Open with” → Chrome / another browser).
- The Launchpad page opens in the browser. Tap **“Start opening”**.
- The page will open each URL in a new tab, with the delays you configured. You can leave the app; everything runs in the browser.

### 5. Clear the list (optional)

- Tap **“Clear list”** to remove the loaded file and URL list. Settings (batch size, delays, per page) are kept.

---

## Supported file format

The app looks for lines that contain `http://` or `https://` URLs. It also strips common list prefixes so these formats work:

| Format              | Example                    |
|---------------------|----------------------------|
| Numbered with dot   | `1. https://example.com`   |
| Numbered with paren | `2) https://example.com`   |
| Dash / bullet       | `- https://example.com`    |
| Plain URL           | `https://example.com`      |

- One URL per line is typical; multiple URLs on one line are also detected.
- Empty lines and lines without a URL are ignored.
- Duplicate URLs are removed; order is preserved.

See **`sample-urls.txt`** in the repo for a short example.

---

## Batch settings

These are stored in the app and written into the Launchpad HTML:

- **Links per batch**: Number of tabs opened before the “batch delay” is applied. Example: 5 → open 5 tabs, wait “Delay between batches”, then open the next 5.
- **Delay between links (ms)**: Milliseconds to wait after opening one tab before opening the next (e.g. 400).
- **Delay between batches (ms)**: Milliseconds to wait after finishing one batch before starting the next (e.g. 2500).

Higher delays reduce the chance of the browser slowing down or blocking pop-ups.

---

## Launchpad page (in the browser)

After you share the HTML file and open it in Chrome:

1. You see a simple page: **“Bulk URL Launchpad”** and a **“Start opening”** button.
2. Tap **“Start opening”**. The script will:
   - Open the first URL in a new tab.
   - Wait “Delay between links” (or “Delay between batches” at batch boundaries).
   - Open the next URL, and so on until all are opened.
3. The page shows progress (e.g. “Opened 5 of 50…”). When done, it shows “Done! All links opened.”

You can close the app; the Launchpad runs entirely in the browser.

---

## Tech stack

| Part            | Technology |
|-----------------|------------|
| App             | **Expo** (React Native) |
| File picker     | **expo-document-picker** (device + Google Drive) |
| Read/write files| **expo-file-system** (read `.txt`, write Launchpad HTML) |
| Share HTML      | **expo-sharing** (share file to open with Chrome) |
| Launchpad HTML  | **utils/launchpadHtml.js** (self-contained HTML + JS) |
| Persistence     | **utils/storage.js** (file-based; no AsyncStorage) |
| URL parsing     | **utils/urlParser.js** (multiple list formats) |

---

## Sample file

Example **`sample-urls.txt`** in the repo:

```
1. https://example.com
2. https://google.com
3. https://github.com
```

Use a file like this to test loading, search, sort, pagination, and Create Launchpad.
