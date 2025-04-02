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
import { generatePersonaMessage, generatePersonaReply } from "./openai";
import { sendWhatsAppMessage, checkWhatsAppAvailability } from "./greenapi";
import nodeSchedule from 'node-schedule';

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
      console.log("Creating persona with data:", JSON.stringify(req.body, null, 2));
      const result = insertPersonaSchema.safeParse(req.body);
      
      if (!result.success) {
        console.error("Validation failed:", result.error.format());
        return res.status(400).json({ message: "Invalid persona data", errors: result.error.format() });
      }
      
      const persona = await storage.createPersona({
        ...result.data,
        userId: defaultUserId
      });
      
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
      const result = updatePersonaSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid persona data", errors: result.error.format() });
      }
      
      const persona = await storage.updatePersona(id, result.data);
      
      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }
      
      res.json(persona);
    } catch (error) {
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
      res.status(500).json({ message: "Error fetching conversation" });
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
      
      // Save AI response
      const aiMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: aiReplyContent,
        isFromPersona: true,
        deliveryStatus: "sent",
        deliveredVia: "in-app"
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
        
        // Save the message
        const message = await storage.createMessage({
          conversationId: conversation.id,
          content: messageContent,
          isFromPersona: true,
          deliveryStatus: "sent",
          deliveredVia: "in-app"
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
