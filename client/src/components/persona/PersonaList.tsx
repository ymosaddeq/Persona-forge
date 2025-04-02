import { useQuery } from "@tanstack/react-query";
import { Persona } from "@shared/schema";
import PersonaCard from "./PersonaCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function PersonaList() {
  const { data: personas, isLoading, error } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });

  // If loading, show skeleton cards
  if (isLoading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">My Personas</h2>
          <Link href="/personas/new">
            <Button className="flex items-center">
              <span className="material-icons mr-2">add</span>
              Create New
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden p-5">
              <div className="flex items-center space-x-3 mb-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div>
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="space-y-3 mb-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If error, show error message
  if (error) {
    return (
      <div className="text-center py-10">
        <div className="text-red-500 mb-4">
          <span className="material-icons text-4xl">error_outline</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Error Loading Personas</h3>
        <p className="text-gray-600 mb-4">There was a problem loading your personas.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  // If no personas, show empty state
  if (!personas || personas.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">My Personas</h2>
          <Link href="/personas/new">
            <Button className="flex items-center">
              <span className="material-icons mr-2">add</span>
              Create New
            </Button>
          </Link>
        </div>
        
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
          <div className="text-gray-400 mb-4">
            <span className="material-icons text-6xl">face</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">No Personas Yet</h3>
          <p className="text-gray-600 mb-6">Create your first persona to start chatting!</p>
          <Link href="/personas/new">
            <Button>
              <span className="material-icons mr-2">add</span>
              Create Persona
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Render persona list
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">My Personas</h2>
        <Link href="/personas/new">
          <Button className="flex items-center">
            <span className="material-icons mr-2">add</span>
            Create New
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas.map((persona) => (
          <PersonaCard key={persona.id} persona={persona} />
        ))}
      </div>
    </div>
  );
}
