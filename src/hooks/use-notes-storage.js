import { useEffect, useState } from 'react';

import { normalizeNotes } from '../utils/note-hash';
import { loadNotesFromStorage, saveNotesToStorage } from '../utils/storage';

export default function useNotesStorage({
  regularNotes,
  vaultNotes,
  setRegularNotes,
  setVaultNotes,
  vaultPassword,
  isVaultLocked,
}) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [vaultNeedsPassword, setVaultNeedsPassword] = useState(false);

  useEffect(() => {
    const initStorage = async () => {
      const result = await loadNotesFromStorage();
      setRegularNotes(normalizeNotes(result.regular));
      setVaultNotes(normalizeNotes(result.vault));
      setVaultNeedsPassword(!!result.vaultNeedsPassword);
      setHasLoaded(true);
    };

    initStorage();
  }, [setRegularNotes, setVaultNotes]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    // On cold start, encrypted vaults load as an empty array until the lock state is restored.
    // Saving during that window would overwrite the real vault contents on disk.
    if (vaultNeedsPassword && !isVaultLocked && !vaultPassword) {
      return;
    }

    saveNotesToStorage(
      regularNotes,
      isVaultLocked ? null : vaultNotes,
      vaultPassword
    );
  }, [
    regularNotes,
    vaultNotes,
    vaultPassword,
    hasLoaded,
    isVaultLocked,
    vaultNeedsPassword,
  ]);

  return { hasLoaded, vaultNeedsPassword };
}
