import { ENV } from './env';

// All our API stuff in one place - keys and settings
export const API_CONFIG = {
  enableSpoonacular: true,                       // Toggle recipe API on/off
  spoonacularApiKey: ENV.SPOONACULAR_API_KEY,    // Recipe API key from env
  openaiApiKey: ENV.OPENAI_API_KEY,              // For the AI coach recommendations
  enableAI: true,                                // Toggle AI features on/off
  exerciseDbApiKey: ENV.EXERCISEDB_API_KEY,      // For exercise database API
  exerciseDbHost: 'exercisedb.p.rapidapi.com',   // API host for exercise database
  // Toggles for using local data vs API calls
  useLocalExerciseData: false,                   // Set to true to avoid API calls for exercises
  useLocalRecipeData: false                      // Set to true to avoid API calls for recipes
};

// Firebase settings - all from environment variables
export const FIREBASE_CONFIG = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID
};

// General app settings - these control app behavior
export const APP_CONFIG = {
  recommendationCacheTime: 24 * 60 * 60 * 1000, // How long to cache AI recommendations (24h)
  maxRequestsPerMinute: 3,                      // API rate limiting stuff
  maxRequestsPerDay: 200,                       // More API rate limiting
  defaultCalorieTarget: 2000,                   // Starting calorie goal for new users
  defaultProteinPerKg: 1.6,                     // Default protein target (g per kg bodyweight)
  defaultWaterGlasses: 8,                       // Default daily water goal (8x8oz glasses)
  refreshCooldownSeconds: 20,                   // Prevent refresh button spam
};

// Type definitions so TypeScript doesn't complain
export interface ApiConfig {
  enableSpoonacular: boolean;
  spoonacularApiKey: string;
  openaiApiKey: string;
  enableAI: boolean;
  exerciseDbApiKey: string;
  exerciseDbHost: string;
  useLocalExerciseData: boolean;
  useLocalRecipeData: boolean;
}

export interface AppConfig {
  recommendationCacheTime: number;
  maxRequestsPerMinute: number;
  maxRequestsPerDay: number;
  defaultCalorieTarget: number;
  defaultProteinPerKg: number;
  defaultWaterGlasses: number;
  refreshCooldownSeconds: number;
}