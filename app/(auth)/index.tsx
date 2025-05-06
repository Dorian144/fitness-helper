import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Link, useRouter } from "expo-router";
import Input from "@/components/Input";
import Button from "@/components/Button";
import { useAuthStore } from "@/store/authStore";
import Colors from "@/constants/colors";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const { login, isLoading, error, clearError } = useAuthStore();
  const router = useRouter();
  
  const validate = () => {
    clearError();
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Email is invalid";
    }
    
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSignIn = async () => {
    if (!validate()) return;
    
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (error: any) {
      // Error is already handled in the store and displayed in the UI
      console.error("Sign in error:", error);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue to Fitness Helper</Text>
      </View>
      
      <View style={styles.form}>
        <Input
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors({ ...errors, email: undefined });
          }}
          placeholder="Enter your email"
          keyboardType="email-address"
          error={errors.email}
        />
        
        <Input
          label="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors({ ...errors, password: undefined });
          }}
          placeholder="Enter your password"
          secureTextEntry
          error={errors.password}
        />
        
        <Link href="/(auth)/forgot-password" asChild>
          <Text style={styles.forgotPassword}>Forgot Password?</Text>
        </Link>
        
        {error && <Text style={styles.errorText}>{error}</Text>}
        
        <Button
          title="Sign In"
          onPress={handleSignIn}
          loading={isLoading}
          style={styles.button}
          fullWidth
        />
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <Text style={styles.link}>Sign Up</Text>
          </Link>
        </View>
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
  },
  form: {
    width: "100%",
  },
  forgotPassword: {
    color: Colors.primary,
    textAlign: "right",
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    marginTop: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: Colors.lightText,
  },
  link: {
    color: Colors.primary,
    fontWeight: "500",
  },
  errorText: {
    color: Colors.error,
    marginBottom: 16,
    textAlign: "center",
  },
});