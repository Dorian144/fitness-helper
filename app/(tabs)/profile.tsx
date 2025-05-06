import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  TouchableOpacity,
  Platform,
  ActivityIndicator
} from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";
import Input from "@/components/Input";
import Button from "@/components/Button";
import ProfilePhoto from "@/components/ProfilePhoto";
import { CheckBox } from "@/components/CheckBox";
import Colors from "@/constants/colors";
import { LogOut, AlertCircle, Download, RefreshCw } from "lucide-react-native";
import { formatWorkoutDataForExport, exportToCSV } from "@/services/utils";
import { migrateUserHistoryData } from "@/services/firebase";

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

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { profile, isLoading, error, updateProfile, uploadPhoto, fetchUserProfile } = useUserStore();
  
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState("");
  const [gender, setGender] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  
  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setAge(profile.age ? profile.age.toString() : "");
      setWeight(profile.weight ? profile.weight.toString() : "");
      setHeight(profile.height ? profile.height.toString() : "");
      
      // Filter out any goals that aren't in the fitnessGoals list
      const validGoals = (profile.fitness_goals || []).filter(goalId => 
        fitnessGoals.some(goal => goal.id === goalId)
      );
      setSelectedGoals(validGoals);
      
      setActivityLevel(profile.activityLevel || "moderate");
      setGender(profile.gender || "male");
    }
  }, [profile]);
  
  // Check if migration is needed
  useEffect(() => {
    if (profile) {
      // Check if migration is needed - if profile has arrays but subcollections are empty
      const hasOldWorkoutData = profile.workout_history && 
                               Array.isArray(profile.workout_history) && 
                               profile.workout_history.length > 0;
                               
      const hasOldMealData = profile.meal_history && 
                            Array.isArray(profile.meal_history) && 
                            profile.meal_history.length > 0;
                            
      // Type assertion to allow dataMigrated access
      const profileData = profile as any;
      const needsMigration = (hasOldWorkoutData || hasOldMealData) && !profileData.dataMigrated;
      
      setNeedsMigration(needsMigration);
    }
  }, [profile]);
  
  // Refresh profile data
  const refreshProfile = async () => {
    if (!user) return;
    
    setIsRefreshing(true);
    try {
      await fetchUserProfile(user.uid);
    } catch (error) {
      console.error("Error refreshing profile:", error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleGoalToggle = (goalId: string) => {
    if (selectedGoals.includes(goalId)) {
      setSelectedGoals(selectedGoals.filter(id => id !== goalId));
    } else {
      setSelectedGoals([...selectedGoals, goalId]);
    }
  };
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      Alert.alert("Logout Failed", error.message);
    }
  };
  
  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      // Filter out any goals that aren't in the fitnessGoals list
      const validGoals = selectedGoals.filter(goalId => 
        fitnessGoals.some(goal => goal.id === goalId)
      );
      
      const updatedProfile = {
        name,
        age: Number(age),
        weight: Number(weight),
        height: Number(height),
        fitness_goals: validGoals,
        activityLevel,
        gender,
      };
      
      await updateProfile(user.uid, updatedProfile);
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error: any) {
      Alert.alert("Update Failed", error.message);
    }
  };
  
  const handlePhotoSelect = async (uri: string) => {
    if (!user) return;
    
    try {
      await uploadPhoto(user.uid, uri);
    } catch (error: any) {
      Alert.alert("Upload Failed", error.message);
    }
  };
  
  const handleExportData = async () => {
    if (profile) {
      try {
        const exportData = formatWorkoutDataForExport(profile);
        await exportToCSV(exportData);
        Alert.alert(
          "Export Successful",
          "Your fitness data has been exported to CSV."
        );
      } catch (error) {
        console.error("Error exporting data:", error);
        Alert.alert(
          "Export Failed",
          "There was a problem exporting your data. Please try again."
        );
      }
    }
  };
  
  const handleRestoreMissingHistory = async () => {
    if (!user) return;
    
    setIsMigrating(true);
    try {
      await migrateUserHistoryData(user.uid);
      await fetchUserProfile(user.uid);
      setNeedsMigration(false);
      Alert.alert("Success", "Your workout and meal history has been restored!");
    } catch (error: any) {
      Alert.alert("Migration Failed", error.message || "Failed to restore history data.");
    } finally {
      setIsMigrating(false);
    }
  };
  
  if (isLoading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }
  
  if (error && !profile) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={40} color={Colors.error} />
        <Text style={styles.errorTitle}>Error Loading Profile</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button 
          title="Try Again" 
          onPress={refreshProfile} 
          style={styles.retryButton}
        />
      </View>
    );
  }
  
  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={40} color={Colors.error} />
        <Text style={styles.errorTitle}>Profile Not Found</Text>
        <Text style={styles.errorText}>We couldn't find your profile. Please try again.</Text>
        <Button 
          title="Try Again" 
          onPress={refreshProfile} 
          style={styles.retryButton}
        />
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <ProfilePhoto 
          photoURL={profile.photoURL} 
          size={120} 
          onSelectImage={handlePhotoSelect}
          name={profile.name}
        />
        
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.weight} kg</Text>
            <Text style={styles.statLabel}>Weight</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.height} cm</Text>
            <Text style={styles.statLabel}>Height</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.age} yrs</Text>
            <Text style={styles.statLabel}>Age</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          {!isEditing ? (
            <Button 
              title="Edit" 
              onPress={() => setIsEditing(true)} 
              variant="outline"
              size="small"
            />
          ) : (
            <Button 
              title="Cancel" 
              onPress={() => setIsEditing(false)} 
              variant="text"
              size="small"
            />
          )}
        </View>
        
        {isEditing ? (
          <View style={styles.form}>
            <Input
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
            />
            
            <View style={styles.row}>
              <Input
                label="Age"
                value={age}
                onChangeText={setAge}
                placeholder="Years"
                keyboardType="numeric"
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
                onChangeText={setWeight}
                placeholder="kg"
                keyboardType="numeric"
                style={styles.halfInput}
              />
              
              <Input
                label="Height"
                value={height}
                onChangeText={setHeight}
                placeholder="cm"
                keyboardType="numeric"
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
              <View style={styles.goalsContainer}>
                {fitnessGoals.map((goal) => (
                  <CheckBox
                    key={goal.id}
                    label={goal.label}
                    checked={selectedGoals.includes(goal.id)}
                    onToggle={() => handleGoalToggle(goal.id)}
                  />
                ))}
              </View>
            </View>
            
            <Button
              title="Save Changes"
              onPress={handleSaveProfile}
              loading={isLoading}
              style={styles.saveButton}
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.profileInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{profile.name}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Age</Text>
              <Text style={styles.infoValue}>{profile.age} years</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Gender</Text>
              <Text style={styles.infoValue}>{profile.gender}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Weight</Text>
              <Text style={styles.infoValue}>{profile.weight} kg</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Height</Text>
              <Text style={styles.infoValue}>{profile.height} cm</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Activity Level</Text>
              <Text style={styles.infoValue}>
                {activityLevels.find(level => level.value === profile.activityLevel)?.label || profile.activityLevel}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fitness Goals</Text>
              <Text style={styles.infoValue}>
                {profile.fitness_goals?.filter(goalId => fitnessGoals.some(g => g.id === goalId))
                  .map(goalId => {
                    const goal = fitnessGoals.find(g => g.id === goalId);
                    return goal ? goal.label : null;
                  })
                  .filter(Boolean)
                  .join(", ") || "None set"}
              </Text>
            </View>
          </View>
        )}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced Settings</Text>
        
        {needsMigration && (
          <TouchableOpacity 
            style={styles.settingItem} 
            onPress={handleRestoreMissingHistory}
            disabled={isMigrating}
          >
            <RefreshCw size={20} color={Colors.primary} />
            <Text style={[styles.settingLabel, { color: Colors.primary }]}>
              {isMigrating ? "Restoring History..." : "Restore Missing History"}
            </Text>
            {isMigrating && (
              <ActivityIndicator size="small" color={Colors.primary} style={styles.loadingIndicator} />
            )}
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.settingItem} onPress={handleExportData}>
          <Download size={20} color={Colors.text} />
          <Text style={styles.settingLabel}>Export Data</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
          <LogOut size={20} color={Colors.error} />
          <Text style={[styles.settingLabel, { color: Colors.error }]}>Logout</Text>
        </TouchableOpacity>
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
    padding: 16,
    paddingBottom: 40,
    paddingTop: 55,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: Colors.lightText,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.error,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.lightText,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    width: 120,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.text,
    marginTop: 12,
  },
  email: {
    fontSize: 16,
    color: Colors.lightText,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: Colors.text,
  },
  actionsSectionTitle: {
    marginBottom: 20,
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
  saveButton: {
    marginTop: 16,
  },
  profileInfo: {
    width: "100%",
  },
  infoRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    width: "40%",
    fontSize: 16,
    color: Colors.lightText,
  },
  infoValue: {
    width: "60%",
    fontSize: 16,
    color: Colors.text,
    fontWeight: "500",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoutButton: {
    borderColor: Colors.error,
  },
  actionIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "500",
    color: Colors.primary,
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "500",
    color: Colors.error,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingLabel: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "500",
    color: Colors.text,
  },
  loadingIndicator: {
    marginLeft: 8
  }
});