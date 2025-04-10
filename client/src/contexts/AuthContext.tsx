import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle, signOutFirebase, handleRedirectResult } from "../lib/firebase";

// Types
interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  apiUsage: number;
  usageLimit: number;
  profilePicture: string | null;
  googleId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LoginData {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  googleLoginMutation: UseMutationResult<any, Error, void>;
  handleGoogleLogin: () => void;
}

// Create auth context
const AuthContext = createContext<AuthContextType | null>(null);

// Auth provider component
function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Fetch the current user
  const {
    data: user,
    error,
    isLoading,
    refetch
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  
  // Handle Firebase redirect result on component mount
  useEffect(() => {
    const processRedirectResult = async () => {
      try {
        console.log("Checking for Firebase redirect result in AuthProvider");
        const userData = await handleRedirectResult();
        
        if (userData) {
          console.log("Received user data after redirect:", userData);
          // Update React Query cache with the user data
          queryClient.setQueryData(["/api/user"], userData);
          
          toast({
            title: "Google login successful",
            description: `Welcome, ${userData.username}!`,
          });
          
          // Refetch user data to ensure we have the latest
          refetch();
        }
      } catch (error) {
        console.error("Error processing redirect result:", error);
        toast({
          title: "Google login failed",
          description: error instanceof Error ? error.message : "Authentication failed",
          variant: "destructive",
        });
      }
    };
    
    processRedirectResult();
  }, [toast, refetch]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Sign out from both Firebase and session
      if (user?.googleId) {
        await signOutFirebase();
      } else {
        await apiRequest("POST", "/api/logout");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Google login mutation
  const googleLoginMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      try {
        await signInWithGoogle();
      } catch (error) {
        console.error("Google login error:", error);
        throw new Error(error instanceof Error ? error.message : "Google login failed");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Google login failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handler for Google login
  const handleGoogleLogin = () => {
    googleLoginMutation.mutate();
  };

  // Create context value
  const contextValue = {
    user: user ?? null,
    isLoading,
    error,
    loginMutation,
    logoutMutation,
    registerMutation,
    googleLoginMutation,
    handleGoogleLogin
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for using auth context
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthProvider, useAuth };