import { API_CONFIG } from "@/constants/config";

// API functions for ExerciseDB
const API_HOST = API_CONFIG.exerciseDbHost;

// Exercise interface matching the API response
export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  gifUrl: string;
  secondaryMuscles: string[];
  instructions: string[];
  // Additional properties for our app
  sets?: number;
  reps?: number;
  rest?: number;
  weight?: number;
  duration?: number;
  imageUrl?: string; // Alias for gifUrl for compatibility
  category?: string; // Alias for bodyPart for compatibility
}

// Exercise search parameters
export interface ExerciseSearchParams {
  search?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  limit?: number;
  offset?: number;
}

// Search response format
export interface ExerciseSearchResponse {
  results: Exercise[];
  count: number;
  next: string | null;
  previous: string | null;
}

// Base fetch function with proper headers
const fetchFromExerciseDB = async (endpoint: string) => {
  try {
    console.log(`Fetching from: https://${API_HOST}${endpoint}`);
    
    const response = await fetch(`https://${API_HOST}${endpoint}`, {
      headers: {
        'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
        'X-RapidAPI-Host': API_HOST
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} - ${await response.text()}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error);
    throw error;
  }
};

// Get all exercises (paginated)
export const getAllExercises = async (limit = 50, offset = 0) => {
  try {
    // Updated limit to 50 to show more exercises at once
    return await fetchFromExerciseDB(`/exercises?limit=${limit}&offset=${offset}`);
  } catch (error) {
    console.error('Error fetching all exercises:', error);
    return [];
  }
};

// Get list of all body parts
export const getBodyParts = async () => {
  try {
    return await fetchFromExerciseDB('/exercises/bodyPartList');
  } catch (error) {
    console.error('Error fetching body parts:', error);
    return ["back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders", "upper arms", "upper legs", "waist"];
  }
};

// Get list of all target muscles
export const getTargetMuscles = async () => {
  try {
    return await fetchFromExerciseDB('/exercises/targetList');
  } catch (error) {
    console.error('Error fetching target muscles:', error);
    return ["abductors", "abs", "adductors", "biceps", "calves", "cardiovascular system", "delts", "forearms", "glutes", "hamstrings", "lats", "levator scapulae", "pectorals", "quads", "serratus anterior", "spine", "traps", "triceps", "upper back"];
  }
};

// Get list of all equipment
export const getEquipment = async () => {
  try {
    return await fetchFromExerciseDB('/exercises/equipmentList');
  } catch (error) {
    console.error('Error fetching equipment:', error);
    return ["assisted", "band", "barbell", "body weight", "bosu ball", "cable", "dumbbell", "elliptical machine", "ez barbell", "hammer", "kettlebell", "leverage machine", "medicine ball", "olympic barbell", "resistance band", "roller", "rope", "skierg machine", "sled machine", "smith machine", "stability ball", "stationary bike", "stepmill machine", "tire", "trap bar", "upper body ergometer", "weighted", "wheel roller"];
  }
};

// Get exercises by body part
export const getExercisesByBodyPart = async (bodyPart: string, limit = 50, offset = 0) => {
  try {
    // Updated to use pagination parameters for body part filtering
    return await fetchFromExerciseDB(`/exercises/bodyPart/${encodeURIComponent(bodyPart.toLowerCase())}?limit=${limit}&offset=${offset}`);
  } catch (error) {
    console.error(`Error fetching exercises for body part ${bodyPart}:`, error);
    return [];
  }
};

// Get exercises by target muscle
export const getExercisesByTarget = async (target: string, limit = 50, offset = 0) => {
  try {
    // Updated to use pagination parameters for target muscle filtering
    return await fetchFromExerciseDB(`/exercises/target/${encodeURIComponent(target.toLowerCase())}?limit=${limit}&offset=${offset}`);
  } catch (error) {
    console.error(`Error fetching exercises for target muscle ${target}:`, error);
    return [];
  }
};

// Get exercises by equipment
export const getExercisesByEquipment = async (equipment: string, limit = 50, offset = 0) => {
  try {
    // Updated to use pagination parameters for equipment filtering
    return await fetchFromExerciseDB(`/exercises/equipment/${encodeURIComponent(equipment.toLowerCase())}?limit=${limit}&offset=${offset}`);
  } catch (error) {
    console.error(`Error fetching exercises for equipment ${equipment}:`, error);
    return [];
  }
};

// Search exercises by name
export const searchExercisesByName = async (name: string, limit = 50, offset = 0) => {
  if (!name.trim()) return [];
  
  try {
    // Updated to use pagination parameters for name searching
    return await fetchFromExerciseDB(`/exercises/name/${encodeURIComponent(name.toLowerCase())}?limit=${limit}&offset=${offset}`);
  } catch (error) {
    console.error(`Error searching exercises by name ${name}:`, error);
    return [];
  }
};

// Get total count of exercises
export const getTotalExerciseCount = async () => {
  try {
    // The totalCount endpoint doesn't exist, so we'll use a different approach
    // First, try to get just one exercise with offset 0 to see the total count in the response
    const response = await fetchFromExerciseDB(`/exercises?limit=1&offset=0`);
    
    // Check if the response contains a count field
    if (response && typeof response.count === 'number') {
      return response.count;
    }
    
    // If there's no count field, estimate based on a typical API size
    // ExerciseDB typically has around 1300 exercises
    return 1300;
  } catch (error) {
    console.error('Error getting total exercise count:', error);
    // Return a conservative estimate if the API call fails
    return 1300;
  }
};

// Unified search function that combines all filters
export const searchExercises = async (params: ExerciseSearchParams): Promise<ExerciseSearchResponse> => {
  const { search, bodyPart, target, equipment, limit = 50, offset = 0 } = params;
  console.log(`Searching exercises with:`, params);
  
  try {
    let exercises = [];
    let totalCount = 0;
    
    // If we have a specific filter, use the specialized endpoint
    if (search && search.trim()) {
      exercises = await searchExercisesByName(search, limit, offset);
    } else if (bodyPart && bodyPart !== 'all') {
      exercises = await getExercisesByBodyPart(bodyPart, limit, offset);
    } else if (target && target !== 'all') {
      exercises = await getExercisesByTarget(target, limit, offset);
    } else if (equipment && equipment !== 'all') {
      exercises = await getExercisesByEquipment(equipment, limit, offset);
    } else {
      // No specific filter, get all exercises with pagination
      exercises = await getAllExercises(limit, offset);
    }
    
    // For API responses that include a count field
    if (exercises && typeof exercises.count === 'number') {
      totalCount = exercises.count;
      
      // If the API returns results in a 'results' field
      if (Array.isArray(exercises.results)) {
        exercises = exercises.results;
      }
    } else if (Array.isArray(exercises)) {
      // If the response is directly an array of exercises
      totalCount = exercises.length;
      
      // If we get a full page, assume there are more unless we know otherwise
      if (exercises.length === limit) {
        totalCount = Math.max(totalCount, offset + limit + limit);
      }
    } else {
      exercises = [];
      totalCount = 0;
    }
    
    console.log(`Returning ${exercises.length} exercises (offset: ${offset}, total estimate: ${totalCount})`);
    
    // Process exercises to include both API fields and app-specific fields
    const processedExercises = Array.isArray(exercises) ? exercises.map(exercise => ({
      ...exercise,
      // Add compatibility aliases
      imageUrl: exercise.gifUrl,
      category: exercise.bodyPart
    })) : [];
    
    // Return paginated results with metadata
    return {
      results: processedExercises,
      count: totalCount,
      next: offset + limit < totalCount ? `offset=${offset + limit}` : null,
      previous: offset > 0 ? `offset=${Math.max(0, offset - limit)}` : null
    };
  } catch (error) {
    console.error("Error searching exercises:", error);
    return {
      results: [],
      count: 0,
      next: null,
      previous: null
    };
  }
};

// Get a single exercise by ID
export const getExerciseById = async (id: string) => {
  try {
    const exercise = await fetchFromExerciseDB(`/exercises/exercise/${id}`);
    
    if (exercise) {
      // Add compatibility aliases
      return {
        ...exercise,
        imageUrl: exercise.gifUrl,
        category: exercise.bodyPart
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching exercise with ID ${id}:`, error);
    return null;
  }
};

// Get all exercises at once (for loading full database)
export const getAllExercisesAtOnce = async () => {
  try {
    // Use a large limit that should cover all exercises
    // ExerciseDB typically has around 1300 exercises
    const exercises = await fetchFromExerciseDB(`/exercises?limit=2000`);
    
    // Process exercises to include compatibility aliases
    return Array.isArray(exercises) ? exercises.map(exercise => ({
      ...exercise,
      imageUrl: exercise.gifUrl,
      category: exercise.bodyPart
    })) : [];
  } catch (error) {
    console.error('Error fetching all exercises at once:', error);
    return [];
  }
}; 