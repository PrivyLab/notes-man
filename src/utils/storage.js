import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

import { ensureNoteHash, normalizeNotes } from './note-hash';

const NOTES_FILE = `${FileSystem.documentDirectory}notes.json`;
const EXPORT_FILE = `${FileSystem.documentDirectory}notes-export.xlsx`;
const EXPORT_CONFIG_FILE = `${FileSystem.documentDirectory}export-config.json`;
const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ANDROID_DOWNLOADS_DIR_NAME = 'Download';
const ANDROID_DOCUMENTS_DIR_NAME = 'Documents';
const NOTES_EXPORT_DIR_NAME = 'Notes';

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
 * Converts notes to a worksheet-friendly shape.
 */
const serializeNotesForExport = (notes) =>
  notes.map((note) => ({
    Title: note.title || '',
    Content: note.content || '',
    Pinned: note.isPinned ? 'Yes' : 'No',
    CreatedAt: note.createdAt || '',
    NoteHash: note.noteHash || '',
  }));

const normalizeImportedNote = (row, index) => {
  const title = typeof row.Title === 'string' ? row.Title.trim() : '';
  const content = typeof row.Content === 'string' ? row.Content.trim() : '';

  if (!title && !content) {
    return null;
  }

  return ensureNoteHash({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    content,
    isPinned:
      String(row.Pinned || '')
        .trim()
        .toLowerCase() === 'yes',
    createdAt:
      typeof row.CreatedAt === 'string' && row.CreatedAt.trim()
        ? row.CreatedAt.trim()
        : new Date().toISOString(),
    noteHash: typeof row.NoteHash === 'string' ? row.NoteHash.trim() : '',
  });
};

const parseImportedSheet = (workbook, sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return [];
  }

  return XLSX.utils
    .sheet_to_json(sheet, { defval: '' })
    .map(normalizeImportedNote)
    .filter(Boolean);
};

const buildTimestamp = () =>
  new Date()
    .toISOString()
    .replace('T', '_')
    .replace(/\..+$/, '')
    .replace(/:/g, '-');

const readSavedExportDirectoryUri = async () => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(EXPORT_CONFIG_FILE);
    if (!fileInfo.exists) {
      return null;
    }

    const config = JSON.parse(await FileSystem.readAsStringAsync(EXPORT_CONFIG_FILE));
    return config.exportDirectoryUri || null;
  } catch (error) {
    return null;
  }
};

const saveExportDirectoryUri = async (exportDirectoryUri) => {
  await FileSystem.writeAsStringAsync(
    EXPORT_CONFIG_FILE,
    JSON.stringify({ exportDirectoryUri })
  );
};

const clearSavedExportDirectoryUri = async () => {
  await FileSystem.writeAsStringAsync(
    EXPORT_CONFIG_FILE,
    JSON.stringify({ exportDirectoryUri: null })
  );
};

const ensureNotesDirectoryAsync = async (parentUri) => {
  const directoryEntries = await FileSystem.StorageAccessFramework.readDirectoryAsync(parentUri);
  const existingNotesDirectory = directoryEntries.find((entry) => {
    const decodedEntry = decodeURIComponent(entry);
    return (
      decodedEntry.endsWith(`/${NOTES_EXPORT_DIR_NAME}`) ||
      decodedEntry.endsWith(`%2F${NOTES_EXPORT_DIR_NAME}`)
    );
  });

  if (existingNotesDirectory) {
    return existingNotesDirectory;
  }

  return FileSystem.StorageAccessFramework.makeDirectoryAsync(parentUri, NOTES_EXPORT_DIR_NAME);
};

const isPreferredAndroidExportUri = (directoryUri) => {
  const decodedUri = decodeURIComponent(directoryUri);
  return (
    decodedUri.includes(ANDROID_DOWNLOADS_DIR_NAME) ||
    decodedUri.includes(ANDROID_DOCUMENTS_DIR_NAME)
  );
};

const isNotesDirectoryUri = (directoryUri) => {
  const decodedUri = decodeURIComponent(directoryUri);
  return (
    decodedUri.endsWith(`/${NOTES_EXPORT_DIR_NAME}`) ||
    decodedUri.endsWith(`:${NOTES_EXPORT_DIR_NAME}`) ||
    decodedUri.endsWith(`%2F${NOTES_EXPORT_DIR_NAME}`)
  );
};

const validateExportDirectoryUriAsync = async (directoryUri) => {
  if (!directoryUri) {
    return null;
  }

  try {
    await FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri);
    return directoryUri;
  } catch (error) {
    await clearSavedExportDirectoryUri();
    return null;
  }
};

const requestNotesExportDirectoryAsync = async () => {
  alert(
    'Choose the Downloads or Documents folder. The app will create and use a Notes folder inside it.'
  );

  const permissions =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
      FileSystem.StorageAccessFramework.getUriForDirectoryInRoot(
        ANDROID_DOWNLOADS_DIR_NAME
      )
    );

  if (!permissions.granted) {
    return null;
  }

  const selectedUri = permissions.directoryUri;
  if (!isPreferredAndroidExportUri(selectedUri) && !isNotesDirectoryUri(selectedUri)) {
    alert('Please choose the Downloads or Documents folder.');
    return null;
  }

  const notesDirectoryUri = isNotesDirectoryUri(selectedUri)
    ? selectedUri
    : await ensureNotesDirectoryAsync(selectedUri);

  await saveExportDirectoryUri(notesDirectoryUri);
  return notesDirectoryUri;
};

export const initializeExportDirectory = async () => {
  if (Platform.OS !== 'android') {
    return null;
  }

  const savedDirectoryUri = await validateExportDirectoryUriAsync(
    await readSavedExportDirectoryUri()
  );

  if (savedDirectoryUri) {
    return savedDirectoryUri;
  }

  return requestNotesExportDirectoryAsync();
};

export const importNotesFile = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      XLSX_MIME_TYPE,
      'application/vnd.ms-excel',
      'application/octet-stream',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const [asset] = result.assets;
  const fileBase64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const workbook = XLSX.read(fileBase64, { type: 'base64' });

  return {
    regular: parseImportedSheet(workbook, 'Regular Notes'),
    vault: parseImportedSheet(workbook, 'Vault Notes'),
    fileName: asset.name,
  };
};

/**
 * Builds and shares an XLSX export of the current note store.
 */
export const exportNotesFile = async () => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(NOTES_FILE);
    if (!fileInfo.exists) {
      alert('No notes found to export.');
      return;
    }

    const data = await loadNotesFromStorage();
    const workbook = XLSX.utils.book_new();

    const regularSheet = XLSX.utils.json_to_sheet(
      serializeNotesForExport(data.regular)
    );
    const vaultSheet = XLSX.utils.json_to_sheet(
      serializeNotesForExport(data.vault)
    );

    XLSX.utils.book_append_sheet(workbook, regularSheet, 'Regular Notes');
    XLSX.utils.book_append_sheet(workbook, vaultSheet, 'Vault Notes');

    const workbookBase64 = XLSX.write(workbook, {
      type: 'base64',
      bookType: 'xlsx',
    });

    if (Platform.OS === 'android') {
      let notesDirectoryUri = await validateExportDirectoryUriAsync(
        await readSavedExportDirectoryUri()
      );
      if (!notesDirectoryUri) {
        notesDirectoryUri = await requestNotesExportDirectoryAsync();
      }

      if (!notesDirectoryUri) {
        return;
      }

      const timestamp = buildTimestamp();
      const outputFile = await FileSystem.StorageAccessFramework.createFileAsync(
        notesDirectoryUri,
        `notes-export-${timestamp}.xlsx`,
        XLSX_MIME_TYPE
      );

      await FileSystem.writeAsStringAsync(outputFile, workbookBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      alert(`Notes exported to ${NOTES_EXPORT_DIR_NAME} folder.`);
      return;
    }

    await FileSystem.writeAsStringAsync(EXPORT_FILE, workbookBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!(await Sharing.isAvailableAsync())) {
      alert('Sharing is not available');
      return;
    }

    const shareOptions =
      Platform.OS === 'ios'
        ? {
            dialogTitle: 'Export notes',
            UTI: 'org.openxmlformats.spreadsheetml.sheet',
          }
        : {
            dialogTitle: 'Export notes',
          };

    await Sharing.shareAsync(EXPORT_FILE, shareOptions);
  } catch (error) {
    console.error('Error exporting notes file:', error);
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
      return { regular: normalizeNotes(data), vault: [], vaultNeedsPassword: false };
    }

    if (data.version === undefined && data.encrypted !== undefined) {
      // Single encrypted vault format
      if (data.encrypted) {
        if (!password) return { regular: [], vault: [], vaultNeedsPassword: true };
        const decrypted = decrypt(data.data, password);
        return decrypted
          ? {
              regular: [],
              vault: normalizeNotes(JSON.parse(decrypted)),
              vaultNeedsPassword: false,
            }
          : { regular: [], vault: [], vaultNeedsPassword: true, error: true };
      }
      return {
        regular: normalizeNotes(JSON.parse(data.data)),
        vault: [],
        vaultNeedsPassword: false,
      };
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
      return {
        regular: normalizeNotes(regular),
        vault: normalizeNotes(JSON.parse(decrypted)),
        vaultNeedsPassword: false,
      };
    }

    return { 
      regular: normalizeNotes(regular), 
      vault: normalizeNotes(
        typeof vaultEnvelope.data === 'string' ? JSON.parse(vaultEnvelope.data) : vaultEnvelope.data
      ), 
      vaultNeedsPassword: false 
    };

  } catch (error) {
    console.error('Error loading notes:', error);
    return { regular: [], vault: [], vaultNeedsPassword: false };
  }
};
