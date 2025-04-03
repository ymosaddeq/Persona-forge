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
  type Trait
} from "@shared/schema";

// Re-export types for use by storage implementations
export type { 
  User, InsertUser,
  PersonaTemplate, InsertPersonaTemplate,
  Persona, InsertPersona, UpdatePersona,
  Conversation, InsertConversation,
  Message, InsertMessage,
  Trait
};

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  private personaTemplates: Map<number, PersonaTemplate>;
  private personas: Map<number, Persona>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  
  private userCurrentId: number;
  private templateCurrentId: number;
  private personaCurrentId: number;
  private conversationCurrentId: number;
  private messageCurrentId: number;

  constructor() {
    this.users = new Map();
    this.personaTemplates = new Map();
    this.personas = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    
    this.userCurrentId = 1;
    this.templateCurrentId = 1;
    this.personaCurrentId = 1;
    this.conversationCurrentId = 1;
    this.messageCurrentId = 1;
    
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
