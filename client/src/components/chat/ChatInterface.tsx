import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Message, Persona, Conversation } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import ChatMessage from "./ChatMessage";

interface ChatInterfaceProps {
  personaId: number;
}

interface ChatResponse {
  conversation: Conversation;
  messages: Message[];
  persona: Persona;
}

export default function ChatInterface({ personaId }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch conversation and messages
  const { data, isLoading, error } = useQuery<ChatResponse>({
    queryKey: [`/api/personas/${personaId}/conversation`],
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/personas/${personaId}/messages`, { content });
    },
    onSuccess: () => {
      // Invalidate and refetch the conversation
      queryClient.invalidateQueries({ queryKey: [`/api/personas/${personaId}/conversation`] });
      setMessage("");
    },
    onError: () => {
      toast({
        title: "Failed to send message",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [data?.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate(message);
    }
  };

  // If loading, show skeleton
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex flex-col h-[600px]">
          {/* Chat Header Skeleton */}
          <div className="border-b border-gray-200 px-4 py-3 flex items-center">
            <Skeleton className="w-10 h-10 rounded-full mr-3" />
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          
          {/* Chat Messages Skeleton */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-end space-x-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-16 w-64 rounded-lg" />
              </div>
            ))}
          </div>
          
          {/* Chat Input Skeleton */}
          <div className="border-t border-gray-200 px-4 py-3">
            <div className="flex items-center">
              <Skeleton className="w-full h-10 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If error, show error message
  if (error || !data) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-red-500 mb-4">
          <span className="material-icons text-5xl">error_outline</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Error Loading Conversation</h3>
        <p className="text-gray-600 mb-4">There was a problem loading the chat. Please try again.</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/personas/${personaId}/conversation`] })}>
          Retry
        </Button>
      </div>
    );
  }

  const { persona, messages } = data;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="flex flex-col h-[600px]">
        {/* Chat Header */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full ${getAvatarBgColor(persona.avatarIcon)} flex items-center justify-center text-white`}>
              <span className="material-icons">{persona.avatarIcon}</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{persona.name}</h3>
              <p className="text-xs text-gray-500">{persona.isActive ? "Active now" : "Inactive"}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-1 rounded-full hover:bg-gray-100">
              <span className="material-icons text-gray-500">more_vert</span>
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-gray-400 mb-2">
                  <span className="material-icons text-4xl">{persona.avatarIcon}</span>
                </div>
                <p className="text-gray-600">Start a conversation with {persona.name}!</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessage 
                key={msg.id} 
                message={msg} 
                persona={persona} 
              />
            ))
          )}
          
          {/* Show typing indicator when sending a message */}
          {sendMessageMutation.isPending && (
            <div className="flex items-end space-x-2">
              <div className={`w-8 h-8 rounded-full ${getAvatarBgColor(persona.avatarIcon)} flex-shrink-0 flex items-center justify-center text-white`}>
                <span className="material-icons text-sm">{persona.avatarIcon}</span>
              </div>
              <div className="message-bubble-incoming max-w-xs px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Reference for scrolling to bottom */}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendMessage} className="border-t border-gray-200 px-4 py-3">
          <div className="flex items-center">
            <div className="flex-1 mx-3">
              <Input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-full"
                disabled={sendMessageMutation.isPending}
              />
            </div>
            <Button 
              type="submit" 
              size="icon" 
              className="rounded-full"
              disabled={!message.trim() || sendMessageMutation.isPending}
            >
              <span className="material-icons">send</span>
            </Button>
          </div>
        </form>
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
