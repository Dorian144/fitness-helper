import { StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

// Define additional color variants that aren't in the Colors constant
const primaryLight = '#d4ede2'; // Light variant of the primary green color
const secondaryLight = '#fff2dd'; // Light variant of the secondary orange color
const backgroundAlt = '#f7f7f7'; // Slightly different background for alternating items

// Common style values for consistency
const BORDER_RADIUS = {
  small: 8,
  medium: 12,
  large: 16,
  pill: 25,
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
};

export const styles = StyleSheet.create({
  // Container and Layout styles
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
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  tabContent: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  exerciseListContainer: {
    flex: 1,
  },
  
  // Tab styles
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    marginTop: 10,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.medium,
    overflow: 'hidden',
    ...SHADOWS.small,
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
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.lightText,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Search and filter styles
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
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.text,
  },
  filterChipTextSelected: {
    color: "#fff",
  },
  browseContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  
  // Section headings
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
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
  
  // Exercise list
  exerciseList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 20,
  },
  
  // Search results
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
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
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
  
  // Loading and empty states
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: Colors.lightText,
    fontSize: 16,
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
    color: Colors.primary,
    fontWeight: "500",
  },
  
  // Exercise card
  exerciseCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BORDER_RADIUS.medium,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  exerciseImage: {
    width: 100,
    height: 100,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    borderRadius: 0,
  },
  exerciseInfo: {
    flex: 1,
    padding: SPACING.md,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: SPACING.xs,
  },
  exerciseDescription: {
    fontSize: 13,
    color: Colors.lightText,
    marginBottom: SPACING.sm,
  },
  exerciseTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  exerciseCategory: {
    backgroundColor: primaryLight,
    color: Colors.primary,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: primaryLight,
  },
  equipmentTag: {
    backgroundColor: secondaryLight,
    color: Colors.secondary,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: secondaryLight,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
  
  // Welcome message
  welcomeMessageContainer: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: BORDER_RADIUS.large,
    padding: SPACING.xl,
    ...SHADOWS.large,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.lightText,
    marginBottom: SPACING.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  welcomeInstructions: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  suggestionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  suggestionChip: {
    backgroundColor: secondaryLight,
  },
  
  // Swipe action
  rightAction: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  rightActionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // Workout history
  workoutHistoryCard: {
    backgroundColor: Colors.card,
    borderRadius: BORDER_RADIUS.medium,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  workoutInfo: {
    padding: SPACING.md,
  },
  workoutHistoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  workoutHistoryStat: {
    fontSize: 13,
    color: Colors.lightText,
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  workoutTime: {
    fontSize: 12,
    color: Colors.lightText,
  },
  historyContainer: {
    marginTop: SPACING.md,
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  
  // Error states
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: Colors.error,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    width: 120,
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
  formErrorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
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
    backgroundColor: Colors.primary,
  },
  
  // Exercise details
  exerciseImageLarge: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  exerciseDetailsTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 12,
  },
  exerciseDetailsDescription: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  exerciseDetailsList: {
    marginBottom: 16,
  },
  exerciseDetailsItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  exerciseDetailsItemText: {
    color: Colors.text,
    fontSize: 16,
    marginLeft: 8,
  },
  exerciseCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  
  // Timer
  timerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  timerStateIndicator: {
    backgroundColor: Colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  deleteActionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  
  // Additional styles for workouts page
  emptyWorkout: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyWorkoutText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  emptyWorkoutSubtext: {
    fontSize: 14,
    color: Colors.lightText,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  browseButton: {
    backgroundColor: Colors.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.medium,
    ...SHADOWS.small,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  workoutButtonsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    zIndex: 10,
  },
  completeWorkoutButton: {
    backgroundColor: Colors.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
    ...SHADOWS.large,
  },
  
  // Workout exercise card
  workoutExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  workoutExerciseImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutExerciseContent: {
    flex: 1,
    padding: 0,
  },
  workoutExerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  workoutExerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
  },
  completedBadge: {
    backgroundColor: Colors.primary,
    borderRadius: BORDER_RADIUS.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutExerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.xs,
  },
  workoutExerciseStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  workoutExerciseStatText: {
    fontSize: 14,
    color: Colors.lightText,
    marginLeft: 4,
  },
  workoutExerciseTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  workoutExercisePlayButton: {
    position: 'relative',
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
    marginLeft: 8,
  },
  
  // History styles
  historyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
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
    backgroundColor: primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mealCountText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
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
    color: Colors.primary,
    marginBottom: 2,
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
  
  // Stat pill
  statPill: {
    backgroundColor: backgroundAlt,
    borderRadius: BORDER_RADIUS.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  macroText: {
    fontSize: 12,
    color: Colors.lightText,
  },
}); 