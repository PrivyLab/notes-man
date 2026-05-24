import CryptoJS from 'crypto-js';

const normalizeValue = (value) =>
  typeof value === 'string' ? value.trim() : '';

export const buildNoteHash = ({ title = '', content = '', createdAt = '' }) =>
  CryptoJS.SHA256(
    [normalizeValue(title), normalizeValue(content), normalizeValue(createdAt)].join('\n')
  ).toString();

export const ensureNoteHash = (note) => ({
  ...note,
  noteHash: note.noteHash || buildNoteHash(note),
});

export const normalizeNotes = (notes) => notes.map(ensureNoteHash);

export const mergeUniqueNotes = (currentNotes, importedNotes) => {
  const normalizedCurrent = normalizeNotes(currentNotes);
  const normalizedImported = normalizeNotes(importedNotes);
  const existingHashes = new Set(normalizedCurrent.map((note) => note.noteHash));
  const uniqueImported = [];

  normalizedImported.forEach((note) => {
    if (existingHashes.has(note.noteHash)) {
      return;
    }

    existingHashes.add(note.noteHash);
    uniqueImported.push(note);
  });

  return [...uniqueImported, ...normalizedCurrent];
};
