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
    
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // ===== TRANSCRIBE ACTION =====
    if (action === 'transcribe' && audio) {
      try {
        const audioBuffer = Buffer.from(audio, 'base64');
        
        const formData = new FormData();
        const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('model', 'whisper-1');
        formData.append('language', 'ur');
        
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Transcription failed');
        }
        
        const data = await response.json();
        return NextResponse.json({ text: data.text });
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
            'Authorization': `Bearer ${apiKey}`,
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
        
        let systemPrompt = '';
        let userPrompt = '';
        
        // First message from AI (starting the roleplay)
        if (isFirst) {
          systemPrompt = scenario.systemPrompt + `

IMPORTANT: This is your FIRST message to the agent. Start the call naturally as a customer would:
- Greet them (السلام علیکم)
- Briefly state your issue
- Show your emotion (frustrated/confused/angry/calm based on your persona)
- Don't give away too much detail yet - let the agent ask questions

Keep it natural and realistic. Speak in Pakistani Urdu with natural English words mixed in.`;

          userPrompt = 'Start the customer call now. Remember this is your FIRST message as the customer calling SCO.';
        } else {
          // Continuing conversation
          systemPrompt = scenario.systemPrompt + `

PREVIOUS CONVERSATION:
${historyText}

CRITICAL INSTRUCTIONS:
1. Stay in character as the customer
2. Respond naturally to what the agent just said
3. React emotionally based on your persona and how the agent is treating you
4. Ask follow-up questions or raise concerns if the agent's response isn't satisfactory
5. If the issue is genuinely resolved and you're satisfied, you can naturally end the call
6. Speak in Pakistani Urdu with natural English words mixed in

ENDING THE CALL:
If the conversation has reached a natural conclusion (issue resolved, you're satisfied, or you want to escalate/leave):
- End your message with the phrase: [END_CALL]
- Say a natural goodbye like "ٹھیک ہے، شکریہ" or "میں بعد میں call کروں گا"

Examples of when to end:
- Issue is fully resolved and you're happy
- Agent promised a solution and gave you a reference number
- You're too frustrated and want to complain elsewhere
- Conversation is going in circles with no progress
- You accept you need to visit service center/escalate`;

          userPrompt = `The agent just said: "${text}"

Respond naturally as the customer. If the conversation should end, include [END_CALL] at the end of your response.`;
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
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
            temperature: 0.8,
            max_tokens: 200,
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
            'Authorization': `Bearer ${apiKey}`,
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
    
    // ===== SPEAK ACTION =====
    if (action === 'speak' && text) {
      try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            voice: 'alloy',
            input: text,
            speed: 1.0,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Text-to-speech failed');
        }
        
        const audioBuffer = await response.arrayBuffer();
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
    endpoints: {
      transcribe: 'Convert speech to text (Urdu)',
      romanize: 'Convert Arabic Urdu to Roman Urdu',
      chat: 'Get AI customer response',
      speak: 'Convert text to speech'
    }
  });
}