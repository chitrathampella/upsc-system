import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Settings, Zap, BookOpen, TrendingUp, CheckCircle2, Shield, Activity, Terminal } from 'lucide-react';

const SYLLABUS = {
  "M. Laxmikant - Polity": ["Historical Background", "Making of Constitution", "Salient Features", "Preamble", "Union and Territory", "Citizenship", "Fundamental Rights", "DPSP", "Fundamental Duties", "Parliament"],
  "Spectrum - Modern History": ["Sources of History", "Advent of Europeans", "British Expansion", "Revolt of 1857", "Social Reformers", "INC Foundation", "Gandhian Era"],
  "Ramesh Singh - Economy": ["Intro to Economics", "Growth & Development", "Evolution of Economy", "Planning", "Economic Reforms", "Inflation", "Banking"],
  "GC Leong - Geography": ["The Universe", "Earth's Crust", "Vulcanism", "Weathering", "Running Water", "Glaciation", "Climate Zones"]
};

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    fetchPlayerData();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [user]);

  const updateTimer = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;

    if (diff <= 0) {
      window.location.reload(); // Hard reset at midnight
    }

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    
    // Formatting to HH:MM:SS
    setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
  };

  const fetchPlayerData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlayerData(data);
        
        const today = new Date().toISOString().split('T')[0];
        if (data.lastQuestDate === today && data.currentQuests) {
          setDailyQuests(data.currentQuests);
        } else {
          generateNewDailyQuests(data);
        }
      } else {
        navigate('/onboarding');
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user, navigate]); // Added dependencies here

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

  const generateNewDailyQuests = async (data) => {
    const today = new Date().toISOString().split('T')[0];
    const completed = data.completedChapters || [];
    let newQuests = [];

    data.books.forEach(book => {
      const nextTopic = SYLLABUS[book]?.find(chap => !completed.includes(`${book}:${chap}`));
      if (nextTopic) {
        newQuests.push({ book, topic: nextTopic, completed: false });
      }
    });

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      currentQuests: newQuests,
      lastQuestDate: today
    });
    setDailyQuests(newQuests);
  };

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

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic text-2xl animate-pulse">SYNCHRONIZING WITH SYSTEM...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-6 md:p-10 select-none">
      
      {/* --- HUD STATUS WINDOW (Top Bar) --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-gray-900 pb-6 mb-10 gap-6">
        <div className="relative">
          <h1 className="text-6xl font-black italic tracking-tighter text-white uppercase leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            {playerData?.name} <span className="text-system-blue text-2xl ml-2 font-normal">LVL {playerData?.level}</span>
          </h1>
          <div className="flex gap-4 mt-3">
             <span className="text-[10px] text-system-purple font-bold tracking-[0.4em] uppercase border border-system-purple/30 px-3 py-0.5 bg-system-purple/5">E-RANK HUNTER</span>
             <span className="text-[10px] text-gray-500 font-bold tracking-[0.4em] uppercase border border-gray-800 px-3 py-0.5">CLASS: {playerData?.studentType}</span>
          </div>
        </div>

        <div className="flex-1 max-w-sm hidden lg:block px-10">
            <div className="flex justify-between text-[9px] font-bold text-system-blue mb-1 uppercase tracking-widest">
                <span>Stamina (Daily Streak)</span>
                <span>100%</span>
            </div>
            <div className="h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                <div className="h-full bg-system-blue shadow-[0_0_10px_#00f2ff]" style={{width: '85%'}}></div>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-system-purple mt-3 mb-1 uppercase tracking-widest">
                <span>Mana (Study Hours)</span>
                <span>{playerData?.studyHours}H / {playerData?.studyHours}H</span>
            </div>
            <div className="h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                <div className="h-full bg-system-purple shadow-[0_0_10px_#7000ff]" style={{width: '100%'}}></div>
            </div>
        </div>

        <div className="flex items-center gap-6">
            <div className="text-right">
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">System Version</p>
                <p className="text-xs font-mono text-white tracking-widest">v2.4.0_UPSC</p>
            </div>
            <button 
              onClick={() => navigate('/settings')} 
              className="p-3 border-2 border-gray-800 rounded-sm hover:border-system-blue hover:bg-system-blue/5 text-gray-500 hover:text-white transition-all group"
            >
              <Settings size={24} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT: MEMORY BANK (Syllabus Conquest) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#080808] border border-gray-900 p-6 rounded-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 opacity-10"><Activity size={40} /></div>
             <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
               <TrendingUp size={16} className="text-system-blue" /> Conquest Log
             </h2>
             <div className="space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
               {playerData?.completedChapters?.slice().reverse().map((item, i) => (
                 <div key={i} className="group border-l-2 border-system-blue pl-4 py-2 hover:bg-system-blue/5 transition-all">
                   <p className="text-[8px] text-system-blue font-bold uppercase tracking-widest mb-1">{item.split(':')[0]}</p>
                   <p className="text-[11px] font-black text-white uppercase italic tracking-tight">{item.split(':')[1]}</p>
                 </div>
               ))}
               {(!playerData?.completedChapters || playerData.completedChapters.length === 0) && (
                 <div className="text-[10px] text-gray-700 font-mono italic p-4 border border-dashed border-gray-900">
                    EMPTY_RECORD: No dungeons cleared.
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* CENTER: DAILY DIRECTIVES */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex justify-between items-end px-2 border-b border-gray-900 pb-2">
            <h2 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-[0.1em] italic">
              <Zap size={24} className="text-system-blue" fill="currentColor" /> System Directives
            </h2>
            <div className="bg-system-blue/5 border border-system-blue/20 px-4 py-1">
                <span className="text-[10px] font-mono text-system-blue font-bold uppercase tracking-[0.2em]">RESET IN: {timeLeft}</span>
            </div>
          </div>

          <div className="space-y-4">
            {dailyQuests.map((quest, i) => (
              <div 
                key={i} 
                className={`group relative overflow-hidden border-2 transition-all duration-300 ${
                  quest.completed 
                  ? 'bg-black/40 border-gray-900 opacity-40 shadow-none' 
                  : 'bg-[#0a0a0a] border-gray-800 hover:border-system-blue shadow-[0_0_20px_rgba(0,0,0,0.5)]'
                } p-6`}
              >
                <div className="flex justify-between items-center relative z-10">
                  <div className="max-w-[70%]">
                    <div className="flex items-center gap-3 mb-2">
                       <span className="text-[9px] font-black text-system-blue uppercase tracking-[0.3em]">{quest.book.split(' - ')[0]}</span>
                       <div className="w-1 h-1 bg-gray-700 rounded-full"></div>
                       <span className="text-[9px] font-bold text-gray-600 uppercase">Quest ID: {1000 + i}</span>
                    </div>
                    <h3 className={`text-2xl font-black italic uppercase tracking-tighter transition-colors ${quest.completed ? 'text-gray-600 line-through' : 'text-white group-hover:text-system-blue'}`}>
                      {quest.topic}
                    </h3>
                  </div>
                  {quest.completed ? (
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle2 size={32} className="text-system-blue" />
                      <span className="text-[8px] font-black text-system-blue uppercase">Cleared</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => clearQuest(i)}
                      className="border-2 border-system-blue text-system-blue px-8 py-2 font-black italic uppercase text-xs hover:bg-system-blue hover:text-black transition-all active:scale-95 shadow-[0_0_15px_rgba(0,242,255,0.1)]"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {/* Visual HUD Skew */}
                <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-system-blue/5 to-transparent skew-x-12 translate-x-20 group-hover:translate-x-10 transition-transform duration-700"></div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: INVENTORY (Grimoires) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#080808] border border-gray-900 p-6 rounded-sm">
             <h2 className="text-[11px] font-black text-system-purple uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
               <BookOpen size={16} className="text-system-purple" /> Grimoires
             </h2>
             <div className="space-y-4">
               {playerData?.books?.map((b, i) => (
                 <div key={i} className="flex flex-col group border-b border-gray-900/50 pb-3 last:border-0 cursor-default">
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-[8px] text-system-purple font-bold uppercase tracking-widest italic">Item Slot: 0{i+1}</span>
                      <Shield size={10} className="text-gray-800" />
                   </div>
                   <span className="text-xs font-bold text-gray-500 group-hover:text-white transition-colors uppercase italic tracking-tight">{b}</span>
                 </div>
               ))}
             </div>
          </div>

          <div className="p-4 bg-system-blue/5 border-l-2 border-system-blue">
              <div className="flex items-center gap-2 mb-2">
                 <Terminal size={14} className="text-system-blue" />
                 <span className="text-[9px] font-black text-white uppercase tracking-widest">System Message</span>
              </div>
              <p className="text-[10px] text-gray-500 font-mono leading-relaxed italic">
                Daily stamina replenished at 00:00. Unfinished quests will result in a Penalty.
              </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;