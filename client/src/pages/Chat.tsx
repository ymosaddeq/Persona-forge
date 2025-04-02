import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { usePersonaContext } from "@/contexts/PersonaContext";
import ChatInterface from "@/components/chat/ChatInterface";
import { Button } from "@/components/ui/button";

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const [_, navigate] = useLocation();
  const personaId = parseInt(id);
  
  const { personas, isLoading, getPersona } = usePersonaContext();
  const persona = getPersona(personaId);

  // Navigate away if persona not found
  useEffect(() => {
    if (!isLoading && !persona) {
      navigate("/");
    }
  }, [isLoading, persona, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!persona) {
    return (
      <div className="text-center py-10">
        <div className="text-red-500 mb-4">
          <span className="material-icons text-4xl">error_outline</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Persona Not Found</h3>
        <p className="text-gray-600 mb-4">The persona you're looking for doesn't exist.</p>
        <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Chat with {persona.name}</h2>
        <Button variant="outline" onClick={() => navigate("/")}>
          <span className="material-icons mr-2">arrow_back</span>
          Back to Personas
        </Button>
      </div>
      
      <ChatInterface personaId={personaId} />
    </div>
  );
}
