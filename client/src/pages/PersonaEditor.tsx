import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Persona, PersonaTemplate } from "@shared/schema";
import PersonaForm from "@/components/persona/PersonaForm";
import { usePersonaContext } from "@/contexts/PersonaContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function PersonaEditor() {
  const { id } = useParams<{ id: string }>();
  const [_, navigate] = useLocation();
  const isEditing = !!id;
  const personaId = isEditing ? parseInt(id) : undefined;
  
  // Get templates from context
  const { templates, isLoading: isLoadingTemplates } = usePersonaContext();

  // Fetch specific persona if editing
  const { 
    data: persona, 
    isLoading: isLoadingPersona,
    error
  } = useQuery<Persona>({
    queryKey: [`/api/personas/${personaId}`],
    enabled: isEditing && !!personaId,
  });

  // Navigate away if persona not found when editing
  useEffect(() => {
    if (isEditing && !isLoadingPersona && !persona && !error) {
      navigate("/");
    }
  }, [isEditing, isLoadingPersona, persona, error, navigate]);

  // Loading state
  if ((isEditing && isLoadingPersona) || isLoadingTemplates) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-6">
          <Skeleton className="w-12 h-12 rounded-full mr-3" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="space-y-6">
            {Array(3).fill(0).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <div className="flex justify-end pt-4">
              <Skeleton className="h-10 w-24 mr-2" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-red-500 mb-4">
          <span className="material-icons text-5xl">error_outline</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Error Loading Persona</h3>
        <p className="text-gray-600 mb-4">There was a problem loading the persona. Please try again.</p>
        <div className="flex justify-center space-x-4">
          <Button variant="outline" onClick={() => navigate("/")}>
            Go Back
          </Button>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PersonaForm
      personaTemplates={templates}
      persona={persona}
      isEditing={isEditing}
    />
  );
}
