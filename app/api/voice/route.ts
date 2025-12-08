import { NextRequest, NextResponse } from 'next/server';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  contentRoman?: string;
  timestamp: Date;
}

export async function POST(request: NextRequest) {
  try {
    const { action, text, isFirst, scenario, conversationHistory } = await request.json();

    const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!openaiApiKey) {
      console.error('OpenAI API key not found in environment');
      return NextResponse.json(
        { error: 'OpenAI API key not configured', details: 'API key missing from environment' },
        { status: 500 }
      );
    }

    // ===== ROMANIZE ACTION (Standalone) =====
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

        if (!response.ok) throw new Error('Romanization failed');
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
        if (!scenario || !scenario.systemPrompt) {
          return NextResponse.json({ error: 'Invalid scenario' }, { status: 400 });
        }

        const messages: Message[] = conversationHistory || [];
        const historyText = messages
          .map(msg => `${msg.role === 'user' ? 'AGENT' : 'CUSTOMER'}: ${msg.content}`)
          .join('\n');
        const exchangeCount = messages.filter(m => m.role === 'user').length;

        let systemPrompt = '';
        let userPrompt = '';

        // UPDATED RULES FOR NATURAL PAKISTANI URDU
        const conversationRules = `
CRITICAL INSTRUCTIONS - SPEAK LIKE A REAL PAKISTANI:
1. **NO TEXTBOOK URDU**: Do not use "Kitaabi Urdu" (e.g., avoid "Bara-e-meherbani", "Daryaft", "Masool"). 
2. **USE CODE-SWITCHING**: Mix English words for technical/common terms just like normal Pakistanis do.
   - Say "Bill" instead of "Wajib-ul-ada raqam"
   - Say "Package" instead of "Mansuba"
   - Say "Internet signal" instead of "Internet ke ishaaray"
   - Say "Reset" instead of "Dobara shuru"
   - Say "Router" instead of "Aala"
3. **TONE**: Be natural, slightly informal, and emotional.
4. **LENGTH**: Keep responses SHORT (1-2 sentences max). People on calls don't give speeches.

EXAMPLES OF NATURAL SPEECH:
- ❌ "Kya aap meri madad kar sakte hain?" (Too formal)
- ✅ "Bhai, mera masla hal karein please." (Natural)
- ❌ "Internet ki raftaar bohat sust hai." (Too formal)
- ✅ "Internet ki speed bohat slow aa rahi hai subah se." (Natural)
`;

        if (isFirst) {
          systemPrompt = scenario.systemPrompt + conversationRules + `
FIRST MESSAGE:
- Greet simply (Salam/Hello).
- State your problem in 1 simple sentence.
- Sound like a normal person calling a helpline.
- Example: "Salam, mera internet nahi chal raha, subah se red light aa rahi hai router pe."
`;
          userPrompt = 'Start the call naturally.';
        } else {
          systemPrompt = scenario.systemPrompt + conversationRules + `
CONVERSATION SO FAR (${exchangeCount} exchanges):
${historyText}

HOW TO END THE CALL (Explicitly state you are leaving):
If you want to end the call (either happy or angry), you MUST:
1. Say clearly that you are hanging up.
2. THEN append [END_CALL].

Examples of Ending:
- Happy: "Chalo theek hai, shukriya. Allah Hafiz." [END_CALL]
- Neutral: "Acha main check karta hoon, phir call karunga." [END_CALL]
- Angry: "Aap meri baat nahi samajh rahay, main kisi aur se baat kar loonga. Phone rakh raha hoon." [END_CALL]

Do NOT just put [END_CALL] without a closing sentence.
`;
          userPrompt = `Agent just said: "${text}". Reply naturally.`;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.9, 
            max_tokens: 150,
          }),
        });

        if (!response.ok) throw new Error(`Chat completion failed: ${response.status}`);
        const data = await response.json();
        let aiResponse = data.choices[0].message.content.trim();

        const shouldEnd = aiResponse.includes('[END_CALL]');
        aiResponse = aiResponse.replace('[END_CALL]', '').trim();

        // Get Roman Urdu safely
        let roman = '';
        try {
           const romanRes = await fetch('https://api.openai.com/v1/chat/completions', {
             method: 'POST',
             headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
             body: JSON.stringify({
               model: 'gpt-4o-mini',
               messages: [
                 { role: 'system', content: 'Convert Urdu to Roman Urdu. Output ONLY text.' },
                 { role: 'user', content: aiResponse }
               ]
             })
           });
           if(romanRes.ok) {
             const rData = await romanRes.json();
             roman = rData.choices[0].message.content.trim();
           }
        } catch (e) {
          console.warn('Romanization failed');
        }

        return NextResponse.json({
          response: aiResponse,
          roman: roman,
          shouldEnd: shouldEnd
        });
      } catch (error) {
        console.error('Chat error:', error);
        return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
      }
    }

    // ===== SPEAK ACTION =====
    if (action === 'speak' && text) {
      if (!elevenlabsApiKey) return NextResponse.json({ error: 'No TTS Key' }, { status: 500 });

      const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
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
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        }),
      });

      if (!response.ok) throw new Error('TTS failed');
      const arrayBuffer = await response.arrayBuffer();
      return NextResponse.json({ audio: Buffer.from(arrayBuffer).toString('base64') });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'UMAR Voice API Running' });
}
