'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { getRandomScenario, Scenario } from '@/lib/scenarios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  contentRoman?: string;
  timestamp: Date;
}

type ConversationStage = 'intro' | 'scenario-announcement' | 'roleplay';
type VoiceStatus = 'listening' | 'speaking' | 'processing' | 'ai-responding' | 'idle';

export default function ConversationPage() {
  const router = useRouter();
  
  // Core state
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationStage, setConversationStage] = useState<ConversationStage>('intro');
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  
  // Voice state
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Display preferences
  const [urduDisplayMode, setUrduDisplayMode] = useState<'both' | 'arabic' | 'roman'>('both');
  
  // Session tracking
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  
  // Refs - IMPORTANT: Use refs for values checked in animation frames
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  
  // CRITICAL: These refs mirror state for use in requestAnimationFrame
  // React state is async, but refs are synchronous
  const isMicActiveRef = useRef(false);
  const isMutedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const vadRunningRef = useRef(false);
  
  // Messages ref for use in callbacks
  const messagesRef = useRef<Message[]>([]);
  const conversationStageRef = useRef<ConversationStage>('intro');
  const currentScenarioRef = useRef<Scenario | null>(null);

  // Sync state to refs
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  
  useEffect(() => {
    conversationStageRef.current = conversationStage;
  }, [conversationStage]);
  
  useEffect(() => {
    currentScenarioRef.current = currentScenario;
  }, [currentScenario]);

  // Start session
  const startSession = async () => {
    console.log('Starting session...');
    setIsConnected(true);
    setSessionStartTime(new Date());
    setConversationStage('intro');
    
    // Select random scenario
    const scenario = getRandomScenario();
    setCurrentScenario(scenario);
    currentScenarioRef.current = scenario;
    
    // UMAR introduces itself
    const introMsg: Message = {
      role: 'assistant',
      content: 'السلام علیکم! میں UMAR ہوں، آپ کا AI تربیتی معاون۔ میں مختلف کسٹمرز کا کردار ادا کروں گا تاکہ آپ اپنی مہارت بہتر بنا سکیں۔ کیا آپ تیار ہیں؟',
      contentRoman: 'Assalam-o-Alaikum! Main UMAR hoon, aap ka AI training assistant. Main mukhtalif customers ka kirdar ada karunga taake aap apni maharat behtar bana sakein. Kya aap tayyar hain?',
      timestamp: new Date()
    };
    
    setMessages([introMsg]);
    messagesRef.current = [introMsg];
    
    await speakText(introMsg.content);
    
    // Start continuous listening AFTER TTS finishes
    await startContinuousListening();
  };

  // Start continuous listening with VAD
  const startContinuousListening = async () => {
    console.log('Requesting microphone access...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('Microphone access granted!');
      streamRef.current = stream;

      // Verify microphone stream is active
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.error('No audio tracks found in stream');
        alert('No audio tracks found. Please check your microphone.');
        return;
      }
      console.log('Audio track:', audioTracks[0].label, 'enabled:', audioTracks[0].enabled, 'muted:', audioTracks[0].muted);
      
      // Set up audio context for voice detection
      audioContextRef.current = new AudioContext();

      // CRITICAL: Resume AudioContext - required by modern browsers
      // AudioContext starts in "suspended" state and must be resumed after user interaction
      if (audioContextRef.current.state === 'suspended') {
        console.log('AudioContext is suspended, resuming...');
        await audioContextRef.current.resume();
        console.log('AudioContext resumed, state:', audioContextRef.current.state);
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);
      
      // Set up media recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size, 'bytes, isRecording:', isRecordingRef.current);
        if (event.data.size > 0 && isRecordingRef.current) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped, chunks:', audioChunksRef.current.length);
        if (audioChunksRef.current.length > 0) {
          await processRecording();
        }
      };
      
      // CRITICAL: Set refs BEFORE starting VAD
      isMicActiveRef.current = true;
      isMutedRef.current = false;
      isProcessingRef.current = false;
      
      // Then update state for UI
      setIsMicActive(true);
      setVoiceStatus('listening');
      
      console.log('Starting voice activity detection...');
      console.log('Ref values - isMicActive:', isMicActiveRef.current, 'isMuted:', isMutedRef.current);
      
      // Start voice activity detection
      detectVoiceActivity();
      
    } catch (error) {
      console.error('Microphone access error:', error);
      alert('Could not access microphone. Please allow microphone access and try again.');
    }
  };

  // Voice Activity Detection
  const detectVoiceActivity = () => {
    if (!analyserRef.current || !mediaRecorderRef.current) {
      console.log('VAD: Missing analyser or mediaRecorder');
      return;
    }
    
    if (vadRunningRef.current) {
      console.log('VAD already running');
      return;
    }
    
    vadRunningRef.current = true;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let frameCount = 0;
    let initialLogCount = 0; // Log more frequently at start for debugging

    const checkAudio = () => {
      // Use REFS not state - this is critical!
      if (!isMicActiveRef.current) {
        console.log('Mic not active, stopping VAD');
        vadRunningRef.current = false;
        return;
      }
      
      if (isMutedRef.current || isProcessingRef.current) {
        requestAnimationFrame(checkAudio);
        return;
      }
      
      if (!analyserRef.current) {
        requestAnimationFrame(checkAudio);
        return;
      }
      
      analyserRef.current.getByteTimeDomainData(dataArray);
      
      // Calculate volume level (RMS)
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = (dataArray[i] - 128) / 128;
        sum += value * value;
      }
      const volume = Math.sqrt(sum / bufferLength);

      // Voice detected threshold - adjust if needed (lower = more sensitive)
      const VOICE_THRESHOLD = 0.01;

      // Log for debugging - more frequent at start, then every ~1 second
      frameCount++;
      const shouldLog = (initialLogCount < 5 && frameCount % 15 === 0) || frameCount % 60 === 0;
      if (shouldLog) {
        console.log('VAD - Volume:', volume.toFixed(4), 'Recording:', isRecordingRef.current, 'Threshold:', VOICE_THRESHOLD);
        if (initialLogCount < 5 && frameCount % 15 === 0) initialLogCount++;
      }
      
      if (volume > VOICE_THRESHOLD) {
        // Clear silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        
        // Start recording if not already
        if (!isRecordingRef.current && mediaRecorderRef.current?.state === 'inactive') {
          console.log('Voice detected! Starting recording...');
          audioChunksRef.current = [];
          mediaRecorderRef.current.start(100); // Collect data every 100ms
          isRecordingRef.current = true;
          setVoiceStatus('speaking');
        }
      } else {
        // Silence detected
        if (isRecordingRef.current) {
          // Start silence timer (1.5 seconds)
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              console.log('Silence timeout - stopping recording');
              if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
                isRecordingRef.current = false;
                setVoiceStatus('processing');
              }
              silenceTimerRef.current = null;
            }, 1500);
          }
        }
      }
      
      requestAnimationFrame(checkAudio);
    };
    
    checkAudio();
  };

  // Process recorded audio
  const processRecording = async () => {
    if (audioChunksRef.current.length === 0) {
      console.log('No audio chunks to process');
      setVoiceStatus('listening');
      return;
    }
    
    console.log('Processing recording with', audioChunksRef.current.length, 'chunks');
    
    isProcessingRef.current = true;
    setIsProcessing(true);
    setVoiceStatus('processing');
    
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];
      
      console.log('Audio blob size:', audioBlob.size, 'bytes');
      
      // Transcribe
      const transcription = await transcribeAudio(audioBlob);
      
      console.log('Transcription result:', transcription);
      
      if (!transcription || transcription.trim().length === 0) {
        console.log('Empty transcription, resuming listening');
        setVoiceStatus('listening');
        isProcessingRef.current = false;
        setIsProcessing(false);
        return;
      }
      
      // Get romanized version
      const romanized = await getRomanizedUrdu(transcription);
      
      // Add user message
      const userMsg: Message = {
        role: 'user',
        content: transcription,
        contentRoman: romanized,
        timestamp: new Date()
      };
      
      setMessages(prev => {
        const newMessages = [...prev, userMsg];
        messagesRef.current = newMessages;
        return newMessages;
      });
      
      // Handle based on conversation stage
      const stage = conversationStageRef.current;
      console.log('Current stage:', stage);
      
      if (stage === 'intro') {
        await handleIntroResponse(transcription);
      } else if (stage === 'scenario-announcement') {
        await handleScenarioResponse(transcription);
      } else {
        await handleRoleplayResponse(transcription);
      }
      
    } catch (error) {
      console.error('Processing error:', error);
      setVoiceStatus('listening');
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  // Handle intro stage response
  const handleIntroResponse = async (userText: string) => {
    const lowerText = userText.toLowerCase();
    
    // Check if user said yes/ready
    if (lowerText.includes('yes') || lowerText.includes('ہاں') || lowerText.includes('han') || 
        lowerText.includes('تیار') || lowerText.includes('tayyar') || lowerText.includes('ready') ||
        lowerText.includes('haan') || lowerText.includes('ji') || lowerText.includes('جی')) {
      
      setConversationStage('scenario-announcement');
      conversationStageRef.current = 'scenario-announcement';
      
      const scenario = currentScenarioRef.current;
      const scenarioMsg: Message = {
        role: 'assistant',
        content: `بہت اچھا! میں اب ${scenario?.nameUrdu} کا کردار ادا کروں گا۔ ${scenario?.descriptionUrdu}۔ آئیے شروع کریں۔`,
        contentRoman: `Bohat acha! Main ab ${scenario?.name} ka kirdar ada karunga. ${scenario?.description}. Aiye shuru karein.`,
        timestamp: new Date()
      };
      
      setMessages(prev => {
        const newMessages = [...prev, scenarioMsg];
        messagesRef.current = newMessages;
        return newMessages;
      });
      
      await speakText(scenarioMsg.content);
      
      // Automatically move to roleplay after announcement
      setTimeout(() => {
        startRoleplay();
      }, 2000);
      
    } else {
      const clarifyMsg: Message = {
        role: 'assistant',
        content: 'کوئی بات نہیں۔ جب آپ تیار ہوں تو "ہاں" یا "تیار ہوں" کہیں۔',
        contentRoman: 'Koi baat nahin. Jab aap tayyar hon to "haan" ya "tayyar hoon" kahein.',
        timestamp: new Date()
      };
      
      setMessages(prev => {
        const newMessages = [...prev, clarifyMsg];
        messagesRef.current = newMessages;
        return newMessages;
      });
      
      await speakText(clarifyMsg.content);
      setVoiceStatus('listening');
    }
  };

  // Handle scenario announcement response
  const handleScenarioResponse = async (_userText: string) => {
    // User acknowledged, start roleplay
    await startRoleplay();
  };

  // Start roleplay
  const startRoleplay = async () => {
    setConversationStage('roleplay');
    conversationStageRef.current = 'roleplay';
    
    // Get first customer message from scenario
    const firstMsg = await getAIResponse('', true);
    
    const aiMsg: Message = {
      role: 'assistant',
      content: firstMsg.text,
      contentRoman: firstMsg.roman,
      timestamp: new Date()
    };
    
    setMessages(prev => {
      const newMessages = [...prev, aiMsg];
      messagesRef.current = newMessages;
      return newMessages;
    });
    
    await speakText(aiMsg.content);
    setVoiceStatus('listening');
  };

  // Handle roleplay response
  const handleRoleplayResponse = async (userText: string) => {
    setVoiceStatus('ai-responding');
    
    // Get AI response
    const aiResponse = await getAIResponse(userText, false);
    
    // Check if call should end naturally
    if (aiResponse.shouldEnd) {
      const endMsg: Message = {
        role: 'assistant',
        content: aiResponse.text,
        contentRoman: aiResponse.roman,
        timestamp: new Date()
      };
      
      setMessages(prev => {
        const newMessages = [...prev, endMsg];
        messagesRef.current = newMessages;
        return newMessages;
      });
      
      await speakText(endMsg.content);
      
      // End call and go to evaluation
      setTimeout(() => {
        endSession(true);
      }, 2000);
      return;
    }
    
    const aiMsg: Message = {
      role: 'assistant',
      content: aiResponse.text,
      contentRoman: aiResponse.roman,
      timestamp: new Date()
    };
    
    setMessages(prev => {
      const newMessages = [...prev, aiMsg];
      messagesRef.current = newMessages;
      return newMessages;
    });
    
    await speakText(aiMsg.content);
    setVoiceStatus('listening');
  };

  // Get AI response
  const getAIResponse = async (userText: string, isFirst: boolean): Promise<{ text: string; roman: string; shouldEnd: boolean }> => {
    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          text: userText,
          isFirst: isFirst,
          scenario: currentScenarioRef.current,
          conversationHistory: messagesRef.current
        }),
      });
      
      if (!response.ok) throw new Error('Chat failed');
      
      const data = await response.json();
      return {
        text: data.response,
        roman: data.roman || '',
        shouldEnd: data.shouldEnd || false
      };
    } catch (error) {
      console.error('AI response error:', error);
      return {
        text: 'معذرت، مجھے مسئلہ ہو رہا ہے۔',
        roman: 'Maazrat, mujhe masla ho raha hai.',
        shouldEnd: false
      };
    }
  };

  // Transcribe audio
  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      const base64Audio = await blobToBase64(audioBlob);
      
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transcribe',
          audio: base64Audio
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Transcription API error:', errorData);
        throw new Error('Transcription failed');
      }
      
      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  };

  // Get romanized Urdu
  const getRomanizedUrdu = async (urduText: string): Promise<string> => {
    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'romanize',
          text: urduText
        }),
      });
      
      if (!response.ok) throw new Error('Romanization failed');
      
      const data = await response.json();
      return data.roman;
    } catch (error) {
      console.error('Romanization error:', error);
      return '';
    }
  };

  // Speak text using TTS
  const speakText = async (text: string) => {
    if (isMutedRef.current) {
      console.log('TTS skipped - muted');
      return;
    }

    try {
      // Mute microphone while AI is speaking to prevent feedback
      isMutedRef.current = true;
      setIsMuted(true);

      console.log('Calling TTS API for:', text.substring(0, 50) + '...');

      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'speak',
          text: text
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('TTS API error:', response.status, errorData);
        throw new Error(`TTS failed: ${response.status}`);
      }
      
      const data = await response.json();

      if (!data.audio) {
        console.error('TTS returned no audio data');
        throw new Error('No audio data returned');
      }

      console.log('TTS received audio, creating blob...');

      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      console.log('Playing audio, blob size:', audioBlob.size, 'bytes');

      return new Promise<void>((resolve) => {
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.onended = () => {
            console.log('Audio playback ended');
            // Unmute mic after AI finishes speaking
            isMutedRef.current = false;
            setIsMuted(false);
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audioRef.current.onerror = (e) => {
            console.error('Audio playback error:', e);
            isMutedRef.current = false;
            setIsMuted(false);
            resolve();
          };
          audioRef.current.play().catch((e) => {
            console.error('Audio play() failed:', e);
            isMutedRef.current = false;
            setIsMuted(false);
            resolve();
          });
        } else {
          resolve();
        }
      });
    } catch (error) {
      console.error('TTS error:', error);
      isMutedRef.current = false;
      setIsMuted(false);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    const newMuted = !isMuted;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);
  };

  // End session
  const endSession = (natural: boolean = false) => {
    console.log('Ending session, natural:', natural);
    
    // Stop VAD
    isMicActiveRef.current = false;
    vadRunningRef.current = false;
    
    // Stop all recording
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    
    // Clear timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    setIsMicActive(false);
    setIsConnected(false);
    
    // Navigate to evaluation page with conversation data
    const duration = sessionStartTime 
      ? Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000)
      : 0;
    
    // Store conversation data in sessionStorage
    sessionStorage.setItem('umar_conversation', JSON.stringify({
      messages: messagesRef.current,
      scenario: currentScenarioRef.current,
      duration,
      endedNaturally: natural
    }));
    
    router.push('/evaluation');
  };

  // Convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Get status display
  const getStatusDisplay = () => {
    switch (voiceStatus) {
      case 'listening':
        return { icon: '🟢', text: 'Listening... Speak when ready' };
      case 'speaking':
        return { icon: '🔵', text: 'You\'re speaking...' };
      case 'processing':
        return { icon: '⏳', text: 'Processing your speech...' };
      case 'ai-responding':
        return { icon: '🤖', text: 'AI is responding...' };
      default:
        return { icon: '⚪', text: 'Ready' };
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMicActiveRef.current = false;
      vadRunningRef.current = false;
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const statusDisplay = getStatusDisplay();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <audio ref={audioRef} className="hidden" />
      
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-indigo-900">UMAR</h1>
              <p className="text-sm text-gray-600">
                {currentScenario ? currentScenario.name : 'AI Training Session'}
              </p>
            </div>
            {sessionStartTime && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Duration</p>
                <SessionTimer startTime={sessionStartTime} />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-2xl">
              <Phone className="w-24 h-24 text-indigo-600 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Start Training Session
              </h2>
              <p className="text-gray-600 mb-8">
                Begin your AI-powered customer service training
              </p>
              <button
                onClick={startSession}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg"
              >
                Start Conversation
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Transcript Panel */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Live Conversation</h3>
                <div className="flex gap-2">
                  <select
                    value={urduDisplayMode}
                    onChange={(e) => setUrduDisplayMode(e.target.value as 'both' | 'arabic' | 'roman')}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1"
                  >
                    <option value="both">عربی + Roman</option>
                    <option value="arabic">عربی Only</option>
                    <option value="roman">Roman Only</option>
                  </select>
                  <button
                    onClick={() => endSession(false)}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all"
                  >
                    <PhoneOff className="w-4 h-4" />
                    End Call
                  </button>
                </div>
              </div>
              
              {/* Status Bar */}
              <div className="mb-4 bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-sm font-medium text-gray-700">
                  <span className="mr-2">{statusDisplay.icon}</span>
                  {statusDisplay.text}
                </p>
              </div>
              
              {/* Messages */}
              <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm font-semibold mb-1">
                        {msg.role === 'user' ? 'You (Agent)' : 'Customer (AI)'}
                      </p>
                      
                      {urduDisplayMode === 'both' && (
                        <>
                          <p dir="rtl" className="mb-1">{msg.content}</p>
                          {msg.contentRoman && (
                            <p className="text-sm opacity-80">({msg.contentRoman})</p>
                          )}
                        </>
                      )}
                      
                      {urduDisplayMode === 'arabic' && (
                        <p dir="rtl">{msg.content}</p>
                      )}
                      
                      {urduDisplayMode === 'roman' && msg.contentRoman && (
                        <p>{msg.contentRoman}</p>
                      )}
                      
                      <p className="text-xs opacity-70 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls Panel */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Voice Controls</h3>
              
              <div className="flex flex-col items-center gap-6">
                {/* Status Indicator */}
                <div className={`w-32 h-32 rounded-full flex items-center justify-center ${
                  voiceStatus === 'speaking' ? 'bg-blue-100 animate-pulse' : 
                  voiceStatus === 'listening' ? 'bg-green-100' : 
                  voiceStatus === 'processing' ? 'bg-yellow-100 animate-pulse' :
                  voiceStatus === 'ai-responding' ? 'bg-purple-100 animate-pulse' :
                  'bg-gray-100'
                }`}>
                  {isMicActive ? (
                    <Mic className={`w-16 h-16 ${
                      voiceStatus === 'speaking' ? 'text-blue-600' :
                      voiceStatus === 'listening' ? 'text-green-600' :
                      voiceStatus === 'processing' ? 'text-yellow-600' :
                      voiceStatus === 'ai-responding' ? 'text-purple-600' :
                      'text-gray-600'
                    }`} />
                  ) : (
                    <MicOff className="w-16 h-16 text-gray-400" />
                  )}
                </div>
                
                {/* Mute Button */}
                <button
                  onClick={toggleMute}
                  disabled={!isConnected}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    isMuted
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  } disabled:bg-gray-100 disabled:text-gray-400`}
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-5 h-5" />
                      <span>Muted</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-5 h-5" />
                      <span>Audio On</span>
                    </>
                  )}
                </button>
                
                {/* Tips */}
                <div className="mt-8 pt-6 border-t border-gray-200 w-full">
                  <h4 className="font-semibold text-gray-900 mb-3">Tips:</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>✓ Speak naturally in Urdu</li>
                    <li>✓ Pause for 1.5s to submit</li>
                    <li>✓ Be polite & professional</li>
                    <li>✓ Listen carefully to customer</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Session Timer Component
function SessionTimer({ startTime }: { startTime: Date }) {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((new Date().getTime() - startTime.getTime()) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime]);
  
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  
  return (
    <p className="text-lg font-semibold text-indigo-900">
      {minutes}:{seconds.toString().padStart(2, '0')}
    </p>
  );
}