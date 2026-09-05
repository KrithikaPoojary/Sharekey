# ShareKey

> A secure, zero-knowledge content and secret sharing platform with access tokens, client-side AES-256-GCM encryption, rate limiting, and self-destruct capabilities.

---

## Key Features

- **Unique Access Tokens**: Human-friendly, cryptographically random keys (e.g. `SK-8F92-K4D2`) or custom vanity tokens.
- **Zero-Knowledge Encryption**: Client-side AES-256-GCM authenticated encryption with PBKDF2 (100,000 rounds) key derivation. Plaintext never leaves the browser.
- **Burn After Reading**: Configurable one-time self-destruct policy that permanently erases the secret from database storage immediately after the first view.
- **Screen Self-Destruct Protection**: Anti shoulder-surfing countdown timer that wipes the secret from screen memory after 60 seconds.
- **Passphrase Strength Meter & Generator**: Real-time entropy evaluator and 1-click cryptographically secure passphrase generator.
- **Syntax Highlighting**: Real-time syntax formatting for JSON, JavaScript, TypeScript, Python, SQL, Markdown, and .ENV files.
- **Granular Expiration**: Set automatic expiration for 5 minutes, 1 hour, 24 hours, 7 days, 30 days, or manual revocation.
- **Creator Vault & Revocation**: Local vault history allowing creators to track views and permanently revoke access tokens at any time using their private creator key.
- **Brute-Force Rate Limiting**: In-memory IP rate limiter and security headers to prevent token guessing and abuse.
- **Theme & Sound FX Controls**: Integrated Light/Dark theme switcher and procedural Web Audio feedback effects.
- **QR Code & Direct Links**: Instant QR code generator and one-click sharing via WhatsApp, Email, or clipboard.

---

## Getting Started

### Prerequisites
- Node.js (v18 or newer)
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

Open your browser and visit: `http://localhost:3000`

---

## REST API Documentation

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

## License
MIT License. Free for open source use.
