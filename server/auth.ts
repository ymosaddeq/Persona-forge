import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users, User } from "@shared/schema";
import { eq, sql, or } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import pg from "pg";
import { verifyFirebaseToken } from './firebase-admin';
import { storage } from './storage';

// Create a connection pool for sessions
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const PostgresSessionStore = connectPg(session);

// Extend Express User interface
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      role: string;
      apiUsage: number;
      usageLimit: number;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

const scryptAsync = promisify(scrypt);

// Hash the password using scrypt
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Compare the supplied password with the stored hashed password
async function comparePasswords(supplied: string, stored: string | null) {
  if (!stored) return false;
  
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Track API usage for a user
export async function incrementApiUsage(userId: number) {
  await db
    .update(users)
    .set({ apiUsage: sql`api_usage + 1` })
    .where(eq(users.id, userId));
}

// Check if a user has exceeded their usage limit
export async function checkUsageLimit(userId: number): Promise<boolean> {
  const [user] = await db
    .select({ apiUsage: users.apiUsage, usageLimit: users.usageLimit })
    .from(users)
    .where(eq(users.id, userId));
  
  if (!user) return false;
  
  return user.apiUsage < user.usageLimit;
}

// Reset API usage for all users (could be called daily/monthly)
export async function resetApiUsage() {
  await db
    .update(users)
    .set({ apiUsage: 0 });
}

// Setup authentication middlewares and routes
export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key", // In production, use a secure environment variable
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    store: new PostgresSessionStore({
      pool,
      tableName: 'session', // Use this table name for sessions
      createTableIfMissing: true
    })
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure the local strategy for passport
  passport.use(
    new LocalStrategy(
      {
        usernameField: "username", // Could also use email
        passwordField: "password",
      },
      async (username, password, done) => {
        try {
          // Find user by username (or email)
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username));
          
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid username or password" });
          }
          
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  // Configure serialization/deserialization
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id));
      
      if (!user) {
        return done(null, false);
      }
      
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const userData = req.body;
      
      // Check if username or email already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, userData.username));
      
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const [existingEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email));
      
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash the password before storing
      const hashedPassword = await hashPassword(userData.password);
      
      // Create the new user
      const newUserData = {
        ...userData,
        password: hashedPassword,
        role: "user", // Default role
        apiUsage: 0,   // Initial API usage
        usageLimit: 100 // Default usage limit
      };
      
      const [createdUser] = await db
        .insert(users)
        .values(newUserData)
        .returning();

      // Log the user in automatically after registration
      req.login(createdUser, (err) => {
        if (err) return next(err);
        
        // Don't send the password back to the client
        const { password, ...userWithoutPassword } = createdUser;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Error during registration:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      req.login(user, (err: any) => {
        if (err) {
          return next(err);
        }
        
        // Don't send the password back to the client
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Google Auth endpoint
  app.post("/api/auth/google", async (req, res, next) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      // Verify the Firebase token
      const decodedToken = await verifyFirebaseToken(token);
      
      if (!decodedToken) {
        return res.status(401).json({ message: "Invalid token" });
      }
      
      const { email, name, picture, uid } = decodedToken;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Try to find user by Google ID
      let user = await storage.getUserByGoogleId(uid);
      
      // If not found by Google ID, check by email
      if (!user) {
        // Find user by email
        const userByEmail = await storage.getUserByEmail(email);
        
        if (userByEmail) {
          // Update user with Google ID
          user = await storage.updateUserGoogleId(userByEmail.id, uid, picture);
        }
      }
      
      // If user doesn't exist, create a new one
      if (!user) {
        // Generate a username from email if not provided
        const username = name || email.split('@')[0];
        
        // Check if username exists and make it unique if needed
        let uniqueUsername = username;
        let counter = 1;
        
        while (await storage.getUserByUsername(uniqueUsername)) {
          // If username exists, append a number and try again
          uniqueUsername = `${username}${counter++}`;
        }
        
        // Create new user with Google info
        user = await storage.createUser({
          username: uniqueUsername,
          email,
          googleId: uid,
          password: "", // Empty string for Google auth
          profilePicture: picture || null,
          role: "user"
        });
      }
      
      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Don't send the password back to the client
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Error during Google authentication:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  // Get current user endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Don't send the password back to the client
    const { password, ...userWithoutPassword } = req.user as User;
    res.json(userWithoutPassword);
  });
}

// Middleware to check if the user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ message: "Authentication required" });
}

// Middleware to check if the user is an admin
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user && req.user.role === "admin") {
    return next();
  }
  
  res.status(403).json({ message: "Admin access required" });
}

// Middleware to check API usage before processing requests
export async function checkApiLimits(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return next();
  }
  
  const canProceed = await checkUsageLimit(req.user.id);
  
  if (!canProceed) {
    return res.status(429).json({ 
      message: "API usage limit exceeded", 
      usageLimit: req.user.usageLimit,
      currentUsage: req.user.apiUsage
    });
  }
  
  // Track the usage
  await incrementApiUsage(req.user.id);
  next();
}