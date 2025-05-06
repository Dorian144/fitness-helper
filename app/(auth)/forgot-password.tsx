import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import Input from "@/components/Input";
import Button from "@/components/Button";
import { useAuthStore } from "@/store/authStore";
import Colors from "@/constants/colors";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  
  const { forgotPassword, isLoading, error, clearError } = useAuthStore();
  const router = useRouter();
  
  const validate = () => {
    clearError();
    
    if (!email) {
      setEmailError("Email is required");
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Email is invalid");
      return false;
    }
    
    setEmailError(undefined);
    return true;
  };
  
  const handleResetPassword = async () => {
    if (!validate()) return;
    
    try {
      await forgotPassword(email);
      Alert.alert(
        "Password Reset Email Sent",
        "Check your email for instructions to reset your password.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error: any) {
      // Error is already handled in the store and displayed in the UI
      console.error("Password reset error:", error);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your email address and we'll send you instructions to reset your password.
        </Text>
      </View>
      
      <View style={styles.form}>
        <Input
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (emailError) setEmailError(undefined);
          }}
          placeholder="Enter your email"
          keyboardType="email-address"
          error={emailError}
        />
        
        {error && <Text style={styles.errorText}>{error}</Text>}
        
        <Button
          title="Send Reset Link"
          onPress={handleResetPassword}
          loading={isLoading}
          style={styles.button}
          fullWidth
        />
        
        <Button
          title="Back to Sign In"
          onPress={() => router.back()}
          variant="outline"
          style={styles.backButton}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: Colors.background,
  },
  header: {
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.lightText,
    lineHeight: 22,
  },
  form: {
    width: "100%",
  },
  button: {
    marginTop: 16,
  },
  backButton: {
    marginTop: 12,
  },
  errorText: {
    color: Colors.error,
    marginBottom: 16,
    textAlign: "center",
  },
});