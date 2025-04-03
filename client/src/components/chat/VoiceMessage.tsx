import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface VoiceMessageProps {
  audioUrl: string;
  duration: number;
  className?: string;
}

export function VoiceMessage({ audioUrl, duration, className }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  return (
    <div className={cn('voice-player', className)}>
      {/* Audio element (hidden) */}
      <audio 
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />
      
      {/* Play/Pause and time progress */}
      <div className="voice-player-controls">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0" 
          onClick={togglePlay}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </Button>
        
        <div className="flex-1">
          <div className="voice-player-progress">
            <div 
              className="voice-player-progress-bar" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground min-w-[48px] text-right">
          {formatTime(currentTime)}/{formatTime(audioRef.current?.duration || duration)}
        </div>
      </div>
      
      {/* Volume control */}
      <div className="voice-player-controls">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0" 
          onClick={toggleMute}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </Button>
        
        <div className="w-24">
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
    </div>
  );
}

export default VoiceMessage;