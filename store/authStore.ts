import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "firebase/auth";
import { 
  signIn, 
  signUp, 
  signOut, 
  resetPassword, 
  createUserProfile
} from "@/services/firebase";

// This extends the Firebase User type so we can handle both Firebase users
// and our stored user data with the same interface
interface ExtendedUser extends Partial<User> {
  uid: string;
  email: string | null;
  isStoredUser?: boolean;
}

interface AuthState {
  user: ExtendedUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, userData: any) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  setUser: (user: User | ExtendedUser | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
      
      setUser: (user) => {
        // Takes care of both Firebase User objects and our locally stored user data
        if (user) {
          // Making sure we grab all the fields we need
          const validUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || null,
            photoURL: user.photoURL || null,
            // Keep the isStoredUser flag if it exists
            ...(user as ExtendedUser).isStoredUser ? { isStoredUser: true } : {}
          };
          
          set({ 
            user: validUser, 
            isAuthenticated: true 
          });
        } else {
          set({ 
            user: null, 
            isAuthenticated: false 
          });
        }
      },
      
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const user = await signIn(email, password);
          set({ 
            user: {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || null,
              photoURL: user.photoURL || null
            }, 
            isAuthenticated: true, 
            isLoading: false 
          });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },
      
      register: async (email, password, userData) => {
        set({ isLoading: true, error: null });
        try {
          const user = await signUp(email, password);
          if (user) {
            // Create a profile with the extra user data we collected
            await createUserProfile(user.uid, userData);
            set({ 
              user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || null,
                photoURL: user.photoURL || null
              }, 
              isAuthenticated: true, 
              isLoading: false 
            });
          }
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },
      
      logout: async () => {
        set({ isLoading: true, error: null });
        try {
          await signOut();
          // Clean up any stored auth data to prevent lingering sessions
          await AsyncStorage.removeItem('@firebase_auth_user');
          set({ user: null, isAuthenticated: false, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },
      
      forgotPassword: async (email) => {
        set({ isLoading: true, error: null });
        try {
          await resetPassword(email);
          set({ isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },
      
      clearError: () => set({ error: null })
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // We're not storing auth state with zustand's persist anymore
      // This avoids duplicate storage and potential weird sync issues
      partialize: (state) => ({})
    }
  )
);