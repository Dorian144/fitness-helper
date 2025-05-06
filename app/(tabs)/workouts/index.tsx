import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  Animated,
  Platform,
  SafeAreaView,
  RefreshControl,
  StatusBar
} from "react-native";
import { useWorkoutStore } from "@/store/workoutStore";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";
import Button from "@/components/Button";
import Colors from "@/constants/colors";
import { 
  Filter, 
  X, 
  Search, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  ChevronDown, 
  Trash2, 
  Clock, 
  Dumbbell, 
  Calendar, 
  ChevronRight,
  BarChart3,
  History,
  List,
  Plus,
  BookOpen,
  BarChart2
} from "lucide-react-native";
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchExercises, getExerciseById, getBodyParts, getTargetMuscles, getEquipment, getAllExercisesAtOnce } from '@/services/exerciseApi';
import { doc, updateDoc, getDoc, deleteDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/services/firebase";
import { Swipeable, RectButton, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
// Import the Audio module from expo-av
import { Audio } from 'expo-av';
import Toast from 'react-native-toast-message';
// First, import debounce from lodash at the top of the file
import { debounce } from 'lodash';
// Update this import to use the original styles file with the correct path
import { styles } from "@/services/styles/workout_styles";
import { Exercise } from "@/services/exerciseApi";
import { Link } from 'expo-router';

// Define color variables for styling
const primaryLight = '#d4ede2'; // Light variant of the primary green color
const secondaryLight = '#fff2dd'; // Light variant of the secondary orange color

// Component for displaying exercise cards with proper type annotations
interface ExerciseCardProps {
  exercise: any; // Use any to avoid type conflicts
  onPress: (exercise: any) => void;
}

// Component for displaying exercise cards
const ExerciseCard = ({ exercise, onPress }: ExerciseCardProps) => (
  <TouchableOpacity 
    style={styles.exerciseCard}
    onPress={() => onPress(exercise)}
    activeOpacity={0.7}
  >
    {/* Support both gifUrl and imageUrl for backward compatibility */}
    {(exercise.gifUrl || exercise.imageUrl) ? (
      <Image 
        source={{ uri: exercise.gifUrl || exercise.imageUrl }} 
        style={styles.exerciseImage}
        resizeMode="cover"
      />
    ) : (
      <View style={[styles.exerciseImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
        <Text>No Image</Text>
      </View>
    )}
    <View style={styles.exerciseInfo}>
      <Text style={styles.exerciseName}>
        {exercise.name}
      </Text>
      
      <View style={styles.exerciseTags}>
        {exercise.bodyPart && (
          <Text style={styles.exerciseCategory}>
            {typeof exercise.bodyPart === 'string' 
              ? exercise.bodyPart.charAt(0).toUpperCase() + exercise.bodyPart.slice(1) 
              : exercise.bodyPart}
          </Text>
        )}
        
        {exercise.equipment && exercise.equipment !== 'body weight' && exercise.equipment !== 'none' && (
          <Text style={styles.equipmentTag}>
            {typeof exercise.equipment === 'string'
              ? exercise.equipment.charAt(0).toUpperCase() + exercise.equipment.slice(1)
              : 'Unknown equipment'}
          </Text>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

// Define consistent delete action styles
const deleteActionStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
    marginTop: 4,
    fontSize: 12,
  }
});

export default function WorkoutsScreen() {
  // Store hooks must be at the top level and in the same order every render
  const { 
    exercises, 
    filteredExercises, 
    selectedExercises,
    muscleGroups,
    isLoading, 
    error,
    fetchExercises,
    fetchExercisesByPage,
    fetchMuscleGroups,
    filterExercises,
    filterExercisesByMuscle,
    addToWorkout,
    removeFromWorkout,
    clearWorkout
  } = useWorkoutStore();
  
  const { user } = useAuthStore();
  const { profile, addWorkout: userAddWorkout, removeWorkout: userRemoveWorkout } = useUserStore();
  
  // UI state - all useState hooks consistently called in the same order
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"browse" | "workout" | "history">("browse");
  const [selectedExerciseDetails, setSelectedExerciseDetails] = useState<any>(null);
  const [selectedWorkoutDetails, setSelectedWorkoutDetails] = useState<any>(null);
  const [activeMuscleId, setActiveMuscleId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [completedExercises, setCompletedExercises] = useState<(string | number)[]>([]);
  
  // All refs should be at this level
  const swipeableRef = useRef<Swipeable | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Animation refs
  const swipeHintAnimation = useRef(new Animated.Value(0)).current;
  
  // Sound references
  const soundsRef = useRef<{
    timerComplete: Audio.Sound | null;
    timerWarning: Audio.Sound | null;
    restComplete: Audio.Sound | null;
  }>({
    timerComplete: null,
    timerWarning: null,
    restComplete: null
  });
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreExercises, setHasMoreExercises] = useState(true);
  const PAGE_SIZE = 50; // Changed from 20 to 50 to see more exercises at once
  
  // Timer related states
  const [activeExercise, setActiveExercise] = useState<any>(null);
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [timerState, setTimerState] = useState<'work' | 'rest'>('work');
  const [currentSet, setCurrentSet] = useState(1);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  // Near the top with other state declarations
  const [isSearching, setIsSearching] = useState(false);
  // Add a flag to prevent multiple onEndReached calls
  const [isLoadingEndReached, setIsLoadingEndReached] = useState(false);
  // State for custom exercise modal
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseBodyPart, setNewExerciseBodyPart] = useState('');
  const [newExerciseSets, setNewExerciseSets] = useState('3');
  const [newExerciseReps, setNewExerciseReps] = useState('12');
  const [newExerciseRest, setNewExerciseRest] = useState('60');
  // State for equipment filter
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<{
    category: string | null, 
    equipment: string | null
  }>({
    category: null,
    equipment: null
  });
  // Add exercise form state
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Initialization effects
  useEffect(() => {
    // Load exercises when component mounts
    if (!exercises || exercises.length === 0) {
      fetchExercises(1, PAGE_SIZE);
    }
    
    // Load muscle groups for filtering
    if (!muscleGroups || muscleGroups.length === 0) {
      fetchMuscleGroups();
    }
    
    // Load sound effects for timer
    const loadSounds = async () => {
      try {
        // Load complete sound
        const { sound: completeSound } = await Audio.Sound.createAsync(
          require('@/assets/sounds/timer-complete.mp3')
        );
        soundsRef.current.timerComplete = completeSound;
        
        // Load warning sound
        const { sound: warningSound } = await Audio.Sound.createAsync(
          require('@/assets/sounds/timer-warning.mp3')
        );
        soundsRef.current.timerWarning = warningSound;
        
        // Load rest complete sound
        const { sound: restSound } = await Audio.Sound.createAsync(
          require('@/assets/sounds/rest-complete.mp3')
        );
        soundsRef.current.restComplete = restSound;
      } catch (error) {
        console.error('Error loading sounds:', error);
      }
    };
    
    loadSounds();
    
    // Clean up sounds on unmount
    return () => {
      if (soundsRef.current.timerComplete) {
        soundsRef.current.timerComplete.unloadAsync();
      }
      if (soundsRef.current.timerWarning) {
        soundsRef.current.timerWarning.unloadAsync();
      }
      if (soundsRef.current.restComplete) {
        soundsRef.current.restComplete.unloadAsync();
      }
    };
  }, [fetchExercises, fetchMuscleGroups]);
  
  // Timer effect
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining(prevTime => {
          // Play warning sound when 3 seconds remain
          if (prevTime === 3 && soundsRef.current.timerWarning) {
            try {
              soundsRef.current.timerWarning.playAsync();
            } catch (error) {
              console.error('Error playing warning sound:', error);
            }
          }
          
          if (prevTime <= 1) {
            // Time is up
            clearInterval(timerIntervalRef.current!);
            
            // Timer completed, determine what to do next
            if (timerState === 'work') {
              // Work phase completed, switch to rest
              setTimerState('rest');
              
              // Play rest sound
              if (soundsRef.current.timerComplete) {
                try {
                  soundsRef.current.timerComplete.playAsync();
                } catch (error) {
                  console.error('Error playing complete sound:', error);
                }
              }
              
              // Set rest time
              if (activeExercise) {
                return activeExercise.rest || 60;
              }
              return 60;
            } else {
              // Rest phase completed
              // Play rest complete sound
              if (soundsRef.current.restComplete) {
                try {
                  soundsRef.current.restComplete.playAsync();
                } catch (error) {
                  console.error('Error playing rest complete sound:', error);
                }
              }
              
              // Check if there are more sets to go
              if (currentSet < (activeExercise?.sets || 3)) {
                // More sets to go, increase current set
                setCurrentSet(prev => prev + 1);
                
                // Switch back to work phase
                setTimerState('work');
                
                // Set work time
                if (activeExercise) {
                  return activeExercise.duration || 
                    (activeExercise.reps ? Math.round(activeExercise.reps * 2.5) : 30);
                }
                return 30;
              } else {
                // All sets completed
                setTimerRunning(false);
                
                // Simply mark the timer as complete, don't call handleExerciseComplete from here
                // This avoids the circular dependency
                if (activeExercise) {
                  // Add the exercise to completed exercises
                  setCompletedExercises(prev => {
                    if (!prev.includes(activeExercise.id)) {
                      return [...prev, activeExercise.id];
                    }
                    return prev;
                  });
                }
                
                return 0;
              }
            }
          }
          
          return prevTime - 1;
        });
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    // Clean up interval on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerRunning, timerState, activeExercise, currentSet, setTimerState, setCurrentSet, setTimerRunning, setCompletedExercises]);

  // Load saved workout from local storage when component mounts
  useEffect(() => {
    const loadSavedWorkout = async () => {
      try {
        const savedWorkoutJson = await AsyncStorage.getItem('currentWorkout');
        if (savedWorkoutJson) {
          const savedWorkout = JSON.parse(savedWorkoutJson);
          
          // Only load if there are no exercises already in the workout
          if (selectedExercises.length === 0 && Array.isArray(savedWorkout) && savedWorkout.length > 0) {
            // Clear first to avoid duplicates
            clearWorkout();
            
            // Add each exercise
            savedWorkout.forEach(exercise => {
              addToWorkout(exercise);
            });
            
            // Show notification
            Toast.show({
              type: 'info',
              text1: 'Workout Restored',
              text2: `Loaded ${savedWorkout.length} exercises from your last session`,
              position: 'bottom',
            });
          }
        }
      } catch (error) {
        console.error('Error loading saved workout:', error);
      }
    };
    
    loadSavedWorkout();
  }, []);
  
  // Save workout to local storage whenever it changes
  useEffect(() => {
    if (selectedExercises.length > 0) {
      try {
        AsyncStorage.setItem('currentWorkout', JSON.stringify(selectedExercises));
      } catch (error) {
        console.error('Error saving workout:', error);
      }
    }
  }, [selectedExercises]);

  // Group workouts by date - since it's expensive, memoize the calculation
  const workoutsByDate = useMemo(() => {
    if (!profile || !profile.workout_history) return {};
    
    return profile.workout_history
      .filter(workout => workout && workout.id && workout.id !== 'current_workout') // Filter out current workouts and invalid entries
      .reduce((groups: {[key: string]: any[]}, workout) => {
        // Skip if workout date is missing
        if (!workout.date) return groups;
        
        try {
          // Create a date object and validate it
          const workoutDate = new Date(workout.date);
          if (isNaN(workoutDate.getTime())) return groups;
          
          // Format date as YYYY-MM-DD for grouping
          const dateStr = workoutDate.toISOString().split('T')[0];
          
          if (!groups[dateStr]) {
            groups[dateStr] = [];
          }
          
          // Add workout to its date group
          groups[dateStr].push(workout);
        } catch (error) {
          console.error("Error processing workout date:", error);
        }
        
        return groups;
      }, {});
  }, [profile?.workout_history]);

  // Format for display - convert to array of objects with date and workouts
  const groupedData = useMemo(() => {
    return Object.keys(workoutsByDate)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // Sort dates newest first
      .map(date => {
        const dateObj = new Date(date);
        return {
          date,
          displayDate: dateObj.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          }),
          workouts: workoutsByDate[date]
        };
      });
  }, [workoutsByDate]);
  
  // ===== Define all callbacks and memoized values AFTER all state ====
  
  // Define helper function to ensure exercise data is consistent
  const normalizeExerciseData = useCallback((exercise: any) => {
    return {
      id: exercise.id?.toString() || `exercise_${Date.now()}`,
      name: exercise.name || 'Unknown Exercise',
      bodyPart: exercise.bodyPart || exercise.category || '',
      equipment: exercise.equipment || '',
      target: exercise.target || '',
      gifUrl: exercise.gifUrl || exercise.imageUrl || '',
      secondaryMuscles: Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles : [],
      instructions: Array.isArray(exercise.instructions) ? exercise.instructions : 
        exercise.description ? [exercise.description] : [],
      // App-specific fields with defaults
      sets: typeof exercise.sets === 'number' ? exercise.sets : 3,
      reps: typeof exercise.reps === 'number' ? exercise.reps : 12,
      rest: typeof exercise.rest === 'number' ? exercise.rest : 60,
      weight: typeof exercise.weight === 'number' ? exercise.weight : 0,
      duration: typeof exercise.duration === 'number' ? exercise.duration : 0,
      // Ensure compatibility fields are present
      category: exercise.category || exercise.bodyPart || '',
      imageUrl: exercise.imageUrl || exercise.gifUrl || '',
      // Add metadata for tracking
      addedAt: new Date().toISOString()
    };
  }, []);

  // Complete workout handler - must be defined in this order
  const handleCompleteWorkout = useCallback(() => {
    // Only proceed if there are exercises in the workout
    if (selectedExercises.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'No exercises to complete',
        text2: 'Add some exercises to your workout first',
        position: 'bottom',
      });
      return;
    }
    
    // Move all processing inside the main function body
    if (user && profile) {
      try {
        // Create formatted date for the workout name
        const now = new Date();
        const formattedTime = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Prepare workout data with all exercise information preserved
        const completedWorkout = {
          id: `workout_${Date.now()}`,
          date: now.toISOString(),
          name: `Workout ${formattedTime}`,
          exercises: selectedExercises.map(exercise => ({
            ...normalizeExerciseData(exercise), // Ensure data consistency
            completed: completedExercises.includes(exercise.id),
            completedAt: new Date().toISOString()
          })),
          // Add metadata for tracking and analysis
          exerciseCount: selectedExercises.length,
          completedExercisesCount: completedExercises.length,
          muscleGroups: Array.from(new Set(selectedExercises.map(ex => ex.bodyPart || ex.category || '').filter(Boolean))),
          duration: selectedExercises.reduce((total, ex) => {
            // Calculate approximate duration based on sets, reps, and rest time
            const setTime = (ex.duration || (ex.reps ? Math.round(ex.reps * 2.5) : 30));
            const restTime = (ex.rest || 60);
            return total + ((ex.sets || 3) * (setTime + restTime));
          }, 0),
          totalSets: selectedExercises.reduce((total, ex) => total + (ex.sets || 3), 0),
          totalReps: selectedExercises.reduce((total, ex) => total + ((ex.sets || 3) * (ex.reps || 12)), 0),
          status: completedExercises.length === selectedExercises.length ? 'completed' : 'partial',
          notes: '', // Could be added in the future
        };
        
        // Add the workout to the user's history
        userAddWorkout(user.uid, completedWorkout);
        
        // Show success message
        Toast.show({
          type: 'success',
          text1: 'Workout completed',
          text2: 'Your workout has been saved to your history',
          position: 'bottom',
        });
        
        // Clear the current workout
        clearWorkout();
        setCompletedExercises([]);
        
        // Navigate to history tab
        setActiveTab('history');
      } catch (error) {
        console.error('Error saving workout:', error);
        Toast.show({
          type: 'error',
          text1: 'Error saving workout',
          text2: 'Please try again',
          position: 'bottom',
        });
      }
    } else {
      // Handle case where user is not authenticated
      Toast.show({
        type: 'info',
        text1: 'Sign in required',
        text2: 'Please sign in to save your workout',
        position: 'bottom',
      });
    }
  }, [
    user, 
    profile, 
    selectedExercises, 
    completedExercises, 
    normalizeExerciseData,
    userAddWorkout,
    clearWorkout,
    setCompletedExercises,
    setActiveTab
  ]);

// Function to sync the workout with Firebase
const syncWorkoutWithFirebase = useCallback(async (exercises: any[]) => {
  if (!user) return;
  
  try {
    // Format the workout data, ensuring all fields are valid
    const validExercises = exercises
      .filter(ex => ex && typeof ex === 'object') // Filter out any invalid exercises
      .map(normalizeExerciseData); // Use our helper function
    
    // Get unique muscle groups, filtering out any undefined or empty values
    const muscleGroupsArr: string[] = [];
    validExercises.forEach(ex => {
      const group = ex.bodyPart || ex.category || '';
      if (group && !muscleGroupsArr.includes(group)) {
        muscleGroupsArr.push(group);
      }
    });
    
    // Only proceed if there are valid exercises
    if (validExercises.length > 0) {
      const currentWorkout = {
        id: 'current_workout',
        date: new Date().toISOString(),
        name: `Current Workout`,
        exercises: validExercises,
        // Add some metadata
        exerciseCount: validExercises.length,
        lastUpdated: new Date().toISOString(),
        muscleGroups: muscleGroupsArr,
        totalSets: validExercises.reduce((sum, ex) => sum + (ex.sets || 0), 0),
        estimatedDuration: validExercises.reduce((sum, ex) => {
          // Calculate estimated duration based on sets, reps and rest time
          const setTime = (ex.duration || (ex.reps ? Math.round(ex.reps * 2.5) : 30));
          const restTime = (ex.rest || 60);
          const totalTime = (ex.sets || 3) * (setTime + restTime);
          return sum + totalTime;
        }, 0)
      };
      
      // First, check if a 'current_workout' already exists and delete it if needed
      try {
        const workoutRef = doc(db, `users/${user.uid}/workout_history/current_workout`);
        await deleteDoc(workoutRef);
      } catch (error) {
        // Ignore errors here - the document might not exist
        console.log("No current workout to delete or error deleting:", error);
      }
      
      // Now save the current workout to the subcollection
      const workoutRef = doc(db, `users/${user.uid}/workout_history/current_workout`);
      await setDoc(workoutRef, currentWorkout);
      
      // Update the user document's lastUpdated field
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        lastUpdated: new Date().toISOString()
      });
      
      console.log("Successfully synced workout with Firebase");
    }
  } catch (error) {
    console.error("Error syncing workout with Firebase:", error);
    // Don't show an error to the user - this is a background sync
  }
}, [user, normalizeExerciseData]);

  // Handle removing an exercise from workout
  const handleRemoveFromWorkout = useCallback((exerciseId: string | number) => {
    // Make sure exerciseId is valid
    if (exerciseId === undefined || exerciseId === null) {
      console.error("Invalid exercise ID for removal:", exerciseId);
      return;
    }
    
    // Show confirmation dialog
    Alert.alert(
      "Remove Exercise", 
      "Are you sure you want to remove this exercise from your workout?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            // Close the swipeable
            if (swipeableRef.current) {
              swipeableRef.current.close();
            }
          }
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            // Remove the exercise
            const updatedExercises = selectedExercises.filter(ex => ex.id !== exerciseId);
            
            // Wrapper for modifying selected exercises
            // Clear workout first
            clearWorkout();
            
            // Then add all the exercises
            updatedExercises.forEach(exercise => {
              addToWorkout(exercise);
            });
            
            // Remove from completed exercises if it was marked as completed
            setCompletedExercises(prev => prev.filter(id => id !== exerciseId));
            
            // Sync with Firebase
            syncWorkoutWithFirebase(updatedExercises);
            
            // Haptic feedback
            if (Platform.OS !== "web") {
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (error) {
                console.error("Haptics error:", error);
              }
            }
          }
        }
      ]
    );
  }, [clearWorkout, addToWorkout, selectedExercises, setCompletedExercises, syncWorkoutWithFirebase]);

// Function to show exercise details
const showExerciseDetails = useCallback(async (exercise: any) => {
  try {
    console.log("Showing exercise details for:", exercise.name);
    
    // Set the selected exercise immediately for better UX
    setSelectedExerciseDetails(exercise);
    
    // No need for additional fetch if we already have all the data
    if (exercise.id && exercise.gifUrl && exercise.instructions) {
      console.log("Exercise already has complete data");
    } else if (exercise.id) {
      console.log("Fetching additional details for exercise ID:", exercise.id);
      // Try to get more details if we don't have them
      const details = await getExerciseById(exercise.id.toString());
      if (details) {
        console.log("Details fetched successfully");
        setSelectedExerciseDetails((prev: Exercise) => ({...prev, ...details}));
      }
    }
  } catch (error) {
    console.error('Error loading exercise details:', error);
    // Keep showing what we have rather than showing an error
  }
}, [setSelectedExerciseDetails]);

// Function to close exercise details
const closeExerciseDetails = useCallback(() => {
  setSelectedExerciseDetails(null);
}, [setSelectedExerciseDetails]);

// Start, pause, reset timer functions
const startTimer = useCallback(() => {
  setTimerRunning(true);
}, [setTimerRunning]);

const pauseTimer = useCallback(() => {
  setTimerRunning(false);
}, [setTimerRunning]);

const resetTimer = useCallback(() => {
  setTimerRunning(false);
  if (timerState === 'work' && activeExercise) {
    const workTime = activeExercise.duration || 
      (activeExercise.reps ? Math.round(activeExercise.reps * 2.5) : 30);
    setTimeRemaining(workTime);
  } else if (activeExercise) {
    setTimeRemaining(activeExercise.rest || 60);
  }
}, [timerState, activeExercise, setTimerRunning, setTimeRemaining]);

const skipToRest = useCallback(() => {
  setTimerState('rest');
  if (activeExercise) {
    setTimeRemaining(activeExercise.rest || 60);
  }
  setTimerRunning(true);
}, [activeExercise, setTimerState, setTimeRemaining, setTimerRunning]);

const skipToNextSet = useCallback(() => {
  // Only works during rest phase
  if (timerState !== 'rest') return;
  
  // Check if there are more sets to go
  if (currentSet < (activeExercise?.sets || 3)) {
    // Increment set
    setCurrentSet(prev => prev + 1);
    
    // Switch back to work phase
    setTimerState('work');
    
    // Reset timer to work duration
    if (activeExercise) {
      setTimeRemaining(activeExercise.duration || 
        (activeExercise.reps ? Math.round(activeExercise.reps * 2.5) : 30));
    }
    
    // Keep timer running
    setTimerRunning(true);
  }
}, [timerState, currentSet, activeExercise, setCurrentSet, setTimerState, setTimeRemaining, setTimerRunning]);

// Format time helper
const formatTime = useCallback((seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' + secs : secs}`;
}, []);

// Handle exercise complete
const handleExerciseComplete = useCallback((exerciseId?: string | number) => {
  // Mark exercise as completed
  if (!exerciseId && !activeExercise) return;
  
  // If exerciseId is provided, use it, otherwise use activeExercise.id
  const idToComplete = exerciseId !== undefined ? exerciseId : activeExercise?.id;
  
  if (!idToComplete) return;
  
  // Check if this exercise is already marked as completed
  const alreadyCompleted = completedExercises.includes(idToComplete);
  
  if (!alreadyCompleted) {
    setCompletedExercises(prev => [...prev, idToComplete]);
    
    // Play completion sound
    if (soundsRef.current.timerComplete) {
      try {
        soundsRef.current.timerComplete.playAsync();
      } catch (error) {
        console.error('Error playing complete sound:', error);
      }
    }
    
    // Only show the alert if we're in the timer modal (activeExercise is set)
    if (activeExercise && activeExercise.id === idToComplete) {
      Alert.alert(
        "Exercise Completed!",
        `Great job! You've completed all ${currentSet} sets of ${activeExercise.name}.`,
        [
          {
            text: "OK",
            onPress: () => {
              setTimerModalVisible(false);
              setTimerRunning(false);
              setTimerState('work');
              setCurrentSet(1);
            },
          }
        ]
      );
    } else {
      // Just provide a small haptic feedback if we're not in the timer
      if (Platform.OS !== "web") {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.error("Haptics error:", error);
        }
      }
    }
  }
}, [activeExercise, completedExercises, currentSet, setCompletedExercises, setTimerModalVisible, setTimerRunning, setTimerState, setCurrentSet]);

// Function for the timer modal
const renderTimerModal = useCallback(() => {
  if (!activeExercise) return null;
  
  const formattedTime = formatTime(timeRemaining);
  const isWorkPhase = timerState === 'work';
  const currentExerciseSets = activeExercise.sets || 3;
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={timerModalVisible}
      onRequestClose={() => {
        pauseTimer();
        setTimerModalVisible(false);
      }}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
      }}>
        <SafeAreaView style={{
          width: '100%',
          backgroundColor: Colors.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
            }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 16,
            marginVertical: 15,
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
                }} numberOfLines={1}>
                  {activeExercise.name}
                </Text>
                <TouchableOpacity 
              style={{ 
                padding: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                borderRadius: 20,
                position: 'absolute',
                right: 16,
              }}
                  onPress={() => {
                    pauseTimer();
                    setTimerModalVisible(false);
                  }}
                >
              <X size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>
              
          <View style={{
            alignItems: 'center',
            padding: 24,
            marginBottom: 20,
          }}>
            {/* Phase indicator */}
            <View style={{
              backgroundColor: isWorkPhase ? Colors.primary + '15' : '#FFC107' + '15',
              paddingVertical: 8,
              paddingHorizontal: 24,
              borderRadius: 24,
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: isWorkPhase ? Colors.primary : '#FFC107',
              }}>
                {isWorkPhase ? 'EXERCISE' : 'REST'}
                </Text>
            </View>
            
            {/* Timer display */}
            <View style={{
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: isWorkPhase ? Colors.primary + '15' : '#FFC107' + '15',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
              borderWidth: 2,
              borderColor: isWorkPhase ? Colors.primary + '30' : '#FFC107' + '30',
            }}>
              <Text style={{
                fontSize: 64,
                fontWeight: 'bold',
                color: isWorkPhase ? Colors.primary : '#FFC107',
              }}>{formattedTime}</Text>
            </View>
            
            {/* Set indicator */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 32,
            }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: Colors.text,
              }}>
                Set {currentSet} of {currentExerciseSets}
              </Text>
            </View>
            
            {/* Control buttons */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              alignItems: 'center',
              width: '80%',
              marginTop: 8,
              marginBottom: 20,
            }}>
              <TouchableOpacity
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={resetTimer}
              >
                <RotateCcw size={28} color={Colors.text} />
                  </TouchableOpacity>
                  
              <TouchableOpacity
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: timerRunning ? '#ff4d4f' + '15' : Colors.primary + '15',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: timerRunning ? '#ff4d4f' : Colors.primary,
                }}
                onPress={timerRunning ? pauseTimer : startTimer}
              >
                    {timerRunning ? (
                  <Pause size={36} color="#ff4d4f" />
                    ) : (
                  <Play size={36} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                  
              <TouchableOpacity
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={isWorkPhase ? skipToRest : skipToNextSet}
              >
                <ChevronDown size={28} color={Colors.text} />
                  </TouchableOpacity>
              </View>
              
            {/* Mark complete button */}
              <TouchableOpacity 
                style={{
                backgroundColor: '#4CAF50',
                  paddingVertical: 16,
                paddingHorizontal: 24,
                borderRadius: 16,
                  alignItems: 'center',
                width: '80%',
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 2,
                marginTop: 8,
                }}
                onPress={() => {
                  pauseTimer();
                  setTimerModalVisible(false);
                  handleExerciseComplete(activeExercise.id);
                }}
              >
                <Text style={{
                  color: 'white',
                  fontWeight: 'bold',
                fontSize: 18,
                }}>Mark Complete</Text>
              </TouchableOpacity>
            </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}, [activeExercise, timeRemaining, timerState, currentSet, timerModalVisible, timerRunning, formatTime, pauseTimer, startTimer, resetTimer, skipToRest, skipToNextSet, handleExerciseComplete]);

// Function for the exercise details modal
const renderExerciseDetailsModal = useCallback(() => {
  if (!selectedExerciseDetails) return null;
  
  // Check if this exercise is already in the workout
  const isExerciseInWorkout = selectedExercises.some(ex => ex.id === selectedExerciseDetails.id);
    
    // Format instructions if available
    const instructions = selectedExerciseDetails.instructions || [];
    const hasInstructions = Array.isArray(instructions) && instructions.length > 0;
    
    // Get secondary muscles if available
    const secondaryMuscles = selectedExerciseDetails.secondaryMuscles || [];
    const hasSecondaryMuscles = Array.isArray(secondaryMuscles) && secondaryMuscles.length > 0;
  
  return (
    <Modal
      visible={!!selectedExerciseDetails}
      animationType="slide"
      transparent={true}
      onRequestClose={closeExerciseDetails}
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
          height: '85%',
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            marginBottom: 15,
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: Colors.text,
              flex: 1,
            }}>{selectedExerciseDetails.name}</Text>
            <TouchableOpacity 
              onPress={closeExerciseDetails} 
              style={{ padding: 5 }}
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={{ flex: 1 }}>
              {/* Improved exercise details content */}
              
              {/* GIF/Image */}
              {(selectedExerciseDetails.gifUrl || selectedExerciseDetails.imageUrl) && (
                <View style={{
                  alignItems: 'center',
                  padding: 16,
                  backgroundColor: '#f7f7f7',
                  marginBottom: 16,
                }}>
                  <Image 
                    source={{ uri: selectedExerciseDetails.gifUrl || selectedExerciseDetails.imageUrl }} 
                    style={{
                      width: 200,
                      height: 200,
                      borderRadius: 8,
                      backgroundColor: '#f0f0f0',
                      overflow: 'hidden',
                    }}
                    resizeMode="cover"
                  />
                </View>
              )}
              
              <View style={{ padding: 16 }}>
                {/* Exercise Info Section */}
                <View style={{
                  backgroundColor: Colors.background,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: Colors.text,
                    marginBottom: 12,
                  }}>Exercise Information</Text>
                  
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    marginBottom: 4,
                  }}>
                    <Text style={{
                      fontWeight: 'bold',
                      color: Colors.text,
                      width: 100,
                    }}>Body Part:</Text>
                    <Text style={{
                      color: Colors.text,
                      flex: 1,
                    }}>
                      {selectedExerciseDetails.bodyPart ? 
                        selectedExerciseDetails.bodyPart.charAt(0).toUpperCase() + selectedExerciseDetails.bodyPart.slice(1) : 
                        'N/A'}
              </Text>
                  </View>
                  
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    marginBottom: 4,
                  }}>
                    <Text style={{
                      fontWeight: 'bold',
                      color: Colors.text,
                      width: 100,
                    }}>Target:</Text>
                    <Text style={{
                      color: Colors.text,
                      flex: 1,
                    }}>
                      {selectedExerciseDetails.target ? 
                        selectedExerciseDetails.target.charAt(0).toUpperCase() + selectedExerciseDetails.target.slice(1) : 
                        'N/A'}
                </Text>
                  </View>
                  
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    marginBottom: 4,
                  }}>
                    <Text style={{
                      fontWeight: 'bold',
                      color: Colors.text,
                      width: 100,
                    }}>Equipment:</Text>
                    <Text style={{
                      color: Colors.text,
                      flex: 1,
                    }}>
                      {selectedExerciseDetails.equipment ? 
                        selectedExerciseDetails.equipment.charAt(0).toUpperCase() + selectedExerciseDetails.equipment.slice(1) : 
                        'N/A'}
                </Text>
                  </View>
                  
                  {hasSecondaryMuscles && (
                    <View style={{
                      marginTop: 4,
                    }}>
                      <Text style={{
                        fontWeight: 'bold',
                        color: Colors.text,
                        marginBottom: 4,
                      }}>Secondary Muscles:</Text>
                      
                      <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                      }}>
                        {secondaryMuscles.map((muscle, index) => (
                          <View key={`muscle-${index}`} style={{
                            backgroundColor: '#e9f7f0',
                            paddingVertical: 4,
                            paddingHorizontal: 8,
                            borderRadius: 12,
                            marginRight: 6,
                            marginBottom: 6,
                          }}>
                            <Text style={{
                              color: Colors.primary,
                              fontSize: 12,
                            }}>
                              {typeof muscle === 'string' ? 
                                muscle.charAt(0).toUpperCase() + muscle.slice(1) : 
                                muscle}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
                
                {/* Instructions Section */}
                {hasInstructions && (
                  <View style={{
                    backgroundColor: Colors.background,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: Colors.text,
                      marginBottom: 12,
                    }}>Instructions</Text>
                    
                    {instructions.map((instruction, index) => (
                      <View key={`instruction-${index}`} style={{
                        flexDirection: 'row',
                        marginBottom: 10,
                      }}>
                        <Text style={{
                          color: Colors.primary,
                          fontWeight: 'bold',
                          marginRight: 8,
                        }}>{index + 1}.</Text>
                        <Text style={{
                          color: Colors.text,
                          flex: 1,
                          lineHeight: 20,
                        }}>{instruction}</Text>
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Training Settings (if exercise is in workout) */}
                {isExerciseInWorkout && (
                  <View style={{
                    backgroundColor: Colors.background,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: Colors.text,
                      marginBottom: 12,
                    }}>Training Settings</Text>
                    
                    <View style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      marginBottom: 4,
                    }}>
                      <Text style={{
                        fontWeight: 'bold',
                        color: Colors.text,
                        width: 100,
                      }}>Sets:</Text>
                      <Text style={{
                        color: Colors.text,
                        flex: 1,
                      }}>
                        {selectedExerciseDetails.sets || 3}
                </Text>
                    </View>
                    
                    <View style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      marginBottom: 4,
                    }}>
                      <Text style={{
                        fontWeight: 'bold',
                        color: Colors.text,
                        width: 100,
                      }}>Reps:</Text>
                      <Text style={{
                        color: Colors.text,
                        flex: 1,
                      }}>
                        {selectedExerciseDetails.reps || 12}
                      </Text>
                    </View>
                    
                    <View style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      marginBottom: 4,
                    }}>
                      <Text style={{
                        fontWeight: 'bold',
                        color: Colors.text,
                        width: 100,
                      }}>Rest:</Text>
                      <Text style={{
                        color: Colors.text,
                        flex: 1,
                      }}>
                        {selectedExerciseDetails.rest || 60} seconds
                      </Text>
                    </View>
                  </View>
              )}
            </View>
          </ScrollView>
          
          {isExerciseInWorkout ? (
            // If exercise is already in workout, show start and remove options
            <View style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              justifyContent: 'space-between',
            }}>
              <TouchableOpacity 
                style={{
                  backgroundColor: Colors.primary,
                  paddingVertical: 16,
                  marginTop: 16,
                  borderRadius: 10,
                  width: '48%',
                  alignItems: 'center',
                }}
                onPress={() => {
                  closeExerciseDetails();
                  // Start timer for this exercise
                  setActiveExercise(selectedExerciseDetails);
                  setTimeRemaining(selectedExerciseDetails.duration || 
                    (selectedExerciseDetails.reps ? Math.round(selectedExerciseDetails.reps * 2.5) : 30));
                  setTimerState('work');
                  setCurrentSet(1);
                  setTimerModalVisible(true);
                }}
              >
                <Text style={{
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}>Start Exercise</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{
                  backgroundColor: '#ff4d4f',
                  paddingVertical: 16,
                  marginTop: 16,
                  borderRadius: 10,
                  width: '48%',
                  alignItems: 'center',
                }}
                onPress={() => {
                  handleRemoveFromWorkout(selectedExerciseDetails.id);
                  closeExerciseDetails();
                }}
              >
                <Text style={{
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // If exercise is not in workout, show add button
            <TouchableOpacity 
              style={{
                backgroundColor: Colors.primary,
                paddingVertical: 16,
                margin: 16,
                borderRadius: 10,
                alignItems: 'center',
              }}
              onPress={() => {
                // Add to workout
                const normalizedExercise = normalizeExerciseData(selectedExerciseDetails);
                addToWorkout(normalizedExercise);
                
                Toast.show({
                  type: 'success',
                  text1: `Added "${normalizedExercise.name.length > 20 ? 
                    normalizedExercise.name.substring(0, 20) + '...' : 
                    normalizedExercise.name}" to workout`,
                  visibilityTime: 2000,
                  position: 'bottom',
                });
                
                closeExerciseDetails();
              }}
            >
              <Text style={{
                color: 'white',
                fontWeight: 'bold',
                fontSize: 16,
              }}>Add to Workout</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
  }, [selectedExerciseDetails, selectedExercises, closeExerciseDetails, normalizeExerciseData, addToWorkout, handleRemoveFromWorkout, setActiveExercise, setTimeRemaining, setTimerState, setCurrentSet, setTimerModalVisible]);

// Function to render an exercise item in the workout list
const renderExerciseItem = useCallback((exercise: any) => {
    const isCompleted = completedExercises.includes(exercise.id);
    
    return (
      // 🔥 Updated card design to match search results UI - way cleaner than our old setup!
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        {/* Fixed GIF dimensions to stop those weird layout issues */}
        {(exercise.gifUrl || exercise.imageUrl) ? (
          <Image 
            source={{ uri: exercise.gifUrl || exercise.imageUrl }} 
            style={{
              width: 60,
              height: 60,
              borderRadius: 12,
              marginRight: 12,
              backgroundColor: '#f0f0f0',
            }}
            resizeMode="cover"
          />
        ) : (
          <View style={{
            width: 60,
            height: 60,
            borderRadius: 12,
            marginRight: 12,
            backgroundColor: '#f0f0f0',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text>No Image</Text>
          </View>
        )}
        
        {/* Main content container - using flex to make sure text doesn't overflow */}
        <View style={{ flex: 1 }}>
          {/* Name truncation FTW - long exercise names were killing the layout */}
          <Text style={{
            fontSize: 16,
            fontWeight: "500",
            color: Colors.text,
            marginBottom: 4,
          }} numberOfLines={1}>
            {exercise.name}
          </Text>
          
          {/* Workout stats with cleaner spacing & icons */}
          <View style={{ 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            marginBottom: 4 
          }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Dumbbell size={14} color={Colors.primary} />
              <Text style={{ 
                fontSize: 14, 
                color: Colors.lightText, 
                marginLeft: 4 
              }}>
                {exercise.sets || 3} × {exercise.reps || 12}
              </Text>
            </View>
            
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center' 
            }}>
              <Clock size={14} color={Colors.primary} />
              <Text style={{ 
                fontSize: 14, 
                color: Colors.lightText, 
                marginLeft: 4 
              }}>
                {exercise.rest || 60}s
              </Text>
            </View>
          </View>
          
          {/* Tags for filtering - same style as search page now */}
          <View style={{ 
            flexDirection: 'row', 
            flexWrap: 'wrap',
          }}>
            {exercise.bodyPart && (
              <View style={{
                backgroundColor: primaryLight,
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: 12,
                marginRight: 6,
                marginBottom: 4,
              }}>
                <Text style={{
                  fontSize: 12,
                  color: Colors.primary,
                }}>
                  {exercise.bodyPart ? 
                    (typeof exercise.bodyPart === 'string' ? 
                      exercise.bodyPart.charAt(0).toUpperCase() + exercise.bodyPart.slice(1) : 
                      exercise.bodyPart) :
                    exercise.category ? 
                      (typeof exercise.category === 'string' ?
                        exercise.category.charAt(0).toUpperCase() + exercise.category.slice(1) :
                        exercise.category) : 'Unknown'}
                </Text>
              </View>
            )}
              
            {(exercise.equipment && exercise.equipment !== 'body weight' && exercise.equipment !== 'none') && (
              <View style={{
                backgroundColor: secondaryLight,
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: 12,
                marginRight: 6,
                marginBottom: 4,
              }}>
                <Text style={{
                  fontSize: 12,
                  color: Colors.secondary,
                }}>
                  {typeof exercise.equipment === 'string'
                    ? exercise.equipment.charAt(0).toUpperCase() + exercise.equipment.slice(1)
                    : 'Unknown equipment'}
                </Text>
              </View>
            )}
            
            {/* Only shows if finished - nice visual cue for users */}
            {isCompleted && (
              <View style={{
                backgroundColor: Colors.primary,
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: 12,
                marginRight: 6,
                marginBottom: 4,
              }}>
                <Text style={{
                  fontSize: 12,
                  color: 'white',
                }}>
                  Completed
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Play button for timer - positioned right instead of floating now */}
        <TouchableOpacity
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: Colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 8,
          }}
          onPress={() => {
            setActiveExercise(exercise);
            setTimeRemaining(exercise.duration || (exercise.reps ? Math.round(exercise.reps * 2.5) : 30));
            setTimerState('work');
            setCurrentSet(1);
            setTimerModalVisible(true);
          }}
        >
          <Play size={20} color="white" />
        </TouchableOpacity>
      </View>
    );
  }, [completedExercises, setActiveExercise, setTimeRemaining, setTimerState, setCurrentSet, setTimerModalVisible]);

  // Handle removing a workout from history
  const handleRemoveWorkout = useCallback(async (workoutId: string) => {
    if (!user || !workoutId) {
      Toast.show({
        type: 'error',
        text1: 'Error removing workout',
        text2: 'Workout ID or user ID is missing',
        position: 'bottom',
      });
      return;
    }
    
    try {
      await userRemoveWorkout(user.uid, workoutId);
      Toast.show({
        type: 'success',
        text1: 'Workout removed',
        visibilityTime: 2000,
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error removing workout:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to remove workout',
        visibilityTime: 2000,
        position: 'bottom',
      });
    }
  }, [user, userRemoveWorkout]);

  // Render right swipe actions for workout history items
  const renderRightActions = useCallback((workoutId: string) => {
    if (!workoutId) return null;
    
    return (
      <TouchableOpacity
        style={deleteActionStyles.container}
        onPress={() => handleRemoveWorkout(workoutId)}
      >
        <Trash2 size={20} color="white" />
        <Text style={deleteActionStyles.text}>Delete</Text>
      </TouchableOpacity>
    );
  }, [handleRemoveWorkout]);

  // Render a workout row for history
  const renderWorkoutRow = useCallback((workout: any) => {
    if (!workout || !workout.id) return null;
    
    // Format the workout date properly
    const workoutDate = workout.date ? new Date(workout.date) : new Date();
    // Skip rendering if date is invalid
    if (isNaN(workoutDate.getTime())) return null;
    
    // Get the time for display
    const formattedTime = workoutDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Use time for card heading instead of redundant date
    const workoutTitle = workout.name && !workout.name.includes('Workout') ? 
      workout.name : `Workout ${formattedTime}`;
    
    return (
      <Swipeable
        key={workout.id}
        renderRightActions={() => renderRightActions(workout.id)}
      >
        <TouchableOpacity 
          style={styles.historyDateCard}
          onPress={() => {
            setSelectedWorkoutDetails(workout);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.historyDateHeader}>
            <Text style={styles.historyDate}>{workoutTitle}</Text>
            <View style={styles.mealCount}>
              <Dumbbell size={16} color={Colors.primary} />
              <Text style={styles.mealCountText}>{workout.exerciseCount || 0} exercises</Text>
            </View>
          </View>
          
          <View style={styles.historyNutrition}>
            <View style={styles.historyNutritionItem}>
              <Text style={styles.historyNutritionValue}>{workout.exerciseCount || 0}</Text>
              <Text style={styles.historyNutritionLabel}>exercises</Text>
              <Text style={styles.historyNutritionTarget}>Target: 5-8</Text>
            </View>
            
            <View style={styles.historyNutritionItem}>
              <Text style={styles.historyNutritionValue}>{workout.duration ? Math.floor(workout.duration / 60) : 0}</Text>
              <Text style={styles.historyNutritionLabel}>minutes</Text>
              <Text style={styles.historyNutritionTarget}>Target: 45-60</Text>
            </View>
            
            <View style={styles.historyNutritionItem}>
              <Text style={styles.historyNutritionValue}>{workout.totalSets || 0}</Text>
              <Text style={styles.historyNutritionLabel}>sets</Text>
              <Text style={styles.historyNutritionTarget}>Target: 15-20</Text>
            </View>
            
            {workout.status && (
              <View style={styles.historyNutritionItem}>
                <View style={{
                  backgroundColor: workout.status === 'completed' ? '#4CAF50' : '#FF9800',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  alignSelf: 'flex-start',
                  minWidth: 80,
                  alignItems: 'center'
                }}>
                  <Text style={{
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 'bold',
                  }}>
                    {workout.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            )}
          </View>
          
          {workout.muscleGroups && Array.isArray(workout.muscleGroups) && workout.muscleGroups.length > 0 && (
            <View style={styles.historyMealPreview}>
              {workout.muscleGroups.slice(0, 2).map((group: string, index: number) => (
                <Text key={`group-${index}`} style={styles.historyMealName} numberOfLines={1}>
                  • {typeof group === 'string' ? group.charAt(0).toUpperCase() + group.slice(1) : group}
                </Text>
              ))}
              {workout.muscleGroups.length > 2 && (
                <Text style={styles.historyMoreMeals}>
                  +{workout.muscleGroups.length - 2} more muscle groups
                </Text>
              )}
            </View>
          )}
          
          <ChevronRight size={20} color={Colors.lightText} style={styles.historyChevron} />
        </TouchableOpacity>
      </Swipeable>
    );
  }, [renderRightActions, setSelectedWorkoutDetails]);

  // Function to render workout history with memo to prevent re-renders
  const renderWorkoutHistory = useCallback(() => {
    // Check if profile exists and has valid workout history
    if (!profile || !profile.workout_history || !Array.isArray(profile.workout_history) || profile.workout_history.length === 0) {
      return (
        <View style={styles.centeredContainer}>
          <Text style={styles.emptyWorkoutText}>No workout history yet</Text>
          <Text style={{
            color: Colors.lightText,
            textAlign: 'center',
            marginTop: 8,
            paddingHorizontal: 20,
          }}>Complete your first workout to see it here</Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <Text style={styles.historyTitle}>Workout History</Text>
        <ScrollView style={styles.historyList}>
          {groupedData.length === 0 ? (
            <View style={styles.emptySearchState}>
              <Calendar size={40} color={Colors.lightText} />
              <Text style={styles.emptyStateText}>No workout history</Text>
              <Text style={styles.emptyStateSubtext}>
                Complete workouts to see them here
              </Text>
            </View>
          ) : (
            groupedData.map((item) => (
              <View key={item.date} style={styles.historyContainer}>
                <Text style={styles.dateHeader}>{item.displayDate}</Text>
                {item.workouts.filter(workout => workout && workout.id).map(workout => renderWorkoutRow(workout))}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }, [profile, groupedData, renderWorkoutRow]);

  // Add a new function to render workout details modal
  const renderWorkoutDetailsModal = useCallback(() => {
    if (!selectedWorkoutDetails) return null;
    
    // Format the workout date properly for display
    let formattedDate = "Unknown Date";
    let formattedTime = "";
    let formattedDateTime = "";
    
    if (selectedWorkoutDetails.date) {
      try {
        const workoutDate = new Date(selectedWorkoutDetails.date);
        if (!isNaN(workoutDate.getTime())) {
          formattedDate = workoutDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          });
          
          formattedTime = workoutDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          
          formattedDateTime = workoutDate.toLocaleString('en-US', {
            weekday: 'long',
            month: 'long', 
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (error) {
        console.error("Error formatting workout date:", error);
      }
    }
    
    // Determine appropriate title for modal
    const modalTitle = selectedWorkoutDetails.name && !selectedWorkoutDetails.name.includes('Workout') ? 
      selectedWorkoutDetails.name : `Workout ${formattedTime || formattedDate}`;
    
    return (
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
              }}>{modalTitle}</Text>
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
                      {selectedWorkoutDetails.exerciseCount || 0}
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
                    minWidth: 120,
                    alignItems: 'center',
                  }}>
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                      {selectedWorkoutDetails.status === 'completed' 
                        ? 'COMPLETED' 
                        : 'PARTIAL'}
                    </Text>
                  </View>
                )}
                
                {formattedDateTime && (
                  <Text style={{ 
                    textAlign: 'center',
                    marginTop: 12,
                color: Colors.lightText, 
                    fontSize: 13,
              }}>
                    {formattedDateTime}
              </Text>
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
    );
  }, [selectedWorkoutDetails]);

  // Add handleSearch function to handle the search input submission
  const handleSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      
      setIsSearching(true);
      
      try {
        const results = await searchExercises({ 
          search: query,
          limit: 20
        });
        setSearchResults(results.results);
      } catch (error) {
        console.error("Search error:", error);
        Alert.alert(
          "Search Error",
          "Failed to search for exercises. Please try again later.",
          [{ text: "OK" }]
        );
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    []
  );

  // Update searchQuery state
  useEffect(() => {
    if (searchQuery.length > 2) {
      handleSearch(searchQuery);
    } else if (searchQuery.length === 0) {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery, handleSearch]);

  // Function to handle creating a custom exercise
  const handleCreateExercise = useCallback(() => {
    // Validate form
    const newErrors: Record<string, string> = {};
    
    if (!newExerciseName.trim()) {
      newErrors.name = "Exercise name is required";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const customExercise = normalizeExerciseData({
      id: `custom_${Date.now()}`,
      name: newExerciseName.trim(),
      bodyPart: newExerciseBodyPart.trim() || 'other',
      sets: parseInt(newExerciseSets) || 3,
      reps: parseInt(newExerciseReps) || 12,
      rest: parseInt(newExerciseRest) || 60,
      gifUrl: '',
      imageUrl: '',
      isCustom: true
    });

    // Add the exercise to the workout
    addToWorkout(customExercise);
    
    // Reset form fields
    setNewExerciseName('');
    setNewExerciseBodyPart('');
    setNewExerciseSets('3');
    setNewExerciseReps('12');
    setNewExerciseRest('60');
    setErrors({});
    
    // Close the modal
    setShowAddExerciseModal(false);
    
    // Switch to workout tab
    setActiveTab('workout');
    
    // Show success toast
    Toast.show({
      type: 'success',
      text1: 'Exercise Added',
      text2: `${customExercise.name} added to your workout`,
      position: 'bottom',
    });
  }, [
    newExerciseName,
    newExerciseBodyPart,
    newExerciseSets,
    newExerciseReps,
    newExerciseRest,
    normalizeExerciseData,
    addToWorkout,
    setActiveTab
  ]);
  
  // Add a new function to render the add exercise modal
  const renderAddExerciseModal = useCallback(() => {
    return (
      <Modal
        visible={showAddExerciseModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAddExerciseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Exercise</Text>
              <TouchableOpacity 
                onPress={() => setShowAddExerciseModal(false)}
              >
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Exercise Name *</Text>
                <TextInput
                  style={[styles.formInput, !newExerciseName.trim() && errors.name ? styles.inputError : null]}
                  placeholder="Enter exercise name"
                  placeholderTextColor={Colors.lightText}
                  value={newExerciseName}
                  onChangeText={setNewExerciseName}
                />
                {errors.name && <Text style={styles.formErrorText}>{errors.name}</Text>}
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Body Part</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., chest, back, legs"
                  placeholderTextColor={Colors.lightText}
                  value={newExerciseBodyPart}
                  onChangeText={setNewExerciseBodyPart}
                />
              </View>
              
          <View style={{ 
            flexDirection: 'row', 
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <View style={{ width: '30%' }}>
                  <Text style={styles.formLabel}>Sets</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={newExerciseSets}
                    onChangeText={setNewExerciseSets}
                    textAlign="center"
                  />
                </View>
                
                <View style={{ width: '30%' }}>
                  <Text style={styles.formLabel}>Reps</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={newExerciseReps}
                    onChangeText={setNewExerciseReps}
                    textAlign="center"
                  />
                </View>
                
                <View style={{ width: '30%' }}>
                  <Text style={styles.formLabel}>Rest (sec)</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={newExerciseRest}
                    onChangeText={setNewExerciseRest}
                    textAlign="center"
                  />
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowAddExerciseModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={handleCreateExercise}
              >
                <Text style={styles.addButtonText}>Add to Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }, [showAddExerciseModal, newExerciseName, newExerciseBodyPart, newExerciseSets, newExerciseReps, newExerciseRest, handleCreateExercise, errors]);
  
  // Load equipment options for filtering
  useEffect(() => {
    const loadEquipmentOptions = async () => {
      try {
        // Extract unique equipment types from exercises
        if (exercises && exercises.length > 0) {
          const equipmentSet = new Set<string>();
          exercises.forEach(exercise => {
            if (exercise.equipment && typeof exercise.equipment === 'string') {
              equipmentSet.add(exercise.equipment.toLowerCase().trim());
            }
          });
          
          // Convert set to array and sort alphabetically
          const uniqueEquipment = Array.from(equipmentSet)
            .filter(eq => eq && eq !== 'none' && eq !== 'body weight')
            .sort();
          
          setEquipmentOptions(uniqueEquipment);
        }
      } catch (error) {
        console.error('Error loading equipment options:', error);
      }
    };
    
    loadEquipmentOptions();
  }, [exercises]);
  
  // ===== Rest of functions ====

  // Update filter function to track active filters (both can be active simultaneously)
  const handleFilterSelection = useCallback((filterValue: string, filterType: 'category' | 'equipment') => {
    // If this filter is already active, clear just this filter
    if (
      (filterType === 'category' && activeFilter.category === filterValue) ||
      (filterType === 'equipment' && activeFilter.equipment === filterValue)
    ) {
      // Clear just this one filter type
      setActiveFilter(prev => ({
        ...prev,
        [filterType]: null
      }));
    } else {
      // Set or update this filter type
      setActiveFilter(prev => ({
        ...prev,
        [filterType]: filterValue
      }));
    }
    
    // Apply combined filtering
    applyFilters(
      filterType === 'category' 
        ? filterValue 
        : activeFilter.category,
      filterType === 'equipment' 
        ? filterValue 
        : activeFilter.equipment,
      filterType
    );
  }, [activeFilter]);
  
  // Apply both filters together
  const applyFilters = useCallback((categoryValue: string | null, equipmentValue: string | null, changedFilterType: 'category' | 'equipment') => {
    // If both filters are being cleared
    if (!categoryValue && !equipmentValue) {
      fetchExercises(1, PAGE_SIZE);
      return;
    }
    
    // Use standard filter function for single filters
    if (categoryValue && !equipmentValue) {
      filterExercises(categoryValue, 'category');
      return;
    }
    
    if (equipmentValue && !categoryValue) {
      filterExercises(equipmentValue, 'equipment');
      return;
    }
    
    // If both filters are active, manually filter the exercises array
    if (categoryValue && equipmentValue) {
      // Start with all exercises
      const filtered = exercises.filter((exercise: Exercise) => {
        // Apply body part filter
        const exerciseCategory = (exercise.bodyPart || exercise.category || '').toLowerCase();
        const categoryMatch = exerciseCategory === categoryValue.toLowerCase();
        
        // Apply equipment filter
        const exerciseEquipment = (exercise.equipment || '').toLowerCase();
        const equipmentMatch = exerciseEquipment === equipmentValue.toLowerCase();
        
        // Both filters must match
        return categoryMatch && equipmentMatch;
      });
      
      // Update filtered exercises state
      useWorkoutStore.setState({ filteredExercises: filtered });
    }
  }, [exercises, fetchExercises, filterExercises]);

  // Function to clear all filters and reset highlighting
  const clearAllFilters = useCallback(() => {
    // Clear active filter state to reset highlighting
    setActiveFilter({ category: null, equipment: null });
    
    // Clear search query
    setSearchQuery('');
    
    // Reset to all exercises
    fetchExercises(1, PAGE_SIZE);
    
    // Clear search results
    setSearchResults([]);
  }, [fetchExercises]);

  // Now start with the original render content, but without useMemo wrapping it
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ 
        title: "Workouts", 
        headerShown: false,
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTitleStyle: {
          color: Colors.text,
          fontSize: 20,
          fontWeight: 'bold',
        },
        headerTitleAlign: 'center',
        headerShadowVisible: true,
      }} />

      {/* Render tabs directly instead of using renderTabs function */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "browse" && styles.activeTab]}
          onPress={() => setActiveTab("browse")}
        >
          <BookOpen size={20} color={activeTab === "browse" ? Colors.primary : Colors.lightText} />
          <Text style={[styles.tabText, activeTab === "browse" && styles.activeTabText]}>Browse</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === "workout" && styles.activeTab]}
          onPress={() => setActiveTab("workout")}
        >
          <Dumbbell size={20} color={activeTab === "workout" ? Colors.primary : Colors.lightText} />
          <Text style={[styles.tabText, activeTab === "workout" && styles.activeTabText]}>Workout</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.activeTab]}
          onPress={() => setActiveTab("history")}
        >
          <Calendar size={20} color={activeTab === "history" ? Colors.primary : Colors.lightText} />
          <Text style={[styles.tabText, activeTab === "history" && styles.activeTabText]}>History</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "browse" && (
        <View style={styles.tabContent}>
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Search size={20} color={Colors.lightText} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises..."
                placeholderTextColor={Colors.lightText}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}>
                  <X size={20} color={Colors.lightText} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowAddExerciseModal(true)}
            >
              <Plus size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.filtersContainer}>
            {/* Clear filters button - removing this since there's already one in filtered results */}
            {/* {(activeFilter.type !== null || searchQuery.length > 0) && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-end',
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  backgroundColor: '#ffeeee',
                  borderRadius: 16,
                  marginBottom: 8,
                }}
                onPress={clearAllFilters}
              >
                <X size={14} color="#ff6666" />
                <Text style={{ fontSize: 12, color: "#ff6666", marginLeft: 4 }}>
                  Clear Filters
                </Text>
              </TouchableOpacity>
            )} */}
            
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Body Part:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {muscleGroups && 
                    Array.isArray(muscleGroups) && muscleGroups
                      .filter(group => 
                        typeof group === 'object' && 
                        group.type === 'bodyPart' && 
                        !['cardio', 'neck'].includes(group.name.toLowerCase())
                      )
                      .map((group, index) => {
                        const isSelected = activeFilter.category === group.name;
                        return (
                          <TouchableOpacity
                            key={`bodyPart-${index}`}
                            style={[
                              styles.filterChip,
                              isSelected && styles.filterChipSelected
                            ]}
                            onPress={() => {
                              handleFilterSelection(group.name, "category");
                            }}
                          >
                            <Text style={[
                              styles.filterChipText,
                              isSelected && styles.filterChipTextSelected
                            ]}>
                              {group.name.charAt(0).toUpperCase() + group.name.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                  }
                </View>
              </ScrollView>
            </View>
            
            {/* Equipment filter section */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Equipment:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {equipmentOptions.map((equipment, index) => {
                    const isSelected = activeFilter.equipment === equipment;
                    return (
                      <TouchableOpacity
                        key={`equipment-${index}`}
                        style={[
                          styles.filterChip,
                          isSelected && styles.filterChipSelected
                        ]}
                        onPress={() => {
                          handleFilterSelection(equipment, "equipment");
                        }}
                      >
                        <Text style={[
                          styles.filterChipText,
                          isSelected && styles.filterChipTextSelected
                        ]}>
                          {equipment.charAt(0).toUpperCase() + equipment.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
          
          <ScrollView style={styles.browseContent}>
            {isLoading || isSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>
                  {isSearching ? 'Searching...' : 'Loading exercises...'}
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {error}
                </Text>
                <Button 
                  title="Try Again" 
                  onPress={() => fetchExercises()} 
                  style={styles.retryButton}
                />
              </View>
            ) : searchQuery.length > 0 && searchResults.length === 0 && !isSearching ? (
              <View style={styles.emptySearchState}>
                <Search size={40} color={Colors.lightText} />
                <Text style={styles.emptyStateText}>
                  No results found
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Try a different search term or filter
                </Text>
              </View>
            ) : (searchQuery.length > 0 && searchResults.length > 0) || 
               (Array.isArray(filteredExercises) && 
                filteredExercises.length > 0 && 
                filteredExercises.length < exercises.length) ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {searchQuery.length > 0 && searchResults.length > 0 
                      ? `Search Results` 
                      : Array.isArray(filteredExercises) && filteredExercises.length < exercises.length
                        ? 'Filtered Results'
                        : 'Browse Exercises'}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {Array.isArray(filteredExercises) && filteredExercises.length < exercises.length && (
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#ff4d4f15',
                          borderRadius: 20,
                          width: 28,
                          height: 28,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 8,
                        }}
                        onPress={clearAllFilters}
                      >
                        <X size={16} color="#ff4d4f" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                
                {(searchQuery.length > 0 ? searchResults : filteredExercises).map((exercise) => (
                  <TouchableOpacity
                    key={exercise.id.toString()}
                    style={styles.searchResultItem}
                    onPress={() => showExerciseDetails(exercise)}
                  >
                    {(exercise.gifUrl || exercise.imageUrl) ? (
                      <Image 
                        source={{ uri: exercise.gifUrl || exercise.imageUrl }} 
                        style={{
                          ...styles.searchResultImage,
                          backgroundColor: '#f0f0f0'
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.searchResultImage, { 
                        backgroundColor: '#f0f0f0', 
                        justifyContent: 'center', 
                        alignItems: 'center' 
                      }]}>
                        <Text>No Image</Text>
                      </View>
                    )}
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultTitle}>{exercise.name}</Text>
                      
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
            {exercise.bodyPart && (
              <View style={{
                backgroundColor: primaryLight,
                            paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 12,
                marginRight: 6,
                marginBottom: 4,
                            borderWidth: 1,
                            borderColor: primaryLight,
              }}>
                <Text style={{
                  fontSize: 12,
                  color: Colors.primary,
                }}>
                              {typeof exercise.bodyPart === 'string' 
                                ? exercise.bodyPart.charAt(0).toUpperCase() + exercise.bodyPart.slice(1) 
                                : exercise.bodyPart}
                </Text>
              </View>
            )}
              
                        {exercise.equipment && exercise.equipment !== 'body weight' && exercise.equipment !== 'none' && (
              <View style={{
                backgroundColor: secondaryLight,
                            paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 12,
                marginRight: 6,
                marginBottom: 4,
                            borderWidth: 1,
                            borderColor: secondaryLight,
              }}>
                <Text style={{
                  fontSize: 12,
                  color: Colors.secondary,
                }}>
                  {typeof exercise.equipment === 'string'
                    ? exercise.equipment.charAt(0).toUpperCase() + exercise.equipment.slice(1)
                    : 'Unknown equipment'}
                </Text>
              </View>
            )}
                      </View>
                    </View>
                    <ChevronRight size={20} color={Colors.lightText} />
                  </TouchableOpacity>
                ))}
                
                {searchQuery.length === 0 && Array.isArray(filteredExercises) && filteredExercises.length < exercises.length && hasMoreExercises && (
                  <TouchableOpacity 
                    style={styles.loadMoreButton}
                    onPress={() => {
                      const nextPage = page + 1;
                      setPage(nextPage);
                      setIsLoadingMore(true);
                      
                      fetchExercisesByPage(nextPage, PAGE_SIZE)
                        .then(newExercises => {
                          if (newExercises.length < PAGE_SIZE) {
                            setHasMoreExercises(false);
                          }
                          setIsLoadingMore(false);
                        })
                        .catch(error => {
                          console.error('Error loading more exercises:', error);
                          setIsLoadingMore(false);
                        });
                    }}
                  >
                    <Text style={styles.loadMoreText}>Load More</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.emptySearchState}>
                <Search size={40} color={Colors.lightText} />
                <Text style={styles.emptyStateText}>
                  Search for exercises
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Enter an exercise name or keyword above to find exercises
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
      
      {activeTab === "workout" && <View style={styles.content}>
        <View style={styles.workoutHeader}>
        </View>
        
        {selectedExercises.length === 0 ? (
          <View style={styles.emptyWorkout}>
            <Text style={styles.emptyWorkoutText}>No exercises added to your workout</Text>
            <Text style={styles.emptyWorkoutSubtext}>Browse and add exercises to build your workout</Text>
            <Button 
              title="Browse Exercises" 
              onPress={() => setActiveTab("browse")} 
              style={{
                backgroundColor: Colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 12,
                marginVertical: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 3,
              }}
            />
          </View>
        ) : (
          <>
            <ScrollView 
              style={{ flex: 1 }} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 80 }} // Add padding to bottom of scroll content
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingVertical: 8,
                paddingHorizontal: 16,
                marginBottom: 8,
              }}>
                <X size={14} color={Colors.lightText} />
                <Text style={{
                  fontSize: 12,
                  color: Colors.lightText,
                  marginLeft: 6,
                }}>Swipe left to delete</Text>
              </View>
              
              {selectedExercises.map((exercise) => (
                <Swipeable
                  key={exercise.id}
                  renderRightActions={() => (
                    <TouchableOpacity 
                      style={deleteActionStyles.container}
                      onPress={() => handleRemoveFromWorkout(exercise.id)}
                    >
                      <Trash2 size={20} color="white" />
                      <Text style={deleteActionStyles.text}>Delete</Text>
                    </TouchableOpacity>
                  )}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      showExerciseDetails(exercise);
                    }}
                  >
                    {renderExerciseItem(exercise)}
                  </TouchableOpacity>
                </Swipeable>
              ))}
            </ScrollView>
            
            {/* Add the Complete Workout button */}
            <View style={styles.workoutButtonsContainer}>
              <Button 
                title="Complete Workout" 
                onPress={handleCompleteWorkout}
                style={{
                  ...styles.completeWorkoutButton,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 8,
                }}
                textStyle={{ color: 'white', fontWeight: '600', fontSize: 16 }}
              />
            </View>
          </>
        )}
      </View>}
      
      {activeTab === "history" && <View style={styles.content}>
        <View style={styles.workoutHeader}>
        </View>
        
        <View style={{ flex: 1 }}>
          {renderWorkoutHistory()}
        </View>
      </View>}
      
      {/* Render timer modal */}
      {renderTimerModal()}
      
      {/* Render exercise details modal */}
      {renderExerciseDetailsModal()}
      
      {/* Render workout details modal */}
      {renderWorkoutDetailsModal()}
      
      {/* Render add exercise modal */}
      {renderAddExerciseModal()}
      
      {/* Add Toast component at the end */}
      <Toast />
    </SafeAreaView>
  );
}