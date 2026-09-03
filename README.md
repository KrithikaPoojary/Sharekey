# ShareKey 🔑

> A secure, zero-knowledge content and secret sharing platform with access tokens, client-side AES-256-GCM encryption, and self-destruct capabilities.

![ShareKey Cyber Security](https://img.shields.io/badge/Security-AES--256--GCM-10B981?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-v22+-339933?style=for-the-badge&logo=node.js)
![Express](https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express)
![SQLite](https://img.shields.io/badge/SQLite-WAL--Mode-003B57?style=for-the-badge&logo=sqlite)

---

## 🌟 Key Features

- 🔑 **Unique Access Tokens**: Human-friendly, cryptographically random keys (e.g. `SK-8F92-K4D2`) or custom vanity tokens.
- 🛡️ **Zero-Knowledge Encryption**: Optional client-side AES-256-GCM authenticated encryption with PBKDF2 (100,000 rounds) key derivation. Unencrypted data never leaves the browser.
- 🔥 **Burn After Reading**: Configurable one-time self-destruct policy that permanently erases the secret from database storage immediately after the first view.
- ⏱️ **Granular Expiration**: Set automatic expiration for 5 minutes, 1 hour, 24 hours, 7 days, 30 days, or manual revocation.
- 🗄️ **Creator Vault & Revocation**: Local vault history allowing creators to track views and permanently revoke access tokens at any time using their private creator key.
- 📱 **QR Code & Direct Links**: Instant QR code generator and one-click sharing via WhatsApp, Email, or clipboard.
- 💻 **Syntax Detection & File Upload**: Drag-and-drop support for `.env`, `.json`, `.js`, `.py`, `.sql`, `.md`, and `.txt` files with word and line counters.
- 💎 **Cyber-Luxe Glassmorphism**: Sleek, high-performance responsive UI built with vanilla CSS tokens and smooth micro-interactions.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/KrithikaPoojary/Sharekey.git

# Navigate to project directory
cd Sharekey

# Install dependencies
npm install

# Start the server
npm start
```

Open your browser and visit: **`http://localhost:3000`**

---

## 📡 REST API Documentation

### 1. Create a Secret Share
```http
POST /api/shares
Content-Type: application/json

{
  "content": "Super sensitive database password",
  "title": "Production Secrets",
  "content_type": "text/x-env",
  "expires_in_seconds": 86400,
  "burn_after_reading": true,
  "max_views": 1,
  "is_encrypted": true,
  "encryption_hint": "Team lead master passphrase",
  "custom_token": null
}
```

### 2. Inspect Secret Info (Non-destructive)
```http
GET /api/shares/:token/info
```

### 3. Retrieve & View Secret (Consumes View Count)
```http
GET /api/shares/:token
```

### 4. Revoke Secret (Creator)
```http
DELETE /api/shares/:token
x-creator-key: CRK-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🔒 Security Architecture

1. **Client-Side Cryptography**: When passphrase protection is enabled, plaintext is encrypted using Web Crypto API (`AES-GCM` with a 12-byte random IV and 16-byte random salt).
2. **Key Derivation**: Passphrase is stretched using `PBKDF2` with `SHA-256` and 100,000 iterations.
3. **Automatic Purging**: A background task automatically scrubs expired and burned records from SQLite.
4. **WAL Persistence**: Uses SQLite Write-Ahead Logging for high concurrent throughput and reliability.

---

## 📄 License
MIT License. Free for open source use.
