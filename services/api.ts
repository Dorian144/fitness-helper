import { API_CONFIG } from "@/constants/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, getCachedRecommendation, cacheRecommendation } from "@/services/firebase";
import OpenAI from "openai";

// 🧠 AI Recommendation Setup
const openai = new OpenAI({
  apiKey: API_CONFIG.openaiApiKey,
});

// 🍽️ Mock Recipes for Testing & Fallbacks
const MOCK_RECIPES = [
      {
        id: 1001,
        name: "Chicken Caesar Salad",
        image: "https://spoonacular.com/recipeImages/chicken-caesar-salad-1001.jpg",
        readyInMinutes: 20,
        servings: 2,
        sourceUrl: "",
        calories: 350,
        protein: 28,
        carbs: 12,
        fat: 22,
        ingredients: [
          "2 chicken breasts, grilled and sliced",
          "1 head romaine lettuce, chopped",
          "2 tbsp caesar dressing",
          "1/4 cup parmesan cheese, grated",
          "1/2 cup croutons"
        ],
        instructions: [
          "Wash and chop the romaine lettuce.",
          "Grill chicken breasts and slice into strips.",
          "Toss lettuce with caesar dressing.",
          "Top with chicken, parmesan cheese, and croutons."
        ],
        diets: ["high-protein"],
        summary: "A classic Caesar salad with grilled chicken for added protein."
      },
      {
        id: 1002,
        name: "Vegetable Stir Fry",
        image: "https://spoonacular.com/recipeImages/vegetable-stir-fry-1002.jpg",
        readyInMinutes: 25,
        servings: 4,
        sourceUrl: "",
        calories: 250,
        protein: 8,
        carbs: 30,
        fat: 12,
        ingredients: [
          "2 cups broccoli florets",
          "1 red bell pepper, sliced",
          "1 carrot, julienned",
          "1 cup snap peas",
          "2 tbsp soy sauce",
          "1 tbsp sesame oil",
          "1 tsp ginger, minced",
          "2 cloves garlic, minced"
        ],
        instructions: [
          "Heat sesame oil in a wok or large pan.",
          "Add ginger and garlic, sauté for 30 seconds.",
          "Add vegetables and stir fry for 5-7 minutes until crisp-tender.",
          "Add soy sauce and toss to coat."
        ],
        diets: ["vegan", "vegetarian", "dairy-free"],
        summary: "A quick and healthy vegetable stir fry that's perfect as a side dish or main course when served over rice."
      },
      {
        id: 1003,
        name: "Greek Yogurt Parfait",
        image: "https://spoonacular.com/recipeImages/greek-yogurt-parfait-1003.jpg",
        readyInMinutes: 10,
        servings: 1,
        sourceUrl: "",
        calories: 280,
        protein: 20,
        carbs: 40,
        fat: 5,
        ingredients: [
          "1 cup Greek yogurt",
          "1/2 cup mixed berries",
          "2 tbsp honey",
          "1/4 cup granola"
        ],
        instructions: [
          "Layer half the yogurt in a glass or bowl.",
          "Add a layer of berries and a drizzle of honey.",
          "Repeat with remaining yogurt and berries.",
          "Top with granola and a final drizzle of honey."
        ],
        diets: ["vegetarian", "high-protein"],
        summary: "A protein-packed breakfast parfait that's quick to prepare and customizable with your favorite fruits and toppings."
      },
      {
        id: 1004,
        name: "Quinoa Bowl with Roasted Vegetables",
        image: "https://spoonacular.com/recipeImages/quinoa-bowl-1004.jpg",
        readyInMinutes: 40,
        servings: 2,
        sourceUrl: "",
        calories: 420,
        protein: 12,
        carbs: 65,
        fat: 14,
        ingredients: [
          "1 cup quinoa, uncooked",
          "2 cups vegetable broth",
          "1 sweet potato, diced",
          "1 zucchini, sliced",
          "1 red onion, sliced",
          "2 tbsp olive oil",
          "1 tsp cumin",
          "1/2 tsp paprika",
          "Salt and pepper to taste",
          "1 avocado, sliced"
        ],
        instructions: [
          "Preheat oven to 425°F (220°C).",
          "Toss vegetables with olive oil, cumin, paprika, salt, and pepper.",
          "Spread on a baking sheet and roast for 25-30 minutes.",
          "Meanwhile, cook quinoa in vegetable broth according to package instructions.",
          "Serve quinoa topped with roasted vegetables and sliced avocado."
        ],
        diets: ["vegan", "vegetarian", "gluten-free"],
        summary: "A nutritious and filling grain bowl featuring protein-rich quinoa and flavorful roasted vegetables."
      },
      {
        id: 1005,
        name: "Baked Salmon with Asparagus",
        image: "https://spoonacular.com/recipeImages/baked-salmon-1005.jpg",
        readyInMinutes: 30,
        servings: 2,
        sourceUrl: "",
        calories: 380,
        protein: 32,
        carbs: 10,
        fat: 24,
        ingredients: [
          "2 salmon fillets (6 oz each)",
          "1 bunch asparagus, trimmed",
          "2 tbsp olive oil",
          "1 lemon, sliced",
          "2 cloves garlic, minced",
          "1 tsp dill, dried",
          "Salt and pepper to taste"
        ],
        instructions: [
          "Preheat oven to 400°F (200°C).",
          "Place salmon and asparagus on a baking sheet.",
          "Drizzle with olive oil and sprinkle with garlic, dill, salt, and pepper.",
          "Top with lemon slices.",
          "Bake for 15-20 minutes until salmon is cooked through and asparagus is tender."
        ],
        diets: ["gluten-free", "dairy-free", "high-protein", "low-carb"],
        summary: "A simple, healthy dinner featuring omega-3 rich salmon and nutritious asparagus, all baked on one sheet for easy cleanup."
      }
    ];

// 🍽️ Recipe Search Types
interface SearchRecipesParams {
  query: string;
  diet?: string;
  intolerances?: string;
  maxReadyTime?: number;
  number?: number;
  offset?: number;
}

interface RecipeSearchResponse {
  results: any[];
  offset: number;
  number: number;
  totalResults: number;
}

// 🍽️ Recipe API Functions
export const searchRecipes = async ({
  query,
  diet,
  intolerances,
  maxReadyTime = 60,
  number = 10,
  offset = 0
}: SearchRecipesParams): Promise<RecipeSearchResponse> => {
  if (!API_CONFIG.enableSpoonacular || API_CONFIG.useLocalRecipeData) {
    console.log("Using local recipe data (config flag enabled)");
    // Return mock recipes as fallback
    
    // Filter recipes based on query string
    let filteredRecipes = MOCK_RECIPES;
    if (query) {
      const queryLower = query.toLowerCase();
      filteredRecipes = MOCK_RECIPES.filter(recipe => 
        recipe.name.toLowerCase().includes(queryLower) ||
        recipe.ingredients.some(i => i.toLowerCase().includes(queryLower)) ||
        recipe.diets.some(d => d.toLowerCase().includes(queryLower))
      );
    }
    
    // Apply diet filter if provided
    if (diet) {
      const dietLower = diet.toLowerCase();
      filteredRecipes = filteredRecipes.filter(recipe => 
        recipe.diets.some(d => d.toLowerCase() === dietLower)
      );
    }
    
    // Apply pagination
    const paginatedRecipes = filteredRecipes.slice(offset, offset + number);
    
    return {
      results: paginatedRecipes,
      offset,
      number,
      totalResults: filteredRecipes.length
    };
  }
  
  try {
    const params = new URLSearchParams({
      apiKey: API_CONFIG.spoonacularApiKey,
      query,
      number: number.toString(),
      offset: offset.toString(),
      maxReadyTime: maxReadyTime.toString(),
      addRecipeNutrition: 'true',
      addRecipeInformation: 'true',
      fillIngredients: 'true',
      instructionsRequired: 'true'
    });

    if (diet) params.append('diet', diet);
    if (intolerances) params.append('intolerances', intolerances);

    console.log(`Searching recipes with params: ${params.toString()}`);

    const response = await fetch(
      `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch recipes');
    }
    
    const data = await response.json();
    console.log(`Found ${data.results.length} recipes out of ${data.totalResults}`);
    
    // Extract and transform the recipe data
    return {
      results: data.results.map((recipe: any) => {
        // Extract nutrition info from the response
        const nutrients = recipe.nutrition?.nutrients || [];
        const findNutrient = (name: string) => {
          const nutrient = nutrients.find((n: any) => n.name === name);
          return nutrient ? nutrient.amount : 0;
        };

        return {
          id: recipe.id,
          name: recipe.title,
          image: recipe.image,
          imageType: recipe.imageType,
          readyInMinutes: recipe.readyInMinutes || 0,
          servings: recipe.servings || 1,
          sourceUrl: recipe.sourceUrl || "",
          summary: recipe.summary ? stripHtml(recipe.summary) : "",
          cuisines: recipe.cuisines || [],
          dishTypes: recipe.dishTypes || [],
          diets: recipe.diets || [],
          calories: Math.round(findNutrient('Calories')),
          protein: Math.round(findNutrient('Protein')),
          carbs: Math.round(findNutrient('Carbohydrates')),
          fat: Math.round(findNutrient('Fat')),
          // Include ingredient information if available
          ingredients: recipe.extendedIngredients?.map((i: any) => i.original) || [],
          // Include instruction steps if available
          instructions: recipe.analyzedInstructions && recipe.analyzedInstructions.length > 0 
            ? recipe.analyzedInstructions[0].steps.map((s: any) => s.step) 
            : []
        };
      }),
      offset,
      number,
      totalResults: data.totalResults
    };
  } catch (error) {
    console.error('Error searching recipes:', error);
    throw error;
  }
};

// Get detailed recipe information
export const getRecipeById = async (id: number) => {
  try {
    const params = new URLSearchParams({
      apiKey: API_CONFIG.spoonacularApiKey,
      includeNutrition: 'true'
    });

    console.log(`Fetching recipe details for ID: ${id}`);

    const response = await fetch(
      `https://api.spoonacular.com/recipes/${id}/information?${params.toString()}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch recipe details');
    }
    
    const recipe = await response.json();
    
    // Extract steps from analyzed instructions
    let instructionSteps = [];
    if (recipe.analyzedInstructions && recipe.analyzedInstructions.length > 0) {
      instructionSteps = recipe.analyzedInstructions[0].steps.map((step: any) => step.step);
    }
    
    // If no structured instructions are available but there's text instructions
    if (!instructionSteps.length && recipe.instructions) {
      // Split by periods or line breaks
      instructionSteps = recipe.instructions
        .split(/\.\s+|[\r\n]+/)
        .map((step: string) => step.trim())
        .filter((step: string) => step.length > 0)
        .map((step: string) => step.endsWith('.') ? step : step + '.');
    }
    
    // Log what we found
    console.log(`Recipe ${recipe.title} details:`, {
      hasIngredients: recipe.extendedIngredients && recipe.extendedIngredients.length > 0,
      ingredientsCount: recipe.extendedIngredients?.length || 0,
      hasInstructions: instructionSteps.length > 0, 
      instructionsCount: instructionSteps.length,
      hasSourceUrl: !!recipe.sourceUrl,
      sourceUrl: recipe.sourceUrl
    });
    
    return {
      id: recipe.id,
      name: recipe.title,
      image: recipe.image,
      readyInMinutes: recipe.readyInMinutes,
      servings: recipe.servings,
      sourceUrl: recipe.sourceUrl || "",
      calories: recipe.nutrition?.nutrients.find((n: any) => n.name === 'Calories')?.amount || 0,
      protein: recipe.nutrition?.nutrients.find((n: any) => n.name === 'Protein')?.amount || 0,
      carbs: recipe.nutrition?.nutrients.find((n: any) => n.name === 'Carbohydrates')?.amount || 0,
      fat: recipe.nutrition?.nutrients.find((n: any) => n.name === 'Fat')?.amount || 0,
      ingredients: recipe.extendedIngredients?.map((i: any) => i.original) || [],
      instructions: instructionSteps,
      summary: stripHtml(recipe.summary || ""),
      diets: recipe.diets || [],
      dishTypes: recipe.dishTypes || []
    };
  } catch (error) {
    console.error('Error fetching recipe details:', error);
    throw error;
  }
};

// Search recipes by ingredients
export const searchRecipesByIngredients = async (ingredients: string[], number: number = 10) => {
  try {
    const params = new URLSearchParams({
      apiKey: API_CONFIG.spoonacularApiKey,
      ingredients: ingredients.join(','),
      number: number.toString(),
      ranking: '2',
      ignorePantry: 'true'
    });

    const response = await fetch(
      `https://api.spoonacular.com/recipes/findByIngredients?${params.toString()}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch recipes by ingredients');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error searching recipes by ingredients:', error);
    throw error;
  }
};

// Helper to clean up HTML in text
const stripHtml = (html: string): string => {
  if (!html) return "";
  
  // Replace common HTML entities
  const decodedHtml = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n');
  
  // Strip all remaining tags
  return decodedHtml.replace(/<[^>]*>?/gm, '').trim();
};

// 🏋️ ExerciseDB Types
export interface ExerciseDbExercise {
  bodyPart: string;
  equipment: string;
  gifUrl: string;
  id: string;
  name: string;
  target: string;
  secondaryMuscles: string[];
  instructions: string[];
}

// Convert ExerciseDB format to our app format
export const mapExerciseDbToAppFormat = (exercise: ExerciseDbExercise) => {
  return {
    id: exercise.id,
    name: exercise.name,
    description: exercise.instructions ? exercise.instructions.join(' ') : 'No description available.',
    category: exercise.bodyPart,
    muscles: [exercise.target], // Primary target muscle
    muscles_secondary: exercise.secondaryMuscles || [],
    equipment: [exercise.equipment],
    sets: 3,
    reps: 12,
    rest: 90,
    duration: exercise.name.toLowerCase().includes('hold') ? 30 : undefined,
    videoUrl: null,
    imageUrl: exercise.gifUrl
  };
};

// 🏋️ Exercise API Functions

// Fetch all exercises from ExerciseDB
export const fetchExercisesWithImages = async () => {
  // Use local data if configured that way
  if (API_CONFIG.useLocalExerciseData) {
    console.log("Using local exercise data (config flag enabled)");
    const localExercises = getLocalExercises();
    return {
      results: localExercises,
      count: localExercises.length
    };
  }

  try {
    console.log("Fetching exercises from ExerciseDB API...");

    // Helper function for retrying API calls
    const fetchWithRetry = async (url: string, retries = 3) => {
      let lastError;
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
              'X-RapidAPI-Host': API_CONFIG.exerciseDbHost
            }
          });
    
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Attempt ${i+1} failed:`, response.status, errorText);
            lastError = new Error(`Request failed: ${response.status}`);
            continue;
          }
          
          return await response.json();
        } catch (err) {
          console.error(`Attempt ${i+1} error:`, err);
          lastError = err;
        }
      }
      throw lastError;
    };

    // Strategy 1: Try getting all exercises at once
    let allExercises: ExerciseDbExercise[] = [];
    try {
      console.log("Fetching all exercises...");
      const data = await fetchWithRetry("https://exercisedb.p.rapidapi.com/exercises?limit=1300");
      console.log(`Successfully fetched ${data.length} exercises`);
      allExercises = data;
    } catch (error) {
      console.error("Failed to fetch all exercises at once:", error);
      console.log("Trying alternative approach - fetching by body parts...");
      
      // Strategy 2: Get all body parts and fetch exercises for each
      try {
        // Get the list of body parts
        const bodyParts = await fetchWithRetry("https://exercisedb.p.rapidapi.com/exercises/bodyPartList");
        console.log(`Got ${bodyParts.length} body parts, fetching exercises for each...`);
        
        // Track our fetching progress
        let totalExercisesFetched = 0;

        // Fetch exercises for each body part
        for (const bodyPart of bodyParts) {
          try {
            const url = `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${bodyPart}?limit=1000`;
            console.log(`Fetching exercises for ${bodyPart}...`);
            const exercises = await fetchWithRetry(url);
            console.log(`Fetched ${exercises.length} exercises for ${bodyPart}`);
            totalExercisesFetched += exercises.length;
            
            // Add to our collection, avoiding duplicates
            exercises.forEach((exercise: ExerciseDbExercise) => {
              if (!allExercises.some(ex => ex.id === exercise.id)) {
                allExercises.push(exercise);
              }
            });
          } catch (err) {
            console.error(`Failed to fetch exercises for ${bodyPart}:`, err);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`Total exercises fetched from all body parts: ${totalExercisesFetched}`);
        console.log(`Unique exercises after deduplication: ${allExercises.length}`);
      } catch (error) {
        console.error("Failed to fetch exercises by body part:", error);
        
        // Strategy 3: Try to get exercises by name search
        try {
          console.log("Trying to fetch exercises by name search...");
          const commonWords = ["push", "pull", "squat", "bench", "press", "curl", "extension", "row", "deadlift", "lunge"];
          
          for (const word of commonWords) {
            try {
              const url = `https://exercisedb.p.rapidapi.com/exercises/name/${word}?limit=1000`;
              console.log(`Searching for "${word}" exercises...`);
              const exercises = await fetchWithRetry(url);
              console.log(`Found ${exercises.length} "${word}" exercises`);
              
              // Add to our collection, avoiding duplicates
              exercises.forEach((exercise: ExerciseDbExercise) => {
                if (!allExercises.some(ex => ex.id === exercise.id)) {
                  allExercises.push(exercise);
                }
              });
              
              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
              console.error(`Failed to search for "${word}" exercises:`, err);
            }
          }
          
          console.log(`Total exercises found through search: ${allExercises.length}`);
        } catch (error) {
          console.error("Failed to fetch exercises by search:", error);
          throw new Error("Could not fetch exercises from the API using any method");
        }
      }
    }
    
    console.log(`Total exercises fetched: ${allExercises.length}`);
    
    // If we got very few exercises, add local data as backup
    if (allExercises.length < 50) {
      console.warn("Warning: Very few exercises fetched from API. Using local data as backup.");
      const localExercises = getLocalExercises();
      console.log(`Added ${localExercises.length} local exercises as backup`);
      
      // Combine API exercises with local exercises, avoiding duplicates
      localExercises.forEach(localEx => {
        if (!allExercises.some(apiEx => apiEx.id === localEx.id)) {
          allExercises.push({
            id: localEx.id,
            name: localEx.name,
            bodyPart: localEx.category,
            equipment: localEx.equipment[0],
            target: localEx.muscles[0],
            secondaryMuscles: localEx.muscles_secondary,
            instructions: localEx.description.split('. '),
            gifUrl: localEx.imageUrl
          } as ExerciseDbExercise);
        }
      });
    }
    
    // Process the ExerciseDB response into our app format
    const processedResults = allExercises.map((exercise: ExerciseDbExercise) => 
      mapExerciseDbToAppFormat(exercise)
    );
    
    return {
      results: processedResults,
      count: processedResults.length
    };
  } catch (error) {
    console.error("Error fetching exercises from ExerciseDB:", error);
    
    // Use local fallback data when API fails
    console.log("Using local fallback exercise data");
    const localExercises = getLocalExercises();
    
    return {
      results: localExercises,
      count: localExercises.length
    };
  }
};

// Fetch muscle groups, body parts, and equipment from ExerciseDB
export const fetchMuscleGroups = async () => {
  // Use local data if configured that way
  if (API_CONFIG.useLocalExerciseData) {
    console.log("Using local muscle groups data (config flag enabled)");
    const fallbackMuscleGroups = [
      { id: 1, name: "Chest", isFront: true, type: 'bodyPart' },
      { id: 2, name: "Back", isFront: false, type: 'bodyPart' },
      { id: 3, name: "Shoulders", isFront: true, type: 'bodyPart' },
      { id: 4, name: "Upper arms", isFront: true, type: 'bodyPart' },
      { id: 5, name: "Lower arms", isFront: true, type: 'bodyPart' },
      { id: 6, name: "Waist", isFront: true, type: 'bodyPart' },
      { id: 7, name: "Upper legs", isFront: true, type: 'bodyPart' },
      { id: 8, name: "Lower legs", isFront: true, type: 'bodyPart' },
      { id: 9, name: "Cardio", isFront: true, type: 'bodyPart' },
      { id: 10, name: "Neck", isFront: true, type: 'bodyPart' },
      { id: 11, name: "Biceps", isFront: true, type: 'targetMuscle' },
      { id: 12, name: "Triceps", isFront: true, type: 'targetMuscle' },
      { id: 13, name: "Abs", isFront: true, type: 'targetMuscle' },
      { id: 14, name: "Quads", isFront: true, type: 'targetMuscle' },
      { id: 15, name: "Hamstrings", isFront: false, type: 'targetMuscle' },
      { id: 16, name: "Calves", isFront: true, type: 'targetMuscle' },
      { id: 17, name: "Glutes", isFront: false, type: 'targetMuscle' },
      { id: 18, name: "Lats", isFront: false, type: 'targetMuscle' },
      { id: 19, name: "Traps", isFront: false, type: 'targetMuscle' },
      { id: 20, name: "Forearms", isFront: true, type: 'targetMuscle' }
    ];
    
    return {
      results: fallbackMuscleGroups
    };
  }

  try {
    console.log("Fetching muscle groups from ExerciseDB API...");
    
    // First, get the body parts list
    const bodyPartsResponse = await fetch("https://exercisedb.p.rapidapi.com/exercises/bodyPartList", {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
        'X-RapidAPI-Host': API_CONFIG.exerciseDbHost
      }
    });
    
    if (!bodyPartsResponse.ok) {
      const errorText = await bodyPartsResponse.text();
      console.error("Failed to fetch body parts:", bodyPartsResponse.status, errorText);
      throw new Error(`Failed to fetch body parts: ${bodyPartsResponse.status}`);
    }
    
    const bodyParts = await bodyPartsResponse.json();
    console.log(`Fetched ${bodyParts.length} body parts from API:`, bodyParts);
    
    // Then, get the target muscles list
    const targetMusclesResponse = await fetch("https://exercisedb.p.rapidapi.com/exercises/targetList", {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
        'X-RapidAPI-Host': API_CONFIG.exerciseDbHost
      }
    });
    
    if (!targetMusclesResponse.ok) {
      const errorText = await targetMusclesResponse.text();
      console.error("Failed to fetch target muscles:", targetMusclesResponse.status, errorText);
      throw new Error(`Failed to fetch target muscles: ${targetMusclesResponse.status}`);
    }
    
    const targetMuscles = await targetMusclesResponse.json();
    console.log(`Fetched ${targetMuscles.length} target muscles from API:`, targetMuscles);
    
    // Get the equipment list
    const equipmentResponse = await fetch("https://exercisedb.p.rapidapi.com/exercises/equipmentList", {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
        'X-RapidAPI-Host': API_CONFIG.exerciseDbHost
      }
    });
    
    if (!equipmentResponse.ok) {
      const errorText = await equipmentResponse.text();
      console.error("Failed to fetch equipment list:", equipmentResponse.status, errorText);
      throw new Error(`Failed to fetch equipment list: ${equipmentResponse.status}`);
    }
    
    const equipmentList = await equipmentResponse.json();
    console.log(`Fetched ${equipmentList.length} equipment items from API:`, equipmentList);
    
    // Combine all lists into a comprehensive muscle groups array
    const combinedGroups = [
      ...bodyParts.map((part: string, index: number) => ({
        id: index + 1,
        name: typeof part === 'string' ? part.charAt(0).toUpperCase() + part.slice(1) : String(part),
        isFront: true,
        type: 'bodyPart'
      })),
      ...targetMuscles.map((muscle: string, index: number) => ({
        id: bodyParts.length + index + 1,
        name: typeof muscle === 'string' ? muscle.charAt(0).toUpperCase() + muscle.slice(1) : String(muscle),
        isFront: true,
        type: 'targetMuscle'
      })),
      ...equipmentList.map((equipment: string, index: number) => ({
        id: bodyParts.length + targetMuscles.length + index + 1,
        name: typeof equipment === 'string' ? equipment.charAt(0).toUpperCase() + equipment.slice(1) : String(equipment),
        isFront: true,
        type: 'equipment'
      }))
    ];
    
    return {
      results: combinedGroups
    };
  } catch (error) {
    console.error("Error fetching muscle groups:", error);
    
    // Fallback with a predefined list if API fails
    console.log("Using fallback muscle groups data");
    const fallbackMuscleGroups = [
      { id: 1, name: "Chest", isFront: true, type: 'bodyPart' },
      { id: 2, name: "Back", isFront: false, type: 'bodyPart' },
      { id: 3, name: "Shoulders", isFront: true, type: 'bodyPart' },
      { id: 4, name: "Upper arms", isFront: true, type: 'bodyPart' },
      { id: 5, name: "Lower arms", isFront: true, type: 'bodyPart' },
      { id: 6, name: "Waist", isFront: true, type: 'bodyPart' },
      { id: 7, name: "Upper legs", isFront: true, type: 'bodyPart' },
      { id: 8, name: "Lower legs", isFront: true, type: 'bodyPart' },
      { id: 9, name: "Cardio", isFront: true, type: 'bodyPart' },
      { id: 10, name: "Neck", isFront: true, type: 'bodyPart' },
      { id: 11, name: "Biceps", isFront: true, type: 'targetMuscle' },
      { id: 12, name: "Triceps", isFront: true, type: 'targetMuscle' },
      { id: 13, name: "Abs", isFront: true, type: 'targetMuscle' },
      { id: 14, name: "Quads", isFront: true, type: 'targetMuscle' },
      { id: 15, name: "Hamstrings", isFront: false, type: 'targetMuscle' },
      { id: 16, name: "Calves", isFront: true, type: 'targetMuscle' },
      { id: 17, name: "Glutes", isFront: false, type: 'targetMuscle' },
      { id: 18, name: "Lats", isFront: false, type: 'targetMuscle' },
      { id: 19, name: "Traps", isFront: false, type: 'targetMuscle' },
      { id: 20, name: "Forearms", isFront: true, type: 'targetMuscle' }
    ];
    
    return {
      results: fallbackMuscleGroups
    };
  }
};

// Fetch exercises for a specific muscle target
export const fetchExercisesByMuscle = async (targetMuscle: string) => {
  if (!targetMuscle) return { results: [] };
  
  if (API_CONFIG.useLocalExerciseData) {
    console.log(`Using local data for muscle target: ${targetMuscle}`);
    const localExercises = getLocalExercises();
    const filteredExercises = localExercises.filter(ex => 
      Array.isArray(ex.muscles) && ex.muscles.some(muscle => {
        if (typeof muscle === 'string') {
          return muscle.toLowerCase() === targetMuscle.toLowerCase();
        } else if (typeof muscle === 'object' && muscle !== null) {
          // Type assertion to avoid TypeScript errors
          const muscleObj = muscle as { name: string };
          return muscleObj.name && muscleObj.name.toLowerCase() === targetMuscle.toLowerCase();
        }
        return false;
      })
    );
    
    return {
      results: filteredExercises,
      count: filteredExercises.length
    };
  }
  
  try {
    console.log(`Fetching exercises for muscle target: ${targetMuscle}`);
    const normalizedTarget = targetMuscle.toLowerCase().trim();
    
    const response = await fetch(`https://exercisedb.p.rapidapi.com/exercises/target/${encodeURIComponent(normalizedTarget)}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
        'X-RapidAPI-Host': API_CONFIG.exerciseDbHost
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Fetched ${data.length} exercises for muscle: ${targetMuscle}`);
    
    // Process the data to match our app's exercise format
    const processedExercises = data.map((exercise: ExerciseDbExercise) => 
      mapExerciseDbToAppFormat(exercise)
    );
    
    return {
      results: processedExercises,
      count: processedExercises.length
    };
  } catch (error) {
    console.error(`Error fetching exercises for muscle ${targetMuscle}:`, error);
    
    // Fall back to local data
    console.log(`Using local data fallback for muscle: ${targetMuscle}`);
    const localExercises = getLocalExercises();
    const filteredExercises = localExercises.filter(ex => 
      Array.isArray(ex.muscles) && ex.muscles.some(muscle => {
        if (typeof muscle === 'string') {
          return muscle.toLowerCase() === targetMuscle.toLowerCase();
        } else if (typeof muscle === 'object' && muscle !== null) {
          // Type assertion to avoid TypeScript errors
          const muscleObj = muscle as { name: string };
          return muscleObj.name && muscleObj.name.toLowerCase() === targetMuscle.toLowerCase();
        }
        return false;
      })
    );
    
    return {
      results: filteredExercises,
      count: filteredExercises.length
    };
  }
};

// Fetch exercises for a specific body part
export const fetchExercisesByBodyPart = async (bodyPart: string) => {
  if (!bodyPart) return { results: [] };
  
  if (API_CONFIG.useLocalExerciseData) {
    console.log(`Using local data for body part: ${bodyPart}`);
    const localExercises = getLocalExercises();
    const filteredExercises = localExercises.filter(ex => 
      ex.category && ex.category.toLowerCase() === bodyPart.toLowerCase()
    );
    
    return {
      results: filteredExercises,
      count: filteredExercises.length
    };
  }
  
  try {
    console.log(`Fetching exercises for body part: ${bodyPart}`);
    const normalizedBodyPart = bodyPart.toLowerCase().trim();
    
    const response = await fetch(`https://exercisedb.p.rapidapi.com/exercises/bodyPart/${encodeURIComponent(normalizedBodyPart)}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
        'X-RapidAPI-Host': API_CONFIG.exerciseDbHost
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Fetched ${data.length} exercises for body part: ${bodyPart}`);
    
    // Process the data to match our app's exercise format
    const processedExercises = data.map((exercise: ExerciseDbExercise) => 
      mapExerciseDbToAppFormat(exercise)
    );
    
    return {
      results: processedExercises,
      count: processedExercises.length
    };
  } catch (error) {
    console.error(`Error fetching exercises for body part ${bodyPart}:`, error);
    
    // Fall back to local data
    console.log(`Using local data fallback for body part: ${bodyPart}`);
    const localExercises = getLocalExercises();
    const filteredExercises = localExercises.filter(ex => 
      ex.category && ex.category.toLowerCase() === bodyPart.toLowerCase()
    );
    
    return {
      results: filteredExercises,
      count: filteredExercises.length
    };
  }
};

// Default AI recommendations
export const getDefaultRecommendation = (userData: any) => {
  if (!userData) return "Hey! Fill out your profile so I can give you some personalized tips!";
  
  // Get user gender for gender-appropriate tips
  const gender = userData.gender || 'not specified';
  
  // Updated default tips library organized by category
  const DEFAULT_TIPS = {
    general: [
      "Getting 8 hours of sleep helps your body recover properly.",
      "Keep up the tracking—consistency is where the magic happens!",
      "Mixing up your routine every month prevents plateaus and keeps things fresh."
    ],
    hydration: [
      "Aim for those 8 glasses daily—your body loves that hydration!",
      "Try having water before meals—helps with portion control and keeps you hydrated.",
      "Use the water tracker to keep tabs on your daily intake—it's a game-changer!"
    ],
    workouts: [
      "Logging your workouts helps you see your progress over time.",
      "Mix in both strength and cardio for a well-rounded fitness routine.",
      "Give muscle groups 48 hours to recover between intense sessions.",
      "Adding 5-10 minutes of mobility work before workouts can make a huge difference.",
      "Try to up your weights or reps a bit each week—that's progressive overload!"
    ],
    nutrition: [
      "Get enough protein (about 1.6-2.2g per kg of your weight) to help with recovery.",
      "Try to include some protein with each meal for better muscle maintenance.",
      "Whole foods beat processed stuff any day for overall nutrition.",
      "Meal prepping on weekends can save you from bad food choices during busy days.",
      "Tracking your macros gives you a better picture of what you're actually eating."
    ],
    weightLoss: [
      "A small calorie deficit (300-500 calories) is great for sustainable weight loss.",
      "High-protein meals help maintain muscle while you're dropping fat.",
      "HIIT workouts are awesome for efficient calorie burning in less time."
    ],
    muscleGain: [
      "Eat in a slight surplus (about 200-300 extra calories) to fuel muscle growth.",
      "Focus on compound lifts like squats and deadlifts for maximum muscle stimulation.",
      "Splitting workouts by muscle groups gives proper recovery time."
    ],
    endurance: [
      "Add about 10% more time to your cardio sessions each week to build endurance.",
      "Interval training is great for boosting your cardiovascular efficiency.",
      "Fuel up with complex carbs before longer cardio sessions for sustained energy."
    ],
    flexibility: [
      "Just 10-15 minutes of daily stretching can really improve your flexibility.",
      "Yoga once or twice a week is awesome for both flexibility and recovery.",
      "Hold each stretch for 30 seconds to really get those muscle fibers lengthening."
    ],
    // Gender-specific tips
    male: [
      "Push-pull-leg splits can be great for targeting muscle groups efficiently.",
      "Adding creatine (5g daily) might help with those strength gains if that's your goal.",
      "Focus on proper form with compound lifts to avoid lower back issues."
    ],
    female: [
      "Resistance training helps boost metabolism and build lean muscle.",
      "Iron-rich foods can be helpful for maintaining energy levels during workouts.",
      "Including hip and glute exercises can help maintain good alignment during workouts."
    ],
    // New category for streak recovery messages
    streakRecovery: [
      "Looks like you missed a couple days—that's totally okay! Let's restart with a quick 15-minute workout today.",
      "Hey, life happens! Ready to get back on track with a fresh start? Even a short walk counts today.",
      "Missing a few days is part of the journey. How about we ease back in with something fun today?",
      "Welcome back! Everyone needs breaks sometimes. Let's rebuild that streak with something simple today.",
      "Breaks are normal in any fitness journey! Let's pick up where we left off with whatever feels good today."
    ]
  };
  
  // Extract user data
  const goals = Array.isArray(userData.fitness_goals) ? userData.fitness_goals : [];
  const workoutHistory = Array.isArray(userData.workout_history) ? userData.workout_history : [];
  const mealHistory = Array.isArray(userData.meal_history) ? userData.meal_history : [];
  const waterIntake = userData.water_intake || {};
  
  // Analyze user data
  const workoutCount = workoutHistory.length;
  const mealCount = mealHistory.length;
  
  // Get today's date
  const today = new Date().toISOString().split("T")[0];
  
  // Get yesterday and day before yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];
  
  // Check water intake for today
  const todayWaterIntake = waterIntake[today] || 0;
  
  // Create personalized recommendation
  let recommendation = "";
  
  // Check if streak was lost (no workout for at least 2 days)
  const lostStreak = workoutCount > 0 && workoutHistory.length > 3;
  
  if (lostStreak) {
    // Get unique dates from workout history
    const uniqueDates = [...new Set(
      workoutHistory
        .filter((item: any) => item && item.date && typeof item.date === 'string')
        .map((item: any) => item.date.split('T')[0])
    )].sort((a, b) => {
      // Explicitly cast unknown types to string for comparison
      const dateA = a as string;
      const dateB = b as string;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    
    // Check if most recent workout is from more than 2 days ago
    if (uniqueDates.length > 0 && 
        uniqueDates[0] !== today && 
        uniqueDates[0] !== yesterdayStr && 
        uniqueDates[0] !== twoDaysAgoStr) {
      // User has lost their streak
      recommendation += DEFAULT_TIPS.streakRecovery[Math.floor(Math.random() * DEFAULT_TIPS.streakRecovery.length)] + " ";
    } else {
      // Normal greeting based on workout history
      if (workoutCount === 0) {
        recommendation += "Hey there! Ready to start your fitness journey? ";
      } else if (workoutCount < 5) {
        recommendation += "Nice start on your workouts! ";
      } else if (workoutCount < 20) {
        recommendation += "You're building some solid workout habits! ";
      } else {
        recommendation += "Wow, loving your workout consistency! ";
      }
    }
  } else {
    // Normal greeting based on workout history
    if (workoutCount === 0) {
      recommendation += "Hey there! Ready to start your fitness journey? ";
    } else if (workoutCount < 5) {
      recommendation += "Nice start on your workouts! ";
    } else if (workoutCount < 20) {
      recommendation += "You're building some solid workout habits! ";
    } else {
      recommendation += "Wow, loving your workout consistency! ";
    }
  }
  
  // Add goal-specific recommendations
  if (goals.includes('weight_loss')) {
    recommendation += DEFAULT_TIPS.weightLoss[Math.floor(Math.random() * DEFAULT_TIPS.weightLoss.length)] + " ";
  } else if (goals.includes('muscle_gain')) {
    recommendation += DEFAULT_TIPS.muscleGain[Math.floor(Math.random() * DEFAULT_TIPS.muscleGain.length)] + " ";
  } else if (goals.includes('endurance')) {
    recommendation += DEFAULT_TIPS.endurance[Math.floor(Math.random() * DEFAULT_TIPS.endurance.length)] + " ";
  } else if (goals.includes('flexibility')) {
    recommendation += DEFAULT_TIPS.flexibility[Math.floor(Math.random() * DEFAULT_TIPS.flexibility.length)] + " ";
  }
  
  // Add hydration tip if water intake is low
  if (todayWaterIntake < 4) {
    recommendation += DEFAULT_TIPS.hydration[Math.floor(Math.random() * DEFAULT_TIPS.hydration.length)] + " ";
  }
  
  // Add workout tip based on history
  if (workoutCount < 10) {
    recommendation += DEFAULT_TIPS.workouts[Math.floor(Math.random() * 2)] + " "; // First two tips for beginners
  } else {
    recommendation += DEFAULT_TIPS.workouts[2 + Math.floor(Math.random() * (DEFAULT_TIPS.workouts.length - 2))] + " ";
  }
  
  // Add nutrition tip based on meal tracking
  if (mealCount < 10) {
    recommendation += DEFAULT_TIPS.nutrition[Math.floor(Math.random() * 2)] + " ";
  } else {
    recommendation += DEFAULT_TIPS.nutrition[2 + Math.floor(Math.random() * (DEFAULT_TIPS.nutrition.length - 2))] + " ";
  }
  
  // Add gender-appropriate tip if available
  if (gender === 'male' && DEFAULT_TIPS.male && DEFAULT_TIPS.male.length > 0) {
    recommendation += DEFAULT_TIPS.male[Math.floor(Math.random() * DEFAULT_TIPS.male.length)] + " ";
  } else if (gender === 'female' && DEFAULT_TIPS.female && DEFAULT_TIPS.female.length > 0) {
    recommendation += DEFAULT_TIPS.female[Math.floor(Math.random() * DEFAULT_TIPS.female.length)] + " ";
  }
  
  // Finish with motivational tip
  recommendation += DEFAULT_TIPS.general[Math.floor(Math.random() * DEFAULT_TIPS.general.length)];
  
  return recommendation;
};

// Validate user data before making OpenAI API call
export const validateUserData = (userData: any) => {
  // Check if we have the minimum required data
  if (!userData || 
      !userData.weight || 
      !userData.height || 
      !userData.fitness_goals || 
      !userData.fitness_goals.length) {
    return null;
  }
  
  // Define interface for the sanitized data
  interface SanitizedUserData {
    name: string;
    age: number;
    weight: number;
    height: number;
    gender: string;
    activityLevel: string;
    fitness_goals: string[];
    recentProgress: {
      workoutCount: number;
      mealCount: number;
      hasWaterData: boolean;
    };
    bmi?: number;
    workout_preferences?: any;
    meal_preferences?: any;
    weight_history?: any[];
  }
  
  // Create a sanitized copy with just the essential data
  const sanitizedData: SanitizedUserData = {
    // Basic profile data - explicitly exclude email
    name: userData.name || 'User',
    age: userData.age || 30,
    weight: Number(userData.weight) || 70,
    height: Number(userData.height) || 170,
    gender: userData.gender || 'not specified',
    activityLevel: userData.activityLevel || 'moderate',
    
    // Convert goals to ensure they are in proper format
    fitness_goals: Array.isArray(userData.fitness_goals) 
      ? userData.fitness_goals.filter((goal: any) => typeof goal === 'string')
      : [],
      
    // Include recent progress data if available
    recentProgress: {
      workoutCount: Array.isArray(userData.workout_history) ? userData.workout_history.length : 0,
      mealCount: Array.isArray(userData.meal_history) ? userData.meal_history.length : 0,
      hasWaterData: userData.water_intake && typeof userData.water_intake === 'object' 
        ? Object.keys(userData.water_intake).length > 0 
        : false
    }
  };
  
  // Format BMI for reference
  const heightInMeters = sanitizedData.height / 100;
  sanitizedData.bmi = sanitizedData.weight / (heightInMeters * heightInMeters);
  
  // Include additional preferences data if available
  if (userData.workout_preferences) {
    sanitizedData.workout_preferences = userData.workout_preferences;
  }
  
  if (userData.meal_preferences) {
    sanitizedData.meal_preferences = userData.meal_preferences;
  }
  
  // Include weight history for trend analysis if available
  if (Array.isArray(userData.weight_history) && userData.weight_history.length > 0) {
    sanitizedData.weight_history = userData.weight_history;
  }
  
  return sanitizedData;
};

// User request rate limiting
const userRequestTimestamps: Record<string, number[]> = {};
const MAX_REQUESTS_PER_MINUTE = 3;
const MAX_REQUESTS_PER_DAY = 200;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const isRateLimited = (userId: string): boolean => {
  const now = Date.now();
  
  // Initialize if first request
  if (!userRequestTimestamps[userId]) {
    userRequestTimestamps[userId] = [];
  }
  
  // Filter timestamps to keep only recent ones
  const recentTimestamps = userRequestTimestamps[userId].filter(
    timestamp => now - timestamp < DAY_MS
  );
  
  // Check daily limit
  if (recentTimestamps.length >= MAX_REQUESTS_PER_DAY) {
    console.log(`User ${userId} exceeded daily limit of ${MAX_REQUESTS_PER_DAY} requests`);
    return true;
  }
  
  // Check per-minute limit
  const lastMinuteTimestamps = recentTimestamps.filter(
    timestamp => now - timestamp < MINUTE_MS
  );
  
  if (lastMinuteTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    console.log(`User ${userId} exceeded per-minute limit of ${MAX_REQUESTS_PER_MINUTE} requests`);
    return true;
  }
  
  // Add current timestamp and allow the request
  userRequestTimestamps[userId] = [...recentTimestamps, now];
  return false;
};

// Check if cache is expired (older than 24 hours)
const isCacheExpired = (timestamp: number): boolean => {
  const now = Date.now();
  const cacheAge = now - timestamp;
  return cacheAge > DAY_MS;
};

// OpenAI API for recommendations
export const generateRecommendation = async (userData: any) => {
  try {
    // Check if OpenAI integration is enabled in the config
    if (!API_CONFIG.enableAI) {
      console.log("OpenAI API is disabled, using default recommendation");
  return getDefaultRecommendation(userData);
    }
    
    // Validate user profile data
    const userProfile = validateUserData(userData);
    
    if (!userProfile) {
      console.log("Invalid user profile data, using default recommendation");
      return getDefaultRecommendation(userData);
    }

    // Extract user's workout history, meal history, and water intake
    const workoutHistory = userData.workout_history || [];
    const mealHistory = userData.meal_history || [];
    const waterIntake = userData.water_intake || {};
    
    // Check if streak was lost (no workout for at least 2 days)
    let lostStreak = false;
    let daysSinceLastWorkout = 0;
    
    if (workoutHistory.length > 3) {
      // Get unique dates from workout history
      const uniqueDates = [...new Set(
        workoutHistory
          .filter((item: any) => item && item.date && typeof item.date === 'string')
          .map((item: any) => item.date.split('T')[0])
      )].sort((a, b) => {
        // Explicitly cast unknown types to string for comparison
        const dateA = a as string;
        const dateB = b as string;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      
      if (uniqueDates.length > 0) {
        // Check how many days it's been since the last workout
        const today = new Date();
        const lastWorkoutDate = new Date(uniqueDates[0] as string);
        
        // Calculate difference in days
        const diffTime = Math.abs(today.getTime() - lastWorkoutDate.getTime());
        daysSinceLastWorkout = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // If more than 2 days, streak is lost
        if (daysSinceLastWorkout > 2) {
          lostStreak = true;
        }
      }
    }
    
    // Process workout history to identify patterns
    const workoutTypes = new Map();
    const exerciseFrequency = new Map();
    let totalWorkouts = 0;
    let totalWorkoutDuration = 0;
    
    workoutHistory.forEach((workout: any) => {
      if (!workout) return;
      
      totalWorkouts++;
      totalWorkoutDuration += workout.duration || 0;
      
      // Track workout types
      const type = workout.type || 'unknown';
      workoutTypes.set(type, (workoutTypes.get(type) || 0) + 1);
      
      // Track exercise frequency
      if (workout.exercises && Array.isArray(workout.exercises)) {
        workout.exercises.forEach((exercise: any) => {
          if (exercise && exercise.name) {
            exerciseFrequency.set(
              exercise.name, 
              (exerciseFrequency.get(exercise.name) || 0) + 1
            );
          }
        });
      }
    });
    
    // Get favorite exercises (most frequent)
    const favoriteExercises = Array.from(exerciseFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
    
    // Get preferred workout types
    const preferredWorkoutTypes = Array.from(workoutTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(entry => entry[0]);
    
    // Process meal history to identify patterns
    const mealTypes = new Map();
    const foodFrequency = new Map();
    let totalMeals = 0;
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    
    mealHistory.forEach((meal: any) => {
      if (!meal) return;
      
      totalMeals++;
      totalCalories += meal.calories || 0;
      totalProtein += meal.protein || 0;
      totalCarbs += meal.carbs || 0;
      totalFat += meal.fat || 0;
      
      // Track meal types
      const type = meal.type || 'unknown';
      mealTypes.set(type, (mealTypes.get(type) || 0) + 1);
      
      // Track food frequency
      if (meal.foods && Array.isArray(meal.foods)) {
        meal.foods.forEach((food: any) => {
          if (food && food.name) {
            foodFrequency.set(
              food.name, 
              (foodFrequency.get(food.name) || 0) + 1
            );
          }
        });
      }
    });
    
    // Get favorite foods
    const favoriteFoods = Array.from(foodFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
    
    // Process water intake data
    let avgWaterIntake = 0;
    let daysWithWaterData = 0;
    let daysWithRecommendedWater = 0;
    
    if (waterIntake && typeof waterIntake === 'object') {
      const waterValues = Object.values(waterIntake).map(Number).filter(val => !isNaN(val));
      daysWithWaterData = waterValues.length;
      
      if (daysWithWaterData > 0) {
        const totalWater = waterValues.reduce((sum, val) => sum + val, 0);
        avgWaterIntake = totalWater / daysWithWaterData;
        daysWithRecommendedWater = waterValues.filter(val => val >= 8).length;
      }
    }
    
    // Get recommended exercises based on user's goals
    const recommendedExercises = await getRecommendedExercises(userProfile.fitness_goals);
    
    // Calculate recent progress trends if available
    let weightTrend = 'stable';
    if (Array.isArray(userData.weight_history) && userData.weight_history.length > 1) {
      const recentWeightEntries = [...userData.weight_history]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 2);
      
      if (recentWeightEntries.length === 2) {
        const latestWeight = Number(recentWeightEntries[0].weight);
        const previousWeight = Number(recentWeightEntries[1].weight);
        const difference = latestWeight - previousWeight;
        
        if (difference > 0.5) weightTrend = 'increasing';
        else if (difference < -0.5) weightTrend = 'decreasing';
      }
    }
    
    // Prepare enhanced dataset for the AI
    const enhancedUserData = {
      ...userProfile,
      fitness_summary: {
        totalWorkouts,
        avgDuration: totalWorkouts > 0 ? totalWorkoutDuration / totalWorkouts : 0,
        preferredWorkoutTypes,
        favoriteExercises,
        recentWorkouts: workoutHistory.slice(0, 3),
        weightTrend,
        lostStreak,
        daysSinceLastWorkout
      },
      nutrition_summary: {
        totalMeals,
        avgCaloriesPerMeal: totalMeals > 0 ? totalCalories / totalMeals : 0,
        avgProteinPerMeal: totalMeals > 0 ? totalProtein / totalMeals : 0,
        macroRatio: totalCalories > 0 ? {
          proteinPct: (totalProtein * 4 / totalCalories) * 100,
          carbsPct: (totalCarbs * 4 / totalCalories) * 100,
          fatPct: (totalFat * 9 / totalCalories) * 100,
        } : null,
        favoriteFoods
      },
      hydration_summary: {
        daysTracked: daysWithWaterData,
        avgWaterIntake,
        adherenceRate: daysWithWaterData > 0 ? (daysWithRecommendedWater / daysWithWaterData) * 100 : 0,
      },
      recommended_exercises: recommendedExercises
    };
    
    // Use the initialized OpenAI client
    console.log("Generating comprehensive recommendation with OpenAI");
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You're a chill, friendly fitness coach who gives casual but helpful advice. Talk like you're chatting with a friend at the gym.

ABSOLUTELY PROHIBITED PHRASES (DO NOT USE THESE):
- "Based on the limited data provided"
- "Based on the information provided"
- "Here are some general recommendations"
- "Without knowing more details"
- "Given the information available"
- "Here are some personalized fitness and nutrition recommendations for you"

INSTEAD, START WITH ONE OF THESE CASUAL GREETINGS:
- "Hey ${userProfile.name}!"
- "What's up ${userProfile.name}!"
- "Yo ${userProfile.name}! Looking good!"
- "Hey there ${userProfile.name}!"
- "Sup ${userProfile.name}!"

${lostStreak ? `IMPORTANT OVERRIDE: This user has lost their workout streak (${daysSinceLastWorkout} days since their last workout). 
Instead of the normal greeting, start with an encouraging message about getting back on track, such as:
- "Hey ${userProfile.name}! Noticed you've been away for a bit - hope everything's alright!"
- "Welcome back, ${userProfile.name}! Everyone needs breaks sometimes. Let's jump back in!"
- "${userProfile.name}! Good to see you back! Life gets busy sometimes, but you're here now and that's what counts."

Then suggest a specific, easy workout to help them restart their routine. Be supportive, not judgmental. Emphasize that consistency matters more than perfection.` : ""}

Your recommendations should:
1. Be casual and conversational - use words like "hey", "looking good", etc.
2. Jump straight into specific advice without qualifying statements about data
3. Suggest exercises they might enjoy from their favorites or the recommended_exercises list
4. Give specific nutrition tips based on their eating patterns and favorite foods
5. Mention water intake in a casual way
6. Be encouraging and motivating without being pushy
7. Keep it concise - aim for 2-3 short paragraphs max
8. Focus on their goals: ${Array.isArray(userProfile.fitness_goals) ? userProfile.fitness_goals.join(', ') : 'general fitness'}
9. Use their name (${userProfile.name}) and reference their specific data like weight (${userProfile.weight}kg), workout history, and dietary preferences

IMPORTANT: 
- USE AS MUCH of the user's profile data as possible to personalize your recommendations
- Do NOT mention or use email information
- NEVER assume the user is pregnant, regardless of gender or any other factor
- Pay close attention to gender (${userProfile.gender}) and only give advice appropriate for their specific profile
- Avoid making ANY assumptions about health conditions not mentioned in the data
- If they have favorite exercises or foods, reference them specifically
- JUST GIVE ADVICE - don't explain why you're giving that advice or qualify it

Your tone should be like a supportive friend who knows fitness - not overly technical or formal. Use casual language, short sentences, and be relatable. Act like you already know them well and are just catching up.`
        },
        {
          role: "user",
          content: `Hey coach, any tips for me this week? Here's my fitness data: ${JSON.stringify(enhancedUserData)}`
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });
    
    const recommendation = completion.choices[0].message.content;
    console.log("Successfully received enhanced OpenAI recommendation");
    
    return recommendation;
  } catch (error) {
    console.error("Error generating recommendation with OpenAI:", error);
    return getDefaultRecommendation(userData);
  }
};

// Get recommended exercises based on fitness goals
const getRecommendedExercises = async (fitnessGoals: string[]) => {
  // Get local exercises as a fallback
  const allExercises = getLocalExercises();
  
  // Match exercises to fitness goals
  const matchedExercises = [];
  
  // Handle weight loss goal
  if (fitnessGoals.includes('weight_loss')) {
    // Add cardio and HIIT exercises
    matchedExercises.push(
      ...allExercises.filter(ex => 
        ex.category === 'cardio' || 
        ex.name.toLowerCase().includes('burpee') ||
        ex.name.toLowerCase().includes('mountain climber')
      )
    );
  }
  
  // Handle muscle gain goal
  if (fitnessGoals.includes('muscle_gain')) {
    // Add strength exercises
    matchedExercises.push(
      ...allExercises.filter(ex => 
        ex.category === 'chest' || 
        ex.category === 'back' ||
        ex.category === 'upper arms' ||
        ex.category === 'upper legs'
      )
    );
  }
  
  // Handle endurance goal
  if (fitnessGoals.includes('endurance')) {
    // Add cardio exercises
    matchedExercises.push(
      ...allExercises.filter(ex => 
        ex.category === 'cardio' ||
        ex.duration !== undefined
      )
    );
  }
  
  // Handle flexibility goal
  if (fitnessGoals.includes('flexibility')) {
    // Add yoga and stretching exercises
    matchedExercises.push(
      ...allExercises.filter(ex => 
        ex.category === 'neck' ||
        ex.category === 'waist' ||
        ex.name.toLowerCase().includes('stretch')
      )
    );
  }
  
  // If no specific goals matched or no exercises found, provide general fitness exercises
  if (matchedExercises.length === 0) {
    // Add a mix of exercises for general fitness
    matchedExercises.push(...allExercises.slice(0, 5));
  }
  
  // Limit to 5 exercises to avoid overwhelming the model with data
  return matchedExercises
    .slice(0, 5)
    .map(ex => ({
      name: ex.name,
      category: ex.category,
      description: ex.description,
      muscles: ex.muscles
    }));
};

// Local exercises fallback - updated to match ExerciseDB format
export const getLocalExercises = () => {
  return [
    {
      id: "0001",
      name: "Push-ups",
      description: "A classic bodyweight exercise that targets the chest, shoulders, and triceps. Start in a plank position with hands shoulder-width apart, then lower your body until your chest nearly touches the floor, and push back up. Keep your body in a straight line throughout the movement.",
      category: "chest",
      muscles: ["pectorals"], 
      muscles_secondary: ["triceps", "shoulders"],
      equipment: ["body weight"],
      sets: 3,
      reps: 12,
      rest: 90,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/8ahNImvRgbJdDS"
    },
    {
      id: "0002",
      name: "Squats",
      description: "A compound lower body exercise that works quadriceps, hamstrings, and glutes. Stand with feet shoulder-width apart, then bend knees and hips to lower your body as if sitting in a chair. Keep your chest up and knees tracking over your toes. Return to standing position.",
      category: "upper legs",
      muscles: ["quads"], 
      muscles_secondary: ["glutes", "hamstrings"],
      equipment: ["body weight"],
      sets: 4,
      reps: 10,
      rest: 90,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/jvZiyPdUVQ5MI3"
    },
    {
      id: "0003",
      name: "Plank",
      description: "An isometric core exercise that builds stability and endurance. Position your forearms on the ground with elbows aligned below shoulders and arms parallel to your body at about shoulder width. Hold your body in a straight line from head to feet, engaging your core and glutes throughout the hold.",
      category: "waist",
      muscles: ["abs"], 
      muscles_secondary: ["lower back", "obliques"],
      equipment: ["body weight"],
      sets: 3,
      reps: 1,
      duration: 30,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/Bm7QdFjlbnbh7G"
    },
    {
      id: "0004",
      name: "Lunges",
      description: "A unilateral lower body exercise that targets quadriceps, hamstrings, and glutes. Stand tall with feet hip-width apart, then step forward with one leg and lower your hips until both knees are bent at 90-degree angles. Push through your front heel to return to starting position.",
      category: "upper legs",
      muscles: ["quads"], 
      muscles_secondary: ["glutes", "hamstrings"],
      equipment: ["body weight"],
      sets: 3,
      reps: 10,
      rest: 75,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/R7qZUuVr26hZS6"
    },
    {
      id: "0005",
      name: "Mountain Climbers",
      description: "A dynamic full-body exercise that elevates heart rate while engaging core and shoulders. Start in a high plank position, then alternate bringing knees toward chest in a running motion. Keep your core tight and maintain hip position throughout the movement.",
      category: "cardio",
      muscles: ["abs"], 
      muscles_secondary: ["shoulders", "obliques"],
      equipment: ["body weight"],
      sets: 3,
      duration: 30,
      rest: 45,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/0Ls8N0OuTLmxaU"
    },
    {
      id: "0006",
      name: "Burpees",
      description: "A high-intensity full-body exercise that combines a squat, push-up, and jump. Begin in standing position, drop into a squat, kick feet back into plank, perform a push-up, jump feet back to squat, and explosively jump up with arms overhead.",
      category: "cardio",
      muscles: ["pectorals"], 
      muscles_secondary: ["quads", "abs", "triceps"],
      equipment: ["body weight"],
      sets: 3,
      reps: 8,
      rest: 90,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/zgnf2oYJKfhbx9"
    },
    {
      id: "0007",
      name: "Bicycle Crunches",
      description: "An effective core exercise targeting rectus abdominis and obliques. Lie on your back with hands behind head and knees bent. Alternate bringing opposite elbow to knee while extending the other leg, creating a pedaling motion. Focus on rotating from your core, not pulling on your neck.",
      category: "waist",
      muscles: ["abs"], 
      muscles_secondary: ["obliques"],
      equipment: ["body weight"],
      sets: 3,
      reps: 15,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/dFyB4GC-5T-4Uo"
    },
    {
      id: "0008",
      name: "Jumping Jacks",
      description: "A simple cardio exercise that elevates heart rate and improves coordination. Start with feet together and arms at sides, then simultaneously jump feet out wide and raise arms overhead. Jump back to starting position and repeat at a brisk pace.",
      category: "cardio",
      muscles: ["calves"], 
      muscles_secondary: ["shoulders", "quads"],
      equipment: ["body weight"],
      sets: 3,
      duration: 30,
      rest: 45,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/FPyuFyD79q7B3r"
    },
    {
      id: "0009",
      name: "Pull-ups",
      description: "A challenging upper body exercise that targets the back, biceps, and shoulders. Hang from a bar with palms facing away and hands slightly wider than shoulder-width. Pull your body up until your chin clears the bar, then lower back to the starting position with control.",
      category: "back",
      muscles: ["lats"], 
      muscles_secondary: ["biceps", "shoulders"],
      equipment: ["pull-up bar"],
      sets: 3,
      reps: 8,
      rest: 90,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/MnCEV6EmNcGj3f"
    },
    {
      id: "0010",
      name: "Dumbbell Bicep Curls",
      description: "An isolation exercise targeting the biceps. Stand with feet shoulder-width apart, holding dumbbells at your sides with palms facing forward. Keeping upper arms stationary, curl the weights toward your shoulders. Lower back to starting position with control.",
      category: "upper arms",
      muscles: ["biceps"], 
      muscles_secondary: ["forearms"],
      equipment: ["dumbbell"],
      sets: 3,
      reps: 12,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/EoTGhPROibYa-F"
    },
    {
      id: "0011",
      name: "Tricep Dips",
      description: "An effective exercise for triceps development. Sit on the edge of a bench or chair with hands gripping the edge beside your hips. Slide your buttocks off the bench with legs extended. Lower your body by bending your elbows until they reach 90 degrees, then push back up.",
      category: "upper arms",
      muscles: ["triceps"], 
      muscles_secondary: ["shoulders", "chest"],
      equipment: ["body weight"],
      sets: 3,
      reps: 12,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/nwZP8KR5Wc0rg3"
    },
    {
      id: "0012",
      name: "Russian Twists",
      description: "A core exercise targeting the obliques. Sit on the floor with knees bent and feet elevated. Lean back slightly to engage core, and twist your torso from side to side, touching the ground beside your hips with both hands moving together.",
      category: "waist",
      muscles: ["obliques"], 
      muscles_secondary: ["abs"],
      equipment: ["body weight"],
      sets: 3,
      reps: 20,
      rest: 45,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/3qlb3jJOziBXQV"
    },
    {
      id: "0013",
      name: "Glute Bridges",
      description: "A lower body exercise focusing on the glutes and hamstrings. Lie on your back with knees bent and feet flat on the floor hip-width apart. Push through your heels to lift your hips toward the ceiling, creating a straight line from shoulders to knees at the top. Lower with control.",
      category: "upper legs",
      muscles: ["glutes"], 
      muscles_secondary: ["hamstrings", "lower back"],
      equipment: ["body weight"],
      sets: 3,
      reps: 15,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/XK6f7QoNt-M31C"
    },
    {
      id: "0014",
      name: "Lateral Raises",
      description: "An isolation exercise targeting the lateral deltoids. Stand with feet shoulder-width apart, holding dumbbells at your sides. With a slight bend in the elbows, raise the weights out to the sides until arms are parallel to the floor. Lower with control.",
      category: "shoulders",
      muscles: ["shoulders"], 
      muscles_secondary: ["traps"],
      equipment: ["dumbbell"],
      sets: 3,
      reps: 12,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/FiWsMbETQ2AeeH"
    },
    {
      id: "0015",
      name: "Calf Raises",
      description: "An isolation exercise for the calves. Stand with feet hip-width apart, optionally holding onto something for balance. Raise your heels off the ground as high as possible, then lower them back down with control.",
      category: "lower legs",
      muscles: ["calves"], 
      muscles_secondary: [],
      equipment: ["body weight"],
      sets: 3,
      reps: 20,
      rest: 45,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/5sZvvYKpU4TQuD"
    },
    {
      id: "0016",
      name: "Neck Flexion",
      description: "An exercise targeting the front neck muscles. Lie on your back with head slightly off the edge of a bench. Tuck your chin to your chest, then return to the starting position with control.",
      category: "neck",
      muscles: ["neck"], 
      muscles_secondary: [],
      equipment: ["body weight"],
      sets: 2,
      reps: 10,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/RfnvYoFPnQdRGt"
    },
    {
      id: "0017",
      name: "Forearm Plank",
      description: "An isometric core exercise that builds endurance and stability. Position yourself face down with forearms on the ground, elbows aligned under shoulders, and feet hip-width apart. Lift your body up so it forms a straight line from head to heels, and hold the position.",
      category: "waist",
      muscles: ["abs"], 
      muscles_secondary: ["shoulders", "lower back"],
      equipment: ["body weight"],
      sets: 3,
      duration: 45,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/yvLWLpM9tkwPTR"
    },
    {
      id: "0018",
      name: "Wrist Curls",
      description: "An isolation exercise for forearm muscles. Sit on the edge of a bench with forearms resting on your thighs, palms facing up, holding a dumbbell. Let the weight roll down to fingertips, then curl it back up by flexing the wrist.",
      category: "lower arms",
      muscles: ["forearms"], 
      muscles_secondary: [],
      equipment: ["dumbbell"],
      sets: 3,
      reps: 15,
      rest: 45,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/Py03A7N1Wbv8Jk"
    },
    {
      id: "0019",
      name: "Barbell Bench Press",
      description: "A compound chest exercise. Lie on a bench, grasp barbell with hands slightly wider than shoulder-width, lower bar to chest, then press up to starting position.",
      category: "chest",
      muscles: ["pectorals"],
      muscles_secondary: ["triceps", "shoulders"],
      equipment: ["barbell"],
      sets: 4,
      reps: 8,
      rest: 90,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/dBGRUPvUqmHMtj"
    },
    {
      id: "0020",
      name: "Lat Pulldown",
      description: "A back exercise targeting the latissimus dorsi. Sit at a pulldown machine, grasp bar with wide grip, pull bar down to chest while keeping torso upright, then control the return.",
      category: "back",
      muscles: ["lats"],
      muscles_secondary: ["biceps", "rhomboids"],
      equipment: ["cable"],
      sets: 3,
      reps: 12,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/9gKRPMxpkWrUbH"
    },
    {
      id: "0021",
      name: "Overhead Press",
      description: "A compound shoulder exercise. Standing with feet shoulder-width apart, press barbell or dumbbells from shoulder height to overhead, then lower back to starting position.",
      category: "shoulders",
      muscles: ["shoulders"],
      muscles_secondary: ["triceps", "traps"],
      equipment: ["barbell"],
      sets: 3,
      reps: 10,
      rest: 90,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/5o-V7VO9W3LE5A"
    },
    {
      id: "0022",
      name: "Deadlift",
      description: "A fundamental compound exercise that works multiple muscle groups. Stand with feet hip-width apart, bend at hips and knees to grasp barbell, then stand up straight by extending hips and knees.",
      category: "back",
      muscles: ["lower back"],
      muscles_secondary: ["hamstrings", "glutes", "traps", "forearms"],
      equipment: ["barbell"],
      sets: 3,
      reps: 8,
      rest: 120,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/cYbEm9AXGf1HIt"
    },
    {
      id: "0023",
      name: "Leg Press",
      description: "A machine-based lower body exercise. Sit in leg press machine with feet on platform, release safety, then push platform away by extending knees, return to starting position with control.",
      category: "upper legs",
      muscles: ["quads"],
      muscles_secondary: ["glutes", "hamstrings", "calves"],
      equipment: ["machine"],
      sets: 3,
      reps: 12,
      rest: 90,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/6XB8zJCPyKgVfC"
    },
    {
      id: "0024",
      name: "Bent Over Row",
      description: "A compound back exercise. Bend forward at hips with back straight, grasp barbell with overhand grip, pull bar to lower chest while keeping elbows close to body, then lower with control.",
      category: "back",
      muscles: ["lats"],
      muscles_secondary: ["rhomboids", "biceps", "rear delts"],
      equipment: ["barbell"],
      sets: 3,
      reps: 10,
      rest: 75,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/OC5sU9RRh1Kdr6"
    },
    {
      id: "0025",
      name: "Skull Crushers",
      description: "An isolation exercise for triceps. Lie on bench holding dumbbells or barbell above chest, bend elbows to lower weight toward forehead, then extend arms back to starting position.",
      category: "upper arms",
      muscles: ["triceps"],
      muscles_secondary: [],
      equipment: ["barbell"],
      sets: 3,
      reps: 12,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/DQWIJRIx0ZRHCT"
    },
    {
      id: "0026",
      name: "Hanging Leg Raise",
      description: "An advanced core exercise. Hang from pull-up bar with arms fully extended, raise legs to 90-degree angle while keeping them straight, lower with control.",
      category: "waist",
      muscles: ["abs"],
      muscles_secondary: ["hip flexors"],
      equipment: ["pull-up bar"],
      sets: 3,
      reps: 12,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/JvDfLbLkJ8C43j"
    },
    {
      id: "0027",
      name: "Seated Calf Raise",
      description: "An isolation exercise for the calves. Sit on machine with balls of feet on platform, lift heels by pushing through balls of feet, then lower with control.",
      category: "lower legs",
      muscles: ["calves"],
      muscles_secondary: [],
      equipment: ["machine"],
      sets: 4,
      reps: 15,
      rest: 45,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/H4uJDDkPlVZaqv"
    },
    {
      id: "0028",
      name: "Face Pull",
      description: "A shoulder and upper back exercise. Stand facing cable machine, pull rope attachment toward face with elbows high, squeezing shoulder blades together at the end of the movement.",
      category: "shoulders",
      muscles: ["rear delts"],
      muscles_secondary: ["traps", "rhomboids"],
      equipment: ["cable"],
      sets: 3,
      reps: 15,
      rest: 60,
      videoUrl: null,
      imageUrl: "https://api.exercisedb.io/image/zeBJGfJhHBTUf7"
    }
  ];
};

export const searchExercisesLegacy = async (params: {
  target?: string;
  bodyPart?: string;
  equipment?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) => {
  try {
    // Standardize parameters
    const { target, bodyPart, equipment, search, limit = 20, offset = 0 } = params;
    console.log(`API Request - search: "${search}", bodyPart: "${bodyPart}", target: "${target}", equipment: "${equipment}", limit: ${limit}, offset: ${offset}`);
    
    // Determine if we should attempt to use the API or just local data
    const shouldUseApi = !API_CONFIG.useLocalExerciseData;
    
    if (shouldUseApi) {
      try {
        // Build the appropriate endpoint based on the provided filters
        let endpoint = '';
        let queryParams = '';
        
        // Determine the primary filter to use
        if (search && search.trim() !== '') {
          // Search by name takes precedence
          const searchTerm = search.trim().toLowerCase();
          endpoint = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(searchTerm)}`;
        } else if (bodyPart && bodyPart !== 'All') {
          // Filter by body part
          endpoint = `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${encodeURIComponent(bodyPart.toLowerCase())}`;
        } else if (target && target !== 'All') {
          // Filter by target muscle
          endpoint = `https://exercisedb.p.rapidapi.com/exercises/target/${encodeURIComponent(target.toLowerCase())}`;
        } else if (equipment && equipment !== 'All') {
          // Filter by equipment
          endpoint = `https://exercisedb.p.rapidapi.com/exercises/equipment/${encodeURIComponent(equipment.toLowerCase())}`;
        } else {
          // If no specific filter is provided, use the all exercises endpoint
          endpoint = `https://exercisedb.p.rapidapi.com/exercises`;
          // Add pagination parameters for the default endpoint
          queryParams = `?limit=${limit}&offset=${offset}`;
        }
        
        // Log the endpoint for debugging
        console.log(`Fetching from API: ${endpoint}${queryParams}`);
        
        // Make the API request
        const response = await fetch(endpoint + queryParams, {
          headers: {
            'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
            'X-RapidAPI-Host': API_CONFIG.exerciseDbHost
          }
        });
        
        if (!response.ok) {
          // Check for 429 rate limit error specifically
          if (response.status === 429) {
            console.error("API rate limit exceeded (429): Falling back to local search");
            throw new Error("API rate limit exceeded (429)");
          }
          
          const errorText = await response.text();
          console.error(`API search failed: ${response.status} - ${errorText}`);
          throw new Error(`Failed to fetch exercises: ${response.status}`);
        }
        
        // Get all matching exercises from the API
        const allApiResults = await response.json();
        
        // If API returned empty array, log it
        if (allApiResults.length === 0) {
          console.log(`API returned 0 results`);
        } else {
          console.log(`API returned ${allApiResults.length} total exercises`);
        }
        
        // Map API results to our app format
        const mappedResults = allApiResults.map((exercise: ExerciseDbExercise) => 
          mapExerciseDbToAppFormat(exercise)
        );
        
        // Apply secondary filters if needed
        let filteredResults = [...mappedResults];
        
        // Apply secondary filters if we used the search endpoint or any specific endpoint
        // This allows for multiple filters to be applied simultaneously
        if (search && search.trim() !== '') {
          // If we did a name search, we might need to apply additional filters
          if (bodyPart && bodyPart !== 'All') {
            filteredResults = filteredResults.filter((ex: any) => 
              ex.category?.toLowerCase() === bodyPart.toLowerCase()
            );
            console.log(`After bodyPart filter: ${filteredResults.length} exercises`);
          }
          
          if (target && target !== 'All') {
            filteredResults = filteredResults.filter((ex: any) => 
              Array.isArray(ex.muscles) && ex.muscles.some((m: any) => 
                typeof m === 'string' ? m.toLowerCase() === target.toLowerCase() : 
                m.name?.toLowerCase() === target.toLowerCase()
              )
            );
            console.log(`After target filter: ${filteredResults.length} exercises`);
          }
          
          if (equipment && equipment !== 'All') {
            filteredResults = filteredResults.filter((ex: any) => 
              Array.isArray(ex.equipment) && ex.equipment.some((e: any) => 
                typeof e === 'string' ? e.toLowerCase() === equipment.toLowerCase() : 
                e.name?.toLowerCase() === equipment.toLowerCase()
              )
            );
            console.log(`After equipment filter: ${filteredResults.length} exercises`);
          }
        } else if (bodyPart && bodyPart !== 'All') {
          // If we did a bodyPart search, we might need to apply additional filters
          if (target && target !== 'All') {
            filteredResults = filteredResults.filter((ex: any) => 
              Array.isArray(ex.muscles) && ex.muscles.some((m: any) => 
                typeof m === 'string' ? m.toLowerCase() === target.toLowerCase() : 
                m.name?.toLowerCase() === target.toLowerCase()
              )
            );
            console.log(`After target filter: ${filteredResults.length} exercises`);
          }
          
          if (equipment && equipment !== 'All') {
            filteredResults = filteredResults.filter((ex: any) => 
              Array.isArray(ex.equipment) && ex.equipment.some((e: any) => 
                typeof e === 'string' ? e.toLowerCase() === equipment.toLowerCase() : 
                e.name?.toLowerCase() === equipment.toLowerCase()
              )
            );
            console.log(`After equipment filter: ${filteredResults.length} exercises`);
          }
        } else if (target && target !== 'All') {
          // If we did a target search, we might need to apply additional filters
          if (equipment && equipment !== 'All') {
            filteredResults = filteredResults.filter((ex: any) => 
              Array.isArray(ex.equipment) && ex.equipment.some((e: any) => 
                typeof e === 'string' ? e.toLowerCase() === equipment.toLowerCase() : 
                e.name?.toLowerCase() === equipment.toLowerCase()
              )
            );
            console.log(`After equipment filter: ${filteredResults.length} exercises`);
          }
        }
        
        // Calculate total results after filtering
        const totalResults = filteredResults.length;
        
        // Apply pagination for endpoints that return all results
        let paginatedResults = filteredResults;
        
        // For most endpoints (except the default paginated one), we need to manually paginate
        if (search || bodyPart || target || equipment) {
          paginatedResults = filteredResults.slice(offset, offset + limit);
        }
        
        console.log(`Returning ${paginatedResults.length} exercises (offset: ${offset}, total: ${totalResults})`);
        
        // Return the paginated results with pagination metadata
        return {
          results: paginatedResults,
          count: totalResults,
          next: offset + limit < totalResults ? `offset=${offset + limit}` : null,
          previous: offset > 0 ? `offset=${Math.max(0, offset - limit)}` : null
        };
        
      } catch (error) {
        console.error("API search failed, falling back to local search:", error);
        // Continue to local search as fallback
      }
    }
    
    // Use local data (either as primary source or as fallback)
    console.log("Using local exercise data for search");
    
    const localExercises = getLocalExercises();
    console.log(`Total local exercises: ${localExercises.length}`);
    
    // Apply filters to local exercises
    let filteredExercises = [...localExercises];
    
    if (bodyPart && bodyPart !== 'All') {
      filteredExercises = filteredExercises.filter(ex => 
        ex.category?.toLowerCase() === bodyPart.toLowerCase()
      );
      console.log(`After local bodyPart filter: ${filteredExercises.length} exercises`);
    }
    
    if (target && target !== 'All') {
      filteredExercises = filteredExercises.filter(ex => 
        Array.isArray(ex.muscles) && ex.muscles.some((m: any) => 
          typeof m === 'string' && m.toLowerCase() === target.toLowerCase()
        )
      );
      console.log(`After local target filter: ${filteredExercises.length} exercises`);
    }
    
    if (equipment && equipment !== 'All') {
      filteredExercises = filteredExercises.filter(ex => 
        Array.isArray(ex.equipment) && ex.equipment.some((e: any) => 
          typeof e === 'string' && e.toLowerCase() === equipment.toLowerCase()
        )
      );
      console.log(`After local equipment filter: ${filteredExercises.length} exercises`);
    }
    
    if (search && search.trim() !== '') {
      const searchTerm = search.toLowerCase().trim();
      filteredExercises = filteredExercises.filter(ex => 
        ex.name.toLowerCase().includes(searchTerm) ||
        (ex.description && ex.description.toLowerCase().includes(searchTerm)) ||
        (ex.category && ex.category.toLowerCase().includes(searchTerm)) ||
        (Array.isArray(ex.equipment) && ex.equipment.some((e: any) => 
          (typeof e === 'string' && e.toLowerCase().includes(searchTerm)) || 
          (e && e.name && e.name.toLowerCase().includes(searchTerm))
        )) ||
        (Array.isArray(ex.muscles) && ex.muscles.some((m: any) => 
          (typeof m === 'string' && m.toLowerCase().includes(searchTerm)) || 
          (m && m.name && m.name.toLowerCase().includes(searchTerm))
        ))
      );
      console.log(`After local search filter: ${filteredExercises.length} exercises`);
    }
    
    // Calculate total after all filters
    const totalLocalResults = filteredExercises.length;
    
    // Apply pagination
    const paginatedExercises = filteredExercises.slice(offset, offset + limit);
    
    console.log(`Returning ${paginatedExercises.length} local exercises (offset: ${offset}, total: ${totalLocalResults})`);
    
    // Map to the format expected by the app
    const mappedResults = paginatedExercises.map(exercise => ({
      id: exercise.id,
      uuid: exercise.id,
      name: exercise.name,
      description: exercise.description || '',
      category: typeof exercise.category === 'string' ? exercise.category : '',
      muscles: Array.isArray(exercise.muscles) ? exercise.muscles.map(m => ({
        name: m
      })) : [],
      muscles_secondary: Array.isArray(exercise.muscles_secondary) ? exercise.muscles_secondary.map(m => ({
        name: m
      })) : [],
      equipment: Array.isArray(exercise.equipment) ? exercise.equipment.map(e => ({
        name: e
      })) : [],
      sets: exercise.sets || 3,
      reps: exercise.reps || 12,
      rest: exercise.rest || 90,
      duration: exercise.duration,
      imageUrl: exercise.imageUrl,
      language: 1,
      license: 1,
      license_author: "Local",
      variations: [],
      images: [{
        image: exercise.imageUrl
      }]
    }));
    
    // Return with consistent pagination metadata
    return {
      results: mappedResults,
      count: totalLocalResults,
      next: offset + limit < totalLocalResults ? `offset=${offset + limit}` : null,
      previous: offset > 0 ? `offset=${Math.max(0, offset - limit)}` : null
    };
  } catch (error) {
    console.error("Error searching exercises:", error);
    
    // Return empty results with consistent format
    return {
      results: [],
      count: 0,
      next: null,
      previous: null
    };
  }
};

export const fetchExerciseById = async (id: string | number) => {
  try {
    // Check if we should use local data
    if (API_CONFIG.useLocalExerciseData) {
      console.log(`Using local data for exercise ID: ${id}`);
      const localExercises = getLocalExercises();
      const exercise = localExercises.find(ex => ex.id.toString() === id.toString());
      
      if (!exercise) {
        throw new Error(`Exercise with ID ${id} not found in local data`);
      }
      
      return exercise;
    }
    
    // Fetch from API
    console.log(`Fetching exercise details for ID: ${id}`);
    const endpoint = `https://exercisedb.p.rapidapi.com/exercises/exercise/${id}`;
    
    const response = await fetch(endpoint, {
      headers: {
        'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
        'X-RapidAPI-Host': API_CONFIG.exerciseDbHost
      }
    });
    
    if (!response.ok) {
      // Specifically handle rate limits
      if (response.status === 429) {
        console.error(`Error fetching exercise by ID: Rate limit exceeded (429)`);
      } else {
        console.error(`Error fetching exercise by ID: ${response.status}`);
      }
      throw new Error(`Failed to fetch exercise: ${response.status}`);
    }
    
    const exercise = await response.json();
    
    // Format the exercise data for our app
    return mapExerciseDbToAppFormat(exercise);
  } catch (error) {
    console.error("Error fetching exercise by ID:", error);
    
    // Try to get from local data as fallback
    try {
      const localExercises = getLocalExercises();
      const exercise = localExercises.find(ex => ex.id.toString() === id.toString());
      
      if (exercise) {
        console.log(`Found exercise ${id} in local data as fallback`);
        return exercise;
      }
    } catch (localError) {
      console.error("Error using local data fallback:", localError);
    }
    
    return null;
  }
};

// API functions for ExerciseDB
const API_HOST = API_CONFIG.exerciseDbHost;

// Base fetch function with proper headers
const fetchFromExerciseDB = async (endpoint: string) => {
  try {
    const response = await fetch(`https://${API_HOST}${endpoint}`, {
      headers: {
        'X-RapidAPI-Key': API_CONFIG.exerciseDbApiKey,
        'X-RapidAPI-Host': API_HOST
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error);
    throw error;
  }
};

// Get all exercises (paginated)
export const getAllExercises = async (limit = 20, offset = 0) => {
  try {
    return await fetchFromExerciseDB(`/exercises?limit=${limit}&offset=${offset}`);
  } catch (error) {
    console.error('Error fetching all exercises:', error);
    // Fall back to local data
    const localExercises = getLocalExercises();
    return localExercises.slice(offset, offset + limit);
  }
};

// Get list of all body parts
export const getBodyParts = async () => {
  try {
    return await fetchFromExerciseDB('/exercises/bodyPartList');
  } catch (error) {
    console.error('Error fetching body parts:', error);
    // Return default body parts
    return ["back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders", "upper arms", "upper legs", "waist"];
  }
};

// Get list of all target muscles
export const getTargetMuscles = async () => {
  try {
    return await fetchFromExerciseDB('/exercises/targetList');
  } catch (error) {
    console.error('Error fetching target muscles:', error);
    // Return some common target muscles
    return ["abductors", "abs", "adductors", "biceps", "calves", "cardiovascular system", "delts", "forearms", "glutes", "hamstrings", "lats", "levator scapulae", "pectorals", "quads", "serratus anterior", "spine", "traps", "triceps", "upper back"];
  }
};

// Get list of all equipment
export const getEquipment = async () => {
  try {
    return await fetchFromExerciseDB('/exercises/equipmentList');
  } catch (error) {
    console.error('Error fetching equipment:', error);
    // Return some common equipment
    return ["assisted", "band", "barbell", "body weight", "bosu ball", "cable", "dumbbell", "elliptical machine", "ez barbell", "hammer", "kettlebell", "leverage machine", "medicine ball", "olympic barbell", "resistance band", "roller", "rope", "skierg machine", "sled machine", "smith machine", "stability ball", "stationary bike", "stepmill machine", "tire", "trap bar", "upper body ergometer", "weighted", "wheel roller"];
  }
};

// Get exercises by body part
export const getExercisesByBodyPart = async (bodyPart: string) => {
  try {
    return await fetchFromExerciseDB(`/exercises/bodyPart/${encodeURIComponent(bodyPart.toLowerCase())}`);
  } catch (error) {
    console.error(`Error fetching exercises for body part ${bodyPart}:`, error);
    // Fall back to local filtering
    const localExercises = getLocalExercises();
    return localExercises.filter(ex => 
      ex.category?.toLowerCase() === bodyPart.toLowerCase()
    );
  }
};

// Get exercises by target muscle
export const getExercisesByTarget = async (target: string) => {
  try {
    return await fetchFromExerciseDB(`/exercises/target/${encodeURIComponent(target.toLowerCase())}`);
  } catch (error) {
    console.error(`Error fetching exercises for target muscle ${target}:`, error);
    // Fall back to local filtering
    const localExercises = getLocalExercises();
    return localExercises.filter(ex => 
      Array.isArray(ex.muscles) && ex.muscles.some((m: any) => 
        typeof m === 'string' && m.toLowerCase() === target.toLowerCase()
      )
    );
  }
};

// Get exercises by equipment
export const getExercisesByEquipment = async (equipment: string) => {
  try {
    return await fetchFromExerciseDB(`/exercises/equipment/${encodeURIComponent(equipment.toLowerCase())}`);
  } catch (error) {
    console.error(`Error fetching exercises for equipment ${equipment}:`, error);
    // Fall back to local filtering
    const localExercises = getLocalExercises();
    return localExercises.filter(ex => 
      Array.isArray(ex.equipment) && ex.equipment.some((e: any) => 
        typeof e === 'string' && e.toLowerCase() === equipment.toLowerCase()
      )
    );
  }
};

// Search exercises by name
export const searchExercisesByName = async (name: string) => {
  if (!name.trim()) return [];
  
  try {
    return await fetchFromExerciseDB(`/exercises/name/${encodeURIComponent(name.toLowerCase())}`);
  } catch (error) {
    console.error(`Error searching exercises by name ${name}:`, error);
    // Fall back to local filtering
    const localExercises = getLocalExercises();
    const searchTerm = name.toLowerCase().trim();
    return localExercises.filter(ex => 
      ex.name.toLowerCase().includes(searchTerm)
    );
  }
};

// Unified search function that combines all filters
export const searchExercises = async (params: {
  search?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  limit?: number;
  offset?: number;
}) => {
  const { search, bodyPart, target, equipment, limit = 20, offset = 0 } = params;
  console.log(`Searching exercises with:`, params);
  
  try {
    let exercises = [];
    
    // If we have a specific filter, use the specialized endpoint
    if (search && search.trim()) {
      exercises = await searchExercisesByName(search);
    } else if (bodyPart && bodyPart !== 'all') {
      exercises = await getExercisesByBodyPart(bodyPart);
    } else if (target && target !== 'all') {
      exercises = await getExercisesByTarget(target);
    } else if (equipment && equipment !== 'all') {
      exercises = await getExercisesByEquipment(equipment);
    } else {
      // No specific filter, get all exercises with pagination
      exercises = await getAllExercises(limit, offset);
    }
    
    // Apply secondary filters if needed (for combined filtering)
    let filteredExercises = [...exercises];
    
    // Only apply additional filters if we already have results and specific filters
    if (search && search.trim()) {
      // If we searched by name, apply other filters
      if (bodyPart && bodyPart !== 'all') {
        filteredExercises = filteredExercises.filter(ex => 
          ex.bodyPart === bodyPart.toLowerCase()
        );
      }
      
      if (target && target !== 'all') {
        filteredExercises = filteredExercises.filter(ex => 
          ex.target === target.toLowerCase()
        );
      }
      
      if (equipment && equipment !== 'all') {
        filteredExercises = filteredExercises.filter(ex => 
          ex.equipment === equipment.toLowerCase()
        );
      }
    } else if (bodyPart && bodyPart !== 'all') {
      // If we filtered by body part, apply other filters
      if (target && target !== 'all') {
        filteredExercises = filteredExercises.filter(ex => 
          ex.target === target.toLowerCase()
        );
      }
      
      if (equipment && equipment !== 'all') {
        filteredExercises = filteredExercises.filter(ex => 
          ex.equipment === equipment.toLowerCase()
        );
      }
    } else if (target && target !== 'all') {
      // If we filtered by target, apply equipment filter
      if (equipment && equipment !== 'all') {
        filteredExercises = filteredExercises.filter(ex => 
          ex.equipment === equipment.toLowerCase()
        );
      }
    }
    
    // Total count after all filtering
    const totalCount = filteredExercises.length;
    
    // Apply pagination for endpoints that return all results
    let paginatedResults = filteredExercises;
    
    // Manually paginate if we used a specific filter endpoint
    if (search || bodyPart || target || equipment) {
      paginatedResults = filteredExercises.slice(offset, offset + limit);
    }
    
    console.log(`Returning ${paginatedResults.length} exercises (offset: ${offset}, total: ${totalCount})`);
    
    // Transform results to match our app's expected format
    const mappedResults = paginatedResults.map(exercise => ({
      id: exercise.id,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
      target: exercise.target,
      equipment: exercise.equipment,
      gifUrl: exercise.gifUrl,
      // Add any additional fields we need
      description: exercise.instructions?.join(' ') || '',
      imageUrl: exercise.gifUrl, // For compatibility with existing components
      category: exercise.bodyPart // For compatibility with existing components
    }));
    
    // Return paginated results with metadata
    return {
      results: mappedResults,
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