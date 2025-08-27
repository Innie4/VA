import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { VoiceRecording, UseVoiceRecognitionOptions } from '../types/chat';
import { useThemeStore } from '@store/themeStore';
import { v4 as uuidv4 } from 'uuid';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

interface UseVoiceRecognitionReturn {
  // State
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  error: string | null;
  audioLevel: number;
  duration: number;
  
  // Actions
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  
  // Recording
  recordings: VoiceRecording[];
  currentRecording: VoiceRecording | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<VoiceRecording | null>;
  deleteRecording: (id: string) => void;
  playRecording: (id: string) => Promise<void>;
}

const DEFAULT_OPTIONS: UseVoiceRecognitionOptions = {
  continuous: false,
  interimResults: true,
  language: 'en-US',
  maxAlternatives: 1,
};

export const useVoiceRecognition = (
  options: UseVoiceRecognitionOptions = {}
): UseVoiceRecognitionReturn => {
  const { continuous, interimResults, language, maxAlternatives } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const { i18n } = useTranslation();
  const { reducedMotion } = useThemeStore();
  
  // State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [currentRecording, setCurrentRecording] = useState<VoiceRecording | null>(null);
  
  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Check if speech recognition is supported
  const isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  
  // Initialize speech recognition
  const initializeRecognition = useCallback(() => {
    if (!isSupported) return null;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = continuous || false;
    recognition.interimResults = interimResults || true;
    recognition.lang = language || i18n.language || 'en-US';
    recognition.maxAlternatives = maxAlternatives || 1;
    
    return recognition;
  }, [isSupported, continuous, interimResults, language, maxAlternatives, i18n.language]);
  
  // Start audio level monitoring
  const startAudioLevelMonitoring = useCallback(() => {
    if (!analyserRef.current || reducedMotion) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateAudioLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1);
      
      setAudioLevel(normalizedLevel);
    };
    
    audioLevelIntervalRef.current = setInterval(updateAudioLevel, 100);
  }, [reducedMotion]);
  
  // Stop audio level monitoring
  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, []);
  
  // Start duration tracking
  const startDurationTracking = useCallback(() => {
    const startTime = Date.now();
    
    durationIntervalRef.current = setInterval(() => {
      setDuration(Date.now() - startTime);
    }, 100);
  }, []);
  
  // Stop duration tracking
  const stopDurationTracking = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);
  
  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported || isListening) return;
    
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setConfidence(0);
    
    const recognition = initializeRecognition();
    if (!recognition) return;
    
    recognitionRef.current = recognition;
    
    recognition.onstart = () => {
      setIsListening(true);
      startDurationTracking();
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let maxConfidence = 0;
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0;
        
        if (result.isFinal) {
          finalTranscript += transcript;
          maxConfidence = Math.max(maxConfidence, confidence);
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
        setConfidence(maxConfidence);
      }
      
      setInterimTranscript(interimTranscript);
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setError(event.error);
      setIsListening(false);
      stopDurationTracking();
    };
    
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      stopDurationTracking();
    };
    
    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setError('Failed to start speech recognition');
    }
  }, [isSupported, isListening, initializeRecognition, startDurationTracking, stopDurationTracking]);
  
  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);
  
  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setConfidence(0);
    setDuration(0);
  }, []);
  
  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Set up audio context for level monitoring
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      const recordingId = uuidv4();
      const recording: VoiceRecording = {
        id: recordingId,
        blob: new Blob(),
        duration: 0,
        isProcessing: false,
      };
      
      setCurrentRecording(recording);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const finalRecording: VoiceRecording = {
          ...recording,
          blob,
          duration,
        };
        
        setRecordings(prev => [...prev, finalRecording]);
        setCurrentRecording(null);
      };
      
      mediaRecorder.start();
      startAudioLevelMonitoring();
      startDurationTracking();
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to access microphone');
    }
  }, [duration, startAudioLevelMonitoring, startDurationTracking]);
  
  // Stop recording
  const stopRecording = useCallback(async (): Promise<VoiceRecording | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !currentRecording) {
        resolve(null);
        return;
      }
      
      const mediaRecorder = mediaRecorderRef.current;
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const finalRecording: VoiceRecording = {
          ...currentRecording,
          blob,
          duration,
        };
        
        setRecordings(prev => [...prev, finalRecording]);
        setCurrentRecording(null);
        resolve(finalRecording);
      };
      
      mediaRecorder.stop();
      
      // Clean up
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      stopAudioLevelMonitoring();
      stopDurationTracking();
    });
  }, [currentRecording, duration, stopAudioLevelMonitoring, stopDurationTracking]);
  
  // Delete recording
  const deleteRecording = useCallback((id: string) => {
    setRecordings(prev => prev.filter(recording => recording.id !== id));
  }, []);
  
  // Play recording
  const playRecording = useCallback(async (id: string) => {
    const recording = recordings.find(r => r.id === id);
    if (!recording) return;
    
    try {
      const audio = new Audio(URL.createObjectURL(recording.blob));
      await audio.play();
    } catch (error) {
      console.error('Failed to play recording:', error);
      setError('Failed to play recording');
    }
  }, [recordings]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      stopAudioLevelMonitoring();
      stopDurationTracking();
    };
  }, [stopAudioLevelMonitoring, stopDurationTracking]);
  
  return {
    // State
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    confidence,
    error,
    audioLevel,
    duration,
    
    // Actions
    startListening,
    stopListening,
    resetTranscript,
    
    // Recording
    recordings,
    currentRecording,
    startRecording,
    stopRecording,
    deleteRecording,
    playRecording,
  };
};

// Hook for text-to-speech
export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const isSupported = 'speechSynthesis' in window;
  
  // Load voices
  useEffect(() => {
    if (!isSupported) return;
    
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Set default voice
      if (!selectedVoice && availableVoices.length > 0) {
        const defaultVoice = availableVoices.find(voice => voice.default) || availableVoices[0];
        setSelectedVoice(defaultVoice);
      }
    };
    
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported, selectedVoice]);
  
  const speak = useCallback((text: string, options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice;
  }) => {
    if (!isSupported || !text.trim()) return;
    
    // Stop any current speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    
    // Set options
    utterance.rate = options?.rate || 1;
    utterance.pitch = options?.pitch || 1;
    utterance.volume = options?.volume || 1;
    utterance.voice = options?.voice || selectedVoice;
    
    // Event handlers
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    speechSynthesis.speak(utterance);
  }, [isSupported, selectedVoice]);
  
  const stop = useCallback(() => {
    if (isSupported) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);
  
  const pause = useCallback(() => {
    if (isSupported) {
      speechSynthesis.pause();
    }
  }, [isSupported]);
  
  const resume = useCallback(() => {
    if (isSupported) {
      speechSynthesis.resume();
    }
  }, [isSupported]);
  
  return {
    isSupported,
    isSpeaking,
    voices,
    selectedVoice,
    setSelectedVoice,
    speak,
    stop,
    pause,
    resume,
  };
};