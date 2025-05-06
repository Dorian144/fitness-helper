import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  getUserProfile, 
  updateUserProfile, 
  addWorkoutToHistory,
  addMealToHistory,
  uploadProfilePhoto,
  getWorkoutHistory,
  getMealHistory,
  auth,
  db,
  ensureAuthenticated
} from "@/services/firebase";
import { Alert } from "react-native";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

// Basic user profile with all the stuff we track
interface UserProfile {
  name: string;
  email: string;
  age: number;
  weight: number;
  height: number;
  gender: string;
  fitness_goals: string[];
  activityLevel: string;
  photoURL?: string;
  workout_history: any[];
  meal_history: any[];
  water_intake?: Record<string, number>;
}

// Structure for AI coach recommendations
interface RecommendationData {
  text: string;
  isFallback?: boolean;
}

// Our global user state interface
interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  dailyRecommendation: RecommendationData | null;
  fetchUserProfile: (userId: string) => Promise<void>;
  updateProfile: (userId: string, data: Partial<UserProfile>) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<boolean>;
  uploadPhoto: (userId: string, uri: string) => Promise<string>;
  addWorkout: (userId: string, workout: any) => Promise<void>;
  addMeal: (userId: string, meal: any) => Promise<void>;
  setDailyRecommendation: (recommendation: RecommendationData) => void;
  refreshRecommendation?: () => Promise<void>; // Added later in _layout.tsx
  clearError: () => void;
  removeMeal: (userId: string, mealId: string) => Promise<void>;
  removeWorkout: (userId: string, workoutId: string) => Promise<void>;
}

// Default values for new users
const initialProfile: UserProfile = {
  name: "",
  email: "",
  age: 30,
  weight: 70,
  height: 170,
  gender: "male",
  fitness_goals: [],
  activityLevel: "moderate",
  workout_history: [],
  meal_history: []
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      isLoading: false,
      error: null,
      dailyRecommendation: null,
      
      fetchUserProfile: async (userId) => {
        set({ isLoading: true, error: null });
        try {
          // Quick delay to let any auth changes sync up
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Figure out which user ID to use
          let currentUserId = userId;
          let authUser = null;
          
          try {
            // Check if we're logged in
            authUser = await ensureAuthenticated();
            if (authUser) {
              console.log("Authentication confirmed, user is logged in:", authUser.uid);
              
              // Use auth user ID if provided ID doesn't match or isn't provided
              if (!currentUserId || (authUser.uid !== currentUserId)) {
                currentUserId = authUser.uid;
              }
            }
          } catch (authError) {
            console.error("Auth check failed:", authError);
            
            // If no ID was provided, try to get one from storage
            if (!currentUserId) {
              const authData = await AsyncStorage.getItem('@firebase_auth_user');
              if (authData) {
                const userData = JSON.parse(authData);
                if (userData?.uid) {
                  console.log("Using stored auth data for profile fetch");
                  currentUserId = userData.uid;
                } else {
                  throw new Error("Invalid stored auth data");
                }
              } else {
                throw new Error("Authentication required. Please sign in.");
              }
            }
          }
          
          // Make sure we have a valid ID by this point
          if (!currentUserId) {
            throw new Error("Failed to determine user ID for profile fetch");
          }
          
          console.log(`Fetching profile for user ${currentUserId}`);
          
          // Small delay before hitting Firestore
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Get the profile data
          const profileData = await getUserProfile(currentUserId);
          
          if (profileData) {
            console.log("Profile found, fetching workout and meal history");
            
            // Get workout history from subcollection
            const workoutHistory = await getWorkoutHistory(currentUserId);
            profileData.workout_history = workoutHistory;
            console.log(`Loaded ${workoutHistory.length} workouts`);
            
            // Check if we might need to migrate old data
            if (workoutHistory.length === 0 && 
                profileData.workout_history && 
                Array.isArray(profileData.workout_history) && 
                profileData.workout_history.length > 0) {
              console.log("Found workouts in profile but not in subcollection - might need migration");
            }
            
            // Get meal history from subcollection
            const mealHistory = await getMealHistory(currentUserId);
            profileData.meal_history = mealHistory;
            console.log(`Loaded ${mealHistory.length} meals`);
            
            // Similar check for meals
            if (mealHistory.length === 0 && 
                profileData.meal_history && 
                Array.isArray(profileData.meal_history) && 
                profileData.meal_history.length > 0) {
              console.log("Found meals in profile but not in subcollection - might need migration");
            }
            
            set({ 
              profile: { ...initialProfile, ...profileData },
              isLoading: false 
            });
          } else {
            // No profile found, create new one
            console.log("Creating new user profile with default values");
            const newProfile = { 
              ...initialProfile, 
              email: auth.currentUser?.email || "" 
            };
            
            await updateUserProfile(newProfile, currentUserId);
            
            set({ 
              profile: newProfile,
              isLoading: false 
            });
          }
        } catch (error: any) {
          console.error("Error fetching user profile:", error);
          set({ 
            error: error.message || "Failed to fetch profile. Please try again.", 
            isLoading: false 
          });
          
          // Show alert for permission errors
          if (error.message?.includes("Permission denied")) {
            Alert.alert(
              "Permission Error",
              "You don't have permission to access this profile. Please sign out and sign in again.",
              [{ text: "OK" }]
            );
          }
          
          throw error;
        }
      },
      
      updateProfile: async (userId, data) => {
        set({ isLoading: true, error: null });
        try {
          // Make sure we're logged in
          if (!auth.currentUser) {
            throw new Error("Authentication required. Please sign in.");
          }
          
          // Make sure we're updating our own profile
          if (auth.currentUser.uid !== userId) {
            throw new Error("Permission denied: Cannot update another user's profile.");
          }
          
          console.log(`Updating profile for user ${userId}`);
          
          await updateUserProfile(data, userId);
          set({ 
            profile: { ...get().profile, ...data } as UserProfile,
            isLoading: false 
          });
        } catch (error: any) {
          console.error("Error updating profile:", error);
          set({ 
            error: error.message || "Failed to update profile. Please try again.", 
            isLoading: false 
          });
          
          // Show alert for permission errors
          if (error.message?.includes("Permission denied")) {
            Alert.alert(
              "Permission Error",
              "You don't have permission to update this profile. Please sign out and sign in again.",
              [{ text: "OK" }]
            );
          }
          
          throw error;
        }
      },
      
      updateUserProfile: async (data) => {
        set({ isLoading: true, error: null });
        try {
          // Figure out which user ID to use
          let userId = auth.currentUser?.uid;
          
          // If not logged in, try to get ID from storage
          if (!userId) {
            const authData = await AsyncStorage.getItem('@firebase_auth_user');
            if (authData) {
              const userData = JSON.parse(authData);
              if (userData?.uid) {
                console.log("Using stored auth data for profile update");
                userId = userData.uid;
              }
            }
          }
          
          // Make sure we have a valid ID
          if (!userId) {
            throw new Error("Authentication required. Please sign in.");
          }
          
          await updateUserProfile(data, userId);
          set({ 
            profile: { ...get().profile, ...data } as UserProfile,
            isLoading: false 
          });
          return true;
        } catch (error: any) {
          console.error("Error updating user profile:", error);
          set({ 
            error: error.message || "Failed to update user profile. Please try again.", 
            isLoading: false 
          });
          
          // Show alert for permission errors
          if (error.message?.includes("Permission denied")) {
            Alert.alert(
              "Permission Error",
              "You don't have permission to update this profile. Please sign out and sign in again.",
              [{ text: "OK" }]
            );
          }
          
          return false;
        }
      },
      
      uploadPhoto: async (userId, uri) => {
        set({ isLoading: true, error: null });
        try {
          // Make sure we're uploading for ourselves
          if (auth.currentUser && auth.currentUser.uid !== userId) {
            throw new Error("Permission denied: Cannot upload photo for another user.");
          }
          
          // If not logged in, try to validate with stored data
          let finalUserId = userId;
          if (!auth.currentUser) {
            const authData = await AsyncStorage.getItem('@firebase_auth_user');
            if (authData) {
              const userData = JSON.parse(authData);
              if (userData?.uid) {
                // Make sure we're not trying to upload for someone else
                if (userId && userId !== userData.uid) {
                  throw new Error("Permission denied: Cannot upload photo for another user.");
                }
                
                // Use stored ID if none provided
                if (!userId) {
                  console.log("Using stored auth data for photo upload");
                  finalUserId = userData.uid;
                }
              }
            }
          }
          
          // Make sure we have a valid ID
          if (!finalUserId && !auth.currentUser) {
            throw new Error("Authentication required. Please sign in.");
          }
          
          finalUserId = finalUserId || auth.currentUser?.uid || '';
          
          const photoURL = await uploadProfilePhoto(uri, finalUserId);
          set({ 
            profile: { ...get().profile, photoURL } as UserProfile,
            isLoading: false 
          });
          return photoURL;
        } catch (error: any) {
          console.error("Error uploading photo:", error);
          set({ 
            error: error.message || "Failed to upload photo. Please try again.", 
            isLoading: false 
          });
          
          // Show alert for permission errors
          if (error.message?.includes("Permission denied")) {
            Alert.alert(
              "Permission Error",
              "You don't have permission to upload a photo for this profile. Please sign out and sign in again.",
              [{ text: "OK" }]
            );
          }
          
          throw error;
        }
      },
      
      addWorkout: async (userId, workout) => {
        set({ isLoading: true, error: null });
        try {
          // Make sure we're adding for ourselves
          if (auth.currentUser && auth.currentUser.uid !== userId) {
            throw new Error("Permission denied: Cannot add workout to another user's history.");
          }
          
          // If not logged in, try to validate with stored data
          let finalUserId = userId;
          if (!auth.currentUser) {
            const authData = await AsyncStorage.getItem('@firebase_auth_user');
            if (authData) {
              const userData = JSON.parse(authData);
              if (userData?.uid) {
                // Make sure we're not trying to add for someone else
                if (userId && userId !== userData.uid) {
                  throw new Error("Permission denied: Cannot add workout to another user's history.");
                }
                
                // Use stored ID if none provided
                if (!userId) {
                  console.log("Using stored auth data for workout addition");
                  finalUserId = userData.uid;
                }
              }
            }
          }
          
          // Make sure we have a valid ID
          finalUserId = finalUserId || auth.currentUser?.uid || '';
          if (!finalUserId) {
            throw new Error("Authentication required. Please sign in.");
          }
          
          const workoutData: any = workout;
          const success = await addWorkoutToHistory(workoutData, finalUserId);
          
          if (success) {
            // Update our local state with fresh data
            await get().fetchUserProfile(finalUserId);
          } else {
            throw new Error("Failed to add workout. Please try again.");
          }
          
          set({ isLoading: false });
        } catch (error: any) {
          console.error("Error adding workout:", error);
          set({ 
            error: error.message || "Failed to add workout. Please try again.", 
            isLoading: false 
          });
          
          // Show alert for permission errors
          if (error.message?.includes("Permission denied")) {
            Alert.alert(
              "Permission Error",
              "You don't have permission to add a workout to this profile. Please sign out and sign in again.",
              [{ text: "OK" }]
            );
          }
          
          throw error;
        }
      },
      
      addMeal: async (userId, meal) => {
        set({ isLoading: true, error: null });
        try {
          // Make sure we're adding for ourselves
          if (auth.currentUser && auth.currentUser.uid !== userId) {
            throw new Error("Permission denied: Cannot add meal to another user's history.");
          }
          
          // If not logged in, try to validate with stored data
          let finalUserId = userId;
          if (!auth.currentUser) {
            const authData = await AsyncStorage.getItem('@firebase_auth_user');
            if (authData) {
              const userData = JSON.parse(authData);
              if (userData?.uid) {
                // Make sure we're not trying to add for someone else
                if (userId && userId !== userData.uid) {
                  throw new Error("Permission denied: Cannot add meal to another user's history.");
                }
                
                // Use stored ID if none provided
                if (!userId) {
                  console.log("Using stored auth data for meal addition");
                  finalUserId = userData.uid;
                }
              }
            }
          }
          
          // Make sure we have a valid ID
          finalUserId = finalUserId || auth.currentUser?.uid || '';
          if (!finalUserId) {
            throw new Error("Authentication required. Please sign in.");
          }
          
          const mealData: any = meal;
          const success = await addMealToHistory(mealData, finalUserId);
          
          if (success) {
            // Update our local state with fresh data
            await get().fetchUserProfile(finalUserId);
          } else {
            throw new Error("Failed to add meal. Please try again.");
          }
          
          set({ isLoading: false });
        } catch (error: any) {
          console.error("Error adding meal:", error);
          set({ 
            error: error.message || "Failed to add meal. Please try again.", 
            isLoading: false 
          });
          
          // Show alert for permission errors
          if (error.message?.includes("Permission denied")) {
            Alert.alert(
              "Permission Error",
              "You don't have permission to add a meal to this profile. Please sign out and sign in again.",
              [{ text: "OK" }]
            );
          }
          
          throw error;
        }
      },
      
      setDailyRecommendation: (recommendation) => {
        set({ dailyRecommendation: recommendation });
      },
      
      clearError: () => set({ error: null }),
      
      removeMeal: async (userId: string, mealId: string) => {
        try {
          // Make sure we're logged in
          if (!auth.currentUser) {
            throw new Error("Authentication required. Please sign in.");
          }
          
          // Make sure we're removing our own meal
          if (auth.currentUser.uid !== userId) {
            throw new Error("Permission denied: Cannot remove another user's meal.");
          }
          
          // Delete the meal from Firestore
          const mealRef = doc(db, `users/${userId}/meal_history/${mealId}`);
          await deleteDoc(mealRef);
          
          // Update the lastUpdated timestamp
          const userRef = doc(db, "users", userId);
          await updateDoc(userRef, {
            lastUpdated: serverTimestamp()
          });
          
          // Update our local state
          set((state: any) => ({
            profile: state.profile ? {
              ...state.profile,
              meal_history: state.profile.meal_history?.filter(
                (meal: any) => meal.id !== mealId
              ) || []
            } : null
          }));
        } catch (error) {
          console.error("Error removing meal:", error);
          throw new Error("Failed to remove meal from history");
        }
      },
      
      removeWorkout: async (userId: string, workoutId: string) => {
        try {
          // Make sure we're logged in
          if (!auth.currentUser) {
            throw new Error("Authentication required. Please sign in.");
          }
          
          // Make sure we're removing our own workout
          if (auth.currentUser.uid !== userId) {
            throw new Error("Permission denied: Cannot remove another user's workout.");
          }
          
          // Delete the workout from Firestore
          const workoutRef = doc(db, `users/${userId}/workout_history/${workoutId}`);
          await deleteDoc(workoutRef);
          
          // Update the lastUpdated timestamp
          const userRef = doc(db, "users", userId);
          await updateDoc(userRef, {
            lastUpdated: serverTimestamp()
          });
          
          // Update our local state
          set((state: any) => ({
            profile: state.profile ? {
              ...state.profile,
              workout_history: state.profile.workout_history?.filter(
                (workout: any) => workout.id !== workoutId
              ) || []
            } : null
          }));
        } catch (error) {
          console.error("Error removing workout:", error);
          throw new Error("Failed to remove workout from history");
        }
      }
    }),
    {
      name: "user-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        profile: state.profile,
        dailyRecommendation: state.dailyRecommendation
      })
    }
  )
);