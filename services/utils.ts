import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Turns dates into something actually readable
export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

// Quickly figure out BMI from weight and height
export const calculateBMI = (weight: number, height: number) => {
  // Weight in kg, height in cm
  const heightInMeters = height / 100;
  return (weight / (heightInMeters * heightInMeters)).toFixed(1);
};

// Calculate daily calories needed based on your stats
export const calculateCalorieNeeds = (
  weight: number,
  height: number,
  age: number,
  gender: string,
  activityLevel: string
) => {
  let bmr = 0;
  
  if (gender === "male") {
    bmr = 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
  } else {
    bmr = 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
  }
  
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    veryActive: 1.9
  };
  
  return Math.round(bmr * (activityMultipliers[activityLevel] || 1.2));
};

// Save your fitness data as a CSV file you can open in Excel
export const exportToCSV = async (data: any[]) => {
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }
  
  try {
    // Create CSV header
    const headers = Object.keys(data[0]).join(',');
  
    // Create CSV rows
    const rows = data.map(item => {
      return Object.values(item).map(value => {
        // Format value for CSV
        if (value === null || value === undefined) {
          return '';
        }
        
        // Handle values with commas, quotes or newlines by wrapping in quotes
        if (typeof value === 'string') {
          // Replace any double quotes with two double quotes
          const safeValue = value.replace(/"/g, '""');
          
          // If the value contains commas, quotes, or newlines, wrap in quotes
          if (safeValue.includes(',') || safeValue.includes('"') || safeValue.includes('\n')) {
            return `"${safeValue}"`;
          }
        }
        
        return value;
      }).join(',');
    });
  
    // Combine header and rows
    const csv = [headers, ...rows].join('\n');
  
    // Handle web platform
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
  
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', 'fitness_data_export.csv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    
    // Handle mobile platforms
    const fileUri = `${FileSystem.documentDirectory}fitness_data_export.csv`;
    
    // Write the CSV to a file
    await FileSystem.writeAsStringAsync(fileUri, csv);
    
    // Share the file
    if (!(await Sharing.isAvailableAsync())) {
      console.error('Sharing is not available on this device');
      return;
    }
    
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Fitness Data',
      UTI: 'public.comma-separated-values-text'
    });
  } catch (error) {
    console.error('Error exporting CSV:', error);
  }
};

// Format workout data for export
export const formatWorkoutDataForExport = (userData: any) => {
  // Extract all possible data sources
  const { 
    workout_history = [], 
    meal_history = [], 
    water_intake = {},
    daily_progress = {},
    name = 'User'
  } = userData;
  
  const exportData = [];

  // ===== DAILY DATA =====
  // Create a map of all dates to combine workout and meal data
  const dailyData = new Map();
  
  // Helper to make sure a date entry exists
  const ensureDateEntry = (date: string) => {
    if (!dailyData.has(date)) {
      dailyData.set(date, { 
        date,
        totalCaloriesConsumed: 0,
        totalCaloriesBurned: 0,
        netCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        workoutCount: 0,
        mealCount: 0,
        workoutDuration: 0,
        workoutTypes: new Set(),
        mealTypes: new Set(),
        exerciseCount: 0,
        waterGlasses: 0
      });
    }
    return dailyData.get(date);
  };
  
  // Process workout history
  workout_history.forEach((workout: any) => {
    if (!workout.date) return;
    
    const date = workout.date.split("T")[0];
    const entry = ensureDateEntry(date);
    
    // Update daily summary data
    entry.workoutCount += 1;
    entry.totalCaloriesBurned += workout.caloriesBurned || workout.calories_burned || 0;
    entry.workoutDuration += workout.duration || 0;
    
    if (workout.type) {
      entry.workoutTypes.add(workout.type);
    }
    
    // Count exercises
    if (workout.exercises && Array.isArray(workout.exercises)) {
      entry.exerciseCount += workout.exercises.length;
    }
  });
  
  // Process meal history
  meal_history.forEach((meal: any) => {
    if (!meal.date) return;
    
    const date = meal.date.split("T")[0];
    const entry = ensureDateEntry(date);
    
    // Update daily summary data
    entry.mealCount += 1;
    entry.totalCaloriesConsumed += meal.calories || 0;
    entry.totalProtein += meal.protein || 0;
    entry.totalCarbs += meal.carbs || 0;
    entry.totalFat += meal.fat || 0;
    
    if (meal.type) {
      entry.mealTypes.add(meal.type);
    }
  });
  
  // Process water intake data
  if (water_intake && typeof water_intake === 'object') {
    Object.entries(water_intake).forEach(([dateStr, glasses]) => {
      // Make sure the date is in YYYY-MM-DD format
      let formattedDate = dateStr;
      
      // Check if the date is already in YYYY-MM-DD format
      if (dateStr.length === 10 && dateStr.includes("-")) {
        formattedDate = dateStr; // Already in YYYY-MM-DD format
      } else {
        // Try to convert from timestamp or other format to YYYY-MM-DD
        try {
          const date = new Date(dateStr);
          formattedDate = date.toISOString().split("T")[0];
        } catch (e) {
          return;
        }
      }
      
      const entry = ensureDateEntry(formattedDate);
      const glassCount = Number(glasses);
      
      // Make sure we have a valid number
      if (!isNaN(glassCount)) {
        entry.waterGlasses = glassCount;
      }
    });
  }
  
  // Calculate net calories and format set data
  dailyData.forEach((entry) => {
    entry.netCalories = entry.totalCaloriesConsumed - entry.totalCaloriesBurned;
    entry.workoutTypes = Array.from(entry.workoutTypes).join(', ');
    entry.mealTypes = Array.from(entry.mealTypes).join(', ');
  });

  // Convert to array and sort by date
  const sortedDailyData = Array.from(dailyData.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // ===== WEEKLY SUMMARIES =====
  const weeklyData = new Map();
  
  // Group daily data into weeks
  sortedDailyData.forEach(day => {
    const date = new Date(day.date);
    // Get the week number (month + week of month)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    
    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, {
        weekStarting: weekKey,
        totalCaloriesConsumed: 0,
        totalCaloriesBurned: 0,
        avgDailyCalories: 0,
        totalProtein: 0,
        totalWorkouts: 0,
        totalMeals: 0,
        activeDays: 0,
        totalWaterGlasses: 0,
        avgDailyWater: 0,
        mostFrequentWorkoutType: '',
        mostFrequentMealType: '',
      });
    }
    
    const weekEntry = weeklyData.get(weekKey);
    weekEntry.totalCaloriesConsumed += day.totalCaloriesConsumed;
    weekEntry.totalCaloriesBurned += day.totalCaloriesBurned;
    weekEntry.totalProtein += day.totalProtein;
    weekEntry.totalWorkouts += day.workoutCount;
    weekEntry.totalMeals += day.mealCount;
    weekEntry.totalWaterGlasses += day.waterGlasses;
    
    // Count active days (days with workout or meal logged)
    if (day.workoutCount > 0 || day.mealCount > 0) {
      weekEntry.activeDays++;
    }
  });
  
  // Calculate averages and determine most frequent types
  weeklyData.forEach(week => {
    week.avgDailyCalories = week.activeDays > 0 ? Math.round(week.totalCaloriesConsumed / week.activeDays) : 0;
    week.avgDailyWater = week.activeDays > 0 ? +(week.totalWaterGlasses / week.activeDays).toFixed(1) : 0;
  });

  // Convert to array and sort by week
  const sortedWeeklyData = Array.from(weeklyData.values())
    .sort((a, b) => new Date(a.weekStarting).getTime() - new Date(b.weekStarting).getTime());
  
  // ===== PROGRESS METRICS =====
  // Calculate progress metrics if we have enough data
  let progressMetrics = [];
  
  if (sortedDailyData.length > 0) {
    // Find first and last date
    const firstDate = sortedDailyData[0].date;
    const lastDate = sortedDailyData[sortedDailyData.length - 1].date;
    
    // Calculate days between
    const daysBetween = Math.round((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24));
    
    // Only calculate progress if we have at least a week of data
    if (daysBetween >= 7) {
      const totalWorkouts = sortedDailyData.reduce((sum, day) => sum + day.workoutCount, 0);
      const totalMeals = sortedDailyData.reduce((sum, day) => sum + day.mealCount, 0);
      const totalWater = sortedDailyData.reduce((sum, day) => sum + day.waterGlasses, 0);
      
      // Simple progress metrics
      progressMetrics.push({
        metric: 'Total Days Tracked',
        value: daysBetween + 1,
        description: 'Number of days with fitness data in the system'
      });
      
      progressMetrics.push({
        metric: 'Workout Consistency',
        value: `${((totalWorkouts / (daysBetween + 1)) * 100).toFixed(1)}%`,
        description: 'Percentage of days with at least one workout logged'
      });
      
      progressMetrics.push({
        metric: 'Meal Logging Consistency',
        value: `${((totalMeals / ((daysBetween + 1) * 3)) * 100).toFixed(1)}%`,
        description: 'Percentage of expected meals logged (assuming 3 meals per day)'
      });
      
      progressMetrics.push({
        metric: 'Average Daily Calories',
        value: Math.round(sortedDailyData.reduce((sum, day) => sum + day.totalCaloriesConsumed, 0) / sortedDailyData.length),
        description: 'Average calories consumed per day'
      });
      
      progressMetrics.push({
        metric: 'Average Daily Protein',
        value: `${Math.round(sortedDailyData.reduce((sum, day) => sum + day.totalProtein, 0) / sortedDailyData.length)}g`,
        description: 'Average protein consumed per day in grams'
      });
      
      progressMetrics.push({
        metric: 'Average Daily Water Intake',
        value: `${(totalWater / sortedDailyData.length).toFixed(1)} glasses`,
        description: 'Average water consumption per day (8 glasses recommended)'
      });
      
      // Calculate days with recommended water intake (8 glasses)
      const daysWithRecommendedWater = sortedDailyData.filter(day => day.waterGlasses >= 8).length;
      progressMetrics.push({
        metric: 'Hydration Adherence',
        value: `${((daysWithRecommendedWater / (daysBetween + 1)) * 100).toFixed(1)}%`,
        description: 'Percentage of days meeting the recommended 8+ glasses of water'
      });
    }
  }
  
  // ===== WATER INTAKE TRACKING =====
  // Extract water intake data for dedicated section
  const waterTrackingData = sortedDailyData
    .filter(day => day.waterGlasses > 0)
    .map(day => ({
      date: day.date,
      waterGlasses: day.waterGlasses,
      targetMet: day.waterGlasses >= 8 ? 'Yes' : 'No'
    }))
    .sort((a: {date: string}, b: {date: string}) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // ===== DETAILED WORKOUT LIST =====
  interface WorkoutDetail {
    date: string;
    type: string;
    duration: number;
    caloriesBurned: number;
    exerciseCount: number;
    exercises: string;
    notes: string;
  }
  
  const workoutDetails = workout_history
    .filter((workout: any) => workout.date)
    .map((workout: any) => {
      const date = workout.date.split("T")[0];
      const exerciseNames = workout.exercises && Array.isArray(workout.exercises) 
        ? workout.exercises.map((ex: any) => ex.name).join(', ')
        : '';
      
      return {
        date,
        type: workout.type || 'Unknown',
        duration: workout.duration || 0,
        caloriesBurned: workout.caloriesBurned || workout.calories_burned || 0,
        exerciseCount: workout.exercises?.length || 0,
        exercises: exerciseNames,
        notes: workout.notes || ''
      };
    })
    .sort((a: WorkoutDetail, b: WorkoutDetail) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // ===== DETAILED MEAL LIST =====
  interface MealDetail {
    date: string;
    name: string;
    type: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    notes: string;
  }
  
  const mealDetails = meal_history
    .filter((meal: any) => meal.date)
    .map((meal: any) => {
      const date = meal.date.split("T")[0];
      
      return {
        date,
        name: meal.name || 'Unnamed Meal',
        type: meal.type || 'Unknown',
        calories: meal.calories || 0,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fat: meal.fat || 0,
        notes: meal.notes || ''
      };
    })
    .sort((a: MealDetail, b: MealDetail) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // ===== COMBINE ALL DATA FOR EXPORT =====
  
  // Special handling for water data - make sure it's included in summary section
  let totalWaterGlasses = 0;
  let waterTrackingDays = 0;
  
  // Calculate total water glasses and days tracked
  if (water_intake && typeof water_intake === 'object') {
    Object.values(water_intake).forEach(glasses => {
      const count = Number(glasses);
      if (!isNaN(count)) {
        totalWaterGlasses += count;
        waterTrackingDays++;
      }
    });
  }
  
  // 1. Add title and file info
  exportData.push({
    'FITNESS DATA EXPORT (WITH WATER TRACKING)': '',
    '': ''
  });
  
  exportData.push({
    'Generated On': new Date().toLocaleString(),
    'User': userData.name || 'User'
  });
  
  // Add water data prominently in summary if available
  if (waterTrackingDays > 0) {
    // Insert water summary after the main summary
    exportData.push({
      '': '',
      'WATER TRACKING SUMMARY': ''
    });
    
    // Create a proper object with all fields defined
    exportData.push({
      'Total Water Glasses Tracked': totalWaterGlasses,
      'Days With Water Tracking': waterTrackingDays,
      'Average Water Per Day': (totalWaterGlasses / waterTrackingDays).toFixed(1) + ' glasses',
      'Hydration Adherence': sortedDailyData.filter(day => day.waterGlasses >= 8).length + ' days met 8+ glasses target'
    });
  }
  
  // 2. Add summary information 
  exportData.push({
    '░░░░░░░░░░░░░░░░░░ SUMMARY STATISTICS ░░░░░░░░░░░░░░░░░░': '',
    '': ''
  });
  
  exportData.push({
    'Total Days Tracked': sortedDailyData.length,
    'Total Workouts': sortedDailyData.reduce((sum, day) => sum + day.workoutCount, 0),
    'Total Meals Logged': sortedDailyData.reduce((sum, day) => sum + day.mealCount, 0),
    'Total Water Glasses': sortedDailyData.reduce((sum, day) => sum + day.waterGlasses, 0)
  });
  
  // Add spacing
  exportData.push({
    '': '',
    '': ''
  });
  
  // 3. Add daily data
  exportData.push({
    '░░░░░░░░░░░░░░░░░░ DAILY ACTIVITY LOG ░░░░░░░░░░░░░░░░░░': '',
    'This section shows your complete activity for each day': ''
  });
  
  exportData.push({
    '': '',
    '': ''
  });
  
  exportData.push({
    'Date': 'Date',
    'Calories Consumed': 'Calories Consumed',
    'Calories Burned': 'Calories Burned',
    'Net Calories': 'Net Calories',
    'Protein (g)': 'Protein (g)',
    'Water (glasses)': 'Water (glasses)',
    'Workouts': 'Workouts',
    'Workout Types': 'Workout Types',
    'Workout Duration (min)': 'Workout Duration (min)',
    'Meals': 'Meals',
    'Meal Types': 'Meal Types'
  });
  
  sortedDailyData.forEach(day => {
    exportData.push({
      'Date': day.date,
      'Calories Consumed': day.totalCaloriesConsumed,
      'Calories Burned': day.totalCaloriesBurned,
      'Net Calories': day.netCalories,
      'Protein (g)': day.totalProtein,
      'Water (glasses)': day.waterGlasses,
      'Workouts': day.workoutCount,
      'Workout Types': day.workoutTypes,
      'Workout Duration (min)': day.workoutDuration,
      'Meals': day.mealCount,
      'Meal Types': day.mealTypes
    });
  });
  
  // Add spacing
  exportData.push({
    '': '',
    '': ''
  });
  
  // 4. Add weekly summaries
  if (sortedWeeklyData.length > 0) {
    exportData.push({
      '░░░░░░░░░░░░░░░░░░ WEEKLY SUMMARIES ░░░░░░░░░░░░░░░░░░': '',
      'This section shows your activity summarized by week': ''
    });
    
    exportData.push({
      '': '',
      '': ''
    });
    
    exportData.push({
      'Week Starting': 'Week Starting',
      'Total Calories': 'Total Calories',
      'Calories Burned': 'Calories Burned',
      'Avg Daily Calories': 'Avg Daily Calories',
      'Total Protein (g)': 'Total Protein (g)',
      'Total Water (glasses)': 'Total Water (glasses)',
      'Avg Daily Water': 'Avg Daily Water',
      'Total Workouts': 'Total Workouts',
      'Total Meals': 'Total Meals',
      'Active Days': 'Active Days'
    });
    
    sortedWeeklyData.forEach(week => {
      exportData.push({
        'Week Starting': week.weekStarting,
        'Total Calories': week.totalCaloriesConsumed,
        'Calories Burned': week.totalCaloriesBurned,
        'Avg Daily Calories': week.avgDailyCalories,
        'Total Protein (g)': week.totalProtein,
        'Total Water (glasses)': week.totalWaterGlasses,
        'Avg Daily Water': week.avgDailyWater,
        'Total Workouts': week.totalWorkouts,
        'Total Meals': week.totalMeals,
        'Active Days': week.activeDays
      });
    });
    
    // Add spacing
    exportData.push({
      '': '',
      '': ''
    });
  }
  
  // 5. Add progress metrics if available
  if (progressMetrics.length > 0) {
    exportData.push({
      '░░░░░░░░░░░░░░░░░░ PROGRESS METRICS ░░░░░░░░░░░░░░░░░░': '',
      'This section shows key metrics to track your fitness progress': ''
    });
    
    exportData.push({
      '': '',
      '': ''
    });
    
    exportData.push({
      'Metric': 'Metric',
      'Value': 'Value',
      'Description': 'Description'
    });
    
    progressMetrics.forEach(metric => {
      exportData.push({
        'Metric': metric.metric,
        'Value': metric.value,
        'Description': metric.description || ''
      });
    });
    
    // Add spacing
    exportData.push({
      '': '',
      '': ''
    });
  }
  
  // 6. Add water tracking details if available
  if (waterTrackingData.length > 0) {
    exportData.push({
      '░░░░░░░░░░░░░░░░░░ WATER INTAKE TRACKING ░░░░░░░░░░░░░░░░░░': '',
      'This section shows your daily water intake (recommended: 8+ glasses per day)': ''
    });
    
    exportData.push({
      '': '',
      '': ''
    });
    
    exportData.push({
      'Date': 'Date',
      'Glasses': 'Glasses',
      'Target Met (8+ glasses)': 'Target Met'
    });
    
    waterTrackingData.forEach((dayWater: {date: string, waterGlasses: number, targetMet: string}) => {
      exportData.push({
        'Date': dayWater.date,
        'Glasses': dayWater.waterGlasses,
        'Target Met (8+ glasses)': dayWater.targetMet
      });
    });
    
    // Add spacing
    exportData.push({
      '': '',
      '': ''
    });
  }
  
  // 7. Add detailed workout list
  if (workoutDetails.length > 0) {
    exportData.push({
      '░░░░░░░░░░░░░░░░░░ DETAILED WORKOUT LOG ░░░░░░░░░░░░░░░░░░': '',
      'This section shows details of each individual workout': ''
    });
    
    exportData.push({
      '': '',
      '': ''
    });
    
    exportData.push({
      'Date': 'Date',
      'Type': 'Type',
      'Duration (min)': 'Duration (min)',
      'Calories Burned': 'Calories Burned',
      'Exercise Count': 'Exercise Count',
      'Exercises': 'Exercises',
      'Notes': 'Notes'
    });
    
    workoutDetails.forEach((workout: WorkoutDetail) => {
      exportData.push({
        'Date': workout.date,
        'Type': workout.type,
        'Duration (min)': workout.duration,
        'Calories Burned': workout.caloriesBurned,
        'Exercise Count': workout.exerciseCount,
        'Exercises': workout.exercises,
        'Notes': workout.notes
      });
    });
    
    // Add spacing
    exportData.push({
      '': '',
      '': ''
    });
  }
  
  // 8. Add detailed meal list
  if (mealDetails.length > 0) {
    exportData.push({
      '░░░░░░░░░░░░░░░░░░ DETAILED MEAL LOG ░░░░░░░░░░░░░░░░░░': '',
      'This section shows details of each individual meal': ''
    });
    
    exportData.push({
      '': '',
      '': ''
    });
    
    exportData.push({
      'Date': 'Date',
      'Name': 'Name',
      'Type': 'Type',
      'Calories': 'Calories',
      'Protein (g)': 'Protein (g)',
      'Carbs (g)': 'Carbs (g)',
      'Fat (g)': 'Fat (g)',
      'Notes': 'Notes'
    });
    
    mealDetails.forEach((meal: MealDetail) => {
      exportData.push({
        'Date': meal.date,
        'Name': meal.name,
        'Type': meal.type,
        'Calories': meal.calories,
        'Protein (g)': meal.protein,
        'Carbs (g)': meal.carbs,
        'Fat (g)': meal.fat,
        'Notes': meal.notes
      });
    });
  }
  
  return exportData;
};

// Find a nice food pic based on meal name
export const getMealImage = (mealName: string): string => {
  const mealNameLower = mealName.toLowerCase();
  
  // Collection of food images sorted by category
  const mealImages: Record<string, string> = {
    // Breakfast
    "egg": "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "boiled egg": "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "egg salad": "https://images.unsplash.com/photo-1564143504305-646eabc4356e?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "simple egg salad": "https://images.unsplash.com/photo-1564143504305-646eabc4356e?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "oatmeal": "https://images.unsplash.com/photo-1614961233913-a5113a4a34ed?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "toast": "https://images.unsplash.com/photo-1525351484163-7529414344d8?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "avocado toast": "https://images.unsplash.com/photo-1588137378633-dea1336ce1e9?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    
    // Protein sources
    "chicken": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "chicken breast": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "grilled chicken": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "steak": "https://images.unsplash.com/photo-1504973960431-1c467e159aa4?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "beef": "https://images.unsplash.com/photo-1504973960431-1c467e159aa4?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "fish": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "salmon": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "tofu": "https://images.unsplash.com/photo-1584972191092-9554233c4fe4?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    
    // Salads
    "salad": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "chicken salad": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "greek salad": "https://images.unsplash.com/photo-1540420773420-3366772f4999?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    
    // Desserts
    "cake": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "chocolate": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "ice cream": "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    
    // Drinks
    "smoothie": "https://images.unsplash.com/photo-1553530979-5afe142917bc?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "protein shake": "https://images.unsplash.com/photo-1553530979-5afe142917bc?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "coffee": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "juice": "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    
    // Other common meals
    "burger": "https://images.unsplash.com/photo-1550547660-d9450f859349?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "sandwich": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "pizza": "https://images.unsplash.com/photo-1513104890138-7c749659a591?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "pasta": "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "rice": "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "curry": "https://images.unsplash.com/photo-1604152135912-04a022e23696?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "stir fry": "https://images.unsplash.com/photo-1512058564366-18510be2db19?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    "bowl": "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600",
    
    // Default fallback for names without matches
    "default": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600"
  };
  
  // Check if the meal name contains any of our keywords
  const matchingKey = Object.keys(mealImages).find(key => 
    mealNameLower.includes(key)
  );
  
  // Return the matching image or the default if nothing matches
  return matchingKey ? mealImages[matchingKey] : mealImages["default"];
};