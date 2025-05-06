import React, { useState } from "react";
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Platform,
  Image,
  Alert,
  ActivityIndicator,
  Text
} from "react-native";
import { Camera } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";

interface ProfilePhotoProps {
  photoURL?: string;
  size?: number;
  onSelectImage: (uri: string) => void;
  name?: string;
}

// Make a nice color based on someone's name (like Gmail does)
const getColorFromName = (name?: string): string => {
  if (!name) return Colors.primary;
  
  // Turn the name into a number using character codes
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Pick from a set of nice, vibrant colors
  const colors = [
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#F44336', // Red
    '#009688', // Teal
    '#673AB7', // Deep Purple
    '#3F51B5', // Indigo
    '#FF5722', // Deep Orange
    '#795548', // Brown
  ];
  
  // Use the hash to pick one of our colors
  return colors[Math.abs(hash) % colors.length];
};

// Get initials from a name (like "John Smith" -> "JS")
const getInitials = (name?: string): string => {
  if (!name) return "?";
  
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

const ProfilePhoto: React.FC<ProfilePhotoProps> = ({
  photoURL,
  size = 100,
  onSelectImage,
  name
}) => {
  const [isUploading, setIsUploading] = useState(false);
  
  // Handle image selection from the user's device
  const pickImage = async () => {
    try {
      setIsUploading(true);
      
      // Make sure we can access the photo library
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Required", 
            "We need access to your photos to set a profile picture.",
            [{ text: "OK" }]
          );
          return;
        }
      }
      
      // Open the image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        // Check file size - don't want to upload huge images
        const response = await fetch(selectedAsset.uri);
        const blob = await response.blob();
        
        if (blob.size > 5 * 1024 * 1024) {
          Alert.alert(
            "File Too Large", 
            "Please select an image smaller than 5MB.",
            [{ text: "OK" }]
          );
          return;
        }
        
        // Make sure it's actually an image
        if (!blob.type.startsWith('image/')) {
          Alert.alert(
            "Invalid File Type", 
            "Please select a valid image file.",
            [{ text: "OK" }]
          );
          return;
        }
        
        // All good! Send the image to parent component
        onSelectImage(selectedAsset.uri);
      }
    } catch (error) {
      // Something went wrong, let the user know
      Alert.alert(
        "Error", 
        "Failed to select image. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsUploading(false);
    }
  };
  
  // Add a timestamp to bust the cache so we always get the latest image
  const getPhotoUrl = () => {
    if (!photoURL) return undefined;
    
    // If URL already has a query parameter, add timestamp with &
    // Otherwise add it with ?
    const separator = photoURL.includes('?') ? '&' : '?';
    return `${photoURL}${separator}t=${Date.now()}`;
  };
  
  // Get color and initials for placeholder
  const bgColor = getColorFromName(name);
  const initials = getInitials(name);
  
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[
          styles.photoContainer, 
          { width: size, height: size, borderRadius: size / 2 }
        ]} 
        onPress={pickImage}
        disabled={isUploading}
      >
        {photoURL ? (
          // Show the actual profile photo if we have one
          <Image 
            source={{ uri: getPhotoUrl() }} 
            style={[
              styles.photo, 
              { width: size, height: size, borderRadius: size / 2 }
            ]} 
          />
        ) : (
          // Otherwise show a colored circle with initials
          <View style={[
            styles.placeholder, 
            { 
              width: size, 
              height: size, 
              borderRadius: size / 2, 
              backgroundColor: bgColor 
            }
          ]}>
            <Text style={[
              styles.initialsText,
              { fontSize: size * 0.4 } // Adjust text size based on container size
            ]}>
              {initials}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 16,
  },
  photoContainer: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: Colors.background,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photo: {
    resizeMode: "cover",
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  initialsText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ProfilePhoto;