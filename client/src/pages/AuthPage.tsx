import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { Redirect, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { FirebaseConfigAlert } from "@/components/auth/FirebaseConfigAlert";
import { Separator } from "@/components/ui/separator";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("login");
  
  // Parse query params to detect if we should show register tab
  useEffect(() => {
    const searchParams = new URLSearchParams(location.split("?")[1]);
    const tab = searchParams.get("tab");
    if (tab === "register") {
      setActiveTab("register");
    }
  }, [location]);

  // Redirect if user is already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  const LoginForm = () => {
    const loginForm = useForm<LoginFormValues>({
      resolver: zodResolver(loginSchema),
      defaultValues: {
        username: "",
        password: "",
      },
    });

    const onLoginSubmit = (values: LoginFormValues) => {
      loginMutation.mutate(values);
    };

    return (
      <Form {...loginForm}>
        <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
          <FormField
            control={loginForm.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={loginForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            className="w-full"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          
          <GoogleLoginButton />
        </form>
      </Form>
    );
  };

  const RegisterForm = () => {
    const registerForm = useForm<RegisterFormValues>({
      resolver: zodResolver(registerSchema),
      defaultValues: {
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      },
    });

    const onRegisterSubmit = (values: RegisterFormValues) => {
      const { confirmPassword, ...registerData } = values;
      registerMutation.mutate(registerData);
    };

    return (
      <Form {...registerForm}>
        <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
          <FormField
            control={registerForm.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={registerForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="your@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={registerForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={registerForm.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="confirm password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            className="w-full"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Register"
            )}
          </Button>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          
          <GoogleLoginButton />
        </form>
      </Form>
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="flex-1 flex items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
            <CardDescription>
              Sign in or create an account to manage your AI personas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <FirebaseConfigAlert />
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm />
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 border-t pt-4">
            <p className="px-4 text-center text-sm text-muted-foreground">
              By continuing, you agree to our terms of service and privacy policy.
            </p>
          </CardFooter>
        </Card>
      </div>
      <div className="flex-1 bg-muted p-10 hidden md:flex flex-col justify-center items-center text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter">Persona Chat</h1>
          <p className="text-muted-foreground">
            Create and chat with your custom AI personas. They can respond on WhatsApp too!
          </p>
        </div>
        <div className="space-y-4 max-w-md">
          <div className="flex items-center space-x-4 bg-background p-4 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">1</div>
            <div className="flex-1">
              <h3 className="font-medium">Create your personas</h3>
              <p className="text-sm text-muted-foreground">Customize their personality, traits, and interests</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 bg-background p-4 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">2</div>
            <div className="flex-1">
              <h3 className="font-medium">Chat with them in-app</h3>
              <p className="text-sm text-muted-foreground">Talk to your personas through text or voice messages</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 bg-background p-4 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">3</div>
            <div className="flex-1">
              <h3 className="font-medium">Get WhatsApp messages</h3>
              <p className="text-sm text-muted-foreground">Enable WhatsApp to get messages from your personas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}