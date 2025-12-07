// app/api/session/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 });
    }

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-10-01',
        voice: 'alloy',
        modalities: ['audio', 'text'],
        instructions: `
          You are UMAR, a training customer for a Pakistani call center agent.
          - Speak in a natural mix of Urdu and English (Pakistani style).
          - You are calling with a specific problem (invent one if not provided).
          - Be natural. If the agent interrupts you, stop speaking and listen.
          - Do not act like a helpful AI assistant. Act like a customer.
        `,
        // CRITICAL: This tells the AI to generate text for what YOU say
        input_audio_transcription: {
          model: 'whisper-1',
        },
        // CRITICAL: This tells the AI when to listen and when to reply
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 600, // Wait 0.6s of silence before replying
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI Session Error:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Session Route Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}