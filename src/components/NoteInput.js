import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../constants/colors';

export default function NoteInput({ 
  onSave, 
  initialTitle = '', 
  initialContent = '', 
  isEditing = false, 
  onCancel,
  isVisible = false 
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const titleInputRef = useRef(null);

  // Sync internal state with prop when editing changes
  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
  }, [initialTitle, initialContent]);

  // Handle auto-focus when visible
  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure the animation has started and the keyboard can pop up correctly
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const handlePress = () => {
    if (!title.trim() || !content.trim()) return;
    onSave(title, content);
    setTitle('');
    setContent('');
  };

  return (
    <View style={styles.outerContainer}>
      <View style={[styles.card, isEditing && styles.cardEditing]}>
        <View style={styles.header}>
          <Ionicons 
            name={isEditing ? "create" : "pencil"} 
            size={20} 
            color={isEditing ? COLORS.accent : COLORS.primary} 
          />
          <Text style={[styles.headerText, isEditing && styles.headerTextEditing]}>
            {isEditing ? 'Edit Note' : 'New Note'}
          </Text>
          {isEditing && (
            <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
              <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TextInput
          ref={titleInputRef}
          style={styles.titleInput}
          placeholder="Note Title"
          placeholderTextColor={COLORS.textPlaceholder}
          value={title}
          onChangeText={setTitle}
        />
        
        <View style={styles.divider} />

        <TextInput
          style={styles.contentInput}
          placeholder="Write your description here..."
          placeholderTextColor={COLORS.textPlaceholder}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[
            styles.saveButton, 
            (!title.trim() || !content.trim()) && styles.buttonDisabled,
            isEditing && styles.buttonEditing
          ]}
          onPress={handlePress}
          activeOpacity={0.8}
          disabled={!title.trim() || !content.trim()}
        >
          <Text style={styles.saveButtonText}>
            {isEditing ? 'Update Note' : 'Add Note'}
          </Text>
          <Ionicons 
            name={isEditing ? "checkmark-circle" : "add-circle"} 
            size={20} 
            color={COLORS.white} 
            style={styles.buttonIcon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginBottom: 25,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardEditing: {
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  headerTextEditing: {
    color: COLORS.accent,
  },
  cancelButton: {
    marginLeft: 'auto',
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  contentInput: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
    minHeight: 80,
    paddingVertical: 10,
    lineHeight: 22,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  buttonEditing: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
  },
  buttonDisabled: {
    backgroundColor: COLORS.textPlaceholder,
    shadowOpacity: 0,
    elevation: 0,
  },
});