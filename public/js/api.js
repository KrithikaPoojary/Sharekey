/**
 * ShareKey Client API Interface & Local Vault Manager
 */

const API_BASE = '/api';

const ShareAPI = {
  // Create a new share
  async createShare(payload) {
    const response = await fetch(`${API_BASE}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create share.');
    }

    // Save to local vault history
    this.saveToHistory(data.data);

    return data.data;
  },

  // Inspect share metadata before viewing/burning
  async getShareInfo(token) {
    const cleanToken = encodeURIComponent(token.trim().toUpperCase());
    const response = await fetch(`${API_BASE}/shares/${cleanToken}/info`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Unable to retrieve share info.');
    }

    return data.data;
  },

  // Retrieve actual secret payload (consumes view count)
  async getShareContent(token) {
    const cleanToken = encodeURIComponent(token.trim().toUpperCase());
    const response = await fetch(`${API_BASE}/shares/${cleanToken}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Unable to retrieve secret content.');
    }

    return data.data;
  },

  // Revoke / delete share permanently using creator key
  async revokeShare(token, creatorKey) {
    const cleanToken = encodeURIComponent(token.trim().toUpperCase());
    const response = await fetch(`${API_BASE}/shares/${cleanToken}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-creator-key': creatorKey
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to revoke share.');
    }

    // Update local vault history
    this.removeFromHistory(token);

    return data;
  },

  // Local Storage Vault Helpers
  getHistory() {
    try {
      const items = localStorage.getItem('sharekey_vault_history');
      return items ? JSON.parse(items) : [];
    } catch (e) {
      return [];
    }
  },

  saveToHistory(shareItem) {
    try {
      const history = this.getHistory();
      // Avoid duplicate tokens
      const filtered = history.filter(item => item.token !== shareItem.token);
      filtered.unshift({
        token: shareItem.token,
        title: shareItem.title || 'Untitled Secret',
        creator_key: shareItem.creator_key,
        share_url: shareItem.share_url,
        is_encrypted: shareItem.is_encrypted,
        burn_after_reading: shareItem.burn_after_reading,
        max_views: shareItem.max_views,
        expires_at: shareItem.expires_at,
        created_at: shareItem.created_at || new Date().toISOString()
      });
      // Keep last 30 shares
      localStorage.setItem('sharekey_vault_history', JSON.stringify(filtered.slice(0, 30)));
    } catch (e) {
      console.error('Failed to save to local history', e);
    }
  },

  removeFromHistory(token) {
    try {
      const history = this.getHistory();
      const updated = history.filter(item => item.token !== token);
      localStorage.setItem('sharekey_vault_history', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update local history', e);
    }
  }
};

window.ShareAPI = ShareAPI;
