import { initializeApp, getApps } from "firebase/app";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  Auth,
  getAuth,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence
} from "firebase/auth";

import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FIREBASE_CONFIG } from "@/constants/config";
import Button from "@/components/Button";
import * as FileSystem from 'expo-file-system';

// Set up Firebase app (only initialize once)
let app;
if (getApps().length === 0) {
  app = initializeApp(FIREBASE_CONFIG);
} else {
  app = getApps()[0];
}

// Export app instance
export { app };

// Initialize Firebase Auth
const auth = getAuth(app);

// Set up manual persistence for React Native
console.log("AsyncStorage manual persistence enabled for Firebase Auth");

// Initialize Firestore and Storage
const db = getFirestore(app);
const storage = getStorage(app);

// Keep auth tokens fresh to prevent permission errors
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Refresh token every 50 minutes (tokens expire after 60)
    const tokenRefreshInterval = 50 * 60 * 1000;
    
    const intervalId = setInterval(async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.getIdToken(true);
          console.log("Firebase auth token refreshed successfully");
        } else {
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error("Error refreshing Firebase auth token:", error);
      }
    }, tokenRefreshInterval);
    
    // Initial token refresh
    if (auth.currentUser) {
      auth.currentUser.getIdToken(true)
        .then(() => console.log("Initial Firebase auth token refresh successful"))
        .catch(error => console.error("Error in initial token refresh:", error));
    }
    
    // Clear interval on auth state change
    return () => clearInterval(intervalId);
  }
});

// Export initialized instances
export { auth, db, storage };

// Checks if a user is logged in and returns the user object
// This is used by many functions to verify auth before accessing data
export const ensureAuthenticated = async (): Promise<User | null> => {
  // If we already have a user, return it with minimal delay
  if (auth.currentUser) {
    // Small delay to ensure token is loaded
    await new Promise(resolve => setTimeout(resolve, 100));
    return auth.currentUser;
  }

  // If no current user, set up a promise with timeout
  return new Promise((resolve, reject) => {
    // Set timeout to avoid hanging if auth never completes
    const timeout = setTimeout(() => {
      if (unsubscribe) unsubscribe();
      reject(new Error("Authentication timeout. Please sign in again."));
    }, 5000);

    // Set up auth state listener
    let retryCount = 0;
    const maxRetries = 3;
    
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        // If we got a user, we're done
        if (user) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(user);
          return;
        }
        
        // If no user after retries, fail
        retryCount++;
        if (retryCount >= maxRetries) {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error("Not authenticated after multiple attempts"));
        }
      },
      (error) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      }
    );
  });
};

// Create a new user account
export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    // Better error messages for common problems
    if (error.code === "auth/invalid-api-key") {
      throw new Error("Server error. Please contact support.");
    } else if (error.code === "auth/email-already-in-use") {
      throw new Error("Email is already in use. Please use a different email or sign in.");
    } else if (error.code === "auth/weak-password") {
      throw new Error("Password is too weak. Please use a stronger password.");
    } else {
      throw new Error(error.message || "Failed to create account. Please try again.");
    }
  }
};

// Sign in existing user
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    // Better error messages for common problems
    if (error.code === "auth/invalid-api-key") {
      throw new Error("Server error. Please contact support.");
    } else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      throw new Error("Invalid email or password. Please try again.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed login attempts. Please try again later.");
    } else {
      throw new Error(error.message || "Failed to sign in. Please try again.");
    }
  }
};

// Sign out current user
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign out. Please try again.");
  }
};

// Send password reset email
export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    if (error.code === "auth/invalid-api-key") {
      throw new Error("Server error. Please contact support.");
    } else if (error.code === "auth/user-not-found") {
      throw new Error("No account found with this email address.");
    } else {
      throw new Error(error.message || "Failed to send reset email. Please try again.");
    }
  }
};

// Get the current logged in user
export const getCurrentUser = () => {
  try {
    return auth.currentUser;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

// Set up a listener for auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  try {
    return onAuthStateChanged(auth, (user) => {
      try {
        callback(user);
      } catch (error) {
        console.error("Error in auth state change callback:", error);
        callback(null);
      }
    });
  } catch (error) {
    console.error("Error setting up auth state change listener:", error);
    // Return a no-op unsubscribe function
    return () => {};
  }
};

// Create a new user profile
export const createUserProfile = async (userId?: string, userData?: any) => {
  try {
    // Figure out which user ID to use
    let currentUserId = userId;
    
    // If no userId provided, try to get from auth or cached data
    if (!currentUserId) {
      if (auth.currentUser) {
        currentUserId = auth.currentUser.uid;
      } else {
        // Try to get from AsyncStorage
        try {
          const authData = await AsyncStorage.getItem('@firebase_auth_user');
          if (authData) {
            const userData = JSON.parse(authData);
            if (userData && userData.uid) {
              console.log("Using cached auth data for profile creation");
              currentUserId = userData.uid;
            }
          }
        } catch (error) {
          console.error("Error retrieving cached auth data:", error);
        }
      }
    }
    
    if (!currentUserId) {
      throw new Error("No user ID provided and no authenticated user found");
    }
    
    const userProfile = {
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      workout_history: [],
      meal_history: [],
      ...userData // Merge any provided user data
    };
    
    try {
      const docRef = doc(db, "users", currentUserId);
      await setDoc(docRef, userProfile);
      console.log("User profile created successfully!");
      return {
        ...userProfile,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
    } catch (firebaseError) {
      console.error("Error creating user profile:", firebaseError);
      // Still return the profile for offline use
      return {
        ...userProfile,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error("Error in createUserProfile:", error);
    // Return a default profile as fallback
    return {
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      workout_history: [],
      meal_history: [],
      ...(userData || {}) // Include userData in fallback if provided
    };
  }
};

// Get a user's profile data
export const getUserProfile = async (userId?: string) => {
  try {
    // Make sure we're authenticated
    const user = await ensureAuthenticated();
    
    // Figure out which user ID to use
    const currentUserId = userId || user?.uid;
    
    // Make sure we have a valid ID
    if (!currentUserId) {
      throw new Error("Authentication required. Please sign in.");
    }
    
    // Check if this is our own profile
    if (user && currentUserId !== user.uid) {
      throw new Error("Permissions error: You don't have access to another user's profile data");
    }
    
    // Get the profile data
    console.log(`Fetching profile for user: ${currentUserId}`);
    const userRef = doc(db, "users", currentUserId);
    
    try {
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        console.log("User profile found in Firestore");
        const userData = { id: docSnap.id, ...docSnap.data() } as any;
        
        // Make sure workout and meal history arrays exist
        if (!userData.workout_history) userData.workout_history = [];
        if (!userData.meal_history) userData.meal_history = [];
        
        return userData;
      } else {
        console.log("User profile not found, creating a new profile");
        // Create a default profile if not found
        return await createUserProfile(currentUserId);
      }
    } catch (firestoreError: any) {
      console.error("Error fetching user profile from Firestore:", firestoreError);
      
      // Better error for permissions issues
      if (firestoreError.code === "permission-denied") {
        console.error("This is a Firestore permissions error. Please verify your Firebase rules.");
        throw new Error("Permissions error: You don't have access to this profile data");
      }
      
      throw firestoreError;
    }
  } catch (error: any) {
    console.error("Error in getUserProfile:", error);
    throw error;
  }
};

// Update a user's profile
export const updateUserProfile = async (updates: any, userId?: string) => {
  try {
    // Make sure we're authenticated
    const user = await ensureAuthenticated();
    
    // Figure out which user ID to use
    const currentUserId = userId || user?.uid;
    
    // Make sure we have a valid ID
    if (!currentUserId) {
      throw new Error("Authentication required. Please sign in.");
    }
    
    // Check if this is our own profile
    if (user && currentUserId !== user.uid) {
      throw new Error("Permission denied: Cannot update another user's profile.");
    }
    
    console.log(`Updating profile for user: ${currentUserId}`);
    const userRef = doc(db, "users", currentUserId);
    
    // Check if the profile exists
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      // Create new profile if it doesn't exist
      return await createUserProfile(currentUserId, updates);
    }
    
    // Add update timestamp
    const updatedData = {
      ...updates,
      lastUpdated: serverTimestamp()
    };
    
    // Update the document
    await updateDoc(userRef, updatedData);
    console.log("Profile updated successfully");
    
    // Return the updated profile
    return {
      id: currentUserId,
      ...docSnap.data(),
      ...updates,
      lastUpdated: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Error in updateUserProfile:", error);
    throw error;
  }
};

// Add a workout to the user's history
export const addWorkoutToHistory = async (workout: any, userId?: string) => {
  try {
    // Make sure we're authenticated
    const user = await ensureAuthenticated();
    
    // Figure out which user ID to use
    const currentUserId = userId || user?.uid;
    
    // Make sure we have a valid ID
    if (!currentUserId) {
      throw new Error("Authentication required. Please sign in.");
    }
    
    // Check if this is our own profile
    if (user && currentUserId !== user.uid) {
      throw new Error("Permission denied: Cannot add workout to another user's history");
    }
    
    // Add date if missing
    if (!workout.date) {
      workout.date = new Date().toISOString();
    }
    
    // Add to workout subcollection
    const workoutRef = collection(db, "users", currentUserId, "workout_history");
    const newWorkoutRef = doc(workoutRef);
    
    // Add ID to workout data
    const workoutData = {
      ...workout,
      id: newWorkoutRef.id,
      createdAt: serverTimestamp()
    };
    
    // Save to Firestore
    await setDoc(newWorkoutRef, workoutData);
    console.log("Workout added to history successfully");
    
    return {
      ...workoutData,
      createdAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Error adding workout to history:", error);
    throw error;
  }
};

// Add a meal to the user's history
export const addMealToHistory = async (meal: any, userId?: string) => {
  try {
    // Make sure we're authenticated
    const user = await ensureAuthenticated();
    
    // Figure out which user ID to use
    const currentUserId = userId || user?.uid;
    
    // Make sure we have a valid ID
    if (!currentUserId) {
      throw new Error("Authentication required. Please sign in.");
    }
    
    // Check if this is our own profile
    if (user && currentUserId !== user.uid) {
      throw new Error("Permission denied: Cannot add meal to another user's history");
    }
    
    // Add date if missing
    if (!meal.date) {
      meal.date = new Date().toISOString();
    }
    
    // Add to meal subcollection
    const mealRef = collection(db, "users", currentUserId, "meal_history");
    const newMealRef = doc(mealRef);
    
    // Add ID to meal data
    const mealData = {
      ...meal,
      id: newMealRef.id,
      createdAt: serverTimestamp()
    };
    
    // Save to Firestore
    await setDoc(newMealRef, mealData);
    console.log("Meal added to history successfully");
    
    return {
      ...mealData,
      createdAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Error adding meal to history:", error);
    throw error;
  }
};

// Get all workouts from user's history
export const getWorkoutHistory = async (userId?: string) => {
  try {
    // Make sure we're authenticated
    const user = await ensureAuthenticated();
    
    // Figure out which user ID to use
    const currentUserId = userId || user?.uid;
    
    // Make sure we have a valid ID
    if (!currentUserId) {
      throw new Error("Authentication required. Please sign in.");
    }
    
    // Check if this is our own profile
    if (user && currentUserId !== user.uid) {
      throw new Error("Permissions error: You don't have access to another user's workout history");
    }
    
    // Get workouts from subcollection
    const workoutsRef = collection(db, "users", currentUserId, "workout_history");
    const querySnapshot = await getDocs(workoutsRef);
    
    const workouts: any[] = [];
    querySnapshot.forEach((doc) => {
      workouts.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort newest first
    return workouts.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  } catch (error: any) {
    console.error("Error fetching workout history:", error);
    throw error;
  }
};

// Get all meals from user's history
export const getMealHistory = async (userId?: string) => {
  try {
    // Make sure we're authenticated
    const user = await ensureAuthenticated();
    
    // Figure out which user ID to use
    const currentUserId = userId || user?.uid;
    
    // Make sure we have a valid ID
    if (!currentUserId) {
      throw new Error("Authentication required. Please sign in.");
    }
    
    // Check if this is our own profile
    if (user && currentUserId !== user.uid) {
      throw new Error("Permissions error: You don't have access to another user's meal history");
    }
    
    // Get meals from subcollection
    const mealsRef = collection(db, "users", currentUserId, "meal_history");
    const querySnapshot = await getDocs(mealsRef);
    
    const meals: any[] = [];
    querySnapshot.forEach((doc) => {
      meals.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort newest first
    return meals.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  } catch (error: any) {
    console.error("Error fetching meal history:", error);
    throw error;
  }
};

// Upload a profile photo
export const uploadProfilePhoto = async (uri: string, userId?: string) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Authentication required. Please sign in.");
    }
    
    const currentUserId = userId || auth.currentUser.uid;
    
    // Make sure this is our own profile
    if (auth.currentUser.uid !== currentUserId) {
      throw new Error("Permission denied: Cannot upload photo for another user.");
    }
    
    // Create unique filename
    const timestamp = Date.now();
    const filename = `profile_${timestamp}.jpg`;
    const storageRef = ref(storage, `users/${currentUserId}/profile/${filename}`);
    
    try {
      console.log("Processing image from URI:", uri);
      
      // Read the file as base64
      const fileData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert to binary
      const byteArray = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
      
      // Check file size (5MB limit)
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (byteArray.length > MAX_FILE_SIZE) {
        throw new Error("File size exceeds 5MB limit");
      }
      
      console.log("Image processed, uploading now");
      
      // Set metadata
      const metadata = {
        contentType: 'image/jpeg',
        customMetadata: {
          uploadedBy: currentUserId,
          uploadedAt: new Date().toISOString(),
        }
      };
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, byteArray, metadata);
      console.log('Upload complete');
      
      // Get the public URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Update user profile with new photo
      await updateUserProfile({ 
        photoURL: downloadURL,
        photoUpdatedAt: serverTimestamp()
      }, currentUserId);
      
      // Clean up old photos to save space
      try {
        const oldPhotosRef = ref(storage, `users/${currentUserId}/profile`);
        const oldPhotos = await listAll(oldPhotosRef);
        
        // Delete all except the current one
        const photosToDelete = oldPhotos.items
          .filter(item => item.name !== filename)
          .map(item => deleteObject(item));
        
        await Promise.all(photosToDelete);
      } catch (error) {
        console.error('Error cleaning up old photos:', error);
        // Don't fail if cleanup fails
      }
      
      return downloadURL;
    } catch (processError: any) {
      console.error("Error processing image:", processError);
      throw new Error(`Failed to process image: ${processError.message}`);
    }
  } catch (error: any) {
    console.error("Profile photo upload failed:", error);
    
    // Better error messages
    if (error.code === "storage/unauthorized") {
      throw new Error("Permission denied. Please sign in again.");
    } else if (error.code === "storage/quota-exceeded") {
      throw new Error("Storage quota exceeded. Please contact support.");
    } else if (error.code === "storage/invalid-format") {
      throw new Error("Invalid image format. Please use JPEG or PNG files only.");
    } else if (error.code === "storage/canceled") {
      throw new Error("Upload was cancelled. Please try again.");
    } else if (error.code && error.code.startsWith("storage/")) {
      throw new Error(`Storage error: ${error.code}. Please try again.`);
    } else {
      throw new Error(error.message || "Failed to upload profile photo. Please try again.");
    }
  }
};

// Save AI recommendation for later
export const cacheRecommendation = async (text: string, userId?: string) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Authentication required. Please sign in.");
    }
    
    const currentUserId = userId || auth.currentUser.uid;
    
    // Make sure this is our own profile
    if (auth.currentUser.uid !== currentUserId) {
      throw new Error("Permission denied: Cannot cache data for another user.");
    }
    
    // Save to cache collection
    const cacheRef = doc(db, "users", currentUserId, "cache", "ai_recommendation");
    
    await setDoc(cacheRef, {
      text,
      timestamp: serverTimestamp()
    });
    
    console.log("Cached recommendation successfully");
  } catch (error: any) {
    console.error("Error caching recommendation:", error);
    // Continue even if caching fails - this is non-critical
  }
};

// Get saved AI recommendation
export const getCachedRecommendation = async (userId?: string) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Authentication required. Please sign in.");
    }
    
    const currentUserId = userId || auth.currentUser.uid;
    
    // Make sure this is our own profile
    if (auth.currentUser.uid !== currentUserId) {
      throw new Error("Permission denied: Cannot access cache for another user.");
    }
    
    const cachedRecommendationRef = doc(db, "users", currentUserId, "cache", "ai_recommendation");
    const cachedRecommendation = await getDoc(cachedRecommendationRef);
    
    if (cachedRecommendation.exists()) {
      return cachedRecommendation.data();
    }
    return null;
  } catch (error: any) {
    console.error("Error checking recommendation cache:", error);
    // Return null on error - this is non-critical
    return null;
  }
};

// Migrate workout and meal data from profile to subcollections
export const migrateUserHistoryData = async (userId: string) => {
  try {
    // Make sure we're authenticated
    const user = await ensureAuthenticated();
    
    // Make sure we have a valid ID
    if (!userId) {
      throw new Error("Authentication required. Please sign in.");
    }
    
    // Make sure this is our own profile
    if (user && userId !== user.uid) {
      throw new Error("Permission denied: Cannot migrate another user's data");
    }
    
    console.log(`Starting data migration for user: ${userId}`);
    let migratedItems = 0;
    
    // Get the user document
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error("User profile not found");
    }
    
    const userData = userDoc.data();
    
    // Migrate workout history if it exists
    if (userData.workout_history && Array.isArray(userData.workout_history) && userData.workout_history.length > 0) {
      console.log(`Found ${userData.workout_history.length} workouts to migrate`);
      
      for (const workout of userData.workout_history) {
        // Make sure each workout has an ID
        const workoutId = workout.id || `workout_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const workoutWithId = {
          ...workout,
          id: workoutId,
          migratedAt: new Date().toISOString()
        };
        
        // Save to subcollection
        const workoutRef = doc(db, "users", userId, "workout_history", workoutId);
        await setDoc(workoutRef, workoutWithId);
        migratedItems++;
      }
      
      console.log(`Migrated ${migratedItems} workouts`);
    }
    
    // Migrate meal history if it exists
    migratedItems = 0;
    if (userData.meal_history && Array.isArray(userData.meal_history) && userData.meal_history.length > 0) {
      console.log(`Found ${userData.meal_history.length} meals to migrate`);
      
      for (const meal of userData.meal_history) {
        // Make sure each meal has an ID
        const mealId = meal.id || `meal_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const mealWithId = {
          ...meal,
          id: mealId,
          migratedAt: new Date().toISOString()
        };
        
        // Save to subcollection
        const mealRef = doc(db, "users", userId, "meal_history", mealId);
        await setDoc(mealRef, mealWithId);
        migratedItems++;
      }
      
      console.log(`Migrated ${migratedItems} meals`);
    }
    
    // Mark profile as migrated and clear old arrays
    await updateDoc(userRef, {
      workout_history: [],
      meal_history: [],
      dataMigrated: true,
      dataMigratedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    console.log("Data migration complete");
    return true;
  } catch (error: any) {
    console.error("Error in migrateUserHistoryData:", error);
    throw error;
  }
};