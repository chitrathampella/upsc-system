import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { 
  Settings, Zap, BookOpen, TrendingUp, CheckCircle2, 
  Book, Sword, Activity, Terminal, Shield, Trophy, 
  Play, Pause, Layout, Cpu, Database, Clock, AlertTriangle, X, Info, User, Share2 
} from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';
import Logo from '../components/Logo';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  
  // --- CORE DATA STATES ---
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [backlog, setBacklog] = useState([]); // These are the Penalty Quests
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

    // MANA: Based on Study Seconds vs Daily Goal Hours (from settings)
    const targetSeconds = (playerData.studyHours || 4) * 3600;
    const currentSeconds = totalSecondsToday + sessionSeconds;
    const manaPercent = Math.min(Math.round((currentSeconds / targetSeconds) * 100), 100);

    // STAMINA: XP progress toward next level (500 XP per level)
    const currentXP = playerData.xp || 0;
    const xpTowardsNextLevel = currentXP % 500;
    const staminaPercent = Math.round((xpTowardsNextLevel / 500) * 100);

    // RANK: Based on Level milestones
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
      totalHours: (currentSeconds / 3600).toFixed(1)
    };
  }, [playerData, totalSecondsToday, sessionSeconds]);

  // --- 2. DATABASE: FETCH LEADERBOARD ---
  const fetchLeaderboard = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("level", "desc"), limit(5));
      const querySnapshot = await getDocs(q);
      setLeaderboard(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Leaderboard Sync Failure", e);
    }
  };

  // --- 3. QUEST ENGINE: GENERATOR WITH BACKLOG LOGIC ---
  const generateNewDailyQuests = useCallback(async (userData, daysMissed = 0, oldQuests = []) => {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
    const completed = userData.completedChapters || [];
    
    // BACKLOG MIGRATION: Move yesterday's unfinished to Penalty
    const unfinishedFromYesterday = oldQuests.filter(q => !q.completed);
    let newBacklog = [...(userData.backlog || []), ...unfinishedFromYesterday];

    // If user missed multiple days, add "Missed Training" penalties
    if (daysMissed > 1) {
        for (let i = 0; i < Math.min(daysMissed, 7); i++) {
            newBacklog.push({
                book: "SYSTEM",
                topic: `Missed Training - Day Gap 0${i + 1}`,
                hours: 2,
                completed: false,
                type: 'penalty'
            });
        }
    }

    let newQuests = [];

    // --- WEEKEND SPECIAL EVENTS ---
    if (dayOfWeek === 6) { // SATURDAY: REVISION & CA
        newQuests.push({ 
            book: "SYSTEM", topic: "Weekly Current Affairs Recap", 
            hours: 3, completed: false, type: 'special' 
        });
        newQuests.push({ 
            book: "MAINTENANCE", topic: "Core Revision: All Weekly Progress", 
            hours: userData.studyHours || 4, completed: false, type: 'special' 
        });
    } else if (dayOfWeek === 0) { // SUNDAY: MOCKS
        newQuests.push({ 
            book: "EMERGENCY", topic: "Full Length Mock Dungeon (GS + CSAT)", 
            hours: 4, completed: false, type: 'emergency' 
        });
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

    // Save state to Cloud
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

  // --- 4. PLAYER DATA FETCHING ---
  const fetchPlayerData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlayerData(data);
        setTotalSecondsToday(data.studyTimeToday || 0);
        setBacklog(data.backlog || []);
        
        const todayObj = new Date();
        const todayStr = todayObj.toISOString().split('T')[0];
        const lastDateStr = data.lastQuestDate || todayStr;
        
        // Calculate Gaps
        const lastDate = new Date(lastDateStr);
        const diffDays = Math.floor(Math.abs(todayObj - lastDate) / (1000 * 60 * 60 * 24));

        const dayOfWeek = todayObj.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const currentIsSpecial = data.currentQuests?.some(q => q.type === 'special' || q.type === 'emergency');

        // Logic Check: New day or Weekend Transition?
        if (todayStr !== lastDateStr || (isWeekend && !currentIsSpecial)) {
          generateNewDailyQuests(data, diffDays, data.currentQuests || []);
        } else {
          setDailyQuests(data.currentQuests || []);
        }

        fetchLeaderboard();
      } else {
        navigate('/onboarding');
      }
    } catch (e) {
      console.error("System Sync Error", e);
    } finally {
      setLoading(false);
    }
  }, [user, navigate, generateNewDailyQuests]);

  // --- 5. CHRONO EFFECT (COUNTDOWN & STOPWATCH) ---
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

  // --- 6. ACTIONS (STOPWATCH & CLEAR) ---
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
    const targetIdx = isBacklog ? index : activeQuestIndex;
    const sourceArray = isBacklog ? [...backlog] : [...dailyQuests];
    const quest = sourceArray[targetIdx];
    
    // Stats Update
    const newXP = (playerData.xp || 0) + 100;
    const newLvl = Math.floor(newXP / 500) + 1;

    // Quest Reward: Adds 1 hour of "Mana" per quest cleared
    const manaReward = 3600; 
    const newTotalStudyTime = (playerData.studyTimeToday || 0) + manaReward;

    const chapterId = `${quest.book}:${quest.topic}`;
    // Only save real chapters to history
    const newHistory = (quest.type === 'special' || quest.type === 'emergency') 
        ? (playerData.completedChapters || []) 
        : [...(playerData.completedChapters || []), chapterId];

    const dbUpdates = { 
        completedChapters: newHistory, 
        xp: newXP, 
        level: newLvl, 
        studyTimeToday: newTotalStudyTime 
    };

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
    setPlayerData({ ...playerData, level: newLvl, xp: newXP, completedChapters: newHistory, studyTimeToday: newTotalStudyTime });
    setTotalSecondsToday(newTotalStudyTime);
    setIsRaidActive(false);
    setActiveQuestIndex(null);
  };

  const formatTime = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;

  // --- 7. RENDER LOADING ---
  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center text-system-blue font-system italic animate-pulse tracking-[1em]">
      <Cpu className="mb-6 animate-spin" size={50} />
      RE-INITIALIZING_CORE...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-6 select-none overflow-x-hidden">
      
      {/* --- MODAL: STATUS WINDOW --- */}
      {showStatus && (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#0a0a0c] border-2 border-system-blue w-full max-w-md p-10 relative shadow-[0_0_60px_rgba(0,242,255,0.25)]">
            <button onClick={() => setShowStatus(false)} className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors"><X/></button>
            <div className="flex justify-between items-start mb-12">
                <Logo size={65} />
                <div className="text-right">
                    <p className="text-[10px] text-system-blue font-black uppercase tracking-[0.4em] mb-1 italic">Hunter Profile Card</p>
                    <p className="text-3xl font-black text-white italic uppercase tracking-tighter">{playerData.name}</p>
                </div>
            </div>
            <div className="space-y-6 font-mono">
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 text-xs uppercase">Rank Status</span><span className="text-system-purple font-black">{stats.rank}</span></div>
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 text-xs uppercase">Power Level</span><span className="text-white font-black">{playerData.level}</span></div>
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 text-xs uppercase">Conquest Data</span><span className="text-system-blue font-black">{playerData.completedChapters?.length || 0} CH</span></div>
                <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500 text-xs uppercase">Mana Used</span><span className="text-system-accent font-black uppercase italic">{formatTime(totalSecondsToday + sessionSeconds)}</span></div>
            </div>
            <div className="mt-12 flex gap-4">
                <button className="flex-1 bg-system-blue/10 border border-system-blue text-system-blue py-3 font-black uppercase text-[10px] tracking-widest hover:bg-system-blue hover:text-black transition-all">Download ID</button>
                <button onClick={() => setShowStatus(false)} className="flex-1 border border-gray-800 text-gray-500 py-3 font-black uppercase text-[10px]">Close HUD</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: SYSTEM GUIDE --- */}
      {showHelp && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a0a0c] border-2 border-system-purple w-full max-w-lg p-10 relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-gray-600 hover:text-white"><X/></button>
            <h2 className="text-3xl font-black text-system-purple uppercase tracking-widest mb-10 italic border-b border-gray-900 pb-4 flex items-center gap-4">
               <Info size={28}/> System Intelligence
            </h2>
            <div className="space-y-6 text-[10px] text-gray-400 font-mono leading-relaxed uppercase tracking-tighter">
              <p><span className="text-system-blue font-black mr-2">1. STAMINA (SYNC):</span> This reflects your XP progress. Complete 5 Directives to Level UP.</p>
              <p><span className="text-system-purple font-black mr-2">2. MANA (OUTPUT):</span> Based on your stopwatch timer vs your daily hour goal.</p>
              <p><span className="text-red-500 font-black mr-2">3. PENALTY BOX:</span> Missed quests from yesterday move here. Clear them to maintain rank.</p>
              <p><span className="text-white font-black mr-2">4. RAID INSTANCE:</span> Clicking RAID enters full-screen focus mode. Mark objective complete to exit.</p>
            </div>
          </div>
        </div>
      )}

      {/* --- OVERLAY: RAID INSTANCE --- */}
      {isRaidActive && (
        <div className="fixed inset-0 z-[110] bg-black/98 flex flex-col items-center justify-center border-4 border-red-900/10 backdrop-blur-xl">
          <Sword className="text-red-600 mb-10 animate-bounce shadow-[0_0_30px_rgba(255,0,0,0.5)]" size={80} />
          <h2 className="text-red-500 text-sm font-black tracking-[1em] mb-4 uppercase italic">Quest instance active</h2>
          <div className="text-center mb-16 max-w-2xl px-6">
             <p className="text-gray-600 text-[10px] uppercase tracking-[0.5em] mb-4 italic">Operational Objective</p>
             <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-tight">{dailyQuests[activeQuestIndex].topic}</h3>
          </div>
          <div className="flex flex-col gap-6 items-center">
            <button 
                onClick={() => clearQuest()} 
                className="px-24 py-5 bg-system-blue text-black font-black uppercase shadow-[0_0_50px_#00f2ff] hover:scale-110 transition-all tracking-[0.3em] italic"
            >
              Clear objective
            </button>
            <button 
                onClick={() => setIsRaidActive(false)} 
                className="text-gray-700 hover:text-white transition-colors uppercase text-[10px] tracking-[0.8em] font-black mt-4"
            >
              Exit dungeon
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
            <Logo size={60} />
            <div className="absolute -inset-2 bg-system-blue/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
          <div>
            <h1 className="text-5xl font-black italic tracking-tighter text-white uppercase leading-none">
              {playerData?.name} <span className="text-system-blue text-2xl ml-2 font-normal italic">LVL {playerData?.level}</span>
            </h1>
            <div className="flex gap-4 mt-3">
              <span className="text-[9px] text-system-purple font-black tracking-[0.4em] uppercase border-2 border-system-purple/30 px-3 py-1 bg-system-purple/5 italic">{stats.rank}</span>
              <span className="text-[9px] text-gray-500 font-bold border border-gray-800 px-3 py-1 uppercase tracking-widest italic">Class: {playerData?.studentType}</span>
            </div>
          </div>
        </div>

        {/* --- LIVE MANA STOPWATCH UNIT --- */}
        <div className="bg-[#0a0a0a] border-2 border-gray-800 p-4 flex items-center gap-10 shadow-2xl relative overflow-hidden group min-w-[320px]">
            <div 
              className="absolute top-0 left-0 h-full bg-system-blue/5 border-r border-system-blue/30 transition-all duration-1000" 
              style={{width: `${stats.mana}%`}}
            ></div>
            <div className="relative z-10 flex items-center gap-4">
                <Clock className={isTimerActive ? "text-system-blue animate-spin-slow" : "text-gray-700"} size={20} />
                <div>
                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.4em] mb-1 italic">Mana extraction</p>
                    <div className="text-3xl font-black text-white tracking-tighter font-mono leading-none">
                        {formatTime(isTimerActive ? sessionSeconds : totalSecondsToday)}
                    </div>
                </div>
            </div>
            <button 
                onClick={toggleStopwatch}
                className={`relative z-10 p-4 rounded-full transition-all active:scale-90 ${isTimerActive ? 'bg-red-900/20 text-red-500 border-2 border-red-500 shadow-[0_0_20px_rgba(255,0,0,0.3)]' : 'bg-system-blue/20 text-system-blue border-2 border-system-blue shadow-[0_0_30px_rgba(0,242,255,0.4)]'}`}
            >
                {isTimerActive ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right hidden xl:block">
            <p className="text-[8px] text-gray-600 font-black uppercase tracking-tighter mb-1">Status</p>
            <p className="text-[10px] font-mono text-system-accent tracking-widest font-black uppercase animate-pulse italic">SYNC_ACTIVE</p>
          </div>
          <button onClick={() => setShowHelp(true)} className="p-2 text-gray-600 hover:text-system-blue transition-all"><Info size={24} /></button>
          <button 
            onClick={() => navigate('/library')} 
            className="flex items-center gap-3 px-6 py-2.5 border-2 border-gray-800 hover:border-system-blue bg-black transition-all group shadow-xl shadow-black"
          >
            <Book size={20} className="text-system-blue group-hover:scale-125 transition-transform" />
            <span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-white tracking-[0.3em]">Archives</span>
          </button>
          <button 
            onClick={() => navigate('/settings')} 
            className="p-3 border-2 border-gray-800 rounded-sm hover:border-system-blue text-gray-500 hover:text-white transition-all bg-[#0a0a0a] group"
          >
            <Settings size={22} className="group-hover:rotate-90 transition-transform duration-1000" />
          </button>
        </div>
      </div>

      {/* --- GRID SYSTEM --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* --- LEFT: STATS & BACKLOG --- */}
        <div className="lg:col-span-3 space-y-10">
          <div className="bg-[#080808] border-2 border-gray-900 p-6 shadow-2xl relative">
            <div className="flex justify-between text-[9px] font-black text-system-blue mb-2 uppercase tracking-[0.2em] italic"><span>Stamina (Sync)</span><span>{stats.stamina}%</span></div>
            <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800"><div className="h-full bg-system-blue shadow-[0_0_15px_#00f2ff] transition-all duration-1000" style={{width: `${stats.stamina}%`}}></div></div>
            <div className="flex justify-between text-[9px] font-black text-system-purple mt-6 mb-2 uppercase tracking-[0.2em] italic"><span>Mana (Output)</span><span>{stats.mana}%</span></div>
            <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800"><div className="h-full bg-system-purple shadow-[0_0_15px_#7000ff] transition-all duration-1000" style={{width: `${stats.mana}%`}}></div></div>
            <p className="text-[8px] text-gray-700 mt-6 font-mono text-center uppercase tracking-widest font-black italic">Quota: {playerData?.studyHours}H_DAILY</p>
          </div>

          {/* THE PENALTY PANEL */}
          {backlog.length > 0 && (
            <div className="bg-red-950/10 border-2 border-red-900/40 p-6 shadow-[0_0_30px_rgba(255,0,0,0.1)] relative">
                <div className="absolute top-0 right-0 bg-red-900 text-white text-[7px] px-2 py-0.5 font-black uppercase tracking-tighter">Penalty_Active</div>
                <h2 className="text-[11px] font-black text-red-500 uppercase tracking-[0.5em] mb-6 flex items-center gap-3 italic"><AlertTriangle size={16}/> Penalty quests</h2>
                <div className="space-y-4">
                    {backlog.map((q, i) => (
                        <div key={i} className="flex justify-between items-center group bg-black/40 p-2 border border-red-900/20">
                            <div className="max-w-[140px]">
                                <p className="text-[7px] text-red-900 font-black uppercase truncate italic">{q.book}</p>
                                <p className="text-[10px] text-white font-black uppercase italic truncate">{q.topic}</p>
                            </div>
                            <button onClick={() => clearQuest(i, true)} className="border-2 border-red-900 text-red-500 px-4 py-1.5 text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all italic active:scale-90">Clear</button>
                        </div>
                    ))}
                </div>
            </div>
          )}

          <div className="bg-[#080808] border-2 border-gray-900 p-6 relative overflow-hidden">
            <h2 className="text-[11px] font-black text-system-blue uppercase tracking-[0.5em] mb-8 flex items-center gap-4 italic border-b border-gray-900 pb-2"><Trophy size={16}/> Top hunters</h2>
            <div className="space-y-5">
              {leaderboard.map((h, i) => (
                <div key={h.id} className="flex justify-between items-center text-[11px] border-b border-gray-900/50 pb-4 last:border-0 opacity-60 hover:opacity-100 transition-opacity">
                  <span className="text-gray-400 uppercase italic font-bold">0{i+1} {h.name}</span>
                  <span className="text-system-blue font-black tracking-tighter">LVL {h.level}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- CENTER: THE TO-DO LIST --- */}
        <div className="lg:col-span-6 space-y-10">
          <div className="flex justify-between items-end px-2 border-b-2 border-gray-900 pb-3">
            <h2 className="text-3xl font-black text-white flex items-center gap-5 uppercase italic tracking-tighter">
              <Zap size={28} className="text-system-blue" fill="currentColor" /> Active Directives
            </h2>
            <div className="text-[11px] font-mono text-system-blue border-2 border-gray-800 px-4 py-1.5 tracking-widest font-black uppercase italic shadow-lg shadow-blue-900/5">Reset: {timeLeft}</div>
          </div>

          <div className="space-y-5">
            {dailyQuests.map((quest, i) => (
              <div 
                key={i} 
                className={`group relative border-2 transition-all duration-500 ${
                  quest.completed 
                  ? 'bg-black/40 border-gray-900 opacity-40 shadow-none' 
                  : 'bg-[#0a0a0a] border-gray-800 hover:border-system-blue shadow-2xl'
                } p-8 overflow-hidden`}
              >
                <div className="flex justify-between items-center relative z-10">
                  <div className="max-w-[75%]">
                    <p className={`text-[9px] font-black uppercase tracking-[0.5em] mb-2 italic ${quest.type ? 'text-red-500' : 'text-system-blue'}`}>
                      {quest.type ? quest.book : `Grimoire: ${quest.book.split(' - ')[0]}`}
                    </p>
                    <h3 className={`text-2xl font-black italic uppercase tracking-tighter leading-tight ${quest.completed ? 'text-gray-600 line-through' : 'text-white group-hover:text-system-blue'}`}>{quest.topic}</h3>
                    {!quest.completed && <p className="text-[10px] text-gray-600 font-bold mt-5 uppercase tracking-[0.3em] italic flex items-center gap-3"><Activity size={12}/> Focus instance: {quest.hours}H</p>}
                  </div>
                  
                  {quest.completed ? (
                    <CheckCircle2 size={45} className="text-system-blue shadow-[0_0_20px_#00f2ff]" />
                  ) : (
                    <button 
                      onClick={() => { setActiveQuestIndex(i); setIsRaidActive(true); }} 
                      className={`border-2 px-10 py-3.5 font-black italic uppercase text-xs transition-all active:scale-95 ${quest.type === 'emergency' ? 'border-red-600 text-red-600 hover:bg-red-600 hover:text-black' : 'border-system-blue text-system-blue hover:bg-system-blue hover:text-black shadow-[0_0_20px_rgba(0,242,255,0.15)]'}`}
                    >
                      {quest.type === 'emergency' ? 'RAID DUNGEON' : 'Raid'}
                    </button>
                  )}
                </div>
                <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-system-blue/5 to-transparent skew-x-12 translate-x-12 group-hover:translate-x-6 transition-transform duration-1000"></div>
              </div>
            ))}
            {dailyQuests.length === 0 && (
                <div className="p-20 border-2 border-dashed border-gray-900 text-center opacity-30">
                    <p className="text-xl font-black uppercase italic tracking-[1em]">All_Quests_Cleared</p>
                </div>
            )}
          </div>
        </div>

        {/* --- RIGHT: INVENTORY & LOGS --- */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-[#080808] border-2 border-gray-900 p-6 shadow-2xl relative overflow-hidden">
             <div className="absolute -top-10 -right-10 opacity-5 rotate-12"><Cpu size={150}/></div>
             <h2 className="text-[12px] font-black text-system-purple uppercase tracking-[0.6em] mb-10 flex items-center gap-4 italic border-b border-gray-900 pb-2"><BookOpen size={20} className="text-system-purple" /> Inventory</h2>
             <div className="space-y-6">
               {playerData?.books?.map((b, i) => (
                 <div key={i} className="flex flex-col border-b border-gray-900/50 pb-5 last:border-0 group cursor-default">
                   <div className="flex justify-between items-center mb-1"><span className="text-[8px] text-system-purple font-black uppercase italic opacity-60 group-hover:opacity-100">Slot: 0{i+1}</span><Shield size={12} className="text-gray-800" /></div>
                   <span className="text-[11px] font-black text-gray-500 group-hover:text-white uppercase italic truncate transition-all group-hover:translate-x-1 leading-none tracking-tight">{b}</span>
                 </div>
               ))}
             </div>
          </div>
          <div className="bg-[#080808] border border-gray-900 p-6">
             <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.6em] mb-6 flex items-center gap-4 italic border-b border-gray-900 pb-2"><TrendingUp size={16}/> Conquests</h2>
             <div className="max-h-48 overflow-y-auto custom-scrollbar pr-2 space-y-4">
               {playerData?.completedChapters?.slice(-6).reverse().map((item, i) => (
                 <div key={i} className="text-[9px] border-l-4 border-system-blue pl-4 py-1 bg-system-blue/5 italic font-bold text-white uppercase truncate shadow-lg">{item.split(':')[1]}</div>
               ))}
             </div>
          </div>
          <div className="p-4 bg-system-blue/5 border-2 border-gray-900 flex items-center justify-between shadow-inner">
              <Database size={14} className="text-gray-800" />
              <p className="text-[9px] text-gray-700 font-mono tracking-widest uppercase font-black italic">Sync_Status: NOMINAL</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;