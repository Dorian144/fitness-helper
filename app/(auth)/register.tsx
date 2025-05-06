import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity } from "react-native";
import { Link, useRouter } from "expo-router";
import Input from "@/components/Input";
import Button from "@/components/Button";
import { useAuthStore } from "@/store/authStore";
import Colors from "@/constants/colors";
import { CheckBox } from "@/components/CheckBox";

// Fitness goals options
const fitnessGoals = [
  { id: "weight-loss", label: "Lose Weight" },
  { id: "muscle-gain", label: "Build Muscle" },
  { id: "endurance", label: "Improve Endurance" },
  { id: "flexibility", label: "Increase Flexibility" },
  { id: "general-fitness", label: "General Fitness" }
];

// Activity level options
const activityLevels = [
  { value: "sedentary", label: "Sedentary (little or no exercise)" },
  { value: "light", label: "Light (exercise 1-3 days/week)" },
  { value: "moderate", label: "Moderate (exercise 3-5 days/week)" },
  { value: "active", label: "Active (exercise 6-7 days/week)" },
  { value: "veryActive", label: "Very Active (hard exercise daily)" }
];

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [gender, setGender] = useState("male");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  
  const { register, isLoading, error, clearError } = useAuthStore();
  const router = useRouter();
  
  const handleGoalToggle = (goalId: string) => {
    if (selectedGoals.includes(goalId)) {
      setSelectedGoals(selectedGoals.filter(id => id !== goalId));
    } else {
      setSelectedGoals([...selectedGoals, goalId]);
    }
  };
  
  const validate = () => {
    clearError();
    const newErrors: Record<string, string> = {};
    
    if (!name) newErrors.name = "Name is required";
    
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
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    
    if (!age) {
      newErrors.age = "Age is required";
    } else if (isNaN(Number(age)) || Number(age) <= 0) {
      newErrors.age = "Age must be a positive number";
    }
    
    if (!weight) {
      newErrors.weight = "Weight is required";
    } else if (isNaN(Number(weight)) || Number(weight) <= 0) {
      newErrors.weight = "Weight must be a positive number";
    }
    
    if (!height) {
      newErrors.height = "Height is required";
    } else if (isNaN(Number(height)) || Number(height) <= 0) {
      newErrors.height = "Height must be a positive number";
    }
    
    if (selectedGoals.length === 0) {
      newErrors.goals = "Select at least one fitness goal";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleRegister = async () => {
    if (!validate()) return;
    
    try {
      const userData = {
        name,
        email,
        age: Number(age),
        weight: Number(weight),
        height: Number(height),
        gender,
        fitness_goals: selectedGoals,
        activityLevel,
      };
      
      await register(email, password, userData);
      router.replace("/(tabs)");
    } catch (error: any) {
      // Error is already handled in the store and displayed in the UI
      console.error("Registration error:", error);
    }
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Sign up to start your fitness journey</Text>
      </View>
      
      <View style={styles.form}>
        <Input
          label="Full Name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errors.name) setErrors({ ...errors, name: undefined });
          }}
          placeholder="Enter your full name"
          error={errors.name}
          autoCapitalize="words"
        />
        
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
          placeholder="Create a password"
          secureTextEntry
          error={errors.password}
        />
        
        <Input
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
          }}
          placeholder="Confirm your password"
          secureTextEntry
          error={errors.confirmPassword}
        />
        
        <View style={styles.row}>
          <Input
            label="Age"
            value={age}
            onChangeText={(text) => {
              setAge(text);
              if (errors.age) setErrors({ ...errors, age: undefined });
            }}
            placeholder="Years"
            keyboardType="numeric"
            error={errors.age}
            style={styles.halfInput}
          />
          
          <View style={[styles.halfInput, styles.genderContainer]}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderOptions}>
              <TouchableOpacity
                style={[
                  styles.genderOption,
                  gender === "male" && styles.selectedGender
                ]}
                onPress={() => setGender("male")}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === "male" && styles.selectedGenderText
                  ]}
                >
                  Male
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.genderOption,
                  gender === "female" && styles.selectedGender
                ]}
                onPress={() => setGender("female")}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === "female" && styles.selectedGenderText
                  ]}
                >
                  Female
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <View style={styles.row}>
          <Input
            label="Weight"
            value={weight}
            onChangeText={(text) => {
              setWeight(text);
              if (errors.weight) setErrors({ ...errors, weight: undefined });
            }}
            placeholder="kg"
            keyboardType="numeric"
            error={errors.weight}
            style={styles.halfInput}
          />
          
          <Input
            label="Height"
            value={height}
            onChangeText={(text) => {
              setHeight(text);
              if (errors.height) setErrors({ ...errors, height: undefined });
            }}
            placeholder="cm"
            keyboardType="numeric"
            error={errors.height}
            style={styles.halfInput}
          />
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Activity Level</Text>
          <View style={styles.pickerContainer}>
            {activityLevels.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.activityOption,
                  activityLevel === level.value && styles.selectedActivity
                ]}
                onPress={() => setActivityLevel(level.value)}
              >
                <Text
                  style={[
                    styles.activityText,
                    activityLevel === level.value && styles.selectedActivityText
                  ]}
                >
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Fitness Goals</Text>
          {errors.goals && <Text style={styles.errorText}>{errors.goals}</Text>}
          <View style={styles.goalsContainer}>
            {fitnessGoals.map((goal) => (
              <CheckBox
                key={goal.id}
                label={goal.label}
                checked={selectedGoals.includes(goal.id)}
                onToggle={() => {
                  handleGoalToggle(goal.id);
                  if (errors.goals) setErrors({ ...errors, goals: undefined });
                }}
              />
            ))}
          </View>
        </View>
        
        {error && <Text style={styles.errorText}>{error}</Text>}
        
        <Button
          title="Create Account"
          onPress={handleRegister}
          loading={isLoading}
          style={styles.button}
          fullWidth
        />
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)" asChild>
            <Text style={styles.link}>Sign In</Text>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginTop: 20,
    marginBottom: 30,
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
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInput: {
    width: "48%",
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    color: Colors.text,
    fontWeight: "500",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  activityOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activityText: {
    fontSize: 16,
    color: Colors.text,
  },
  selectedActivity: {
    backgroundColor: Colors.primary + "20", // 20% opacity
  },
  selectedActivityText: {
    color: Colors.primary,
    fontWeight: "600",
  },
  genderContainer: {
    marginBottom: 16,
  },
  genderOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  genderOption: {
    flex: 1,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  genderText: {
    fontSize: 16,
    color: Colors.text,
  },
  selectedGender: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectedGenderText: {
    color: "#fff",
    fontWeight: "600",
  },
  goalsContainer: {
    marginTop: 8,
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
    fontSize: 12,
    marginTop: 4,
  },
});