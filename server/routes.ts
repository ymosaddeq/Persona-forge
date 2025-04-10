import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertPersonaSchema, 
  updatePersonaSchema, 
  insertConversationSchema, 
  insertMessageSchema
} from "@shared/schema";
import { 
  setupAuth,
  isAuthenticated, 
  isAdmin, 
  checkApiLimits, 
  incrementApiUsage, 
  resetApiUsage 
} from "./auth";
import { generatePersonaMessage, generatePersonaReply, generateVoiceMessage } from "./openai";
import { sendWhatsAppMessage, checkWhatsAppAvailability } from "./greenapi";
import nodeSchedule from 'node-schedule';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { promisify } from 'util';

// Set up multer for file uploads
const UPLOADS_DIR = path.resolve('./public/uploads');
// Make sure the uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `user-voice-${uniquePrefix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // Default user for development
  const defaultUserId = 1;
  try {
    await storage.createUser({
      username: "demo",
      email: "demo@example.com",
      password: "password"
    });
  } catch (error) {
    console.error("Error creating default user:", error);
  }
  
  // Setup authentication with Passport
  setupAuth(app);
  
  // Handle Firebase Auth redirects - add multiple potential paths
  const firebaseRedirectPaths = ["/__/auth/handler", "/auth/handler", "/.well-known/firebase"];
  
  firebaseRedirectPaths.forEach(path => {
    app.get(path, (req, res) => {
      console.log(`Firebase Auth redirect handler called for path: ${path}`);
      // Redirect to the auth page
      res.redirect('/auth');
    });
  });
  
  // Add Google authentication endpoint
  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "No token provided" });
      }
      
      // Log details about the request
      console.log("Google auth request received with token:", token.substring(0, 10) + "...");
      
      // Import verifyFirebaseToken from firebase-admin.ts
      const { verifyFirebaseToken } = await import("./firebase-admin");
      
      // Verify the token with Firebase
      const decodedToken = await verifyFirebaseToken(token);
      
      if (!decodedToken) {
        console.error("Token verification failed, token invalid or expired");
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      
      console.log("Token verified for user:", decodedToken.email);
      
      // Get or create user by Google ID
      const googleId = decodedToken.uid;
      const email = decodedToken.email || '';
      const name = decodedToken.name || email.split('@')[0] || 'Google User';
      const picture = decodedToken.picture || null;
      
      console.log(`Processing Google user: ID=${googleId}, Email=${email}, Name=${name}`);
      
      // Check if user exists by Google ID
      let user = await storage.getUserByGoogleId(googleId);
      
      if (user) {
        console.log("Existing user found by Google ID:", user.id);
      } else {
        // Check if user exists by email
        const existingUserByEmail = await storage.getUserByEmail(email);
        
        if (existingUserByEmail) {
          console.log("Existing user found by email:", existingUserByEmail.id);
          // Update existing user with Google ID
          user = await storage.updateUserGoogleId(existingUserByEmail.id, googleId, picture);
          if (!user) {
            console.error("Failed to update user with Google ID:", existingUserByEmail.id);
            return res.status(500).json({ message: "Failed to update user with Google ID" });
          }
          console.log("User updated with Google ID:", user.id);
        } else {
          console.log("Creating new user for Google account");
          // Create new user
          try {
            user = await storage.createUser({
              username: name,
              email: email,
              password: "", // Empty string for Google auth users
              googleId: googleId,
              profilePicture: picture
            });
            console.log("New user created:", user.id);
          } catch (createError: any) {
            console.error("Error creating user:", createError);
            // Check if it's a duplicate username error
            if (createError.message?.includes('duplicate key') && createError.message?.includes('username')) {
              // Generate a unique username by adding a timestamp
              const uniqueName = `${name}_${Date.now().toString().slice(-4)}`;
              console.log("Attempting with unique username:", uniqueName);
              user = await storage.createUser({
                username: uniqueName,
                email: email,
                password: "", // Empty string for Google auth users
                googleId: googleId,
                profilePicture: picture
              });
              console.log("New user created with modified username:", user.id);
            } else {
              throw createError; // Re-throw if it's not a username conflict
            }
          }
        }
      }
      
      // Login the user through Passport
      console.log("Logging in user via Passport:", user.id);
      req.login(user, (err: any) => {
        if (err) {
          console.error("Error logging in user:", err);
          return res.status(500).json({ message: "Login failed", error: err.message });
        }
        console.log("User successfully logged in:", user.id);
        return res.status(200).json(user);
      });
    } catch (error: any) {
      console.error("Google authentication error:", error);
      return res.status(500).json({ 
        message: "Authentication failed", 
        error: error.message || "Unknown error" 
      });
    }
  });

  // Set up scheduled messages from active personas
  setupScheduledMessages();
  
  // API Routes prefix with /api
  
  // Get all persona templates
  app.get("/api/persona-templates", async (req: Request, res: Response) => {
    try {
      const templates = await storage.getPersonaTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Error fetching persona templates" });
    }
  });
  
  // Get a specific persona template
  app.get("/api/persona-templates/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getPersonaTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Persona template not found" });
      }
      
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Error fetching persona template" });
    }
  });
  
  // Get all personas for user
  app.get("/api/personas", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id || defaultUserId;
      const personas = await storage.getPersonas(userId);
      res.json(personas);
    } catch (error) {
      res.status(500).json({ message: "Error fetching personas" });
    }
  });
  
  // Get a specific persona
  app.get("/api/personas/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const persona = await storage.getPersona(id);
      
      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }
      
      res.json(persona);
    } catch (error) {
      res.status(500).json({ message: "Error fetching persona" });
    }
  });
  
  // Create a new persona
  app.post("/api/personas", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Add the user ID from authenticated session
      const userId = req.user?.id || defaultUserId;
      const dataWithUserId = {
        ...req.body,
        userId
      };
      
      console.log("Creating persona with data:", JSON.stringify(dataWithUserId, null, 2));
      const result = insertPersonaSchema.safeParse(dataWithUserId);
      
      if (!result.success) {
        console.error("Validation failed:", result.error.format());
        return res.status(400).json({ message: "Invalid persona data", errors: result.error.format() });
      }
      
      const persona = await storage.createPersona(result.data);
      
      // Create a conversation for this persona
      await storage.createConversation({
        userId: defaultUserId,
        personaId: persona.id
      });
      
      res.status(201).json(persona);
    } catch (error) {
      console.error("Error creating persona:", error);
      res.status(500).json({ message: "Error creating persona" });
    }
  });
  
  // Update a persona
  app.patch("/api/personas/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log("Updating persona with data:", JSON.stringify(req.body, null, 2));
      
      // For partial updates, we need to get the existing persona first, then apply the changes
      const existingPersona = await storage.getPersona(id);
      if (!existingPersona) {
        return res.status(404).json({ message: "Persona not found" });
      }
      
      // If it's a simple isActive toggle, just update that field directly
      if (Object.keys(req.body).length === 1 && 'isActive' in req.body) {
        // Create an update object that maintains all required fields from the existing persona
        const updateData = {
          name: existingPersona.name,
          tagline: existingPersona.tagline,
          avatarIcon: existingPersona.avatarIcon,
          traits: existingPersona.traits as any, // Cast to any type to resolve type mismatch
          interests: existingPersona.interests,
          isActive: Boolean(req.body.isActive), // Ensure boolean conversion
          messagingPreference: existingPersona.messagingPreference,
          messageFrequency: existingPersona.messageFrequency,
          whatsappEnabled: existingPersona.whatsappEnabled,
          whatsappNumber: existingPersona.whatsappNumber
        };
        
        const updatedPersona = await storage.updatePersona(id, updateData);
        return res.json(updatedPersona);
      }
      
      // Otherwise, proceed with full validation
      const result = updatePersonaSchema.safeParse(req.body);
      
      if (!result.success) {
        console.error("Validation failed:", result.error.format());
        return res.status(400).json({ message: "Invalid persona data", errors: result.error.format() });
      }
      
      const persona = await storage.updatePersona(id, result.data);
      
      res.json(persona);
    } catch (error) {
      console.error("Error updating persona:", error);
      res.status(500).json({ message: "Error updating persona" });
    }
  });
  
  // Delete a persona
  app.delete("/api/personas/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePersona(id);
      
      if (!success) {
        return res.status(404).json({ message: "Persona not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Error deleting persona" });
    }
  });
  
  // Get all conversations
  app.get("/api/conversations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id || defaultUserId;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Error fetching conversations" });
    }
  });
  
  // Get messages for a conversation
  app.get("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      const messages = await storage.getMessages(id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Error fetching messages" });
    }
  });
  
  // Get conversation by persona
  app.get("/api/personas/:id/conversation", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const personaId = parseInt(req.params.id);
      const userId = req.user?.id || defaultUserId;
      
      const persona = await storage.getPersona(personaId);
      
      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }
      
      // Verify the persona belongs to the user
      if (persona.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "You don't have permission to access this persona" });
      }
      
      let conversation = await storage.getConversationByPersona(personaId);
      
      // If no conversation exists, create one
      if (!conversation) {
        conversation = await storage.createConversation({
          userId: userId,
          personaId: personaId
        });
      }
      
      const messages = await storage.getMessages(conversation.id);
      
      res.json({
        conversation,
        messages,
        persona
      });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Error fetching conversation", error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Send a message to a persona
  app.post("/api/personas/:id/messages", isAuthenticated, checkApiLimits, async (req: Request, res: Response) => {
    try {
      const personaId = parseInt(req.params.id);
      const userId = req.user?.id || defaultUserId;
      
      const messageSchema = z.object({
        content: z.string().min(1)
      });
      
      const result = messageSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid message data", errors: result.error.format() });
      }
      
      const persona = await storage.getPersona(personaId);
      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }
      
      // Verify the persona belongs to the user
      if (persona.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "You don't have permission to access this persona" });
      }
      
      let conversation = await storage.getConversationByPersona(personaId);
      if (!conversation) {
        conversation = await storage.createConversation({
          userId: userId,
          personaId: personaId
        });
      }
      
      // Save user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: result.data.content,
        isFromPersona: false,
        deliveryStatus: "sent",
        deliveredVia: "in-app"
      });
      
      // Update conversation last message time
      await storage.updateConversationLastMessage(conversation.id);
      
      // Generate AI response
      const aiReplyContent = await generatePersonaReply(personaId, result.data.content);
      
      // Generate voice message if OpenAI API is available
      const voiceData = await generateVoiceMessage(aiReplyContent, personaId);
      
      // Save AI response
      const aiMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: aiReplyContent,
        isFromPersona: true,
        deliveryStatus: "sent",
        deliveredVia: "in-app",
        hasVoice: !!voiceData,
        voiceUrl: voiceData?.filePath,
        voiceDuration: voiceData?.duration
      });
      
      // Update conversation last message time again
      await storage.updateConversationLastMessage(conversation.id);
      
      // If WhatsApp is enabled, send message via WhatsApp too
      if (persona.whatsappEnabled && persona.whatsappNumber) {
        const whatsappSent = await sendWhatsAppMessage(
          persona.whatsappNumber,
          aiReplyContent
        );
        
        if (whatsappSent) {
          await storage.updateMessageStatus(aiMessage.id, "delivered");
          aiMessage.deliveryStatus = "delivered";
          aiMessage.deliveredVia = "whatsapp";
        }
      }
      
      res.status(201).json({
        userMessage,
        aiMessage
      });
    } catch (error) {
      res.status(500).json({ message: "Error processing message" });
    }
  });
  
  // Check WhatsApp availability
  app.post("/api/check-whatsapp", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const phoneSchema = z.object({
        phoneNumber: z.string().min(10)
      });
      
      const result = phoneSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid phone number", errors: result.error.format() });
      }
      
      const available = await checkWhatsAppAvailability(result.data.phoneNumber);
      
      res.json({
        phoneNumber: result.data.phoneNumber,
        available
      });
    } catch (error) {
      res.status(500).json({ message: "Error checking WhatsApp availability" });
    }
  });

  // Upload voice message to a persona
  app.post("/api/personas/:id/voice-messages", isAuthenticated, checkApiLimits, upload.single('audio'), async (req: Request, res: Response) => {
    try {
      const personaId = parseInt(req.params.id);
      const userId = req.user?.id || defaultUserId;
      
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }
      
      const persona = await storage.getPersona(personaId);
      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }
      
      // Verify the persona belongs to the user
      if (persona.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "You don't have permission to access this persona" });
      }
      
      let conversation = await storage.getConversationByPersona(personaId);
      if (!conversation) {
        conversation = await storage.createConversation({
          userId: userId,
          personaId: personaId
        });
      }
      
      // Create a public URL for the audio file
      const fileName = path.basename(req.file.path);
      const audioUrl = `/uploads/${fileName}`;
      
      // Estimate duration (can be improved with actual audio processing)
      const fileSizeInBytes = req.file.size;
      const estimatedDurationInSeconds = Math.ceil(fileSizeInBytes / 16000); // Rough estimate based on typical audio bitrate
      
      // Save user voice message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: "[Voice Message]", // Placeholder text content
        isFromPersona: false,
        deliveryStatus: "sent",
        deliveredVia: "in-app",
        hasVoice: true,
        voiceUrl: audioUrl,
        voiceDuration: estimatedDurationInSeconds
      });
      
      // Update conversation last message time
      await storage.updateConversationLastMessage(conversation.id);
      
      // Generate AI response
      const aiReplyContent = await generatePersonaReply(personaId, "You received a voice message from me. Please respond appropriately.");
      
      // Generate voice message if OpenAI API is available
      const voiceData = await generateVoiceMessage(aiReplyContent, personaId);
      
      // Save AI response
      const aiMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: aiReplyContent,
        isFromPersona: true,
        deliveryStatus: "sent",
        deliveredVia: "in-app",
        hasVoice: !!voiceData,
        voiceUrl: voiceData?.filePath,
        voiceDuration: voiceData?.duration
      });
      
      // Update conversation last message time again
      await storage.updateConversationLastMessage(conversation.id);
      
      // If WhatsApp is enabled, send message via WhatsApp too
      if (persona.whatsappEnabled && persona.whatsappNumber) {
        const whatsappSent = await sendWhatsAppMessage(
          persona.whatsappNumber,
          aiReplyContent
        );
        
        if (whatsappSent) {
          await storage.updateMessageStatus(aiMessage.id, "delivered");
          aiMessage.deliveryStatus = "delivered";
          aiMessage.deliveredVia = "whatsapp";
        }
      }
      
      res.status(201).json({
        userMessage,
        aiMessage
      });
    } catch (error) {
      console.error("Error processing voice message:", error);
      res.status(500).json({ message: "Error processing voice message" });
    }
  });

  // Delete voice from a message
  app.delete("/api/messages/:id/voice", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const messageId = parseInt(req.params.id);
      const userId = req.user?.id || defaultUserId;
      
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      if (!message.hasVoice) {
        return res.status(400).json({ message: "Message does not have voice" });
      }
      
      // Get the conversation to verify ownership
      const conversation = await storage.getConversation(message.conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Verify the conversation belongs to the user
      if (conversation.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "You don't have permission to access this message" });
      }
      
      // Get voice file path from URL
      if (message.voiceUrl) {
        try {
          const voiceFilename = message.voiceUrl.split('/').pop();
          if (voiceFilename) {
            const voiceFilePath = path.join('./public/voice-messages', voiceFilename);
            
            // Check if file exists before attempting to delete
            try {
              await fsPromises.access(voiceFilePath);
              // Delete the voice file
              await fsPromises.unlink(voiceFilePath);
              console.log(`Deleted voice file: ${voiceFilePath}`);
            } catch (fileError) {
              console.log(`Voice file not found or could not be deleted: ${voiceFilePath}`);
              // Continue even if file doesn't exist
            }
          }
        } catch (fileError) {
          console.error("Error deleting voice file:", fileError);
          // Continue without failing the request
        }
      }
      
      // Update message to remove voice
      const updatedMessage = await storage.updateMessageVoice(
        messageId, 
        false, // hasVoice
        null,  // voiceUrl
        null   // voiceDuration
      );
      
      res.json(updatedMessage);
    } catch (error) {
      console.error("Error deleting voice message:", error);
      res.status(500).json({ message: "Failed to delete voice message" });
    }
  });

  return httpServer;
}

// Set up scheduled messages from active personas
function setupScheduledMessages() {
  // Every hour, check for active personas that should send messages
  nodeSchedule.scheduleJob('0 * * * *', async () => {
    try {
      // Query for all active personas across all users
      const db = await import('./db').then(module => module.db);
      const { personas } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const activePersonas = await db.select().from(personas).where(eq(personas.isActive, true));
      console.log(`Found ${activePersonas.length} active personas to check for scheduled messages`);
      
      for (const persona of activePersonas) {
        try {
          // Skip if messaging frequency doesn't match
          if (persona.messageFrequency === 'weekly') {
            // Only send on Mondays at this hour
            const now = new Date();
            if (now.getDay() !== 1) { // 1 is Monday
              continue;
            }
          } else if (persona.messageFrequency === 'daily') {
            // We're already checking hourly, but for "daily" only send in the morning
            const now = new Date();
            if (now.getHours() !== 9) { // 9 AM
              continue;
            }
          } else if (persona.messageFrequency === 'never') {
            continue;
          }
          
          // Get or create conversation
          let conversation = await storage.getConversationByPersona(persona.id);
          if (!conversation) {
            conversation = await storage.createConversation({
              userId: persona.userId,
              personaId: persona.id
            });
          }
          
          // Check if the user has exceeded their API usage limit
          const userData = await storage.getUser(persona.userId);
          if (!userData) {
            console.log(`User ID ${persona.userId} not found for persona ${persona.id}`);
            continue;
          }
          
          if (userData.apiUsage >= userData.usageLimit) {
            console.log(`User ID ${persona.userId} has exceeded their API usage limit. Skipping scheduled message for persona ${persona.id}`);
            continue;
          }
          
          // Generate a message from the persona
          const messageContent = await generatePersonaMessage(persona.id);
          
          // Increment the user's API usage
          await incrementApiUsage(persona.userId);
          
          // Generate voice message if OpenAI API is available
          const voiceData = await generateVoiceMessage(messageContent, persona.id);
          
          // Save the message with voice if available
          const message = await storage.createMessage({
            conversationId: conversation.id,
            content: messageContent,
            isFromPersona: true,
            deliveryStatus: "sent",
            deliveredVia: "in-app",
            hasVoice: !!voiceData,
            voiceUrl: voiceData?.filePath,
            voiceDuration: voiceData?.duration
          });
          
          // Update conversation last message time
          await storage.updateConversationLastMessage(conversation.id);
          
          // If WhatsApp is enabled, send message via WhatsApp too
          if (persona.whatsappEnabled && persona.whatsappNumber) {
            const whatsappSent = await sendWhatsAppMessage(
              persona.whatsappNumber,
              messageContent
            );
            
            if (whatsappSent) {
              await storage.updateMessageStatus(message.id, "delivered");
            }
          }
          
          console.log(`Scheduled message sent from ${persona.name} (User ID: ${persona.userId}): ${messageContent}`);
        } catch (personaError) {
          console.error(`Error processing scheduled message for persona ${persona.id}:`, personaError);
          // Continue with next persona
        }
      }
    } catch (error) {
      console.error('Error sending scheduled messages:', error);
    }
  });
  
  // Reset API usage counts at midnight every day
  nodeSchedule.scheduleJob('0 0 * * *', async () => {
    try {
      await resetApiUsage();
      console.log('API usage reset for all users');
    } catch (error) {
      console.error('Error resetting API usage:', error);
    }
  });
}
