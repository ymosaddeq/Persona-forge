import { IStorage } from './storage';
import { 
  User, InsertUser,
  PersonaTemplate, InsertPersonaTemplate,
  Persona, InsertPersona, UpdatePersona,
  Conversation, InsertConversation,
  Message, InsertMessage,
  PhoneNumber, InsertPhoneNumber
} from '@shared/schema';
import { db } from './db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  users, 
  personaTemplates, 
  personas, 
  conversations, 
  messages,
  phoneNumberPool
} from '@shared/schema';
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";

export class PgStorage implements IStorage {
  public sessionStore: session.Store;
  
  constructor() {
    // Create a connection pool for sessions
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    const PostgresSessionStore = connectPg(session);
    
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    });
  }
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  
  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.googleId, googleId));
    return result[0];
  }
  
  async updateUserGoogleId(userId: number, googleId: string, profilePicture?: string | null): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        googleId, 
        profilePicture: profilePicture || undefined,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }
  
  async updateUserApiUsage(userId: number, increment: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return undefined;
    
    const result = await db
      .update(users)
      .set({ 
        apiUsage: user.apiUsage + increment,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }
  
  async resetAllUsersApiUsage(): Promise<void> {
    await db
      .update(users)
      .set({ 
        apiUsage: 0,
        updatedAt: new Date()
      });
  }
  
  // Phone Number Pool methods
  async getPhoneNumbers(userId: number): Promise<PhoneNumber[]> {
    return await db
      .select()
      .from(phoneNumberPool)
      .where(eq(phoneNumberPool.userId, userId));
  }
  
  async getPhoneNumber(id: number): Promise<PhoneNumber | undefined> {
    const result = await db
      .select()
      .from(phoneNumberPool)
      .where(eq(phoneNumberPool.id, id));
      
    return result[0];
  }
  
  async createPhoneNumber(phoneNumber: InsertPhoneNumber): Promise<PhoneNumber> {
    const result = await db
      .insert(phoneNumberPool)
      .values({
        ...phoneNumber,
        isVerified: false,
        assignedToPersonaId: null
      })
      .returning();
      
    return result[0];
  }
  
  async verifyPhoneNumber(id: number): Promise<PhoneNumber | undefined> {
    const result = await db
      .update(phoneNumberPool)
      .set({ 
        isVerified: true,
        updatedAt: new Date()
      })
      .where(eq(phoneNumberPool.id, id))
      .returning();
      
    return result[0];
  }
  
  async assignPhoneNumberToPersona(id: number, personaId: number | null): Promise<PhoneNumber | undefined> {
    // First check if this number was previously assigned to another persona
    const phoneNumber = await this.getPhoneNumber(id);
    if (!phoneNumber) return undefined;
    
    // If this number was previously assigned to another persona, clear that assignment
    if (phoneNumber.assignedToPersonaId && personaId !== phoneNumber.assignedToPersonaId) {
      await db
        .update(personas)
        .set({
          whatsappEnabled: false,
          whatsappNumber: null,
          updatedAt: new Date()
        })
        .where(eq(personas.id, phoneNumber.assignedToPersonaId));
    }
    
    // Update phone number with new assignment
    const updatedPhoneNumber = await db
      .update(phoneNumberPool)
      .set({
        assignedToPersonaId: personaId,
        updatedAt: new Date()
      })
      .where(eq(phoneNumberPool.id, id))
      .returning();
    
    // If assigning to a persona, update the persona's WhatsApp settings
    if (personaId) {
      await db
        .update(personas)
        .set({
          whatsappEnabled: true,
          whatsappNumber: phoneNumber.phoneNumber,
          updatedAt: new Date()
        })
        .where(eq(personas.id, personaId));
    }
    
    return updatedPhoneNumber[0];
  }
  
  async deletePhoneNumber(id: number): Promise<boolean> {
    // Check if the phone number is assigned to a persona
    const phoneNumber = await this.getPhoneNumber(id);
    if (!phoneNumber) return false;
    
    // If the phone number was assigned to a persona, update the persona
    if (phoneNumber.assignedToPersonaId) {
      await db
        .update(personas)
        .set({
          whatsappEnabled: false,
          whatsappNumber: null,
          updatedAt: new Date()
        })
        .where(eq(personas.id, phoneNumber.assignedToPersonaId));
    }
    
    // Delete the phone number
    const result = await db
      .delete(phoneNumberPool)
      .where(eq(phoneNumberPool.id, id))
      .returning({ id: phoneNumberPool.id });
      
    return result.length > 0;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Persona Template methods
  async getPersonaTemplates(): Promise<PersonaTemplate[]> {
    return await db.select().from(personaTemplates);
  }

  async getPersonaTemplate(id: number): Promise<PersonaTemplate | undefined> {
    const result = await db.select().from(personaTemplates).where(eq(personaTemplates.id, id));
    return result[0];
  }

  async createPersonaTemplate(template: InsertPersonaTemplate): Promise<PersonaTemplate> {
    const result = await db.insert(personaTemplates).values(template).returning();
    return result[0];
  }

  // Persona methods
  async getPersonas(userId: number): Promise<Persona[]> {
    return await db.select().from(personas).where(eq(personas.userId, userId));
  }

  async getPersona(id: number): Promise<Persona | undefined> {
    const result = await db.select().from(personas).where(eq(personas.id, id));
    return result[0];
  }

  async createPersona(persona: InsertPersona): Promise<Persona> {
    // Create a new persona with all required fields
    const personaToInsert = {
      ...persona,
      // Ensure userId is provided (default to 1 if missing)
      userId: persona.userId || 1,
      // Set defaults for fields with default values in schema
      isActive: persona.isActive ?? true,
      messagingPreference: persona.messagingPreference || 'app',
      messageFrequency: persona.messageFrequency || 'daily',
      whatsappEnabled: persona.whatsappEnabled ?? false,
      whatsappNumber: persona.whatsappNumber || null
    };
    
    const result = await db.insert(personas).values(personaToInsert).returning();
    return result[0];
  }

  async updatePersona(id: number, persona: UpdatePersona): Promise<Persona | undefined> {
    const now = new Date();
    const updateData = { ...persona, updatedAt: now };
    
    const result = await db
      .update(personas)
      .set(updateData)
      .where(eq(personas.id, id))
      .returning();
    
    return result[0];
  }

  async deletePersona(id: number): Promise<boolean> {
    const result = await db.delete(personas).where(eq(personas.id, id)).returning({ id: personas.id });
    return result.length > 0;
  }
  
  async countPersonasByUser(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(personas)
      .where(eq(personas.userId, userId));
    
    return Number(result[0].count);
  }

  // Conversation methods
  async getConversations(userId: number): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.lastMessageAt));
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const result = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    
    return result[0];
  }

  async getConversationByPersona(personaId: number): Promise<Conversation | undefined> {
    const result = await db
      .select()
      .from(conversations)
      .where(eq(conversations.personaId, personaId));
    
    return result[0];
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const result = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    
    return result[0];
  }

  async updateConversationLastMessage(id: number): Promise<Conversation | undefined> {
    const now = new Date();
    
    const result = await db
      .update(conversations)
      .set({ lastMessageAt: now })
      .where(eq(conversations.id, id))
      .returning();
    
    return result[0];
  }

  // Message methods
  async getMessages(conversationId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.sentAt);
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    
    return result[0];
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    // Set default values for required fields
    const messageToInsert = {
      ...message,
      isFromPersona: message.isFromPersona ?? false,
      deliveryStatus: message.deliveryStatus || 'sent',
      deliveredVia: message.deliveredVia || 'in-app'
    };
    
    const result = await db
      .insert(messages)
      .values(messageToInsert)
      .returning();
    
    return result[0];
  }

  async updateMessageStatus(id: number, status: string): Promise<Message | undefined> {
    const result = await db
      .update(messages)
      .set({ deliveryStatus: status })
      .where(eq(messages.id, id))
      .returning();
    
    return result[0];
  }

  async updateMessageVoice(id: number, hasVoice: boolean, voiceUrl: string | null, voiceDuration: number | null): Promise<Message | undefined> {
    const result = await db
      .update(messages)
      .set({
        hasVoice,
        voiceUrl,
        voiceDuration
      })
      .where(eq(messages.id, id))
      .returning();
    
    return result[0];
  }
}