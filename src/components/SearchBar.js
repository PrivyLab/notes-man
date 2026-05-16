import React, { useState } from 'react';
import {
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../constants/colors';

export default function SearchBar({ value, onChange, onFocus, onBlur }) {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    if (onFocus) onFocus();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onBlur) onBlur();
  };

  return (
    <View style={styles.container}>
      <View style={[
        styles.searchWrapper,
        isFocused && styles.searchWrapperFocused
      ]}>
        <Ionicons 
          name="search" 
          size={20} 
          color={isFocused ? COLORS.primary : COLORS.textSecondary} 
          style={styles.icon} 
        />
        <TextInput
          style={styles.input}
          placeholder="Search your notes..."
          placeholderTextColor={COLORS.textPlaceholder}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {value.length > 0 && (
          <Ionicons 
            name="close-circle" 
            size={20} 
            color={COLORS.textPlaceholder} 
            onPress={() => onChange('')} 
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchWrapperFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    shadowOpacity: 0.1,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
});
