import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { 
  Settings, Zap, BookOpen, TrendingUp, CheckCircle2, 
  Book, Sword, Activity, Terminal, Shield, Trophy, 
  Play, Pause, Layout, Cpu, Database, Clock, AlertTriangle
} from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';
import Logo from '../components/Logo';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [backlog, setBacklog] = useState([]); // Penalty Quests
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

    // MANA: Reactive to live Stopwatch vs Daily Goal
    const targetSeconds = (playerData.studyHours || 4) * 3600;
    const currentSeconds = totalSecondsToday + sessionSeconds;
    const manaPercent = Math.min(Math.round((currentSeconds / targetSeconds) * 100), 100);

    // STAMINA: Progress to next Level (Based on XP % 500)
    const currentXP = playerData.xp || 0;
    const xpTowardsNextLevel = currentXP % 500;
    const staminaPercent = Math.round((xpTowardsNextLevel / 500) * 100);

    let rank = "E-RANK";
    if (playerData.level > 50) rank = "S-RANK";
    else if (playerData.level > 20) rank = "B-RANK";
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

  const generateNewDailyQuests = useCallback(async (userData, oldQuests = []) => {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
    const completed = userData.completedChapters || [];
    
    // BACKLOG LOGIC: Migrate unfinished quests to penalty
    const unfinished = oldQuests.filter(q => !q.completed);
    const newBacklog = [...(userData.backlog || []), ...unfinished];

    let newQuests = [];

    // --- WEEKEND OVERRIDE ---
    if (dayOfWeek === 6) { // SATURDAY
        newQuests.push({ book: "SYSTEM", topic: "Weekly Current Affairs Recap", hours: 3, completed: false, type: 'special' });
        newQuests.push({ book: "MAINTENANCE", topic: "Core Revision: All Weekly Topics", hours: userData.studyHours, completed: false, type: 'special' });
    } else if (dayOfWeek === 0) { // SUNDAY
        newQuests.push({ book: "EMERGENCY", topic: "Full Length Mock Dungeon (GS + CSAT)", hours: 4, completed: false, type: 'emergency' });
    } else {
        // WEEKDAYS
        userData.books.forEach(userBookTitle => {
          const bookData = SYLLABUS_DATA.find(b => 
            b.title === userBookTitle || userBookTitle.toLowerCase().includes(b.subject.toLowerCase())
          );
          if (bookData) {
            const next = bookData.chapters.find(chap => !completed.some(c => c.includes(chap.title)));
            if (next) newQuests.push({ book: bookData.title, topic: next.title, hours: next.hours || 2, completed: false });
          }
        });
    }

    await updateDoc(doc(db, "users", user.uid), { 
        currentQuests: newQuests, 
        lastQuestDate: today, 
        backlog: newBacklog,
        studyTimeToday: 0 
    });
    setDailyQuests(newQuests);
    setBacklog(newBacklog);
    setTotalSecondsToday(0);
  }, [user.uid]);

  const fetchPlayerData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlayerData(data);
        setTotalSecondsToday(data.studyTimeToday || 0);
        setBacklog(data.backlog || []);
        
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const currentIsSpecial = data.currentQuests?.some(q => q.type === 'special' || q.type === 'emergency');

        // Check if day changed OR if it's weekend but we still have weekday quests
        if (data.lastQuestDate !== today || (isWeekend && !currentIsSpecial)) {
          generateNewDailyQuests(data, data.currentQuests || []);
        } else {
          setDailyQuests(data.currentQuests || []);
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

  const clearQuest = async (index, isBacklog = false) => {
    const targetIdx = index !== undefined ? index : activeQuestIndex;
    const updatedQuests = isBacklog ? [...backlog] : [...dailyQuests];
    const quest = updatedQuests[targetIdx];
    
    const chapterId = `${quest.book}:${quest.topic}`;
    const newHistory = quest.type ? (playerData.completedChapters || []) : [...(playerData.completedChapters || []), chapterId];
    
    const newXP = (playerData.xp || 0) + 100;
    const newLvl = Math.floor(newXP / 500) + 1;

    // Update time based on cleared quest (1 hour boost)
    const newTime = (playerData.studyTimeToday || 0) + 3600;

    const updateObj = { 
        completedChapters: newHistory, 
        xp: newXP, 
        level: newLvl, 
        studyTimeToday: newTime 
    };

    if (isBacklog) {
        const filteredBacklog = backlog.filter((_, i) => i !== targetIdx);
        updateObj.backlog = filteredBacklog;
        setBacklog(filteredBacklog);
    } else {
        updatedQuests[targetIdx].completed = true;
        updateObj.currentQuests = updatedQuests;
        setDailyQuests(updatedQuests);
    }

    await updateDoc(doc(db, "users", user.uid), updateObj);
    setPlayerData({ ...playerData, level: newLvl, xp: newXP, completedChapters: newHistory, studyTimeToday: newTime });
    setTotalSecondsToday(newTime);
    setIsRaidActive(false);
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
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-6 select-none overflow-x-hidden">
      
      {/* --- DUNGEON RAID INSTANCE OVERLAY --- */}
      {isRaidActive && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center border-4 border-red-900/10 backdrop-blur-md">
          <Sword className="text-red-600 mb-8 animate-bounce" size={80} />
          <h2 className="text-red-500 text-sm font-black tracking-[0.8em] mb-4 uppercase">Dungeon Instance Active</h2>
          <div className="text-center mb-10">
             <p className="text-gray-600 text-[8px] uppercase tracking-widest mb-1 italic">Active Mission Objective</p>
             <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
               {dailyQuests[activeQuestIndex].topic}
             </h3>
          </div>
          
          <div className="flex flex-col gap-4 items-center">
            <button 
              onClick={() => clearQuest()} 
              className="px-16 py-3 bg-system-blue text-black font-black uppercase shadow-[0_0_30px_#00f2ff] hover:scale-105 transition-all tracking-[0.2em] italic text-sm"
            >
              Clear quest
            </button>
            <button 
              onClick={() => setIsRaidActive(false)} 
              className="text-gray-700 hover:text-white transition-colors uppercase text-[9px] tracking-[0.6em] font-bold mt-2"
            >
              Abandon Instance
            </button>
          </div>
          
          {/* Aesthetic Side HUD Elements */}
          <div className="absolute left-20 top-1/2 -translate-y-1/2 w-px h-96 bg-gradient-to-b from-transparent via-red-900 to-transparent"></div>
          <div className="absolute right-20 top-1/2 -translate-y-1/2 w-px h-96 bg-gradient-to-b from-transparent via-red-900 to-transparent"></div>
        </div>
      )}

      {/* --- HEADER HUD --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-900 pb-4 mb-8 gap-6 relative">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <Logo size={50} />
            <div className="absolute -inset-1 bg-system-blue/10 blur-md rounded-full"></div>
          </div>
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
              {playerData?.name} <span className="text-system-blue text-xl ml-2 font-normal">LVL {playerData?.level}</span>
            </h1>
            <div className="flex gap-3 mt-2">
              <span className="text-[8px] text-system-purple font-black tracking-[0.4em] uppercase border border-system-purple/30 px-3 py-0.5 bg-system-purple/5 shadow-[0_0_10px_rgba(112,0,255,0.1)]">
                {stats.rank}
              </span>
              <span className="text-[8px] text-gray-500 font-bold border border-gray-800 px-3 py-0.5 uppercase tracking-widest">
                Class: {playerData?.studentType}
              </span>
            </div>
          </div>
        </div>

        {/* --- LIVE MANA STOPWATCH --- */}
        <div className="bg-[#0a0a0a] border-2 border-gray-800 p-3 flex items-center gap-8 shadow-xl relative overflow-hidden group min-w-[280px]">
            <div 
              className="absolute top-0 left-0 h-full bg-system-blue/5 border-r border-system-blue/20 transition-all duration-1000" 
              style={{width: `${stats.mana}%`}}
            ></div>
            <div className="relative z-10 flex items-center gap-3">
                <Clock className={isTimerActive ? "text-system-blue animate-spin-slow" : "text-gray-700"} size={16} />
                <div>
                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.3em] mb-0.5 italic">Mana extraction</p>
                    <div className="text-2xl font-black text-white tracking-tighter font-mono leading-none">
                        {formatTime(isTimerActive ? sessionSeconds : totalSecondsToday)}
                    </div>
                </div>
            </div>
            <button 
                onClick={toggleStopwatch}
                className={`relative z-10 p-3 rounded-full transition-all active:scale-90 ${isTimerActive ? 'bg-red-900/20 text-red-500 border border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.1)]' : 'bg-system-blue/20 text-system-blue border border-system-blue shadow-[0_0_20px_rgba(0,242,255,0.3)]'}`}
            >
                {isTimerActive ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden xl:block">
            <p className="text-[8px] text-gray-600 font-black uppercase tracking-tighter">Stability</p>
            <p className="text-[10px] font-mono text-system-accent tracking-widest font-bold uppercase animate-pulse">OPTIMIZED</p>
          </div>
          <button 
            onClick={() => navigate('/library')} 
            className="flex items-center gap-2 px-5 py-2 border border-gray-800 hover:border-system-blue bg-black transition-all group"
          >
            <Book size={18} className="text-system-blue group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-black uppercase text-gray-500 group-hover:text-white tracking-[0.2em]">Archives</span>
          </button>
          <button 
            onClick={() => navigate('/settings')} 
            className="p-2 border border-gray-800 rounded-sm hover:border-system-blue text-gray-500 hover:text-white transition-all bg-[#0a0a0a] group"
          >
            <Settings size={20} className="group-hover:rotate-90 transition-transform duration-700" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT PANEL */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#080808] border-2 border-gray-900 p-5 shadow-xl relative">
            <div className="flex justify-between text-[8px] font-black text-system-blue mb-2 uppercase tracking-[0.2em] italic">
              <span>Stamina (Sync)</span>
              <span>{stats.stamina}%</span>
            </div>
            <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
              <div 
                className="h-full bg-system-blue shadow-[0_0_10px_#00f2ff] transition-all duration-1000" 
                style={{width: `${stats.stamina}%`}}
              ></div>
            </div>
            
            <div className="flex justify-between text-[8px] font-black text-system-purple mt-5 mb-2 uppercase tracking-[0.2em] italic">
              <span>Mana (Output)</span>
              <span>{stats.mana}%</span>
            </div>
            <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
              <div 
                className="h-full bg-system-purple shadow-[0_0_10px_#7000ff] transition-all duration-1000" 
                style={{width: `${stats.mana}%`}}
              ></div>
            </div>
            <p className="text-[7px] text-gray-600 mt-4 font-mono text-center uppercase tracking-widest italic font-bold">Target: {playerData?.studyHours}H/Day</p>
          </div>

          {/* BACKLOG PANEL */}
          {backlog.length > 0 && (
            <div className="bg-red-950/10 border-2 border-red-900/30 p-5 shadow-xl">
                <h2 className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-3 italic"><AlertTriangle size={14}/> Penalty Quests</h2>
                <div className="space-y-3">
                    {backlog.map((q, i) => (
                        <div key={i} className="flex justify-between items-center group">
                            <div>
                                <p className="text-[7px] text-red-900 font-bold uppercase">{q.book.split(' ')[0]}</p>
                                <p className="text-[9px] text-white font-black uppercase italic truncate max-w-[120px]">{q.topic}</p>
                            </div>
                            <button onClick={() => clearQuest(i, true)} className="border border-red-900 text-red-600 px-3 py-1 text-[8px] font-black uppercase hover:bg-red-600 hover:text-white transition-all italic">Clear</button>
                        </div>
                    ))}
                </div>
            </div>
          )}

          <div className="bg-[#080808] border border-gray-900 p-5 relative overflow-hidden">
            <h2 className="text-[10px] font-black text-system-blue uppercase tracking-[0.4em] mb-5 flex items-center gap-3 italic border-b border-gray-900 pb-1.5">
              <Trophy size={14}/> Top hunters
            </h2>
            <div className="space-y-3">
              {leaderboard.map((h, i) => (
                <div key={h.id} className="flex justify-between items-center text-[10px] border-b border-gray-900/50 pb-2 last:border-0 group cursor-default">
                  <span className="text-gray-500 uppercase italic font-bold">0{i+1} {h.name}</span>
                  <span className="text-system-blue font-black tracking-tighter">LVL {h.level}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#080808] border border-gray-900 p-5">
            <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-3 border-b border-gray-900 pb-1.5 italic">
              <Terminal size={14}/> System logs
            </h2>
            <div className="font-mono text-[8px] text-gray-600 space-y-1.5 italic">
              <p>[System] User_Identity Verified.</p>
              <p>[Data] {playerData?.completedChapters?.length} Instances Cleared.</p>
              <p className="text-system-blue animate-pulse">[Reset] {timeLeft}</p>
              <p className="text-system-purple">[Task] Extracting daily mana...</p>
            </div>
          </div>
        </div>

        {/* CENTER PANEL (COMPACT TO-DO) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex justify-between items-end px-2 border-b border-gray-900 pb-2">
            <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
              <Zap size={20} className="text-system-blue" fill="currentColor" /> Active directives
            </h2>
            <div className="text-[9px] font-mono text-system-blue border border-gray-800 px-3 py-0.5 tracking-widest font-black uppercase italic">
              Reset: {timeLeft}
            </div>
          </div>

          <div className="space-y-4">
            {dailyQuests.map((quest, i) => (
              <div 
                key={i} 
                className={`group relative border transition-all duration-300 ${
                  quest.completed 
                  ? 'bg-black/40 border-gray-900 opacity-40 shadow-none' 
                  : 'bg-[#0a0a0a] border-gray-800 hover:border-system-blue shadow-lg shadow-black'
                } p-6 overflow-hidden`}
              >
                <div className="flex justify-between items-center relative z-10">
                  <div className="max-w-[75%]">
                    <p className={`text-[8px] font-black uppercase tracking-[0.4em] mb-1 italic ${quest.type === 'emergency' ? 'text-red-600' : 'text-system-blue'}`}>
                      {quest.type ? quest.book : `Grimoire: ${quest.book.split(' - ')[0]}`}
                    </p>
                    <h3 className={`text-xl font-black italic uppercase tracking-tighter leading-tight ${quest.completed ? 'text-gray-600 line-through' : 'text-white group-hover:text-system-blue'}`}>
                      {quest.topic}
                    </h3>
                    {!quest.completed && <p className="text-[9px] text-gray-600 font-bold mt-3 uppercase tracking-[0.2em] italic">Stamina Req: {quest.hours}H</p>}
                  </div>
                  
                  {quest.completed ? (
                    <CheckCircle2 size={35} className="text-system-blue shadow-[0_0_10px_#00f2ff]" />
                  ) : (
                    <button 
                      onClick={() => { setActiveQuestIndex(i); setIsRaidActive(true); }} 
                      className={`border-2 px-8 py-2.5 font-black italic uppercase text-[10px] transition-all active:scale-95 ${quest.type === 'emergency' ? 'border-red-600 text-red-600 hover:bg-red-600 hover:text-black shadow-[0_0_15px_rgba(255,0,0,0.2)]' : 'border-system-blue text-system-blue hover:bg-system-blue hover:text-black shadow-[0_0_15px_rgba(0,242,255,0.1)]'}`}
                    >
                      {quest.type === 'emergency' ? 'RAID DUNGEON' : 'Raid'}
                    </button>
                  )}
                </div>
                <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-system-blue/5 to-transparent skew-x-12 translate-x-12 group-hover:translate-x-6 transition-transform duration-700"></div>
              </div>
            ))}
            {dailyQuests.length === 0 && (
                <div className="p-10 border border-dashed border-gray-900 text-center opacity-30">
                    <p className="text-sm font-black uppercase italic tracking-[0.5em]">All_Quests_Completed</p>
                </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#080808] border-2 border-gray-900 p-5 shadow-2xl relative overflow-hidden">
             <div className="absolute -top-5 -right-5 opacity-5 rotate-12"><Cpu size={100}/></div>
             <h2 className="text-[10px] font-black text-system-purple uppercase tracking-[0.5em] mb-6 flex items-center gap-3 italic border-b border-gray-900 pb-1.5">
               <BookOpen size={16} className="text-system-purple" /> Inventory
             </h2>
             <div className="space-y-4">
               {playerData?.books?.map((b, i) => (
                 <div key={i} className="flex flex-col border-b border-gray-900/50 pb-3 last:border-0 group cursor-default">
                   <span className="text-[7px] text-system-purple font-black uppercase mb-0.5 italic">Slot: 0{i+1}</span>
                   <span className="text-[10px] font-black text-gray-500 group-hover:text-white uppercase italic truncate tracking-tight transition-all group-hover:translate-x-1">
                     {b}
                   </span>
                 </div>
               ))}
             </div>
          </div>

          <div className="bg-[#080808] border border-gray-900 p-5">
             <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-3 italic border-b border-gray-900 pb-1.5">
               <TrendingUp size={14} className="text-system-blue" /> Conquests
             </h2>
             <div className="max-h-40 overflow-y-auto custom-scrollbar pr-2 space-y-3">
               {playerData?.completedChapters?.slice(-5).reverse().map((item, i) => (
                 <div key={i} className="text-[8px] border-l-2 border-system-blue pl-3 py-0.5 bg-system-blue/5 italic font-bold text-white uppercase truncate">{item.split(':')[1]}</div>
               ))}
             </div>
          </div>

          <div className="p-3 bg-system-blue/5 border border-gray-900 flex items-center justify-between shadow-inner">
              <Database size={12} className="text-gray-800" />
              <p className="text-[7px] text-gray-700 font-mono tracking-widest uppercase font-black italic">Cloud_Sync: ACTIVE</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;