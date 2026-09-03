const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'sharekey.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance and concurrency
db.pragma('journal_mode = WAL');

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
    max_views INTEGER DEFAULT 0, -- 0 means unlimited until expiry
    current_views INTEGER DEFAULT 0,
    burn_after_reading INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME, -- NULL means never
    is_burned INTEGER DEFAULT 0,
    burned_at DATETIME,
    passphrase_hash TEXT -- Optional server-side verification hash if enabled
  );

  CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);
  CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at);
`);

// Clean expired shares helper
function cleanExpiredShares() {
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

// Database query helpers
const dbOps = {
  createShare: db.transaction((data) => {
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
  }),

  getShareByToken: (token) => {
    const stmt = db.prepare(`
      SELECT * FROM shares WHERE token = ?
    `);
    return stmt.get(token);
  },

  getShareMetadata: (token) => {
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

  incrementAndCheckView: db.transaction((token) => {
    const share = db.prepare(`SELECT * FROM shares WHERE token = ?`).get(token);
    if (!share) return null;

    const now = new Date();
    // Check if already expired
    if (share.expires_at && new Date(share.expires_at) <= now) {
      return { status: 'expired' };
    }

    // Check if already burned
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
  }),

  deleteShareByCreator: (token, creatorKey) => {
    const stmt = db.prepare(`
      DELETE FROM shares WHERE token = ? AND creator_key = ?
    `);
    const res = stmt.run(token, creatorKey);
    return res.changes > 0;
  },

  cleanExpiredShares
};

module.exports = { db, dbOps };
