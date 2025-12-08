'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Scenario } from '@/lib/scenarios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  contentRoman?: string;
  timestamp: Date;
}

interface ConversationData {
  messages: Message[];
  scenario: Scenario;
  duration: number;
  endedNaturally: boolean;
}

interface CategoryScore {
  score: number;
  feedback: string;
  feedbackUrdu: string;
}

interface EvaluationResult {
  overallScore: number;
  overallGrade: string;
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
  messageCount: number;
  conversationDuration: number;
}

// Helper functions
function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 80) return 'text-blue-600';
  if (score >= 70) return 'text-yellow-600';
  if (score >= 60) return 'text-orange-600';
  return 'text-red-600';
}

function getScoreBackgroundColor(score: number): string {
  if (score >= 90) return 'bg-green-100';
  if (score >= 80) return 'bg-blue-100';
  if (score >= 70) return 'bg-yellow-100';
  if (score >= 60) return 'bg-orange-100';
  return 'bg-red-100';
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getPerformanceMessage(score: number): { english: string; urdu: string } {
  if (score >= 90) return { english: 'Excellent Performance!', urdu: 'بہترین کارکردگی!' };
  if (score >= 80) return { english: 'Good Performance', urdu: 'اچھی کارکردگی' };
  if (score >= 70) return { english: 'Satisfactory Performance', urdu: 'تسلی بخش کارکردگی' };
  if (score >= 60) return { english: 'Needs Improvement', urdu: 'بہتری کی ضرورت ہے' };
  return { english: 'Needs Significant Improvement', urdu: 'کافی بہتری کی ضرورت ہے' };
}

export default function EvaluationPage() {
  const router = useRouter();
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    tone: true,
    empathy: false,
    structure: false,
    clarity: false,
    processAdherence: false,
    resolution: false,
  });

  useEffect(() => {
    loadAndEvaluate();
  }, []);

  const loadAndEvaluate = async () => {
    try {
      // Load conversation data from sessionStorage
      const storedData = sessionStorage.getItem('umar_conversation');

      if (!storedData) {
        setError('No conversation data found. Please complete a training session first.');
        setIsLoading(false);
        return;
      }

      let data: ConversationData;
      try {
        data = JSON.parse(storedData);
      } catch (parseError) {
        console.error('Failed to parse conversation data:', parseError);
        setError('Invalid conversation data. Please try a new session.');
        setIsLoading(false);
        return;
      }

      // Validate conversation data
      if (!data.messages || data.messages.length === 0) {
        setError('No messages found in conversation. Please complete a training session first.');
        setIsLoading(false);
        return;
      }

      if (!data.scenario) {
        setError('No scenario data found. Please complete a training session first.');
        setIsLoading(false);
        return;
      }

      console.log('Loaded conversation data:', {
        messageCount: data.messages.length,
        scenario: data.scenario?.name,
        duration: data.duration
      });

      setConversationData(data);

      // Generate evaluation using server-side API route
      console.log('Calling evaluation API...');

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: data.messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          scenario: data.scenario,
          duration: data.duration
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Evaluation API error:', response.status, errorData);
        throw new Error(errorData.details || errorData.error || `API returned ${response.status}`);
      }

      const result = await response.json();
      console.log('Evaluation generated:', { overallScore: result.overallScore });

      setEvaluation(result);
      setIsLoading(false);
    } catch (err) {
      console.error('Evaluation error:', err);
      setError(`Failed to generate evaluation: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`);
      setIsLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handlePracticeAgain = () => {
    sessionStorage.removeItem('umar_conversation');
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
          <div className="animate-spin w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Your Performance</h2>
          <p className="text-gray-600">Please wait while we evaluate your conversation...</p>
          <p className="text-sm text-gray-500 mt-2" dir="rtl">
            براہ کرم انتظار کریں جب تک ہم آپ کی کارکردگی کا جائزہ لیتے ہیں...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-2xl">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Go Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!evaluation || !conversationData) {
    return null;
  }

  const performanceMsg = getPerformanceMessage(evaluation.overallScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-indigo-900">Performance Evaluation</h1>
                <p className="text-sm text-gray-600">{conversationData.scenario.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Duration</p>
                <p className="text-lg font-semibold text-indigo-900">
                  {formatDuration(conversationData.duration)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Messages</p>
                <p className="text-lg font-semibold text-indigo-900">
                  {evaluation.messageCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Overall Score Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-24 h-24 rounded-full ${getScoreBackgroundColor(evaluation.overallScore)} flex items-center justify-center`}>
                <span className={`text-3xl font-bold ${getScoreColor(evaluation.overallScore)}`}>
                  {evaluation.overallGrade}
                </span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-1">
                  {evaluation.overallScore}/100
                </h2>
                <p className="text-gray-600">{performanceMsg.english}</p>
                <p className="text-sm text-gray-500" dir="rtl">{performanceMsg.urdu}</p>
              </div>
            </div>
            {conversationData.endedNaturally && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                <p className="text-green-800 font-semibold text-sm flex items-center gap-2">
                  ✓ Natural Call Ending
                </p>
                <p className="text-green-600 text-xs">AI ended the call naturally</p>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Summary</h3>
              <p className="text-gray-700 text-sm">{evaluation.summaryEnglish}</p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2" dir="rtl">خلاصہ</h3>
              <p className="text-gray-700 text-sm" dir="rtl">{evaluation.summaryUrdu}</p>
            </div>
          </div>
        </div>

        {/* Category Scores */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Category Breakdown</h2>
          
          <div className="space-y-4">
            {Object.entries(evaluation.categories).map(([key, category]) => {
              const isExpanded = expandedSections[key];
              const categoryNames: { [key: string]: { en: string; ur: string } } = {
                tone: { en: 'Tone & Politeness', ur: 'لہجہ اور شائستگی' },
                empathy: { en: 'Empathy', ur: 'ہمدردی' },
                structure: { en: 'Call Structure', ur: 'کال کی ساخت' },
                clarity: { en: 'Clarity', ur: 'وضاحت' },
                processAdherence: { en: 'Process Adherence', ur: 'طریقہ کار پر عمل' },
                resolution: { en: 'Problem Resolution', ur: 'مسئلہ حل' },
              };

              return (
                <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection(key)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className={`text-2xl font-bold ${getScoreColor(category.score)}`}>
                          {category.score}
                        </span>
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-gray-900">{categoryNames[key].en}</h3>
                        <p className="text-sm text-gray-600" dir="rtl">{categoryNames[key].ur}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            category.score >= 90 ? 'bg-green-500' :
                            category.score >= 80 ? 'bg-blue-500' :
                            category.score >= 70 ? 'bg-yellow-500' :
                            category.score >= 60 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${category.score}%` }}
                        ></div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <div className="mb-3">
                        <h4 className="font-semibold text-gray-900 mb-1">Feedback</h4>
                        <p className="text-sm text-gray-700">{category.feedback}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1" dir="rtl">فیڈبیک</h4>
                        <p className="text-sm text-gray-700" dir="rtl">{category.feedbackUrdu}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Strengths and Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">What You Did Well</h2>
            </div>
            <ul className="space-y-3">
              {evaluation.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-1">✓</span>
                  <div>
                    <p className="text-gray-700 text-sm">{strength}</p>
                    {evaluation.strengthsUrdu[idx] && (
                      <p className="text-gray-600 text-xs mt-1" dir="rtl">
                        {evaluation.strengthsUrdu[idx]}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Improvements */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingDown className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-900">Areas to Improve</h2>
            </div>
            <ul className="space-y-3">
              {evaluation.improvements.map((improvement, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold mt-1">→</span>
                  <div>
                    <p className="text-gray-700 text-sm">{improvement}</p>
                    {evaluation.improvementsUrdu[idx] && (
                      <p className="text-gray-600 text-xs mt-1" dir="rtl">
                        {evaluation.improvementsUrdu[idx]}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Examples */}
        {(evaluation.examples.good.length > 0 || evaluation.examples.needsWork.length > 0) && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Specific Examples</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Good Examples */}
              {evaluation.examples.good.length > 0 && (
                <div>
                  <h3 className="font-bold text-green-700 mb-4">✓ Good Examples</h3>
                  <div className="space-y-4">
                    {evaluation.examples.good.map((example, idx) => (
                      <div key={idx} className="bg-green-50 border-l-4 border-green-500 rounded-r-lg p-4">
                        <p className="text-sm text-gray-800 mb-2 italic">"{example.quote}"</p>
                        <p className="text-xs text-green-700">{example.reason}</p>
                        <p className="text-xs text-green-600 mt-1" dir="rtl">{example.reasonUrdu}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Needs Work Examples */}
              {evaluation.examples.needsWork.length > 0 && (
                <div>
                  <h3 className="font-bold text-orange-700 mb-4">→ Needs Improvement</h3>
                  <div className="space-y-4">
                    {evaluation.examples.needsWork.map((example, idx) => (
                      <div key={idx} className="bg-orange-50 border-l-4 border-orange-500 rounded-r-lg p-4">
                        <p className="text-sm text-gray-800 mb-2 italic">"{example.quote}"</p>
                        <p className="text-xs text-orange-700">{example.reason}</p>
                        <p className="text-xs text-orange-600 mt-1" dir="rtl">{example.reasonUrdu}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handlePracticeAgain}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
          >
            <Award className="w-6 h-6" />
            Practice Again
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="bg-white hover:bg-gray-50 text-gray-700 font-semibold py-4 px-8 rounded-xl text-lg transition-all border-2 border-gray-300 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-6 h-6" />
            Back to Home
          </button>
        </div>
      </main>
    </div>
  );
}