import OpenAI from 'openai';
import { Persona } from '@shared/schema';
import { storage } from './storage';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-development'
});

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

interface MessageHistory {
  role: 'user' | 'assistant' | 'system';
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
    role: 'system',
    content: `You are ${persona.name}, an AI persona with the following personality traits: ${generatePersonalityDescription(persona)}. 
    Your tagline is: "${persona.tagline}"
    Your primary interests are: ${persona.interests.join(', ')}
    
    Guidelines for your responses:
    1. Stay completely in character and respond as ${persona.name} would, reflecting your personality traits
    2. Make your responses highly relevant to the user's messages and their content
    3. Show genuine interest in what the user says and ask engaging follow-up questions
    4. Share insights, opinions, and information related to your interests when relevant
    5. Maintain a friendly, conversational tone that matches your personality traits
    6. Keep responses concise (1-3 sentences) and natural sounding
    
    History context: You are in an ongoing conversation with a human friend who enjoys talking with you.
    If the conversation references previous messages not visible here, blend smoothly into that context.`
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
    
    // If OpenAI API is unavailable, use a fallback response based on persona interests
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy-key-for-development') {
      console.log('Using fallback responses due to missing API key');
      return generateFallbackResponse(persona, "");
    }
    
    const messageHistory = await buildConversationContext(personaId);
    
    // Generate a prompt for the AI to create a new message
    const prompt = `Based on my personality and our conversation history, generate a new message to send to the user. 
    It should be casual, friendly, and related to my interests in ${persona.interests.join(', ')}.`;
    
    messageHistory.push({
      role: 'user',
      content: prompt
    });
    
    try {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: messageHistory as any,
        max_tokens: 200,
        temperature: 0.7,
      });
      
      return response.choices[0].message.content || "Hey, how's it going?";
    } catch (apiError: any) {
      console.error('OpenAI API error:', apiError);
      
      // Check if it's a rate limit or quota error
      if (apiError.status === 429 || (apiError.error?.code === 'insufficient_quota')) {
        console.log('Using fallback responses due to rate limiting or quota issues');
        return generateFallbackResponse(persona, "");
      }
      
      // For other API errors
      throw apiError;
    }
  } catch (error) {
    console.error('Error generating persona message:', error);
    return "I'm having trouble connecting right now. Let's chat later!";
  }
}

export async function generatePersonaReply(personaId: number, userMessage: string): Promise<string> {
  try {
    const persona = await storage.getPersona(personaId);
    if (!persona) throw new Error('Persona not found');
    
    // If OpenAI API is unavailable, use a fallback response based on persona interests
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy-key-for-development') {
      console.log('Using fallback responses due to missing API key');
      return generateFallbackResponse(persona, userMessage);
    }
    
    const messageHistory = await buildConversationContext(personaId);
    
    // Add the user's latest message
    messageHistory.push({
      role: 'user',
      content: userMessage
    });
    
    try {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: messageHistory as any,
        max_tokens: 200,
        temperature: 0.7,
      });
      
      return response.choices[0].message.content || "I'm not sure how to respond to that.";
    } catch (apiError: any) {
      console.error('OpenAI API error:', apiError);
      
      // Check if it's a rate limit or quota error
      if (apiError.status === 429 || (apiError.error?.code === 'insufficient_quota')) {
        console.log('Using fallback responses due to rate limiting or quota issues');
        return generateFallbackResponse(persona, userMessage);
      }
      
      // For other API errors
      throw apiError;
    }
  } catch (error) {
    console.error('Error generating persona reply:', error);
    return "Sorry, I'm having trouble processing that right now. Can we try again?";
  }
}

// Create a directory for audio files if it doesn't exist
const VOICE_FILES_DIR = path.resolve('./public/voice-messages');

// Make sure the voice files directory exists
(async () => {
  try {
    await fsPromises.stat(VOICE_FILES_DIR);
  } catch (error) {
    // Directory doesn't exist, create it
    await fsPromises.mkdir(VOICE_FILES_DIR, { recursive: true });
    console.log(`Created directory: ${VOICE_FILES_DIR}`);
  }
})();

// Generate voice message using OpenAI Text-to-Speech API
export async function generateVoiceMessage(text: string, personaId: number): Promise<{ filePath: string, duration: number } | null> {
  try {
    // Skip voice generation if no OpenAI API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy-key-for-development') {
      console.log('Skipping voice generation due to missing API key');
      return null;
    }

    const persona = await storage.getPersona(personaId);
    if (!persona) throw new Error('Persona not found');
    
    // Choose voice based on persona traits
    const traits = persona.traits as any;
    let voice = 'alloy'; // default voice
    
    // Determine voice based on persona traits
    if (traits.extroversion > 7) {
      voice = 'nova'; // Energetic voice for extroverted personas
    } else if (traits.playfulness > 7) {
      voice = 'shimmer'; // Playful voice
    } else if (traits.emotional < 4) {
      voice = 'onyx'; // More serious voice for logical personas
    } else {
      voice = 'echo'; // Balanced voice for balanced personas
    }
    
    try {
      // Generate audio file using OpenAI TTS
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice,
        input: text,
        speed: 1.0,
      });
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `persona-${personaId}-${timestamp}.mp3`;
      const filePath = path.join(VOICE_FILES_DIR, fileName);
      
      // Convert to Buffer and save to file
      const buffer = Buffer.from(await mp3.arrayBuffer());
      await fsPromises.writeFile(filePath, buffer);
      
      // Estimate duration (rough estimate: ~150 characters per 10 seconds)
      const estimatedDuration = Math.ceil(text.length / 15);
      
      return {
        filePath: `/voice-messages/${fileName}`, // Public URL path
        duration: estimatedDuration
      };
    } catch (apiError: any) {
      console.error('OpenAI TTS API error:', apiError);
      
      // Check if it's a rate limit or quota error
      if (apiError.status === 429 || (apiError.error?.code === 'insufficient_quota')) {
        console.log('Skipping voice generation due to rate limiting or quota issues');
        return null;
      }
      
      // For other API errors
      throw apiError;
    }
  } catch (error) {
    console.error('Error generating voice message:', error);
    return null;
  }
}

// Generate a fallback response based on persona interests when OpenAI is unavailable
function generateFallbackResponse(persona: Persona, userMessage: string): string {
  const interests = persona.interests;
  const traits = persona.traits as any;
  const userMessageLower = userMessage.toLowerCase();
  
  // Try to provide contextual responses based on user's message first
  if (userMessageLower.includes("hello") || userMessageLower.includes("hi") || userMessageLower.includes("hey")) {
    return `Hi there! Great to chat with you. I'm ${persona.name}, and I'm really into ${interests.join(", ")}. How are you doing today?`;
  }
  
  if (userMessageLower.includes("how are you")) {
    return `I'm doing great, thanks for asking! I was just thinking about ${interests[Math.floor(Math.random() * interests.length)]} actually. What about you?`;
  }
  
  if (userMessageLower.includes("tell me about") || userMessageLower.includes("what do you think about")) {
    for (const interest of interests) {
      if (userMessageLower.includes(interest.toLowerCase())) {
        return `I'd love to talk about ${interest}! It's one of my favorite subjects. What specific aspects of ${interest} are you interested in?`;
      }
    }
  }
  
  // Basic responses based on persona interests with more variety
  const interestResponses: Record<string, string[]> = {
    'Technology': [
      "I've been reading about the latest tech trends. Have you tried any new gadgets recently?",
      "Technology is evolving so quickly! What tech are you most excited about these days?",
      "I'm fascinated by AI advancements. What tech innovations do you think will have the biggest impact in the next few years?",
      "I just read an article about quantum computing breakthroughs. The potential applications are mind-blowing!",
      "Have you noticed how technology is changing how we interact with each other? I find it both fascinating and a bit concerning."
    ],
    'Gadgets': [
      "I've been thinking about upgrading my devices. Any recommendations?",
      "Did you see the latest smartphone release? The features look incredible!",
      "I love testing new gadgets. What's your favorite tech purchase from the last year?",
      "Smart home devices have really improved lately. Have you integrated any into your living space?",
      "Wearable tech keeps getting more advanced. Are you using any fitness trackers or smartwatches?"
    ],
    'Programming': [
      "Been working on any interesting coding projects lately?",
      "I've been diving into some new programming languages. Have you learned any new tech skills recently?",
      "The developer community is so innovative. What programming trends are you following these days?",
      "Open source projects have really changed the software landscape. Any favorites you contribute to?",
      "What do you think about low-code platforms? Are they the future or just another tool in the toolkit?"
    ],
    'AI': [
      "AI is changing everything so rapidly. What applications of AI do you find most interesting?",
      "I've been reading about some fascinating AI research papers. Are you interested in how AI is evolving?",
      "The possibilities with AI seem endless. What do you think about how it's being used today?",
      "Generative AI models have gotten remarkably good. What creative applications have you seen that impressed you?",
      "The intersection of AI and healthcare seems promising. Do you follow any developments in that space?"
    ],
    'Cooking': [
      "I tried a new recipe yesterday! Do you enjoy cooking?",
      "Food brings people together. What's your favorite cuisine to cook at home?",
      "I've been experimenting in the kitchen lately. Have you discovered any new favorite recipes?",
      "There's something so therapeutic about cooking. Do you find it relaxing too?",
      "I'm trying to learn more sustainable cooking practices. Have you explored any eco-friendly cooking methods?"
    ],
    'Restaurants': [
      "Have you discovered any great new restaurants lately?",
      "I'm always looking for new dining spots. Any recommendations?",
      "There's nothing like a great dining experience. What type of restaurants do you enjoy most?",
      "Farm-to-table restaurants have really grown in popularity. Have you been to any?",
      "I'm fascinated by how restaurants design their menus. Have you noticed how they highlight certain dishes?"
    ],
    'Food Culture': [
      "Every culture has such fascinating food traditions. Have you explored any new cuisines recently?",
      "Food tells us so much about history and culture. What food traditions are you most interested in?",
      "I find food documentaries so fascinating. Have you watched any good ones about food culture?",
      "Street food is such an authentic way to experience a culture. Do you seek out street food when traveling?",
      "The way spices are used across different cultures tells such rich stories. Any favorite spice combinations?"
    ],
    'Wine': [
      "I've been learning more about wine pairings. Do you have any favorite wines?",
      "Wine tasting is such an adventure for the senses. Have you visited any vineyards?",
      "There's something special about finding the perfect wine for a meal. Are you interested in wine culture?",
      "Natural wines are becoming more popular. Have you tried any that you enjoyed?",
      "Each wine region has such a distinct character. Do you have a favorite wine-producing region?"
    ]
  };
  
  // Check for any content about user's interests in the message
  const messageWords = userMessageLower.split(/\s+/);
  const possibleMatches = [];
  
  for (const interest of interests) {
    const interestLower = interest.toLowerCase();
    if (messageWords.some(word => word.includes(interestLower) || interestLower.includes(word))) {
      possibleMatches.push(interest);
    }
  }
  
  if (possibleMatches.length > 0) {
    const matchedInterest = possibleMatches[Math.floor(Math.random() * possibleMatches.length)];
    if (interestResponses[matchedInterest]) {
      const responses = interestResponses[matchedInterest];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }
  
  // Check if any interests match our predefined categories
  for (const interest of interests) {
    if (interestResponses[interest] && interestResponses[interest].length > 0) {
      // Randomly select a response for this interest
      const responses = interestResponses[interest];
      const randomIndex = Math.floor(Math.random() * responses.length);
      return responses[randomIndex];
    }
  }
  
  // Generic fallback responses if no matching interests found
  const genericResponses = [
    "That's interesting! Tell me more about your thoughts on that.",
    "I'd love to hear more about your perspective on this topic.",
    "That's a great point! What else have you been thinking about lately?",
    "I find that fascinating. How did you become interested in this?",
    "Thanks for sharing that with me. What other interests do you have?",
    "I'm curious to learn more about that. Could you elaborate?",
    "That's a perspective I hadn't considered before. What led you to that conclusion?",
    "I appreciate you sharing your thoughts. What else is on your mind today?",
    "Tell me more about why you feel that way. I'm genuinely interested.",
    "That's really thoughtful. Have you always been interested in topics like this?"
  ];
  
  const randomIndex = Math.floor(Math.random() * genericResponses.length);
  return genericResponses[randomIndex];
}
