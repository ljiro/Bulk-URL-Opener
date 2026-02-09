/**
 * Generates a self-contained HTML "Launchpad" page that opens all URLs in batches
 * when the user clicks Start. The browser runs the loop natively (no backgrounded app).
 */
export function generateLaunchpadHtml(urls, options = {}) {
  const batchSize = Math.max(1, Math.min(15, options.batchSize || 5));
  const linkDelayMs = Math.max(200, options.delayBetweenLinksMs || 400);
  const batchDelayMs = Math.max(1000, options.delayBetweenBatchesMs || 2500);

  const urlsJson = JSON.stringify(urls);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bulk URL Launchpad</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 480px;
      margin: 0 auto;
      padding: 24px;
      background: #1a1b2e;
      color: #e8e8ef;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    h1 { font-size: 1.5rem; margin-bottom: 8px; color: #f0f0f5; }
    .sub { font-size: 0.875rem; color: #8b8b9e; margin-bottom: 24px; }
    .btn {
      background: #22c55e;
      color: #fff;
      border: none;
      padding: 16px 32px;
      font-size: 1.1rem;
      font-weight: 700;
      border-radius: 24px;
      cursor: pointer;
      margin-bottom: 20px;
    }
    .btn:hover { background: #16a34a; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    #status {
      font-size: 0.9rem;
      color: #a5b4fc;
      min-height: 1.5em;
    }
    .count { color: #8b8b9e; font-size: 0.8rem; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Bulk URL Launchpad</h1>
  <p class="sub">Opens all links in new tabs with delays to avoid overloading the browser.</p>
  <button class="btn" id="startBtn" type="button">Start opening</button>
  <p id="status"></p>
  <p class="count" id="count"></p>

  <script>
    (function() {
      var urls = ${urlsJson};
      var batchSize = ${batchSize};
      var linkDelayMs = ${linkDelayMs};
      var batchDelayMs = ${batchDelayMs};

      var startBtn = document.getElementById('startBtn');
      var statusEl = document.getElementById('status');
      var countEl = document.getElementById('count');

      countEl.textContent = urls.length + ' link' + (urls.length !== 1 ? 's' : '') + ' ready';

      function setStatus(text) {
        statusEl.textContent = text;
      }

      function openNext(index) {
        if (index >= urls.length) {
          setStatus('Done! All links opened.');
          startBtn.disabled = false;
          startBtn.textContent = 'Start opening';
          return;
        }
        var url = urls[index];
        try {
          window.open(url, '_blank', 'noopener');
        } catch (e) {
          console.warn('Could not open:', url, e);
        }
        setStatus('Opened ' + (index + 1) + ' of ' + urls.length + '…');
        var nextIndex = index + 1;
        var isBatchBoundary = nextIndex < urls.length && (nextIndex % batchSize === 0);
        var delay = isBatchBoundary ? batchDelayMs : linkDelayMs;
        setTimeout(function() { openNext(nextIndex); }, delay);
      }

      startBtn.addEventListener('click', function() {
        if (urls.length === 0) return;
        startBtn.disabled = true;
        startBtn.textContent = 'Opening…';
        setStatus('Starting…');
        openNext(0);
      });
    })();
  </script>
</body>
</html>`;
}
