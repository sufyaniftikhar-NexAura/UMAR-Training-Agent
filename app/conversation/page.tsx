'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { getRandomScenario, Scenario } from '@/lib/scenarios';
import { SonioxClient } from '@soniox/speech-to-text-web';

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

  // Real-time transcription display
  const [partialTranscript, setPartialTranscript] = useState('');

  // Display preferences
  const [urduDisplayMode, setUrduDisplayMode] = useState<'both' | 'arabic' | 'roman'>('both');

  // Session tracking
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sonioxClientRef = useRef<SonioxClient | null>(null);

  // CRITICAL: These refs mirror state for use in callbacks
  const isMicActiveRef = useRef(false);
  const isMutedRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Messages ref for use in callbacks
  const messagesRef = useRef<Message[]>([]);
  const conversationStageRef = useRef<ConversationStage>('intro');
  const currentScenarioRef = useRef<Scenario | null>(null);

  // Accumulated transcript for endpoint detection
  const accumulatedTranscriptRef = useRef('');
  const endpointTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Initialize Soniox client
  const initializeSoniox = useCallback(async () => {
    console.log('Initializing Soniox WebSocket client...');

    try {
      const client = new SonioxClient({
        apiKey: async () => {
          const response = await fetch('/api/soniox-key');
          if (!response.ok) {
            throw new Error('Failed to fetch Soniox API key');
          }
          const data = await response.json();
          return data.apiKey;
        },
        onStarted: () => {
          console.log('Soniox transcription started');
          setVoiceStatus('listening');
        },
        onFinished: () => {
          console.log('Soniox transcription finished');
        },
        onError: (error) => {
          console.error('Soniox error:', error);
          // Try to recover by restarting if mic is still active
          if (isMicActiveRef.current && !isProcessingRef.current) {
            setTimeout(() => {
              if (sonioxClientRef.current && isMicActiveRef.current) {
                startSonioxTranscription();
              }
            }, 1000);
          }
        },
        onStateChange: (state) => {
          console.log('Soniox state changed:', state);
        },
      });

      sonioxClientRef.current = client;
      console.log('Soniox client initialized');
      return client;
    } catch (error) {
      console.error('Failed to initialize Soniox client:', error);
      throw error;
    }
  }, []);

  // Start Soniox transcription
  const startSonioxTranscription = useCallback(() => {
    if (!sonioxClientRef.current) {
      console.error('Soniox client not initialized');
      return;
    }

    if (isMutedRef.current || isProcessingRef.current) {
      console.log('Skipping Soniox start - muted:', isMutedRef.current, 'processing:', isProcessingRef.current);
      return;
    }

    console.log('Starting Soniox transcription...');
    accumulatedTranscriptRef.current = '';
    setPartialTranscript('');

    sonioxClientRef.current.start({
      model: 'stt-rt-preview',
      languageHints: ['ur', 'en'], // Urdu and English hints
      enableEndpointDetection: true, // Detect when user stops speaking
      onPartialResult: (result) => {
        // Process tokens to get transcript
        if (result.tokens && result.tokens.length > 0) {
          // Build transcript from tokens
          const finalTokens = result.tokens.filter(t => t.is_final);
          const partialTokens = result.tokens.filter(t => !t.is_final);

          // Update accumulated transcript with final tokens
          const finalText = finalTokens.map(t => t.text).join('');
          const partialText = partialTokens.map(t => t.text).join('');

          if (finalText) {
            accumulatedTranscriptRef.current += finalText;
          }

          // Display current transcript (accumulated + partial)
          const displayText = accumulatedTranscriptRef.current + partialText;
          setPartialTranscript(displayText);

          // Check for endpoint (user stopped speaking)
          const hasEndpoint = result.tokens.some(t => t.is_final && t.text === '');

          // Reset endpoint timer on new speech
          if (endpointTimerRef.current) {
            clearTimeout(endpointTimerRef.current);
            endpointTimerRef.current = null;
          }

          // If we have final tokens, start a silence timer
          if (finalTokens.length > 0 && accumulatedTranscriptRef.current.trim().length > 0) {
            endpointTimerRef.current = setTimeout(() => {
              // If we have accumulated transcript and no new speech, process it
              if (accumulatedTranscriptRef.current.trim().length > 0 && !isProcessingRef.current) {
                const transcript = accumulatedTranscriptRef.current.trim();
                console.log('Endpoint detected, processing transcript:', transcript);
                handleTranscriptComplete(transcript);
              }
            }, 1500); // 1.5 second silence threshold
          }
        }
      },
    });

    setVoiceStatus('listening');
  }, []);

  // Handle completed transcript
  const handleTranscriptComplete = async (transcript: string) => {
    if (!transcript || transcript.trim().length === 0) {
      console.log('Empty transcript, ignoring');
      return;
    }

    console.log('Processing complete transcript:', transcript);

    // Stop current transcription
    if (sonioxClientRef.current) {
      try {
        sonioxClientRef.current.cancel();
      } catch (e) {
        console.log('Error canceling Soniox:', e);
      }
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setVoiceStatus('processing');
    setPartialTranscript('');
    accumulatedTranscriptRef.current = '';

    try {
      // Get romanized version
      const romanized = await getRomanizedUrdu(transcript);

      // Add user message
      const userMsg: Message = {
        role: 'user',
        content: transcript,
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
        await handleIntroResponse(transcript);
      } else if (stage === 'scenario-announcement') {
        await handleScenarioResponse(transcript);
      } else {
        await handleRoleplayResponse(transcript);
      }

    } catch (error) {
      console.error('Processing error:', error);
      setVoiceStatus('listening');
      // Restart transcription
      if (isMicActiveRef.current && !isMutedRef.current) {
        startSonioxTranscription();
      }
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

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

    // Initialize Soniox client
    await initializeSoniox();

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

    // Start continuous listening with Soniox AFTER TTS finishes
    isMicActiveRef.current = true;
    isMutedRef.current = false;
    isProcessingRef.current = false;
    setIsMicActive(true);

    startSonioxTranscription();
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

      // Restart listening
      if (isMicActiveRef.current && !isMutedRef.current) {
        startSonioxTranscription();
      }
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

    // Restart listening
    if (isMicActiveRef.current && !isMutedRef.current) {
      startSonioxTranscription();
    }
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

    // Restart listening
    if (isMicActiveRef.current && !isMutedRef.current) {
      startSonioxTranscription();
    }
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
    // Cancel any ongoing Soniox transcription while speaking
    if (sonioxClientRef.current) {
      try {
        sonioxClientRef.current.cancel();
      } catch (e) {
        console.log('Error canceling Soniox for TTS:', e);
      }
    }

    // Mute microphone while AI is speaking to prevent feedback
    isMutedRef.current = true;
    setIsMuted(true);
    setVoiceStatus('ai-responding');

    try {
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

    if (newMuted) {
      // Stop Soniox when muting
      if (sonioxClientRef.current) {
        try {
          sonioxClientRef.current.cancel();
        } catch (e) {
          console.log('Error canceling Soniox on mute:', e);
        }
      }
      setPartialTranscript('');
      accumulatedTranscriptRef.current = '';
    } else {
      // Restart Soniox when unmuting
      if (isMicActiveRef.current && !isProcessingRef.current) {
        startSonioxTranscription();
      }
    }
  };

  // End session
  const endSession = (natural: boolean = false) => {
    console.log('Ending session, natural:', natural);

    // Stop Soniox
    isMicActiveRef.current = false;
    if (sonioxClientRef.current) {
      try {
        sonioxClientRef.current.cancel();
      } catch (e) {
        console.log('Error canceling Soniox on end:', e);
      }
      sonioxClientRef.current = null;
    }

    // Clear timers
    if (endpointTimerRef.current) {
      clearTimeout(endpointTimerRef.current);
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

      if (sonioxClientRef.current) {
        try {
          sonioxClientRef.current.cancel();
        } catch (e) {
          console.log('Cleanup: Error canceling Soniox:', e);
        }
      }

      if (endpointTimerRef.current) {
        clearTimeout(endpointTimerRef.current);
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

              {/* Real-time Transcription Preview */}
              {partialTranscript && (
                <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-sm text-indigo-600 font-medium mb-1">Real-time transcription:</p>
                  <p className="text-indigo-900" dir="auto">{partialTranscript}</p>
                </div>
              )}

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
