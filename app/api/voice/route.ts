import { NextRequest, NextResponse } from 'next/server';
import { Scenario } from '@/lib/scenarios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  contentRoman?: string;
  timestamp: Date;
}

export async function POST(request: NextRequest) {
  try {
    const { action, audio, text, isFirst, scenario, conversationHistory } = await request.json();

    const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;

    // OpenAI key is still needed for chat/romanize actions
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // ===== TRANSCRIBE ACTION (OpenAI Whisper) =====
    // Using OpenAI Whisper for reliable speech-to-text
    // Supports Urdu and many other languages
    if (action === 'transcribe' && audio) {
      try {
        const audioBuffer = Buffer.from(audio, 'base64');

        // Create form data for OpenAI Whisper API
        const formData = new FormData();
        const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('model', 'whisper-1');
        formData.append('language', 'ur'); // Urdu language hint

        console.log('Sending audio to Whisper API, size:', audioBuffer.length, 'bytes');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Whisper API error:', response.status, errorText);
          throw new Error(`Transcription failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('Whisper transcription result:', data.text);

        return NextResponse.json({ text: data.text || '' });
      } catch (error) {
        console.error('Transcription error:', error);
        return NextResponse.json(
          { error: 'Transcription failed' },
          { status: 500 }
        );
      }
    }
    
    // ===== ROMANIZE ACTION =====
    if (action === 'romanize' && text) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You convert Urdu text (in Arabic script) to Roman Urdu (Urdu written in English alphabet). Only output the romanized text, nothing else. Example: "مجھے مسئلہ ہے" → "Mujhe masla hai"'
              },
              {
                role: 'user',
                content: text
              }
            ],
            temperature: 0.3,
            max_tokens: 200,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Romanization failed');
        }
        
        const data = await response.json();
        const roman = data.choices[0].message.content.trim();
        
        return NextResponse.json({ roman });
      } catch (error) {
        console.error('Romanization error:', error);
        return NextResponse.json({ roman: '' });
      }
    }
    
    // ===== CHAT ACTION =====
    if (action === 'chat') {
      try {
        const messages: Message[] = conversationHistory || [];

        // Build conversation history for context
        const historyText = messages
          .map(msg => `${msg.role === 'user' ? 'AGENT' : 'CUSTOMER'}: ${msg.content}`)
          .join('\n');

        // Count exchanges to track conversation progress
        const exchangeCount = messages.filter(m => m.role === 'user').length;

        let systemPrompt = '';
        let userPrompt = '';

        // Core conversation behavior rules (applies to all messages)
        const conversationRules = `

CONVERSATION STYLE - THIS IS CRITICAL:
1. Keep responses SHORT and natural (1-2 sentences typically, max 3 if explaining something)
2. Talk like a REAL person on a phone call, not a script
3. Use natural fillers occasionally: "ہاں...", "دیکھیں...", "اچھا..."
4. React to what the agent JUST said - don't repeat your whole story
5. One thought per response - don't pile multiple topics together
6. If asking a question, just ask ONE question at a time
7. Show emotion through tone, not long explanations

WHAT MAKES IT FEEL REAL:
- Interrupt yourself sometimes: "میرا bill... یعنی وہ جو آیا ہے..."
- React with short acknowledgments: "ہاں ٹھیک ہے", "اچھا", "پھر؟"
- Express confusion briefly: "مجھے سمجھ نہیں آیا"
- Show impatience naturally: "ہاں ہاں، پھر؟" or "اور؟"

ADAPTING TO THE AGENT:
- If agent is helpful and empathetic → warm up, be cooperative
- If agent is robotic/scripted → show slight annoyance
- If agent asks good questions → answer willingly
- If agent repeats themselves → "یہ تو آپ نے بتایا، آگے بتائیں"
- If agent is rude → react accordingly (hurt/angry depending on persona)
- If agent solves something → acknowledge it naturally`;

        // First message from AI (starting the roleplay)
        if (isFirst) {
          systemPrompt = scenario.systemPrompt + conversationRules + `

FIRST MESSAGE INSTRUCTIONS:
- Just greet and state your issue briefly (2-3 short sentences max)
- Don't explain everything upfront - let the conversation unfold
- Example length: "السلام علیکم، میرا نام احمد ہے، میں اپنے bill کے بارے میں call کر رہا ہوں۔ بہت زیادہ آیا ہے۔"`;

          userPrompt = 'Start the call. Be brief and natural - just greet and state your basic issue.';
        } else {
          // Calculate conversation state
          const isEarlyCall = exchangeCount < 3;
          const isMidCall = exchangeCount >= 3 && exchangeCount < 7;
          const isLongCall = exchangeCount >= 7;

          systemPrompt = scenario.systemPrompt + conversationRules + `

CONVERSATION SO FAR (${exchangeCount} exchanges):
${historyText}

CURRENT CONVERSATION PHASE:
${isEarlyCall ? '- EARLY: Still explaining issue, asking questions, building rapport' : ''}
${isMidCall ? '- MIDDLE: Working towards resolution, patience may vary based on agent helpfulness' : ''}
${isLongCall ? '- EXTENDED: Either close to resolution OR losing patience - time to wrap up naturally' : ''}

WHEN TO END THE CALL (add [END_CALL] at the end):

POSITIVE ENDINGS:
- Agent solved the problem → "بہت شکریہ، مسئلہ حل ہو گیا" [END_CALL]
- Got a satisfactory answer → "اچھا ٹھیک ہے، شکریہ آپ کا" [END_CALL]
- Received reference number/promise → "ٹھیک ہے، میں انتظار کرتا ہوں" [END_CALL]
- Agent was very helpful → express genuine thanks and end [END_CALL]

NEUTRAL ENDINGS:
- Need to think about it → "میں سوچ کر بتاتا ہوں، شکریہ" [END_CALL]
- Will try suggested solution → "اچھا میں try کرتا ہوں، شکریہ" [END_CALL]
- Agreed to visit service center → "ٹھیک ہے میں آ جاتا ہوں" [END_CALL]

FRUSTRATED ENDINGS (after 5+ exchanges with no progress):
- Same answers repeated → "آپ وہی بات کر رہے ہیں، میں کہیں اور call کرتا ہوں" [END_CALL]
- Agent unhelpful → "شکریہ، میں supervisor سے بات کروں گا" [END_CALL]
- Giving up for now → "ٹھیک ہے بعد میں call کرتا ہوں" [END_CALL]
- Very frustrated → "میں complaint کروں گا" [END_CALL]

IMPORTANT:
- Don't end abruptly without a natural closing phrase
- Don't drag on if the issue is resolved or clearly won't be resolved
- If conversation exceeds 8-10 exchanges, seriously consider wrapping up
- Trust your judgment on when the conversation has run its course`;

          userPrompt = `Agent's response: "${text}"

Reply naturally (1-2 sentences). If it's time to end, include [END_CALL] at the end.`;
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: userPrompt
              }
            ],
            temperature: 0.9, // Higher for more natural variation
            max_tokens: 100, // Reduced to encourage shorter, natural responses
          }),
        });
        
        if (!response.ok) {
          throw new Error('Chat completion failed');
        }
        
        const data = await response.json();
        let aiResponse = data.choices[0].message.content.trim();
        
        // Check if AI wants to end the call
        const shouldEnd = aiResponse.includes('[END_CALL]');
        aiResponse = aiResponse.replace('[END_CALL]', '').trim();
        
        // Get romanized version
        const romanResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Convert Urdu text to Roman Urdu. Only output the romanized text.'
              },
              {
                role: 'user',
                content: aiResponse
              }
            ],
            temperature: 0.3,
            max_tokens: 200,
          }),
        });
        
        let roman = '';
        if (romanResponse.ok) {
          const romanData = await romanResponse.json();
          roman = romanData.choices[0].message.content.trim();
        }
        
        return NextResponse.json({ 
          response: aiResponse,
          roman: roman,
          shouldEnd: shouldEnd
        });
      } catch (error) {
        console.error('Chat error:', error);
        return NextResponse.json(
          { error: 'Chat failed' },
          { status: 500 }
        );
      }
    }
    
    // ===== SPEAK ACTION (ElevenLabs) =====
    // Configured for Urdu (Arabic script) text-to-speech
    // Input text MUST be in Arabic Urdu script for proper pronunciation
    if (action === 'speak' && text) {
      if (!elevenlabsApiKey) {
        console.error('ElevenLabs API key not configured');
        return NextResponse.json(
          { error: 'ElevenLabs API key not configured' },
          { status: 500 }
        );
      }

      try {
        // ElevenLabs voice ID - using "Rachel" voice which works well for multilingual
        // You can change this to any ElevenLabs voice ID
        const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

        console.log('Calling ElevenLabs TTS for text:', text.substring(0, 50) + '...');

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenlabsApiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('ElevenLabs error:', response.status, errorText);
          throw new Error(`Text-to-speech failed: ${response.status} - ${errorText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('ElevenLabs returned audio, size:', audioBuffer.byteLength, 'bytes');

        if (audioBuffer.byteLength === 0) {
          throw new Error('ElevenLabs returned empty audio');
        }

        const base64Audio = Buffer.from(audioBuffer).toString('base64');

        return NextResponse.json({ audio: base64Audio });
      } catch (error) {
        console.error('TTS error:', error);
        return NextResponse.json(
          { error: 'Text-to-speech failed' },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'UMAR Voice API is running',
    language: 'Urdu (Arabic script)',
    endpoints: {
      transcribe: 'Speech to text - Powered by OpenAI Whisper (language: ur)',
      romanize: 'Arabic Urdu to Roman Urdu - Powered by OpenAI GPT-4o-mini',
      chat: 'AI customer response in Arabic Urdu - Powered by OpenAI GPT-4o',
      speak: 'Text to speech - Powered by ElevenLabs (eleven_multilingual_v2)',
    },
    requiredEnvVars: [
      'NEXT_PUBLIC_OPENAI_API_KEY',
      'ELEVENLABS_API_KEY',
      'ELEVENLABS_VOICE_ID (optional)',
    ],
    notes: [
      'STT uses OpenAI Whisper for reliable transcription',
      'TTS uses ElevenLabs multilingual model for natural speech',
      'Roman Urdu is generated separately for display purposes only',
    ],
  });
}