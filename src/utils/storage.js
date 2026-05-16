import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import CryptoJS from 'crypto-js';

const NOTES_FILE = `${FileSystem.documentDirectory}notes.json`;

/**
 * Encrypts a string using a password.
 */
const encrypt = (data, password) => {
  return CryptoJS.AES.encrypt(data, password).toString();
};

/**
 * Decrypts a string using a password.
 */
const decrypt = (ciphertext, password) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, password);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) return null;
    return originalText;
  } catch (e) {
    return null;
  }
};

/**
 * Shares the notes JSON file.
 */
export const exportNotesFile = async () => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(NOTES_FILE);
    if (!fileInfo.exists) {
      alert('No notes file found to export.');
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      alert("Sharing is not available");
      return;
    }
    await Sharing.shareAsync(NOTES_FILE);
  } catch (error) {
    console.error('Error sharing notes file:', error);
  }
};

/**
 * Saves both regular and vault notes.
 * If vaultNotes is null, the existing vault data in the file is preserved.
 */
export const saveNotesToStorage = async (regularNotes, vaultNotes, password = null) => {
  try {
    let finalVaultSection = { encrypted: false, data: '[]' };

    // 1. If vaultNotes is provided (unlocked), we encrypt it
    if (vaultNotes !== null) {
      let vaultData = JSON.stringify(vaultNotes);
      let isVaultEncrypted = false;

      if (password && vaultNotes.length > 0) {
        vaultData = encrypt(vaultData, password);
        isVaultEncrypted = true;
      }
      finalVaultSection = {
        encrypted: isVaultEncrypted,
        data: vaultData
      };
    } else {
      // 2. If vaultNotes is null (locked), we must preserve the existing vault section
      const fileInfo = await FileSystem.getInfoAsync(NOTES_FILE);
      if (fileInfo.exists) {
        const jsonString = await FileSystem.readAsStringAsync(NOTES_FILE);
        const existingData = JSON.parse(jsonString);
        if (existingData.vault) {
          finalVaultSection = existingData.vault;
        }
      }
    }

    const payload = JSON.stringify({
      version: 2,
      regular: regularNotes,
      vault: finalVaultSection
    });

    await FileSystem.writeAsStringAsync(NOTES_FILE, payload);
  } catch (error) {
    console.error('Error saving notes:', error);
  }
};

/**
 * Loads both regular and vault notes.
 */
export const loadNotesFromStorage = async (password = null) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(NOTES_FILE);
    if (!fileInfo.exists) {
      return { regular: [], vault: [], vaultNeedsPassword: false };
    }

    const jsonString = await FileSystem.readAsStringAsync(NOTES_FILE);
    const data = JSON.parse(jsonString);

    // Compatibility check for old formats
    if (Array.isArray(data)) {
      return { regular: data, vault: [], vaultNeedsPassword: false };
    }

    if (data.version === undefined && data.encrypted !== undefined) {
      // Single encrypted vault format
      if (data.encrypted) {
        if (!password) return { regular: [], vault: [], vaultNeedsPassword: true };
        const decrypted = decrypt(data.data, password);
        return decrypted ? { regular: [], vault: JSON.parse(decrypted), vaultNeedsPassword: false } : { regular: [], vault: [], vaultNeedsPassword: true, error: true };
      }
      return { regular: JSON.parse(data.data), vault: [], vaultNeedsPassword: false };
    }

    // Version 2 format
    const regular = data.regular || [];
    const vaultEnvelope = data.vault || { encrypted: false, data: '[]' };

    if (vaultEnvelope.encrypted) {
      if (!password) {
        return { regular, vault: [], vaultNeedsPassword: true };
      }
      const decrypted = decrypt(vaultEnvelope.data, password);
      if (decrypted === null) {
        return { regular, vault: [], vaultNeedsPassword: true, error: 'Invalid password' };
      }
      return { regular, vault: JSON.parse(decrypted), vaultNeedsPassword: false };
    }

    return { 
      regular, 
      vault: typeof vaultEnvelope.data === 'string' ? JSON.parse(vaultEnvelope.data) : vaultEnvelope.data, 
      vaultNeedsPassword: false 
    };

  } catch (error) {
    console.error('Error loading notes:', error);
    return { regular: [], vault: [], vaultNeedsPassword: false };
  }
};
