import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Pressable,
    PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../constants/colors';

export default function NoteItem({ 
  note, 
  onDelete, 
  onEdit, 
  onTogglePin,
  isEditing, 
  isSelected, 
  onSelect, 
  onLongPress,
  isSelectionMode,
  onDragStart,
  onDragEnd
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // ANIMATION STABILITY: Use JS driver for everything interacting with gestures
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const liftAnim = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const deleteOpacity = pan.y.interpolate({
    inputRange: [100, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  const panResponder = useRef(
    PanResponder.create({
      // We don't capture on start to allow Pressable clicks
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      
      // We capture on move with a TINY threshold to beat the FlatList scroll
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Only capture if moving DOWN. 
        // We use a very low threshold (3px) to ensure we win over FlatList scroll on Android.
        const isMovingDown = gestureState.dy > 3;
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 2;
        
        // If selection mode is on, we might want to allow dragging more easily
        return isMovingDown && isVertical && !isEditing;
      },
      
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dy > 3 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 2 && !isEditing;
      },

      onPanResponderGrant: () => {
        setIsDragging(true);
        onDragStart?.();
        pan.setOffset({ x: 0, y: 0 });
        pan.setValue({ x: 0, y: 0 });

        Animated.spring(scaleAnim, {
          toValue: 0.95,
          useNativeDriver: false,
          friction: 8,
        }).start();
      },
      onPanResponderMove: (evt, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (evt, gestureState) => {
        setIsDragging(false);
        onDragEnd?.();
        
        if (gestureState.dy > 200) {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start(() => onDelete(note.id));
        } else {
          pan.flattenOffset();
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 5,
            tension: 80,
          }).start();
          
          Animated.spring(scaleAnim, {
            toValue: isSelected ? 1.02 : 1,
            useNativeDriver: false,
            friction: 5,
            tension: 80,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        onDragEnd?.();
        pan.flattenOffset();
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        Animated.spring(scaleAnim, { toValue: isSelected ? 1.02 : 1, useNativeDriver: false }).start();
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!isDragging) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: isSelected ? 1.02 : 1, useNativeDriver: false, friction: 7 }),
        Animated.spring(liftAnim, { toValue: isSelected ? -6 : 0, useNativeDriver: false, friction: 7 })
      ]).start();
    }
  }, [isSelected, isDragging]);

  const handlePress = () => {
    if (isSelectionMode) {
      onSelect(note.id);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <View style={styles.itemWrapper}>
      <Animated.View 
        {...panResponder.panHandlers}
        style={[
          styles.card, 
          { 
            opacity: fadeAnim, 
            zIndex: (isSelected || isDragging) ? 9999 : 1,
            transform: [
              { translateY: Animated.add(Animated.add(slideAnim, liftAnim), pan.y) }, 
              { translateX: pan.x },
              { scale: scaleAnim }
            ] 
          },
          isEditing && styles.cardEditing,
          isSelected && styles.cardSelected,
          isDragging && styles.cardDragging
        ]}
      >
        <Pressable 
          onPress={handlePress} 
          onLongPress={() => onLongPress(note.id)}
          style={styles.pressableArea}
          delayLongPress={250}
        >
          <View style={styles.contentContainer}>
            {isSelectionMode && (
              <View style={styles.selectionIndicator}>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
                </View>
              </View>
            )}

            <View style={styles.textWrapper}>
              <Text style={[styles.titleText, isEditing && styles.accentText, isSelected && styles.selectedText]}>
                {note.title}
              </Text>
              <Text 
                style={[styles.contentText, isSelected && styles.selectedTextLight]} 
                numberOfLines={isExpanded ? undefined : 3}
              >
                {note.content}
              </Text>
              
              <View style={styles.footer}>
                <View style={styles.timeInfo}>
                  <Ionicons name="time-outline" size={14} color={isSelected ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.timeText, isSelected && styles.selectedTextLight]}>{isEditing ? 'Editing...' : 'Just now'}</Text>
                </View>
                
                {!isSelectionMode && !isDragging && note.content.length > 100 && (
                  <View style={styles.expandIndicator}>
                    <Text style={styles.expandText}>
                      {isExpanded ? 'Show less' : 'Show more'}
                    </Text>
                    <Ionicons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={14} 
                      color={COLORS.primary} 
                    />
                  </View>
                )}
              </View>
            </View>

            {!isSelectionMode && !isDragging && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.pinButton, note.isPinned && styles.pinButtonActive]}
                  onPress={onTogglePin}
                  activeOpacity={0.6}
                >
                  <Ionicons 
                    name={note.isPinned ? "pin" : "pin-outline"} 
                    size={18} 
                    color={note.isPinned ? COLORS.white : COLORS.primary} 
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={onEdit}
                  activeOpacity={0.6}
                >
                  <Ionicons 
                    name={isEditing ? "create" : "create-outline"} 
                    size={18} 
                    color={isEditing ? COLORS.accent : COLORS.primary} 
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => onDelete(note.id)}
                  activeOpacity={0.6}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.secondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Dynamic Delete Overlay */}
          <Animated.View 
            pointerEvents="none"
            style={[styles.deleteOverlay, { opacity: deleteOpacity }]}
          >
             <View style={styles.deleteBadge}>
                <Ionicons name="trash" size={32} color={COLORS.white} />
                <Text style={styles.deleteLabel}>DELETE</Text>
             </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  itemWrapper: {
    marginBottom: 16,
    zIndex: 1,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pressableArea: {
    padding: 20,
  },
  cardEditing: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '05',
    borderWidth: 2,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  cardDragging: {
    borderColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 20,
  },
  selectionIndicator: {
    marginRight: 15,
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textWrapper: {
    flex: 1,
    paddingRight: 12,
  },
  titleText: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  contentText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 12,
  },
  accentText: {
    color: COLORS.accent,
  },
  selectedText: {
    color: COLORS.primary,
  },
  selectedTextLight: {
    color: COLORS.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
    fontWeight: '600',
  },
  expandIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'column',
    gap: 8,
    justifyContent: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinButton: {
    backgroundColor: COLORS.primary + '10',
  },
  pinButtonActive: {
    backgroundColor: COLORS.primary,
  },
  editButton: {
    backgroundColor: COLORS.primary + '10',
  },
  deleteButton: {
    backgroundColor: COLORS.secondary + '10',
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244, 63, 94, 0.95)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  deleteBadge: {
    alignItems: 'center',
    gap: 12,
  },
  deleteLabel: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
  }
});