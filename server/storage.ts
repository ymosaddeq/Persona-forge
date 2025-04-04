import { 
  type User, 
  type InsertUser, 
  type PersonaTemplate, 
  type InsertPersonaTemplate, 
  type Persona, 
  type InsertPersona, 
  type UpdatePersona, 
  type Conversation, 
  type InsertConversation, 
  type Message, 
  type InsertMessage, 
  type Trait,
  type PhoneNumber,
  type InsertPhoneNumber
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Re-export types for use by storage implementations
export type { 
  User, InsertUser,
  PersonaTemplate, InsertPersonaTemplate,
  Persona, InsertPersona, UpdatePersona,
  Conversation, InsertConversation,
  Message, InsertMessage,
  PhoneNumber, InsertPhoneNumber,
  Trait
};

export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserApiUsage(userId: number, increment: number): Promise<User | undefined>;
  resetAllUsersApiUsage(): Promise<void>;
  
  // Phone Number Pool methods
  getPhoneNumbers(userId: number): Promise<PhoneNumber[]>;
  getPhoneNumber(id: number): Promise<PhoneNumber | undefined>;
  createPhoneNumber(phoneNumber: InsertPhoneNumber): Promise<PhoneNumber>;
  verifyPhoneNumber(id: number): Promise<PhoneNumber | undefined>;
  assignPhoneNumberToPersona(id: number, personaId: number | null): Promise<PhoneNumber | undefined>;
  deletePhoneNumber(id: number): Promise<boolean>;
  
  // Persona Template methods
  getPersonaTemplates(): Promise<PersonaTemplate[]>;
  getPersonaTemplate(id: number): Promise<PersonaTemplate | undefined>;
  createPersonaTemplate(template: InsertPersonaTemplate): Promise<PersonaTemplate>;
  
  // Persona methods
  getPersonas(userId: number): Promise<Persona[]>;
  getPersona(id: number): Promise<Persona | undefined>;
  createPersona(persona: InsertPersona): Promise<Persona>;
  updatePersona(id: number, persona: UpdatePersona): Promise<Persona | undefined>;
  deletePersona(id: number): Promise<boolean>;
  countPersonasByUser(userId: number): Promise<number>;
  
  // Conversation methods
  getConversations(userId: number): Promise<Conversation[]>;
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationByPersona(personaId: number): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationLastMessage(id: number): Promise<Conversation | undefined>;
  
  // Message methods
  getMessages(conversationId: number): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageStatus(id: number, status: string): Promise<Message | undefined>;
  updateMessageVoice(id: number, hasVoice: boolean, voiceUrl: string | null, voiceDuration: number | null): Promise<Message | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private phoneNumbers: Map<number, PhoneNumber>;
  private personaTemplates: Map<number, PersonaTemplate>;
  private personas: Map<number, Persona>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  
  private userCurrentId: number;
  private phoneNumberCurrentId: number;
  private templateCurrentId: number;
  private personaCurrentId: number;
  private conversationCurrentId: number;
  private messageCurrentId: number;
  
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.phoneNumbers = new Map();
    this.personaTemplates = new Map();
    this.personas = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    
    this.userCurrentId = 1;
    this.phoneNumberCurrentId = 1;
    this.templateCurrentId = 1;
    this.personaCurrentId = 1;
    this.conversationCurrentId = 1;
    this.messageCurrentId = 1;
    
    // Initialize session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Initialize with predefined persona templates
    this.initPersonaTemplates();
  }

  // Initialize with predefined persona templates
  private initPersonaTemplates() {
    const templates = [
      {
        name: "Creative Friend",
        description: "Outgoing and creative, loves to chat about art and new ideas",
        avatarIcon: "face",
        defaultTraits: {
          extroversion: 8,
          emotional: 7,
          playfulness: 8,
          adventurous: 7
        },
        defaultInterests: ["Art", "Music", "Travel", "Photography"],
        createdAt: new Date()
      },
      {
        name: "Tech Enthusiast",
        description: "Analytical and curious, loves discussing tech and gaming",
        avatarIcon: "sports_esports",
        defaultTraits: {
          extroversion: 5,
          emotional: 3,
          playfulness: 6,
          adventurous: 7
        },
        defaultInterests: ["Gaming", "Technology", "Science", "Coding"],
        createdAt: new Date()
      },
      {
        name: "Fitness Coach",
        description: "Motivational and energetic, passionate about health and fitness",
        avatarIcon: "fitness_center",
        defaultTraits: {
          extroversion: 9,
          emotional: 6,
          playfulness: 7,
          adventurous: 9
        },
        defaultInterests: ["Fitness", "Nutrition", "Sports", "Health"],
        createdAt: new Date()
      }
    ];

    templates.forEach(template => {
      const id = this.templateCurrentId++;
      this.personaTemplates.set(id, {
        ...template,
        id
      });
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.googleId === googleId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      googleId: null, 
      profilePicture: null,
      role: insertUser.role || "user",
      apiUsage: 0,
      usageLimit: 100,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUserApiUsage(userId: number, increment: number): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      apiUsage: user.apiUsage + increment,
      updatedAt: new Date()
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  async resetAllUsersApiUsage(): Promise<void> {
    // Using Array.from to avoid iterator issues
    Array.from(this.users.keys()).forEach(id => {
      const user = this.users.get(id);
      if (user) {
        this.users.set(id, {
          ...user,
          apiUsage: 0,
          updatedAt: new Date()
        });
      }
    });
  }
  
  // Phone Number Pool methods
  async getPhoneNumbers(userId: number): Promise<PhoneNumber[]> {
    return Array.from(this.phoneNumbers.values()).filter(
      (phoneNumber) => phoneNumber.userId === userId
    );
  }
  
  async getPhoneNumber(id: number): Promise<PhoneNumber | undefined> {
    return this.phoneNumbers.get(id);
  }
  
  async createPhoneNumber(insertPhoneNumber: InsertPhoneNumber): Promise<PhoneNumber> {
    const id = this.phoneNumberCurrentId++;
    const now = new Date();
    
    const phoneNumber: PhoneNumber = {
      ...insertPhoneNumber,
      id,
      isVerified: false,
      assignedToPersonaId: null,
      createdAt: now,
      updatedAt: now
    };
    
    this.phoneNumbers.set(id, phoneNumber);
    return phoneNumber;
  }
  
  async verifyPhoneNumber(id: number): Promise<PhoneNumber | undefined> {
    const phoneNumber = this.phoneNumbers.get(id);
    if (!phoneNumber) return undefined;
    
    const verifiedPhoneNumber: PhoneNumber = {
      ...phoneNumber,
      isVerified: true,
      updatedAt: new Date()
    };
    
    this.phoneNumbers.set(id, verifiedPhoneNumber);
    return verifiedPhoneNumber;
  }
  
  async assignPhoneNumberToPersona(id: number, personaId: number | null): Promise<PhoneNumber | undefined> {
    const phoneNumber = this.phoneNumbers.get(id);
    if (!phoneNumber) return undefined;
    
    // If this number was previously assigned to another persona, clear that assignment
    if (phoneNumber.assignedToPersonaId && personaId !== phoneNumber.assignedToPersonaId) {
      const persona = this.personas.get(phoneNumber.assignedToPersonaId);
      if (persona) {
        this.personas.set(persona.id, {
          ...persona,
          whatsappEnabled: false,
          whatsappNumber: null,
          updatedAt: new Date()
        });
      }
    }
    
    // Update phone number with new assignment
    const updatedPhoneNumber: PhoneNumber = {
      ...phoneNumber,
      assignedToPersonaId: personaId,
      updatedAt: new Date()
    };
    
    this.phoneNumbers.set(id, updatedPhoneNumber);
    
    // If assigning to a persona, update the persona's WhatsApp settings
    if (personaId) {
      const persona = this.personas.get(personaId);
      if (persona) {
        this.personas.set(personaId, {
          ...persona,
          whatsappEnabled: true,
          whatsappNumber: phoneNumber.phoneNumber,
          updatedAt: new Date()
        });
      }
    }
    
    return updatedPhoneNumber;
  }
  
  async deletePhoneNumber(id: number): Promise<boolean> {
    const phoneNumber = this.phoneNumbers.get(id);
    if (!phoneNumber) return false;
    
    // If the phone number was assigned to a persona, update the persona
    if (phoneNumber.assignedToPersonaId) {
      const persona = this.personas.get(phoneNumber.assignedToPersonaId);
      if (persona) {
        this.personas.set(persona.id, {
          ...persona,
          whatsappEnabled: false,
          whatsappNumber: null,
          updatedAt: new Date()
        });
      }
    }
    
    return this.phoneNumbers.delete(id);
  }

  // Persona Template methods
  async getPersonaTemplates(): Promise<PersonaTemplate[]> {
    return Array.from(this.personaTemplates.values());
  }

  async getPersonaTemplate(id: number): Promise<PersonaTemplate | undefined> {
    return this.personaTemplates.get(id);
  }

  async createPersonaTemplate(template: InsertPersonaTemplate): Promise<PersonaTemplate> {
    const id = this.templateCurrentId++;
    const now = new Date();
    const personaTemplate: PersonaTemplate = { ...template, id, createdAt: now };
    this.personaTemplates.set(id, personaTemplate);
    return personaTemplate;
  }

  // Persona methods
  async getPersonas(userId: number): Promise<Persona[]> {
    return Array.from(this.personas.values()).filter(
      (persona) => persona.userId === userId
    );
  }

  async getPersona(id: number): Promise<Persona | undefined> {
    return this.personas.get(id);
  }

  async createPersona(persona: InsertPersona): Promise<Persona> {
    const id = this.personaCurrentId++;
    const now = new Date();
    
    // Set default values for required fields
    const defaults = {
      userId: persona.userId || 1, // Default to user 1 if not provided
      isActive: persona.isActive ?? true,
      messagingPreference: persona.messagingPreference || 'app',
      messageFrequency: persona.messageFrequency || 'daily',
      whatsappEnabled: persona.whatsappEnabled ?? false,
      whatsappNumber: persona.whatsappNumber || null
    };
    
    const newPersona: Persona = { 
      ...persona, 
      ...defaults,
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    
    this.personas.set(id, newPersona);
    return newPersona;
  }

  async updatePersona(id: number, updateData: UpdatePersona): Promise<Persona | undefined> {
    const persona = this.personas.get(id);
    if (!persona) return undefined;

    const updatedPersona: Persona = { 
      ...persona, 
      ...updateData, 
      updatedAt: new Date() 
    };
    this.personas.set(id, updatedPersona);
    return updatedPersona;
  }

  async deletePersona(id: number): Promise<boolean> {
    return this.personas.delete(id);
  }
  
  async countPersonasByUser(userId: number): Promise<number> {
    return Array.from(this.personas.values()).filter(
      (persona) => persona.userId === userId
    ).length;
  }

  // Conversation methods
  async getConversations(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(
      (conversation) => conversation.userId === userId
    );
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationByPersona(personaId: number): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(
      (conversation) => conversation.personaId === personaId
    );
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const id = this.conversationCurrentId++;
    const now = new Date();
    const newConversation: Conversation = { 
      ...conversation, 
      id, 
      lastMessageAt: now, 
      createdAt: now 
    };
    this.conversations.set(id, newConversation);
    return newConversation;
  }

  async updateConversationLastMessage(id: number): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;

    const updatedConversation: Conversation = { 
      ...conversation, 
      lastMessageAt: new Date() 
    };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }

  // Message methods
  async getMessages(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  }

  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.messageCurrentId++;
    const now = new Date();
    
    // Set default values for required fields
    const defaults = {
      isFromPersona: message.isFromPersona ?? false,
      deliveryStatus: message.deliveryStatus || 'sent',
      deliveredVia: message.deliveredVia || 'in-app',
      hasVoice: message.hasVoice ?? false,
      voiceUrl: message.voiceUrl ?? null,
      voiceDuration: message.voiceDuration ?? null
    };
    
    const newMessage: Message = { 
      ...message, 
      ...defaults,
      id, 
      sentAt: now 
    };
    
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async updateMessageStatus(id: number, status: string): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;

    const updatedMessage: Message = { 
      ...message, 
      deliveryStatus: status 
    };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }

  async updateMessageVoice(id: number, hasVoice: boolean, voiceUrl: string | null, voiceDuration: number | null): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;

    const updatedMessage: Message = {
      ...message,
      hasVoice,
      voiceUrl,
      voiceDuration
    };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }
}

// Import the PostgreSQL storage implementation
import { PgStorage } from './pg-storage';

// Export storage based on environment
const useMemoryStorage = process.env.USE_MEMORY_STORAGE === 'true';

// Export the appropriate storage implementation
export const storage = useMemoryStorage ? new MemStorage() : new PgStorage();
