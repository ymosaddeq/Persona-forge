import OpenAI from 'openai';
import { Persona } from '@shared/schema';
import { storage } from './storage';

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-development'
});

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

interface MessageHistory {
  role: 'user' | 'assistant';
  content: string;
}

function generatePersonalityDescription(persona: Persona): string {
  const traits = persona.traits as any;
  const traitDescriptions = [];
  
  if (traits.extroversion > 7) {
    traitDescriptions.push("very outgoing and extroverted");
  } else if (traits.extroversion > 5) {
    traitDescriptions.push("moderately social");
  } else {
    traitDescriptions.push("more introverted and reserved");
  }
  
  if (traits.emotional > 7) {
    traitDescriptions.push("highly emotional and empathetic");
  } else if (traits.emotional > 5) {
    traitDescriptions.push("balanced between emotional and analytical");
  } else {
    traitDescriptions.push("logical and analytical");
  }
  
  if (traits.playfulness > 7) {
    traitDescriptions.push("very playful and fun-loving");
  } else if (traits.playfulness > 5) {
    traitDescriptions.push("moderately playful");
  } else {
    traitDescriptions.push("serious and straightforward");
  }
  
  if (traits.adventurous > 7) {
    traitDescriptions.push("highly adventurous and risk-taking");
  } else if (traits.adventurous > 5) {
    traitDescriptions.push("moderately adventurous");
  } else {
    traitDescriptions.push("cautious and careful");
  }
  
  return traitDescriptions.join(', ');
}

async function buildConversationContext(personaId: number): Promise<MessageHistory[]> {
  const persona = await storage.getPersona(personaId);
  if (!persona) throw new Error('Persona not found');
  
  const conversation = await storage.getConversationByPersona(personaId);
  if (!conversation) throw new Error('Conversation not found');
  
  const messages = await storage.getMessages(conversation.id);
  
  // Create message history for the AI
  const messageHistory: MessageHistory[] = [];
  
  // Add system message with personality details
  messageHistory.push({
    role: 'assistant',
    content: `I am ${persona.name}, ${persona.tagline}. My personality is ${generatePersonalityDescription(persona)}. 
    I'm interested in ${persona.interests.join(', ')}. I'll be friendly and engage in conversations about my interests. 
    I should occasionally initiate topics related to my interests and ask follow-up questions to show I'm paying attention.`
  });
  
  // Add conversation history
  messages.forEach(message => {
    messageHistory.push({
      role: message.isFromPersona ? 'assistant' : 'user',
      content: message.content
    });
  });
  
  return messageHistory;
}

export async function generatePersonaMessage(personaId: number): Promise<string> {
  try {
    const persona = await storage.getPersona(personaId);
    if (!persona) throw new Error('Persona not found');
    
    const messageHistory = await buildConversationContext(personaId);
    
    // Generate a prompt for the AI to create a new message
    const prompt = `Based on my personality and our conversation history, generate a new message to send to the user. 
    It should be casual, friendly, and related to my interests in ${persona.interests.join(', ')}.`;
    
    messageHistory.push({
      role: 'user',
      content: prompt
    });
    
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: messageHistory as any,
      max_tokens: 200,
      temperature: 0.7,
    });
    
    return response.choices[0].message.content || "Hey, how's it going?";
  } catch (error) {
    console.error('Error generating persona message:', error);
    return "I'm having trouble connecting right now. Let's chat later!";
  }
}

export async function generatePersonaReply(personaId: number, userMessage: string): Promise<string> {
  try {
    const messageHistory = await buildConversationContext(personaId);
    
    // Add the user's latest message
    messageHistory.push({
      role: 'user',
      content: userMessage
    });
    
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: messageHistory as any,
      max_tokens: 200,
      temperature: 0.7,
    });
    
    return response.choices[0].message.content || "I'm not sure how to respond to that.";
  } catch (error) {
    console.error('Error generating persona reply:', error);
    return "Sorry, I'm having trouble processing that right now. Can we try again?";
  }
}
