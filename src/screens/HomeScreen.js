import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FloatingActionButton from '../components/FloatingActionButton';
import Header from '../components/Header';
import NoteEditorModal from '../components/NoteEditorModal';
import NotesList from '../components/NotesList';
import NotesTabs from '../components/NotesTabs';
import PasswordModal from '../components/PasswordModal';
import SearchBar from '../components/SearchBar';
import SelectionBar from '../components/SelectionBar';
import TrashZone from '../components/TrashZone';
import useFilteredNotes from '../hooks/use-filtered-notes';
import useNoteSelection from '../hooks/use-note-selection';
import useNotesManager from '../hooks/use-notes-manager';
import useNotesStorage from '../hooks/use-notes-storage';
import useVault from '../hooks/use-vault';
import { mergeUniqueNotes } from '../utils/note-hash';
import { HOME_SCREEN_WIDTH, styles } from './home-screen.styles';
import {
  exportNotesFile,
  importNotesFile,
  initializeExportDirectory,
} from '../utils/storage';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState('regular');
  const [editingNote, setEditingNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [isAnyDragging, setIsAnyDragging] = useState(false);

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  const {
    selectedIds,
    isSelectionMode,
    clearSelection,
    toggleSelection,
    selectOne,
    removeSelection,
    pruneSelection,
  } = useNoteSelection(activeTab);

  const {
    regularNotes,
    setRegularNotes,
    vaultNotes,
    setVaultNotes,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    deleteNotes,
  } = useNotesManager();

  const vault = useVault({
    setVaultNotes,
    setActiveTab,
  });

  const {
    vaultPassword,
    isVaultLocked,
    isPasswordModalVisible,
    passwordError,
    initializeVaultState,
    openPasswordModal,
    handleUnlock,
    handleResetVault,
  } = vault;

  const { vaultNeedsPassword } = useNotesStorage({
    regularNotes,
    vaultNotes,
    setRegularNotes,
    setVaultNotes,
    vaultPassword: vault.vaultPassword,
    isVaultLocked: vault.isVaultLocked,
  });

  const { filteredNotes } = useFilteredNotes({
    activeTab,
    regularNotes,
    vaultNotes,
    searchQuery,
  });

  const currentNotes = activeTab === 'regular' ? regularNotes : vaultNotes;

  useEffect(() => {
    initializeVaultState(vaultNeedsPassword);
  }, [initializeVaultState, vaultNeedsPassword]);

  useEffect(() => {
    initializeExportDirectory();
  }, []);

  useEffect(() => {
    pruneSelection(currentNotes.map((note) => note.id));
  }, [currentNotes, pruneSelection]);

  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: activeTab === 'regular' ? 0 : 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    if (activeTab === 'vault' && isVaultLocked) {
      openPasswordModal();
    }
  }, [activeTab, isVaultLocked, openPasswordModal, tabIndicatorAnim]);

  const closeEditor = () => {
    setIsInputVisible(false);
    setEditingNote(null);
  };

  const handleSaveNote = (title, content) => {
    if (editingNote) {
      updateNote(activeTab, editingNote.id, title, content);
    } else {
      addNote(activeTab, title, content);
    }

    closeEditor();
  };

  const handleDeleteSelectedNotes = () => {
    Alert.alert('Delete Selected', `Delete ${selectedIds.length} notes?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteNotes(activeTab, selectedIds);
          clearSelection();
        },
      },
    ]);
  };

  const handleImportNotes = async () => {
    const importedData = await importNotesFile();
    if (!importedData) {
      return;
    }

    const canImportVault = !!vaultPassword;

    const applyImport = () => {
      setRegularNotes((current) => mergeUniqueNotes(current, importedData.regular));
      if (canImportVault) {
        setVaultNotes((current) => mergeUniqueNotes(current, importedData.vault));
      }

      Alert.alert('Import Complete', 'Notes were imported successfully.');
    };

    const hasVaultNotes = importedData.vault.length > 0;
    const vaultMessage =
      hasVaultNotes && !canImportVault
        ? ' Vault notes in the file were skipped because the vault is locked.'
        : '';

    Alert.alert(
      'Import Notes',
      `Import notes from ${importedData.fileName}?${vaultMessage}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: applyImport,
        },
      ]
    );
  };

  const handleAddButtonPress = () => {
    if (selectedIds.length > 0) {
      clearSelection();
      return;
    }

    if (isInputVisible) {
      closeEditor();
      return;
    }

    if (activeTab === 'vault' && !vaultPassword) {
      openPasswordModal();
      return;
    }

    setIsInputVisible(true);
  };

  const tabIndicatorX = tabIndicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, HOME_SCREEN_WIDTH / 2 - 24],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerWrapper}>
          <Header onExport={exportNotesFile} onImport={handleImportNotes} />
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <NotesTabs
            activeTab={activeTab}
            isVaultLocked={isVaultLocked}
            tabIndicatorX={tabIndicatorX}
            onSelectRegular={() => setActiveTab('regular')}
            onSelectVault={() => setActiveTab('vault')}
          />
        </View>

        <NotesList
          activeTab={activeTab}
          notes={filteredNotes}
          selectedIds={selectedIds}
          isSelectionMode={isSelectionMode}
          isAnyDragging={isAnyDragging}
          onDelete={(id) => {
            deleteNote(activeTab, id);
            removeSelection(id);
          }}
          onTogglePin={(id) => togglePin(activeTab, id)}
          onEdit={(note) => {
            setEditingNote(note);
            setIsInputVisible(true);
          }}
          onToggleSelection={toggleSelection}
          onLongPress={selectOne}
          onDragStart={() => setIsAnyDragging(true)}
          onDragEnd={() => setIsAnyDragging(false)}
        />
      </SafeAreaView>

      <NoteEditorModal
        visible={isInputVisible}
        editingNote={editingNote}
        onCancel={closeEditor}
        onSave={handleSaveNote}
      />

      <PasswordModal
        visible={isPasswordModalVisible}
        onUnlock={handleUnlock}
        onReset={handleResetVault}
        error={passwordError}
        isSetup={!isVaultLocked && !vaultPassword}
      />

      <FloatingActionButton
        isInputVisible={isInputVisible}
        hasSelection={selectedIds.length > 0}
        isAnyDragging={isAnyDragging}
        onPress={handleAddButtonPress}
      />

      <SelectionBar
        count={selectedIds.length}
        onCancel={clearSelection}
        onDeleteSelected={handleDeleteSelectedNotes}
      />

      <TrashZone visible={isAnyDragging} />
    </View>
  );
}
