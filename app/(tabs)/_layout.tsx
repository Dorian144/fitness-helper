import React, { useEffect, useState, useCallback } from "react";
import { Tabs } from "expo-router";
import { Platform, Alert } from "react-native";
import { Home, Dumbbell, User, Utensils } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";
import { generateRecommendation, validateUserData } from "@/services/api";

export default function TabLayout() {
  const { user } = useAuthStore();
  const { fetchUserProfile, profile, setDailyRecommendation } = useUserStore();
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);
  const [lastRecommendationTime, setLastRecommendationTime] = useState<Date | null>(null);
  
  // Fetch user profile when component mounts
  useEffect(() => {
    if (user) {
      fetchUserProfile(user.uid).catch(error => {
        console.error("Error fetching user profile:", error);
        // Show user-friendly error message
        Alert.alert(
          "Profile Error",
          "There was a problem loading your profile. Please try again later.",
          [{ text: "OK" }]
        );
      });
    }
  }, [user, fetchUserProfile]);
  
  // Define refreshRecommendation with useCallback to avoid dependency issues
  const refreshRecommendation = useCallback(async () => {
    if (profile && user && !isGeneratingRecommendation) {
      try {
        setIsGeneratingRecommendation(true);
        
        // Validate user data before making API call
        const isValidData = validateUserData(profile);
        
        // Generate recommendation or use default
        const recommendation = await generateRecommendation({
          ...profile,
          id: user.uid // Add user ID for rate limiting
        });
        
        // Set recommendation with fallback flag if data was invalid
        setDailyRecommendation({
          text: recommendation || "Track your workouts and meals consistently for the best results!",
          isFallback: !isValidData
        });
        
        setLastRecommendationTime(new Date());
      } catch (error) {
        console.error("Error refreshing recommendation:", error);
        // Keep existing recommendation on error
        Alert.alert(
          "Recommendation Error",
          "There was a problem refreshing your recommendation. Please try again later.",
          [{ text: "OK" }]
        );
      } finally {
        setIsGeneratingRecommendation(false);
      }
    }
  }, [profile, user, isGeneratingRecommendation, setDailyRecommendation]);
  
  // Generate AI recommendation when profile is loaded
  useEffect(() => {
    const generateAIRecommendation = async () => {
      if (profile && !isGeneratingRecommendation) {
        // Check if we should regenerate (first time or more than 24 hours)
        const shouldRegenerate = !lastRecommendationTime || 
          (new Date().getTime() - lastRecommendationTime.getTime() > 24 * 60 * 60 * 1000);
        
        if (shouldRegenerate) {
          try {
            setIsGeneratingRecommendation(true);
            
            // Validate user data before making API call
            const isValidData = validateUserData(profile);
            
            // Add debug logging for enhanced recommendations
            console.log("Generating AI recommendation with enhanced user data");
            
            // Generate recommendation or use default
            const recommendation = await generateRecommendation({
              ...profile,
              id: user?.uid // Add user ID for rate limiting
            });
            
            // Log recommendation for debugging
            console.log("Enhanced AI recommendation received:", recommendation);
            
            // Set recommendation with fallback flag if data was invalid
            setDailyRecommendation({
              text: recommendation || "Track your workouts and meals consistently for the best results!",
              isFallback: !isValidData
            });
            
            setLastRecommendationTime(new Date());
          } catch (error) {
            console.error("Error generating recommendation:", error);
            // Set a default recommendation on error
            setDailyRecommendation({
              text: "Track your workouts and meals consistently for the best results!",
              isFallback: true
            });
          } finally {
            setIsGeneratingRecommendation(false);
          }
        }
      }
    };
    
    generateAIRecommendation();
  }, [profile, setDailyRecommendation, user, isGeneratingRecommendation, lastRecommendationTime]);
  
  // Make refreshRecommendation available to child components
  // Make this effect run only once to prevent infinite loops
  useEffect(() => {
    useUserStore.setState((state) => ({
      ...state,
      refreshRecommendation
    }));
  }, [refreshRecommendation]);
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.tabBar.inactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBar.background,
          borderTopColor: Colors.border,
          height: Platform.OS === "ios" ? 90 : 60,
          paddingBottom: Platform.OS === "ios" ? 30 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Workouts",
          tabBarIcon: ({ color }) => <Dumbbell size={24} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: "Meals",
          tabBarIcon: ({ color }) => <Utensils size={24} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}