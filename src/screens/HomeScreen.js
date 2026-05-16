import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Keyboard,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import NoteInput from '../components/NoteInput';
import NoteItem from '../components/NoteItem';
import SearchBar from '../components/SearchBar';
import COLORS from '../constants/colors';
import { loadNotesFromStorage, saveNotesToStorage, exportNotesFile } from '../utils/storage';

const { width, height } = Dimensions.get('window');

const PasswordModal = ({ visible, onUnlock, onReset, error, isSetup = false }) => {
  const [input, setInput] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.lockIconCircle}>
            <Ionicons name={isSetup ? "shield-checkmark" : "lock-closed"} size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.modalTitle}>{isSetup ? "Secure Your Vault" : "Vault Locked"}</Text>
          <Text style={styles.modalSubtitle}>
            {isSetup ? "Set a password for your private vault." : "Enter password to unlock vault."}
          </Text>
          <TextInput
            style={[styles.passwordInput, error && styles.inputError]}
            placeholder="Enter Password"
            secureTextEntry
            value={input}
            onChangeText={setInput}
            autoFocus
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity style={styles.unlockButton} onPress={() => { onUnlock(input); setInput(''); }}>
            <Text style={styles.unlockButtonText}>{isSetup ? "Enable Vault" : "Unlock Vault"}</Text>
          </TouchableOpacity>
          {!isSetup && (
            <TouchableOpacity style={styles.resetButton} onPress={onReset}>
              <Text style={styles.resetButtonText}>Forgot Password? Reset Vault</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default function HomeScreen() {
  const [regularNotes, setRegularNotes] = useState([]);
  const [vaultNotes, setVaultNotes] = useState([]);
  const [activeTab, setActiveTab] = useState('regular'); // 'regular' or 'vault'
  const [hasLoaded, setHasLoaded] = useState(false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [isVaultLocked, setIsVaultLocked] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  const [editingNote, setEditingNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isAnyDragging, setIsAnyDragging] = useState(false);
  const flatListRef = useRef(null);

  const expansionAnim = useRef(new Animated.Value(0)).current;
  const fabRotateAnim = useRef(new Animated.Value(0)).current;
  const selectionBarAnim = useRef(new Animated.Value(0)).current;
  const trashZoneAnim = useRef(new Animated.Value(0)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  // Initial load
  useEffect(() => {
    const initStorage = async () => {
      const result = await loadNotesFromStorage();
      setRegularNotes(result.regular);
      setVaultNotes(result.vault);
      if (result.vaultNeedsPassword) {
        setIsVaultLocked(true);
      }
      setHasLoaded(true);
    };
    initStorage();
  }, []);

  // Save whenever any note list or password change
  useEffect(() => {
    if (hasLoaded) {
      // CRITICAL: If the vault is locked, pass null for vaultNotes to PRESERVE the existing encrypted file content.
      // Do not pass an empty array [], as that would overwrite your real vault data.
      saveNotesToStorage(
        regularNotes, 
        isVaultLocked ? null : vaultNotes, 
        vaultPassword
      );
    }
  }, [regularNotes, vaultNotes, vaultPassword, hasLoaded, isVaultLocked]);

  // Handle Tab Switch Animation
  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: activeTab === 'regular' ? 0 : 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8
    }).start();

    // If switching to vault and it's locked, show modal
    if (activeTab === 'vault' && isVaultLocked) {
      setIsPasswordModalVisible(true);
    }
  }, [activeTab]);

  const handleUnlock = async (password) => {
    if (!password) {
      setPasswordError('Password required');
      return;
    }
    if (isVaultLocked) {
      const result = await loadNotesFromStorage(password);
      if (result.error) {
        setPasswordError('Incorrect password');
      } else {
        setVaultNotes(result.vault);
        setVaultPassword(password);
        setIsVaultLocked(false);
        setIsPasswordModalVisible(false);
        setPasswordError('');
      }
    } else {
      setVaultPassword(password);
      setIsPasswordModalVisible(false);
    }
  };

  const handleResetVault = () => {
    Alert.alert("Reset Vault?", "This will delete all notes inside your private vault. Regular notes will remain safe.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset Vault", style: "destructive", onPress: () => {
        setVaultNotes([]);
        setVaultPassword('');
        setIsVaultLocked(false);
        setIsPasswordModalVisible(false);
        setActiveTab('regular');
      }}
    ]);
  };

  const addNote = (title, content) => {
    const newNote = { id: Date.now().toString(), title, content, createdAt: new Date().toISOString() };
    if (activeTab === 'vault') {
      setVaultNotes([newNote, ...vaultNotes]);
    } else {
      setRegularNotes([newNote, ...regularNotes]);
    }
    setIsInputVisible(false);
  };

  const updateNote = (id, title, content) => {
    const updateFn = (list) => list.map(n => n.id === id ? { ...n, title, content } : n);
    if (activeTab === 'vault') setVaultNotes(updateFn(vaultNotes));
    else setRegularNotes(updateFn(regularNotes));
    setEditingNote(null);
    setIsInputVisible(false);
  };

  const deleteNote = (id) => {
    if (activeTab === 'vault') setVaultNotes(vaultNotes.filter(n => n.id !== id));
    else setRegularNotes(regularNotes.filter(n => n.id !== id));
  };

  const togglePin = (id) => {
    const toggleFn = (list) => list.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n);
    if (activeTab === 'vault') setVaultNotes(toggleFn(vaultNotes));
    else setRegularNotes(toggleFn(regularNotes));
  };

  const deleteSelectedNotes = () => {
    const confirmDelete = () => {
      if (activeTab === 'vault') setVaultNotes(vaultNotes.filter(n => !selectedIds.includes(n.id)));
      else setRegularNotes(regularNotes.filter(n => !selectedIds.includes(n.id)));
      setSelectedIds([]);
    };
    Alert.alert("Delete Selected", `Delete ${selectedIds.length} notes?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: confirmDelete }
    ]);
  };

  const currentNotes = activeTab === 'regular' ? regularNotes : vaultNotes;
  const filteredNotes = useMemo(() => {
    const filtered = currentNotes.filter(n => 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort: Pinned notes first, then by date (newest first)
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [currentNotes, searchQuery]);

  const handleAddButtonPress = () => {
    if (selectedIds.length > 0) { setSelectedIds([]); return; }
    if (isInputVisible) { setIsInputVisible(false); return; }
    if (activeTab === 'vault' && !vaultPassword) { setIsPasswordModalVisible(true); return; }
    setIsInputVisible(true);
  };

  const tabIndicatorX = tabIndicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, (width - 48) / 2]
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerWrapper}>
          <Header onExport={exportNotesFile} />
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          
          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <Animated.View style={[styles.tabIndicator, { transform: [{ translateX: tabIndicatorX }] }]} />
            <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('regular')}>
              <Ionicons name="list" size={18} color={activeTab === 'regular' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'regular' && styles.tabTextActive]}>Regular</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('vault')}>
              <Ionicons name={isVaultLocked ? "lock-closed" : "shield-checkmark"} size={18} color={activeTab === 'vault' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'vault' && styles.tabTextActive]}>Vault</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.listWrapper}>
          <FlatList
            data={filteredNotes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NoteItem
                note={item}
                onDelete={deleteNote}
                onTogglePin={() => togglePin(item.id)}
                onEdit={() => { setEditingNote(item); setIsInputVisible(true); }}
                isSelected={selectedIds.includes(item.id)}
                onSelect={(id) => selectedIds.includes(id) ? setSelectedIds(selectedIds.filter(i => i !== id)) : setSelectedIds([...selectedIds, id])}
                onLongPress={(id) => setSelectedIds([...selectedIds, id])}
                isSelectionMode={selectedIds.length > 0}
                onDragStart={() => setIsAnyDragging(true)}
                onDragEnd={() => setIsAnyDragging(false)}
              />
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name={activeTab === 'vault' ? "lock-closed-outline" : "document-text-outline"} size={60} color={COLORS.primary} />
                <Text style={styles.emptyTitle}>{activeTab === 'vault' ? "Vault is Empty" : "No regular notes"}</Text>
              </View>
            )}
            contentContainerStyle={styles.flatListContent}
            scrollEnabled={!isAnyDragging}
          />
        </View>
      </SafeAreaView>

      <Modal visible={isInputVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <NoteInput
            isVisible={isInputVisible}
            onCancel={() => { setIsInputVisible(false); setEditingNote(null); }}
            onSave={(title, content) => editingNote ? updateNote(editingNote.id, title, content) : addNote(title, content)}
            initialTitle={editingNote?.title || ''}
            initialContent={editingNote?.content || ''}
            isEditing={!!editingNote}
          />
        </View>
      </Modal>

      <PasswordModal visible={isPasswordModalVisible} onUnlock={handleUnlock} onReset={handleResetVault} error={passwordError} isSetup={!isVaultLocked && !vaultPassword} />

      <TouchableOpacity style={[styles.fab, isInputVisible && styles.fabActive, selectedIds.length > 0 && styles.fabSelection, isAnyDragging && styles.fabHidden]} onPress={handleAddButtonPress}>
        <Ionicons name={selectedIds.length > 0 || isInputVisible ? "close" : "add"} size={36} color={COLORS.white} />
      </TouchableOpacity>

      {/* Selection Bar */}
      {selectedIds.length > 0 && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionCount}>{selectedIds.length} selected</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity style={styles.selectionButton} onPress={() => setSelectedIds([])}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.selectionButton, styles.deleteSelectedButton]} onPress={deleteSelectedNotes}><Ionicons name="trash" size={18} color={COLORS.white} /><Text style={styles.deleteSelectedText}>Delete All</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Trash Zone */}
      {isAnyDragging && (
        <View style={styles.trashZone}>
          <View style={styles.trashIconCircle}><Ionicons name="trash" size={32} color={COLORS.secondary} /></View>
          <Text style={styles.trashText}>DRAG HERE TO DELETE</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  headerWrapper: { paddingHorizontal: 24, paddingTop: 20 },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    height: 48,
    marginTop: 20,
    marginBottom: 10,
    padding: 4,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: (width - 48 - 8) / 2,
    height: 40,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  tabButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  tabText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },
  listWrapper: { flex: 1 },
  flatListContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 120 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginTop: 16 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 100 },
  fabActive: { backgroundColor: COLORS.secondary },
  fabSelection: { backgroundColor: COLORS.textSecondary },
  fabHidden: { opacity: 0, transform: [{ scale: 0 }] },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', backgroundColor: COLORS.white, borderRadius: 32, padding: 30, alignItems: 'center', elevation: 25 },
  lockIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary + '10', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 10 },
  modalSubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  passwordInput: { width: '100%', height: 56, backgroundColor: COLORS.background, borderRadius: 16, paddingHorizontal: 20, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  inputError: { borderColor: COLORS.secondary, borderWidth: 2 },
  errorText: { color: COLORS.secondary, fontSize: 13, fontWeight: '600', marginBottom: 20 },
  unlockButton: { width: '100%', height: 56, backgroundColor: COLORS.primary, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  unlockButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  resetButton: { marginTop: 20 },
  resetButtonText: { color: COLORS.secondary, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  selectionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, paddingBottom: 40, paddingTop: 20, paddingHorizontal: 24, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20, zIndex: 200, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectionCount: { fontSize: 18, fontWeight: '800' },
  selectionActions: { flexDirection: 'row', gap: 12 },
  selectionButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14 },
  deleteSelectedButton: { backgroundColor: COLORS.secondary, flexDirection: 'row', gap: 8 },
  cancelText: { color: COLORS.textSecondary, fontWeight: '700' },
  deleteSelectedText: { color: COLORS.white, fontWeight: '700' },
  trashZone: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150, backgroundColor: COLORS.secondary + '15', borderTopLeftRadius: 40, borderTopRightRadius: 40, borderTopWidth: 2, borderColor: COLORS.secondary + '30', zIndex: 40, justifyContent: 'center', alignItems: 'center', gap: 12 },
  trashIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  trashText: { color: COLORS.secondary, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 }
});