const path = require('path');
const fs = require('fs');

let db = null;
let useMemoryFallback = false;
const memoryStore = new Map();

// Determine database path (/tmp on Vercel serverless, local directory on PC)
const dbPath = process.env.VERCEL 
  ? path.join('/tmp', 'sharekey.db')
  : path.join(__dirname, 'sharekey.db');

try {
  const Database = require('better-sqlite3');
  db = new Database(dbPath);

  // Enable WAL mode for high performance
  try {
    db.pragma('journal_mode = WAL');
  } catch (e) {
    // Ignore pragma errors on read-only environments
  }

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      creator_key TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      content_type TEXT DEFAULT 'text/plain',
      file_name TEXT,
      file_size INTEGER DEFAULT 0,
      is_encrypted INTEGER DEFAULT 0,
      encryption_hint TEXT,
      max_views INTEGER DEFAULT 0,
      current_views INTEGER DEFAULT 0,
      burn_after_reading INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      is_burned INTEGER DEFAULT 0,
      burned_at DATETIME,
      passphrase_hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);
    CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at);
  `);
} catch (err) {
  console.warn('[Database] better-sqlite3 native bindings unavailable, using high-performance serverless in-memory store:', err.message);
  useMemoryFallback = true;
}

// Clean expired shares helper
function cleanExpiredShares() {
  if (useMemoryFallback) {
    const now = new Date();
    let cleaned = 0;
    for (const [token, share] of memoryStore.entries()) {
      if (share.expires_at && new Date(share.expires_at) <= now) {
        memoryStore.delete(token);
        cleaned++;
      } else if (share.is_burned) {
        memoryStore.delete(token);
        cleaned++;
      }
    }
    return cleaned;
  }

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    DELETE FROM shares 
    WHERE (expires_at IS NOT NULL AND expires_at <= ?)
       OR (burn_after_reading = 1 AND is_burned = 1 AND datetime(burned_at, '+5 minutes') <= ?)
       OR (max_views > 0 AND current_views >= max_views AND is_burned = 1 AND datetime(burned_at, '+5 minutes') <= ?)
  `);
  const result = stmt.run(now, now, now);
  return result.changes;
}

// Database operations with transparent SQLite & serverless fallback
const dbOps = {
  createShare: (data) => {
    if (useMemoryFallback) {
      memoryStore.set(data.token, {
        ...data,
        id: Date.now(),
        current_views: 0,
        is_burned: 0,
        created_at: new Date().toISOString()
      });
      return data;
    }

    const stmt = db.prepare(`
      INSERT INTO shares (
        token, creator_key, title, content, content_type, file_name, file_size,
        is_encrypted, encryption_hint, max_views, burn_after_reading,
        expires_at, passphrase_hash
      ) VALUES (
        @token, @creator_key, @title, @content, @content_type, @file_name, @file_size,
        @is_encrypted, @encryption_hint, @max_views, @burn_after_reading,
        @expires_at, @passphrase_hash
      )
    `);
    stmt.run(data);
    return data;
  },

  getShareByToken: (token) => {
    if (useMemoryFallback) {
      return memoryStore.get(token) || null;
    }
    const stmt = db.prepare(`SELECT * FROM shares WHERE token = ?`);
    return stmt.get(token);
  },

  getShareMetadata: (token) => {
    if (useMemoryFallback) {
      const share = memoryStore.get(token);
      if (!share) return null;
      return {
        token: share.token,
        title: share.title,
        content_type: share.content_type,
        file_name: share.file_name,
        file_size: share.file_size,
        is_encrypted: share.is_encrypted,
        encryption_hint: share.encryption_hint,
        max_views: share.max_views,
        current_views: share.current_views,
        burn_after_reading: share.burn_after_reading,
        created_at: share.created_at,
        expires_at: share.expires_at,
        is_burned: share.is_burned,
        has_passphrase: Boolean(share.passphrase_hash)
      };
    }

    const stmt = db.prepare(`
      SELECT 
        token, title, content_type, file_name, file_size,
        is_encrypted, encryption_hint, max_views, current_views,
        burn_after_reading, created_at, expires_at, is_burned,
        (passphrase_hash IS NOT NULL AND passphrase_hash != '') AS has_passphrase
      FROM shares WHERE token = ?
    `);
    return stmt.get(token);
  },

  incrementAndCheckView: (token) => {
    if (useMemoryFallback) {
      const share = memoryStore.get(token);
      if (!share) return null;

      const now = new Date();
      if (share.expires_at && new Date(share.expires_at) <= now) {
        return { status: 'expired' };
      }
      if (share.is_burned) {
        return { status: 'burned' };
      }

      share.current_views = (share.current_views || 0) + 1;
      let shouldBurn = false;
      if (share.burn_after_reading === 1 || (share.max_views > 0 && share.current_views >= share.max_views)) {
        shouldBurn = true;
      }

      share.is_burned = shouldBurn ? 1 : 0;
      memoryStore.set(token, share);

      return {
        status: 'active',
        share: { ...share }
      };
    }

    const share = db.prepare(`SELECT * FROM shares WHERE token = ?`).get(token);
    if (!share) return null;

    const now = new Date();
    if (share.expires_at && new Date(share.expires_at) <= now) {
      return { status: 'expired' };
    }

    if (share.is_burned) {
      return { status: 'burned' };
    }

    const newViews = share.current_views + 1;
    let shouldBurn = false;

    if (share.burn_after_reading === 1 || (share.max_views > 0 && newViews >= share.max_views)) {
      shouldBurn = true;
    }

    if (shouldBurn) {
      db.prepare(`
        UPDATE shares 
        SET current_views = ?, is_burned = 1, burned_at = CURRENT_TIMESTAMP 
        WHERE token = ?
      `).run(newViews, token);
    } else {
      db.prepare(`
        UPDATE shares 
        SET current_views = ? 
        WHERE token = ?
      `).run(newViews, token);
    }

    return {
      status: 'active',
      share: {
        ...share,
        current_views: newViews,
        is_burned: shouldBurn ? 1 : 0
      }
    };
  },

  deleteShareByCreator: (token, creatorKey) => {
    if (useMemoryFallback) {
      const share = memoryStore.get(token);
      if (share && share.creator_key === creatorKey) {
        memoryStore.delete(token);
        return true;
      }
      return false;
    }

    const stmt = db.prepare(`
      DELETE FROM shares WHERE token = ? AND creator_key = ?
    `);
    const res = stmt.run(token, creatorKey);
    return res.changes > 0;
  },

  cleanExpiredShares
};

module.exports = { db, dbOps };
