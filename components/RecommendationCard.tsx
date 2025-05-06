import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { Lightbulb, RefreshCw } from "lucide-react-native";
import Colors from "@/constants/colors";

interface RecommendationCardProps {
  recommendation: string | null;
  isLoading?: boolean;
  isFallback?: boolean;
  onRefresh?: () => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  isLoading = false,
  isFallback = false,
  onRefresh
}) => {
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshDisabled, setRefreshDisabled] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  
  // Remember when we last got new advice
  useEffect(() => {
    if (recommendation && !isLoading && !lastRefreshTime) {
      setLastRefreshTime(new Date());
    }
  }, [recommendation, isLoading, lastRefreshTime]);
  
  // Countdown timer so we don't spam the API
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (refreshCooldown > 0) {
      timer = setInterval(() => {
        setRefreshCooldown(prev => {
          if (prev <= 1) {
            setRefreshDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000) as unknown as NodeJS.Timeout;
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [refreshCooldown]);
  
  // Handle the refresh button click
  const handleRefresh = async () => {
    if (onRefresh && !isRefreshing && !refreshDisabled) {
      setIsRefreshing(true);
      setRefreshDisabled(true);
      
      try {
        await onRefresh();
        setLastRefreshTime(new Date());
        // Cool down for 20 seconds to be nice to the API
        setRefreshCooldown(20);
      } catch (error) {
        // Just silently fail, no need to show errors to user
      } finally {
        setIsRefreshing(false);
      }
    }
  };
  
  // Figure out how to show when we last refreshed
  const getRefreshTimeText = () => {
    if (!lastRefreshTime) return "";
    
    const now = new Date();
    const diffMs = now.getTime() - lastRefreshTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Updated just now";
    if (diffMins === 1) return "Updated 1 minute ago";
    if (diffMins < 60) return `Updated ${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "Updated 1 hour ago";
    if (diffHours < 24) return `Updated ${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Updated 1 day ago";
    return `Updated ${diffDays} days ago`;
  };
  
  // Show loading state while we're getting a recommendation
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Lightbulb size={20} color={Colors.secondary} />
          <Text style={styles.title}>Daily Recommendation</Text>
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.secondary} />
          <Text style={styles.loadingText}>Generating your personalized recommendation...</Text>
        </View>
      </View>
    );
  }
  
  // If we don't have a recommendation yet, don't show anything
  if (!recommendation) {
    return null;
  }
  
  return (
    <View style={styles.container}>
      {/* Header with title and refresh button */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Lightbulb size={20} color={Colors.secondary} />
          <Text style={styles.title}>Daily Recommendation</Text>
        </View>
        
        {/* Only show refresh button if we have a refresh function */}
        {onRefresh && (
          <TouchableOpacity 
            style={[
              styles.refreshButton,
              refreshDisabled && styles.refreshButtonDisabled
            ]} 
            onPress={handleRefresh}
            disabled={isRefreshing || refreshDisabled}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={Colors.secondary} />
            ) : refreshCooldown > 0 ? (
              <Text style={styles.cooldownText}>{refreshCooldown}s</Text>
            ) : (
              <RefreshCw size={16} color={Colors.secondary} />
            )}
          </TouchableOpacity>
        )}
      </View>
      
      {/* The actual recommendation text */}
      <Text style={styles.content}>{recommendation}</Text>
      
      {/* Footer with fallback notice and refresh time */}
      <View style={styles.footer}>
        {isFallback && (
          <Text style={styles.fallbackNote}>
            Note: This is a default recommendation. Complete your profile for personalized advice.
          </Text>
        )}
        
        {lastRefreshTime && (
          <Text style={styles.refreshTime}>{getRefreshTimeText()}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF9E6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
    marginLeft: 8,
  },
  content: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  footer: {
    marginTop: 12,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  loadingText: {
    marginTop: 8,
    color: Colors.lightText,
    textAlign: "center",
  },
  fallbackNote: {
    fontSize: 12,
    fontStyle: "italic",
    color: Colors.lightText,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  cooldownText: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: "bold",
  },
  refreshTime: {
    fontSize: 10,
    color: Colors.lightText,
    fontStyle: "italic",
    marginTop: 4,
    textAlign: "right",
  },
});

export default RecommendationCard;