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

// Generate a fallback response based on persona interests when OpenAI is unavailable
function generateFallbackResponse(persona: Persona, userMessage: string): string {
  const interests = persona.interests;
  const traits = persona.traits as any;
  
  // Basic responses based on persona interests
  const interestResponses: Record<string, string[]> = {
    'Technology': [
      "I've been reading about the latest tech trends. Have you tried any new gadgets recently?",
      "Technology is evolving so quickly! What tech are you most excited about these days?",
      "I'm fascinated by AI advancements. What tech innovations do you think will have the biggest impact in the next few years?"
    ],
    'Gadgets': [
      "I've been thinking about upgrading my devices. Any recommendations?",
      "Did you see the latest smartphone release? The features look incredible!",
      "I love testing new gadgets. What's your favorite tech purchase from the last year?"
    ],
    'Programming': [
      "Been working on any interesting coding projects lately?",
      "I've been diving into some new programming languages. Have you learned any new tech skills recently?",
      "The developer community is so innovative. What programming trends are you following these days?"
    ],
    'AI': [
      "AI is changing everything so rapidly. What applications of AI do you find most interesting?",
      "I've been reading about some fascinating AI research papers. Are you interested in how AI is evolving?",
      "The possibilities with AI seem endless. What do you think about how it's being used today?"
    ],
    'Cooking': [
      "I tried a new recipe yesterday! Do you enjoy cooking?",
      "Food brings people together. What's your favorite cuisine to cook at home?",
      "I've been experimenting in the kitchen lately. Have you discovered any new favorite recipes?"
    ],
    'Restaurants': [
      "Have you discovered any great new restaurants lately?",
      "I'm always looking for new dining spots. Any recommendations?",
      "There's nothing like a great dining experience. What type of restaurants do you enjoy most?"
    ],
    'Food Culture': [
      "Every culture has such fascinating food traditions. Have you explored any new cuisines recently?",
      "Food tells us so much about history and culture. What food traditions are you most interested in?",
      "I find food documentaries so fascinating. Have you watched any good ones about food culture?"
    ],
    'Wine': [
      "I've been learning more about wine pairings. Do you have any favorite wines?",
      "Wine tasting is such an adventure for the senses. Have you visited any vineyards?",
      "There's something special about finding the perfect wine for a meal. Are you interested in wine culture?"
    ]
  };
  
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
    "Thanks for sharing that with me. What other interests do you have?"
  ];
  
  const randomIndex = Math.floor(Math.random() * genericResponses.length);
  return genericResponses[randomIndex];
}
