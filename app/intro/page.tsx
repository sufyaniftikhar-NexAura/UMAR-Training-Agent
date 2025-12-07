'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Brain, Target, Award, ChevronRight, X } from 'lucide-react';

export default function IntroPage() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);

  const handleSkipIntro = () => {
    // Save preference to skip intro in the future (using localStorage)
    if (typeof window !== 'undefined') {
      localStorage.setItem('umar_skip_intro', 'true');
    }
    router.push('/conversation');
  };

  const handleBeginTraining = () => {
    router.push('/conversation');
  };

  if (!showIntro) {
    router.push('/conversation');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900">
      {/* Skip Button */}
      <button
        onClick={handleSkipIntro}
        className="absolute top-6 right-6 text-white/80 hover:text-white flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-all"
      >
        <X className="w-4 h-4" />
        <span className="text-sm">Skip Intro</span>
      </button>

      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Main Introduction Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-12 text-center">
            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Brain className="w-16 h-16 text-indigo-600" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">
              Welcome to UMAR
            </h1>
            <p className="text-2xl text-indigo-100 mb-2">
              Unified Model for Agent Readiness
            </p>
            <p className="text-xl text-indigo-200" dir="rtl">
              ایجنٹ تیاری کے لیے متحد ماڈل
            </p>
          </div>

          {/* Content Section */}
          <div className="px-8 py-12">
            {/* What is UMAR */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
                What is UMAR?
              </h2>
              <p className="text-lg text-gray-700 mb-4 text-center max-w-3xl mx-auto">
                UMAR is your AI-powered training assistant designed to help you become an excellent customer service agent. 
                Through realistic roleplay scenarios, UMAR simulates actual customer interactions to help you practice and improve.
              </p>
              <p className="text-lg text-gray-600 text-center max-w-3xl mx-auto" dir="rtl">
                UMAR آپ کا AI سے چلنے والا تربیتی معاون ہے جو آپ کو بہترین کسٹمر سروس ایجنٹ بننے میں مدد کرتا ہے۔ 
                حقیقی رول پلے منظرناموں کے ذریعے، UMAR اصل کسٹمر انٹرایکشن کی نقل کرتا ہے تاکہ آپ مشق اور بہتری کر سکیں۔
              </p>
            </div>

            {/* How it Works */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                How It Works
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Step 1 */}
                <div className="bg-indigo-50 rounded-xl p-6 text-center">
                  <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    1. Roleplay Conversation
                  </h3>
                  <p className="text-gray-700 mb-2">
                    UMAR will act as a real customer calling with a specific issue
                  </p>
                  <p className="text-sm text-gray-600" dir="rtl">
                    UMAR ایک حقیقی کسٹمر کا کردار ادا کرے گا
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-purple-50 rounded-xl p-6 text-center">
                  <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    2. Practice Your Skills
                  </h3>
                  <p className="text-gray-700 mb-2">
                    Respond naturally in Urdu, just like a real customer call
                  </p>
                  <p className="text-sm text-gray-600" dir="rtl">
                    اردو میں قدرتی طور پر جواب دیں
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-blue-50 rounded-xl p-6 text-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    3. Get Detailed Feedback
                  </h3>
                  <p className="text-gray-700 mb-2">
                    Receive comprehensive evaluation with scores and improvement tips
                  </p>
                  <p className="text-sm text-gray-600" dir="rtl">
                    سکور اور بہتری کے مشورے حاصل کریں
                  </p>
                </div>
              </div>
            </div>

            {/* What You'll Practice */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
                What You'll Practice
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 text-center">
                  <p className="font-semibold text-indigo-900">Tone & Politeness</p>
                  <p className="text-sm text-indigo-700" dir="rtl">لہجہ اور شائستگی</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center">
                  <p className="font-semibold text-purple-900">Empathy</p>
                  <p className="text-sm text-purple-700" dir="rtl">ہمدردی</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
                  <p className="font-semibold text-blue-900">Call Structure</p>
                  <p className="text-sm text-blue-700" dir="rtl">کال کی ساخت</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
                  <p className="font-semibold text-green-900">Clarity</p>
                  <p className="text-sm text-green-700" dir="rtl">وضاحت</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 text-center">
                  <p className="font-semibold text-yellow-900">Process Adherence</p>
                  <p className="text-sm text-yellow-700" dir="rtl">طریقہ کار</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 text-center">
                  <p className="font-semibold text-red-900">Problem Resolution</p>
                  <p className="text-sm text-red-700" dir="rtl">مسئلہ حل</p>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="mb-12 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>⚠️</span>
                Important Things to Know
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold mt-1">•</span>
                  <span>UMAR will act as a customer - you respond as the agent helping them</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold mt-1">•</span>
                  <span>Speak naturally in Pakistani Urdu (mixing English words is fine)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold mt-1">•</span>
                  <span>Your browser will ask for microphone permission - please allow it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold mt-1">•</span>
                  <span>The conversation continues until the issue is resolved or you end the call</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold mt-1">•</span>
                  <span>After the call, you'll receive a detailed performance evaluation</span>
                </li>
              </ul>
            </div>

            {/* Ready Section */}
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Ready to Begin?
              </h2>
              <p className="text-lg text-gray-700 mb-2">
                Click the button below to start your first training session
              </p>
              <p className="text-lg text-gray-600 mb-8" dir="rtl">
                اپنے پہلے تربیتی سیشن کو شروع کرنے کے لیے نیچے دیا گیا بٹن دبائیں
              </p>

              <button
                onClick={handleBeginTraining}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-5 px-12 rounded-xl text-xl transition-all transform hover:scale-105 shadow-2xl flex items-center gap-3 mx-auto"
              >
                <span>Begin Training Session</span>
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Alternative Skip Link */}
              <button
                onClick={handleSkipIntro}
                className="mt-6 text-gray-500 hover:text-gray-700 text-sm underline"
              >
                Don't show this introduction again
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-8 text-white/80">
          <p className="text-sm">
            Powered by NexAura • AI-Enabled Customer Service Training
          </p>
          <p className="text-sm mt-1" dir="rtl">
            NexAura کی طرف سے تیار کردہ • AI سے چلنے والی کسٹمر سروس ٹریننگ
          </p>
        </div>
      </div>
    </div>
  );
}