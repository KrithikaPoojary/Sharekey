# ShareKey

A secure content-sharing platform that allows users to share text, code snippets, and credentials through unique access tokens. The sender uploads or enters content, ShareKey generates an access token, and anyone with the valid token can retrieve the shared content.

---

## Technologies Used

- **Node.js**: Backend JavaScript runtime environment
- **Express.js**: RESTful web server and static asset delivery
- **SQLite (`better-sqlite3`)**: High-performance database storage with Write-Ahead Logging (WAL)
- **Web Crypto API**: Client-side AES-256-GCM encryption with PBKDF2 key derivation (100,000 rounds)
- **Web Audio API**: Procedural sound generation for UI feedback
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, and responsive CSS3 design system with light and dark mode support

---

## Prerequisites

- Node.js (v18 or newer)
- npm

---

## Installation & How to Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/KrithikaPoojary/Sharekey.git
   ```

2. **Navigate to the project directory:**
   ```bash
   cd Sharekey
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open in your browser:**
   ```text
   http://localhost:3000
   ```
