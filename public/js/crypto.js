/**
 * ShareKey Client-Side Cryptographic Engine
 * Utilizes standard Web Crypto API (AES-GCM 256-bit with PBKDF2 SHA-256)
 * Zero-knowledge encryption: data is encrypted in the browser before transmission.
 */

const ShareCrypto = {
  // Convert ArrayBuffer to Base64
  bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  // Convert Base64 to ArrayBuffer
  base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  // Derive AES-GCM CryptoKey from string passphrase and salt
  async deriveKey(passphrase, saltBuffer) {
    const enc = new TextEncoder();
    const passphraseKey = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passphraseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /**
   * Encrypt text or payload with a passphrase
   * Returns formatted string: "SKENC:v1:<base64-payload>"
   */
  async encrypt(plaintext, passphrase) {
    if (!passphrase || passphrase.trim() === '') {
      throw new Error('Passphrase cannot be empty.');
    }

    const enc = new TextEncoder();
    const encodedData = enc.encode(plaintext);

    // Generate random 16-byte salt and 12-byte IV for AES-GCM
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const key = await this.deriveKey(passphrase, salt);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedData
    );

    const payloadObj = {
      v: 1,
      salt: this.bufferToBase64(salt),
      iv: this.bufferToBase64(iv),
      ct: this.bufferToBase64(ciphertextBuffer)
    };

    return 'SKENC:v1:' + btoa(JSON.stringify(payloadObj));
  },

  /**
   * Decrypt ciphertext payload with passphrase
   */
  async decrypt(encryptedString, passphrase) {
    if (!encryptedString.startsWith('SKENC:v1:')) {
      // If it's not encrypted with standard envelope, return as is
      return encryptedString;
    }

    try {
      const rawJson = atob(encryptedString.replace('SKENC:v1:', ''));
      const payload = JSON.parse(rawJson);

      const salt = this.base64ToBuffer(payload.salt);
      const iv = this.base64ToBuffer(payload.iv);
      const ciphertext = this.base64ToBuffer(payload.ct);

      const key = await this.deriveKey(passphrase, salt);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(iv)
        },
        key,
        ciphertext
      );

      const dec = new TextDecoder();
      return dec.decode(decryptedBuffer);
    } catch (err) {
      throw new Error('Incorrect passphrase or corrupted encrypted payload.');
    }
  },

  /**
   * Check if a string has the encrypted signature
   */
  isEncrypted(str) {
    return typeof str === 'string' && str.startsWith('SKENC:v1:');
  },

  /**
   * Generate SHA-256 hex string for verifying passphrase match
   */
  async hashString(str) {
    const enc = new TextEncoder();
    const buffer = await window.crypto.subtle.digest('SHA-256', enc.encode(str));
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
};

window.ShareCrypto = ShareCrypto;
