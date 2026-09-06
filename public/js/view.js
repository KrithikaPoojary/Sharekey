/**
 * ShareKey Secret Retrieval & Decryption Logic
 */

let currentToken = '';
let currentShareMeta = null;
let rawSecretPayload = '';
let wipeInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSoundControls();
  initViewer();
});

function initTheme() {
  const savedTheme = localStorage.getItem('sharekey_theme') || 'dark';
  const themeIcon = document.getElementById('theme-icon');
  const btnTheme = document.getElementById('btn-theme-toggle');

  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    if (themeIcon) themeIcon.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    if (themeIcon) themeIcon.textContent = '🌙';
  }

  btnTheme?.addEventListener('click', () => {
    ShareAudio.playClick();
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('sharekey_theme', isLight ? 'light' : 'dark');
    if (themeIcon) themeIcon.textContent = isLight ? '☀️' : '🌙';
  });
}

function initSoundControls() {
  const btnSound = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');

  const updateIcon = () => {
    if (soundIcon) soundIcon.textContent = ShareAudio.enabled ? '🔊' : '🔇';
  };
  updateIcon();

  btnSound?.addEventListener('click', () => {
    const enabled = ShareAudio.toggle();
    updateIcon();
  });
}

async function initViewer() {
  const pathParts = window.location.pathname.split('/');
  let tokenFromPath = '';
  if (pathParts.length >= 3 && (pathParts[1] === 'v' || pathParts[1] === 'view')) {
    tokenFromPath = pathParts[2];
  }

  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromQuery = urlParams.get('token');

  currentToken = (tokenFromPath || tokenFromQuery || '').trim().toUpperCase();

  if (!currentToken) {
    showErrorState('Missing Token', 'No access token provided. Please check your link or enter a valid key on the home page.', '⚠️');
    return;
  }

  await loadSecretWorkflow();
}

async function loadSecretWorkflow() {
  try {
    const meta = await ShareAPI.getShareInfo(currentToken);
    currentShareMeta = meta;

    if (meta.is_encrypted) {
      showPassphraseChallenge(meta);
      return;
    }

    if (meta.burn_after_reading) {
      showBurnConfirmation(meta);
      return;
    }

    await fetchAndDisplayContent();
  } catch (err) {
    showErrorState('Secret Unavailable', err.message || 'The requested secret has expired, was burned, or does not exist.', '🔒');
  }
}

function showPassphraseChallenge(meta) {
  hideAllViews();
  const challengeCard = document.getElementById('view-passphrase-challenge');
  const hintBox = document.getElementById('passphrase-hint-box');
  const hintText = document.getElementById('display-hint-text');

  if (meta.encryption_hint) {
    hintText.textContent = meta.encryption_hint;
    hintBox.style.display = 'block';
  } else {
    hintBox.style.display = 'none';
  }

  challengeCard.style.display = 'block';
  document.getElementById('input-unlock-passphrase').focus();
}

function showBurnConfirmation(meta) {
  hideAllViews();
  const confirmCard = document.getElementById('view-burn-confirm');
  confirmCard.style.display = 'block';

  document.getElementById('btn-confirm-reveal').onclick = async () => {
    ShareAudio.playBurn();
    await fetchAndDisplayContent();
  };
}

async function handlePassphraseUnlock() {
  ShareAudio.playClick();
  const passphraseInput = document.getElementById('input-unlock-passphrase');
  const passphrase = passphraseInput.value;

  if (!passphrase) {
    showToast('Please enter your passphrase.', 'error');
    return;
  }

  try {
    const data = await ShareAPI.getShareContent(currentToken);
    const decryptedText = await ShareCrypto.decrypt(data.content, passphrase);
    ShareAudio.playUnlock();
    renderSuccessContent(data, decryptedText);
  } catch (err) {
    showToast(err.message || 'Incorrect passphrase.', 'error');
    passphraseInput.value = '';
    passphraseInput.focus();
  }
}

async function fetchAndDisplayContent() {
  try {
    showLoading();
    const data = await ShareAPI.getShareContent(currentToken);
    
    let content = data.content;
    if (data.is_encrypted) {
      showPassphraseChallenge(data);
      return;
    }

    ShareAudio.playUnlock();
    renderSuccessContent(data, content);
  } catch (err) {
    showErrorState('Unable to Load Secret', err.message, '⚠️');
  }
}

function renderSuccessContent(data, plaintext) {
  hideAllViews();
  rawSecretPayload = plaintext;

  const successCard = document.getElementById('view-content-success');
  const titleEl = document.getElementById('view-title-text');
  const codeBlock = document.getElementById('view-code-block');
  const tokenBadge = document.getElementById('badge-token');
  const formatBadge = document.getElementById('badge-format');
  const expiryBadge = document.getElementById('badge-expiry');
  const viewsBadge = document.getElementById('badge-views');
  const burnBanner = document.getElementById('view-burn-banner');
  const statCounter = document.getElementById('view-stat-counter');
  const typeLabel = document.getElementById('view-content-type-label');

  titleEl.textContent = data.title || 'Secure Share';
  
  // Syntax Highlighting formatting
  codeBlock.innerHTML = ShareSyntax.highlight(plaintext, data.content_type || 'text/plain');
  
  tokenBadge.textContent = data.token;
  
  const formatName = getFormatLabel(data.content_type);
  formatBadge.textContent = formatName;
  typeLabel.textContent = formatName.toUpperCase();

  if (data.expires_at) {
    expiryBadge.textContent = `Expires: ${new Date(data.expires_at).toLocaleString()}`;
  } else {
    expiryBadge.textContent = 'Never Expiring';
  }

  if (data.max_views > 0) {
    viewsBadge.textContent = `Views: ${data.current_views} / ${data.max_views}`;
  } else {
    viewsBadge.textContent = `Views: ${data.current_views} (Unlimited)`;
  }

  // Handle Burn & Screen-wipe countdown
  if (data.is_burned_now || data.burn_after_reading) {
    burnBanner.style.display = 'flex';
    startScreenWipeCountdown(60);
  } else {
    burnBanner.style.display = 'none';
  }

  statCounter.textContent = `${plaintext.length.toLocaleString()} characters • ${plaintext.split('\n').length} lines`;

  document.getElementById('btn-copy-secret').onclick = () => {
    ShareAudio.playClick();
    navigator.clipboard.writeText(plaintext);
    showToast('Secret content copied to clipboard!', 'success');
  };

  document.getElementById('btn-download-secret').onclick = () => {
    ShareAudio.playClick();
    downloadPayloadAsFile(data.title || 'sharekey-secret', plaintext, data.content_type);
  };

  document.getElementById('btn-print-secret').onclick = () => {
    window.print();
  };

  successCard.style.display = 'block';
}

// Screen Wipe Countdown
function startScreenWipeCountdown(seconds = 60) {
  const wrap = document.getElementById('wipe-bar-wrap');
  const fill = document.getElementById('wipe-bar-fill');
  const countdownText = document.getElementById('wipe-countdown-seconds');

  if (!wrap || !fill || !countdownText) return;
  wrap.style.display = 'block';

  let remaining = seconds;
  if (wipeInterval) clearInterval(wipeInterval);

  wipeInterval = setInterval(() => {
    remaining--;
    countdownText.textContent = `${remaining}s`;
    const pct = Math.max(0, (remaining / seconds) * 100);
    fill.style.width = `${pct}%`;

    if (remaining <= 0) {
      clearInterval(wipeInterval);
      // Wipe content from memory and screen
      rawSecretPayload = '';
      document.getElementById('view-code-block').innerHTML = '<div style="padding: 20px; color: #f87171; text-align: center; font-weight: 600;">🔒 Secret erased from screen memory for your security.</div>';
      countdownText.textContent = 'Erased';
      ShareAudio.playBurn();
    }
  }, 1000);
}

function downloadPayloadAsFile(filename, text, mimeType) {
  let ext = '.txt';
  if (mimeType && mimeType.includes('json')) ext = '.json';
  else if (mimeType && mimeType.includes('javascript')) ext = '.js';
  else if (mimeType && mimeType.includes('python')) ext = '.py';
  else if (mimeType && mimeType.includes('markdown')) ext = '.md';
  else if (mimeType && mimeType.includes('env')) ext = '.env';
  else if (mimeType && mimeType.includes('sql')) ext = '.sql';

  const cleanName = filename.replace(/[^a-zA-Z0-9_-]/g, '_') + ext;
  const blob = new Blob([text], { type: mimeType || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${cleanName}`, 'success');
}

function getFormatLabel(mime) {
  if (!mime) return 'Plain Text';
  if (mime.includes('json')) return 'JSON';
  if (mime.includes('javascript')) return 'JavaScript';
  if (mime.includes('python')) return 'Python';
  if (mime.includes('markdown')) return 'Markdown';
  if (mime.includes('env')) return 'Environment Config';
  if (mime.includes('sql')) return 'SQL';
  return 'Plain Text';
}

function showLoading() {
  hideAllViews();
  document.getElementById('view-loading').style.display = 'block';
}

function showErrorState(title, message) {
  hideAllViews();
  const errorCard = document.getElementById('view-error-card');
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-desc').textContent = message;
  errorCard.style.display = 'block';
}

function hideAllViews() {
  const ids = ['view-loading', 'view-passphrase-challenge', 'view-burn-confirm', 'view-content-success', 'view-error-card'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  toast.innerHTML = `
    <span style="font-weight: 700;">${type === 'error' ? '!' : '✓'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
