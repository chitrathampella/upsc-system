import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Settings, Zap, BookOpen, TrendingUp, CheckCircle2, 
  Book, Sword, Activity, Terminal, Shield, Trophy, 
  Play, Pause, Layout, Cpu, Database, Clock, AlertTriangle, X, Info, User, Download, Radio, Flame
} from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';
import Logo from '../components/Logo';

// --- GLOBAL UTILITIES ---
const formatTime = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
};

const SYSTEM_QUOTES = [
  "If you don't want to be a loser, you must become stronger.",
  "The weak will be consumed. The strong will level up.",
  "It is not about where you stand, but the direction you are moving.",
  "Arise. Your shadow is waiting for your command.",
  "The goal is not to be better than others, but to be better than yesterday."
];

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  
  // --- CORE STATES ---
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [backlog, setBacklog] = useState([]); 
  const [timeLeft, setTimeLeft] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  
  // --- UI STATES ---
  const [showStatus, setShowStatus] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [activeQuestIndex, setActiveQuestIndex] = useState(null);
  const [showAriseOverlay, setShowAriseOverlay] = useState(false);

  // --- STOPWATCH STATES ---
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [totalSecondsToday, setTotalSecondsToday] = useState(0);

  // --- 1. REACTIVE STATS ---
  const stats = useMemo(() => {
    if (!playerData) return { stamina: 0, mana: 0, rank: "E-RANK" };
    const targetSeconds = (playerData.studyHours || 4) * 3600;
    const currentSeconds = totalSecondsToday + sessionSeconds;
    const manaPercent = Math.min(Math.round((currentSeconds / targetSeconds) * 100), 100);
    const xpTowardsNextLevel = (playerData.xp || 0) % 500;
    const staminaPercent = Math.round((xpTowardsNextLevel / 500) * 100);
    let rank = "E-RANK";
    if (playerData.level > 50) rank = "S-RANK";
    else if (playerData.level > 20) rank = "B-RANK";
    else if (playerData.level > 5) rank = "D-RANK";
    return { mana: manaPercent, stamina: staminaPercent, rank, displayTime: formatTime(currentSeconds) };
  }, [playerData, totalSecondsToday, sessionSeconds]);

  // --- 2. LIVE DATA FEEDS (Leaderboard & Broadcasts) ---
  useEffect(() => {
    const qLB = query(collection(db, "users"), orderBy("level", "desc"), limit(5));
    const unsubLB = onSnapshot(qLB, (snap) => {
        setLeaderboard(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qBC = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"), limit(3));
    const unsubBC = onSnapshot(qBC, (snap) => {
        setBroadcasts(snap.docs.map(doc => doc.data()));
    });

    return () => { unsubLB(); unsubBC(); };
  }, []);

  const generateNewDailyQuests = useCallback(async (userData, daysMissed = 0, oldQuests = []) => {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();
    const completed = userData.completedChapters || [];
    const unfinished = (oldQuests || []).filter(q => !q.completed);
    let newBacklog = [...(userData.backlog || []), ...unfinished];

    if (daysMissed > 1) {
        for (let i = 0; i < Math.min(daysMissed, 5); i++) {
            newBacklog.push({ book: "SYSTEM", topic: `Missed Training Gap Day 0${i + 1}`, hours: 2, completed: false, type: 'penalty' });
        }
    }

    let newQuests = [];
    if (dayOfWeek === 6) { // Saturday
        newQuests.push({ book: "SYSTEM", topic: "Weekly Current Affairs Recap", hours: 3, completed: false, type: 'special' });
        newQuests.push({ book: "MAINTENANCE", topic: "Core Revision Cycle", hours: userData.studyHours, completed: false, type: 'special' });
    } else if (dayOfWeek === 0) { // Sunday
        newQuests.push({ book: "EMERGENCY", topic: "Full Length Mock Dungeon", hours: 4, completed: false, type: 'emergency' });
    } else {
        userData.books.forEach(userBookTitle => {
          const bookData = SYLLABUS_DATA.find(b => b.title === userBookTitle || userBookTitle.toLowerCase().includes(b.subject.toLowerCase()));
          if (bookData) {
            const next = bookData.chapters.find(chap => !completed.some(c => c.includes(chap.title)));
            if (next) newQuests.push({ book: userBookTitle, topic: next.title, hours: next.hours || 2, completed: false });
          }
        });
    }

    await updateDoc(doc(db, "users", user.uid), { currentQuests: newQuests, lastQuestDate: today, backlog: newBacklog, studyTimeToday: 0 });
    setDailyQuests(newQuests); setBacklog(newBacklog); setTotalSecondsToday(0);
  }, [user.uid]);

  const fetchPlayerData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data(); setPlayerData(data);
        setTotalSecondsToday(data.studyTimeToday || 0); setBacklog(data.backlog || []);
        const todayStr = new Date().toISOString().split('T')[0];
        if (data.lastQuestDate !== todayStr) {
          const lastDate = new Date(data.lastQuestDate || todayStr);
          const diffDays = Math.floor(Math.abs(new Date() - lastDate) / (1000 * 60 * 60 * 24));
          generateNewDailyQuests(data, diffDays, data.currentQuests || []);
        } else { setDailyQuests(data.currentQuests || []); }
      } else { navigate('/onboarding'); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user, navigate, generateNewDailyQuests]);

  useEffect(() => {
    fetchPlayerData();
    const interval = setInterval(() => {
      const now = new Date(); const mid = new Date(); mid.setHours(24, 0, 0, 0);
      const diff = mid - now; if (diff <= 0) window.location.reload();
      setTimeLeft(`${Math.floor(diff/3600000).toString().padStart(2,'0')}:${Math.floor((diff%3600000)/60000).toString().padStart(2,'0')}:${Math.floor((diff%60000)/1000).toString().padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchPlayerData]);

  useEffect(() => {
    let t; if (isTimerActive) t = setInterval(() => setSessionSeconds(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [isTimerActive]);

  const toggleStopwatch = async () => {
    if (isTimerActive) {
      const newTotal = totalSecondsToday + sessionSeconds;
      await updateDoc(doc(db, "users", user.uid), { studyTimeToday: newTotal });
      setTotalSecondsToday(newTotal); setSessionSeconds(0);
    }
    setIsTimerActive(!isTimerActive);
  };

  const clearQuest = async (index, isBacklog = false) => {
    const sourceArray = isBacklog ? [...backlog] : [...dailyQuests];
    const targetIdx = isBacklog ? index : activeQuestIndex;
    const quest = sourceArray[targetIdx];
    const newXP = (playerData.xp || 0) + 100;
    const newLvl = Math.floor(newXP / 500) + 1;
    const manaReward = 3600; 
    const newTotalTime = (playerData.studyTimeToday || 0) + manaReward;
    const chapterId = `${quest.book}:${quest.topic}`;
    const newHistory = (quest.type === 'special' || quest.type === 'emergency') ? (playerData.completedChapters || []) : [...(playerData.completedChapters || []), chapterId];

    const dbUpdates = { completedChapters: newHistory, xp: newXP, level: newLvl, studyTimeToday: newTotalTime };
    if (isBacklog) { const fb = backlog.filter((_, i) => i !== index); dbUpdates.backlog = fb; setBacklog(fb); } 
    else { sourceArray[targetIdx].completed = true; dbUpdates.currentQuests = sourceArray; setDailyQuests(sourceArray); }
    
    await updateDoc(doc(db, "users", user.uid), dbUpdates);
    
    // Global Broadcast
    await addDoc(collection(db, "broadcasts"), {
        message: `Hunter ${playerData.name} cleared ${quest.topic}!`,
        createdAt: serverTimestamp()
    });

    setPlayerData(prev => ({ ...prev, level: newLvl, xp: newXP, completedChapters: newHistory, studyTimeToday: newTotalTime }));
    setTotalSecondsToday(newTotalTime); setIsRaidActive(false);

    // ARISE Trigger
    if (!isBacklog && sourceArray.every(q => q.completed)) {
        setShowAriseOverlay(true);
        setTimeout(() => setShowAriseOverlay(false), 4000);
    }
  };

  if (loading) return <div className="h-screen bg-black flex flex-col items-center justify-center text-system-blue font-system italic animate-pulse text-4xl tracking-[0.5em]"><Cpu className="mb-4 animate-spin" size={40}/>ARISE...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-6 select-none overflow-x-hidden">
      
      {/* --- ARISE OVERLAY --- */}
      {showAriseOverlay && (
        <div className="fixed inset-0 z-[200] bg-system-blue flex items-center justify-center animate-arise">
            <h1 className="text-[15vw] font-black text-black italic tracking-tighter animate-pulse">ARISE</h1>
        </div>
      )}

      {/* --- STATUS WINDOW --- */}
      {showStatus && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a0a0c] border-2 border-system-blue w-full max-w-sm p-8 relative shadow-[0_0_50px_rgba(0,242,255,0.3)] animate-in zoom-in duration-200">
            <button onClick={() => setShowStatus(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X/></button>
            <div className="flex justify-between items-start mb-10">
                {playerData?.photoURL ? (
                    <div className="w-[75px] h-[75px] border-2 border-system-blue overflow-hidden rotate-45 group-hover:shadow-[0_0_20px_#00f2ff]"><img src={playerData.photoURL} alt="Avatar" className="-rotate-45 w-full h-full object-cover scale-150" /></div>
                ) : <Logo size={60}/>}
                <div className="text-right"><p className="text-[9px] text-system-blue font-black uppercase italic">Hunter_ID</p><p className="text-2xl font-black text-white uppercase tracking-tighter leading-none mt-1">{playerData.name}</p></div>
            </div>
            <div className="space-y-4 font-mono text-xs italic">
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 uppercase">Rank</span><span className="text-system-purple font-black">{stats.rank}</span></div>
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 uppercase">Level</span><span className="text-white font-black">{playerData.level}</span></div>
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 uppercase">Total Mana</span><span className="text-system-accent font-black uppercase italic">{stats.displayTime}</span></div>
            </div>
            <button onClick={() => window.print()} className="w-full mt-10 bg-system-blue text-black font-black py-3 uppercase text-[9px] tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2"><Download size={14}/> Download ID</button>
          </div>
        </div>
      )}

      {/* --- HELP --- */}
      {showHelp && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a0a0c] border-2 border-system-purple w-full max-w-lg p-10 relative shadow-[0_0_50px_rgba(112,0,255,0.2)]">
            <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X/></button>
            <h2 className="text-2xl font-black text-system-purple uppercase mb-8 italic border-b border-gray-900 pb-2">System Intel</h2>
            <div className="space-y-5 text-[10px] text-gray-400 font-mono leading-relaxed uppercase italic">
              <p><span className="text-system-blue font-black mr-2 underline">STAMINA:</span> Current XP progress. 5 Clearance = 1 LVL UP.</p>
              <p><span className="text-system-purple font-black mr-2 underline">MANA:</span> Study time vs quota. Stop/Start in header.</p>
              <p><span className="text-red-500 font-black mr-2 underline">PENALTY:</span> Missed tasks from yesterday move here.</p>
            </div>
          </div>
        </div>
      )}

      {/* --- RAID --- */}
      {isRaidActive && (
        <div className="fixed inset-0 z-[110] bg-black/98 flex flex-col items-center justify-center border-4 border-red-900/10 backdrop-blur-xl p-6">
          <Sword className="text-red-600 mb-6 animate-bounce" size={60} />
          <h2 className="text-red-500 text-sm font-black tracking-[1em] mb-4 uppercase italic">Quest instance active</h2>
          <h3 className="text-2xl md:text-4xl font-black text-white italic uppercase tracking-tighter mb-12 text-center max-w-xl">{dailyQuests[activeQuestIndex].topic}</h3>
          <button onClick={() => clearQuest()} className="px-16 py-4 bg-system-blue text-black font-black uppercase shadow-[0_0_30px_#00f2ff] hover:scale-105 transition-all tracking-[0.2em] italic text-xs">Clear quest</button>
          <button onClick={() => setIsRaidActive(false)} className="text-gray-700 mt-10 uppercase text-[9px] tracking-[0.6em] font-black hover:text-white">Escape Instance</button>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-900 pb-4 mb-8 gap-6 relative">
        <div className="flex items-center gap-5">
          <button onClick={() => setShowStatus(true)} className="transition-transform active:scale-95">
             {playerData?.photoURL ? (
                <div className="w-[55px] h-[55px] border border-system-blue overflow-hidden rotate-45"><img src={playerData.photoURL} alt="Avatar" className="-rotate-45 w-full h-full object-cover scale-150" /></div>
            ) : <Logo size={50} />}
          </button>
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">{playerData?.name} <span className="text-system-blue text-xl ml-2 font-normal italic">LVL {playerData?.level}</span></h1>
            <div className="flex gap-3 mt-2">
              <span className="text-[8px] text-system-purple font-black tracking-[0.4em] uppercase border border-system-purple/30 px-2.5 py-0.5 bg-system-purple/5 italic">{stats.rank}</span>
              <span className="text-[8px] text-gray-500 font-bold border border-gray-800 px-2.5 py-0.5 uppercase tracking-widest leading-none italic">Class: {playerData?.studentType}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border-2 border-gray-800 p-3 flex items-center gap-6 shadow-xl relative overflow-hidden group min-w-[280px]">
            <div className="absolute top-0 left-0 h-full bg-system-blue/5 border-r border-system-blue/20 transition-all duration-1000" style={{width: `${stats.mana}%`}}></div>
            <div className="relative z-10 flex items-center gap-3">
                <Clock className={isTimerActive ? "text-system-blue animate-spin-slow" : "text-gray-700"} size={16} />
                <div><p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.3em] mb-0.5 italic">Extraction Unit</p><div className="text-2xl font-black text-white tracking-tighter font-mono leading-none">{stats.displayTime}</div></div>
            </div>
            <button onClick={toggleStopwatch} className={`relative z-10 p-3 rounded-full transition-all active:scale-90 ${isTimerActive ? 'bg-red-900/20 text-red-500 border border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.1)]' : 'bg-system-blue/20 text-system-blue border border-system-blue shadow-[0_0_20px_rgba(0,242,255,0.3)]'}`}>{isTimerActive ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setShowHelp(true)} className="p-2 text-gray-600 hover:text-white transition-all"><Info size={22} /></button>
          <button onClick={() => navigate('/library')} className="flex items-center gap-2 px-4 py-1.5 border-2 border-gray-800 hover:border-system-blue bg-black transition-all group shadow-md"><Book size={16} className="text-system-blue group-hover:scale-110 transition-transform" /><span className="text-[9px] font-black uppercase text-gray-500 group-hover:text-white tracking-widest italic">Archives</span></button>
          <button onClick={() => navigate('/settings')} className="p-2 border border-gray-800 rounded-sm hover:border-system-blue text-gray-500 hover:text-white transition-all bg-[#0a0a0a] group"><Settings size={18} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#080808] border-2 border-gray-900 p-5 shadow-xl relative overflow-hidden">
            <div className="flex justify-between text-[8px] font-black text-system-blue mb-2 uppercase tracking-[0.2em] italic"><span>Stamina (Level Sync)</span><span>{stats.stamina}%</span></div>
            <div className="h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-800"><div className="h-full bg-system-blue shadow-[0_0_10px_#00f2ff] transition-all duration-1000" style={{width: `${stats.stamina}%`}}></div></div>
            <div className="flex justify-between text-[8px] font-black text-system-purple mt-5 mb-2 uppercase tracking-[0.2em] italic"><span>Mana (Daily output)</span><span>{stats.mana}%</span></div>
            <div className="h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-800"><div className="h-full bg-system-purple shadow-[0_0_10px_#7000ff] transition-all duration-1000" style={{width: `${stats.mana}%`}}></div></div>
          </div>
          
          {backlog.length > 0 && (
            <div className="bg-red-950/10 border-2 border-red-900/40 p-5 shadow-2xl">
                <h2 className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-3 italic"><AlertTriangle size={14}/> Penalty Quests</h2>
                <div className="space-y-3">{backlog.map((q, i) => (<div key={i} className="flex justify-between items-center bg-black/40 p-2.5 border border-red-900/20 border-l-4 border-l-red-600 truncate"><div className="max-w-[120px]"><p className="text-[7px] text-red-900 font-bold uppercase truncate">{q.book}</p><p className="text-[9px] text-white font-black uppercase italic truncate">{q.topic}</p></div><button onClick={() => clearQuest(i, true)} className="border border-red-900 text-red-600 px-3 py-1 text-[8px] font-black uppercase hover:bg-red-600 hover:text-white italic">Clear</button></div>))}</div>
            </div>
          )}

          <div className="bg-[#080808] border-2 border-gray-900 p-5"><h2 className="text-[10px] font-black text-system-blue uppercase tracking-[0.3em] mb-4 flex items-center gap-3 italic border-b border-gray-900 pb-1.5"><Trophy size={14}/> Hall of Hunters</h2><div className="space-y-3">{leaderboard.map((h, i) => (<div key={h.id} className="flex justify-between items-center text-[10px] border-b border-gray-900/50 pb-2 opacity-60"><span className="text-gray-500 uppercase italic font-bold">0{i+1} {h.name}</span><span className="text-system-blue font-black tracking-tighter italic">LVL {h.level}</span></div>))}</div></div>
          
          <div className="bg-[#080808] border border-gray-900 p-5"><h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-3 border-b border-gray-900 pb-1.5 italic"><Terminal size={14}/> System Log</h2><div className="font-mono text-[8px] text-gray-600 space-y-1.5 italic uppercase"><p className="text-system-blue">[Intel] {SYSTEM_QUOTES[new Date().getDay() % SYSTEM_QUOTES.length]}</p><p>[Reset] Chrono Sync: {timeLeft}</p></div></div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="flex justify-between items-end px-1 border-b border-gray-900 pb-2"><h2 className="text-xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter"><Zap size={20} className="text-system-blue" fill="currentColor" /> Active Directives</h2><div className="text-[9px] font-mono text-system-blue border border-gray-800 px-2 py-0.5 tracking-widest font-black italic shadow-lg shadow-blue-900/5">V2.5.0_NOMINAL</div></div>
          <div className="space-y-3">{dailyQuests.map((quest, i) => (<div key={i} className={`group relative border transition-all duration-300 ${quest.completed ? 'bg-black/40 border-gray-900 opacity-40 shadow-none' : 'bg-[#0a0a0a] border-gray-800 hover:border-system-blue shadow-lg shadow-black'} p-5 overflow-hidden`}><div className="flex justify-between items-center relative z-10"><div className="max-w-[75%]"><p className={`text-[8px] font-black uppercase tracking-[0.4em] mb-1 italic ${quest.type ? 'text-red-500' : 'text-system-blue'}`}>{quest.type ? quest.book : `Grimoire: ${quest.book.split(' - ')[0]}`}</p><h3 className={`text-xl font-black italic uppercase tracking-tighter leading-tight ${quest.completed ? 'text-gray-600 line-through' : 'text-white'}`}>{quest.topic}</h3></div>{quest.completed ? <CheckCircle2 size={30} className="text-system-blue" /> : (<button onClick={() => { setActiveQuestIndex(i); setIsRaidActive(true); }} className={`border border-system-blue text-system-blue px-6 py-1.5 font-black italic uppercase text-[10px] hover:bg-system-blue hover:text-black transition-all active:scale-95`}><Sword size={12}/> Raid</button>)}</div><div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-system-blue/5 to-transparent skew-x-12 translate-x-12 group-hover:translate-x-6 transition-transform"></div></div>))}</div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#080808] border-2 border-gray-900 p-5 shadow-2xl relative overflow-hidden"><div className="absolute -top-5 -right-5 opacity-5 rotate-12"><Cpu size={100}/></div><h2 className="text-[10px] font-black text-system-purple uppercase tracking-[0.5em] mb-6 flex items-center gap-3 italic border-b border-gray-900 pb-1.5"><BookOpen size={16} className="text-system-purple" /> Inventory</h2><div className="space-y-4">{playerData?.books?.map((b, i) => (<div key={i} className="flex flex-col border-b border-gray-900/50 pb-2 last:border-0 group cursor-default transition-all group-hover:translate-x-1"><span className="text-[7px] text-system-purple font-black uppercase mb-0.5 italic opacity-60">Slot: 0{i+1}</span><span className="text-[10px] font-black text-gray-500 group-hover:text-white uppercase italic truncate tracking-tight">{b}</span></div>))}</div></div>
          <div className="bg-system-blue/5 border-2 border-gray-900 p-4 relative overflow-hidden h-32"><div className="flex items-center gap-2 mb-3 text-system-accent"><Radio size={12} className="animate-pulse"/><span className="text-[9px] font-black uppercase tracking-widest">Global Broadcast</span></div><div className="space-y-2">{broadcasts.map((b, i) => (<p key={i} className="text-[8px] text-gray-400 font-mono italic truncate animate-in slide-in-from-bottom-2">[{new Date().toLocaleTimeString()}] {b.message}</p>))}</div></div>
          <div className="p-3 bg-black border border-gray-900 flex items-center justify-between"><Database size={12} className="text-gray-800" /><p className="text-[7px] text-gray-700 font-mono tracking-widest uppercase font-black italic">Sync_Status: NOMINAL</p></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;