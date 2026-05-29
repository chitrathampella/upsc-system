import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Settings, Zap, BookOpen, TrendingUp, CheckCircle2, Book, Sword, Activity, Terminal, Shield, Trophy, Play, Pause } from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';
import Logo from '../components/Logo';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [timeLeft, setTimeLeft] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Dungeon Raid State (Now simple focus mode)
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [activeQuestIndex, setActiveQuestIndex] = useState(null);

  // Global Stopwatch State (YTP Style)
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [totalSecondsToday, setTotalSecondsToday] = useState(0);

  const fetchLeaderboard = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("level", "desc"), limit(5));
      const querySnapshot = await getDocs(q);
      setLeaderboard(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.error("Leaderboard Failure", e); }
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

    // Reset daily study time to 0 in DB on new day
    await updateDoc(doc(db, "users", user.uid), { currentQuests: newQuests, lastQuestDate: today, studyTimeToday: 0 });
    setDailyQuests(newQuests);
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
        
        const today = new Date().toISOString().split('T')[0];
        if (data.lastQuestDate === today && data.currentQuests) {
          setDailyQuests(data.currentQuests);
        } else {
          generateNewDailyQuests(data);
        }
        fetchLeaderboard();
      } else {
        navigate('/onboarding');
      }
    } catch (e) {
      console.error("System Fetch Error:", e);
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
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchPlayerData]);

  // --- STOPWATCH ENGINE ---
  useEffect(() => {
    let interval = null;
    if (isTimerActive) {
      interval = setInterval(() => setSessionSeconds(prev => prev + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
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

  const formatTime = (totalSecs) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const clearQuest = async (index) => {
    const targetIdx = index !== undefined ? index : activeQuestIndex;
    if (targetIdx === null) return;

    const updatedQuests = [...dailyQuests];
    updatedQuests[targetIdx].completed = true;
    const quest = updatedQuests[targetIdx];
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

  const calculateStats = () => {
    if (!playerData) return { stamina: 100, mana: 0 };
    const targetSeconds = (playerData.studyHours || 1) * 3600;
    const currentSeconds = totalSecondsToday + sessionSeconds;
    const mana = Math.min(Math.round((currentSeconds / targetSeconds) * 100), 100);
    const stamina = Math.min(80 + (playerData.level * 2), 100);
    return { stamina, mana };
  };

  const stats = calculateStats();

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic animate-pulse text-4xl tracking-widest">SYNCHRONIZING...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-12 select-none">
      
      {/* RAID OVERLAY (NO TIMER) */}
      {isRaidActive && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center border-4 border-red-900/10 backdrop-blur-sm">
          <Sword className="text-red-600 mb-6 animate-pulse" size={80} />
          <h2 className="text-red-500 text-sm font-black tracking-[0.8em] mb-4 uppercase">Dungeon instance active</h2>
          <div className="text-center mb-12">
             <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-2">Current Mission</p>
             <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter">{dailyQuests[activeQuestIndex].topic}</h3>
          </div>
          
          <div className="flex flex-col gap-6 items-center">
            <button 
              onClick={() => clearQuest()} 
              className="px-24 py-5 bg-system-blue text-black font-black uppercase shadow-[0_0_40px_#00f2ff] hover:scale-105 transition-all tracking-[0.2em]"
            >
              Clear quest
            </button>
            <button 
              onClick={() => setIsRaidActive(false)} 
              className="text-gray-700 hover:text-white transition-colors uppercase text-[10px] tracking-[0.4em] font-bold mt-4"
            >
              Escape instance
            </button>
          </div>
        </div>
      )}

      {/* HEADER HUD */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-900 pb-8 mb-12 gap-8">
        <div className="flex items-center gap-6">
          <Logo size={70} />
          <div>
            <h1 className="text-6xl font-black italic tracking-tighter text-white uppercase leading-none">
              {playerData?.name} <span className="text-system-blue text-2xl ml-2 font-normal">LVL {playerData?.level}</span>
            </h1>
            <div className="flex gap-4 mt-3">
              <span className="text-[10px] text-system-purple font-bold tracking-[0.4em] uppercase border border-system-purple/30 px-3 py-0.5 bg-system-purple/5">E-RANK HUNTER</span>
              <span className="text-[10px] text-gray-500 font-bold tracking-[0.4em] uppercase border border-gray-800 px-3 py-0.5">CLASS: {playerData?.studentType}</span>
            </div>
          </div>
        </div>

        {/* --- GLOBAL STUDY STOPWATCH (YTP STYLE) --- */}
        <div className="bg-[#0a0a0a] border-2 border-gray-800 p-4 flex items-center gap-10 shadow-2xl shadow-black relative overflow-hidden group min-w-[320px]">
            <div className="absolute top-0 left-0 h-full bg-system-blue/5 transition-all duration-1000" style={{width: `${stats.mana}%`}}></div>
            <div className="relative z-10">
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] mb-1">Mana extraction</p>
                <div className="text-3xl font-black text-white tracking-tighter font-mono leading-none">
                    {formatTime(isTimerActive ? sessionSeconds : totalSecondsToday)}
                </div>
            </div>
            <button 
                onClick={toggleStopwatch}
                className={`relative z-10 p-4 rounded-full transition-all ${isTimerActive ? 'bg-red-900/20 text-red-500 border border-red-500' : 'bg-system-blue/20 text-system-blue border border-system-blue shadow-[0_0_20px_rgba(0,242,255,0.4)]'}`}
            >
                {isTimerActive ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
            </button>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/library')} className="flex items-center gap-3 px-6 py-2.5 border-2 border-gray-800 hover:border-system-blue bg-[#0a0a0a] transition-all group shadow-lg">
            <Book size={20} className="text-system-blue group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-black uppercase text-gray-500 group-hover:text-white tracking-widest">Archives</span>
          </button>
          <button onClick={() => navigate('/settings')} className="p-3 border-2 border-gray-800 rounded-sm hover:border-system-blue text-gray-500 hover:text-white transition-all"><Settings size={24} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT PANEL: STATS & LOGS */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-[#080808] border border-gray-900 p-6 shadow-xl">
            <div className="flex justify-between text-[10px] font-bold text-system-blue mb-2 uppercase tracking-widest"><span>STAMINA (CONSISTENCY)</span><span>{stats.stamina}%</span></div>
            <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
              <div className="h-full bg-system-blue shadow-[0_0_10px_#00f2ff]" style={{width: `${stats.stamina}%`}}></div>
            </div>
            <div className="flex justify-between text-[10px] font-bold text-system-purple mt-5 mb-2 uppercase tracking-widest"><span>MANA (DAILY FOCUS)</span><span>{stats.mana}%</span></div>
            <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
              <div className="h-full bg-system-purple shadow-[0_0_10px_#7000ff]" style={{width: `${stats.mana}%`}}></div>
            </div>
          </div>

          <div className="bg-[#080808] border border-gray-900 p-6">
            <h2 className="text-[11px] font-black text-system-blue uppercase tracking-[0.4em] mb-6 flex items-center gap-3"><Trophy size={16}/> Top Hunters</h2>
            <div className="space-y-4">
              {leaderboard.map((h, i) => (
                <div key={h.id} className="flex justify-between items-center text-[11px] border-b border-gray-900 pb-3 last:border-0">
                  <span className="text-gray-500 uppercase italic">0{i+1} {h.name}</span>
                  <span className="text-system-blue font-black">LVL {h.level}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#080808] border border-gray-900 p-6">
            <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-3"><Terminal size={14}/> System logs</h2>
            <div className="font-mono text-[9px] text-gray-600 space-y-1 italic leading-relaxed">
              <p>[System] Sync_complete: 100%</p>
              <p>[Data] {playerData?.completedChapters?.length} instances cleared.</p>
              <p className="text-system-blue">[Alert] Reset in {timeLeft}</p>
            </div>
          </div>
        </div>

        {/* CENTER PANEL: QUESTS */}
        <div className="lg:col-span-6 space-y-8">
          <div className="flex justify-between items-end px-2 border-b border-gray-900 pb-3">
            <h2 className="text-3xl font-black text-white flex items-center gap-4 uppercase italic tracking-tighter">
              <Zap size={28} className="text-system-blue" fill="currentColor" /> System Directives
            </h2>
            <div className="text-[11px] font-mono text-system-blue bg-system-blue/10 px-4 py-1.5 border border-system-blue/20 tracking-widest font-black uppercase">Next_Reset: {timeLeft}</div>
          </div>

          <div className="space-y-6">
            {dailyQuests.map((quest, i) => (
              <div key={i} className={`group relative border-2 transition-all duration-300 ${quest.completed ? 'bg-black/40 border-gray-900 opacity-40 shadow-none' : 'bg-[#0a0a0a] border-gray-800 hover:border-system-blue shadow-2xl'} p-8`}>
                <div className="flex justify-between items-center relative z-10">
                  <div className="max-w-[75%]">
                    <p className="text-[10px] font-black text-system-blue uppercase tracking-[0.4em] mb-2">{quest.book.split(' - ')[0]}</p>
                    <h3 className={`text-3xl font-black italic uppercase tracking-tighter leading-tight ${quest.completed ? 'text-gray-600 line-through' : 'text-white group-hover:text-system-blue'}`}>{quest.topic}</h3>
                    {!quest.completed && <p className="text-[11px] text-gray-600 font-bold mt-5 uppercase tracking-widest italic flex items-center gap-2"><Activity size={12}/> Estimated Stamina: {quest.hours} Hours</p>}
                  </div>
                  {quest.completed ? <CheckCircle2 size={48} className="text-system-blue" /> : (
                    <button onClick={() => { setActiveQuestIndex(i); setIsRaidActive(true); }} className="border-2 border-system-blue text-system-blue px-10 py-4 font-black italic uppercase text-sm hover:bg-system-blue hover:text-black transition-all shadow-[0_0_20px_rgba(0,242,255,0.15)] flex items-center gap-3">
                      <Sword size={18}/> Raid
                    </button>
                  )}
                </div>
                {/* Visual HUD Skew Background */}
                <div className="absolute top-0 right-0 w-40 h-full bg-gradient-to-l from-system-blue/5 to-transparent skew-x-12 translate-x-24 pointer-events-none group-hover:translate-x-12 transition-transform duration-700"></div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: INVENTORY & RECENT PROGRESS */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-[#080808] border border-gray-900 p-7">
             <h2 className="text-[11px] font-black text-system-purple uppercase tracking-[0.4em] mb-8 flex items-center gap-3"><BookOpen size={18}/> Inventory</h2>
             <div className="space-y-5">
               {playerData?.books?.map((b, i) => (
                 <div key={i} className="flex flex-col border-b border-gray-900 pb-4 last:border-0 group">
                   <span className="text-[9px] text-system-purple font-bold uppercase mb-1">Slot: 0{i+1}</span>
                   <span className="text-xs font-black text-gray-500 group-hover:text-white uppercase italic truncate transition-colors leading-relaxed tracking-tight">{b}</span>
                 </div>
               ))}
             </div>
          </div>
          <div className="bg-[#080808] border border-gray-900 p-6">
             <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] mb-5"><TrendingUp size={16}/> Conquests</h2>
             <div className="max-h-48 overflow-y-auto custom-scrollbar pr-3 space-y-4">
               {playerData?.completedChapters?.slice(-6).reverse().map((item, i) => (
                 <div key={i} className="text-[9px] border-l-2 border-system-blue pl-4 py-1 animate-in fade-in">
                    <p className="text-white font-bold leading-tight uppercase">{item.split(':')[1]}</p>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;