import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { 
  Settings, Zap, BookOpen, TrendingUp, CheckCircle2, 
  Book, Sword, Activity, Terminal, Shield, Trophy, 
  Play, Pause, Layout, Cpu, Database, Clock
} from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';
import Logo from '../components/Logo';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [timeLeft, setTimeLeft] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Dungeon Raid State
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [activeQuestIndex, setActiveQuestIndex] = useState(null);

  // Global Stopwatch State (YTP Style)
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [totalSecondsToday, setTotalSecondsToday] = useState(0);

  // --- 1. DYNAMIC SYSTEM LOGIC (REACTIVE STATS) ---
  const stats = useMemo(() => {
    if (!playerData) return { stamina: 0, mana: 0, rank: "E-RANK" };

    // MANA: Percentage of daily hours completed (Reactive to Stopwatch)
    const targetSeconds = (playerData.studyHours || 1) * 3600;
    const currentSeconds = totalSecondsToday + sessionSeconds;
    const manaPercent = Math.min(Math.round((currentSeconds / targetSeconds) * 100), 100);

    // STAMINA: Progress to next Level (Based on XP)
    const currentXP = playerData.xp || 0;
    const xpTowardsNextLevel = currentXP % 500;
    const staminaPercent = Math.round((xpTowardsNextLevel / 500) * 100);

    // RANK: Based on Level
    let rank = "E-RANK";
    if (playerData.level > 50) rank = "S-RANK";
    else if (playerData.level > 35) rank = "A-RANK";
    else if (playerData.level > 20) rank = "B-RANK";
    else if (playerData.level > 10) rank = "C-RANK";
    else if (playerData.level > 5) rank = "D-RANK";

    return { mana: manaPercent, stamina: staminaPercent, rank };
  }, [playerData, totalSecondsToday, sessionSeconds]);

  // --- 2. DATABASE FETCHING ---
  const fetchLeaderboard = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("level", "desc"), limit(5));
      const querySnapshot = await getDocs(q);
      setLeaderboard(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.error("Leaderboard Offline", e); }
  };

  const generateNewDailyQuests = useCallback(async (userData) => {
    const today = new Date().toISOString().split('T')[0];
    const completed = userData.completedChapters || [];
    let newQuests = [];

    userData.books.forEach(userBookTitle => {
      const bookData = SYLLABUS_DATA.find(b => b.title === userBookTitle);
      if (bookData) {
        const nextChapter = bookData.chapters.find(chap => !completed.includes(`${userBookTitle}:${chap.title}`));
        if (nextChapter) {
          newQuests.push({ book: userBookTitle, topic: nextChapter.title, hours: nextChapter.hours || 2, completed: false });
        }
      }
    });

    await updateDoc(doc(db, "users", user.uid), { 
        currentQuests: newQuests, 
        lastQuestDate: today, 
        studyTimeToday: 0 
    });
    setDailyQuests(newQuests);
    setTotalSecondsToday(0);
  }, [user.uid]);

  const fetchPlayerData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const fetchedData = docSnap.data();
        setPlayerData(fetchedData);
        setTotalSecondsToday(fetchedData.studyTimeToday || 0);
        
        const today = new Date().toISOString().split('T')[0];
        if (fetchedData.lastQuestDate === today && fetchedData.currentQuests) {
          setDailyQuests(fetchedData.currentQuests);
        } else {
          generateNewDailyQuests(fetchedData);
        }
        fetchLeaderboard();
      } else {
        navigate('/onboarding');
      }
    } catch (e) { console.error("Sync Failure", e); }
    finally { setLoading(false); }
  }, [user, navigate, generateNewDailyQuests]);

  // --- 3. SYSTEM TIMERS ---
  useEffect(() => {
    fetchPlayerData();
    const interval = setInterval(() => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight - now;
      if (diff <= 0) window.location.reload();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchPlayerData]);

  useEffect(() => {
    let timerInterval = null;
    if (isTimerActive) {
      timerInterval = setInterval(() => setSessionSeconds(prev => prev + 1), 1000);
    } else {
      clearInterval(timerInterval);
    }
    return () => clearInterval(timerInterval);
  }, [isTimerActive]);

  // --- 4. SYSTEM ACTIONS ---
  const toggleStopwatch = async () => {
    if (isTimerActive) {
      const newTotal = totalSecondsToday + sessionSeconds;
      await updateDoc(doc(db, "users", user.uid), { studyTimeToday: newTotal });
      setTotalSecondsToday(newTotal);
      setSessionSeconds(0);
    }
    setIsTimerActive(!isTimerActive);
  };

  const clearQuest = async () => {
    if (activeQuestIndex === null) return;
    const updatedQuests = [...dailyQuests];
    updatedQuests[activeQuestIndex].completed = true;
    const quest = updatedQuests[activeQuestIndex];
    const chapterId = `${quest.book}:${quest.topic}`;
    const newHistory = [...(playerData.completedChapters || []), chapterId];
    const newXP = (playerData.xp || 0) + 100;
    const newLvl = Math.floor(newXP / 500) + 1;

    await updateDoc(doc(db, "users", user.uid), { 
      currentQuests: updatedQuests, 
      completedChapters: newHistory, 
      xp: newXP, 
      level: newLvl 
    });

    setDailyQuests(updatedQuests);
    setPlayerData({ ...playerData, level: newLvl, xp: newXP, completedChapters: newHistory });
    setIsRaidActive(false);
    setActiveQuestIndex(null);
  };

  const formatTime = (totalSecs) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center text-system-blue font-system italic animate-pulse tracking-[1em]">
      <Cpu className="mb-4 animate-spin" size={40} />
      SYNCHRONIZING_CORE...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-12 select-none overflow-x-hidden">
      
      {/* --- DUNGEON RAID INSTANCE OVERLAY --- */}
      {isRaidActive && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center border-4 border-red-900/10 backdrop-blur-md">
          <Sword className="text-red-600 mb-8 animate-bounce" size={80} />
          <h2 className="text-red-500 text-sm font-black tracking-[0.8em] mb-4 uppercase">Dungeon Instance Active</h2>
          <div className="text-center mb-16">
             <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-3 italic">Active Mission Objective</p>
             <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
               {dailyQuests[activeQuestIndex].topic}
             </h3>
          </div>
          
          <div className="flex flex-col gap-6 items-center">
            <button 
              onClick={() => clearQuest()} 
              className="px-24 py-5 bg-system-blue text-black font-black uppercase shadow-[0_0_40px_#00f2ff] hover:scale-105 transition-all tracking-[0.2em] italic"
            >
              Mark Objective Complete
            </button>
            <button 
              onClick={() => setIsRaidActive(false)} 
              className="text-gray-700 hover:text-white transition-colors uppercase text-[10px] tracking-[0.6em] font-bold mt-4"
            >
              Abandon Instance
            </button>
          </div>
          
          {/* Aesthetic Side HUD Elements */}
          <div className="absolute left-20 top-1/2 -translate-y-1/2 w-px h-96 bg-gradient-to-b from-transparent via-red-900 to-transparent"></div>
          <div className="absolute right-20 top-1/2 -translate-y-1/2 w-px h-96 bg-gradient-to-b from-transparent via-red-900 to-transparent"></div>
        </div>
      )}

      {/* --- HEADER HUD (THE TOP BAR) --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-900 pb-8 mb-12 gap-8 relative">
        <div className="flex items-center gap-8">
          <div className="relative group">
            <Logo size={75} />
            <div className="absolute -inset-2 bg-system-blue/10 blur-xl rounded-full group-hover:bg-system-blue/20 transition-all"></div>
          </div>
          <div>
            <h1 className="text-7xl font-black italic tracking-tighter text-white uppercase leading-none">
              {playerData?.name} <span className="text-system-blue text-3xl ml-3 font-normal">LVL {playerData?.level}</span>
            </h1>
            <div className="flex gap-4 mt-4">
              <span className="text-[10px] text-system-purple font-black tracking-[0.4em] uppercase border-2 border-system-purple/30 px-5 py-1 bg-system-purple/5 shadow-[0_0_10px_rgba(112,0,255,0.2)]">
                {stats.rank}
              </span>
              <span className="text-[10px] text-gray-500 font-bold border border-gray-800 px-4 py-1 uppercase tracking-widest">
                Class: {playerData?.studentType}
              </span>
            </div>
          </div>
        </div>

        {/* --- LIVE MANA STOPWATCH --- */}
        <div className="bg-[#0a0a0a] border-2 border-gray-800 p-5 flex items-center gap-12 shadow-2xl relative overflow-hidden group min-w-[380px]">
            <div 
              className="absolute top-0 left-0 h-full bg-system-blue/10 border-r border-system-blue/30 transition-all duration-1000" 
              style={{width: `${stats.mana}%`}}
            ></div>
            <div className="relative z-10 flex items-center gap-4">
                <Clock className={isTimerActive ? "text-system-blue animate-spin-slow" : "text-gray-700"} size={20} />
                <div>
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.4em] mb-1 italic">Mana Extraction Unit</p>
                    <div className="text-4xl font-black text-white tracking-tighter font-mono leading-none">
                        {formatTime(isTimerActive ? sessionSeconds : totalSecondsToday)}
                    </div>
                </div>
            </div>
            <button 
                onClick={toggleStopwatch}
                className={`relative z-10 p-5 rounded-full transition-all active:scale-90 ${isTimerActive ? 'bg-red-900/20 text-red-500 border-2 border-red-500 shadow-[0_0_20px_rgba(255,0,0,0.2)]' : 'bg-system-blue/20 text-system-blue border-2 border-system-blue shadow-[0_0_25px_rgba(0,242,255,0.4)]'}`}
            >
                {isTimerActive ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
            </button>
        </div>

        {/* --- SYSTEM ACTION CONTROLS --- */}
        <div className="flex items-center gap-6">
          <div className="text-right hidden xl:block">
            <p className="text-[10px] text-gray-600 font-black uppercase tracking-tighter">System Stability</p>
            <p className="text-xs font-mono text-system-accent tracking-widest font-bold uppercase animate-pulse">OPTIMIZED</p>
          </div>
          <button 
            onClick={() => navigate('/library')} 
            className="flex items-center gap-3 px-8 py-3 border-2 border-gray-800 hover:border-system-blue bg-black transition-all group shadow-xl"
          >
            <Book size={24} className="text-system-blue group-hover:scale-125 transition-transform" />
            <span className="text-[12px] font-black uppercase text-gray-500 group-hover:text-white tracking-[0.3em]">Archives</span>
          </button>
          <button 
            onClick={() => navigate('/settings')} 
            className="p-4 border-2 border-gray-800 rounded-sm hover:border-system-blue text-gray-500 hover:text-white transition-all bg-[#0a0a0a] group"
          >
            <Settings size={28} className="group-hover:rotate-90 transition-transform duration-700" />
          </button>
        </div>
      </div>

      {/* --- MAIN GRID LAYOUT --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* LEFT PANEL: REAL-TIME HUD STATUS */}
        <div className="lg:col-span-3 space-y-10">
          <div className="bg-[#080808] border-2 border-gray-900 p-8 shadow-2xl relative">
            <div className="flex justify-between text-[10px] font-black text-system-blue mb-3 uppercase tracking-[0.2em] italic">
              <span>Stamina (Sync)</span>
              <span>{stats.stamina}%</span>
            </div>
            <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
              <div 
                className="h-full bg-gradient-to-r from-system-blue to-blue-400 shadow-[0_0_15px_#00f2ff] transition-all duration-1000" 
                style={{width: `${stats.stamina}%`}}
              ></div>
            </div>
            
            <div className="flex justify-between text-[10px] font-black text-system-purple mt-8 mb-3 uppercase tracking-[0.2em] italic">
              <span>Mana (Output)</span>
              <span>{stats.mana}%</span>
            </div>
            <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
              <div 
                className="h-full bg-gradient-to-r from-system-purple to-purple-400 shadow-[0_0_15px_#7000ff] transition-all duration-1000" 
                style={{width: `${stats.mana}%`}}
              ></div>
            </div>
            <p className="text-[8px] text-gray-600 mt-6 font-mono text-center uppercase tracking-widest italic">Target Study: {playerData?.studyHours}H/Day</p>
          </div>

          {/* GLOBAL LEADERBOARD */}
          <div className="bg-[#080808] border-2 border-gray-900 p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-5"><Layout size={50} /></div>
            <h2 className="text-[12px] font-black text-system-blue uppercase tracking-[0.5em] mb-8 flex items-center gap-4 italic border-b border-gray-900 pb-2">
              <Trophy size={18}/> Top hunters
            </h2>
            <div className="space-y-5">
              {leaderboard.map((h, i) => (
                <div key={h.id} className="flex justify-between items-center text-[12px] border-b border-gray-900/50 pb-4 last:border-0 group cursor-default">
                  <span className="text-gray-500 uppercase italic font-bold group-hover:text-gray-300">0{i+1} {h.name}</span>
                  <span className="text-system-blue font-black tracking-tighter">LVL {h.level}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#080808] border-2 border-gray-900 p-8">
            <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.5em] mb-6 flex items-center gap-4 border-b border-gray-900 pb-2 italic">
              <Terminal size={16}/> System logs
            </h2>
            <div className="font-mono text-[10px] text-gray-600 space-y-2 italic leading-relaxed">
              <p>[System] User_{playerData?.name?.toUpperCase()} Identified.</p>
              <p>[Data] {playerData?.completedChapters?.length} Instances Cleared.</p>
              <p className="text-system-blue animate-pulse">[Alert] Chrono Reset: {timeLeft}</p>
              <p className="text-system-purple">[Task] Extracting daily mana...</p>
            </div>
          </div>
        </div>

        {/* CENTER PANEL: THE DIRECTIVES */}
        <div className="lg:col-span-6 space-y-10">
          <div className="flex justify-between items-end px-4 border-b border-gray-900 pb-4">
            <h2 className="text-4xl font-black text-white flex items-center gap-5 uppercase italic tracking-tighter">
              <Zap size={35} className="text-system-blue" fill="currentColor" /> Active directives
            </h2>
            <div className="text-[12px] font-mono text-system-blue bg-system-blue/10 px-6 py-2 border-2 border-system-blue/20 tracking-[0.3em] font-black uppercase shadow-lg">
              Next_Reset: {timeLeft}
            </div>
          </div>

          <div className="space-y-8">
            {dailyQuests.map((quest, i) => (
              <div 
                key={i} 
                className={`group relative border-2 transition-all duration-500 ${
                  quest.completed 
                  ? 'bg-black border-gray-900 opacity-40 shadow-none' 
                  : 'bg-[#0a0a0a] border-gray-800 hover:border-system-blue hover:shadow-[0_0_30px_rgba(0,242,255,0.1)]'
                } p-10`}
              >
                <div className="flex justify-between items-center relative z-10">
                  <div className="max-w-[75%]">
                    <p className="text-[11px] font-black text-system-blue uppercase tracking-[0.6em] mb-3 italic">
                      Grimoire: {quest.book.split(' - ')[0]}
                    </p>
                    <h3 className={`text-4xl font-black italic uppercase tracking-tighter leading-tight transition-colors ${quest.completed ? 'text-gray-600 line-through' : 'text-white group-hover:text-system-blue'}`}>
                      {quest.topic}
                    </h3>
                    {!quest.completed && (
                      <div className="flex items-center gap-6 mt-6">
                         <p className="text-[12px] text-gray-500 font-bold uppercase tracking-[0.4em] italic flex items-center gap-3">
                           <Activity size={14}/> Stamina Required: {quest.hours}H
                         </p>
                      </div>
                    )}
                  </div>
                  
                  {quest.completed ? (
                    <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 size={60} className="text-system-blue shadow-[0_0_15px_#00f2ff]" />
                        <span className="text-[10px] font-black text-system-blue uppercase tracking-widest">Instance Cleared</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setActiveQuestIndex(i); setIsRaidActive(true); }} 
                      className="border-2 border-system-blue text-system-blue px-14 py-5 font-black italic uppercase text-sm hover:bg-system-blue hover:text-black transition-all shadow-[0_0_25px_rgba(0,242,255,0.2)] flex items-center gap-4 active:scale-95"
                    >
                      <Sword size={20}/> Raid
                    </button>
                  )}
                </div>
                {/* Visual HUD Skew Background Effect */}
                <div className="absolute top-0 right-0 w-56 h-full bg-gradient-to-l from-system-blue/5 to-transparent skew-x-12 translate-x-32 pointer-events-none group-hover:translate-x-12 transition-transform duration-1000"></div>
                <div className="absolute bottom-0 left-0 w-2 h-0 group-hover:h-full bg-system-blue transition-all duration-500"></div>
              </div>
            ))}
            
            {dailyQuests.length === 0 && (
                <div className="p-20 border-2 border-dashed border-gray-900 text-center opacity-30">
                    <p className="text-xl font-black uppercase italic tracking-[1em]">All_Quests_Completed</p>
                </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: INVENTORY & RECENT LOGS */}
        <div className="lg:col-span-3 space-y-10">
          <div className="bg-[#080808] border-2 border-gray-900 p-8 shadow-2xl relative overflow-hidden">
             <div className="absolute -top-10 -right-10 opacity-5 rotate-12"><Cpu size={150}/></div>
             <h2 className="text-[12px] font-black text-system-purple uppercase tracking-[0.5em] mb-10 flex items-center gap-4 italic border-b border-gray-900 pb-2">
               <BookOpen size={20} className="text-system-purple" /> Inventory
             </h2>
             <div className="space-y-6">
               {playerData?.books?.map((b, i) => (
                 <div key={i} className="flex flex-col border-b-2 border-gray-900/50 pb-5 last:border-0 group cursor-default">
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] text-system-purple font-black uppercase tracking-[0.3em] italic opacity-60 group-hover:opacity-100">Slot: 0{i+1}</span>
                      <Shield size={12} className="text-gray-800" />
                   </div>
                   <span className="text-sm font-black text-gray-500 group-hover:text-white uppercase italic truncate transition-all leading-relaxed tracking-tight group-hover:translate-x-1">
                     {b}
                   </span>
                 </div>
               ))}
             </div>
          </div>

          <div className="bg-[#080808] border-2 border-gray-900 p-8">
             <h2 className="text-[12px] font-black text-gray-500 uppercase tracking-[0.5em] mb-8 flex items-center gap-4 italic border-b border-gray-900 pb-2">
               <TrendingUp size={18} className="text-system-blue" /> Conquests
             </h2>
             <div className="max-h-64 overflow-y-auto custom-scrollbar pr-4 space-y-5">
               {playerData?.completedChapters?.slice(-8).reverse().map((item, i) => (
                 <div key={i} className="text-[10px] border-l-4 border-system-blue pl-5 py-2 animate-in fade-in slide-in-from-left-4 bg-system-blue/5 border-r border-y border-gray-900">
                    <p className="text-gray-500 text-[8px] font-black uppercase mb-1">{item.split(':')[0]}</p>
                    <p className="text-white font-black leading-tight uppercase italic tracking-tighter">
                      {item.split(':')[1]}
                    </p>
                 </div>
               ))}
               {(!playerData?.completedChapters || playerData.completedChapters.length === 0) && (
                   <p className="text-[10px] text-gray-800 uppercase font-bold italic text-center">No_Record_Found</p>
               )}
             </div>
          </div>

          {/* FOOTER METADATA */}
          <div className="p-4 bg-system-blue/5 border-2 border-gray-900 flex items-center justify-between">
              <Database size={14} className="text-gray-800" />
              <p className="text-[8px] text-gray-700 font-mono tracking-widest uppercase font-black italic">
                Secure_Cloud_Link: ACTIVE
              </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;