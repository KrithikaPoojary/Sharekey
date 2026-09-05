/**
 * ShareKey Passphrase Evaluator & Generator
 */

const SharePassphrase = {
  // Generate random secure 16-character passphrase
  generate(length = 16) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    let out = '';
    for (let i = 0; i < length; i++) {
      out += chars[array[i] % chars.length];
    }
    return out;
  },

  // Evaluate password strength: returns { score: 0-4, label, color }
  evaluate(password) {
    if (!password) {
      return { score: 0, label: 'Empty', color: '#6b7280', width: '0%' };
    }

    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 14) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 0:
      case 1:
        return { score: 1, label: 'Weak', color: '#ef4444', width: '25%' };
      case 2:
        return { score: 2, label: 'Moderate', color: '#f59e0b', width: '50%' };
      case 3:
        return { score: 3, label: 'Strong', color: '#10b981', width: '75%' };
      case 4:
      default:
        return { score: 4, label: 'Military-Grade', color: '#38bdf8', width: '100%' };
    }
  }
};

window.SharePassphrase = SharePassphrase;
