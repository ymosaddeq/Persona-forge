import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Trash2, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface VoiceMessageProps {
  audioUrl: string;
  duration: number;
  className?: string;
  onDelete?: () => void;
  isUserMessage?: boolean;
}

export function VoiceMessage({ audioUrl, duration, className, onDelete, isUserMessage = false }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Format time as MM:SS
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    
    if (newVolume === 0) {
      setIsMuted(true);
      audioRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      audioRef.current.muted = false;
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    
    const currentTime = audioRef.current.currentTime;
    const duration = audioRef.current.duration || 1;
    const progressPercent = (currentTime / duration) * 100;
    
    setProgress(progressPercent);
    setCurrentTime(currentTime);
  };

  const handleProgressChange = (value: number[]) => {
    if (!audioRef.current) return;
    
    const newProgress = value[0];
    const newTime = (audioRef.current.duration || duration) * (newProgress / 100);
    
    audioRef.current.currentTime = newTime;
    setProgress(newProgress);
    setCurrentTime(newTime);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  // Handle audio load
  useEffect(() => {
    if (audioRef.current) {
      const handleLoadedMetadata = () => {
        setIsLoaded(true);
      };
      
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
      };
    }
  }, [audioRef.current]);

  // Handle audio restart
  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Handle delete
  const handleDelete = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
    
    if (onDelete) {
      onDelete();
      toast({
        title: "Voice message deleted",
        description: "The voice message has been removed from the conversation.",
        variant: "default",
      });
    }
  };

  return (
    <div 
      className={cn(
        'voice-player rounded-lg p-2 transition-all duration-200',
        isUserMessage ? 'bg-primary/10' : 'bg-secondary/50',
        showControls ? 'shadow-md' : '',
        className
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Audio element (hidden) */}
      <audio 
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />
      
      {/* Main controls row */}
      <div className="voice-player-controls flex items-center gap-2 mb-1">
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "h-8 w-8 rounded-full p-0 flex items-center justify-center",
            isPlaying ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-secondary"
          )}
          onClick={togglePlay}
          disabled={!isLoaded}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </Button>
        
        <div className="flex-1 flex items-center gap-2">
          <Slider 
            value={[progress]} 
            min={0} 
            max={100} 
            step={1}
            onValueChange={handleProgressChange}
            className="cursor-pointer"
            disabled={!isLoaded}
          />
          
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {formatTime(currentTime)}/{formatTime(audioRef.current?.duration || duration)}
          </div>
        </div>
        
        {/* Show restart and delete buttons when controls are visible */}
        {showControls && (
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 rounded-full opacity-70 hover:opacity-100" 
              onClick={handleRestart}
              title="Restart"
            >
              <RotateCcw size={14} />
            </Button>
            
            {onDelete && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0 rounded-full text-destructive opacity-70 hover:opacity-100 hover:bg-destructive/10" 
                onClick={handleDelete}
                title="Delete"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* Volume control - only visible when showControls is true */}
      {showControls && (
        <div className="voice-player-controls flex items-center gap-2 mt-1 px-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 rounded-full" 
            onClick={toggleMute}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </Button>
          
          <div className="flex-1">
            <Slider 
              value={[isMuted ? 0 : volume]} 
              min={0} 
              max={1} 
              step={0.01}
              onValueChange={handleVolumeChange}
              className="cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceMessage;