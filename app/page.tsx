'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Brain } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  // Check if user has seen intro before
  useEffect(() => {
    const skipIntro = typeof window !== 'undefined' 
      ? localStorage.getItem('umar_skip_intro') 
      : null;
    
    if (skipIntro === 'true') {
      // Skip directly to conversation if user has chosen to skip intro
      // Uncomment below if you want auto-redirect for returning users
      // router.push('/conversation');
    }
  }, []);

  const handleStart = () => {
    // Check if user wants to skip intro
    const skipIntro = typeof window !== 'undefined' 
      ? localStorage.getItem('umar_skip_intro') 
      : null;
    
    if (skipIntro === 'true') {
      router.push('/conversation');
    } else {
      router.push('/intro');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-16 text-center">
            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Brain className="w-16 h-16 text-indigo-600" />
            </div>
            <h1 className="text-6xl font-bold text-white mb-4">
              UMAR
            </h1>
            <p className="text-2xl text-indigo-100 mb-2">
              Unified Model for Agent Readiness
            </p>
            <p className="text-xl text-indigo-200" dir="rtl">
              ایجنٹ تیاری کے لیے متحد ماڈل
            </p>
          </div>

          {/* Content */}
          <div className="px-8 py-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                AI-Powered Customer Service Training
              </h2>
              <p className="text-lg text-gray-700 mb-2">
                Practice real customer conversations with intelligent AI simulation
              </p>
              <p className="text-lg text-gray-600" dir="rtl">
                ذہین AI سمولیشن کے ساتھ حقیقی کسٹمر گفتگو کی مشق کریں
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="text-center p-6 bg-indigo-50 rounded-xl">
                <div className="text-4xl mb-3">🎤</div>
                <h3 className="font-bold text-gray-900 mb-2">Voice Training</h3>
                <p className="text-sm text-gray-600">Natural Urdu conversation with AI customers</p>
              </div>
              
              <div className="text-center p-6 bg-purple-50 rounded-xl">
                <div className="text-4xl mb-3">📊</div>
                <h3 className="font-bold text-gray-900 mb-2">Instant Feedback</h3>
                <p className="text-sm text-gray-600">Detailed evaluation after every call</p>
              </div>
              
              <div className="text-center p-6 bg-blue-50 rounded-xl">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="font-bold text-gray-900 mb-2">Skill Development</h3>
                <p className="text-sm text-gray-600">Improve tone, empathy, and resolution</p>
              </div>
            </div>

            {/* CTA Button */}
            <div className="text-center">
              <button
                onClick={handleStart}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-5 px-12 rounded-xl text-xl transition-all transform hover:scale-105 shadow-2xl inline-flex items-center gap-3"
              >
                <Phone className="w-6 h-6" />
                <span>Start Practice Session</span>
              </button>
              
              <p className="text-sm text-gray-500 mt-4">
                Click to begin your AI training experience
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-white/80">
          <p className="text-sm">
            Powered by NexAura • Advanced AI Training Technology
          </p>
        </div>
      </div>
    </div>
  );
}