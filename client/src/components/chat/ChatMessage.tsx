import { Message, Persona } from "@shared/schema";
import { format } from "date-fns";
import VoiceMessage from "./VoiceMessage";
import { Volume2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessageProps {
  message: Message;
  persona: Persona;
  onMessageDelete?: (message: Message) => void;
}

export default function ChatMessage({ message, persona, onMessageDelete }: ChatMessageProps) {
  const isFromPersona = message.isFromPersona;
  const formattedTime = format(new Date(message.sentAt), "h:mm a");
  const queryClient = useQueryClient();
  
  // Handle deleting a voice message
  const handleVoiceMessageDelete = async () => {
    try {
      if (!message.hasVoice) return;
      
      // Mark the message as no longer having voice
      await apiRequest(
        'DELETE',
        `/api/messages/${message.id}/voice`
      );
      
      // Invalidate the messages query to refresh the messages
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${message.conversationId}/messages`] });
      
      // Call the parent onMessageDelete if provided
      if (onMessageDelete) {
        onMessageDelete(message);
      }
    } catch (error) {
      console.error("Failed to delete voice message:", error);
    }
  };
  
  if (isFromPersona) {
    return (
      <div className="flex flex-col space-y-1">
        <div className="flex items-end space-x-2">
          <div className={`w-8 h-8 rounded-full ${getAvatarBgColor(persona.avatarIcon)} flex-shrink-0 flex items-center justify-center text-white`}>
            <span className="material-icons text-sm">{persona.avatarIcon}</span>
          </div>
          <div className="message-bubble-incoming max-w-xs md:max-w-md px-4 py-2">
            <p className="text-sm">{message.content}</p>
            {message.hasVoice && message.voiceUrl && (
              <div className="mt-2">
                <VoiceMessage 
                  audioUrl={message.voiceUrl} 
                  duration={message.voiceDuration || 10} 
                  onDelete={handleVoiceMessageDelete}
                  isUserMessage={false}
                />
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500">{formattedTime}</span>
        </div>
        {message.deliveredVia === "whatsapp" && (
          <div className="pl-10">
            <span className="text-xs text-gray-500">Sent via WhatsApp</span>
          </div>
        )}
        {hasRelevantInterest(message.content, persona.interests) && (
          <div className="pl-10">
            <span className="text-xs text-gray-500">
              {persona.name} is interested in {getRelevantInterests(message.content, persona.interests).join(", ")}
            </span>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="flex justify-end space-x-2">
      <span className="text-xs text-gray-500 self-end">{formattedTime}</span>
      <div className="message-bubble-outgoing max-w-xs md:max-w-md px-4 py-2">
        <p className="text-sm">{message.content}</p>
        {message.hasVoice && message.voiceUrl && (
          <div className="mt-2">
            <VoiceMessage 
              audioUrl={message.voiceUrl} 
              duration={message.voiceDuration || 10} 
              onDelete={handleVoiceMessageDelete}
              isUserMessage={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to get avatar background color
function getAvatarBgColor(avatarIcon: string): string {
  switch (avatarIcon) {
    case 'sports_esports':
      return 'bg-accent';
    case 'fitness_center':
      return 'bg-green-500';
    default:
      return 'bg-secondary';
  }
}

// Helper function to check if message contains any relevant interests
function hasRelevantInterest(message: string, interests: string[]): boolean {
  return interests.some(interest => 
    message.toLowerCase().includes(interest.toLowerCase())
  );
}

// Helper function to get relevant interests mentioned in a message
function getRelevantInterests(message: string, interests: string[]): string[] {
  return interests.filter(interest => 
    message.toLowerCase().includes(interest.toLowerCase())
  );
}
