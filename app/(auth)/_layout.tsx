import { Stack } from "expo-router";
import { View, StyleSheet } from "react-native";
import Colors from "@/constants/colors";

export default function AuthLayout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerShadowVisible: false,
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: "600",
          },
          contentStyle: {
            backgroundColor: Colors.background,
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "Sign In",
          }}
        />
        <Stack.Screen
          name="register"
          options={{
            title: "Create Account",
          }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{
            title: "Reset Password",
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});