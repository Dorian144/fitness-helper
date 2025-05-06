import React from "react";
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  ViewStyle,
  TextStyle
} from "react-native";
import Colors from "@/constants/colors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "text";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false
}) => {
  const getButtonStyle = () => {
    let buttonStyle: ViewStyle = {};
    
    // Pick the right style based on which button type we want
    switch (variant) {
      case "primary":
        buttonStyle = styles.primaryButton;
        break;
      case "secondary":
        buttonStyle = styles.secondaryButton;
        break;
      case "outline":
        buttonStyle = styles.outlineButton;
        break;
      case "text":
        buttonStyle = styles.textButton;
        break;
    }
    
    // Set the size - small, medium or large
    switch (size) {
      case "small":
        buttonStyle = { ...buttonStyle, ...styles.smallButton };
        break;
      case "medium":
        buttonStyle = { ...buttonStyle, ...styles.mediumButton };
        break;
      case "large":
        buttonStyle = { ...buttonStyle, ...styles.largeButton };
        break;
    }
    
    // Make the button take up all available width if needed
    if (fullWidth) {
      buttonStyle = { ...buttonStyle, ...styles.fullWidth };
    }
    
    // Gray out the button if it's disabled
    if (disabled) {
      buttonStyle = { ...buttonStyle, ...styles.disabledButton };
    }
    
    return buttonStyle;
  };
  
  const getTextStyle = () => {
    let textStyleObj: TextStyle = {};
    
    // Text color changes based on button type
    switch (variant) {
      case "primary":
        textStyleObj = styles.primaryText;
        break;
      case "secondary":
        textStyleObj = styles.secondaryText;
        break;
      case "outline":
        textStyleObj = styles.outlineText;
        break;
      case "text":
        textStyleObj = styles.textButtonText;
        break;
    }
    
    // Text size matches button size
    switch (size) {
      case "small":
        textStyleObj = { ...textStyleObj, ...styles.smallText };
        break;
      case "medium":
        textStyleObj = { ...textStyleObj, ...styles.mediumText };
        break;
      case "large":
        textStyleObj = { ...textStyleObj, ...styles.largeText };
        break;
    }
    
    // Change text color for disabled state
    if (disabled) {
      textStyleObj = { ...textStyleObj, ...styles.disabledText };
    }
    
    return textStyleObj;
  };
  
  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === "primary" ? "#fff" : Colors.primary} 
          size="small" 
        />
      ) : (
        <Text style={[getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Different button types
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  textButton: {
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  
  // Button sizes
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  mediumButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  largeButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  
  // Text colors
  primaryText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryText: {
    color: "#fff",
    fontWeight: "600",
  },
  outlineText: {
    color: Colors.primary,
    fontWeight: "600",
  },
  textButtonText: {
    color: Colors.primary,
    fontWeight: "600",
  },
  
  // Text sizes
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  
  // Button states
  disabledButton: {
    backgroundColor: Colors.disabled,
    borderColor: Colors.disabled,
  },
  disabledText: {
    color: Colors.lightText,
  },
  
  // Layout options
  fullWidth: {
    width: "100%",
  },
});

export default Button;