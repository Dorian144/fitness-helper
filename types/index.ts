// User Profile Types
export interface UserProfile {
  name: string;
  email: string;
  age: number;
  weight: number;
  height: number;
  gender: 'male' | 'female' | 'other';
  fitness_goals: FitnessGoal[];
  activityLevel: ActivityLevel;
  workout_history: WorkoutEntry[];
  meal_history: MealEntry[];
  created_at: string;
  updated_at: string;
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';

export type FitnessGoal = 
  | 'weight_loss'
  | 'muscle_gain'
  | 'maintenance'
  | 'endurance'
  | 'strength'
  | 'flexibility'
  | 'general_fitness';

// Workout Types
export interface WorkoutEntry {
  id: string;
  type: WorkoutType;
  duration: number;
  calories_burned: number;
  date: string;
  exercises: Exercise[];
  notes?: string;
}

export type WorkoutType = 
  | 'strength'
  | 'cardio'
  | 'hiit'
  | 'yoga'
  | 'flexibility'
  | 'sports'
  | 'other';

export interface Exercise {
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  unit?: 'kg' | 'lbs' | 'km' | 'mi' | 'min';
}

// Meal Types
export interface MealEntry {
  id: string;
  name: string;
  type: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  foods: FoodItem[];
  notes?: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodItem {
  name: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// AI Recommendation Types
export interface RecommendationData {
  text: string;
  isFallback: boolean;
  timestamp: number;
  type: RecommendationType;
}

export type RecommendationType = 
  | 'workout'
  | 'nutrition'
  | 'general'
  | 'progress'
  | 'motivation';

// Progress Types
export interface DailyProgress {
  date: string;
  calories: {
    consumed: number;
    burned: number;
    target: number;
  };
  protein: {
    consumed: number;
    target: number;
  };
  water: {
    glasses: number;
    target: number;
  };
  workouts_completed: number;
  meals_logged: number;
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
} 