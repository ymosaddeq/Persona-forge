import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertPersonaSchema, 
  updatePersonaSchema, 
  insertConversationSchema, 
  insertMessageSchema
} from "@shared/schema";
import { generatePersonaMessage, generatePersonaReply, generateVoiceMessage } from "./openai";
import { sendWhatsAppMessage, checkWhatsAppAvailability } from "./greenapi";
import nodeSchedule from 'node-schedule';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

  // Default user for development (in a real app, we'd have authentication)
  const defaultUserId = 1;
  try {
    await storage.createUser({
      username: "demo",
      password: "password"
    });
  } catch (error) {
    console.error("Error creating default user:", error);
  }

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
  app.get("/api/personas", async (req: Request, res: Response) => {
    try {
      const personas = await storage.getPersonas(defaultUserId);
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
  app.post("/api/personas", async (req: Request, res: Response) => {
    try {
      // Add the default userId to the request body before validation
      const dataWithUserId = {
        ...req.body,
        userId: defaultUserId
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
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await storage.getConversations(defaultUserId);
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
  app.get("/api/personas/:id/conversation", async (req: Request, res: Response) => {
    try {
      const personaId = parseInt(req.params.id);
      const persona = await storage.getPersona(personaId);
      
      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }
      
      let conversation = await storage.getConversationByPersona(personaId);
      
      // If no conversation exists, create one
      if (!conversation) {
        conversation = await storage.createConversation({
          userId: defaultUserId,
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
  app.post("/api/personas/:id/messages", async (req: Request, res: Response) => {
    try {
      const personaId = parseInt(req.params.id);
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
      
      let conversation = await storage.getConversationByPersona(personaId);
      if (!conversation) {
        conversation = await storage.createConversation({
          userId: defaultUserId,
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
  app.post("/api/check-whatsapp", async (req: Request, res: Response) => {
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
  app.post("/api/personas/:id/voice-messages", upload.single('audio'), async (req: Request, res: Response) => {
    try {
      const personaId = parseInt(req.params.id);
      
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }
      
      const persona = await storage.getPersona(personaId);
      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }
      
      let conversation = await storage.getConversationByPersona(personaId);
      if (!conversation) {
        conversation = await storage.createConversation({
          userId: defaultUserId,
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

  return httpServer;
}

// Set up scheduled messages from active personas
function setupScheduledMessages() {
  // Every hour, check for active personas that should send messages
  nodeSchedule.scheduleJob('0 * * * *', async () => {
    try {
      // Get all personas for the demo user
      const personas = await storage.getPersonas(1);
      
      // Filter for active personas
      const activePersonas = personas.filter(p => p.isActive);
      
      for (const persona of activePersonas) {
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
            userId: 1,
            personaId: persona.id
          });
        }
        
        // Generate a message from the persona
        const messageContent = await generatePersonaMessage(persona.id);
        
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
        
        console.log(`Scheduled message sent from ${persona.name}: ${messageContent}`);
      }
    } catch (error) {
      console.error('Error sending scheduled messages:', error);
    }
  });
}
