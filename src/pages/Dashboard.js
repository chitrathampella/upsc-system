import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
// Added Book here to fix the "Book is not defined" error
import { Settings, Zap, BookOpen, TrendingUp, CheckCircle2, Book } from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';
import Logo from '../components/Logo';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [timeLeft, setTimeLeft] = useState("");

  // --- QUEST GENERATION LOGIC ---
  const generateNewDailyQuests = useCallback(async (userData) => {
    const today = new Date().toISOString().split('T')[0];
    const completed = userData.completedChapters || [];
    let newQuests = [];

    userData.books.forEach(userBookTitle => {
      const bookData = SYLLABUS_DATA.find(b => b.title === userBookTitle);
      if (bookData) {
        const nextChapter = bookData.chapters.find(chap => 
          !completed.includes(`${userBookTitle}:${chap.title}`)
        );
        if (nextChapter) {
          newQuests.push({ 
            book: userBookTitle, 
            topic: nextChapter.title, 
            hours: nextChapter.hours || 2, 
            completed: false 
          });
        }
      }
    });

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      currentQuests: newQuests,
      lastQuestDate: today
    });
    setDailyQuests(newQuests);
  }, [user.uid]);

  // --- DATA FETCHING (Fixed Scoping Error) ---
  const fetchPlayerData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const fetchedData = docSnap.data(); // This fixes 'data is not defined'
        setPlayerData(fetchedData);
        
        const today = new Date().toISOString().split('T')[0];
        if (fetchedData.lastQuestDate === today && fetchedData.currentQuests) {
          setDailyQuests(fetchedData.currentQuests);
        } else {
          generateNewDailyQuests(fetchedData);
        }
      } else {
        navigate('/onboarding');
      }
    } catch (e) {
      console.error("System Error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, navigate, generateNewDailyQuests]);

  useEffect(() => {
    fetchPlayerData();
    const timer = setInterval(() => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight - now;
      if (diff <= 0) window.location.reload();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchPlayerData]);

  const clearQuest = async (index) => {
    const updatedQuests = [...dailyQuests];
    const quest = updatedQuests[index];
    if (quest.completed) return;

    updatedQuests[index].completed = true;
    const chapterId = `${quest.book}:${quest.topic}`;
    const newHistory = [...(playerData.completedChapters || []), chapterId];
    const newXP = (playerData.xp || 0) + 100;
    const newLvl = Math.floor(newXP / 500) + 1;

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      currentQuests: updatedQuests,
      completedChapters: newHistory,
      xp: newXP,
      level: newLvl
    });

    setDailyQuests(updatedQuests);
    setPlayerData({ ...playerData, level: newLvl, xp: newXP, completedChapters: newHistory });
  };

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic text-2xl animate-pulse tracking-[0.5em]">
      RE-SYNCING SYSTEM...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-6 md:p-12 select-none">
      
      {/* HUD HEADER */}
      <div className="flex justify-between items-end border-b-2 border-gray-900 pb-8 mb-12 gap-6">
        <div className="flex items-center gap-6">
          <Logo size={60} />
          <div>
            <h1 className="text-7xl font-black italic tracking-tighter text-white uppercase leading-none">
              {playerData?.name} <span className="text-system-blue text-3xl ml-2 font-normal">LVL {playerData?.level}</span>
            </h1>
            <p className="text-[10px] text-system-purple font-bold tracking-[0.4em] uppercase mt-2">RANK: E-RANK HUNTER</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/library')} 
            className="flex items-center gap-2 px-6 py-2 border-2 border-gray-800 hover:border-system-blue transition-all group"
          >
            <Book size={18} className="text-system-blue group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white">Library</span>
          </button>
          <button onClick={() => navigate('/settings')} className="p-2 text-gray-600 hover:text-system-blue transition-all">
            <Settings size={28} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* LEFT: CONQUEST LOG */}
        <div className="lg:col-span-3">
          <h2 className="text-xs font-black text-gray-500 flex items-center gap-3 uppercase tracking-[0.4em] mb-8 italic">
            <TrendingUp size={16} className="text-system-blue" /> Conquest Log
          </h2>
          <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-4 border-l border-gray-900">
            {playerData?.completedChapters?.slice().reverse().map((item, i) => (
              <div key={i} className="border-l-2 border-system-blue pl-6 py-3 bg-system-blue/5">
                <p className="text-[9px] text-system-blue font-bold uppercase tracking-widest">{item.split(':')[0]}</p>
                <p className="text-sm font-black text-white uppercase italic mt-1">{item.split(':')[1]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: SYSTEM DIRECTIVES (Slanted Wide Cards) */}
        <div className="lg:col-span-6 space-y-8">
          <div className="flex justify-between items-center mb-6 px-2">
            <h2 className="text-3xl font-black text-system-blue flex items-center gap-4 uppercase italic tracking-widest">
              <Zap size={30} fill="currentColor" /> System Directives
            </h2>
            <div className="text-right bg-system-blue/5 border border-system-blue/20 px-4 py-2">
                <span className="text-[10px] font-mono text-system-blue font-bold uppercase tracking-[0.2em]">RESET: {timeLeft}</span>
            </div>
          </div>

          <div className="space-y-6">
            {dailyQuests.map((quest, i) => (
              <div 
                key={i} 
                className={`group relative overflow-hidden border-2 transition-all duration-300 ${
                  quest.completed 
                  ? 'bg-black/40 border-gray-800 opacity-40' 
                  : 'bg-[#0a0a0a] border-gray-800 hover:border-system-blue shadow-2xl'
                } p-10`}
              >
                <div className="relative z-10 flex justify-between items-center">
                  <div className="max-w-[75%]">
                    <p className="text-[10px] font-black text-system-blue uppercase tracking-[0.4em] mb-2">TARGET: {quest.book.split(' - ')[0]}</p>
                    <h3 className={`text-5xl font-black italic tracking-tighter transition-colors uppercase leading-tight ${quest.completed ? 'text-gray-600 line-through' : 'text-white group-hover:text-system-blue'}`}>
                      {quest.topic}
                    </h3>
                    {!quest.completed && <p className="text-[10px] text-gray-500 font-bold mt-4 uppercase tracking-[0.3em]">Estimated Stamina: {quest.hours} Hours</p>}
                  </div>
                  {quest.completed ? (
                    <div className="flex flex-col items-center">
                        <CheckCircle2 size={40} className="text-system-blue" />
                        <span className="text-[8px] font-black text-system-blue uppercase mt-2">Cleared</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => clearQuest(i)}
                      className="border-2 border-system-blue text-system-blue px-10 py-4 font-black italic uppercase text-sm hover:bg-system-blue hover:text-black transition-all shadow-[0_0_20px_rgba(0,242,255,0.2)]"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {/* Visual HUD Skew */}
                <div className="absolute top-0 right-0 w-48 h-full bg-gradient-to-l from-system-blue/10 to-transparent skew-x-12 translate-x-24 pointer-events-none group-hover:translate-x-10 transition-transform duration-700"></div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: INVENTORY */}
        <div className="lg:col-span-3">
          <h2 className="text-xs font-black text-system-purple flex items-center gap-3 uppercase tracking-[0.4em] mb-8 italic">
            <BookOpen size={18} className="text-system-purple" /> Inventory
          </h2>
          <div className="bg-[#080808] border border-gray-900 p-8 space-y-6">
            {playerData?.books?.map((b, i) => (
              <div key={i} className="flex flex-col group border-b border-gray-900/50 pb-4 last:border-0">
                <span className="text-[9px] text-system-purple font-bold uppercase mb-1 tracking-widest italic">Item Slot: 0{i+1}</span>
                <span className="text-[11px] font-black text-gray-500 group-hover:text-white transition-colors uppercase italic tracking-tighter leading-tight">{b}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;