import React, { useState } from "react";
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  KeyboardTypeOptions
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import Colors from "@/constants/colors";

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  style?: ViewStyle;
  inputStyle?: TextStyle;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
}

const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  keyboardType = "default",
  autoCapitalize = "none",
  style,
  inputStyle,
  multiline = false,
  numberOfLines = 1,
  maxLength,
}) => {
  // Track whether to show password text or hide it with dots
  const [showPassword, setShowPassword] = useState(false);
  
  // Toggle between showing and hiding the password
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  return (
    <View style={[styles.container, style]}>
      {/* Show label if provided */}
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[
        styles.inputContainer,
        error ? styles.inputError : null,
        multiline ? styles.multilineInput : null
      ]}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          maxLength={maxLength}
        />
        
        {/* Show eye icon only for password fields */}
        {secureTextEntry && (
          <TouchableOpacity 
            style={styles.eyeIcon} 
            onPress={togglePasswordVisibility}
          >
            {showPassword ? (
              <EyeOff size={20} color={Colors.lightText} />
            ) : (
              <Eye size={20} color={Colors.lightText} />
            )}
          </TouchableOpacity>
        )}
      </View>
      
      {/* Show error message if there's an error */}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    color: Colors.text,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
  },
  multilineInput: {
    minHeight: 100,
  },
  eyeIcon: {
    padding: 10,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
  },
});

export default Input;