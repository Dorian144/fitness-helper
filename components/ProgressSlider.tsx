import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Colors from "@/constants/colors";
import { Minus, Plus, GlassWater } from "lucide-react-native";

interface ProgressSliderProps {
  title: string;
  value: number;
  max: number;
  unit?: string;
  color?: string;
  type?: 'default' | 'water';
  onIncrement?: () => void;
  onDecrement?: () => void;
}

const ProgressSlider: React.FC<ProgressSliderProps> = ({
  title,
  value,
  max,
  unit = "",
  color = Colors.primary,
  type = 'default',
  onIncrement,
  onDecrement,
}) => {
  // Don't let the progress bar go over 100%, but still show the real value
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <View style={styles.container}>
      {/* Title and current value display */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[
          styles.value,
          value > max ? styles.valueBeyondMax : null
        ]}>
          {value}{unit} / {max}{unit}
        </Text>
      </View>
      
      {/* The progress bar itself */}
      <View style={styles.progressContainer}>
        <View 
          style={[
            styles.progressBar, 
            { width: `${percentage}%`, backgroundColor: color }
          ]} 
        />
      </View>
      
      {/* Extra controls for water tracking mode */}
      {type === 'water' && (
        <>
          <Text style={styles.waterNote}>1 glass = 0.25L (8 glasses = 2L)</Text>
          <View style={styles.controlsContainer}>
            {/* Minus button to remove a glass */}
            <TouchableOpacity 
              style={[styles.controlButton, styles.decrementButton]} 
              onPress={onDecrement}
            >
              <Minus size={16} color="#fff" />
            </TouchableOpacity>
            
            {/* Water glass icon */}
            <View style={styles.waterIconContainer}>
              <GlassWater size={20} color={color} />
            </View>
            
            {/* Plus button to add a glass */}
            <TouchableOpacity 
              style={[styles.controlButton, styles.incrementButton]} 
              onPress={onIncrement}
            >
              <Plus size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Main container
  container: {
    marginBottom: 16,
  },
  
  // Title and value row
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  
  // Style for the label on the left
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.text,
  },
  
  // Regular value text style (0/100)
  value: {
    fontSize: 14,
    color: Colors.lightText,
  },
  
  // Special green color when exceeding the goal
  valueBeyondMax: {
    color: Colors.success,
    fontWeight: "500",
  },
  
  // The gray background track of the progress bar
  progressContainer: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  
  // The colored part that represents progress
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  
  // Explainer text for water tracking
  waterNote: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
    textAlign: 'right',
  },
  
  // Container for the +/- buttons
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  
  // Base style for the +/- buttons
  controlButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Red minus button
  decrementButton: {
    backgroundColor: Colors.error,
  },
  
  // Green plus button
  incrementButton: {
    backgroundColor: Colors.success,
  },
  
  // Container for the water glass icon
  waterIconContainer: {
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ProgressSlider;