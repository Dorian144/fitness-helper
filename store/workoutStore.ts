import { create } from "zustand";
import { fetchExercisesWithImages, fetchMuscleGroups, getLocalExercises } from "@/services/api";
import { API_CONFIG } from "@/constants/config";
import { Exercise } from "@/services/exerciseApi";

// The old format we still need to support in some places
interface LegacyExercise {
  id: string | number;
  name: string;
  description: string;
  category: string;
  muscles: string[] | number[];
  muscles_secondary: string[] | number[];
  equipment: string[] | number[];
  sets?: number;
  reps?: number;
  rest?: number;
  duration?: number;
  videoUrl?: string | null;
  imageUrl?: string | null;
}

// Converts old exercise format to the new one
const mapLegacyToNewExercise = (exercise: LegacyExercise): Exercise => {
  return {
    id: String(exercise.id),
    name: exercise.name || 'Unknown Exercise',
    bodyPart: exercise.category || '',
    equipment: Array.isArray(exercise.equipment) && exercise.equipment.length > 0 ? 
      String(exercise.equipment[0]) : '',
    target: Array.isArray(exercise.muscles) && exercise.muscles.length > 0 ? 
      String(exercise.muscles[0]) : '',
    gifUrl: exercise.imageUrl || '',
    secondaryMuscles: Array.isArray(exercise.muscles_secondary) ? 
      exercise.muscles_secondary.map(m => String(m)) : [],
    instructions: exercise.description ? [exercise.description] : [],
    // App-specific fields
    sets: exercise.sets || 3,
    reps: exercise.reps || 12,
    rest: exercise.rest || 60,
    duration: exercise.duration,
    // Compatibility fields
    category: exercise.category || '',
    imageUrl: exercise.imageUrl || ''
  };
};

// Handles arrays with mixed formats
const mapExercisesArray = (exercises: LegacyExercise[] | Exercise[]): Exercise[] => {
  return exercises.map(ex => {
    // Check if this is already in the new format
    if ('bodyPart' in ex && 'gifUrl' in ex && 'secondaryMuscles' in ex) {
      return ex as Exercise;
    }
    // Otherwise convert from legacy format
    return mapLegacyToNewExercise(ex as LegacyExercise);
  });
};

// How we represent muscle groups in our UI
interface MuscleGroup {
  id: number;
  name: string;
  type: 'bodyPart' | 'targetMuscle' | 'equipment';
}

// The store's state type
interface WorkoutState {
  exercises: Exercise[];
  filteredExercises: Exercise[];
  selectedExercises: Exercise[];
  muscleGroups: MuscleGroup[];
  isLoading: boolean;
  error: string | null;
  fetchAllExercises: () => Promise<void>;
  fetchExercises: (page?: number, limit?: number) => Promise<void>;
  fetchExercisesByPage: (page: number, limit: number) => Promise<Exercise[]>;
  fetchMuscleGroups: () => Promise<void>;
  filterExercises: (category: string, filterType?: 'category' | 'equipment') => void;
  filterExercisesByMuscle: (muscleId: number | null) => void;
  addToWorkout: (exercise: Exercise | LegacyExercise) => void;
  removeFromWorkout: (exerciseId: string | number) => void;
  clearWorkout: () => void;
  clearError: () => void;
  _getEquipmentMatches: (equipmentName: string) => string[];
  _logEquipmentDistribution: () => Record<string, number>;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  exercises: [],
  filteredExercises: [],
  selectedExercises: [],
  muscleGroups: [],
  isLoading: false,
  error: null,
  
  // Gets all exercises at once - might be slow
  fetchAllExercises: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetchExercisesWithImages();
      const mappedExercises = mapExercisesArray(response.results);
      
      set({ 
        exercises: mappedExercises, 
        filteredExercises: mappedExercises,
        isLoading: false 
      });
    } catch (error: any) {
      console.error("Using local exercise data due to error:", error);
      // Fall back to our bundled exercises
      const localExercises = getLocalExercises();
      const mappedExercises = mapExercisesArray(localExercises);
      
      set({ 
        exercises: mappedExercises,
        filteredExercises: mappedExercises,
        error: "Could not fetch online exercises. Using local database.",
        isLoading: false 
      });
    }
  },
  
  // Wrapper for pagination
  fetchExercises: async (page = 1, limit = 25) => {
    set({ isLoading: true, error: null });
    try {
      await get().fetchExercisesByPage(page, limit);
    } catch (error: any) {
      console.error("Error fetching exercises:", error);
      set({ 
        error: "Could not fetch exercises. Please try again.",
        isLoading: false 
      });
    }
  },
  
  // Gets exercises with pagination support
  fetchExercisesByPage: async (page: number, limit: number) => {
    if (page === 1) {
      set({ isLoading: true, error: null });
    }
    
    try {
      const offset = (page - 1) * limit;
      
      // Use local data if configured that way
      if (API_CONFIG.useLocalExerciseData) {
        const localExercises = getLocalExercises();
        const paginatedExercises = localExercises.slice(offset, offset + limit);
        const mappedExercises = mapExercisesArray(paginatedExercises);
        
        // Either reset or append to the exercises array
        if (page === 1) {
          set({ 
            exercises: mappedExercises,
            filteredExercises: mappedExercises,
            isLoading: false 
          });
        } else {
          set(state => ({ 
            exercises: [...state.exercises, ...mappedExercises],
            filteredExercises: [...state.filteredExercises, ...mappedExercises],
            isLoading: false 
          }));
        }
        
        return mappedExercises;
      }
      
      // Otherwise fetch from the API
      const url = `https://exercisedb.p.rapidapi.com/exercises?limit=${limit}&offset=${offset}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
          'X-RapidAPI-Host': API_CONFIG.exerciseDbHost
        }
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Process exercises to include all fields we need
      const processedExercises: Exercise[] = data.map((exercise: any) => ({
        id: exercise.id,
        name: exercise.name,
        bodyPart: exercise.bodyPart || '',
        equipment: exercise.equipment || '',
        target: exercise.target || '',
        gifUrl: exercise.gifUrl || '',
        secondaryMuscles: exercise.secondaryMuscles || [],
        instructions: exercise.instructions || [],
        // Compatibility fields
        category: exercise.bodyPart || '',
        imageUrl: exercise.gifUrl || '',
        // Default exercise settings
        sets: 3,
        reps: 12,
        rest: 60
      }));
      
      // Update state based on page
      if (page === 1) {
        set({ 
          exercises: processedExercises,
          filteredExercises: processedExercises,
          isLoading: false 
        });
      } else {
        set(state => ({ 
          exercises: [...state.exercises, ...processedExercises],
          filteredExercises: [...state.filteredExercises, ...processedExercises],
          isLoading: false 
        }));
      }
      
      return processedExercises;
    } catch (error: any) {
      console.error("Error fetching exercises, falling back to local data:", error);
      
      // Fall back to local data when API fails
      const localExercises = getLocalExercises();
      const paginatedExercises = localExercises.slice((page - 1) * limit, page * limit);
      const mappedExercises = mapExercisesArray(paginatedExercises);
      
      if (page === 1) {
        set({ 
          exercises: mappedExercises,
          filteredExercises: mappedExercises,
          error: "Could not fetch online exercises. Using local database.",
          isLoading: false 
        });
      }
      
      return mappedExercises;
    }
  },
  
  // Gets all the muscle groups for filtering
  fetchMuscleGroups: async () => {
    try {
      const response = await fetchMuscleGroups();
      set({ muscleGroups: response.results });
    } catch (error) {
      console.error("Error fetching muscle groups:", error);
      // We don't set error state here to avoid disrupting the UI
    }
  },
  
  // Maps equipment names to handle variations and synonyms
  _getEquipmentMatches: (equipmentName: string): string[] => {
    const normalized = equipmentName.toLowerCase().trim();
    
    // Map of common equipment variations
    const equipmentMappings: Record<string, string[]> = {
      'barbell': ['olympic barbell', 'ez barbell', 'ez-barbell', 'straight barbell'],
      'dumbbell': ['dumbbells', 'dumbells'],
      'cable': ['cables', 'cable machine', 'pulley'],
      'band': ['resistance band', 'bands', 'resistance bands', 'elastic bands'],
      'body weight': ['bodyweight', 'no equipment', 'none'],
      'sled machine': ['sled', 'prowler sled', 'push sled'],
      'leverage machine': ['leverage', 'lever', 'plate loaded machine'],
      'smith machine': ['smith'],
      'kettlebell': ['kettlebells', 'kettle bell'],
      'medicine ball': ['med ball', 'medicine balls'],
      'stability ball': ['exercise ball', 'swiss ball', 'gym ball'],
      'bosu ball': ['bosu', 'balance trainer'],
      'resistance band': ['band', 'bands', 'elastic bands']
    };
    
    // Find matching equipment group
    for (const [key, aliases] of Object.entries(equipmentMappings)) {
      if (normalized === key || aliases.includes(normalized)) {
        return [key, ...aliases];
      }
    }
    
    // Return original if no mapping found
    return [normalized];
  },
  
  // Filters exercises by category or equipment
  filterExercises: (category: string, filterType?: 'category' | 'equipment') => {
    const { exercises } = get();
    const filterTypeToUse = filterType || 'category';
    
    console.log(`Filtering exercises: ${category} (${filterTypeToUse})`);
    
    // If "All" is selected, show everything
    if (category === "All") {
      set({ filteredExercises: exercises });
      return;
    }
    
    // Otherwise apply the filter
    const filtered = exercises.filter(exercise => {
      // Category filtering (simpler)
      if (filterTypeToUse === 'category') {
        const exerciseCategory = exercise.category || exercise.bodyPart || '';
        return exerciseCategory.toLowerCase() === category.toLowerCase();
      }
      
      // Equipment filtering (more complex)
      if (filterTypeToUse === 'equipment') {
        const normalizedCategory = category.toLowerCase().trim();
        const normalizedEquipment = (exercise.equipment || '').toLowerCase().trim();
        
        // Use our equipment matching system
        const categoryMatches = get()._getEquipmentMatches(normalizedCategory);
        const equipmentMatches = get()._getEquipmentMatches(normalizedEquipment);
        
        // If any match is found, include this exercise
        const isMatch = categoryMatches.some(cat => 
          equipmentMatches.includes(cat) || normalizedEquipment === cat);
        
        // Special exclusion to prevent incorrect matches
        if (normalizedCategory === 'sled machine' && normalizedEquipment === 'leverage machine') {
          return false;
        }
        
        return isMatch;
      }
      
      return false;
    });
    
    console.log(`Found ${filtered.length} matching exercises`);
    set({ filteredExercises: filtered });
  },
  
  // Filters exercises by specific muscle group ID
  filterExercisesByMuscle: (muscleId) => {
    const { exercises, muscleGroups } = get();
    
    // If no muscle selected, show all exercises
    if (!muscleId) {
      set({ filteredExercises: exercises });
      return;
    }
    
    // Find muscle info from the ID
    const muscleGroup = muscleGroups.find(m => m.id === muscleId);
    if (!muscleGroup) {
      console.log("Muscle ID not found:", muscleId);
      set({ filteredExercises: exercises });
      return;
    }
    
    const muscleName = muscleGroup.name.toLowerCase();
    const muscleType = muscleGroup.type;
    
    console.log(`Filtering by ${muscleType}: ${muscleName}`);
    
    // Apply different filters based on muscle type
    let filtered: Exercise[];
    
    if (muscleType === 'bodyPart') {
      // Body part filtering
      filtered = exercises.filter(ex => 
        (ex.bodyPart || '').toLowerCase() === muscleName || 
        (ex.category || '').toLowerCase() === muscleName
      );
    } else if (muscleType === 'targetMuscle') {
      // Target muscle filtering (includes secondary muscles)
      filtered = exercises.filter(ex => 
        (ex.target || '').toLowerCase() === muscleName ||
        (ex.secondaryMuscles || []).some(m => m.toLowerCase() === muscleName)
      );
    } else {
      // Equipment filtering
      const equipmentMatches = get()._getEquipmentMatches(muscleName);
      
      filtered = exercises.filter(ex => {
        const normalizedEquipment = (ex.equipment || '').toLowerCase().trim();
        const exerciseEquipmentMatches = get()._getEquipmentMatches(normalizedEquipment);
        
        return equipmentMatches.some(eqp => 
          exerciseEquipmentMatches.includes(eqp) || normalizedEquipment === eqp);
      });
    }
    
    console.log(`Found ${filtered.length} matching exercises`);
    set({ filteredExercises: filtered });
  },
  
  // Adds an exercise to the workout plan
  addToWorkout: (exercise) => {
    // Make sure we have a valid exercise
    if (!exercise || typeof exercise !== 'object' || !exercise.id) {
      console.error("Invalid exercise:", exercise);
      return;
    }
    
    // Ensure we have a consistent format
    const validExercise: Exercise = 'bodyPart' in exercise ? 
      exercise as Exercise : 
      mapLegacyToNewExercise(exercise as LegacyExercise);
    
    set((state) => {
      // Avoid duplicates
      if (state.selectedExercises.some((e) => e.id === validExercise.id)) {
        return state; 
      }
      
      return {
        selectedExercises: [...state.selectedExercises, validExercise],
      };
    });
  },
  
  // Removes an exercise from the workout plan
  removeFromWorkout: (exerciseId) => {
    if (exerciseId === undefined || exerciseId === null) {
      console.error("Invalid exercise ID:", exerciseId);
      return;
    }
    
    set((state) => ({
      selectedExercises: state.selectedExercises.filter(e => e && e.id !== exerciseId),
    }));
  },
  
  // Clears all selected exercises
  clearWorkout: () => {
    set({ selectedExercises: [] });
  },
  
  // Clears any error messages
  clearError: () => {
    set({ error: null });
  },
  
  // Helper for debugging equipment data
  _logEquipmentDistribution: () => {
    const { exercises } = get();
    const equipmentCounts: Record<string, number> = {};
    
    exercises.forEach(exercise => {
      const equipment = (exercise.equipment || '').toLowerCase().trim();
      if (equipment) {
        equipmentCounts[equipment] = (equipmentCounts[equipment] || 0) + 1;
      }
    });
    
    console.log("Equipment distribution:", equipmentCounts);
    return equipmentCounts;
  }
}));