/**
 * ShareKey Secret Retrieval & Decryption Logic
 */

let currentToken = '';
let currentShareMeta = null;
let rawSecretPayload = '';

document.addEventListener('DOMContentLoaded', () => {
  initViewer();
});

async function initViewer() {
  // Extract token from URL
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
    // 1. Fetch metadata first without consuming view limit
    const meta = await ShareAPI.getShareInfo(currentToken);
    currentShareMeta = meta;

    // Check if passphrase protected
    if (meta.is_encrypted) {
      showPassphraseChallenge(meta);
      return;
    }

    // Check if strict 1-time burn (confirm before burning)
    if (meta.burn_after_reading) {
      showBurnConfirmation(meta);
      return;
    }

    // Otherwise directly fetch secret payload
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
    await fetchAndDisplayContent();
  };
}

async function handlePassphraseUnlock() {
  const passphraseInput = document.getElementById('input-unlock-passphrase');
  const passphrase = passphraseInput.value;

  if (!passphrase) {
    showToast('Please enter your passphrase.', 'error');
    return;
  }

  try {
    const data = await ShareAPI.getShareContent(currentToken);
    
    // Decrypt in browser using Web Crypto API
    const decryptedText = await ShareCrypto.decrypt(data.content, passphrase);
    
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
  codeBlock.textContent = plaintext;
  tokenBadge.textContent = data.token;
  
  // Format info
  const formatName = getFormatLabel(data.content_type);
  formatBadge.textContent = formatName;
  typeLabel.textContent = formatName.toUpperCase();

  // Expiry badge
  if (data.expires_at) {
    expiryBadge.textContent = `Expires: ${new Date(data.expires_at).toLocaleString()}`;
  } else {
    expiryBadge.textContent = 'Never Expiring';
  }

  // Views badge
  if (data.max_views > 0) {
    viewsBadge.textContent = `Views: ${data.current_views} / ${data.max_views}`;
  } else {
    viewsBadge.textContent = `Views: ${data.current_views} (Unlimited)`;
  }

  // Burn Alert
  if (data.is_burned_now || data.burn_after_reading) {
    burnBanner.style.display = 'flex';
  } else {
    burnBanner.style.display = 'none';
  }

  statCounter.textContent = `${plaintext.length.toLocaleString()} characters • ${plaintext.split('\n').length} lines`;

  // Init button triggers
  document.getElementById('btn-copy-secret').onclick = () => {
    navigator.clipboard.writeText(plaintext);
    showToast('Secret content copied to clipboard!', 'success');
  };

  document.getElementById('btn-download-secret').onclick = () => {
    downloadPayloadAsFile(data.title || 'sharekey-secret', plaintext, data.content_type);
  };

  document.getElementById('btn-print-secret').onclick = () => {
    window.print();
  };

  successCard.style.display = 'block';
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

function showErrorState(title, message, icon = '⚠️') {
  hideAllViews();
  const errorCard = document.getElementById('view-error-card');
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-desc').textContent = message;
  document.getElementById('error-icon').textContent = icon;
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
    <span>${type === 'error' ? '⚠️' : '✅'}</span>
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
