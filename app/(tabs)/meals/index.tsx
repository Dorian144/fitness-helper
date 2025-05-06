import React, { useState, useCallback, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  FlatList,
  Animated,
  Platform,
  SafeAreaView,
  Linking,
  Modal
} from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";
import Colors from "@/constants/colors";
import { Plus, Search, X, ChevronRight, Clock, Utensils, Trash2, ExternalLink, BookOpen, Calendar, List } from "lucide-react-native";
import { searchRecipes, getRecipeById } from "@/services/api";
import { API_CONFIG } from "@/constants/config";
import { debounce } from "lodash";
import { Swipeable, RectButton, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { calculateCalorieNeeds } from "@/services/utils";

// Define consistent delete action styles for swipe-to-delete
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

export default function MealsScreen() {
  const { user } = useAuthStore();
  const { profile, addMeal, removeMeal } = useUserStore();
  
  // Tab state
  const [activeTab, setActiveTab] = useState("browse");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOffset, setSearchOffset] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  
  // Filters state
  const [selectedDiet, setSelectedDiet] = useState("");
  const [selectedIntolerances, setSelectedIntolerances] = useState<string[]>([]);
  
  // Modal states
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [isViewingMeal, setIsViewingMeal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Daily meal state
  const [dailyMeals, setDailyMeals] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Custom meal form state
  const [customMeal, setCustomMeal] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    ingredients: "",
    instructions: ""
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Create a map of refs for swipeable components
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  
  // Date navigation functions
  const goToPreviousDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() - 1);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };
  
  const goToNextDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Don't allow navigating to future dates beyond today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (currentDate <= today) {
      setSelectedDate(currentDate.toISOString().split('T')[0]);
    }
  };
  
  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };
  
  // Check if selected date is today
  const isToday = () => {
    const today = new Date().toISOString().split('T')[0];
    return selectedDate === today;
  };
  
  // Group meals by date and update daily meals when profile changes
  useEffect(() => {
    if (profile && profile.meal_history) {
      // Group meals by date
      const mealsByDate: Record<string, any[]> = {};
      
      profile.meal_history.forEach((meal: any) => {
        const date = new Date(meal.date).toISOString().split('T')[0];
        if (!mealsByDate[date]) {
          mealsByDate[date] = [];
        }
        mealsByDate[date].push(meal);
      });
      
      // Set daily meals for selected date
      setDailyMeals(mealsByDate[selectedDate] || []);
    }
  }, [profile, selectedDate]);
  
  // Handle load more search results
  const handleLoadMore = async () => {
    if (searchResults.length < totalResults && !isSearching) {
      const newOffset = searchOffset + 10;
      setIsSearching(true);
      
      try {
        if (API_CONFIG.enableSpoonacular) {
          const response = await searchRecipes({
            query: searchQuery,
            diet: selectedDiet,
            intolerances: selectedIntolerances.join(','),
            number: 10,
            offset: newOffset
          });
          
          // Append new results to existing ones
          setSearchResults(prevResults => [...prevResults, ...response.results]);
          setTotalResults(response.totalResults);
          setSearchOffset(newOffset);
        }
      } catch (error) {
        console.error("Error loading more meals:", error);
        Alert.alert(
          "Error",
          "Failed to load more meals. Please try again.",
          [{ text: "OK" }]
        );
      } finally {
        setIsSearching(false);
      }
    }
  };

  // Debounce search to prevent too many API calls
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      
      try {
        if (API_CONFIG.enableSpoonacular) {
          const response = await searchRecipes({
            query,
            diet: selectedDiet,
            intolerances: selectedIntolerances.join(','),
            number: 10,
            offset: 0 // Always start from 0 for a new search
          });
          
          setSearchResults(response.results);
          setTotalResults(response.totalResults);
          setSearchOffset(0); // Reset offset for a new search
        } else {
          Alert.alert(
            "Search Disabled",
            "Recipe search is temporarily unavailable. Please try again later.",
            [{ text: "OK" }]
          );
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Search error:", error);
        Alert.alert(
          "Search Error",
          "Failed to search for recipes. Please try again later.",
          [{ text: "OK" }]
        );
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [selectedDiet, selectedIntolerances]
  );

  // Update search when query changes
  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch, selectedDiet, selectedIntolerances]);

  // Render the tabs at the top of the screen
  const renderTabs = () => {
    return (
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "browse" && styles.activeTab]}
          onPress={() => setActiveTab("browse")}
        >
          <BookOpen size={20} color={activeTab === "browse" ? Colors.secondary : Colors.lightText} />
          <Text style={[styles.tabText, activeTab === "browse" && styles.activeTabText]}>Browse</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === "daily" && styles.activeTab]}
          onPress={() => setActiveTab("daily")}
        >
          <Utensils size={20} color={activeTab === "daily" ? Colors.secondary : Colors.lightText} />
          <Text style={[styles.tabText, activeTab === "daily" && styles.activeTabText]}>Meal</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.activeTab]}
          onPress={() => setActiveTab("history")}
        >
          <Calendar size={20} color={activeTab === "history" ? Colors.secondary : Colors.lightText} />
          <Text style={[styles.tabText, activeTab === "history" && styles.activeTabText]}>History</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render the content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "browse":
        return renderBrowseTab();
      case "daily":
        return renderDailyMealTab();
      case "history":
        return renderHistoryTab();
      default:
        return null;
    }
  };

  // Handle meal view function
  const handleViewMeal = async (meal: any) => {
    try {
      setIsLoading(true);
      
      // Check if this is a meal that needs to be fetched from API 
      // or if we already have the complete meal data
      if (meal.id && typeof meal.id === 'number' && !meal.ingredients) {
        // Fetch detailed meal information from API including instructions and source URL
        console.log(`Fetching meal details from API for ID: ${meal.id}`);
        const detailedMeal = await getRecipeById(meal.id);
        
        // Debug log to check what data we're getting from the API
        console.log("Detailed meal data:", {
          id: detailedMeal.id,
          name: detailedMeal.name,
          hasIngredients: detailedMeal.ingredients && detailedMeal.ingredients.length > 0,
          ingredientsCount: detailedMeal.ingredients?.length || 0,
          hasInstructions: detailedMeal.instructions && detailedMeal.instructions.length > 0,
          instructionsCount: detailedMeal.instructions?.length || 0,
          hasSourceUrl: !!detailedMeal.sourceUrl,
          sourceUrl: detailedMeal.sourceUrl
        });
        
        setSelectedMeal(detailedMeal);
      } else {
        // This is a custom meal or already has complete data
        console.log("Using existing meal data:", meal.name);
        
        // Use the existing meal data with proper structure
        setSelectedMeal({
          id: meal.id,
          name: meal.name,
          image: meal.imageUrl || meal.image,
          calories: meal.calories || 0,
          protein: meal.protein || 0,
          carbs: meal.carbs || 0,
          fat: meal.fat || 0,
          readyInMinutes: meal.readyInMinutes || 0,
          servings: meal.servings || 1,
          ingredients: meal.ingredients || [],
          instructions: meal.instructions || [],
          sourceUrl: meal.sourceUrl || "",
          summary: meal.summary || ""
        });
      }
      
      setIsViewingMeal(true);
    } catch (error) {
      console.error("Error fetching meal details:", error);
      Alert.alert(
        "Error",
        "Failed to load meal details. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle adding meal to daily plan
  const handleAddToDaily = async (meal: any) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Generate a unique ID for the meal if it doesn't have one
      const mealId = meal.id && typeof meal.id === 'string' 
        ? meal.id 
        : `meal_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Copy all relevant meal data including ingredients, instructions, and sourceUrl
      await addMeal(user.uid, {
        id: mealId,
        name: meal.name,
        calories: meal.calories || 0,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fat: meal.fat || 0,
        imageUrl: meal.image || meal.imageUrl,
        date: new Date().toISOString(),
        // Preserve all recipe data
        ingredients: meal.ingredients || [],
        instructions: meal.instructions || [],
        sourceUrl: meal.sourceUrl || "",
        readyInMinutes: meal.readyInMinutes || 0,
        servings: meal.servings || 1,
        summary: meal.summary || "",
        // If this is an API meal, store original ID for reference
        originalId: typeof meal.id === 'number' ? meal.id : null
      });
      
      Alert.alert(
        "Meal Added",
        `${meal.name} has been added to your daily meal plan.`,
        [{ 
          text: "OK",
          onPress: () => {
            setActiveTab("daily"); // Switch to daily tab after adding
          }
        }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Diet and intolerance options
  const dietOptions = [
    { label: "None", value: "" },
    { label: "Gluten Free", value: "gluten free" },
    { label: "Ketogenic", value: "ketogenic" },
    { label: "Vegetarian", value: "vegetarian" },
    { label: "Vegan", value: "vegan" },
    { label: "Paleo", value: "paleo" }
  ];
  
  const intoleranceOptions = [
    { label: "Dairy", value: "dairy" },
    { label: "Egg", value: "egg" },
    { label: "Gluten", value: "gluten" },
    { label: "Peanut", value: "peanut" },
    { label: "Seafood", value: "seafood" },
    { label: "Soy", value: "soy" }
  ];
  
  const handleToggleIntolerance = (value: string) => {
    setSelectedIntolerances(prev => 
      prev.includes(value)
        ? prev.filter(i => i !== value)
        : [...prev, value]
    );
  };

  // Render the browse tab with search and popular recipes
  const renderBrowseTab = () => {
    return (
      <View style={styles.tabContent}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={20} color={Colors.lightText} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search meals..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <X size={20} color={Colors.lightText} />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setIsAddingMeal(true)}
          >
            <Plus size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.filtersContainer}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Diet:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {dietOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.filterChip,
                      selectedDiet === option.value && styles.filterChipSelected
                    ]}
                    onPress={() => setSelectedDiet(option.value)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedDiet === option.value && styles.filterChipTextSelected
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Intolerances:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {intoleranceOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.filterChip,
                      selectedIntolerances.includes(option.value) && styles.filterChipSelected
                    ]}
                    onPress={() => handleToggleIntolerance(option.value)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedIntolerances.includes(option.value) && styles.filterChipTextSelected
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
        
        <ScrollView style={styles.browseContent}>
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.secondary} />
              <Text style={styles.loadingText}>Searching for recipes...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Search Results</Text>
              </View>
              {searchResults.map((meal) => (
                <TouchableOpacity 
                  key={meal.id} 
                  style={styles.searchResultItem}
                  onPress={() => handleViewMeal(meal)}
                >
                  {meal.image && (
                    <Image 
                      source={{ uri: meal.image }} 
                      style={styles.searchResultImage} 
                    />
                  )}
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultTitle}>{meal.name}</Text>
                    <Text style={styles.searchResultSubtitle}>
                      Ready in {meal.readyInMinutes} minutes • {Math.round(meal.calories)} kcal
                    </Text>
                    <View style={styles.macroInfo}>
                      <View style={styles.statPill}>
                        <Text style={styles.macroText}>P: {Math.round(meal.protein)}g</Text>
                      </View>
                      <View style={styles.statPill}>
                        <Text style={styles.macroText}>C: {Math.round(meal.carbs)}g</Text>
                      </View>
                      <View style={styles.statPill}>
                        <Text style={styles.macroText}>F: {Math.round(meal.fat)}g</Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={20} color={Colors.lightText} />
                </TouchableOpacity>
              ))}
              {searchResults.length < totalResults && (
                <TouchableOpacity 
                  style={styles.loadMoreButton}
                  onPress={handleLoadMore}
                >
                  <Text style={styles.loadMoreText}>Load More</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.emptySearchState}>
              <Search size={40} color={Colors.lightText} />
              <Text style={styles.emptyStateText}>Search for meals</Text>
              <Text style={styles.emptyStateSubtext}>
                Enter a meal name or keyword above to find recipes
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // Render right swipe actions for meal items
  const renderRightActions = useCallback((mealId: string) => {
    if (!mealId) return null;
    
    return (
      <TouchableOpacity
        style={deleteActionStyles.container}
        onPress={() => handleDeleteDailyMeal(mealId)}
      >
        <Trash2 size={20} color="white" />
        <Text style={deleteActionStyles.text}>Delete</Text>
      </TouchableOpacity>
    );
  }, []);
  
  // Handle deleting a meal from the daily plan
  const handleDeleteDailyMeal = (mealId: string) => {
    if (!user) return;
    
    Alert.alert(
      "Remove Meal",
      "Are you sure you want to remove this meal from your daily plan?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            try {
              await removeMeal(user.uid, mealId);
              // Provide haptic feedback
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              // The dailyMeals will update automatically through the useEffect
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          } 
        }
      ]
    );
  };

  const renderDailyMealTab = () => {
    // Calculate daily nutrition totals
    const dailyTotals = dailyMeals.reduce((totals, meal) => {
      return {
        calories: totals.calories + (meal.calories || 0),
        protein: totals.protein + (meal.protein || 0),
        carbs: totals.carbs + (meal.carbs || 0),
        fat: totals.fat + (meal.fat || 0)
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    
    // Calculate calorie target based on user profile using the same method as home screen
    const calorieTarget = profile ? 
      calculateCalorieNeeds(
        profile.weight,
        profile.height,
        profile.age,
        profile.gender,
        profile.activityLevel
      ) : 2000;
    
    const proteinTarget = profile ? Math.round(profile.weight * 1.6) : 120; // 1.6g per kg of bodyweight to match home screen
    const carbsTarget = profile ? Math.round((calorieTarget * 0.45) / 4) : 250; // g
    const fatTarget = profile ? Math.round((calorieTarget * 0.25) / 9) : 55; // g
    
    return (
      <View style={styles.tabContent}>
        <View style={styles.dailyOverview}>
          <View style={styles.dateNavigation}>
            <TouchableOpacity 
              style={styles.dateNavButton}
              onPress={goToPreviousDay}
              activeOpacity={0.7}
            >
              <ChevronRight size={22} color={Colors.secondary} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.dateDisplay}
              onPress={goToToday}
              disabled={isToday()}
              activeOpacity={0.7}
            >
              <Text style={[styles.dailyDate, !isToday() && { textDecorationLine: 'underline' }]}>
                {new Date(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Text>
              {!isToday() && (
                <Text style={styles.todayHint}>(Tap to go to today)</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.dateNavButton, isToday() && styles.dateNavButtonDisabled]}
              onPress={goToNextDay}
              disabled={isToday()}
              activeOpacity={0.7}
            >
              <ChevronRight size={22} color={isToday() ? Colors.lightText : Colors.secondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.nutritionSummary}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(dailyTotals.calories)}</Text>
              <Text style={styles.nutritionLabel}>Calories</Text>
              <Text style={styles.nutritionTarget}>Target: {calorieTarget} kcal</Text>
            </View>
            
            <View style={styles.macroContainer}>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(dailyTotals.protein)}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
                <Text style={styles.macroTarget}>Target: {proteinTarget}g</Text>
              </View>
              
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(dailyTotals.carbs)}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
                <Text style={styles.macroTarget}>Target: {carbsTarget}g</Text>
              </View>
              
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(dailyTotals.fat)}g</Text>
                <Text style={styles.macroLabel}>Fat</Text>
                <Text style={styles.macroTarget}>Target: {fatTarget}g</Text>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.dailyMealsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isToday() 
                ? "Today's Meals" 
                : `Meals for ${new Date(selectedDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}`
              }
            </Text>
            <TouchableOpacity 
              style={styles.addMealButton}
              onPress={() => setActiveTab("browse")}
            >
              <Plus size={16} color="#fff" />
              <Text style={styles.addButtonText}>Add Meal</Text>
            </TouchableOpacity>
          </View>
          
          <GestureHandlerRootView style={{ flex: 1 }}>
            {dailyMeals.length > 0 && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingVertical: 8,
                paddingHorizontal: 16,
                marginBottom: 4,
              }}>
                <X size={14} color={Colors.lightText} />
                <Text style={{
                  fontSize: 12,
                  color: Colors.lightText,
                  marginLeft: 6,
                }}>Swipe left to delete</Text>
              </View>
            )}
            
            <ScrollView style={styles.dailyMealsList}>
              {dailyMeals.length === 0 ? (
                <View style={styles.emptyState}>
                  <Utensils size={40} color={Colors.lightText} />
                  <Text style={styles.emptyStateText}>No meals added today</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Add meals to track your nutrition
                  </Text>
                </View>
              ) : (
                dailyMeals.map((meal) => (
                  <Swipeable
                    key={meal.id}
                    renderRightActions={() => renderRightActions(meal.id)}
                  >
                    <TouchableOpacity 
                      style={styles.dailyMealItem}
                      onPress={() => handleViewMeal(meal)}
                    >
                      {meal.imageUrl && (
                        <Image 
                          source={{ uri: meal.imageUrl }} 
                          style={styles.dailyMealImage} 
                        />
                      )}
                      <View style={styles.dailyMealInfo}>
                        <Text style={styles.dailyMealName}>{meal.name}</Text>
                        <View style={styles.mealStats}>
                          <View style={styles.statPill}>
                            <Text style={styles.mealStat}>{meal.calories} kcal</Text>
                          </View>
                          {meal.protein && (
                            <View style={styles.statPill}>
                              <Text style={styles.mealStat}>{meal.protein}g protein</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.dailyMealTime}>
                          {new Date(meal.date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Swipeable>
                ))
              )}
            </ScrollView>
          </GestureHandlerRootView>
        </View>
      </View>
    );
  };

  const renderHistoryTab = () => {
    // Function to group meals by date
    const getMealsByDate = () => {
      if (!profile || !profile.meal_history) {
        return {};
      }

      // Group meals by date
      const mealsByDate: Record<string, any[]> = {};
      
      profile.meal_history.forEach((meal: any) => {
        const date = new Date(meal.date).toISOString().split('T')[0];
        if (!mealsByDate[date]) {
          mealsByDate[date] = [];
        }
        mealsByDate[date].push(meal);
      });
      
      return mealsByDate;
    };
    
    // Get all meal dates sorted in reverse chronological order
    const getAllDates = () => {
      const mealsByDate = getMealsByDate();
      return Object.keys(mealsByDate).sort((a, b) => 
        new Date(b).getTime() - new Date(a).getTime()
      );
    };
    
    // Calculate daily nutrition for a specific date
    const calculateDailyNutrition = (date: string) => {
      const mealsByDate = getMealsByDate();
      const mealsForDate = mealsByDate[date] || [];
      
      return mealsForDate.reduce((totals, meal) => {
        return {
          calories: totals.calories + (meal.calories || 0),
          protein: totals.protein + (meal.protein || 0),
          carbs: totals.carbs + (meal.carbs || 0),
          fat: totals.fat + (meal.fat || 0)
        };
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    };
    
    const dates = getAllDates();

    return (
      <View style={styles.tabContent}>
        <Text style={styles.historyTitle}>Meal History</Text>
        
        <ScrollView style={styles.historyList}>
          {dates.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar size={40} color={Colors.lightText} />
              <Text style={styles.emptyStateText}>No meal history</Text>
              <Text style={styles.emptyStateSubtext}>
                Add meals to your daily plan to see them here
              </Text>
            </View>
          ) : (
            dates.map((date) => {
              const nutrition = calculateDailyNutrition(date);
              const mealsForDate = getMealsByDate()[date];
              
              // Calculate nutrition targets once per card
              let calorieTarget = 2000;
              let proteinTarget = 120;
              let carbsTarget = 250;
              let fatTarget = 55;
              
              if (profile) {
                calorieTarget = calculateCalorieNeeds(
                  profile.weight,
                  profile.height,
                  profile.age,
                  profile.gender,
                  profile.activityLevel
                );
                proteinTarget = Math.round(profile.weight * 1.6); // 1.6g per kg of bodyweight
                carbsTarget = Math.round((calorieTarget * 0.45) / 4); // 45% of calories from carbs
                fatTarget = Math.round((calorieTarget * 0.25) / 9); // 25% of calories from fat
              }
              
              return (
                <TouchableOpacity 
                  key={date}
                  style={styles.historyDateCard}
                  onPress={() => {
                    setSelectedDate(date);
                    setActiveTab("daily");
                  }}
                >
                  <View style={styles.historyDateHeader}>
                    <Text style={styles.historyDate}>
                      {new Date(date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                    <View style={styles.mealCount}>
                      <Utensils size={16} color={Colors.secondary} />
                      <Text style={styles.mealCountText}>{mealsForDate.length} meals</Text>
                    </View>
                  </View>
                  
                  <View style={styles.historyNutrition}>
                    <View style={styles.historyNutritionItem}>
                      <Text style={styles.historyNutritionValue}>{Math.round(nutrition.calories)}</Text>
                      <Text style={styles.historyNutritionLabel}>kcal</Text>
                      <Text style={styles.historyNutritionTarget}>
                        Target: {Math.round(calorieTarget)}
                      </Text>
                    </View>
                    
                    <View style={styles.historyNutritionItem}>
                      <Text style={styles.historyNutritionValue}>{Math.round(nutrition.protein)}g</Text>
                      <Text style={styles.historyNutritionLabel}>protein</Text>
                      <Text style={styles.historyNutritionTarget}>
                        Target: {proteinTarget}g
                      </Text>
                    </View>
                    
                    <View style={styles.historyNutritionItem}>
                      <Text style={styles.historyNutritionValue}>{Math.round(nutrition.carbs)}g</Text>
                      <Text style={styles.historyNutritionLabel}>carbs</Text>
                      <Text style={styles.historyNutritionTarget}>
                        Target: {carbsTarget}g
                      </Text>
                    </View>
                    
                    <View style={styles.historyNutritionItem}>
                      <Text style={styles.historyNutritionValue}>{Math.round(nutrition.fat)}g</Text>
                      <Text style={styles.historyNutritionLabel}>fat</Text>
                      <Text style={styles.historyNutritionTarget}>
                        Target: {fatTarget}g
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.historyMealPreview}>
                    {mealsForDate.slice(0, 2).map((meal, index) => (
                      <Text key={`meal_${meal.id}_${index}`} style={styles.historyMealName} numberOfLines={1}>
                        • {meal.name}
                      </Text>
                    ))}
                    {mealsForDate.length > 2 && (
                      <Text style={styles.historyMoreMeals}>
                        +{mealsForDate.length - 2} more meals
                      </Text>
                    )}
                  </View>
                  
                  <ChevronRight size={20} color={Colors.lightText} style={styles.historyChevron} />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  // Handle adding a custom meal
  const handleAddCustomMeal = () => {
    // Validate form
    const newErrors: Record<string, string> = {};
    
    if (!customMeal.name.trim()) {
      newErrors.name = "Meal name is required";
    }
    
    if (!customMeal.calories.trim()) {
      newErrors.calories = "Calories are required";
    } else if (isNaN(Number(customMeal.calories)) || Number(customMeal.calories) <= 0) {
      newErrors.calories = "Please enter a valid calorie value";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    if (!user) {
      Alert.alert("Error", "You must be logged in to add meals");
      return;
    }
    
    // Generate unique meal ID
    const mealId = `meal_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Create meal object
    const meal = {
      id: mealId,
      name: customMeal.name.trim(),
      calories: Number(customMeal.calories),
      protein: customMeal.protein ? Number(customMeal.protein) : 0,
      carbs: customMeal.carbs ? Number(customMeal.carbs) : 0,
      fat: customMeal.fat ? Number(customMeal.fat) : 0,
      ingredients: customMeal.ingredients ? customMeal.ingredients.split('\n').filter(Boolean) : [],
      instructions: customMeal.instructions,
      date: new Date().toISOString(),
      isCustom: true
    };
    
    // Add meal to Firebase
    addMeal(user.uid, meal)
      .then(() => {
        // Show success message
        Alert.alert(
          "Meal Added",
          `${meal.name} has been added to your daily meal plan.`,
          [{ 
            text: "OK",
            onPress: () => {
              // Reset form
              setCustomMeal({
                name: "",
                calories: "",
                protein: "",
                carbs: "",
                fat: "",
                ingredients: "",
                instructions: ""
              });
              setErrors({});
              
              // Close modal
              setIsAddingMeal(false);
              
              // Navigate to daily tab
              setActiveTab("daily");
            }
          }]
        );
        
        // Add haptic feedback
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      })
      .catch((error) => {
        Alert.alert("Error", error.message || "Failed to add meal. Please try again.");
      });
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderTabs()}
      {renderContent()}

      {/* Custom Meal Form Modal */}
      {isAddingMeal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Meal</Text>
              <TouchableOpacity onPress={() => setIsAddingMeal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Meal Name *</Text>
                <TextInput
                  style={[styles.formInput, errors.name ? styles.inputError : null]}
                  placeholder="E.g., Chicken Salad"
                  value={customMeal.name}
                  onChangeText={(text) => {
                    setCustomMeal(prev => ({ ...prev, name: text }));
                    if (errors.name) {
                      setErrors(prev => ({ ...prev, name: '' }));
                    }
                  }}
                />
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
              </View>
              
              <View style={styles.nutrientsRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Calories *</Text>
                  <TextInput
                    style={[styles.formInput, errors.calories ? styles.inputError : null]}
                    placeholder="kcal"
                    value={customMeal.calories}
                    keyboardType="numeric"
                    onChangeText={(text) => {
                      setCustomMeal(prev => ({ ...prev, calories: text }));
                      if (errors.calories) {
                        setErrors(prev => ({ ...prev, calories: '' }));
                      }
                    }}
                  />
                  {errors.calories ? <Text style={styles.errorText}>{errors.calories}</Text> : null}
                </View>
                
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Protein</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="g"
                    value={customMeal.protein}
                    keyboardType="numeric"
                    onChangeText={(text) => setCustomMeal(prev => ({ ...prev, protein: text }))}
                  />
                </View>
              </View>
              
              <View style={styles.nutrientsRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Carbs</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="g"
                    value={customMeal.carbs}
                    keyboardType="numeric"
                    onChangeText={(text) => setCustomMeal(prev => ({ ...prev, carbs: text }))}
                  />
                </View>
                
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Fat</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="g"
                    value={customMeal.fat}
                    keyboardType="numeric"
                    onChangeText={(text) => setCustomMeal(prev => ({ ...prev, fat: text }))}
                  />
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Ingredients (optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Enter ingredients, one per line"
                  multiline
                  numberOfLines={4}
                  value={customMeal.ingredients}
                  onChangeText={(text) => setCustomMeal(prev => ({ ...prev, ingredients: text }))}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Instructions (optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Enter preparation instructions"
                  multiline
                  numberOfLines={4}
                  value={customMeal.instructions}
                  onChangeText={(text) => setCustomMeal(prev => ({ ...prev, instructions: text }))}
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setIsAddingMeal(false);
                  setCustomMeal({
                    name: "",
                    calories: "",
                    protein: "",
                    carbs: "",
                    fat: "",
                    ingredients: "",
                    instructions: ""
                  });
                  setErrors({});
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalAddButton}
                onPress={handleAddCustomMeal}
              >
                <Text style={styles.addButtonText}>Add to Daily Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Meal Detail Modal - Update the content for better UX */}
      {isViewingMeal && selectedMeal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Meal Details</Text>
              <TouchableOpacity onPress={() => setIsViewingMeal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.secondary} />
                <Text style={styles.loadingText}>Loading meal details...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalContent}>
                {(selectedMeal.image || selectedMeal.imageUrl) && (
                  <Image 
                    source={{ uri: selectedMeal.image || selectedMeal.imageUrl }} 
                    style={styles.mealDetailImage}
                    resizeMode="cover" 
                  />
                )}
                
                <Text style={styles.mealDetailTitle}>{selectedMeal.name}</Text>
                
                <View style={styles.mealDetailMacros}>
                  <View style={styles.macroDetailItem}>
                    <Text style={styles.macroDetailValue}>{Math.round(selectedMeal.calories)}</Text>
                    <Text style={styles.macroDetailLabel}>Calories</Text>
                  </View>
                  
                  <View style={styles.macroDetailItem}>
                    <Text style={styles.macroDetailValue}>{Math.round(selectedMeal.protein)}g</Text>
                    <Text style={styles.macroDetailLabel}>Protein</Text>
                  </View>
                  
                  <View style={styles.macroDetailItem}>
                    <Text style={styles.macroDetailValue}>{Math.round(selectedMeal.carbs)}g</Text>
                    <Text style={styles.macroDetailLabel}>Carbs</Text>
                  </View>
                  
                  <View style={styles.macroDetailItem}>
                    <Text style={styles.macroDetailValue}>{Math.round(selectedMeal.fat)}g</Text>
                    <Text style={styles.macroDetailLabel}>Fat</Text>
                  </View>
                </View>
                
                {selectedMeal.readyInMinutes && (
                  <View style={styles.mealDetailInfoRow}>
                    <Clock size={18} color={Colors.lightText} />
                    <Text style={styles.mealDetailInfoText}>
                      Ready in {selectedMeal.readyInMinutes} minutes
                    </Text>
                  </View>
                )}
                
                {/* Source Website Link */}
                {selectedMeal.sourceUrl && (
                  <TouchableOpacity 
                    style={styles.sourceUrlButton}
                    onPress={() => {
                      // Check if the Platform is web, otherwise try to use linking
                      if (Platform.OS === 'web') {
                        window.open(selectedMeal.sourceUrl, '_blank');
                      } else {
                        // Use Linking to open browser
                        Linking.openURL(selectedMeal.sourceUrl).catch(err => {
                          console.error("Failed to open URL:", err);
                          Alert.alert("Error", "Could not open the recipe website");
                        });
                      }
                    }}
                  >
                    <ExternalLink size={18} color="#fff" />
                    <Text style={styles.sourceUrlText}>View Original Recipe</Text>
                  </TouchableOpacity>
                )}
                
                {/* Ingredients Section */}
                {selectedMeal.ingredients && selectedMeal.ingredients.length > 0 ? (
                  <View style={styles.mealDetailSection}>
                    <Text style={styles.mealDetailSectionTitle}>Ingredients</Text>
                    {selectedMeal.ingredients.map((ingredient: any, index: number) => (
                      <Text key={index} style={styles.mealDetailIngredient}>
                        • {typeof ingredient === 'string' ? ingredient : ingredient.original || ingredient}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <View style={styles.mealDetailSection}>
                    <Text style={styles.mealDetailSectionTitle}>Ingredients</Text>
                    <Text style={[styles.mealDetailIngredient, {fontStyle: 'italic'}]}>
                      No ingredients information available
                    </Text>
                  </View>
                )}
                
                {/* Instructions Section */}
                {selectedMeal.instructions && selectedMeal.instructions.length > 0 ? (
                  <View style={styles.mealDetailSection}>
                    <Text style={styles.mealDetailSectionTitle}>Instructions</Text>
                    {selectedMeal.instructions.map((instruction: string, index: number) => (
                      <View key={index} style={styles.mealDetailStep}>
                        <Text style={styles.mealDetailStepNumber}>{index + 1}</Text>
                        <Text style={styles.mealDetailStepText}>{instruction}</Text>
                      </View>
                    ))}
                  </View>
                ) : selectedMeal.analyzedInstructions && selectedMeal.analyzedInstructions.length > 0 ? (
                  <View style={styles.mealDetailSection}>
                    <Text style={styles.mealDetailSectionTitle}>Instructions</Text>
                    {selectedMeal.analyzedInstructions[0].steps.map((step: any) => (
                      <View key={step.number} style={styles.mealDetailStep}>
                        <Text style={styles.mealDetailStepNumber}>{step.number}</Text>
                        <Text style={styles.mealDetailStepText}>{step.step}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.mealDetailSection}>
                    <Text style={styles.mealDetailSectionTitle}>Instructions</Text>
                    <Text style={[styles.mealDetailStepText, {fontStyle: 'italic'}]}>
                      No cooking instructions available
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setIsViewingMeal(false)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalAddButton}
                onPress={() => {
                  handleAddToDaily(selectedMeal);
                  setIsViewingMeal(false);
                }}
              >
                <Text style={styles.addButtonText}>Add to Daily Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.secondary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.lightText,
  },
  activeTabText: {
    color: Colors.secondary,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: 8,
    color: Colors.text,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.secondary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  browseContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  filterSection: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.text,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.card,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.text,
  },
  filterChipTextSelected: {
    color: "#fff",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: Colors.lightText,
    fontSize: 16,
  },
  searchResultItem: {
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
  },
  searchResultImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.text,
    marginBottom: 4,
  },
  searchResultSubtitle: {
    fontSize: 14,
    color: Colors.lightText,
  },
  macroInfo: {
    flexDirection: "row",
    marginTop: 4,
  },
  macroText: {
    fontSize: 12,
    color: Colors.lightText,
    marginRight: 8,
  },
  loadMoreButton: {
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadMoreText: {
    color: Colors.secondary,
    fontWeight: "500",
  },
  emptySearchState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.lightText,
    textAlign: "center",
  },
  historyTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: Colors.text,
    margin: 16,
  },
  historyList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  historyDateCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyDateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
  },
  mealCount: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mealCountText: {
    fontSize: 12,
    color: Colors.lightText,
    marginLeft: 4,
  },
  historyNutrition: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyNutritionItem: {
    alignItems: "center",
  },
  historyNutritionValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.secondary,
  },
  historyNutritionLabel: {
    fontSize: 12,
    color: Colors.lightText,
  },
  historyNutritionTarget: {
    fontSize: 10,
    color: Colors.lightText,
  },
  historyMealPreview: {
    marginBottom: 8,
  },
  historyMealName: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  historyMoreMeals: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
  },
  historyChevron: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
  statPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    marginRight: 6,
  },
  mealStat: {
    fontSize: 14,
    color: Colors.lightText,
  },
  dailyOverview: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    margin: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  dateNavButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dailyDate: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    textAlign: "center",
  },
  todayHint: {
    fontSize: 12,
    color: Colors.secondary,
    textAlign: "center",
    marginTop: 4,
  },
  dateNavButtonDisabled: {
    backgroundColor: Colors.card,
    opacity: 0.5,
  },
  nutritionSummary: {
    marginBottom: 8,
  },
  nutritionItem: {
    alignItems: "center",
    marginBottom: 16,
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.secondary,
  },
  nutritionLabel: {
    fontSize: 14,
    color: Colors.text,
    marginVertical: 4,
  },
  nutritionTarget: {
    fontSize: 12,
    color: Colors.lightText,
  },
  macroContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  macroItem: {
    flex: 1,
    alignItems: "center",
  },
  macroValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.secondary,
  },
  macroLabel: {
    fontSize: 12,
    color: Colors.text,
    marginVertical: 2,
  },
  macroTarget: {
    fontSize: 10,
    color: Colors.lightText,
  },
  dailyMealsSection: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  dailyMealsList: {
    flex: 1,
  },
  dailyMealItem: {
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
  },
  dailyMealImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: 12,
  },
  dailyMealInfo: {
    flex: 1,
  },
  dailyMealName: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.text,
    marginBottom: 4,
  },
  dailyMealTime: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
  },
  mealStats: {
    flexDirection: "row",
  },
  addMealButton: {
    flexDirection: "row",
    backgroundColor: Colors.secondary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginTop: 20,
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalContent: {
    padding: 16,
    maxHeight: 400,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  nutrientsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 12,
  },
  cancelButtonText: {
    color: Colors.text,
    fontWeight: '500',
  },
  // For the modal add button
  modalAddButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.secondary,
  },
  mealDetailImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  mealDetailTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 16,
  },
  mealDetailMacros: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  macroDetailItem: {
    alignItems: "center",
  },
  macroDetailValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.secondary,
  },
  macroDetailLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
  },
  mealDetailInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  mealDetailInfoText: {
    fontSize: 14,
    color: Colors.lightText,
    marginLeft: 8,
  },
  mealDetailSection: {
    marginVertical: 12,
  },
  mealDetailSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
  },
  mealDetailIngredient: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 6,
    lineHeight: 20,
  },
  mealDetailInstructions: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  mealDetailStep: {
    flexDirection: "row",
    marginBottom: 12,
  },
  mealDetailStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
    color: "#fff",
    textAlign: "center",
    marginRight: 12,
    fontWeight: "bold",
    lineHeight: 24,
  },
  mealDetailStepText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  sourceUrlButton: {
    flexDirection: 'row',
    alignItems: 'center', 
    backgroundColor: Colors.secondary,
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
    justifyContent: 'center',
  },
  sourceUrlText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
}); 