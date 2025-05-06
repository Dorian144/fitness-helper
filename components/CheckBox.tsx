import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Check } from "lucide-react-native";
import Colors from "@/constants/colors";

interface CheckBoxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const CheckBox: React.FC<CheckBoxProps> = ({
  label,
  checked,
  onToggle,
  disabled = false
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {/* The actual checkbox square that shows the check mark when selected */}
      <View style={[
        styles.checkbox,
        checked && styles.checked,
        disabled && styles.disabled
      ]}>
        {checked && <Check size={16} color="#fff" />}
      </View>
      
      {/* The label text next to the checkbox */}
      <Text style={[
        styles.label,
        disabled && styles.disabledText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Wrapper for the whole checkbox + label combo
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  
  // The square box that gets checked
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  
  // Style when the checkbox is selected
  checked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  
  // Grayed out look for disabled state
  disabled: {
    backgroundColor: Colors.disabled,
    borderColor: Colors.disabled,
  },
  
  // Text style for the label
  label: {
    fontSize: 16,
    color: Colors.text,
  },
  
  // Lighter text for disabled state
  disabledText: {
    color: Colors.lightText,
  },
});