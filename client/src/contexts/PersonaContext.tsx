import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Persona, PersonaTemplate } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PersonaContextType {
  personas: Persona[];
  templates: PersonaTemplate[];
  isLoading: boolean;
  error: Error | null;
  togglePersonaActive: (id: number, active: boolean) => Promise<void>;
  getPersona: (id: number) => Persona | undefined;
  refetchPersonas: () => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch personas
  const { 
    data: personas = [], 
    isLoading: isLoadingPersonas, 
    error: personasError,
    refetch: refetchPersonas
  } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });
  
  // Fetch templates
  const { 
    data: templates = [], 
    isLoading: isLoadingTemplates, 
    error: templatesError 
  } = useQuery<PersonaTemplate[]>({
    queryKey: ["/api/persona-templates"],
  });

  // Toggle persona active state
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      return apiRequest("PATCH", `/api/personas/${id}`, { isActive: active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
    },
    onError: () => {
      toast({
        title: "Failed to update persona",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  async function togglePersonaActive(id: number, active: boolean) {
    await toggleActiveMutation.mutateAsync({ id, active });
  }

  function getPersona(id: number): Persona | undefined {
    return personas.find(p => p.id === id);
  }

  const value = {
    personas,
    templates,
    isLoading: isLoadingPersonas || isLoadingTemplates,
    error: personasError || templatesError,
    togglePersonaActive,
    getPersona,
    refetchPersonas
  };

  return (
    <PersonaContext.Provider value={value}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersonaContext() {
  const context = useContext(PersonaContext);
  if (context === undefined) {
    throw new Error("usePersonaContext must be used within a PersonaProvider");
  }
  return context;
}
