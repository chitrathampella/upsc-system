import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Settings, Zap, BookOpen, TrendingUp, CheckCircle2, 
  Book, Sword, Activity, Terminal, Shield, Trophy, 
  Play, Pause, Layout, Cpu, Database, Clock, AlertTriangle, X, Info, User, Share2, Download, Radio, Flame
} from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';
import Logo from '../components/Logo';

// --- GLOBAL SYSTEM UTILITIES ---
const formatTime = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
};

const SYSTEM_QUOTES = [
  "If you don't want to be a loser, you must become stronger.",
  "The weak will be consumed. The strong will level up.",
  "Arise. Your shadow is waiting for your command.",
  "The goal is not to be better than others, but to be better than yesterday.",
  "System Message: Constant effort is the only way to the S-Rank."
];

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  
  // --- CORE DATA STATES ---
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [backlog, setBacklog] = useState([]); 
  const [timeLeft, setTimeLeft] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  
  // --- UI OVERLAY STATES ---
  const [showStatus, setShowStatus] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [activeQuestIndex, setActiveQuestIndex] = useState(null);
  const [showAriseOverlay, setShowAriseOverlay] = useState(false);

  // --- STOPWATCH / MANA ENGINE ---
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [totalSecondsToday, setTotalSecondsToday] = useState(0);

  // --- 1. DYNAMIC SYSTEM LOGIC (REACTIVE STATS ENGINE) ---
  const stats = useMemo(() => {
    if (!playerData) return { stamina: 0, mana: 0, rank: "E-RANK", totalHours: 0 };

    // MANA: Based on Seconds Studied vs Daily Goal Hours (from settings)
    const targetSeconds = (playerData.studyHours || 4) * 3600;
    const currentSeconds = totalSecondsToday + sessionSeconds;
    const manaPercent = Math.min(Math.round((currentSeconds / targetSeconds) * 100), 100);

    // STAMINA: XP progress toward next level (500 XP per level)
    const currentXP = playerData.xp || 0;
    const xpTowardsNextLevel = currentXP % 500;
    const staminaPercent = Math.round((xpTowardsNextLevel / 500) * 100);

    // RANK: Automated scaling based on Level milestones
    let rank = "E-RANK";
    if (playerData.level > 50) rank = "S-RANK";
    else if (playerData.level > 35) rank = "A-RANK";
    else if (playerData.level > 20) rank = "B-RANK";
    else if (playerData.level > 10) rank = "C-RANK";
    else if (playerData.level > 5) rank = "D-RANK";

    return { 
      mana: manaPercent, 
      stamina: staminaPercent, 
      rank, 
      xpProgress: xpTowardsNextLevel,
      displayTime: formatTime(currentSeconds)
    };
  }, [playerData, totalSecondsToday, sessionSeconds]);

  // --- 2. LIVE BROADCAST & LEADERBOARD LISTENERS ---
  useEffect(() => {
    // Real-time Leaderboard Listener
    const qLB = query(collection(db, "users"), orderBy("level", "desc"), limit(5));
    const unsubLB = onSnapshot(qLB, (snap) => {
        setLeaderboard(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Real-time Broadcast Listener
    const qBC = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"), limit(4));
    const unsubBC = onSnapshot(qBC, (snap) => {
        setBroadcasts(snap.docs.map(doc => doc.data()));
    });

    return () => { unsubLB(); unsubBC(); };
  }, []);

  // --- 3. QUEST ENGINE: GENERATOR WITH BACKLOG MIGRATION ---
  const generateNewDailyQuests = useCallback(async (userData, daysMissed = 0, oldQuests = []) => {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
    const completed = userData.completedChapters || [];
    
    // BACKLOG MIGRATION: Any quest from the past that isn't completed becomes a Penalty
    const unfinished = (oldQuests || []).filter(q => !q.completed);
    let newBacklog = [...(userData.backlog || []), ...unfinished];

    // Detect offline gap (if more than 1 day missed)
    if (daysMissed > 1) {
        for (let i = 0; i < Math.min(daysMissed, 5); i++) {
            newBacklog.push({
                book: "SYSTEM_PENALTY",
                topic: `Missed Training Session - Gap 0${i + 1}`,
                hours: 2,
                completed: false,
                type: 'penalty'
            });
        }
    }

    let newQuests = [];

    // --- WEEKEND SPECIAL EVENTS ---
    if (dayOfWeek === 6) { // SATURDAY
        newQuests.push({ book: "SYSTEM", topic: "Weekly Current Affairs Recap", hours: 3, completed: false, type: 'special' });
        newQuests.push({ book: "MAINTENANCE", topic: "Core Revision Cycle", hours: userData.studyHours, completed: false, type: 'special' });
    } else if (dayOfWeek === 0) { // SUNDAY
        newQuests.push({ book: "EMERGENCY", topic: "Full Length Mock Dungeon (GS + CSAT)", hours: 4, completed: false, type: 'emergency' });
    } else {
        // WEEKDAYS: SYLLABUS PROGRESSION
        userData.books.forEach(userBookTitle => {
          const bookData = SYLLABUS_DATA.find(b => 
            b.title === userBookTitle || userBookTitle.toLowerCase().includes(b.subject.toLowerCase())
          );
          if (bookData) {
            const next = bookData.chapters.find(chap => !completed.some(c => c.includes(chap.title)));
            if (next) {
              newQuests.push({ 
                book: bookData.title, 
                topic: next.title, 
                hours: next.hours || 2, 
                completed: false 
              });
            }
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

  // --- 4. PLAYER DATA SYNC ---
  const fetchPlayerData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlayerData(data);
        setTotalSecondsToday(data.studyTimeToday || 0);
        setBacklog(data.backlog || []);
        
        const todayStr = new Date().toISOString().split('T')[0];
        const lastDateStr = data.lastQuestDate || "";

        // Check for date change to trigger Backlog Migration
        if (lastDateStr !== todayStr) {
          const lastDate = new Date(lastDateStr || todayStr);
          const diffDays = Math.floor(Math.abs(new Date() - lastDate) / (1000 * 60 * 60 * 24));
          generateNewDailyQuests(data, diffDays, data.currentQuests || []);
        } else {
          setDailyQuests(data.currentQuests || []);
        }
      } else {
        navigate('/onboarding');
      }
    } catch (e) {
      console.error("Critical Sync Failure", e);
    } finally {
      setLoading(false);
    }
  }, [user, navigate, generateNewDailyQuests]);

  // --- 5. SYSTEM TIMERS (CHRONO & STOPWATCH) ---
  useEffect(() => {
    fetchPlayerData();
    const interval = setInterval(() => {
      const now = new Date();
      const mid = new Date(); mid.setHours(24, 0, 0, 0);
      const diff = mid - now;
      if (diff <= 0) window.location.reload();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchPlayerData]);

  useEffect(() => {
    let t;
    if (isTimerActive) t = setInterval(() => setSessionSeconds(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [isTimerActive]);

  // --- 6. SYSTEM ACTIONS ---
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
    const sourceArray = isBacklog ? [...backlog] : [...dailyQuests];
    const targetIdx = isBacklog ? index : activeQuestIndex;
    const quest = sourceArray[targetIdx];
    
    // XP & LEVEL LOGIC
    const newXP = (playerData.xp || 0) + 100;
    const newLvl = Math.floor(newXP / 500) + 1;

    // MANA CREDIT: Adds 1 hour focus credit per quest
    const manaBonus = 3600; 
    const newTotalStudyTime = (playerData.studyTimeToday || 0) + manaBonus;

    const chapterId = `${quest.book}:${quest.topic}`;
    const newHistory = (quest.type === 'special' || quest.type === 'emergency') 
        ? (playerData.completedChapters || []) 
        : [...(playerData.completedChapters || []), chapterId];

    const dbUpdates = { completedChapters: newHistory, xp: newXP, level: newLvl, studyTimeToday: newTotalTime };

    if (isBacklog) {
        const filteredBacklog = backlog.filter((_, i) => i !== index);
        dbUpdates.backlog = filteredBacklog;
        setBacklog(filteredBacklog);
    } else {
        sourceArray[targetIdx].completed = true;
        dbUpdates.currentQuests = sourceArray;
        setDailyQuests(sourceArray);
    }

    await updateDoc(doc(db, "users", user.uid), dbUpdates);
    
    // Global Broadcast Trigger
    await addDoc(collection(db, "broadcasts"), {
        message: `Hunter ${playerData.name} conquered ${quest.topic}!`,
        createdAt: serverTimestamp()
    });

    // ARISE Check: If all today's quests are done, flash the overlay
    if (!isBacklog && sourceArray.every(q => q.completed)) {
        setShowAriseOverlay(true);
        setTimeout(() => setShowAriseOverlay(false), 4000);
    }

    setPlayerData(prev => ({ ...prev, level: newLvl, xp: newXP, completedChapters: newHistory, studyTimeToday: newTotalStudyTime }));
    setTotalSecondsToday(newTotalStudyTime);
    setIsRaidActive(false);
  };

  // --- 7. FINAL RENDER BLOCK ---
  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center text-system-blue font-system italic animate-pulse tracking-[1em]">
      <Cpu className="mb-6 animate-spin" size={50} />
      SYNCHRONIZING_CORE...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-6 select-none overflow-x-hidden">
      
      {/* --- OVERLAY: ARISE EVENT --- */}
      {showAriseOverlay && (
        <div className="fixed inset-0 z-[200] bg-system-blue/20 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-1000">
            <h1 className="text-[15vw] font-black text-system-blue italic tracking-tighter drop-shadow-[0_0_50px_#00f2ff] animate-pulse">ARISE</h1>
        </div>
      )}

      {/* --- MODAL: STATUS WINDOW (ID CARD) --- */}
      {showStatus && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a0a0c] border-2 border-system-blue w-full max-w-sm p-10 relative shadow-[0_0_60px_#00f2ff33]">
            <button onClick={() => setShowStatus(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X/></button>
            <div className="flex justify-between items-start mb-12">
                {playerData?.photoURL ? (
                    <div className="w-[75px] h-[75px] border-2 border-system-blue overflow-hidden rotate-45 group-hover:shadow-[0_0_20px_#00f2ff]"><img src={playerData.photoURL} alt="Avatar" className="-rotate-45 w-full h-full object-cover scale-150" /></div>
                ) : <Logo size={70} />}
                <div className="text-right">
                    <p className="text-[10px] text-system-blue font-black uppercase tracking-widest italic">Hunter Profile</p>
                    <p className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mt-1">{playerData.name}</p>
                </div>
            </div>
            <div className="space-y-6 font-mono text-sm">
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 uppercase">Rank Status</span><span className="text-system-purple font-black">{stats.rank}</span></div>
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 uppercase">Power Level</span><span className="text-white font-black">0{playerData.level}</span></div>
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 uppercase">Conquest Data</span><span className="text-system-blue font-black">{playerData.completedChapters?.length || 0} CH</span></div>
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 uppercase">Total Mana</span><span className="text-system-accent font-black uppercase italic">{stats.displayTime}</span></div>
            </div>
            <button onClick={() => window.print()} className="w-full mt-10 bg-system-blue text-black font-black py-4 uppercase text-[10px] tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2 shadow-lg">
                <Download size={14}/> Download Hunter_ID
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL: HELP TAB --- */}
      {showHelp && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a0a0c] border-2 border-system-purple w-full max-w-lg p-10 relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-gray-600 hover:text-white"><X/></button>
            <h2 className="text-3xl font-black text-system-purple uppercase mb-10 italic border-b border-gray-900 pb-4 flex items-center gap-4">
               <Info size={28}/> System Intelligence
            </h2>
            <div className="space-y-6 text-[11px] text-gray-400 font-mono leading-relaxed uppercase tracking-tighter italic">
              <p><span className="text-system-blue font-black mr-2 underline">STAMINA (SYNC):</span> XP Progress toward next Level UP. Each clearance is 20% progress.</p>
              <p><span className="text-system-purple font-black mr-2 underline">MANA (OUTPUT):</span> Based on Live Stopwatch vs Daily Quota. Quests also provide 1H boost.</p>
              <p><span className="text-red-500 font-black mr-2 underline">PENALTY QUESTS:</span> Missed tasks from yesterday move here. Must clear to regain balance.</p>
            </div>
          </div>
        </div>
      )}

      {/* --- OVERLAY: RAID INSTANCE --- */}
      {isRaidActive && (
        <div className="fixed inset-0 z-[110] bg-black/98 flex flex-col items-center justify-center border-4 border-red-900/10 backdrop-blur-xl">
          <Sword className="text-red-600 mb-10 animate-bounce shadow-[0_0_30px_#ff0000]" size={80} />
          <h2 className="text-red-500 text-sm font-black tracking-[1em] mb-4 uppercase italic">Quest instance active</h2>
          <div className="text-center mb-16 max-w-2xl px-6">
             <p className="text-gray-600 text-[10px] uppercase tracking-[0.5em] mb-4 italic">Active Objective</p>
             <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-tight drop-shadow-[0_0_20px_white]">{dailyQuests[activeQuestIndex].topic}</h3>
          </div>
          <div className="flex flex-col gap-6 items-center">
            <button 
                onClick={() => clearQuest()} 
                className="px-24 py-5 bg-system-blue text-black font-black uppercase shadow-[0_0_40px_#00f2ff] hover:scale-110 transition-all tracking-[0.3em] italic"
            >
              Clear objective
            </button>
            <button 
                onClick={() => setIsRaidActive(false)} 
                className="text-gray-700 hover:text-white transition-colors uppercase text-[10px] tracking-[0.8em] font-black mt-8 underline decoration-gray-900"
            >
              Escape instance
            </button>
          </div>
          <div className="absolute left-20 top-1/2 -translate-y-1/2 w-px h-96 bg-gradient-to-b from-transparent via-red-900/50 to-transparent"></div>
          <div className="absolute right-20 top-1/2 -translate-y-1/2 w-px h-96 bg-gradient-to-b from-transparent via-red-900/50 to-transparent"></div>
        </div>
      )}

      {/* --- HEADER HUD SECTION --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-900 pb-5 mb-10 gap-8 relative">
        <div className="flex items-center gap-6">
          <button onClick={() => setShowStatus(true)} className="relative group transition-all hover:scale-105 active:scale-95">
             {playerData?.photoURL ? (
                <div className="w-[55px] h-[55px] border border-system-blue overflow-hidden rotate-45"><img src={playerData.photoURL} alt="Avatar" className="-rotate-45 w-full h-full object-cover scale-150" /></div>
            ) : <Logo size={55} />}
            <div className="absolute -inset-2 bg-system-blue/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
              {playerData?.name} <span className="text-system-blue text-2xl ml-2 font-normal italic">LVL {playerData?.level}</span>
            </h1>
            <div className="flex gap-4 mt-3">
              <span className="text-[9px] text-system-purple font-black tracking-[0.4em] uppercase border-2 border-system-purple/30 px-3 py-1 bg-system-purple/5 italic">{stats.rank}</span>
              <span className="text-[9px] text-gray-500 font-bold border border-gray-800 px-3 py-1 uppercase tracking-widest italic leading-none">Class: {playerData?.studentType}</span>
            </div>
          </div>
        </div>

        {/* --- LIVE MANA STOPWATCH UNIT --- */}
        <div className="bg-[#0a0a0a] border-2 border-gray-800 p-3 flex items-center gap-10 shadow-2xl relative overflow-hidden group min-w-[300px]">
            <div className="absolute top-0 left-0 h-full bg-system-blue/5 border-r border-system-blue/30 transition-all duration-1000" style={{width: `${stats.mana}%`}}></div>
            <div className="relative z-10 flex items-center gap-4">
                <Clock className={isTimerActive ? "text-system-blue animate-spin-slow" : "text-gray-700"} size={22} />
                <div>
                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.4em] mb-1 italic leading-none">Extraction unit</p>
                    <div className="text-3xl font-black text-white tracking-tighter font-mono leading-none">{stats.displayTime}</div>
                </div>
            </div>
            <button onClick={toggleStopwatch} className={`relative z-10 p-4 rounded-full transition-all active:scale-90 ${isTimerActive ? 'bg-red-900/20 text-red-500 border-2 border-red-500 shadow-[0_0_20px_rgba(255,0,0,0.3)]' : 'bg-system-blue/20 text-system-blue border-2 border-system-blue shadow-[0_0_30px_rgba(0,242,255,0.4)]'}`}>
                {isTimerActive ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right hidden xl:block"><p className="text-[8px] text-gray-600 font-black uppercase tracking-tighter mb-1 italic leading-none">System Stability</p><p className="text-[10px] font-mono text-system-accent tracking-widest font-black uppercase animate-pulse italic uppercase">Optimized</p></div>
          <button onClick={() => setShowHelp(true)} className="p-2 text-gray-600 hover:text-system-purple transition-all"><Info size={28} /></button>
          <button onClick={() => navigate('/library')} className="flex items-center gap-3 px-6 py-2.5 border-2 border-gray-800 hover:border-system-blue bg-black transition-all group shadow-2xl"><Book size={20} className="text-system-blue group-hover:scale-125 transition-transform" /><span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-white tracking-[0.4em] italic leading-none">Archives</span></button>
          <button onClick={() => navigate('/settings')} className="p-3 border-2 border-gray-800 rounded-sm hover:border-system-blue text-gray-500 hover:text-white transition-all bg-[#0a0a0a] group shadow-lg"><Settings size={22} className="group-hover:rotate-90 transition-transform duration-1000" /></button>
        </div>
      </div>

      {/* --- MAIN GRID LAYOUT --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        
        {/* LEFT PANEL */}
        <div className="lg:col-span-3 space-y-10">
          <div className="bg-[#080808] border-2 border-gray-900 p-6 shadow-2xl relative overflow-hidden group">
            <div className="flex justify-between text-[9px] font-black text-system-blue mb-3 uppercase tracking-[0.2em] italic"><span>Stamina (Sync)</span><span>{stats.stamina}%</span></div>
            <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800"><div className="h-full bg-system-blue shadow-[0_0_15px_#00f2ff] transition-all duration-1000" style={{width: `${stats.stamina}%`}}></div></div>
            <div className="flex justify-between text-[9px] font-black text-system-purple mt-8 mb-3 uppercase tracking-[0.2em] italic"><span>Mana (Output)</span><span>{stats.mana}%</span></div>
            <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800"><div className="h-full bg-system-purple shadow-[0_0_15px_#7000ff] transition-all duration-1000" style={{width: `${stats.mana}%`}}></div></div>
            <p className="text-[9px] text-gray-700 mt-6 font-mono text-center uppercase tracking-widest font-black italic leading-none">Quota: {playerData?.studyHours}H_DAILY</p>
          </div>

          {/* THE PENALTY BOX (BACKLOG) */}
          {backlog.length > 0 && (
            <div className="bg-red-950/10 border-2 border-red-900/40 p-6 shadow-2xl relative overflow-hidden animate-in slide-in-from-left-4 duration-500">
                <div className="absolute top-0 right-0 bg-red-900 text-white text-[7px] px-3 py-1 font-black uppercase tracking-tighter italic">Instance_Overdue</div>
                <h2 className="text-[11px] font-black text-red-500 uppercase tracking-[0.6em] mb-8 flex items-center gap-4 italic"><AlertTriangle size={18}/> Penalty quests</h2>
                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {backlog.map((q, i) => (
                        <div key={i} className="flex justify-between items-center group bg-black/40 p-3 border border-red-900/20 border-l-4 border-l-red-600">
                            <div className="max-w-[140px]">
                                <p className="text-[7px] text-red-900 font-black uppercase truncate italic leading-none mb-1">{q.book}</p>
                                <p className="text-[10px] text-white font-black uppercase italic truncate tracking-tight">{q.topic}</p>
                            </div>
                            <button onClick={() => clearQuest(i, true)} className="border-2 border-red-900 text-red-600 px-4 py-1.5 text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all italic active:scale-90 leading-none">Clear</button>
                        </div>
                    ))}
                </div>
            </div>
          )}

          <div className="bg-[#080808] border-2 border-gray-900 p-8 relative overflow-hidden shadow-2xl">
            <h2 className="text-[12px] font-black text-system-blue uppercase tracking-[0.6em] mb-10 flex items-center gap-4 italic border-b border-gray-900 pb-3"><Trophy size={18}/> Top hunters</h2>
            <div className="space-y-6">{leaderboard.map((h, i) => (<div key={h.id} className="flex justify-between items-center text-[12px] border-b border-gray-900/50 pb-4 last:border-0 group cursor-default transition-all hover:bg-white/5"><span className="text-gray-500 uppercase italic font-bold">0{i+1} {h.name}</span><span className="text-system-blue font-black tracking-tighter italic leading-none">LVL {h.level}</span></div>))}</div>
          </div>

          <div className="bg-[#080808] border-2 border-gray-900 p-8 shadow-inner shadow-black">
            <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.6em] mb-6 flex items-center gap-4 border-b border-gray-900 pb-3 italic"><Terminal size={16}/> System logs</h2>
            <div className="font-mono text-[9px] text-gray-600 space-y-2.5 italic leading-relaxed uppercase tracking-tighter">
              <p className="text-system-blue">[Intel] {SYSTEM_QUOTES[new Date().getDay() % SYSTEM_QUOTES.length]}</p>
              <p>[System] User_ID {playerData?.name?.toUpperCase()} Sync'd.</p>
              <p>[Data] {playerData?.completedChapters?.length} Instances cleared.</p>
              <p className="text-system-blue animate-pulse">[Alert] Time Reset: {timeLeft}</p>
            </div>
          </div>
        </div>

        {/* --- CENTER: THE TO-DO LIST --- */}
        <div className="lg:col-span-6 space-y-12">
          <div className="flex justify-between items-end px-4 border-b-2 border-gray-900 pb-4">
            <h2 className="text-3xl lg:text-4xl font-black text-white flex items-center gap-6 uppercase italic tracking-tighter">
              <Zap size={35} className="text-system-blue" fill="currentColor" /> Active Directives
            </h2>
            <div className="text-[12px] font-mono text-system-blue border-2 border-gray-800 px-6 py-2 tracking-[0.3em] font-black uppercase italic shadow-2xl shadow-blue-900/5">Reset: {timeLeft}</div>
          </div>

          <div className="space-y-8">
            {dailyQuests.map((quest, i) => (
              <div key={i} className={`group relative border-2 transition-all duration-500 ${quest.completed ? 'bg-black/40 border-gray-900 opacity-40 shadow-none' : 'bg-[#0a0a0a] border-gray-800 hover:border-system-blue shadow-2xl'} p-10 overflow-hidden`}>
                <div className="flex justify-between items-center relative z-10">
                  <div className="max-w-[75%]">
                    <p className={`text-[11px] font-black uppercase tracking-[0.6em] mb-3 italic ${quest.type === 'emergency' ? 'text-red-500' : 'text-system-blue'}`}>{quest.type ? quest.book : `Grimoire: ${quest.book.split(' - ')[0]}`}</p>
                    <h3 className={`text-4xl font-black italic uppercase tracking-tighter leading-tight transition-colors ${quest.completed ? 'text-gray-600 line-through' : 'text-white group-hover:text-system-blue'}`}>{quest.topic}</h3>
                    {!quest.completed && <p className="text-[11px] text-gray-600 font-bold mt-6 uppercase tracking-[0.4em] italic flex items-center gap-4"><Activity size={14}/> Energy Required: {quest.hours}H</p>}
                  </div>
                  {quest.completed ? <CheckCircle2 size={60} className="text-system-blue shadow-[0_0_20px_#00f2ff]" /> : (
                    <button onClick={() => { setActiveQuestIndex(i); setIsRaidActive(true); }} className={`border-2 px-14 py-5 font-black italic uppercase text-sm transition-all active:scale-95 shadow-[0_0_25px_rgba(0,242,255,0.15)] flex items-center gap-4 ${quest.type === 'emergency' ? 'border-red-600 text-red-600 hover:bg-red-600 hover:text-black' : 'border-system-blue text-system-blue hover:bg-system-blue hover:text-black'}`}><Sword size={20}/> Raid</button>
                  )}
                </div>
                <div className="absolute top-0 right-0 w-48 h-full bg-gradient-to-l from-system-blue/5 to-transparent skew-x-12 translate-x-32 pointer-events-none group-hover:translate-x-12 transition-transform duration-1000"></div>
                <div className="absolute bottom-0 left-0 w-2 h-0 group-hover:h-full bg-system-blue transition-all duration-700"></div>
              </div>
            ))}
            {dailyQuests.length === 0 && <div className="p-24 border-2 border-dashed border-gray-900 text-center opacity-30 italic"><p className="text-2xl font-black uppercase tracking-[1em]">Quest_Pool_Empty</p></div>}
          </div>
        </div>

        {/* --- RIGHT PANEL --- */}
        <div className="lg:col-span-3 space-y-10">
          <div className="bg-[#080808] border-2 border-gray-900 p-8 shadow-2xl relative overflow-hidden">
             <div className="absolute -top-10 -right-10 opacity-5 rotate-12"><Cpu size={150}/></div>
             <h2 className="text-[12px] font-black text-system-purple uppercase tracking-[0.6em] mb-12 flex items-center gap-4 italic border-b border-gray-900 pb-3"><BookOpen size={20} className="text-system-purple" /> Inventory</h2>
             <div className="space-y-7">
               {playerData?.books?.map((b, i) => (
                 <div key={i} className="flex flex-col border-b-2 border-gray-900/50 pb-5 last:border-0 group cursor-default transition-all group-hover:translate-x-2">
                   <div className="flex justify-between items-center mb-2"><span className="text-[9px] text-system-purple font-black uppercase italic opacity-60 group-hover:opacity-100 transition-opacity">Slot: 0{i+1}</span><Shield size={12} className="text-gray-800" /></div>
                   <span className="text-sm font-black text-gray-500 group-hover:text-white uppercase italic truncate transition-all group-hover:translate-x-1 leading-none tracking-tighter">{b}</span>
                 </div>
               ))}
             </div>
          </div>
          
          {/* BROADCAST BOX */}
          <div className="bg-system-blue/5 border-2 border-gray-900 p-5 relative overflow-hidden h-48 shadow-xl">
             <div className="flex items-center gap-3 mb-5 text-system-accent border-b border-gray-900 pb-2">
                <Radio size={14} className="animate-pulse"/>
                <span className="text-[10px] font-black uppercase tracking-widest">Global broadcast</span>
             </div>
             <div className="space-y-4 overflow-y-auto max-h-24 pr-2 custom-scrollbar">
                {broadcasts.map((b, i) => (
                    <p key={i} className="text-[8px] text-gray-400 font-mono italic leading-tight border-l border-gray-800 pl-3 animate-in slide-in-from-bottom-2">
                        [{new Date().toLocaleTimeString()}] {b.message}
                    </p>
                ))}
             </div>
          </div>

          <div className="p-5 bg-black border-2 border-gray-900 flex items-center justify-between shadow-inner shadow-black"><Database size={16} className="text-gray-800" /><p className="text-[9px] text-gray-700 font-mono tracking-widest uppercase font-black italic leading-none">V2.5.0_NOMINAL</p></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;