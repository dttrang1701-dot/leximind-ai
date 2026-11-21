import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, BookOpen, PlusCircle, RotateCcw, Gamepad2,
  BarChart3, Settings as SettingsIcon, Volume2, Sparkles, Search,
  Trash2, Edit3, Check, X, Upload, Image as ImageIcon, Flame,
  Brain, Clock, ChevronRight, Award, AlertTriangle, Download,
  RefreshCw, Sun, Moon, Menu, CheckCircle2, Mic, PenTool,
  FileText, Copy, Star
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from 'recharts';

// ============================================================================
// 1. GEMINI AI SERVICE (TEXT, JSON & VISION OCR)
// ============================================================================
const GEMINI_MODEL = 'gemini-3-flash-preview';

async function callGeminiAPI({ prompt, systemInstruction = '', responseSchema = null, inlineImages = [], customApiKey = '' }) {
  const apiKey = customApiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Chưa có Gemini API Key. Hãy thêm vào .env.local hoặc Cài đặt.');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const parts = [{ text: prompt }];
  for (const img of inlineImages) {
    parts.push({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.base64 } });
  }

  const payload = { contents: [{ role: 'user', parts }] };
  if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  if (responseSchema) {
    payload.generationConfig = { responseMimeType: 'application/json', responseSchema };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Không nhận được phản hồi từ AI.');
  return responseSchema ? JSON.parse(text) : text;
}

// ============================================================================
// 2. AUDIO PRONUNCIATION (WEB SPEECH API - UK & US)
// ============================================================================
function speakWord(text, accent = 'US') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const targetLang = accent === 'UK' ? 'en-GB' : 'en-US';
    u.lang = targetLang;
    u.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === targetLang) || voices.find((v) => v.lang.startsWith('en'));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {}
}

// ============================================================================
// 3. SPACED REPETITION ENGINE (5-BOX LEITNER + FORGETTING CURVE)
// ============================================================================
const DAY_MS = 24 * 60 * 60 * 1000;

function calculateNextSRS(word, performance, intervals = [1, 1, 3, 7, 14]) {
  const now = Date.now();
  const srs = { ...(word.srs || { box: 1, reviewCount: 0, correctCount: 0, wrongCount: 0, forgetCount: 0, retentionScore: 40, intervalDays: 1 }) };
  srs.reviewCount += 1;
  srs.lastReviewedAt = now;

  if (performance === 'forgot' || performance === 'wrong') {
    srs.wrongCount += 1;
    srs.forgetCount += 1;
    srs.box = srs.box >= 4 ? 2 : 1;
    srs.retentionScore = Math.max(10, srs.retentionScore - 25);
    srs.intervalDays = 0.5;
  } else if (performance === 'hard') {
    srs.correctCount += 1;
    srs.retentionScore = Math.min(95, srs.retentionScore + 8);
    srs.intervalDays = Math.max(1, intervals[srs.box - 1] || 1);
  } else if (performance === 'good') {
    srs.correctCount += 1;
    srs.box = Math.min(5, srs.box + 1);
    srs.retentionScore = Math.min(98, srs.retentionScore + 16);
    srs.intervalDays = intervals[srs.box - 1] || 1;
  } else if (performance === 'easy') {
    srs.correctCount += 1;
    srs.box = Math.min(5, srs.box + 1);
    srs.retentionScore = 100;
    srs.intervalDays = Math.round((intervals[srs.box - 1] || 2) * 1.3);
  }

  srs.nextReviewAt = now + srs.intervalDays * DAY_MS;
  return { ...word, srs };
}

function getEstimatedRetention(word) {
  const base = word.srs?.retentionScore ?? 40;
  const last = word.srs?.lastReviewedAt || word.createdAt || Date.now();
  const interval = Math.max(1, word.srs?.intervalDays || 1);
  const elapsed = Math.max(0, (Date.now() - last) / DAY_MS);
  const decay = Math.exp(-elapsed / (interval * 2.5));
  return Math.max(5, Math.min(100, Math.round(base * (0.45 + 0.55 * decay))));
}

// ============================================================================
// 4. STARTER VOCABULARY DATA
// ============================================================================
const now = Date.now();
const INITIAL_VOCABULARY = [
  {
    id: 'w-1', word: 'Meticulous', ipaUK: '/məˈtɪk.jə.ləs/', ipaUS: '/məˈtɪk.jə.ləs/', partOfSpeech: 'Adjective',
    vietnameseMeanings: ['Tỉ mỉ, cẩn thận từng chi tiết'], englishDefinition: 'Showing great attention to detail; very careful and precise.',
    exampleSentence: 'She is meticulous about keeping her study notes organized.', exampleTranslation: 'Cô ấy rất tỉ mỉ trong việc sắp xếp ghi chú học tập.',
    synonyms: ['Careful', 'Thorough', 'Precise'], antonyms: ['Careless', 'Sloppy'], collocations: ['Meticulous planning', 'Meticulous attention to detail'],
    topic: 'Work & Study', emoji: '🔍', isFavorite: true, createdAt: now - 5 * DAY_MS,
    srs: { box: 2, reviewCount: 3, correctCount: 2, wrongCount: 1, forgetCount: 1, lastReviewedAt: now - 1.2 * DAY_MS, nextReviewAt: now - 0.1 * DAY_MS, retentionScore: 62, intervalDays: 1 }
  },
  {
    id: 'w-2', word: 'Ubiquitous', ipaUK: '/juːˈbɪk.wɪ.təs/', ipaUS: '/juːˈbɪk.wə.t̬əs/', partOfSpeech: 'Adjective',
    vietnameseMeanings: ['Có mặt ở khắp mọi nơi, phổ biến'], englishDefinition: 'Present, appearing, or found everywhere.',
    exampleSentence: 'Smartphones have become ubiquitous in modern daily life.', exampleTranslation: 'Điện thoại thông minh đã trở nên phổ biến khắp mọi nơi trong đời sống hiện đại.',
    synonyms: ['Omnipresent', 'Pervasive', 'Universal'], antonyms: ['Rare', 'Scarce'], collocations: ['Become ubiquitous', 'Ubiquitous technology'],
    topic: 'Technology', emoji: '🌐', isFavorite: true, createdAt: now - 7 * DAY_MS,
    srs: { box: 1, reviewCount: 4, correctCount: 1, wrongCount: 3, forgetCount: 3, lastReviewedAt: now - 1.5 * DAY_MS, nextReviewAt: now - 0.5 * DAY_MS, retentionScore: 34, intervalDays: 1 }
  },
  {
    id: 'w-3', word: 'Procrastinate', ipaUK: '/prəˈkræs.tɪ.neɪt/', ipaUS: '/proʊˈkræs.tə.neɪt/', partOfSpeech: 'Verb',
    vietnameseMeanings: ['Trì hoãn, chần chừ'], englishDefinition: 'To delay or postpone action; put off doing something.',
    exampleSentence: 'Students often procrastinate when faced with a difficult essay.', exampleTranslation: 'Học sinh thường trì hoãn khi đối mặt với một bài luận khó.',
    synonyms: ['Delay', 'Postpone', 'Stall'], antonyms: ['Expedite', 'Hasten'], collocations: ['Tend to procrastinate', 'Stop procrastinating'],
    topic: 'Daily Life', emoji: '⏳', isFavorite: false, createdAt: now - 6 * DAY_MS,
    srs: { box: 3, reviewCount: 4, correctCount: 4, wrongCount: 0, forgetCount: 0, lastReviewedAt: now - 3.1 * DAY_MS, nextReviewAt: now - 0.1 * DAY_MS, retentionScore: 78, intervalDays: 3 }
  },
  {
    id: 'w-4', word: 'Mitigate', ipaUK: '/ˈmɪt.ɪ.ɡeɪt/', ipaUS: '/ˈmɪt̬.ə.ɡeɪt/', partOfSpeech: 'Verb',
    vietnameseMeanings: ['Làm giảm nhẹ, giảm thiểu tác hại'], englishDefinition: 'Make something bad, severe, or painful less serious.',
    exampleSentence: 'Planting urban trees helps mitigate the effects of climate change.', exampleTranslation: 'Trồng cây xanh đô thị giúp giảm thiểu tác động của biến đổi khí hậu.',
    synonyms: ['Alleviate', 'Reduce', 'Ease'], antonyms: ['Aggravate', 'Exacerbate'], collocations: ['Mitigate risks', 'Mitigate the impact'],
    topic: 'Environment', emoji: '🌱', isFavorite: true, createdAt: now - 8 * DAY_MS,
    srs: { box: 1, reviewCount: 5, correctCount: 2, wrongCount: 3, forgetCount: 3, lastReviewedAt: now - 1.1 * DAY_MS, nextReviewAt: now - 0.1 * DAY_MS, retentionScore: 38, intervalDays: 1 }
  },
  {
    id: 'w-5', word: 'Resilient', ipaUK: '/rɪˈzɪl.jənt/', ipaUS: '/rɪˈzɪl.jənt/', partOfSpeech: 'Adjective',
    vietnameseMeanings: ['Kiên cường, phục hồi nhanh'], englishDefinition: 'Able to withstand or recover quickly from difficult conditions.',
    exampleSentence: 'Young learners are remarkably resilient when adapting to new skills.', exampleTranslation: 'Người học trẻ tuổi rất kiên cường khi thích nghi với kỹ năng mới.',
    synonyms: ['Tough', 'Adaptable', 'Hardy'], antonyms: ['Fragile', 'Vulnerable'], collocations: ['Highly resilient', 'Resilient mindset'],
    topic: 'Personality', emoji: '🌿', isFavorite: false, createdAt: now - 10 * DAY_MS,
    srs: { box: 4, reviewCount: 6, correctCount: 6, wrongCount: 0, forgetCount: 0, lastReviewedAt: now - 4 * DAY_MS, nextReviewAt: now + 3 * DAY_MS, retentionScore: 88, intervalDays: 7 }
  },
  {
    id: 'w-6', word: 'Enhance', ipaUK: '/ɪnˈhɑːns/', ipaUS: '/ɪnˈhæns/', partOfSpeech: 'Verb',
    vietnameseMeanings: ['Nâng cao, cải thiện chất lượng'], englishDefinition: 'Intensify, increase, or further improve the quality or value of.',
    exampleSentence: 'Daily flashcards significantly enhance long-term memory retention.', exampleTranslation: 'Học flashcard mỗi ngày cải thiện đáng kể trí nhớ dài hạn.',
    synonyms: ['Improve', 'Boost', 'Elevate'], antonyms: ['Diminish', 'Degrade'], collocations: ['Enhance skills', 'Enhance productivity'],
    topic: 'Education', emoji: '✨', isFavorite: false, createdAt: now - 14 * DAY_MS,
    srs: { box: 5, reviewCount: 8, correctCount: 8, wrongCount: 0, forgetCount: 0, lastReviewedAt: now - 5 * DAY_MS, nextReviewAt: now + 9 * DAY_MS, retentionScore: 96, intervalDays: 14 }
  }
];

const BOX_COLORS = [
  { box: 1, label: 'Hộp 1: Mới / Khó', color: '#F43F5E', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  { box: 2, label: 'Hộp 2: Đang học', color: '#F59E0B', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { box: 3, label: 'Hộp 3: Quen thuộc', color: '#3B82F6', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  { box: 4, label: 'Hộp 4: Nhớ tốt', color: '#10B981', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { box: 5, label: 'Hộp 5: Thành thạo', color: '#8B5CF6', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' }
];

// ============================================================================
// 5. MAIN APPLICATION
// ============================================================================
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);

  const [vocabulary, setVocabulary] = useState(() => {
    try {
      const s = localStorage.getItem('leximind_vocab_v2');
      return s ? JSON.parse(s) : INITIAL_VOCABULARY;
    } catch { return INITIAL_VOCABULARY; }
  });

  const [settings, setSettings] = useState(() => {
    try {
      const s = localStorage.getItem('leximind_settings_v2');
      return s ? JSON.parse(s) : { accent: 'US', darkMode: false, soundEnabled: true, customApiKey: '', intervals: [1, 1, 3, 7, 14] };
    } catch { return { accent: 'US', darkMode: false, soundEnabled: true, customApiKey: '', intervals: [1, 1, 3, 7, 14] }; }
  });

  const [streak, setStreak] = useState(5);

  useEffect(() => {
    localStorage.setItem('leximind_vocab_v2', JSON.stringify(vocabulary));
  }, [vocabulary]);

  useEffect(() => {
    localStorage.setItem('leximind_settings_v2', JSON.stringify(settings));
    if (settings.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings]);

  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleReviewWord = (id, perf) => {
    setVocabulary((prev) => prev.map((w) => (w.id === id ? calculateNextSRS(w, perf, settings.intervals) : w)));
  };

  const handleAddWords = (items) => {
    setVocabulary((prev) => {
      const existing = new Set(prev.map((w) => w.word.toLowerCase()));
      const fresh = items.filter((i) => !existing.has(i.word.toLowerCase()));
      return [...fresh, ...prev];
    });
  };

  const dueWords = useMemo(() => {
    const t = Date.now();
    return vocabulary.filter((w) => (w.srs?.nextReviewAt || 0) <= t || getEstimatedRetention(w) < 45);
  }, [vocabulary]);

  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'vocabulary', label: 'Kho từ vựng', icon: BookOpen, badge: vocabulary.length },
    { id: 'add', label: 'Thêm từ & Quét ảnh', icon: PlusCircle },
    { id: 'review', label: 'Ôn tập hôm nay', icon: RotateCcw, badge: dueWords.length, alert: true },
    { id: 'practice', label: 'Luyện tập AI', icon: Gamepad2 },
    { id: 'speaking', label: 'Từ vựng Speaking', icon: Mic },
    { id: 'writing', label: 'Từ vựng Writing', icon: PenTool },
    { id: 'stats', label: 'Thống kê & Từ yếu', icon: BarChart3 },
    { id: 'settings', label: 'Cài đặt', icon: SettingsIcon }
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col md:flex-row">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-medium shadow-lg flex items-center gap-2">
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-stone-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Brain className="w-6 h-6 text-emerald-500" /> LexiMind AI
        </div>
        <button onClick={() => setMobileMenu(!mobileMenu)} className="p-2 rounded-xl bg-stone-100 dark:bg-slate-800">
          {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-stone-200 dark:border-slate-800 p-4 flex flex-col justify-between transition-transform ${mobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="space-y-6 overflow-y-auto">
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">LexiMind AI</div>
              <div className="text-xs text-slate-400">Học từ vựng thông minh</div>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMenu(false); }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-sm font-medium transition cursor-pointer ${
                    active ? 'bg-[#E8F3EE] dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-emerald-600' : ''}`} />
                    {item.label}
                  </span>
                  {item.badge > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.alert ? 'bg-rose-500 text-white' : 'bg-stone-200 dark:bg-slate-800'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-stone-200 dark:border-slate-800 space-y-2">
          <button
            onClick={() => setSettings((s) => ({ ...s, darkMode: !s.darkMode }))}
            className="w-full py-2 px-3 rounded-xl bg-stone-100 dark:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            {settings.darkMode ? <><Sun className="w-4 h-4 text-amber-400" /> Chế độ sáng</> : <><Moon className="w-4 h-4" /> Chế độ tối</>}
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> Bắt đầu học ngay
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        {activeTab === 'dashboard' && (
          <DashboardTab vocabulary={vocabulary} dueWords={dueWords} streak={streak} settings={settings} onNavigate={setActiveTab} onSelectWord={setSelectedWord} />
        )}
        {activeTab === 'vocabulary' && (
          <VocabularyTab vocabulary={vocabulary} setVocabulary={setVocabulary} settings={settings} onSelectWord={setSelectedWord} notify={notify} />
        )}
        {activeTab === 'add' && (
          <AddWordsTab vocabulary={vocabulary} settings={settings} onAddWords={handleAddWords} onNavigate={setActiveTab} notify={notify} />
        )}
        {activeTab === 'review' && (
          <ReviewTab dueWords={dueWords} allWords={vocabulary} settings={settings} onReview={handleReviewWord} onNavigate={setActiveTab} />
        )}
        {activeTab === 'practice' && (
          <PracticeTab vocabulary={vocabulary} dueWords={dueWords} settings={settings} onReview={handleReviewWord} notify={notify} />
        )}
        {activeTab === 'speaking' && (
          <SkillBuilderTab mode="speaking" vocabulary={vocabulary} settings={settings} onAddWords={handleAddWords} notify={notify} />
        )}
        {activeTab === 'writing' && (
          <SkillBuilderTab mode="writing" vocabulary={vocabulary} settings={settings} onAddWords={handleAddWords} notify={notify} />
        )}
        {activeTab === 'stats' && (
          <StatsTab vocabulary={vocabulary} onSelectWord={setSelectedWord} onNavigate={setActiveTab} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab settings={settings} setSettings={setSettings} vocabulary={vocabulary} setVocabulary={setVocabulary} notify={notify} />
        )}
      </main>

      {/* Word Detail Modal */}
      {selectedWord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelectedWord(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-stone-200 dark:border-slate-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedWord.emoji || '📘'}</span>
                <div>
                  <h3 className="text-2xl font-bold">{selectedWord.word}</h3>
                  <p className="text-xs font-mono text-slate-400">UK {selectedWord.ipaUK} · US {selectedWord.ipaUS}</p>
                </div>
              </div>
              <button onClick={() => setSelectedWord(null)} className="p-1.5 rounded-xl bg-stone-100 dark:bg-slate-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => speakWord(selectedWord.word, 'UK')} className="px-3 py-1.5 rounded-xl bg-[#E8F3EE] dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer">
                <Volume2 className="w-3.5 h-3.5" /> Nghe UK
              </button>
              <button onClick={() => speakWord(selectedWord.word, 'US')} className="px-3 py-1.5 rounded-xl bg-[#E8F3EE] dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer">
                <Volume2 className="w-3.5 h-3.5" /> Nghe US
              </button>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] dark:bg-slate-800 space-y-1 text-sm">
              <div className="font-bold text-emerald-700 dark:text-emerald-300">{selectedWord.vietnameseMeanings?.join(', ')}</div>
              <div className="text-xs text-slate-500">{selectedWord.englishDefinition}</div>
            </div>
            <div className="text-xs space-y-1">
              <div className="font-semibold">Ví dụ:</div>
              <p className="italic text-slate-700 dark:text-slate-200">“{selectedWord.exampleSentence}”</p>
              <p className="text-slate-500">{selectedWord.exampleTranslation}</p>
            </div>
            {selectedWord.collocations?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedWord.collocations.map((c, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[#FDF0F3] dark:bg-slate-800 text-rose-700 dark:text-rose-300">{c}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 1: DASHBOARD
// ============================================================================
function DashboardTab({ vocabulary, dueWords, streak, settings, onNavigate, onSelectWord }) {
  const avgRetention = useMemo(() => {
    if (!vocabulary.length) return 0;
    return Math.round(vocabulary.reduce((s, w) => s + getEstimatedRetention(w), 0) / vocabulary.length);
  }, [vocabulary]);

  const boxData = BOX_COLORS.map((b) => ({
    name: `Hộp ${b.box}`,
    count: vocabulary.filter((w) => (w.srs?.box || 1) === b.box).length,
    color: b.color
  }));

  const activityData = [
    { day: 'T2', reviewed: 12, learned: 3 },
    { day: 'T3', reviewed: 15, learned: 4 },
    { day: 'T4', reviewed: 9, learned: 2 },
    { day: 'T5', reviewed: 18, learned: 5 },
    { day: 'T6', reviewed: 14, learned: 3 },
    { day: 'T7', reviewed: 20, learned: 4 },
    { day: 'CN', reviewed: Math.max(6, vocabulary.length), learned: 2 }
  ];

  return (
    <div className="space-y-6">
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#E8F3EE] via-[#FAF9F6] to-[#FDF0F3] dark:from-slate-900 dark:to-emerald-950/30 border border-emerald-200/70 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Chào mừng trở lại LexiMind AI!</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Hệ thống Spaced Repetition giúp bạn nhớ từ vựng mãi mãi.</p>
        </div>
        <button
          onClick={() => onNavigate('review')}
          className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center gap-2 shrink-0 cursor-pointer shadow-sm"
        >
          <RotateCcw className="w-4 h-4" /> Ôn tập ngay ({dueWords.length})
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 flex justify-between"><span>Tổng từ đã lưu</span><BookOpen className="w-4 h-4 text-sky-500" /></div>
          <div className="text-3xl font-bold mt-2">{vocabulary.length}</div>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 flex justify-between"><span>Độ ghi nhớ trung bình</span><Brain className="w-4 h-4 text-emerald-500" /></div>
          <div className="text-3xl font-bold mt-2 text-emerald-600">{avgRetention}%</div>
        </div>
        <div onClick={() => onNavigate('review')} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 cursor-pointer">
          <div className="text-xs text-slate-500 flex justify-between"><span>Cần ôn hôm nay</span><Clock className="w-4 h-4 text-rose-500" /></div>
          <div className="text-3xl font-bold mt-2 text-rose-600">{dueWords.length}</div>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 flex justify-between"><span>Chuỗi ngày học</span><Flame className="w-4 h-4 text-amber-500" /></div>
          <div className="text-3xl font-bold mt-2">{streak} ngày</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
          <h3 className="font-bold text-sm mb-4">Hoạt động học tập 7 ngày qua</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="reviewed" name="Đã ôn" stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
                <Area type="monotone" dataKey="learned" name="Từ mới" stroke="#F472B6" fill="#F472B6" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
          <h3 className="font-bold text-sm mb-4">Phân bổ 5 Hộp Leitner</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={boxData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Số từ" radius={[8, 8, 0, 0]}>
                  {boxData.map((b, i) => <Cell key={i} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">Từ ưu tiên ôn tập hôm nay</h3>
          <button onClick={() => onNavigate('vocabulary')} className="text-xs font-semibold text-emerald-600 flex items-center gap-1 cursor-pointer">
            Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dueWords.slice(0, 6).map((w) => (
            <div key={w.id} onClick={() => onSelectWord(w)} className="p-4 rounded-2xl bg-[#FAF9F6] dark:bg-slate-800 border border-stone-200/70 dark:border-slate-700 cursor-pointer hover:border-emerald-400 transition">
              <div className="flex items-center justify-between">
                <span className="font-bold">{w.emoji} {w.word}</span>
                <button onClick={(e) => { e.stopPropagation(); speakWord(w.word, settings.accent); }} className="p-1 text-slate-400 hover:text-emerald-600">
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">{w.vietnameseMeanings?.join(', ')}</p>
              <div className="flex justify-between items-center mt-3 text-[11px]">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${BOX_COLORS[(w.srs?.box || 1) - 1]?.badge}`}>Hộp {w.srs?.box || 1}</span>
                <span className="text-slate-400">Nhớ: {getEstimatedRetention(w)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 2: MY VOCABULARY
// ============================================================================
function VocabularyTab({ vocabulary, setVocabulary, settings, onSelectWord, notify }) {
  const [query, setQuery] = useState('');
  const [boxFilter, setBoxFilter] = useState('all');

  const filtered = useMemo(() => {
    return vocabulary.filter((w) => {
      const matchText = w.word.toLowerCase().includes(query.toLowerCase()) || w.vietnameseMeanings?.join(' ').toLowerCase().includes(query.toLowerCase());
      const matchBox = boxFilter === 'all' || String(w.srs?.box || 1) === boxFilter;
      return matchText && matchBox;
    });
  }, [vocabulary, query, boxFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Kho từ vựng ({vocabulary.length})</h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm từ hoặc nghĩa..."
              className="pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-sm"
            />
          </div>
          <select value={boxFilter} onChange={(e) => setBoxFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-sm">
            <option value="all">Tất cả 5 Hộp</option>
            {[1, 2, 3, 4, 5].map((b) => <option key={b} value={String(b)}>Hộp {b}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((w) => (
          <div key={w.id} onClick={() => onSelectWord(w)} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 hover:border-emerald-400 transition cursor-pointer flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-lg">{w.emoji || '📘'} {w.word}</div>
                  <div className="text-xs font-mono text-slate-400">{settings.accent === 'UK' ? w.ipaUK : w.ipaUS} · {w.partOfSpeech}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); speakWord(w.word, settings.accent); }} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800">
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setVocabulary((prev) => prev.filter((item) => item.id !== w.id));
                      notify('Đã xóa từ vựng.');
                    }}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-2">{w.vietnameseMeanings?.join(', ')}</p>
              <p className="text-xs text-slate-500 italic mt-1 line-clamp-2">“{w.exampleSentence}”</p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-slate-800 text-xs">
              <span className={`px-2.5 py-0.5 rounded-full font-semibold ${BOX_COLORS[(w.srs?.box || 1) - 1]?.badge}`}>Hộp {w.srs?.box || 1}</span>
              <span className="text-slate-400">Độ nhớ: {getEstimatedRetention(w)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TAB 3: ADD NEW WORDS (AI MANUAL + IMAGE OCR)
// ============================================================================
function AddWordsTab({ vocabulary, settings, onAddWords, onNavigate, notify }) {
  const [mode, setMode] = useState('manual');
  const [wordInput, setWordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null);

  const [ocrImages, setOcrImages] = useState([]);
  const [ocrItems, setOcrItems] = useState([]);
  const fileRef = useRef(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!wordInput.trim()) return;
    setLoading(true);
    try {
      const schema = {
        type: 'OBJECT',
        properties: {
          word: { type: 'STRING' }, ipaUK: { type: 'STRING' }, ipaUS: { type: 'STRING' },
          partOfSpeech: { type: 'STRING' }, vietnameseMeanings: { type: 'ARRAY', items: { type: 'STRING' } },
          englishDefinition: { type: 'STRING' }, exampleSentence: { type: 'STRING' },
          exampleTranslation: { type: 'STRING' }, synonyms: { type: 'ARRAY', items: { type: 'STRING' } },
          antonyms: { type: 'ARRAY', items: { type: 'STRING' } }, collocations: { type: 'ARRAY', items: { type: 'STRING' } },
          topic: { type: 'STRING' }, emoji: { type: 'STRING' }
        },
        required: ['word', 'ipaUK', 'ipaUS', 'partOfSpeech', 'vietnameseMeanings', 'englishDefinition', 'exampleSentence', 'exampleTranslation', 'synonyms', 'antonyms', 'collocations', 'topic', 'emoji']
      };
      const res = await callGeminiAPI({
        prompt: `Provide complete English-Vietnamese dictionary data for: "${wordInput.trim()}".`,
        responseSchema: schema,
        customApiKey: settings.customApiKey
      });
      setDraft(res);
      speakWord(wordInput.trim(), settings.accent);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!draft) return;
    onAddWords([{
      ...draft,
      id: `w-${Date.now()}`,
      createdAt: Date.now(),
      srs: { box: 1, reviewCount: 0, correctCount: 0, wrongCount: 0, forgetCount: 0, nextReviewAt: Date.now(), retentionScore: 40, intervalDays: 1 }
    }]);
    notify(`Đã thêm "${draft.word}" vào kho từ vựng!`);
    setDraft(null);
    setWordInput('');
  };

  const handleFiles = (e) => {
    Array.from(e.target.files || []).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setOcrImages((prev) => [...prev, { preview: reader.result, base64: reader.result.split(',')[1], mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleScanOCR = async () => {
    if (!ocrImages.length) return;
    setLoading(true);
    try {
      const schema = {
        type: 'OBJECT',
        properties: {
          words: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                word: { type: 'STRING' }, ipaUK: { type: 'STRING' }, ipaUS: { type: 'STRING' },
                partOfSpeech: { type: 'STRING' }, vietnameseMeanings: { type: 'ARRAY', items: { type: 'STRING' } },
                englishDefinition: { type: 'STRING' }, exampleSentence: { type: 'STRING' },
                exampleTranslation: { type: 'STRING' }, collocations: { type: 'ARRAY', items: { type: 'STRING' } },
                topic: { type: 'STRING' }, emoji: { type: 'STRING' }
              },
              required: ['word', 'ipaUK', 'ipaUS', 'partOfSpeech', 'vietnameseMeanings', 'englishDefinition', 'exampleSentence', 'exampleTranslation', 'collocations', 'topic', 'emoji']
            }
          }
        },
        required: ['words']
      };
      const res = await callGeminiAPI({
        prompt: 'Extract all English vocabulary words from these textbook/notebook images (including multi-column tables) and generate full English-Vietnamese dictionary details for each word.',
        responseSchema: schema,
        inlineImages: ocrImages,
        customApiKey: settings.customApiKey
      });
      setOcrItems((res.words || []).map((w) => ({ ...w, selected: true })));
      notify(`Đã quét được ${res.words?.length || 0} từ từ ảnh!`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOCR = () => {
    const selected = ocrItems.filter((i) => i.selected).map((w, idx) => ({
      ...w,
      id: `ocr-${Date.now()}-${idx}`,
      createdAt: Date.now(),
      srs: { box: 1, reviewCount: 0, correctCount: 0, wrongCount: 0, forgetCount: 0, nextReviewAt: Date.now(), retentionScore: 40, intervalDays: 1 }
    }));
    onAddWords(selected);
    notify(`Đã lưu ${selected.length} từ vào kho!`);
    onNavigate('vocabulary');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Thêm từ vựng mới</h2>

      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-stone-200/70 dark:bg-slate-900">
        <button onClick={() => setMode('manual')} className={`py-2.5 rounded-xl text-sm font-semibold cursor-pointer ${mode === 'manual' ? 'bg-white dark:bg-slate-800 text-emerald-700 shadow-2xs' : ''}`}>
          1. Nhập từ + AI tự điền
        </button>
        <button onClick={() => setMode('ocr')} className={`py-2.5 rounded-xl text-sm font-semibold cursor-pointer ${mode === 'ocr' ? 'bg-white dark:bg-slate-800 text-emerald-700 shadow-2xs' : ''}`}>
          2. Quét từ từ ảnh (AI OCR)
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="space-y-4">
          <form onSubmit={handleGenerate} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-3">
            <input
              type="text"
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value)}
              placeholder="Nhập từ tiếng Anh (VD: Serendipity, Inevitable...)"
              className="w-full px-4 py-3 rounded-2xl bg-[#FAF9F6] dark:bg-slate-800 border border-stone-200 dark:border-slate-700"
            />
            <button type="submit" disabled={loading || !wordInput.trim()} className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer">
              {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> AI đang tạo...</> : <><Sparkles className="w-4 h-4" /> Tạo thông tin từ vựng với AI</>}
            </button>
          </form>

          {draft && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-300 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">{draft.emoji} {draft.word}</h3>
                  <p className="text-xs font-mono text-slate-400">UK {draft.ipaUK} · US {draft.ipaUS} · {draft.partOfSpeech}</p>
                </div>
                <button onClick={handleSaveDraft} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold cursor-pointer">
                  Lưu vào kho từ
                </button>
              </div>
              <p className="text-sm font-semibold text-emerald-700">{draft.vietnameseMeanings?.join(', ')}</p>
              <p className="text-xs text-slate-500">{draft.englishDefinition}</p>
              <div className="p-3 rounded-xl bg-[#FAF9F6] dark:bg-slate-800 text-xs">
                <p className="font-medium">“{draft.exampleSentence}”</p>
                <p className="text-slate-500 mt-1">{draft.exampleTranslation}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-4">
          <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-emerald-300 rounded-2xl p-8 text-center cursor-pointer bg-[#FAF9F6] dark:bg-slate-800/40">
            <Upload className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold">Tải lên ảnh trang sách hoặc vở ghi từ vựng</p>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
          </div>
          {ocrImages.length > 0 && (
            <button onClick={handleScanOCR} disabled={loading} className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-sm cursor-pointer">
              {loading ? 'AI Vision đang đọc ảnh...' : `Quét từ vựng từ ${ocrImages.length} ảnh`}
            </button>
          )}
          {ocrItems.length > 0 && (
            <div className="space-y-3">
              <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 dark:divide-slate-800">
                {ocrItems.map((item, idx) => (
                  <label key={idx} className="py-2 flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={item.selected} onChange={(e) => setOcrItems((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: e.target.checked } : r)))} />
                    <span className="font-bold">{item.word}</span>
                    <span className="text-slate-500 text-xs">{item.vietnameseMeanings?.join(', ')}</span>
                  </label>
                ))}
              </div>
              <button onClick={handleSaveOCR} className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-sm cursor-pointer">
                Lưu tất cả từ đã chọn
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 4: SPACED REPETITION REVIEW (FLASHCARDS)
// ============================================================================
function ReviewTab({ dueWords, allWords, settings, onReview, onNavigate }) {
  const [queue, setQueue] = useState(dueWords.length ? dueWords : allWords);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = queue[idx];

  useEffect(() => {
    if (card && settings.soundEnabled) speakWord(card.word, settings.accent);
  }, [idx, card?.id]);

  if (!card) {
    return (
      <div className="max-w-lg mx-auto text-center p-10 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-4">
        <Award className="w-12 h-12 text-emerald-500 mx-auto" />
        <h2 className="text-2xl font-bold">Hoàn thành phiên ôn tập!</h2>
        <button onClick={() => { setQueue(allWords); setIdx(0); setFlipped(false); }} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold cursor-pointer">
          Ôn tập thêm toàn bộ kho từ
        </button>
      </div>
    );
  }

  const handleGrade = (perf) => {
    onReview(card.id, perf);
    if (perf === 'forgot') setQueue((q) => [...q, card]);
    setFlipped(false);
    setIdx((i) => i + 1);
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex justify-between text-xs font-semibold text-slate-500">
        <span>Thẻ {idx + 1} / {queue.length}</span>
        <span>Hộp {card.srs?.box || 1} · Độ nhớ {getEstimatedRetention(card)}%</span>
      </div>

      <div onClick={() => setFlipped(!flipped)} className="min-h-[300px] p-8 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-xs flex flex-col justify-between cursor-pointer text-center">
        <div className="flex justify-end">
          <button onClick={(e) => { e.stopPropagation(); speakWord(card.word, settings.accent); }} className="p-2 rounded-xl bg-stone-100 dark:bg-slate-800">
            <Volume2 className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
        <div className="space-y-2 my-4">
          <div className="text-4xl">{card.emoji || '📘'}</div>
          <h2 className="text-3xl font-bold">{card.word}</h2>
          <p className="text-xs font-mono text-slate-400">UK {card.ipaUK} · US {card.ipaUS}</p>
          {flipped ? (
            <div className="pt-4 mt-4 border-t border-stone-100 dark:border-slate-800 text-left space-y-2">
              <div className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">{card.vietnameseMeanings?.join(', ')}</div>
              <p className="text-xs text-slate-500">{card.englishDefinition}</p>
              <p className="text-xs italic bg-[#FAF9F6] dark:bg-slate-800 p-3 rounded-xl">“{card.exampleSentence}”</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 pt-6">Nhấn vào thẻ để lật xem nghĩa</p>
          )}
        </div>
        <div className="text-[11px] text-slate-400">Đã ôn {card.srs?.reviewCount || 0} lần</div>
      </div>

      <div className="grid grid-cols-4 gap-2.5 text-xs font-semibold">
        <button onClick={() => handleGrade('forgot')} className="py-3 rounded-2xl bg-rose-100 text-rose-700 cursor-pointer">Quên rồi</button>
        <button onClick={() => handleGrade('hard')} className="py-3 rounded-2xl bg-amber-100 text-amber-700 cursor-pointer">Hơi khó</button>
        <button onClick={() => handleGrade('good')} className="py-3 rounded-2xl bg-emerald-100 text-emerald-700 cursor-pointer">Nhớ tốt</button>
        <button onClick={() => handleGrade('easy')} className="py-3 rounded-2xl bg-sky-100 text-sky-700 cursor-pointer">Rất dễ</button>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 5: PRACTICE MODES (MULTIPLE CHOICE & AI SENTENCE CHECKER)
// ============================================================================
function PracticeTab({ vocabulary, dueWords, settings, onReview, notify }) {
  const [subMode, setSubMode] = useState('mcq');
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [sentence, setSentence] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);

  if (vocabulary.length < 4) {
    return <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl">Cần ít nhất 4 từ vựng để luyện tập.</div>;
  }

  const pool = dueWords.length >= 4 ? dueWords : vocabulary;
  const target = pool[idx % pool.length];
  const choices = useMemo(() => {
    const others = vocabulary.filter((w) => w.id !== target.id).sort(() => Math.random() - 0.5).slice(0, 3);
    return [target, ...others].sort(() => Math.random() - 0.5);
  }, [idx, target.id]);

  const checkSentence = async (e) => {
    e.preventDefault();
    if (!sentence.trim()) return;
    setLoading(true);
    try {
      const text = await callGeminiAPI({
        prompt: `Học sinh đặt câu với từ "${target.word}" (${target.vietnameseMeanings?.join(', ')}): "${sentence}". Hãy nhận xét ngắn gọn bằng tiếng Việt về ngữ pháp, ngữ cảnh và viết lại 1 câu gợi ý tự nhiên như người bản ngữ.`,
        customApiKey: settings.customApiKey
      });
      onReview(target.id, 'good');
      setAiResult(text);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-stone-200/70 dark:bg-slate-900">
        <button onClick={() => setSubMode('mcq')} className={`py-2.5 rounded-xl text-sm font-semibold cursor-pointer ${subMode === 'mcq' ? 'bg-white dark:bg-slate-800 text-emerald-700' : ''}`}>
          Trắc nghiệm nghĩa từ
        </button>
        <button onClick={() => setSubMode('sentence')} className={`py-2.5 rounded-xl text-sm font-semibold cursor-pointer ${subMode === 'sentence' ? 'bg-white dark:bg-slate-800 text-emerald-700' : ''}`}>
          Đặt câu & AI sửa lỗi
        </button>
      </div>

      {subMode === 'mcq' ? (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">{target.word}</h3>
            <button onClick={() => speakWord(target.word, settings.accent)} className="p-2 rounded-xl bg-stone-100 dark:bg-slate-800"><Volume2 className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {choices.map((c) => {
              const correct = c.id === target.id;
              const style = chosen
                ? correct ? 'bg-emerald-100 border-emerald-500 text-emerald-900' : chosen === c.id ? 'bg-rose-100 border-rose-500 text-rose-900' : 'opacity-60'
                : 'bg-[#FAF9F6] dark:bg-slate-800 border-stone-200 dark:border-slate-700 hover:border-emerald-400';
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    if (chosen) return;
                    setChosen(c.id);
                    onReview(target.id, correct ? 'good' : 'wrong');
                  }}
                  className={`p-3.5 rounded-2xl border text-left text-sm font-medium cursor-pointer ${style}`}
                >
                  {c.vietnameseMeanings?.join(', ')}
                </button>
              );
            })}
          </div>
          {chosen && (
            <button onClick={() => { setChosen(null); setIdx((i) => i + 1); }} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold cursor-pointer">
              Câu tiếp theo →
            </button>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-4">
          <div>
            <h3 className="text-xl font-bold">Đặt câu với từ: <span className="text-emerald-600">{target.word}</span></h3>
            <p className="text-xs text-slate-500">{target.vietnameseMeanings?.join(', ')}</p>
          </div>
          <form onSubmit={checkSentence} className="space-y-3">
            <textarea rows={3} value={sentence} onChange={(e) => setSentence(e.target.value)} placeholder={`Viết một câu tiếng Anh có chứa "${target.word}"...`} className="w-full p-3.5 rounded-2xl bg-[#FAF9F6] dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm" />
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold cursor-pointer">
                {loading ? 'AI đang chấm...' : 'Nhờ AI chấm câu'}
              </button>
              <button type="button" onClick={() => { setAiResult(null); setSentence(''); setIdx((i) => i + 1); }} className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-slate-800 text-xs font-semibold cursor-pointer">
                Đổi từ
              </button>
            </div>
          </form>
          {aiResult && <div className="p-4 rounded-2xl bg-[#E8F3EE]/60 dark:bg-slate-800 text-sm whitespace-pre-line">{aiResult}</div>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 6 & 7: SPEAKING & WRITING PREP (VOCAB + STRUCTURES + EXPORT DOC/MD)
// ============================================================================
function SkillBuilderTab({ mode, vocabulary, settings, onAddWords, notify }) {
  const isSpeaking = mode === 'speaking';
  const [topic, setTopic] = useState('');
  const [band, setBand] = useState('IELTS Band 7.0 - 8.0');
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const schema = {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          strategy: { type: 'STRING' },
          vocabList: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                word: { type: 'STRING' }, ipaUK: { type: 'STRING' }, ipaUS: { type: 'STRING' },
                partOfSpeech: { type: 'STRING' }, meaningVi: { type: 'STRING' },
                example: { type: 'STRING' }, exampleVi: { type: 'STRING' }
              },
              required: ['word', 'ipaUK', 'ipaUS', 'partOfSpeech', 'meaningVi', 'example', 'exampleVi']
            }
          },
          structures: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { pattern: { type: 'STRING' }, noteVi: { type: 'STRING' }, example: { type: 'STRING' } },
              required: ['pattern', 'noteVi', 'example']
            }
          },
          modelSample: { type: 'STRING' }
        },
        required: ['title', 'strategy', 'vocabList', 'structures', 'modelSample']
      };

      const res = await callGeminiAPI({
        prompt: `Tạo bộ tài liệu học từ vựng và cấu trúc câu cho phần thi ${isSpeaking ? 'IELTS Speaking' : 'IELTS Writing'} với đề bài: "${topic}". Mục tiêu: ${band}. Gồm 8 từ vựng/collocations đắt giá, 5 cấu trúc câu hay giải thích tiếng Việt và 1 đoạn văn mẫu chuẩn band điểm.`,
        responseSchema: schema,
        customApiKey: settings.customApiKey
      });
      setPack(res);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadWord = () => {
    if (!pack) return;
    const html = `<html><head><meta charset="utf-8"><title>${pack.title}</title></head><body style="font-family:Arial,sans-serif;line-height:1.6">
      <h1>${isSpeaking ? 'SPEAKING' : 'WRITING'} STUDY PACK: ${pack.title}</h1>
      <p><strong>Đề bài:</strong> ${topic} | <strong>Mục tiêu:</strong> ${band}</p>
      <h2>1. Chiến lược làm bài</h2><p>${pack.strategy}</p>
      <h2>2. Từ vựng & Collocations nên dùng</h2>
      ${pack.vocabList.map((v, i) => `<p><strong>${i + 1}. ${v.word}</strong> (${v.partOfSpeech}) [${v.ipaUS}] — <b>${v.meaningVi}</b><br/><i>VD:</i> "${v.example}" (${v.exampleVi})</p>`).join('')}
      <h2>3. Cấu trúc câu ăn điểm</h2>
      ${pack.structures.map((s, i) => `<p><strong>${i + 1}. ${s.pattern}</strong>: ${s.noteVi}<br/><i>Áp dụng:</i> "${s.example}"</p>`).join('')}
      <h2>4. Bài mẫu tham khảo</h2><p>${pack.modelSample}</p>
    </body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mode}-${Date.now()}.doc`;
    a.click();
    notify('Đã tải file Word (.doc) về máy!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{isSpeaking ? 'Từ vựng & Cấu trúc Speaking' : 'Từ vựng & Cấu trúc Writing'}</h2>
        <p className="text-sm text-slate-500 mt-1">Nhập đề bài bất kỳ để AI soạn file từ vựng đắt giá, cấu trúc câu và bài mẫu.</p>
      </div>

      <form onSubmit={handleGenerate} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={isSpeaking ? 'VD: Describe a skill you learned recently...' : 'VD: Some people think technology makes us less social...'}
            className="md:col-span-3 px-4 py-3 rounded-2xl bg-[#FAF9F6] dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm"
          />
          <select value={band} onChange={(e) => setBand(e.target.value)} className="px-3 py-3 rounded-2xl bg-[#FAF9F6] dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm">
            <option>IELTS Band 6.0 - 6.5</option>
            <option>IELTS Band 7.0 - 8.0</option>
            <option>IELTS Band 8.5+</option>
          </select>
        </div>
        <button type="submit" disabled={loading || !topic.trim()} className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer">
          {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> AI đang soạn bài...</> : <><Sparkles className="w-4 h-4" /> Tạo bộ Từ vựng & Cấu trúc</>}
        </button>
      </form>

      {pack && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 dark:border-slate-800 pb-4">
            <h3 className="text-xl font-bold">{pack.title}</h3>
            <button onClick={downloadWord} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
              <Download className="w-4 h-4" /> Tải file Word (.DOC)
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF9F6] dark:bg-slate-800 text-sm">
            <strong>💡 Chiến lược:</strong> {pack.strategy}
          </div>

          <div className="space-y-3">
            <h4 className="font-bold">📚 Từ vựng ăn điểm</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pack.vocabList.map((v, i) => (
                <div key={i} className="p-4 rounded-2xl bg-[#FAF9F6] dark:bg-slate-800/70 border border-stone-200/70 dark:border-slate-700 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">{v.word} <span className="text-xs font-normal text-slate-400">({v.partOfSpeech})</span></span>
                    <button
                      onClick={() => {
                        onAddWords([{
                          id: `skill-${Date.now()}-${i}`, word: v.word, ipaUK: v.ipaUK, ipaUS: v.ipaUS, partOfSpeech: v.partOfSpeech,
                          vietnameseMeanings: [v.meaningVi], englishDefinition: v.meaningVi, exampleSentence: v.example, exampleTranslation: v.exampleVi,
                          topic: isSpeaking ? 'Speaking' : 'Writing', emoji: isSpeaking ? '🎙️' : '✍️', createdAt: Date.now(),
                          srs: { box: 1, reviewCount: 0, correctCount: 0, wrongCount: 0, forgetCount: 0, nextReviewAt: Date.now(), retentionScore: 40, intervalDays: 1 }
                        }]);
                        notify(`Đã lưu "${v.word}" vào kho!`);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-semibold cursor-pointer"
                    >
                      + Lưu từ
                    </button>
                  </div>
                  <div className="text-xs font-semibold">{v.meaningVi}</div>
                  <div className="text-xs italic text-slate-500">“{v.example}”</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold">🧩 Cấu trúc câu hay</h4>
            {pack.structures.map((s, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-[#FDF0F3]/60 dark:bg-slate-800 text-xs space-y-1">
                <div className="font-bold text-rose-800 dark:text-rose-300">{s.pattern}</div>
                <div>{s.noteVi}</div>
                <div className="italic text-slate-600 dark:text-slate-300">VD: “{s.example}”</div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-[#E8F3EE]/60 dark:bg-emerald-950/40 text-sm space-y-1">
            <div className="font-bold text-emerald-800 dark:text-emerald-300">✨ Bài mẫu tham khảo</div>
            <p className="leading-relaxed">{pack.modelSample}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 8: STATISTICS & WEAK WORDS
// ============================================================================
function StatsTab({ vocabulary, onSelectWord, onNavigate }) {
  const weakWords = useMemo(() => {
    return vocabulary
      .filter((w) => (w.srs?.forgetCount || 0) >= 2 || getEstimatedRetention(w) < 50)
      .sort((a, b) => getEstimatedRetention(a) - getEstimatedRetention(b));
  }, [vocabulary]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Phân tích Từ yếu & Dễ quên</h2>
          <p className="text-sm text-slate-500">Các từ có tỷ lệ nhớ thấp hoặc quên nhiều lần sẽ được ưu tiên ôn tập.</p>
        </div>
        <button onClick={() => onNavigate('review')} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold cursor-pointer">
          Ôn tập từ yếu ngay
        </button>
      </div>

      {weakWords.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 text-center text-sm text-slate-500">
          Tuyệt vời! Bạn chưa có từ nào bị đánh dấu là từ yếu.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weakWords.map((w) => (
            <div key={w.id} onClick={() => onSelectWord(w)} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-bold">{w.emoji} {w.word}</div>
                <div className="text-xs text-slate-500">{w.vietnameseMeanings?.join(', ')}</div>
              </div>
              <div className="text-right text-xs">
                <div className="font-bold text-rose-600">Độ nhớ: {getEstimatedRetention(w)}%</div>
                <div className="text-slate-400">Quên {w.srs?.forgetCount || 0} lần</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 9: SETTINGS & BACKUP
// ============================================================================
function SettingsTab({ settings, setSettings, vocabulary, setVocabulary, notify }) {
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(vocabulary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leximind-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    notify('Đã xuất file sao lưu JSON!');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Cài đặt hệ thống</h2>

      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Giọng phát âm mặc định</label>
          <select value={settings.accent} onChange={(e) => setSettings({ ...settings, accent: e.target.value })} className="w-full p-3 rounded-xl bg-[#FAF9F6] dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm">
            <option value="US">Anh - Mỹ (US Accent)</option>
            <option value="UK">Anh - Anh (UK Accent)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Gemini API Key (Tùy chọn nếu chưa gắn .env)</label>
          <input
            type="password"
            value={settings.customApiKey || ''}
            onChange={(e) => setSettings({ ...settings, customApiKey: e.target.value })}
            placeholder="AIzaSy..."
            className="w-full p-3 rounded-xl bg-[#FAF9F6] dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm"
          />
        </div>

        <div className="pt-2 flex flex-wrap gap-3">
          <button onClick={handleExport} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <Download className="w-4 h-4" /> Xuất file sao lưu dữ liệu (.JSON)
          </button>
          <button
            onClick={() => {
              setVocabulary(INITIAL_VOCABULARY);
              notify('Đã khôi phục 6 từ mẫu ban đầu.');
            }}
            className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
          >
            Khôi phục dữ liệu mẫu
          </button>
        </div>
      </div>
    </div>
  );
}
