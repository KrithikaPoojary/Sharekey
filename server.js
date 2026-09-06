const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { dbOps } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Helper to detect local network IPv4 address for mobile scanning
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// In-Memory Rate Limiting for Token Guessing Protection
const rateLimitMap = new Map();
function rateLimiter(limit = 60, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + windowMs;
    } else {
      entry.count++;
    }

    rateLimitMap.set(ip, entry);

    if (entry.count > limit) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please slow down.'
      });
    }
    next();
  };
}

// Clean up stale rate-limiting entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 300000);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Token Generator Helper
function generateToken(length = 8) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let token = 'SK-';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    if (i === 4) token += '-';
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

function generateCreatorKey() {
  return 'CRK-' + crypto.randomBytes(16).toString('hex');
}

// API: Get network info for mobile connections
app.get('/api/network-info', (req, res) => {
  const lanIp = getLocalIpAddress();
  res.json({
    success: true,
    ip: lanIp,
    port: PORT,
    base_url: `http://${lanIp}:${PORT}`
  });
});

// API: Create new share (Rate limited: 30 shares / minute)
app.post('/api/shares', rateLimiter(30, 60000), (req, res) => {
  try {
    const {
      content,
      title = '',
      content_type = 'text/plain',
      file_name = null,
      file_size = 0,
      is_encrypted = false,
      encryption_hint = '',
      expires_in_seconds = null,
      max_views = 0,
      burn_after_reading = false,
      custom_token = null,
      passphrase_hash = null
    } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Content cannot be empty.' });
    }

    let token = '';
    if (custom_token && typeof custom_token === 'string') {
      const sanitized = custom_token.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (sanitized.length < 4 || sanitized.length > 32) {
        return res.status(400).json({ success: false, error: 'Custom token must be between 4 and 32 alphanumeric characters.' });
      }
      const existing = dbOps.getShareByToken(sanitized);
      if (existing) {
        return res.status(409).json({ success: false, error: 'This custom token is already in use or taken.' });
      }
      token = sanitized;
    } else {
      let unique = false;
      let attempts = 0;
      while (!unique && attempts < 10) {
        token = generateToken(8);
        const existing = dbOps.getShareByToken(token);
        if (!existing) unique = true;
        attempts++;
      }
      if (!unique) {
        token = 'SK-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      }
    }

    const creator_key = generateCreatorKey();

    let expires_at = null;
    if (expires_in_seconds && Number(expires_in_seconds) > 0) {
      const expDate = new Date(Date.now() + Number(expires_in_seconds) * 1000);
      expires_at = expDate.toISOString();
    }

    const shareData = {
      token,
      creator_key,
      title: title ? title.slice(0, 150) : 'Secure Share',
      content,
      content_type: content_type || 'text/plain',
      file_name: file_name ? file_name.slice(0, 255) : null,
      file_size: Number(file_size) || 0,
      is_encrypted: is_encrypted ? 1 : 0,
      encryption_hint: encryption_hint ? encryption_hint.slice(0, 100) : '',
      max_views: burn_after_reading ? 1 : Math.max(0, parseInt(max_views, 10) || 0),
      burn_after_reading: burn_after_reading ? 1 : 0,
      expires_at,
      passphrase_hash: passphrase_hash || null
    };

    dbOps.createShare(shareData);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const shareUrl = `${protocol}://${host}/v/${token}`;
    
    // Construct local network URL so mobile devices on Wi-Fi can open it directly
    const lanIp = getLocalIpAddress();
    const networkUrl = `http://${lanIp}:${PORT}/v/${token}`;

    res.status(201).json({
      success: true,
      data: {
        token,
        creator_key,
        share_url: shareUrl,
        network_url: networkUrl,
        title: shareData.title,
        is_encrypted: Boolean(shareData.is_encrypted),
        encryption_hint: shareData.encryption_hint,
        burn_after_reading: Boolean(shareData.burn_after_reading),
        max_views: shareData.max_views,
        expires_at: shareData.expires_at,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error creating share:', err);
    res.status(500).json({ success: false, error: 'Internal server error while creating share.' });
  }
});

// API: Get share metadata
app.get('/api/shares/:token/info', rateLimiter(100, 60000), (req, res) => {
  try {
    const { token } = req.params;
    const meta = dbOps.getShareMetadata(token.trim().toUpperCase());

    if (!meta) {
      return res.status(404).json({ success: false, error: 'Token not found or already deleted.' });
    }

    const now = new Date();
    if (meta.expires_at && new Date(meta.expires_at) <= now) {
      return res.status(410).json({ success: false, error: 'This share has expired and is no longer available.' });
    }

    if (meta.is_burned === 1 || (meta.max_views > 0 && meta.current_views >= meta.max_views)) {
      return res.status(410).json({ success: false, error: 'This share was burned after reading and destroyed.' });
    }

    const viewsRemaining = meta.max_views > 0 ? Math.max(0, meta.max_views - meta.current_views) : null;

    res.json({
      success: true,
      data: {
        token: meta.token,
        title: meta.title,
        content_type: meta.content_type,
        file_name: meta.file_name,
        file_size: meta.file_size,
        is_encrypted: Boolean(meta.is_encrypted),
        encryption_hint: meta.encryption_hint,
        burn_after_reading: Boolean(meta.burn_after_reading),
        max_views: meta.max_views,
        current_views: meta.current_views,
        views_remaining: viewsRemaining,
        expires_at: meta.expires_at,
        created_at: meta.created_at,
        has_passphrase: Boolean(meta.has_passphrase)
      }
    });
  } catch (err) {
    console.error('Error fetching share info:', err);
    res.status(500).json({ success: false, error: 'Error inspecting share metadata.' });
  }
});

// API: Retrieve content
app.get('/api/shares/:token', rateLimiter(60, 60000), (req, res) => {
  try {
    const token = req.params.token.trim().toUpperCase();
    const result = dbOps.incrementAndCheckView(token);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Token not found or has been revoked.' });
    }

    if (result.status === 'expired') {
      return res.status(410).json({ success: false, error: 'This share has expired and is no longer accessible.' });
    }

    if (result.status === 'burned') {
      return res.status(410).json({ success: false, error: 'This share was one-time view only and has been permanently destroyed.' });
    }

    const share = result.share;
    const viewsRemaining = share.max_views > 0 ? Math.max(0, share.max_views - share.current_views) : null;

    res.json({
      success: true,
      data: {
        token: share.token,
        title: share.title,
        content: share.content,
        content_type: share.content_type,
        file_name: share.file_name,
        file_size: share.file_size,
        is_encrypted: Boolean(share.is_encrypted),
        encryption_hint: share.encryption_hint,
        burn_after_reading: Boolean(share.burn_after_reading),
        is_burned_now: Boolean(share.is_burned),
        current_views: share.current_views,
        max_views: share.max_views,
        views_remaining: viewsRemaining,
        expires_at: share.expires_at,
        created_at: share.created_at
      }
    });
  } catch (err) {
    console.error('Error retrieving share:', err);
    res.status(500).json({ success: false, error: 'Error retrieving share content.' });
  }
});

// API: Revoke/delete share
app.delete('/api/shares/:token', (req, res) => {
  try {
    const token = req.params.token.trim().toUpperCase();
    const creatorKey = req.headers['x-creator-key'] || req.query.creator_key || req.body.creator_key;

    if (!creatorKey) {
      return res.status(401).json({ success: false, error: 'Creator key is required to revoke this share.' });
    }

    const deleted = dbOps.deleteShareByCreator(token, creatorKey);
    if (!deleted) {
      return res.status(403).json({ success: false, error: 'Invalid token or creator key does not match.' });
    }

    res.json({ success: true, message: `Share ${token} was permanently revoked and destroyed.` });
  } catch (err) {
    console.error('Error deleting share:', err);
    res.status(500).json({ success: false, error: 'Error revoking share.' });
  }
});

// API: Platform Health
app.get('/api/health', (req, res) => {
  try {
    res.json({
      status: 'online',
      platform: 'ShareKey',
      version: '1.1.0',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error' });
  }
});

// Scheduled Auto-Cleaner
setInterval(() => {
  try {
    const cleaned = dbOps.cleanExpiredShares();
    if (cleaned > 0) {
      console.log(`[Auto-Cleaner] Pruned ${cleaned} expired/burned shares.`);
    }
  } catch (e) {
    console.error('[Auto-Cleaner Error]', e);
  }
}, 60000);

// Friendly URL rewrite routes
app.get('/v/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

app.get('/view/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server listening on all interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLocalIpAddress();
  console.log(`===========================================`);
  console.log(`🔒 ShareKey Secure Server Running!`);
  console.log(`🌐 Local URL:   http://localhost:${PORT}`);
  console.log(`📱 Network URL: http://${lanIp}:${PORT}`);
  console.log(`⚡ Rate-Limiting & Security Headers Enabled`);
  console.log(`===========================================`);
});
