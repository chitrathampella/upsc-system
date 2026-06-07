import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { 
  Settings, Zap, BookOpen, TrendingUp, CheckCircle2, 
  Book, Sword, Activity, Terminal, Shield, Trophy, 
  Play, Pause, Layout, Cpu, Database, Clock, AlertTriangle, X, Info, User, Download, ChevronRight
} from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';
import Logo from '../components/Logo';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();

  // --- UTILITY: FORMAT TIME (Defined at top to avoid scoping errors) ---
  const formatTime = (s) => {
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };
  
  // --- CORE SYSTEM STATES ---
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [backlog, setBacklog] = useState([]); 
  const [timeLeft, setTimeLeft] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  
  // --- UI MODAL STATES ---
  const [showStatus, setShowStatus] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [activeQuestIndex, setActiveQuestIndex] = useState(null);

  // --- STOPWATCH / MANA STATES ---
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [totalSecondsToday, setTotalSecondsToday] = useState(0);

  // --- 1. DYNAMIC SYSTEM LOGIC (REACTIVE STATS ENGINE) ---
  const stats = useMemo(() => {
    if (!playerData) return { stamina: 0, mana: 0, rank: "E-RANK", totalHours: 0 };

    const targetSeconds = (playerData.studyHours || 4) * 3600;
    const currentSeconds = totalSecondsToday + sessionSeconds;
    const manaPercent = Math.min(Math.round((currentSeconds / targetSeconds) * 100), 100);

    const currentXP = playerData.xp || 0;
    const xpTowardsNextLevel = currentXP % 500;
    const staminaPercent = Math.round((xpTowardsNextLevel / 500) * 100);

    let rank = "E-RANK";
    if (playerData.level > 50) rank = "S-RANK";
    else if (playerData.level > 25) rank = "A-RANK";
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

  // --- 2. QUEST ENGINE: GENERATOR WITH BACKLOG MIGRATION ---
  const generateNewDailyQuests = useCallback(async (userData, daysMissed = 0, oldQuests = []) => {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay(); 
    const completed = userData.completedChapters || [];
    
    const unfinishedFromYesterday = (oldQuests || []).filter(q => !q.completed);
    let newBacklog = [...(userData.backlog || []), ...unfinishedFromYesterday];

    if (daysMissed > 1) {
        for (let i = 0; i < Math.min(daysMissed, 5); i++) {
            newBacklog.push({ book: "SYSTEM", topic: `Missed Daily Training - Day ${i + 1}`, hours: 2, completed: false, type: 'penalty' });
        }
    }

    let newQuests = [];
    if (dayOfWeek === 6) { // Saturday
        newQuests.push({ book: "SYSTEM", topic: "Weekly Current Affairs Recap", hours: 3, completed: false, type: 'special' });
        newQuests.push({ book: "MAINTENANCE", topic: "Core Revision: All Weekly Progress", hours: userData.studyHours, completed: false, type: 'special' });
    } else if (dayOfWeek === 0) { // Sunday
        newQuests.push({ book: "EMERGENCY", topic: "Full Length Mock Dungeon", hours: 4, completed: false, type: 'emergency' });
    } else {
        userData.books.forEach(userBookTitle => {
          const bookData = SYLLABUS_DATA.find(b => b.title === userBookTitle || userBookTitle.toLowerCase().includes(b.subject.toLowerCase()));
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

  // --- 3. DATA SYNC ---
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
        if (data.lastQuestDate !== todayStr) {
          const lastDate = new Date(data.lastQuestDate || todayStr);
          const diffDays = Math.floor(Math.abs(new Date() - lastDate) / (1000 * 60 * 60 * 24));
          generateNewDailyQuests(data, diffDays, data.currentQuests || []);
        } else {
          setDailyQuests(data.currentQuests || []);
        }

        const lbSnap = await getDocs(query(collection(db, "users"), orderBy("level", "desc"), limit(5)));
        setLeaderboard(lbSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else { navigate('/onboarding'); }
    } catch (e) { console.error("System Failure", e); }
    finally { setLoading(false); }
  }, [user, navigate, generateNewDailyQuests]);

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
    let t; if (isTimerActive) t = setInterval(() => setSessionSeconds(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [isTimerActive]);

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
    const newXP = (playerData.xp || 0) + 100;
    const newLvl = Math.floor(newXP / 500) + 1;
    const manaReward = 3600; 
    const newTotalTime = (playerData.studyTimeToday || 0) + manaReward;
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
    setPlayerData(prev => ({ ...prev, level: newLvl, xp: newXP, completedChapters: newHistory, studyTimeToday: newTotalTime }));
    setTotalSecondsToday(newTotalTime);
    setIsRaidActive(false);
  };

  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center text-system-blue font-system italic animate-pulse">
      <Cpu className="mb-4 animate-spin" size={40} />
      INITIALIZING_CORE...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-8 select-none overflow-x-hidden">
      
      {/* --- STATUS WINDOW MODAL --- */}
      {showStatus && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#0a0a0c] border-2 border-system-blue w-full max-w-sm p-8 relative shadow-[0_0_50px_rgba(0,242,255,0.3)] animate-in zoom-in duration-200">
            <button onClick={() => setShowStatus(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X/></button>
            <div className="flex justify-between items-start mb-8">
                <Logo size={60} />
                <div className="text-right">
                    <p className="text-[10px] text-system-blue font-black uppercase italic">Hunter ID</p>
                    <p className="text-2xl font-black text-white uppercase tracking-tighter">{playerData.name}</p>
                </div>
            </div>
            <div className="space-y-4 font-mono text-sm">
                <div className="flex justify-between border-b border-gray-900 pb-2"><span className="text-gray-500">RANK</span><span className="text-system-purple font-black">{stats.rank}</span></div>
                <div className="flex justify-between border-b border-gray-900 pb-2"><span className="text-gray-500">LEVEL</span><span className="text-white font-black">{playerData.level}</span></div>
                <div className="flex justify-between border-b border-gray-900 pb-2"><span className="text-gray-500">CONQUESTS</span><span className="text-system-blue font-black">{playerData.completedChapters?.length || 0}</span></div>
                <div className="flex justify-between border-b border-gray-900 pb-2"><span className="text-gray-500">STAMINA</span><span className="text-system-accent font-black uppercase">{stats.displayTime}</span></div>
            </div>
            <button onClick={() => window.print()} className="w-full mt-10 bg-system-blue text-black font-black py-3 uppercase text-[10px] tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2 shadow-lg"><Download size={14}/> Generate ID Card</button>
          </div>
        </div>
      )}

      {/* --- HELP MODAL --- */}
      {showHelp && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a0a0c] border-2 border-system-purple w-full max-w-lg p-10 relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X/></button>
            <h2 className="text-2xl font-black text-system-purple uppercase mb-8 italic border-b border-gray-900 pb-4">System Intelligence</h2>
            <div className="space-y-6 text-[11px] text-gray-400 font-mono leading-relaxed uppercase tracking-tighter italic">
              <p><span className="text-system-blue font-black mr-2 underline">STAMINA:</span> Current XP progress. 5 Clearance = 1 LVL UP.</p>
              <p><span className="text-system-purple font-black mr-2 underline">MANA:</span> Live Study Extraction. Linked to your Daily Goal.</p>
              <p><span className="text-red-500 font-black mr-2 underline">PENALTY:</span> Missed tasks from previous cycles. Must be cleared to regain rank.</p>
            </div>
          </div>
        </div>
      )}

      {/* --- RAID OVERLAY --- */}
      {isRaidActive && (
        <div className="fixed inset-0 z-[110] bg-black/98 flex flex-col items-center justify-center border-4 border-red-900/10 backdrop-blur-2xl p-6">
          <Sword className="text-red-600 mb-8 animate-bounce" size={70} />
          <h2 className="text-red-500 text-sm font-black tracking-[1em] mb-4 uppercase italic">Quest instance active</h2>
          <h3 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter mb-12 text-center max-w-xl">{dailyQuests[activeQuestIndex].topic}</h3>
          <button onClick={() => clearQuest()} className="px-16 md:px-24 py-5 bg-system-blue text-black font-black uppercase shadow-[0_0_50px_#00f2ff] hover:scale-110 transition-all tracking-[0.2em] italic text-sm">Clear quest</button>
          <button onClick={() => setIsRaidActive(false)} className="text-gray-700 mt-10 uppercase text-[10px] tracking-[0.6em] font-black hover:text-white">Abandon Instance</button>
        </div>
      )}

      {/* --- HEADER HUD (RESPONSIBLE) --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-900 pb-6 mb-10 gap-8 relative">
        <div className="flex items-center gap-5">
          <button onClick={() => setShowStatus(true)} className="relative group transition-all active:scale-95">
            <Logo size={55} />
            <div className="absolute -inset-2 bg-system-blue/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
          <div>
            <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white uppercase leading-none">{playerData?.name} <span className="text-system-blue text-xl ml-2 font-normal">LVL {playerData?.level}</span></h1>
            <div className="flex gap-2 mt-3 overflow-x-auto whitespace-nowrap pb-1">
              <span className="text-[7px] md:text-[9px] text-system-purple font-black tracking-[0.3em] uppercase border border-system-purple/30 px-3 py-0.5 bg-system-purple/5 italic">{stats.rank}</span>
              <span className="text-[7px] md:text-[9px] text-gray-500 font-bold border border-gray-800 px-3 py-0.5 uppercase tracking-widest italic">Class: {playerData?.studentType}</span>
            </div>
          </div>
        </div>

        {/* STOPWATCH (CENTRAL MOBILE HUB) */}
        <div className="bg-[#0a0a0a] border-2 border-gray-800 p-4 flex items-center justify-between gap-6 shadow-2xl relative overflow-hidden group w-full lg:w-auto lg:min-w-[320px]">
            <div className="absolute top-0 left-0 h-full bg-system-blue/5 border-r border-system-blue/20 transition-all duration-1000" style={{width: `${stats.mana}%`}}></div>
            <div className="relative z-10">
                <p className="text-[7px] text-gray-500 font-black uppercase tracking-[0.3em] mb-0.5 italic">Extraction Unit</p>
                <div className="text-2xl md:text-3xl font-black text-white tracking-tighter font-mono leading-none">{stats.displayTime}</div>
            </div>
            <button onClick={toggleStopwatch} className={`relative z-10 p-4 rounded-full transition-all active:scale-90 ${isTimerActive ? 'bg-red-900/20 text-red-500 border-2 border-red-500' : 'bg-system-blue/20 text-system-blue border-2 border-system-blue shadow-[0_0_20px_rgba(0,242,255,0.3)]'}`}>
                {isTimerActive ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
          <button onClick={() => setShowHelp(true)} className="p-2 text-gray-600 hover:text-system-blue"><Info size={24} /></button>
          <button onClick={() => navigate('/library')} className="flex items-center gap-2 px-5 py-2 border-2 border-gray-800 hover:border-system-blue bg-black transition-all group shadow-xl">
            <Book size={18} className="text-system-blue group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-white tracking-widest italic">Archives</span>
          </button>
          <button onClick={() => navigate('/settings')} className="p-2.5 border-2 border-gray-800 rounded-sm hover:border-system-blue text-gray-500 hover:text-white transition-all bg-[#0a0a0a]"><Settings size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT PANEL: BARS & LEADERBOARD */}
        <div className="lg:col-span-3 space-y-8 order-2 lg:order-1">
          <div className="bg-[#080808] border-2 border-gray-900 p-6 shadow-xl relative group">
            <div className="flex justify-between text-[8px] font-black text-system-blue mb-2 uppercase tracking-[0.2em] italic"><span>Stamina (Level Sync)</span><span>{stats.stamina}%</span></div>
            <div className="h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-800"><div className="h-full bg-system-blue shadow-[0_0_15px_#00f2ff] transition-all duration-1000" style={{width: `${stats.stamina}%`}}></div></div>
            <div className="flex justify-between text-[8px] font-black text-system-purple mt-6 mb-2 uppercase tracking-[0.2em] italic"><span>Mana (Daily output)</span><span>{stats.mana}%</span></div>
            <div className="h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-800"><div className="h-full bg-system-purple shadow-[0_0_15px_#7000ff] transition-all duration-1000" style={{width: `${stats.mana}%`}}></div></div>
            <p className="text-[7px] text-gray-700 mt-6 font-mono text-center uppercase tracking-widest font-black italic">Quota: {playerData?.studyHours}H_DAILY</p>
          </div>

          {/* THE PENALTY BOX (BACKLOG) */}
          {backlog.length > 0 && (
            <div className="bg-red-950/10 border-2 border-red-900/40 p-5 shadow-2xl relative group overflow-hidden">
                <div className="absolute top-0 right-0 bg-red-900 text-white text-[7px] px-3 py-1 font-black uppercase tracking-tighter">Instance_Overdue</div>
                <h2 className="text-[11px] font-black text-red-500 uppercase tracking-[0.5em] mb-6 flex items-center gap-3 italic"><AlertTriangle size={16}/> Penalty quests</h2>
                <div className="space-y-3">
                    {backlog.map((q, i) => (
                        <div key={i} className="flex justify-between items-center group bg-black/40 p-3 border border-red-900/20 border-l-4 border-l-red-600 animate-pulse-slow">
                            <div className="max-w-[120px]"><p className="text-[7px] text-red-900 font-bold uppercase truncate">{q.book}</p><p className="text-[10px] text-white font-black uppercase italic truncate">{q.topic}</p></div>
                            <button onClick={() => clearQuest(i, true)} className="border-2 border-red-900 text-red-500 px-4 py-1.5 text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all italic active:scale-90">Clear</button>
                        </div>
                    ))}
                </div>
            </div>
          )}

          <div className="bg-[#080808] border-2 border-gray-900 p-6 relative overflow-hidden shadow-2xl hidden md:block">
            <h2 className="text-[10px] font-black text-system-blue uppercase tracking-[0.4em] mb-6 flex items-center gap-3 italic border-b border-gray-900 pb-2"><Trophy size={14}/> Rankings</h2>
            <div className="space-y-4">{leaderboard.map((h, i) => (<div key={h.id} className="flex justify-between items-center text-[10px] border-b border-gray-900/50 pb-3 last:border-0 group"><span className="text-gray-500 uppercase italic font-bold">0{i+1} {h.name}</span><span className="text-system-blue font-black tracking-tighter italic">LVL {h.level}</span></div>))}</div>
          </div>
        </div>

        {/* --- CENTER: THE TO-DO LIST --- */}
        <div className="lg:col-span-6 space-y-10 order-1 lg:order-2">
          <div className="flex justify-between items-end px-1 border-b-2 border-gray-900 pb-3">
            <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-4 uppercase italic tracking-tighter">
              <Zap size={24} className="text-system-blue" fill="currentColor" /> Active Directives
            </h2>
            <div className="text-[9px] md:text-[11px] font-mono text-system-blue border-2 border-gray-800 px-4 py-1 tracking-widest font-black uppercase italic shadow-2xl">Reset: {timeLeft}</div>
          </div>

          <div className="space-y-5">
            {dailyQuests.map((quest, i) => (
              <div key={i} className={`group relative border-2 transition-all duration-300 ${quest.completed ? 'bg-black/40 border-gray-900 opacity-40 shadow-none' : 'bg-[#0a0a0a] border-gray-800 hover:border-system-blue shadow-2xl'} p-6 md:p-10 overflow-hidden`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-6">
                  <div className="max-w-full md:max-w-[75%]">
                    <p className={`text-[9px] font-black uppercase tracking-[0.5em] mb-1 italic ${quest.type === 'emergency' ? 'text-red-600' : 'text-system-blue'}`}>{quest.type ? quest.book : `Grimoire: ${quest.book.split(' - ')[0]}`}</p>
                    <h3 className={`text-xl md:text-3xl font-black italic uppercase tracking-tighter leading-tight ${quest.completed ? 'text-gray-600 line-through' : 'text-white group-hover:text-system-blue transition-colors'}`}>{quest.topic}</h3>
                    {!quest.completed && <p className="text-[10px] text-gray-600 font-bold mt-4 uppercase tracking-[0.2em] italic flex items-center gap-2"><Activity size={12}/> Focus Required: {quest.hours}H</p>}
                  </div>
                  {quest.completed ? <CheckCircle2 size={40} className="text-system-blue shadow-[0_0_20px_#00f2ff]" /> : (
                    <button onClick={() => { setActiveQuestIndex(i); setIsRaidActive(true); }} className={`w-full md:w-auto border-2 px-12 py-4 font-black italic uppercase text-xs transition-all active:scale-95 shadow-[0_0_20px_rgba(0,242,255,0.15)] flex items-center justify-center gap-3 ${quest.type === 'emergency' ? 'border-red-600 text-red-600 hover:bg-red-600 hover:text-black' : 'border-system-blue text-system-blue hover:bg-system-blue hover:text-black'}`}><Sword size={16}/> Raid</button>
                  )}
                </div>
                <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-system-blue/5 to-transparent skew-x-12 translate-x-12 group-hover:translate-x-6 transition-transform duration-700"></div>
                <div className="absolute bottom-0 left-0 w-2 h-0 group-hover:h-full bg-system-blue transition-all duration-700"></div>
              </div>
            ))}
            {dailyQuests.length === 0 && <div className="p-16 border-2 border-dashed border-gray-900 text-center opacity-30 italic"><p className="text-xl font-black uppercase tracking-[1em]">All_Quests_Cleared</p></div>}
          </div>
        </div>

        {/* --- RIGHT PANEL --- */}
        <div className="lg:col-span-3 space-y-10 order-3">
          <div className="bg-[#080808] border-2 border-gray-900 p-6 shadow-2xl relative overflow-hidden">
             <div className="absolute -top-10 -right-10 opacity-5 rotate-12"><Cpu size={150}/></div>
             <h2 className="text-[11px] font-black text-system-purple uppercase tracking-[0.6em] mb-10 flex items-center gap-4 italic border-b border-gray-900 pb-2"><BookOpen size={20} className="text-system-purple" /> Inventory</h2>
             <div className="space-y-6">
               {playerData?.books?.map((b, i) => (
                 <div key={i} className="flex flex-col border-b-2 border-gray-900/50 pb-5 last:border-0 group cursor-default transition-all">
                   <div className="flex justify-between items-center mb-1"><span className="text-[8px] text-system-purple font-black uppercase italic opacity-60 group-hover:opacity-100 transition-opacity">Slot: 0{i+1}</span><Shield size={12} className="text-gray-800" /></div>
                   <span className="text-[11px] font-black text-gray-500 group-hover:text-white uppercase italic truncate transition-all group-hover:translate-x-1 leading-none tracking-tighter">{b}</span>
                 </div>
               ))}
             </div>
          </div>
          <div className="bg-[#080808] border border-gray-900 p-6">
             <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.6em] mb-8 flex items-center gap-4 italic border-b border-gray-900 pb-3"><TrendingUp size={18}/> Conquests</h2>
             <div className="max-h-64 overflow-y-auto custom-scrollbar pr-3 space-y-5">
               {playerData?.completedChapters?.slice(-8).reverse().map((item, i) => (
                 <div key={i} className="text-[9px] border-l-4 border-system-blue pl-5 py-2 bg-system-blue/5 italic font-bold text-white uppercase truncate shadow-lg border-r border-y border-gray-900">{item.split(':')[1]}</div>
               ))}
             </div>
          </div>
          <div className="p-4 bg-system-blue/5 border-2 border-gray-900 flex items-center justify-between shadow-inner shadow-black"><Database size={16} className="text-gray-800" /><p className="text-[7px] text-gray-700 font-mono tracking-widest uppercase font-black italic leading-none">V2.5.0_NOMINAL</p></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;