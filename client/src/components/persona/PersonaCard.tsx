import { Link } from "wouter";
import { Persona } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { usePersonaContext } from "@/contexts/PersonaContext";

interface PersonaCardProps {
  persona: Persona;
}

export default function PersonaCard({ persona }: PersonaCardProps) {
  const { togglePersonaActive } = usePersonaContext();

  const handleToggleActive = () => {
    togglePersonaActive(persona.id, !persona.isActive);
  };

  // Define background color based on avatar icon
  const getAvatarBgColor = () => {
    switch (persona.avatarIcon) {
      case 'sports_esports':
        return 'bg-accent';
      case 'fitness_center':
        return 'bg-green-500';
      default:
        return 'bg-secondary';
    }
  };

  // Define tag colors based on avatar icon
  const getTagBgColor = () => {
    switch (persona.avatarIcon) {
      case 'sports_esports':
        return 'bg-violet-100 text-violet-800';
      case 'fitness_center':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-indigo-100 text-indigo-800';
    }
  };

  return (
    <div className="persona-card bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-5">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-full ${getAvatarBgColor()} flex items-center justify-center text-white`}>
              <span className="material-icons">{persona.avatarIcon}</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{persona.name}</h3>
              <p className="text-sm text-gray-500">{persona.tagline}</p>
            </div>
          </div>
          <div className="flex items-center">
            <label className="inline-flex relative items-center cursor-pointer">
              <Switch 
                checked={persona.isActive} 
                onCheckedChange={handleToggleActive}
              />
              <span className="ml-3 text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
        </div>
        <div className="space-y-3 mb-4">
          <div className="flex items-start">
            <span className="material-icons text-gray-400 mr-2 mt-0.5">psychology</span>
            <p className="text-sm text-gray-700">
              {/* Display persona description based on traits */}
              {(() => {
                const traits = persona.traits as any;
                if (traits.extroversion > 7) {
                  return "Outgoing and ";
                } else if (traits.extroversion < 4) {
                  return "Reserved and ";
                } else {
                  return "Moderately social and ";
                }
              })()}
              {(() => {
                const traits = persona.traits as any;
                if (traits.emotional > 7) {
                  return "emotional, ";
                } else if (traits.emotional < 4) {
                  return "analytical, ";
                } else {
                  return "balanced, ";
                }
              })()}
              loves to chat about {persona.interests.slice(0, 2).join(' and ')}
            </p>
          </div>
          <div className="flex items-center">
            <span className="material-icons text-gray-400 mr-2">interests</span>
            <div className="flex flex-wrap gap-2">
              {persona.interests.map((interest, index) => (
                <span key={index} className={`${getTagBgColor()} text-xs px-2 py-1 rounded-full`}>
                  {interest}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between">
          <Link href={`/personas/${persona.id}/edit`}>
            <Button variant="ghost" size="sm" className="text-primary hover:text-indigo-700 p-0">
              <span className="material-icons mr-1 text-sm">edit</span>
              Edit
            </Button>
          </Link>
          <Link href={`/chat/${persona.id}`}>
            <Button variant="ghost" size="sm" className="text-primary hover:text-indigo-700 p-0">
              <span className="material-icons mr-1 text-sm">chat</span>
              Chat
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
