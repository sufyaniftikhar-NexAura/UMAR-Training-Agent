// lib/evaluation.ts

import { Scenario } from './scenarios';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface CategoryScore {
  score: number; // 0-100
  feedback: string;
  feedbackUrdu: string;
}

export interface EvaluationResult {
  overallScore: number; // 0-100
  overallGrade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  categories: {
    tone: CategoryScore;
    empathy: CategoryScore;
    structure: CategoryScore;
    clarity: CategoryScore;
    processAdherence: CategoryScore;
    resolution: CategoryScore;
  };
  strengths: string[];
  strengthsUrdu: string[];
  improvements: string[];
  improvementsUrdu: string[];
  examples: {
    good: Array<{ quote: string; reason: string; reasonUrdu: string }>;
    needsWork: Array<{ quote: string; reason: string; reasonUrdu: string }>;
  };
  summaryEnglish: string;
  summaryUrdu: string;
  timestamp: Date;
  conversationDuration: number; // in seconds
  messageCount: number;
}

export interface EvaluationRequest {
  conversation: Message[];
  scenario: Scenario;
  duration: number;
  apiKey: string;
}

/**
 * Generate a comprehensive evaluation of the agent's performance
 */
export async function generateEvaluation(
  request: EvaluationRequest
): Promise<EvaluationResult> {
  const { conversation, scenario, duration, apiKey } = request;

  // Build the evaluation prompt
  const evaluationPrompt = buildEvaluationPrompt(conversation, scenario);

  try {
    // Call OpenAI to generate evaluation
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
            content: evaluationPrompt.system,
          },
          {
            role: 'user',
            content: evaluationPrompt.user,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent evaluation
        response_format: { type: 'json_object' }, // Request JSON output
      }),
    });

    if (!response.ok) {
      throw new Error('Evaluation API call failed');
    }

    const data = await response.json();
    const evaluationJSON = JSON.parse(data.choices[0].message.content);

    // Transform API response into our EvaluationResult format
    const result: EvaluationResult = {
      overallScore: evaluationJSON.overallScore,
      overallGrade: calculateGrade(evaluationJSON.overallScore),
      categories: {
        tone: {
          score: evaluationJSON.categories.tone.score,
          feedback: evaluationJSON.categories.tone.feedback,
          feedbackUrdu: evaluationJSON.categories.tone.feedbackUrdu,
        },
        empathy: {
          score: evaluationJSON.categories.empathy.score,
          feedback: evaluationJSON.categories.empathy.feedback,
          feedbackUrdu: evaluationJSON.categories.empathy.feedbackUrdu,
        },
        structure: {
          score: evaluationJSON.categories.structure.score,
          feedback: evaluationJSON.categories.structure.feedback,
          feedbackUrdu: evaluationJSON.categories.structure.feedbackUrdu,
        },
        clarity: {
          score: evaluationJSON.categories.clarity.score,
          feedback: evaluationJSON.categories.clarity.feedback,
          feedbackUrdu: evaluationJSON.categories.clarity.feedbackUrdu,
        },
        processAdherence: {
          score: evaluationJSON.categories.processAdherence.score,
          feedback: evaluationJSON.categories.processAdherence.feedback,
          feedbackUrdu: evaluationJSON.categories.processAdherence.feedbackUrdu,
        },
        resolution: {
          score: evaluationJSON.categories.resolution.score,
          feedback: evaluationJSON.categories.resolution.feedback,
          feedbackUrdu: evaluationJSON.categories.resolution.feedbackUrdu,
        },
      },
      strengths: evaluationJSON.strengths,
      strengthsUrdu: evaluationJSON.strengthsUrdu,
      improvements: evaluationJSON.improvements,
      improvementsUrdu: evaluationJSON.improvementsUrdu,
      examples: evaluationJSON.examples,
      summaryEnglish: evaluationJSON.summaryEnglish,
      summaryUrdu: evaluationJSON.summaryUrdu,
      timestamp: new Date(),
      conversationDuration: duration,
      messageCount: conversation.length,
    };

    return result;
  } catch (error) {
    console.error('Evaluation generation error:', error);
    throw error;
  }
}

/**
 * Build the evaluation prompt for the AI
 */
function buildEvaluationPrompt(conversation: Message[], scenario: Scenario) {
  const conversationText = conversation
    .map(
      (msg) =>
        `${msg.role === 'user' ? 'AGENT' : 'CUSTOMER'}: ${msg.content}`
    )
    .join('\n\n');

  const system = `You are an expert customer service trainer and evaluator for SCO (Special Communications Organization) in Pakistan.

Your task is to evaluate the agent's performance in handling a customer call. You will analyze the conversation and provide detailed, constructive feedback.

EVALUATION CRITERIA:

1. **Tone & Politeness (0-100)**
   - Professional and respectful language
   - Appropriate formality level
   - Courteous expressions in Urdu
   - No rudeness or dismissiveness

2. **Empathy (0-100)**
   - Acknowledging customer emotions
   - Showing understanding and care
   - Using empathetic language
   - Not being robotic or cold

3. **Call Structure (0-100)**
   - Proper greeting and introduction
   - Clear problem identification
   - Logical flow of conversation
   - Appropriate closing

4. **Clarity (0-100)**
   - Clear and easy to understand explanations
   - No confusing jargon
   - Checking customer understanding
   - Concise responses

5. **Process Adherence (0-100)**
   - Following proper procedures
   - Asking relevant questions
   - Providing accurate information
   - Offering appropriate solutions

6. **Resolution (0-100)**
   - Effectively addressing the issue
   - Providing concrete solutions
   - Setting proper expectations
   - Ensuring customer satisfaction

SCENARIO CONTEXT:
${scenario.name} (${scenario.nameUrdu})
${scenario.description}

Evaluation Focus for this scenario:
${scenario.evaluationFocus.map((f, i) => `${i + 1}. ${f}`).join('\n')}

OUTPUT FORMAT:
You MUST respond with a valid JSON object in this exact structure:

{
  "overallScore": <number 0-100>,
  "categories": {
    "tone": {
      "score": <number 0-100>,
      "feedback": "<English feedback>",
      "feedbackUrdu": "<Urdu feedback>"
    },
    "empathy": { "score": <number>, "feedback": "<text>", "feedbackUrdu": "<text>" },
    "structure": { "score": <number>, "feedback": "<text>", "feedbackUrdu": "<text>" },
    "clarity": { "score": <number>, "feedback": "<text>", "feedbackUrdu": "<text>" },
    "processAdherence": { "score": <number>, "feedback": "<text>", "feedbackUrdu": "<text>" },
    "resolution": { "score": <number>, "feedback": "<text>", "feedbackUrdu": "<text>" }
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "strengthsUrdu": ["<Urdu strength 1>", "<Urdu strength 2>", "<Urdu strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "improvementsUrdu": ["<Urdu improvement 1>", "<Urdu improvement 2>", "<Urdu improvement 3>"],
  "examples": {
    "good": [
      {
        "quote": "<exact quote from agent>",
        "reason": "<why this was good>",
        "reasonUrdu": "<Urdu explanation>"
      }
    ],
    "needsWork": [
      {
        "quote": "<exact quote from agent>",
        "reason": "<why this needs improvement>",
        "reasonUrdu": "<Urdu explanation>"
      }
    ]
  },
  "summaryEnglish": "<2-3 sentence overall summary>",
  "summaryUrdu": "<2-3 sentence Urdu summary>"
}

Be specific, constructive, and fair. Provide actionable feedback that helps the agent improve.`;

  const user = `Please evaluate this customer service conversation:

CONVERSATION:
${conversationText}

Provide a comprehensive evaluation in the JSON format specified.`;

  return { system, user };
}

/**
 * Calculate letter grade from numerical score
 */
function calculateGrade(score: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 75) return 'C+';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get color for score visualization
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 80) return 'text-blue-600';
  if (score >= 70) return 'text-yellow-600';
  if (score >= 60) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Get background color for score
 */
export function getScoreBackgroundColor(score: number): string {
  if (score >= 90) return 'bg-green-100';
  if (score >= 80) return 'bg-blue-100';
  if (score >= 70) return 'bg-yellow-100';
  if (score >= 60) return 'bg-orange-100';
  return 'bg-red-100';
}

/**
 * Format duration in seconds to readable time
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get performance message based on overall score
 */
export function getPerformanceMessage(score: number): { english: string; urdu: string } {
  if (score >= 90) {
    return {
      english: 'Excellent performance! You handled this call professionally and effectively.',
      urdu: 'بہترین کارکردگی! آپ نے اس کال کو پیشہ ورانہ اور مؤثر طریقے سے ہینڈل کیا۔',
    };
  }
  if (score >= 80) {
    return {
      english: 'Good job! You managed the call well with minor areas for improvement.',
      urdu: 'اچھا کام! آپ نے کال کو اچھی طرح منیج کیا، بہتری کے لیے چھوٹے علاقے موجود ہیں۔',
    };
  }
  if (score >= 70) {
    return {
      english: 'Satisfactory performance. Focus on the improvement areas to enhance your skills.',
      urdu: 'تسلی بخش کارکردگی۔ اپنی صلاحیتوں کو بڑھانے کے لیے بہتری کے شعبوں پر توجہ دیں۔',
    };
  }
  if (score >= 60) {
    return {
      english: 'Needs improvement. Review the feedback carefully and practice the weak areas.',
      urdu: 'بہتری کی ضرورت ہے۔ فیڈبیک کا بغور جائزہ لیں اور کمزور شعبوں کی مشق کریں۔',
    };
  }
  return {
    english: 'Significant improvement required. Focus on foundational customer service skills.',
    urdu: 'نمایاں بہتری کی ضرورت ہے۔ بنیادی کسٹمر سروس کی مہارتوں پر توجہ دیں۔',
  };
}