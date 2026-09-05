/**
 * ShareKey Main Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  initTheme();
  initSoundControls();
  initCounters();
  initTools();
  initDropzone();
  initToggles();
  initPassphraseGenerator();
  initCreation();
  updateVaultBadge();
}

// Theme Switcher
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
    showToast(`Switched to ${isLight ? 'Light' : 'Dark'} theme`, 'success');
  });
}

// Sound Controls
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
    showToast(`Audio FX ${enabled ? 'Enabled' : 'Muted'}`, 'success');
  });
}

// Tab Switching
function switchMainTab(tab) {
  ShareAudio.playClick();
  const tabs = ['share', 'retrieve', 'vault'];
  tabs.forEach(t => {
    const view = document.getElementById(`tab-${t}-view`);
    const btn = document.getElementById(`nav-${t}-tab`);
    if (view && btn) {
      if (t === tab) {
        view.style.display = 'block';
        btn.classList.add('active');
      } else {
        view.style.display = 'none';
        btn.classList.remove('active');
      }
    }
  });

  if (tab === 'vault') {
    renderVaultHistory();
  }
}

// Live Text Counters
function initCounters() {
  const textarea = document.getElementById('share-content');
  const charSpan = document.getElementById('char-count');
  const wordSpan = document.getElementById('word-count');
  const lineSpan = document.getElementById('line-count');

  if (!textarea) return;

  const updateStats = () => {
    const text = textarea.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split('\n').length : 1;

    charSpan.textContent = `${chars.toLocaleString()} character${chars === 1 ? '' : 's'}`;
    wordSpan.textContent = `${words.toLocaleString()} word${words === 1 ? '' : 's'}`;
    lineSpan.textContent = `${lines} line${lines === 1 ? '' : 's'}`;
  };

  textarea.addEventListener('input', updateStats);
  updateStats();
}

// Toolbar actions
function initTools() {
  const textarea = document.getElementById('share-content');
  const titleInput = document.getElementById('share-title');
  const syntaxSelect = document.getElementById('syntax-select');

  document.getElementById('btn-paste-clip')?.addEventListener('click', async () => {
    ShareAudio.playClick();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input'));
        showToast('Pasted from clipboard!', 'success');
      }
    } catch (err) {
      showToast('Clipboard access denied. Please paste manually.', 'error');
    }
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    ShareAudio.playClick();
    if (textarea.value && confirm('Are you sure you want to clear the editor?')) {
      textarea.value = '';
      titleInput.value = '';
      textarea.dispatchEvent(new Event('input'));
    }
  });

  document.getElementById('btn-sample')?.addEventListener('click', () => {
    ShareAudio.playClick();
    titleInput.value = 'Production DB Credentials';
    syntaxSelect.value = 'text/x-env';
    textarea.value = `# ShareKey Encrypted Database Secrets
DB_HOST=db.vault.cloud-cluster.internal
DB_PORT=5432
DB_USER=sec_master_admin
DB_PASS=uK8$mP29#xL99!vQ_z7
JWT_SECRET=super_secret_production_key_gcm_256
REDIS_URL=rediss://default:p4ssw0rd@redis-cache.internal:6379`;
    textarea.dispatchEvent(new Event('input'));
    showToast('Sample credentials loaded', 'success');
  });

  document.getElementById('btn-paste-token')?.addEventListener('click', async () => {
    ShareAudio.playClick();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const tokenInput = document.getElementById('retrieve-token-input');
        tokenInput.value = text.trim().toUpperCase();
        showToast('Token pasted!', 'success');
      }
    } catch (e) {
      showToast('Please paste token manually.', 'error');
    }
  });
}

// Drag and drop / File upload
function initDropzone() {
  const dropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('file-input');
  const textarea = document.getElementById('share-content');
  const titleInput = document.getElementById('share-title');
  const syntaxSelect = document.getElementById('syntax-select');
  const label = document.getElementById('dropzone-label');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => {
    ShareAudio.playClick();
    fileInput.click();
  });

  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleUploadedFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleUploadedFile(fileInput.files[0]);
    }
  });

  function handleUploadedFile(file) {
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size exceeds 10MB limit.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      textarea.value = event.target.result;
      textarea.dispatchEvent(new Event('input'));
      if (!titleInput.value) {
        titleInput.value = file.name;
      }
      label.innerHTML = `<strong>Loaded:</strong> ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'json') syntaxSelect.value = 'application/json';
      else if (['js', 'ts'].includes(ext)) syntaxSelect.value = 'text/javascript';
      else if (ext === 'py') syntaxSelect.value = 'text/x-python';
      else if (ext === 'md') syntaxSelect.value = 'text/markdown';
      else if (['env', 'ini'].includes(ext)) syntaxSelect.value = 'text/x-env';
      else if (ext === 'sql') syntaxSelect.value = 'text/x-sql';

      showToast(`Loaded file: ${file.name}`, 'success');
    };
    reader.readAsText(file);
  }
}

// Form toggles
function initToggles() {
  const burnToggle = document.getElementById('burn-toggle');
  const maxViewsSelect = document.getElementById('max-views-select');
  const passphraseToggle = document.getElementById('passphrase-toggle');
  const passphraseFields = document.getElementById('passphrase-fields');

  burnToggle?.addEventListener('change', () => {
    ShareAudio.playClick();
    if (burnToggle.checked) {
      maxViewsSelect.value = '1';
      maxViewsSelect.disabled = true;
    } else {
      maxViewsSelect.disabled = false;
      maxViewsSelect.value = '0';
    }
  });

  passphraseToggle?.addEventListener('change', () => {
    ShareAudio.playClick();
    if (passphraseToggle.checked) {
      passphraseFields.style.display = 'block';
      document.getElementById('share-passphrase')?.focus();
    } else {
      passphraseFields.style.display = 'none';
    }
  });
}

// Passphrase Generator & Strength Evaluator
function initPassphraseGenerator() {
  const passInput = document.getElementById('share-passphrase');
  const btnGen = document.getElementById('btn-generate-pass');
  const fillBar = document.getElementById('pass-strength-fill');
  const textLabel = document.getElementById('pass-strength-text');

  const updateStrength = () => {
    if (!passInput) return;
    const res = SharePassphrase.evaluate(passInput.value);
    if (fillBar) {
      fillBar.style.width = res.width;
      fillBar.style.backgroundColor = res.color;
    }
    if (textLabel) {
      textLabel.textContent = res.label;
      textLabel.style.color = res.color;
    }
  };

  passInput?.addEventListener('input', updateStrength);

  btnGen?.addEventListener('click', () => {
    ShareAudio.playLock();
    const autoPass = SharePassphrase.generate(16);
    passInput.value = autoPass;
    updateStrength();
    showToast('Secure passphrase generated!', 'success');
  });
}

// Share Creation Handler
function initCreation() {
  const btnCreate = document.getElementById('btn-create-share');
  if (!btnCreate) return;

  btnCreate.addEventListener('click', async () => {
    ShareAudio.playClick();
    const content = document.getElementById('share-content').value.trim();
    const title = document.getElementById('share-title').value.trim() || 'Secure Share';
    const syntax = document.getElementById('syntax-select').value;
    const expiry = document.getElementById('expiry-select').value;
    const burn = document.getElementById('burn-toggle').checked;
    const maxViews = document.getElementById('max-views-select').value;
    const customToken = document.getElementById('custom-token-input').value.trim();
    const isPassphrase = document.getElementById('passphrase-toggle').checked;
    const passphrase = document.getElementById('share-passphrase').value;
    const encHint = document.getElementById('encryption-hint').value.trim();

    if (!content) {
      showToast('Please enter text or secrets to share.', 'error');
      document.getElementById('share-content').focus();
      return;
    }

    if (isPassphrase && !passphrase) {
      showToast('Please specify a passphrase or turn off passphrase lock.', 'error');
      document.getElementById('share-passphrase').focus();
      return;
    }

    try {
      btnCreate.disabled = true;
      btnCreate.innerHTML = '<span>⏳</span> Encrypting & Generating...';

      let finalContent = content;
      let passphraseHash = null;

      if (isPassphrase) {
        finalContent = await ShareCrypto.encrypt(content, passphrase);
        passphraseHash = await ShareCrypto.hashString(passphrase);
      }

      const payload = {
        content: finalContent,
        title,
        content_type: syntax,
        expires_in_seconds: Number(expiry) > 0 ? Number(expiry) : null,
        burn_after_reading: burn,
        max_views: burn ? 1 : Number(maxViews),
        custom_token: customToken || null,
        is_encrypted: isPassphrase,
        encryption_hint: encHint,
        passphrase_hash: passphraseHash
      };

      const result = await ShareAPI.createShare(payload);
      ShareAudio.playLock();
      displaySuccessModal(result);
      updateVaultBadge();

      document.getElementById('share-content').value = '';
      document.getElementById('share-content').dispatchEvent(new Event('input'));
    } catch (err) {
      showToast(err.message || 'Error generating token.', 'error');
    } finally {
      btnCreate.disabled = false;
      btnCreate.innerHTML = '<span>⚡</span> Generate Secure Access Key';
    }
  });
}

// Display Share Created Modal
let qrCodeInstance = null;
function displaySuccessModal(shareData) {
  const modal = document.getElementById('share-success-modal');
  const tokenText = document.getElementById('modal-token-text');
  const urlInput = document.getElementById('modal-share-url');
  const btnCopyToken = document.getElementById('btn-copy-token');
  const btnCopyUrl = document.getElementById('btn-copy-url');
  const btnWhatsapp = document.getElementById('btn-share-whatsapp');
  const btnEmail = document.getElementById('btn-share-email');
  const btnOpen = document.getElementById('btn-open-direct');

  tokenText.textContent = shareData.token;
  urlInput.value = shareData.share_url;

  const qrContainer = document.getElementById('modal-qrcode');
  qrContainer.innerHTML = '';
  qrCodeInstance = new QRCode(qrContainer, {
    text: shareData.share_url,
    width: 140,
    height: 140,
    colorDark: '#060911',
    colorLight: '#ffffff'
  });

  const shareMsg = encodeURIComponent(`Secure content shared with you via ShareKey:\nAccess Token: ${shareData.token}\nLink: ${shareData.share_url}`);
  btnWhatsapp.href = `https://api.whatsapp.com/send?text=${shareMsg}`;
  btnEmail.href = `mailto:?subject=${encodeURIComponent('Secure ShareKey Content')}&body=${shareMsg}`;

  btnCopyToken.onclick = () => {
    ShareAudio.playClick();
    navigator.clipboard.writeText(shareData.token);
    showToast('Token copied to clipboard!', 'success');
  };

  btnCopyUrl.onclick = () => {
    ShareAudio.playClick();
    navigator.clipboard.writeText(shareData.share_url);
    showToast('Access link copied!', 'success');
  };

  btnOpen.onclick = () => {
    ShareAudio.playClick();
    window.open(shareData.share_url, '_blank');
  };

  modal.classList.add('active');
}

function closeSuccessModal() {
  ShareAudio.playClick();
  document.getElementById('share-success-modal')?.classList.remove('active');
}

// Retrieve Search handler
function handleRetrieveSearch() {
  ShareAudio.playClick();
  const input = document.getElementById('retrieve-token-input');
  const token = input.value.trim().toUpperCase();
  if (!token) {
    showToast('Please enter an access token.', 'error');
    return;
  }
  window.location.href = `/v/${encodeURIComponent(token)}`;
}

// Render Vault History
function renderVaultHistory() {
  const tbody = document.getElementById('vault-table-body');
  if (!tbody) return;

  const history = ShareAPI.getHistory();
  if (history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-dim); padding: 30px;">
          No active shares recorded in this browser yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = history.map(item => {
    const isExpired = item.expires_at && new Date(item.expires_at) < new Date();
    const expiryText = item.expires_at ? formatTimeRemaining(item.expires_at) : 'Never';
    const createdText = new Date(item.created_at).toLocaleDateString();

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: #fff;">${escapeHtml(item.title)}</div>
          <div style="font-family: var(--font-mono); font-size: 13px; color: var(--primary); margin-top: 2px;">
            ${item.token}
          </div>
        </td>
        <td>
          ${item.is_encrypted ? '<span class="status-tag status-active">🔐 AES-256</span>' : '<span class="status-tag" style="background: rgba(255,255,255,0.06);">Plain</span>'}
          ${item.burn_after_reading ? '<span class="status-tag status-burned" style="margin-left: 4px;">🔥 1-View</span>' : ''}
        </td>
        <td style="color: var(--text-muted); font-size: 13px;">${createdText}</td>
        <td>
          <span style="font-size: 13px; color: ${isExpired ? 'var(--danger)' : 'var(--cyan)'};">
            ${isExpired ? '⚠️ Expired' : expiryText}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <a href="${item.share_url || `/v/${item.token}`}" target="_blank" class="tool-btn" title="Open share">
              ↗️
            </a>
            <button type="button" class="tool-btn" onclick="copyTextToClipboard('${item.token}', 'Token copied!')" title="Copy Token">
              📋
            </button>
            <button type="button" class="tool-btn" style="color: var(--danger);" onclick="revokeFromVault('${item.token}', '${item.creator_key}')" title="Revoke & Delete permanently">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function updateVaultBadge() {
  const countSpan = document.getElementById('vault-count');
  if (countSpan) {
    const history = ShareAPI.getHistory();
    countSpan.textContent = history.length;
  }
}

async function revokeFromVault(token, creatorKey) {
  if (!confirm(`Are you sure you want to permanently delete and revoke token ${token}? Anyone with the link will immediately lose access.`)) {
    return;
  }

  try {
    ShareAudio.playBurn();
    await ShareAPI.revokeShare(token, creatorKey);
    showToast(`Token ${token} permanently revoked.`, 'success');
    renderVaultHistory();
    updateVaultBadge();
  } catch (err) {
    showToast(err.message || 'Failed to revoke token.', 'error');
  }
}

// Helpers
function formatTimeRemaining(isoDate) {
  const diff = new Date(isoDate) - new Date();
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `in ${days}d ${hours % 24}h`;
  if (hours > 0) return `in ${hours}h ${mins % 60}m`;
  return `in ${mins}m`;
}

function copyTextToClipboard(text, msg = 'Copied to clipboard!') {
  ShareAudio.playClick();
  navigator.clipboard.writeText(text);
  showToast(msg, 'success');
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
