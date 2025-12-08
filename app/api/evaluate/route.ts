import { NextRequest, NextResponse } from 'next/server';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Scenario {
  id: string;
  name: string;
  evaluationFocus: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { messages, scenario, duration } = await request.json();

    const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      console.error('OpenAI API key not found');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      );
    }

    if (!scenario) {
      return NextResponse.json(
        { error: 'No scenario provided' },
        { status: 400 }
      );
    }

    console.log('Generating evaluation for:', {
      messageCount: messages.length,
      scenarioId: scenario.id,
      duration
    });

    // Build conversation transcript
    const transcript = messages
      .map((msg: Message) => `${msg.role === 'user' ? 'AGENT' : 'CUSTOMER'}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You are an expert evaluator for Pakistani call center agents. You will evaluate a training conversation where the AGENT (trainee) handled a CUSTOMER (AI) call.

Evaluate based on these categories (score 0-100 each):
1. Tone & Politeness - Professional, respectful language appropriate for Pakistani culture
2. Empathy - Understanding customer feelings, showing care
3. Call Structure - Proper greeting, problem identification, resolution flow, closing
4. Clarity - Clear explanations, avoiding jargon
5. Process Adherence - Following proper customer service procedures
6. Resolution - Effectively addressing the customer's issue

SCENARIO: ${scenario.name}
EVALUATION FOCUS: ${scenario.evaluationFocus?.join(', ') || 'General customer service skills'}

Respond ONLY with a valid JSON object in this exact format:
{
  "overallScore": <number 0-100>,
  "categories": {
    "tone": {"score": <number>, "feedback": "<english>", "feedbackUrdu": "<urdu>"},
    "empathy": {"score": <number>, "feedback": "<english>", "feedbackUrdu": "<urdu>"},
    "structure": {"score": <number>, "feedback": "<english>", "feedbackUrdu": "<urdu>"},
    "clarity": {"score": <number>, "feedback": "<english>", "feedbackUrdu": "<urdu>"},
    "processAdherence": {"score": <number>, "feedback": "<english>", "feedbackUrdu": "<urdu>"},
    "resolution": {"score": <number>, "feedback": "<english>", "feedbackUrdu": "<urdu>"}
  },
  "strengths": ["<english point 1>", "<english point 2>"],
  "strengthsUrdu": ["<urdu point 1>", "<urdu point 2>"],
  "improvements": ["<english point 1>", "<english point 2>"],
  "improvementsUrdu": ["<urdu point 1>", "<urdu point 2>"],
  "summaryEnglish": "<2-3 sentence summary>",
  "summaryUrdu": "<urdu summary>",
  "examples": {
    "good": [{"quote": "<agent quote>", "reason": "<why good>", "reasonUrdu": "<urdu>"}],
    "needsWork": [{"quote": "<agent quote>", "reason": "<why needs work>", "reasonUrdu": "<urdu>"}]
  }
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Evaluate this conversation:\n\n${transcript}` }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Evaluation API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Evaluation API failed', details: `OpenAI returned ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenAI response:', data);
      return NextResponse.json(
        { error: 'Invalid response from OpenAI' },
        { status: 500 }
      );
    }

    const evaluationContent = data.choices[0].message.content;

    let evaluation;
    try {
      evaluation = JSON.parse(evaluationContent);
    } catch (parseError) {
      console.error('Failed to parse evaluation JSON:', evaluationContent);
      return NextResponse.json(
        { error: 'Failed to parse evaluation response' },
        { status: 500 }
      );
    }

    // Calculate grade based on overall score
    const score = evaluation.overallScore;
    let grade: string;
    if (score >= 97) grade = 'A+';
    else if (score >= 93) grade = 'A';
    else if (score >= 90) grade = 'A-';
    else if (score >= 87) grade = 'B+';
    else if (score >= 83) grade = 'B';
    else if (score >= 80) grade = 'B-';
    else if (score >= 77) grade = 'C+';
    else if (score >= 73) grade = 'C';
    else if (score >= 70) grade = 'C-';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return NextResponse.json({
      ...evaluation,
      overallGrade: grade,
      messageCount: messages.length,
      conversationDuration: duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Evaluation error:', errorMessage, error);
    return NextResponse.json(
      { error: 'Evaluation failed', details: errorMessage },
      { status: 500 }
    );
  }
}
