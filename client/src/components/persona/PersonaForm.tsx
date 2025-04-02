import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { PersonaTemplate, Persona, traitSchema, updatePersonaSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface PersonaFormProps {
  personaTemplates: PersonaTemplate[];
  persona?: Persona;
  isEditing?: boolean;
}

export default function PersonaForm({ personaTemplates, persona, isEditing = false }: PersonaFormProps) {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [interests, setInterests] = useState<string[]>(persona?.interests || []);
  const [newInterest, setNewInterest] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<PersonaTemplate | null>(null);

  // Form schema extends updatePersonaSchema with additional validation
  const formSchema = updatePersonaSchema.extend({
    templateId: isEditing ? z.number().optional() : z.number().min(1, "Please select a template"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    tagline: z.string().min(2, "Tagline must be at least 2 characters"),
    whatsappNumber: z.string().optional().refine(val => {
      if (!val) return true;
      return /^\+?[0-9]{10,15}$/.test(val);
    }, "Must be a valid phone number")
  });

  type FormValues = z.infer<typeof formSchema>;

  // Form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: persona ? {
      ...persona,
      templateId: persona.templateId,
      traits: persona.traits as any,
      whatsappNumber: persona.whatsappNumber || ""
    } : {
      name: "",
      tagline: "",
      avatarIcon: "face",
      traits: {
        extroversion: 5,
        emotional: 5,
        playfulness: 5,
        adventurous: 5
      },
      interests: [],
      isActive: false,
      messagingPreference: "in-app",
      messageFrequency: "daily",
      whatsappEnabled: false,
      whatsappNumber: ""
    }
  });

  // When template changes, update default values
  useEffect(() => {
    if (!isEditing && selectedTemplate) {
      form.setValue("name", selectedTemplate.name);
      form.setValue("tagline", `The ${selectedTemplate.description.split(',')[0].toLowerCase()}`);
      form.setValue("avatarIcon", selectedTemplate.avatarIcon);
      form.setValue("traits", selectedTemplate.defaultTraits as any);
      setInterests(selectedTemplate.defaultInterests);
    }
  }, [selectedTemplate, form, isEditing]);

  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    const id = parseInt(templateId);
    const template = personaTemplates.find(t => t.id === id) || null;
    setSelectedTemplate(template);
    form.setValue("templateId", id);
  };

  // Handle adding an interest
  const addInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      const updatedInterests = [...interests, newInterest.trim()];
      setInterests(updatedInterests);
      form.setValue("interests", updatedInterests);
      setNewInterest("");
    }
  };

  // Handle removing an interest
  const removeInterest = (interest: string) => {
    const updatedInterests = interests.filter(i => i !== interest);
    setInterests(updatedInterests);
    form.setValue("interests", updatedInterests);
  };

  // Handle keypress for interest input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addInterest();
    }
  };

  // Get trait label based on value
  const getTraitLabel = (trait: string, value: number) => {
    const labels: Record<string, [string, string]> = {
      extroversion: ["Introverted", "Extroverted"],
      emotional: ["Analytical", "Emotional"],
      playfulness: ["Serious", "Playful"],
      adventurous: ["Cautious", "Adventurous"]
    };

    if (value <= 3) return labels[trait][0];
    if (value >= 7) return labels[trait][1];
    return "Balanced";
  };

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    try {
      // Make sure interests are set
      data.interests = interests;
      
      if (isEditing && persona) {
        // Update existing persona
        await apiRequest("PATCH", `/api/personas/${persona.id}`, data);
        toast({
          title: "Persona updated successfully",
          description: `${data.name} has been updated.`,
        });
      } else {
        // Create new persona
        await apiRequest("POST", "/api/personas", {
          ...data,
          templateId: selectedTemplate?.id || data.templateId
        });
        toast({
          title: "Persona created successfully",
          description: `${data.name} has been created.`,
        });
      }
      
      // Redirect to dashboard
      setLocation("/");
    } catch (error: any) {
      console.error("Error saving persona:", error);
      
      // If the error contains a response with error details, log them
      if (error.response?.data) {
        console.error("Validation errors:", error.response.data);
      }
      
      toast({
        title: "Error saving persona",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-white">
            <span className="material-icons">{form.watch("avatarIcon") || "face"}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{isEditing ? "Edit Persona" : "Create New Persona"}</h2>
            <p className="text-sm text-gray-500">Customize your persona's traits and interests</p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => setLocation("/")} className="text-gray-500 hover:text-gray-700">
          <span className="material-icons">close</span>
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Basic Info */}
            <div className="space-y-6">
              {!isEditing && (
                <FormField
                  control={form.control}
                  name="templateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Persona Template</FormLabel>
                      <Select 
                        onValueChange={(value) => handleTemplateChange(value)}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {personaTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id.toString()}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose a starting point for your persona
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Persona name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tagline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tagline</FormLabel>
                    <FormControl>
                      <Input placeholder="A short description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Personality Traits</h3>
                <div className="space-y-5">
                  {/* Extroversion trait */}
                  <FormField
                    control={form.control}
                    name="traits.extroversion"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center mb-2">
                          <FormLabel>Introversion vs. Extroversion</FormLabel>
                          <span className="text-sm text-primary">
                            {getTraitLabel('extroversion', field.value)}
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            min={0}
                            max={10}
                            step={1}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Emotional trait */}
                  <FormField
                    control={form.control}
                    name="traits.emotional"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center mb-2">
                          <FormLabel>Analytical vs. Emotional</FormLabel>
                          <span className="text-sm text-primary">
                            {getTraitLabel('emotional', field.value)}
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            min={0}
                            max={10}
                            step={1}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Playfulness trait */}
                  <FormField
                    control={form.control}
                    name="traits.playfulness"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center mb-2">
                          <FormLabel>Serious vs. Playful</FormLabel>
                          <span className="text-sm text-primary">
                            {getTraitLabel('playfulness', field.value)}
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            min={0}
                            max={10}
                            step={1}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Adventurous trait */}
                  <FormField
                    control={form.control}
                    name="traits.adventurous"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center mb-2">
                          <FormLabel>Cautious vs. Adventurous</FormLabel>
                          <span className="text-sm text-primary">
                            {getTraitLabel('adventurous', field.value)}
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            min={0}
                            max={10}
                            step={1}
                            onValueChange={(vals) => field.onChange(vals[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Interests and Communication */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Interests & Topics</h3>
                <div className="mb-4">
                  <FormLabel className="block text-sm font-medium text-gray-700 mb-2">
                    Add interests your persona will talk about
                  </FormLabel>
                  <div className="flex">
                    <Input
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Add an interest..."
                      className="flex-1 rounded-r-none"
                    />
                    <Button 
                      type="button" 
                      onClick={addInterest}
                      className="rounded-l-none"
                    >
                      Add
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {interests.map((interest, index) => (
                    <span key={index} className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1 rounded-full flex items-center">
                      {interest}
                      <button
                        type="button"
                        onClick={() => removeInterest(interest)}
                        className="ml-1 text-indigo-600 hover:text-indigo-800"
                      >
                        <span className="material-icons text-sm">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Communication Settings</h3>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="messagingPreference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Method</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select messaging preference" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="in-app">In-app messaging</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="messageFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between">
                          <FormLabel>Message Frequency</FormLabel>
                          <span className="text-sm text-primary capitalize">{field.value}</span>
                        </div>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select message frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="often">Often (multiple times a day)</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="never">Only when I message first</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsappEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Enable WhatsApp integration
                          </FormLabel>
                          <FormDescription>
                            Allow this persona to send messages via WhatsApp
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {form.watch("whatsappEnabled") && (
                    <FormField
                      control={form.control}
                      name="whatsappNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp Number</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="+1 (555) 000-0000" 
                              {...field} 
                              value={field.value || ""} 
                            />
                          </FormControl>
                          <FormDescription>
                            Include country code (e.g., +1 for US)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-5">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setLocation("/")}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Persona"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
