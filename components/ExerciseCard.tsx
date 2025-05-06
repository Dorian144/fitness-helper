import React, { useState, useEffect, useCallback, memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Play, Pause, Check, RotateCcw } from "lucide-react-native";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

interface ExerciseCardProps {
  name: string;
  description: string;
  onComplete: () => void;
  defaultDuration?: number; // in seconds
  sets?: number;
  reps?: number;
  rest?: number;
  duration?: number; // for timed exercises like planks
}

const ExerciseCard: React.FC<ExerciseCardProps> = memo(({
  name,
  description,
  onComplete,
  defaultDuration = 30,
  sets = 3,
  reps,
  duration,
  rest = 90 // Changed default rest to 90 seconds
}) => {
  // Use duration if provided, otherwise use defaultDuration
  const exerciseDuration = duration || defaultDuration;
  const [timer, setTimer] = useState(exerciseDuration);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [restTimer, setRestTimer] = useState(rest);
  
  // Figure out if we're counting reps or tracking time
  const isTimedExercise = Boolean(duration);
  
  // This handles the main exercise countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive && timer > 0 && !isResting) {
      interval = setInterval(() => {
        setTimer((prevTimer) => {
          // Buzz the phone when almost done (5 seconds left)
          if (prevTimer === 6 && Platform.OS !== "web") {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (error) {
              // Haptics aren't super critical, so just ignore errors
            }
          }
          return prevTimer - 1;
        });
      }, 1000) as unknown as NodeJS.Timeout;
    } else if (isActive && timer === 0 && !isResting) {
      // Set completed - give feedback to user
      if (Platform.OS !== "web") {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          // Ignore haptics errors
        }
      }
      
      if (currentSet < sets) {
        // Not done yet - start the rest period and prep for next set
        setIsResting(true);
        setRestTimer(rest);
        setCurrentSet(currentSet + 1);
      } else {
        // All sets completed! We're done!
        setIsActive(false);
        setIsCompleted(true);
        onComplete();
      }
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timer, isResting, currentSet, sets, rest, onComplete]);
  
  // This handles the rest period timer 
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive && isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prevTimer) => {
          // Buzz the phone when rest is almost over (3 seconds left)
          if (prevTimer === 4 && Platform.OS !== "web") {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (error) {
              // Ignore haptics errors
            }
          }
          return prevTimer - 1;
        });
      }, 1000) as unknown as NodeJS.Timeout;
    } else if (isActive && isResting && restTimer === 0) {
      // Rest period over, get ready for the next set!
      setIsResting(false);
      setTimer(exerciseDuration);
      
      if (Platform.OS !== "web") {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          // Ignore haptics errors
        }
      }
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, isResting, restTimer, exerciseDuration]);
  
  // Play/pause button handler
  const toggleTimer = useCallback(() => {
    setIsActive(!isActive);
    
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        // Ignore haptics errors
      }
    }
  }, [isActive]);
  
  // Reset everything back to the start
  const resetTimer = useCallback(() => {
    setIsActive(false);
    setTimer(exerciseDuration);
    setIsResting(false);
    setRestTimer(rest);
    setCurrentSet(1);
    setIsCompleted(false);
    
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        // Ignore haptics errors
      }
    }
  }, [exerciseDuration, rest]);
  
  // Skip the timer and just mark it done
  const markAsCompleted = useCallback(() => {
    setIsActive(false);
    setIsCompleted(true);
    onComplete();
    
    if (Platform.OS !== "web") {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        // Ignore haptics errors
      }
    }
  }, [onComplete]);
  
  // Convert seconds to min:sec format (like 1:45)
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }, []);
  
  return (
    <View style={[
      styles.container,
      isCompleted ? styles.completedContainer : null
    ]}>
      {/* Name and timer display */}
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        {isResting ? (
          <Text style={styles.restTimer}>Rest: {formatTime(restTimer)}</Text>
        ) : (
          <Text style={styles.timer}>{formatTime(timer)}</Text>
        )}
      </View>
      
      {/* Exercise instructions */}
      <Text style={styles.description} numberOfLines={3}>
        {description}
      </Text>
      
      {/* Set/rep info */}
      <View style={styles.setInfo}>
        <Text style={styles.setInfoText}>
          {isTimedExercise 
            ? `${sets} sets × ${exerciseDuration}s hold` 
            : `${sets} sets × ${reps || 12} reps`}
          {isActive && !isCompleted && ` • Set ${currentSet}/${sets}`}
        </Text>
        {isResting && (
          <View style={styles.restIndicator}>
            <Text style={styles.restText}>Resting</Text>
          </View>
        )}
      </View>
      
      {/* Control buttons */}
      <View style={styles.controls}>
        {!isCompleted ? (
          <>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleTimer}
              accessibilityLabel={isActive ? "Pause timer" : "Start timer"}
            >
              {isActive ? (
                <Pause color={Colors.primary} size={20} />
              ) : (
                <Play color={Colors.primary} size={20} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={resetTimer}
              accessibilityLabel="Reset timer"
            >
              <RotateCcw color={Colors.lightText} size={20} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={markAsCompleted}
              accessibilityLabel="Mark as completed"
            >
              <Check color={Colors.success} size={20} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.completedIndicator}>
            <Check color={Colors.success} size={20} />
            <Text style={styles.completedText}>Completed</Text>
          </View>
        )}
      </View>
      
      {/* Progress bar shown during active timer */}
      {isActive && !isCompleted && (
        <View style={styles.progressContainer}>
          <View 
            style={[
              styles.progressBar, 
              { 
                width: isResting 
                  ? `${(1 - restTimer / rest) * 100}%` 
                  : `${(1 - timer / exerciseDuration) * 100}%` 
              }
            ]} 
          />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  completedContainer: {
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    flex: 1,
  },
  timer: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.primary,
  },
  restTimer: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.warning,
  },
  description: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 12,
  },
  setInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  setInfoText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: "500",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
    height: 3,
    backgroundColor: "#f0f0f0",
    borderRadius: 2,
    marginTop: 16,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: Colors.success,
    borderRadius: 2,
  },
  completedIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  completedText: {
    color: Colors.success,
    fontWeight: "500",
    marginLeft: 6,
  },
  restIndicator: {
    backgroundColor: Colors.warning + "20",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  restText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: "500",
  }
});

export default ExerciseCard;