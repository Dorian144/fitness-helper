import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  SafeAreaView,
  Linking,
  StatusBar
} from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";
import ProgressSlider from "@/components/ProgressSlider";
import RecommendationCard from "@/components/RecommendationCard";
import { calculateCalorieNeeds } from "@/services/utils";
import Colors from "@/constants/colors";
import { Download, AlertCircle, Trash2, Dumbbell, Utensils, Filter, X, Search, Play, Pause, RotateCcw, CheckCircle, ChevronDown, Clock, PlusCircle, MinusCircle, Calendar, Scale, BarChart2, Lightbulb, RefreshCw, Settings } from "lucide-react-native";
import { formatWorkoutDataForExport, exportToCSV, getMealImage } from "@/services/utils";
import { Platform } from "react-native";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { Swipeable, RectButton, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { profile, error, dailyRecommendation, fetchUserProfile, refreshRecommendation, updateUserProfile, removeWorkout } = useUserStore();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingRecommendation, setIsRefreshingRecommendation] = useState(false);
  const [isRecommendationExpanded, setIsRecommendationExpanded] = useState(false);
  const [streaks, setStreaks] = useState({ 
    workouts: { count: 0, status: 'none' }, 
    meals: { count: 0, status: 'none' } 
  });
  
  // Create animated value for hint animation
  const [swipeHintAnimation] = useState(new Animated.Value(0));
  
  // Add state for selected workout details
  const [selectedWorkoutDetails, setSelectedWorkoutDetails] = useState<any>(null);
  
  // Add state for selected day meals
  const [selectedDayMeals, setSelectedDayMeals] = useState<any>(null);
  
  // Create animated height value for recommendation card
  const [recommendationHeight] = useState(new Animated.Value(0));
  const [recommendationTextHeight, setRecommendationTextHeight] = useState(0);
  
  // Load profile data
  useEffect(() => {
    if (user) {
      setIsLoading(true);
      fetchUserProfile(user.uid)
        .catch(error => {
          console.error("Error fetching profile:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [user, fetchUserProfile]);
  
  // Calculate daily targets
  const calorieTarget = profile ? calculateCalorieNeeds(
    profile.weight,
    profile.height,
    profile.age,
    profile.gender,
    profile.activityLevel
  ) : 2000;
  
  const proteinTarget = profile ? Math.round(profile.weight * 1.6) : 120; // 1.6g per kg of bodyweight
  const waterTarget = 8; // 8 glasses (2 liters)
  
  // Calculate current values
  const [currentValues, setCurrentValues] = useState({
    calories: 0,
    protein: 0,
    water: 0,
  });
  
  // Update current values based on meal history and water
  useEffect(() => {
    if (profile) {
      try {
      // Get today's meals
      const today = new Date().toISOString().split("T")[0];
        const todayMeals = profile.meal_history ? profile.meal_history.filter(
          (meal: any) => meal.date && meal.date.startsWith && meal.date.startsWith(today)
        ) : [];
      
        // Calculate totals with error handling
      const calories = todayMeals.reduce(
          (sum: number, meal: any) => sum + (meal && typeof meal.calories === 'number' ? meal.calories : 0), 
        0
      );
      
      const protein = todayMeals.reduce(
          (sum: number, meal: any) => sum + (meal && typeof meal.protein === 'number' ? meal.protein : 0), 
        0
      );
      
        // Get water intake with validation
        const water = profile.water_intake && typeof profile.water_intake === 'object' ? 
          (profile.water_intake[today] || 0) : 0;
      
      setCurrentValues({
          calories: isNaN(calories) ? 0 : calories,
          protein: isNaN(protein) ? 0 : protein,
          water: isNaN(water) ? 0 : water,
        });
      } catch (error) {
        console.error("Error calculating current values:", error);
        // Set defaults on error
        setCurrentValues({
          calories: 0,
          protein: 0,
          water: 0,
      });
      }
    }
  }, [profile]);
  
  // Run hint animation for workouts when they exist
  useEffect(() => {
    if (profile && profile.workout_history && profile.workout_history.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(swipeHintAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(swipeHintAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      swipeHintAnimation.setValue(0);
    }
    
    return () => {
      swipeHintAnimation.stopAnimation();
    };
  }, [profile?.workout_history?.length, swipeHintAnimation]);
  
  // Calculate streaks
  useEffect(() => {
    if (profile) {
      // Calculate workout streak
      const workoutStreak = calculateStreak(profile.workout_history || []);
      // Calculate meal streak
      const mealStreak = calculateStreak(profile.meal_history || []);
      
      setStreaks({
        workouts: workoutStreak,
        meals: mealStreak
      });
    }
  }, [profile]);
  
  // Function to calculate streaks (consecutive days)
  const calculateStreak = (history: any[]) => {
    if (!history || !Array.isArray(history) || history.length === 0) return { count: 0, status: 'none' };
    
    try {
      // Filter out invalid entries and get unique dates in descending order (newest first)
      const uniqueDates = [...new Set(
        history
          .filter(item => item && item.date && typeof item.date === 'string')
          .map(item => item.date.split('T')[0])
      )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      if (uniqueDates.length === 0) return { count: 0, status: 'none' };
      
      // Check if the most recent date is today or yesterday
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      now.setDate(now.getDate() - 1);
      const yesterday = now.toISOString().split('T')[0];
      
      // Reset to current date for further calculations
      now.setDate(now.getDate() + 1);
      
      // Status determination based on most recent activity
      let status = 'none';
      let count = 0;
      
      // If most recent is today, streak could be active
      if (uniqueDates[0] === today) {
        count = 1;
        
        // Count consecutive days backward from today
        let expectedDate = new Date(today);
        
        for (let i = 1; i < uniqueDates.length; i++) {
          expectedDate.setDate(expectedDate.getDate() - 1);
          const expectedDateStr = expectedDate.toISOString().split('T')[0];
          
          if (uniqueDates[i] === expectedDateStr) {
            count++;
          } else {
            break; // Streak broken
          }
        }
        
        // Only set status to active if streak is at least 3 days
        status = count >= 3 ? 'active' : 'none';
      } 
      // If most recent is yesterday, streak is in warning state
      else if (uniqueDates[0] === yesterday) {
        count = 1;
        
        // Count consecutive days backward from yesterday
        let expectedDate = new Date(yesterday);
        
        for (let i = 1; i < uniqueDates.length; i++) {
          expectedDate.setDate(expectedDate.getDate() - 1);
          const expectedDateStr = expectedDate.toISOString().split('T')[0];
          
          if (uniqueDates[i] === expectedDateStr) {
            count++;
          } else {
            break; // Streak broken
          }
        }
        
        // Set status to warning if streak is at least 3 days
        status = count >= 3 ? 'warning' : 'none';
      } 
      
      return { count, status };
    } catch (error) {
      console.error("Error calculating streak:", error);
      return { count: 0, status: 'none' };
    }
  };
  
  const onRefresh = async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      await fetchUserProfile(user.uid);
    } catch (error: any) {
      console.error("Error refreshing profile:", error);
      Alert.alert(
        "Refresh Failed",
        "There was a problem refreshing your data. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setRefreshing(false);
    }
  };
  
  const handleIncrementWater = async () => {
    if (!user || !profile) return;
    
    try {
      const today = new Date().toISOString().split("T")[0];
      const newWaterValue = (currentValues.water || 0) + 1;
      
      // Create water_intake object if it doesn't exist
      const waterIntake = profile.water_intake || {};
      waterIntake[today] = newWaterValue;
      
      // Update Firestore
      await updateUserProfile({
        water_intake: waterIntake
      });
      
      // Update local state
      setCurrentValues({
        ...currentValues,
        water: newWaterValue
      });
    } catch (error) {
      console.error("Error incrementing water:", error);
      Alert.alert("Error", "Failed to update water intake");
    }
  };
  
  const handleDecrementWater = async () => {
    if (!user || !profile) return;
    
    try {
      const today = new Date().toISOString().split("T")[0];
      const newWaterValue = Math.max((currentValues.water || 0) - 1, 0);
      
      // Create water_intake object if it doesn't exist
      const waterIntake = profile.water_intake || {};
      waterIntake[today] = newWaterValue;
      
      // Update Firestore
      await updateUserProfile({
        water_intake: waterIntake
      });
      
      // Update local state
      setCurrentValues({
        ...currentValues,
        water: newWaterValue
      });
    } catch (error) {
      console.error("Error decrementing water:", error);
      Alert.alert("Error", "Failed to update water intake");
    }
  };
  
  const handleExportData = () => {
    if (profile) {
      const exportData = formatWorkoutDataForExport(profile);
      exportToCSV(exportData);
    }
  };
  
  // Add a function to handle workout deletion
  const handleDeleteWorkout = (workoutId: string) => {
    if (!user) return;
    
    Alert.alert(
      "Delete Workout",
      "Are you sure you want to remove this workout from your history?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeWorkout(user.uid, workoutId);
              
              // Haptic feedback
              if (Platform.OS !== "web") {
                try {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (error) {
                  console.error("Haptics error:", error);
                }
              }
            } catch (error) {
              console.error("Error deleting workout:", error);
              Alert.alert("Error", "Failed to delete workout. Please try again.");
            }
          }
        }
      ]
    );
  };
  
  // Render a delete action when swiping
  const renderRightAction = (workoutId: string, progress: Animated.AnimatedInterpolation<number>) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [100, 0],
    });
    
    const opacity = progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0.5, 1],
    });
    
    return (
      <Animated.View 
        style={[
          styles.rightAction, 
          { 
            transform: [{ translateX: trans }],
            opacity: opacity
          }
        ]}
      >
        <RectButton
          style={styles.rightActionButton}
          onPress={() => handleDeleteWorkout(workoutId)}
        >
          <Trash2 size={24} color="#fff" />
          <Text style={styles.actionText}>Delete</Text>
        </RectButton>
      </Animated.View>
    );
  };
  
  // Add a function to handle weight adjustments
  const handleUpdateWeight = async (increment: number) => {
    if (!user || !profile) return;
    
    try {
      const newWeight = Math.round((profile.weight + increment) * 10) / 10; // Round to 1 decimal place
      
      // Update locally for immediate UI feedback
      updateUserProfile({ weight: newWeight });
      
      // Update in Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { weight: newWeight });
      
      // Feedback (vibration)
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
    } catch (error) {
      console.error("Error updating weight:", error);
      Alert.alert("Error", "Failed to update weight. Please try again.");
    }
  };
  
  // Handle refresh recommendation button click
  const handleRefreshRecommendation = async () => {
    if (!refreshRecommendation) return;
    
    try {
      setIsRefreshingRecommendation(true);
      await refreshRecommendation();
    } catch (error) {
      console.error("Error refreshing recommendation:", error);
    } finally {
      setIsRefreshingRecommendation(false);
    }
  };
  
  // Added settings menu handler
  const handleOpenSettingsMenu = () => {
    // Will implement settings menu in the future
    Alert.alert("Settings", "Settings menu coming soon!");
  };
  
  // Toggle recommendation expansion
  const toggleRecommendation = () => {
    setIsRecommendationExpanded(!isRecommendationExpanded);
    
    // Animate the height change
    Animated.timing(recommendationHeight, {
      toValue: isRecommendationExpanded ? 0 : recommendationTextHeight,
      duration: 300,
      useNativeDriver: false
    }).start();
  };
  
  // Function to get first line of recommendation
  const getFirstLine = (text: string | undefined) => {
    if (!text) return "";
    const firstLineEnd = text.indexOf('.');
    if (firstLineEnd === -1) return text;
    return text.substring(0, firstLineEnd + 1);
  };
  
  // Function to measure the recommendation text height
  const onRecommendationTextLayout = (event: { nativeEvent: { layout: { height: number } } }) => {
    const { height } = event.nativeEvent.layout;
    setRecommendationTextHeight(height);
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your home screen...</Text>
      </View>
    );
  }
  
  if (error && !profile) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={40} color={Colors.error} />
        <Text style={styles.errorTitle}>Error Loading Data</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={40} color={Colors.error} />
        <Text style={styles.errorTitle}>Profile Not Found</Text>
        <Text style={styles.errorText}>We couldn't find your profile data. Please try again.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={Colors.background} barStyle="dark-content" />
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.innerContentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back, {profile?.name?.split(' ')[0] || 'User'}</Text>
          <TouchableOpacity onPress={handleOpenSettingsMenu}>
            <Settings size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        {/* Daily Recommendation Card */}
        <View style={styles.recommendationCard}>
          <View style={styles.recommendationHeader}>
            <View style={styles.recommendationTitleContainer}>
              <Lightbulb size={18} color={Colors.primary} />
              <Text style={styles.recommendationTitle}>Fitness Coach</Text>
            </View>
            <View style={styles.recommendationHeaderButtons}>
              <TouchableOpacity 
                style={styles.refreshButton} 
                onPress={handleRefreshRecommendation}
                disabled={isRefreshingRecommendation}
              >
                {isRefreshingRecommendation ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <RefreshCw size={16} color={Colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.expandButton} 
                onPress={toggleRecommendation}
              >
                <ChevronDown 
                  size={18} 
                  color={Colors.primary} 
                  style={{
                    transform: [{ rotate: isRecommendationExpanded ? '180deg' : '0deg' }]
                  }}
                />
              </TouchableOpacity>
            </View>
          </View>
          
          {dailyRecommendation?.text ? (
            <View>
              <Text style={styles.recommendationText}>
                {isRecommendationExpanded ? "" : getFirstLine(dailyRecommendation.text)}
              </Text>
              
              {/* Only show the hidden full text when expanded */}
              {isRecommendationExpanded && (
                <Text 
                  style={styles.recommendationText}
                  onLayout={onRecommendationTextLayout}
                >
                  {dailyRecommendation.text}
                </Text>
              )}
              
              {/* Show more/less button */}
              <TouchableOpacity
                onPress={toggleRecommendation}
                style={styles.showMoreButton}
              >
                <Text style={styles.showMoreButtonText}>
                  {isRecommendationExpanded ? "Show Less" : "Show More"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.recommendationText}>
              Complete your profile to get personalized recommendations!
            </Text>
          )}
          
          {dailyRecommendation?.isFallback && (
            <View style={styles.recommendationNote}>
              <AlertCircle size={12} color={Colors.warning} />
              <Text style={styles.recommendationNoteText}>
                Track more data for better recommendations
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Progress</Text>
            {Platform.OS === "web" && (
              <TouchableOpacity 
                style={styles.exportButton} 
                onPress={handleExportData}
              >
                <Download size={16} color={Colors.primary} />
                <Text style={styles.exportText}>Export Data</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <ProgressSlider
            title="Calories"
            value={currentValues.calories}
            max={calorieTarget}
            unit=" kcal"
            color={Colors.primary}
          />
          
          <ProgressSlider
            title="Protein"
            value={currentValues.protein}
            max={proteinTarget}
            unit="g"
            color={Colors.secondary}
          />
          
          <ProgressSlider
            title="Water"
            value={currentValues.water}
            max={waterTarget}
            unit=" glasses"
            color="#3498db"
            type="water"
            onIncrement={handleIncrementWater}
            onDecrement={handleDecrementWater}
          />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats</Text>
          
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, styles.streakCard]}>
              <View style={[
                styles.streakIconContainer,
                streaks.workouts.status === 'active' && styles.activeStreakIcon,
                streaks.workouts.status === 'warning' && styles.warningStreakIcon,
                streaks.workouts.status === 'none' && styles.inactiveStreakIcon,
              ]}>
                <Dumbbell size={16} color="white" />
              </View>
              <View style={styles.statValueContainer}>
                <Text style={[
                  styles.statValue, 
                  streaks.workouts.status === 'active' && styles.streakValue,
                  streaks.workouts.status === 'warning' && styles.warningValue
                ]}>
                  {streaks.workouts.count > 0 ? streaks.workouts.count : 0}
              </Text>
                {streaks.workouts.status === 'active' && streaks.workouts.count >= 3 && (
                  <Text style={styles.streakEmoji}>🔥</Text>
                )}
                {streaks.workouts.status === 'warning' && (
                  <Text style={styles.streakEmoji}>🧊</Text>
                )}
              </View>
              <Text style={styles.statLabel}>Workouts Streak</Text>
            </View>
            
            <View style={[styles.statCard, styles.streakCard]}>
              <View style={[
                styles.streakIconContainer,
                streaks.meals.status === 'active' && styles.activeStreakIcon,
                streaks.meals.status === 'warning' && styles.warningStreakIcon,
                streaks.meals.status === 'none' && styles.inactiveStreakIcon,
              ]}>
                <Utensils size={16} color="white" />
              </View>
              <View style={styles.statValueContainer}>
                <Text style={[
                  styles.statValue, 
                  streaks.meals.status === 'active' && styles.streakValue,
                  streaks.meals.status === 'warning' && styles.warningValue
                ]}>
                  {streaks.meals.count > 0 ? streaks.meals.count : 0}
              </Text>
                {streaks.meals.status === 'active' && streaks.meals.count >= 3 && (
                  <Text style={styles.streakEmoji}>🔥</Text>
                )}
                {streaks.meals.status === 'warning' && (
                  <Text style={styles.streakEmoji}>🧊</Text>
                )}
              </View>
              <Text style={styles.statLabel}>Meals Streak</Text>
            </View>
            
            <View style={[styles.statCard, styles.weightCard]}>
              <View style={[
                styles.streakIconContainer,
                styles.weightIcon
              ]}>
                <Scale size={16} color="white" />
              </View>
              <View style={styles.weightValue}>
                <Text style={styles.weightStatValue}>
                {profile.weight} kg
              </Text>
                <View style={styles.weightControls}>
                  <TouchableOpacity 
                    style={styles.weightButton} 
                    onPress={() => handleUpdateWeight(-0.1)}
                    activeOpacity={0.7}
                  >
                    <MinusCircle size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.weightButton} 
                    onPress={() => handleUpdateWeight(0.1)}
                    activeOpacity={0.7}
                  >
                    <PlusCircle size={20} color={Colors.primary} />
                  </TouchableOpacity>
            </View>
          </View>
            </View>
          </View>
          
          {/* Additional workout stats if available */}
          {profile.workout_history && profile.workout_history.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Recent Workouts</Text>
              
              <ScrollView 
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.recentWorkoutsContainer}
              >
                <View style={{ flexDirection: 'row' }}>
                  {profile.workout_history
                    // Filter out the "current_workout" entries
                    .filter(workout => workout.id !== 'current_workout')
                    // Sort by date (newest first)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    // Take the 5 most recent workouts
                    .slice(0, 5)
                    .map(workout => {
                      return (
                        <TouchableOpacity 
                          key={workout.id} 
                          style={styles.workoutCard}
                          onPress={() => {
                            // Debug: log the actual date to see format
                            console.log('Workout date format:', workout.date);
                            console.log('Date object:', new Date(workout.date));
                            setSelectedWorkoutDetails(workout);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.cardIconContainer}>
                            <Dumbbell size={24} color={Colors.primary} />
                          </View>
                          <View style={styles.workoutCardContent}>
                            <Text style={styles.workoutName}>
                              {(() => {
                                // Ensure proper date formatting by checking for valid date
                                try {
                                  if (!workout.date) {
                                    return "Unknown Date";
                                  }
                                  
                                  // Create date object properly, handling timezone issues
                                  const dateObj = new Date(workout.date);
                                  
                                  // Check if date is valid
                                  if (isNaN(dateObj.getTime())) {
                                    return "Invalid Date";
                                  }
                                  
                                  // Format date in desired format
                                  return dateObj.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric'
                                  });
                                } catch (e) {
                                  console.error("Date formatting error:", e);
                                  return "Error formatting date";
                                }
                              })()}
                            </Text>
                            <View style={styles.workoutStats}>
                              <View style={styles.statPill}>
                                <Text style={styles.workoutStat}>
                                  {workout.exerciseCount || workout.exercises?.length || 0} exercises
                                </Text>
                              </View>
                              {workout.status && (
                                <View style={[
                                  styles.statusPill, 
                                  workout.status === 'completed' ? styles.completedStatusPill : styles.partialStatusPill
                                ]}>
                                  <Text style={styles.statusPillText}>
                                    {workout.status.toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  }
        </View>
      </ScrollView>
            </>
          )}
        </View>
        
        {profile.meal_history && profile.meal_history.length > 0 && (
          <>
            <Text style={styles.subsectionTitle}>Recent Daily Meals</Text>
            
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.recentMealsContainer}
            >
              <View style={{ flexDirection: 'row' }}>
                {(Array.from(
                  // Group meals by date and calculate daily totals
                  profile.meal_history.reduce((acc, meal) => {
                    // Extract just the date part
                    const dateKey = meal.date ? meal.date.split('T')[0] : 'Unknown';
                    
                    if (!acc.has(dateKey)) {
                      acc.set(dateKey, {
                        date: dateKey,
                        meals: [],
                        totalCalories: 0,
                        totalProtein: 0,
                        totalCarbs: 0,
                        totalFat: 0
                      });
                    }
                    
                    const dayData = acc.get(dateKey);
                    dayData.meals.push(meal);
                    dayData.totalCalories += (meal.calories || 0);
                    dayData.totalProtein += (meal.protein || 0);
                    dayData.totalCarbs += (meal.carbs || 0);
                    dayData.totalFat += (meal.fat || 0);
                    
                    return acc;
                  }, new Map<string, any>())
                ) as [string, any][])
                // Sort by date (newest first)
                .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                // Take the 5 most recent days
                .slice(0, 5)
                .map(([dateKey, dayData]) => {
                  // Format date for display
                  const formattedDate = new Date(dateKey).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                  
                  const mealCount = dayData.meals.length;
                  
                  return (
                    <TouchableOpacity 
                      key={dateKey} 
                      style={styles.mealCard}
                      onPress={() => {
                        // Create and show modal with all meals for this day
                        setSelectedDayMeals({
                          date: dateKey,
                          formattedDate,
                          meals: dayData.meals,
                          totalCalories: dayData.totalCalories,
                          totalProtein: dayData.totalProtein,
                          totalCarbs: dayData.totalCarbs,
                          totalFat: dayData.totalFat
                        });
                      }}
                    >
                      <View style={styles.cardIconContainer}>
                        <Utensils size={24} color={Colors.secondary} />
                      </View>
                      <View style={styles.mealCardContent}>
                        <Text style={styles.mealName}>{formattedDate}</Text>
                        <Text style={styles.mealDate}>
                          {mealCount} {mealCount === 1 ? 'meal' : 'meals'} logged
                        </Text>
                        
                        <View style={styles.mealNutritionInfo}>
                          <View style={styles.mealNutritionItem}>
                            <Text style={styles.mealNutritionValue}>{Math.round(dayData.totalCalories)}</Text>
                            <Text style={styles.mealNutritionLabel}>kcal</Text>
                          </View>
                          
                          <View style={styles.mealNutritionItem}>
                            <Text style={styles.mealNutritionValue}>{Math.round(dayData.totalProtein)}g</Text>
                            <Text style={styles.mealNutritionLabel}>protein</Text>
                          </View>
                          
                          {dayData.totalCarbs > 0 && (
                            <View style={styles.mealNutritionItem}>
                              <Text style={styles.mealNutritionValue}>{Math.round(dayData.totalCarbs)}g</Text>
                              <Text style={styles.mealNutritionLabel}>carbs</Text>
                            </View>
                          )}
                          
                          {dayData.totalFat > 0 && (
                            <View style={styles.mealNutritionItem}>
                              <Text style={styles.mealNutritionValue}>{Math.round(dayData.totalFat)}g</Text>
                              <Text style={styles.mealNutritionLabel}>fat</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}
        
        {/* Add workout details modal */}
        {selectedWorkoutDetails && (
          <Modal
            visible={!!selectedWorkoutDetails}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setSelectedWorkoutDetails(null)}
          >
            <SafeAreaView style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'flex-end',
            }}>
              <View style={{
                backgroundColor: Colors.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingTop: 20,
                paddingBottom: 30,
                height: '75%',
              }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  marginBottom: 15,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0, 0, 0, 0.05)',
                  paddingBottom: 12,
                }}>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: 'bold',
                    color: Colors.text,
                    flex: 1,
                    textAlign: 'center',
                  }}>{(() => {
                    // Ensure proper date formatting by checking for valid date
                    try {
                      if (!selectedWorkoutDetails.date) {
                        return "Workout Details";
                      }
                      
                      // Create date object properly, handling timezone issues
                      const dateObj = new Date(selectedWorkoutDetails.date);
                      
                      // Check if date is valid
                      if (isNaN(dateObj.getTime())) {
                        return "Workout Details";
                      }
                      
                      // Format date in desired format
                      return dateObj.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      });
                    } catch (e) {
                      console.error("Modal date formatting error:", e);
                      return "Workout Details";
                    }
                  })()}</Text>
                  <TouchableOpacity 
                    onPress={() => setSelectedWorkoutDetails(null)} 
                    style={{ 
                      padding: 8,
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      borderRadius: 20,
                      position: 'absolute',
                      right: 16,
                    }}
                  >
                    <X size={22} color={Colors.text} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={{ flex: 1 }}>
                  {/* Workout Summary Section */}
                  <View style={{
                    backgroundColor: Colors.background,
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                    marginHorizontal: 16,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: Colors.text,
                      marginBottom: 16,
                      textAlign: 'center',
                    }}>Workout Summary</Text>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 }}>
                      <View style={{ alignItems: 'center', width: '33%' }}>
                        <View style={{
                          backgroundColor: Colors.primary + '15',
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}>
                          <Dumbbell size={28} color={Colors.primary} />
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: 'bold', color: Colors.text, marginTop: 5 }}>
                          {selectedWorkoutDetails.exerciseCount || selectedWorkoutDetails.exercises?.length || 0}
                        </Text>
                        <Text style={{ color: Colors.lightText, fontSize: 14, textAlign: 'center' }}>Exercises</Text>
                      </View>
                      
                      <View style={{ alignItems: 'center', width: '33%' }}>
                        <View style={{
                          backgroundColor: Colors.primary + '15',
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}>
                          <Clock size={28} color={Colors.primary} />
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: 'bold', color: Colors.text, marginTop: 5 }}>
                          {selectedWorkoutDetails.duration 
                            ? Math.floor(selectedWorkoutDetails.duration / 60) 
                            : 0}
                        </Text>
                        <Text style={{ color: Colors.lightText, fontSize: 14, textAlign: 'center' }}>Minutes</Text>
                      </View>
                      
                      <View style={{ alignItems: 'center', width: '33%' }}>
                        <View style={{
                          backgroundColor: Colors.primary + '15',
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}>
                          <BarChart2 size={28} color={Colors.primary} />
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: 'bold', color: Colors.text, marginTop: 5 }}>
                          {selectedWorkoutDetails.totalSets || 0}
                        </Text>
                        <Text style={{ color: Colors.lightText, fontSize: 14, textAlign: 'center' }}>Sets</Text>
                      </View>
                    </View>
                    
                    {selectedWorkoutDetails.status && (
                      <View style={{ 
                        alignSelf: 'center',
                        backgroundColor: selectedWorkoutDetails.status === 'completed' ? '#4CAF50' : '#FF9800',
                        paddingHorizontal: 16,
                        paddingVertical: 6,
                        borderRadius: 20,
                        marginBottom: 12,
                      }}>
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                          {selectedWorkoutDetails.status === 'completed' 
                            ? 'COMPLETED' 
                            : 'PARTIAL'}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Muscle Groups */}
                  {selectedWorkoutDetails.muscleGroups && selectedWorkoutDetails.muscleGroups.length > 0 && (
                    <View style={{
                      backgroundColor: Colors.background,
                      borderRadius: 16,
                      padding: 20,
                      marginBottom: 16,
                      marginHorizontal: 16,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2,
                    }}>
                      <Text style={{
                        fontSize: 18,
                        fontWeight: 'bold',
                        color: Colors.text,
                        marginBottom: 16,
                        textAlign: 'center',
                      }}>Muscle Groups</Text>
                      
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {selectedWorkoutDetails.muscleGroups.map((group: string, index: number) => (
                          <View key={`muscle-${index}`} style={{
                            backgroundColor: '#e9f7f0',
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderRadius: 20,
                            marginRight: 8,
                            marginLeft: 8,
                            marginBottom: 12,
                          }}>
                            <Text style={{
                              color: Colors.primary,
                              fontWeight: '500',
                              textAlign: 'center',
                            }}>
                              {typeof group === 'string' 
                                ? group.charAt(0).toUpperCase() + group.slice(1) 
                                : group}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {/* Exercises List */}
                  {selectedWorkoutDetails.exercises && selectedWorkoutDetails.exercises.length > 0 && (
                    <View style={{
                      marginBottom: 24,
                      marginHorizontal: 16,
                    }}>
                      <Text style={{
                        fontSize: 18,
                        fontWeight: 'bold',
                        color: Colors.text,
                        marginBottom: 16,
                        textAlign: 'center',
                      }}>Exercises</Text>
                      
                      {selectedWorkoutDetails.exercises.map((exercise: any, index: number) => (
                        <View key={`exercise-${index}`} style={{
                          backgroundColor: Colors.background,
                          borderRadius: 16,
                          padding: 16,
                          marginBottom: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 1,
                          elevation: 1,
                        }}>
                          <View style={{
                            width: 46,
                            height: 46,
                            borderRadius: 23,
                            backgroundColor: Colors.primary + '20',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 16,
                          }}>
                            <Text style={{
                              fontWeight: 'bold',
                              color: Colors.primary,
                              fontSize: 16,
                            }}>{index + 1}</Text>
                          </View>
                          
                          <View style={{ flex: 1 }}>
                            <Text style={{
                              fontWeight: 'bold',
                              fontSize: 16,
                              marginBottom: 6,
                              color: Colors.text,
                            }}>{exercise.name}</Text>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Dumbbell size={14} color={Colors.primary} style={{ marginRight: 6 }} />
                                <Text style={{
                                  color: Colors.lightText,
                                  fontSize: 14,
                                }}>
                                  {exercise.sets || 3} sets × {exercise.reps || 12} reps
                                </Text>
                              </View>
                              
                              {exercise.completed && (
                                <View style={{
                                  backgroundColor: '#4CAF50',
                                  paddingHorizontal: 10,
                                  paddingVertical: 3,
                                  borderRadius: 12,
                                }}>
                                  <Text style={{
                                    color: 'white',
                                    fontSize: 12,
                                    fontWeight: 'bold',
                                  }}>DONE</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </View>
            </SafeAreaView>
          </Modal>
        )}
        
        {/* Add day meals modal */}
        {selectedDayMeals && (
          <Modal
            visible={!!selectedDayMeals}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setSelectedDayMeals(null)}
          >
            <SafeAreaView style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'flex-end',
            }}>
              <View style={{
                backgroundColor: Colors.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingTop: 20,
                paddingBottom: 30,
                height: '75%',
              }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  marginBottom: 15,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0, 0, 0, 0.05)',
                  paddingBottom: 12,
                }}>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: 'bold',
                    color: Colors.text,
                    flex: 1,
                    textAlign: 'center',
                  }}>{selectedDayMeals.formattedDate} Meals</Text>
                  <TouchableOpacity 
                    onPress={() => setSelectedDayMeals(null)} 
                    style={{ 
                      padding: 8,
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      borderRadius: 20,
                      position: 'absolute',
                      right: 16,
                    }}
                  >
                    <X size={22} color={Colors.text} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={{ flex: 1 }}>
                  {/* Daily Nutrition Summary */}
                  <View style={{
                    backgroundColor: Colors.background,
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                    marginHorizontal: 16,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: Colors.text,
                      marginBottom: 16,
                      textAlign: 'center',
                    }}>Nutrition Summary</Text>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 }}>
                      <View style={{ alignItems: 'center', width: '25%' }}>
                        <View style={{
                          backgroundColor: Colors.primary + '15',
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.primary }}>kcal</Text>
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 2 }}>
                          {Math.round(selectedDayMeals.totalCalories)}
                        </Text>
                        <Text style={{ color: Colors.lightText, fontSize: 13, textAlign: 'center' }}>Calories</Text>
                      </View>
                      
                      <View style={{ alignItems: 'center', width: '25%' }}>
                        <View style={{
                          backgroundColor: Colors.secondary + '15',
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.secondary }}>P</Text>
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 2 }}>
                          {Math.round(selectedDayMeals.totalProtein)}g
                        </Text>
                        <Text style={{ color: Colors.lightText, fontSize: 13, textAlign: 'center' }}>Protein</Text>
                      </View>
                      
                      <View style={{ alignItems: 'center', width: '25%' }}>
                        <View style={{
                          backgroundColor: '#f0ad4e' + '15',
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#f0ad4e' }}>C</Text>
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 2 }}>
                          {Math.round(selectedDayMeals.totalCarbs)}g
                        </Text>
                        <Text style={{ color: Colors.lightText, fontSize: 13, textAlign: 'center' }}>Carbs</Text>
                      </View>
                      
                      <View style={{ alignItems: 'center', width: '25%' }}>
                        <View style={{
                          backgroundColor: '#d9534f' + '15',
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#d9534f' }}>F</Text>
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 2 }}>
                          {Math.round(selectedDayMeals.totalFat)}g
                        </Text>
                        <Text style={{ color: Colors.lightText, fontSize: 13, textAlign: 'center' }}>Fat</Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Meals List */}
                  <View style={{
                    marginBottom: 24,
                    marginHorizontal: 16,
                  }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: Colors.text,
                      marginBottom: 16,
                      textAlign: 'center',
                    }}>{selectedDayMeals.meals.length} {selectedDayMeals.meals.length === 1 ? 'Meal' : 'Meals'}</Text>
                    
                    {selectedDayMeals.meals.map((meal: any, index: number) => (
                      <View key={`meal-${meal.id || index}`} style={{
                        backgroundColor: Colors.background,
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 12,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 1,
                        elevation: 1,
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: Colors.secondary + '20',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 16,
                          }}>
                            <Utensils size={20} color={Colors.secondary} />
                          </View>
                          
                          <View style={{ flex: 1 }}>
                            <Text style={{
                              fontWeight: 'bold',
                              fontSize: 16,
                              color: Colors.text,
                            }}>{meal.name}</Text>
                            
                            {meal.time && (
                              <Text style={{
                                color: Colors.lightText,
                                fontSize: 13,
                                marginTop: 2,
                              }}>
                                {new Date(meal.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </Text>
                            )}
                          </View>
                        </View>
                        
                        <View style={{ 
                          flexDirection: 'row', 
                          flexWrap: 'wrap', 
                          marginTop: 8,
                          marginLeft: 56
                        }}>
                          <View style={styles.mealDetailPill}>
                            <Text style={styles.mealDetailText}>{Math.round(meal.calories || 0)} kcal</Text>
                          </View>
                          
                          <View style={styles.mealDetailPill}>
                            <Text style={styles.mealDetailText}>{Math.round(meal.protein || 0)}g protein</Text>
                          </View>
                          
                          {meal.carbs > 0 && (
                            <View style={styles.mealDetailPill}>
                              <Text style={styles.mealDetailText}>{Math.round(meal.carbs)}g carbs</Text>
                            </View>
                          )}
                          
                          {meal.fat > 0 && (
                            <View style={styles.mealDetailPill}>
                              <Text style={styles.mealDetailText}>{Math.round(meal.fat)}g fat</Text>
                            </View>
                          )}
                          
                          {meal.servings && meal.servings > 0 && (
                            <View style={styles.mealDetailPill}>
                              <Text style={styles.mealDetailText}>{meal.servings} {meal.servings === 1 ? 'serving' : 'servings'}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </SafeAreaView>
          </Modal>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flex: 1,
  },
  innerContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
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
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  header: {
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 4,
  },
  recommendationCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recommendationTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    marginLeft: 8,
  },
  refreshButton: {
    padding: 4,
  },
  recommendationText: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
  },
  recommendationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  recommendationNoteText: {
    fontSize: 12,
    color: Colors.warning,
    marginLeft: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    width: "30%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  streakCard: {
    position: 'relative',
    paddingTop: 32,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  weightCard: {
    overflow: 'hidden',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingTop: 32,
    position: 'relative',
  },
  streakIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  activeStreakIcon: {
    backgroundColor: '#FF6B00',
  },
  warningStreakIcon: {
    backgroundColor: '#4095D1',
  },
  inactiveStreakIcon: {
    backgroundColor: Colors.lightText,
  },
  statValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.primary,
  },
  weightStatValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  streakValue: {
    color: "#FF6B00",  // Fiery orange color
  },
  warningValue: {
    color: "#4095D1",  // Ice blue color
  },
  streakEmoji: {
    fontSize: 20,
    marginLeft: 4,
  },
  warningText: {
    fontSize: 10,
    color: "#4095D1",
    marginTop: 4,
    fontWeight: "600",
    textAlign: "center",
  },
  statLabel: {
    fontSize: 14,
    color: Colors.lightText,
    textAlign: "center",
  },
  inactiveText: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
    fontWeight: "600",
    textAlign: "center",
  },
  weightValue: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  weightControls: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'center',
    width: '100%',
  },
  weightButton: {
    marginHorizontal: 8,
    padding: 4,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.card,
  },
  exportText: {
    marginLeft: 4,
    color: Colors.primary,
    fontWeight: "500",
    fontSize: 14,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.text,
    marginTop: 24,
    marginBottom: 12,
  },
  recentWorkoutsContainer: {
    marginHorizontal: -8,
  },
  workoutCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    width: 220,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginRight: 12,
  },
  workoutCardContent: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 4,
  },
  workoutDate: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 8,
  },
  workoutStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  workoutStat: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600",
  },
  recentMealsContainer: {
    marginHorizontal: -8,
  },
  mealCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    width: 260,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mealCardContent: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 4,
  },
  mealDate: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 8,
  },
  mealNutritionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mealNutritionItem: {
    alignItems: 'center',
    marginRight: 8,
  },
  mealNutritionValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  mealNutritionLabel: {
    fontSize: 10,
    color: Colors.lightText,
  },
  mealDetailPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  mealDetailText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  statPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
    minWidth: 80,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  rightAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginHorizontal: 8,
  },
  rightActionButton: {
    width: 80,
    height: '100%',
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
    minWidth: 80,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  completedStatusPill: {
    backgroundColor: '#4CAF50',
  },
  partialStatusPill: {
    backgroundColor: '#FF9800',
  },
  statusPillText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  weightIcon: {
    backgroundColor: Colors.primary,
  },
  recommendationHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandButton: {
    padding: 4,
    marginLeft: 8,
  },
  
  showMoreButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  
  showMoreButtonText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
});