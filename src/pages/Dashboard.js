import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Settings, Zap, BookOpen, TrendingUp, CheckCircle2, Book, Sword, Activity, Terminal, Shield, Trophy } from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';
import Logo from '../components/Logo';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [timeLeft, setTimeLeft] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [raidTimer, setRaidTimer] = useState(1500); 
  const [activeQuestIndex, setActiveQuestIndex] = useState(null);

  const fetchLeaderboard = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("level", "desc"), limit(5));
      const querySnapshot = await getDocs(q);
      setLeaderboard(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.error(e); }
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

    await updateDoc(doc(db, "users", user.uid), { currentQuests: newQuests, lastQuestDate: today });
    setDailyQuests(newQuests);
  }, [user.uid]);

  const fetchPlayerData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlayerData(data);
        const today = new Date().toISOString().split('T')[0];
        if (data.lastQuestDate === today && data.currentQuests) setDailyQuests(data.currentQuests);
        else generateNewDailyQuests(data);
        fetchLeaderboard();
      } else { navigate('/onboarding'); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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

  useEffect(() => {
    let interval = null;
    if (isRaidActive && raidTimer > 0) interval = setInterval(() => setRaidTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [isRaidActive, raidTimer]);

  const clearQuest = async () => {
    const updatedQuests = [...dailyQuests];
    updatedQuests[activeQuestIndex].completed = true;
    const quest = updatedQuests[activeQuestIndex];
    const chapterId = `${quest.book}:${quest.topic}`;
    const newHistory = [...(playerData.completedChapters || []), chapterId];
    const newXP = (playerData.xp || 0) + 100;
    const newLvl = Math.floor(newXP / 500) + 1;

    await updateDoc(doc(db, "users", user.uid), { currentQuests: updatedQuests, completedChapters: newHistory, xp: newXP, level: newLvl });
    setDailyQuests(updatedQuests);
    setPlayerData({ ...playerData, level: newLvl, xp: newXP, completedChapters: newHistory });
    setIsRaidActive(false);
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic animate-pulse text-4xl">SYNCING...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-8 select-none">
      {/* RAID OVERLAY */}
      {isRaidActive && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center border-4 border-red-900/20">
          <Sword className="text-red-600 mb-4 animate-pulse" size={60} />
          <h2 className="text-red-500 text-sm font-black tracking-[0.8em] mb-4">DUNGEON INSTANCE ACTIVE</h2>
          <div className="text-9xl font-black text-white mb-10 tracking-tighter">
            {Math.floor(raidTimer / 60)}:{(raidTimer % 60).toString().padStart(2, '0')}
          </div>
          <p className="text-gray-500 text-xs mb-10 uppercase tracking-widest italic">Target: {dailyQuests[activeQuestIndex].topic}</p>
          {raidTimer === 0 ? (
            <button onClick={clearQuest} className="px-16 py-4 bg-system-blue text-black font-black uppercase shadow-[0_0_30px_#00f2ff] hover:scale-105 transition-all">COLLECT LOOT</button>
          ) : (
            <button onClick={() => setIsRaidActive(false)} className="text-gray-700 hover:text-red-500 transition-colors uppercase text-[10px] tracking-widest underline font-bold">Abandon Quest (No XP)</button>
          )}
        </div>
      )}

      {/* HEADER HUD */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-900 pb-6 mb-8 gap-6">
        <div className="flex items-center gap-6">
          <Logo size={60} />
          <div>
            <h1 className="text-5xl font-black italic tracking-tighter text-white uppercase leading-none">
              {playerData?.name} <span className="text-system-blue text-2xl ml-2 font-normal">LVL {playerData?.level}</span>
            </h1>
            <div className="flex gap-4 mt-3">
              <span className="text-[10px] text-system-purple font-bold tracking-[0.4em] uppercase border border-system-purple/30 px-3 py-0.5 bg-system-purple/5">E-RANK HUNTER</span>
              <span className="text-[10px] text-gray-500 font-bold tracking-[0.4em] uppercase border border-gray-800 px-3 py-0.5">CLASS: {playerData?.studentType}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-md hidden xl:block px-10">
          <div className="flex justify-between text-[9px] font-bold text-system-blue mb-1 uppercase tracking-widest"><span>STAMINA (CONSISTENCY)</span><span>{(playerData?.xp % 500) / 5}%</span></div>
          <div className="h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
            <div className="h-full bg-system-blue shadow-[0_0_10px_#00f2ff]" style={{width: `${(playerData?.xp % 500) / 5}%`}}></div>
          </div>
          <div className="flex justify-between text-[9px] font-bold text-system-purple mt-3 mb-1 uppercase tracking-widest"><span>MANA (FOCUS)</span><span>{playerData?.studyHours}H</span></div>
          <div className="h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
            <div className="h-full bg-system-purple shadow-[0_0_10px_#7000ff]" style={{width: '90%'}}></div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/library')} className="flex items-center gap-2 px-5 py-2 border-2 border-gray-800 hover:border-system-blue bg-[#0a0a0a] transition-all group">
            <Book size={18} className="text-system-blue group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-white">Archives</span>
          </button>
          <button onClick={() => navigate('/settings')} className="p-2.5 border-2 border-gray-800 rounded-sm hover:border-system-blue text-gray-500 hover:text-white transition-all"><Settings size={22} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT PANEL */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#080808] border border-gray-900 p-5 relative overflow-hidden">
            <h2 className="text-[10px] font-black text-system-blue uppercase tracking-[0.4em] mb-6 flex items-center gap-3"><Trophy size={14}/> Hall of Hunters</h2>
            <div className="space-y-3">
              {leaderboard.map((h, i) => (
                <div key={h.id} className="flex justify-between items-center text-[10px] border-b border-gray-900 pb-2">
                  <span className="text-gray-500 uppercase italic">0{i+1} {h.name}</span>
                  <span className="text-system-blue font-bold">LVL {h.level}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#080808] border border-gray-900 p-5">
            <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-3"><Terminal size={14}/> System Logs</h2>
            <div className="font-mono text-[9px] text-gray-600 space-y-1">
              <p>[System] User {playerData?.name} connected.</p>
              <p>[Data] {playerData?.completedChapters?.length} chapters cleared.</p>
              <p className="text-system-blue">[Alert] Reset in {timeLeft}</p>
            </div>
          </div>
        </div>

        {/* CENTER PANEL (Middle Path Sizing) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex justify-between items-end px-2 border-b border-gray-900 pb-2">
            <h2 className="text-2xl font-black text-white flex items-center gap-4 uppercase italic tracking-tighter">
              <Zap size={24} className="text-system-blue" fill="currentColor" /> ACTIVE DIRECTIVES
            </h2>
            <div className="text-[10px] font-mono text-system-blue bg-system-blue/10 px-3 py-1 border border-system-blue/20 tracking-widest font-bold">SYSTEM_RESET: {timeLeft}</div>
          </div>

          <div className="space-y-4">
            {dailyQuests.map((quest, i) => (
              <div key={i} className={`group relative border-2 transition-all duration-300 ${quest.completed ? 'bg-black/40 border-gray-900 opacity-40' : 'bg-[#0a0a0a] border-gray-800 hover:border-system-blue shadow-lg shadow-black'} p-7`}>
                <div className="flex justify-between items-center relative z-10">
                  <div className="max-w-[70%]">
                    <p className="text-[9px] font-black text-system-blue uppercase tracking-[0.4em] mb-2">{quest.book.split(' - ')[0]}</p>
                    <h3 className={`text-3xl font-black italic uppercase tracking-tighter leading-tight ${quest.completed ? 'text-gray-600 line-through' : 'text-white group-hover:text-system-blue'}`}>{quest.topic}</h3>
                    {!quest.completed && <p className="text-[10px] text-gray-600 font-bold mt-4 uppercase tracking-widest italic flex items-center gap-2"><Activity size={10}/> RECOMMENDED FOCUS: {quest.hours} HOURS</p>}
                  </div>
                  {quest.completed ? <CheckCircle2 size={40} className="text-system-blue" /> : (
                    <button onClick={() => { setActiveQuestIndex(i); setIsRaidActive(true); }} className="border-2 border-system-blue text-system-blue px-8 py-3 font-black italic uppercase text-xs hover:bg-system-blue hover:text-black transition-all shadow-[0_0_15px_rgba(0,242,255,0.1)] flex items-center gap-2">
                      <Sword size={14}/> RAID
                    </button>
                  )}
                </div>
                <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-system-blue/5 to-transparent skew-x-12 translate-x-20 pointer-events-none group-hover:translate-x-10 transition-transform duration-700"></div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#080808] border border-gray-900 p-6">
             <h2 className="text-[10px] font-black text-system-purple uppercase tracking-[0.4em] mb-8 flex items-center gap-3"><BookOpen size={16}/> INVENTORY</h2>
             <div className="space-y-4">
               {playerData?.books?.map((b, i) => (
                 <div key={i} className="flex flex-col border-b border-gray-900 pb-3 last:border-0 group">
                   <span className="text-[8px] text-system-purple font-bold uppercase mb-1">SLOT: 0{i+1}</span>
                   <span className="text-xs font-black text-gray-500 group-hover:text-white uppercase italic truncate transition-colors">{b}</span>
                 </div>
               ))}
             </div>
          </div>
          <div className="bg-[#080808] border border-gray-900 p-5">
             <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-4"><TrendingUp size={14}/> CONQUESTS</h2>
             <div className="max-h-40 overflow-y-auto custom-scrollbar pr-2 space-y-3">
               {playerData?.completedChapters?.slice(-5).reverse().map((item, i) => (
                 <div key={i} className="text-[8px] border-l border-system-blue pl-3 py-1 animate-in fade-in slide-in-from-left-2">
                    <p className="text-white font-bold">{item.split(':')[1].toUpperCase()}</p>
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