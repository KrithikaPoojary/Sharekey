# ShareKey 🔑

> A secure, zero-knowledge content and secret sharing platform with access tokens, client-side AES-256-GCM encryption, and self-destruct capabilities.

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

