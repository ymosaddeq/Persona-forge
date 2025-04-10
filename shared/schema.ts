import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users - enhanced for proper authentication and usage tracking
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").default(""),  // Empty string for Google auth users
  googleId: text("google_id").unique(),  // For Google authentication
  profilePicture: text("profile_picture"),  // Profile picture URL
  role: text("role").notNull().default("user"),
  apiUsage: integer("api_usage").notNull().default(0),
  usageLimit: integer("usage_limit").notNull().default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  apiUsage: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")),
  googleId: z.string().optional(),
  profilePicture: z.string().nullable().optional(),
});

// Phone number pool for validated WhatsApp numbers
export const phoneNumberPool = pgTable("phone_number_pool", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  phoneNumber: text("phone_number").notNull().unique(),
  isVerified: boolean("is_verified").default(false).notNull(),
  assignedToPersonaId: integer("assigned_to_persona_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPhoneNumberSchema = createInsertSchema(phoneNumberPool).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isVerified: true,
  assignedToPersonaId: true,
}).extend({
  phoneNumber: z.string().min(10, "Please enter a valid phone number"),
});

// Persona templates - predefined persona types
export const personaTemplates = pgTable("persona_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  avatarIcon: text("avatar_icon").notNull(),
  defaultTraits: jsonb("default_traits").notNull(),
  defaultInterests: text("default_interests").array().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPersonaTemplateSchema = createInsertSchema(personaTemplates).omit({
  id: true,
  createdAt: true,
});

// User personas - customized instances of persona templates
export const personas = pgTable("personas", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  templateId: integer("template_id").notNull(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  avatarIcon: text("avatar_icon").notNull(),
  traits: jsonb("traits").notNull(),
  interests: text("interests").array().notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  messagingPreference: text("messaging_preference").default("in-app").notNull(),
  messageFrequency: text("message_frequency").default("daily").notNull(),
  whatsappEnabled: boolean("whatsapp_enabled").default(false).notNull(),
  whatsappNumber: text("whatsapp_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPersonaSchema = createInsertSchema(personas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePersonaSchema = createInsertSchema(personas).omit({
  id: true,
  userId: true,
  templateId: true,
  createdAt: true,
  updatedAt: true,
});

// Conversations between users and personas
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  personaId: integer("persona_id").notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  lastMessageAt: true,
  createdAt: true,
});

// Messages within conversations
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  content: text("content").notNull(),
  isFromPersona: boolean("is_from_persona").default(false).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveryStatus: text("delivery_status").default("sent").notNull(), // sent, delivered, read
  deliveredVia: text("delivered_via").default("in-app").notNull(), // in-app, whatsapp
  hasVoice: boolean("has_voice").default(false).notNull(), // indicates if message has voice audio
  voiceUrl: text("voice_url"), // URL to the voice message audio file
  voiceDuration: integer("voice_duration"), // Duration of voice message in seconds
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  sentAt: true,
});

// Trait values for sliders (extroversion, analytical, seriousness, etc.)
export const traitSchema = z.object({
  extroversion: z.number().min(0).max(10),
  emotional: z.number().min(0).max(10),
  playfulness: z.number().min(0).max(10),
  adventurous: z.number().min(0).max(10),
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPhoneNumber = z.infer<typeof insertPhoneNumberSchema>;
export type PhoneNumber = typeof phoneNumberPool.$inferSelect;

export type InsertPersonaTemplate = z.infer<typeof insertPersonaTemplateSchema>;
export type PersonaTemplate = typeof personaTemplates.$inferSelect;

export type InsertPersona = z.infer<typeof insertPersonaSchema>;
export type UpdatePersona = z.infer<typeof updatePersonaSchema>;
export type Persona = typeof personas.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type Trait = z.infer<typeof traitSchema>;
