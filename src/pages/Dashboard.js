import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Settings, Zap, BookOpen, TrendingUp, CheckCircle2, Book, Sword, Clock, Trophy } from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';
import Logo from '../components/Logo';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuests, setDailyQuests] = useState([]);
  const [timeLeft, setTimeLeft] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Dungeon Raid States
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [raidTimer, setRaidTimer] = useState(1500); // 25 mins in seconds
  const [activeQuestIndex, setActiveQuestIndex] = useState(null);

  const fetchLeaderboard = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("level", "desc"), limit(5));
      const querySnapshot = await getDocs(q);
      const topHunters = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaderboard(topHunters);
    } catch (e) { console.error(e); }
  };

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
          newQuests.push({ book: userBookTitle, topic: nextChapter.title, hours: nextChapter.hours || 2, completed: false });
        }
      }
    });

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { currentQuests: newQuests, lastQuestDate: today });
    setDailyQuests(newQuests);
  }, [user.uid]);

  const fetchPlayerData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const fetchedData = docSnap.data();
        setPlayerData(fetchedData);
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

  // Dungeon Raid Timer Logic
  useEffect(() => {
    let interval = null;
    if (isRaidActive && raidTimer > 0) {
      interval = setInterval(() => setRaidTimer(prev => prev - 1), 1000);
    } else if (raidTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRaidActive, raidTimer]);

  const startRaid = (index) => {
    setActiveQuestIndex(index);
    setRaidTimer(1500); // 25 mins
    setIsRaidActive(true);
  };

  const clearQuest = async () => {
    if (activeQuestIndex === null) return;
    const updatedQuests = [...dailyQuests];
    const quest = updatedQuests[activeQuestIndex];
    updatedQuests[activeQuestIndex].completed = true;
    
    const chapterId = `${quest.book}:${quest.topic}`;
    const newHistory = [...(playerData.completedChapters || []), chapterId];
    const newXP = (playerData.xp || 0) + 100;
    const newLvl = Math.floor(newXP / 500) + 1;

    await updateDoc(doc(db, "users", user.uid), {
      currentQuests: updatedQuests,
      completedChapters: newHistory,
      xp: newXP, level: newLvl
    });

    setDailyQuests(updatedQuests);
    setPlayerData({ ...playerData, level: newLvl, xp: newXP, completedChapters: newHistory });
    setIsRaidActive(false);
    setActiveQuestIndex(null);
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic animate-pulse">SYNCING SYSTEM...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-8 select-none">
      
      {/* DUNGEON OVERLAY */}
      {isRaidActive && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center">
            <Sword className="text-red-600 mb-4 animate-bounce" size={48} />
            <h2 className="text-red-600 text-xs font-black tracking-[0.5em] mb-2">DUNGEON RAID IN PROGRESS</h2>
            <div className="text-7xl font-black text-white mb-6">
                {Math.floor(raidTimer / 60)}:{(raidTimer % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-gray-500 mb-10 text-xs uppercase">Objective: Focus on {dailyQuests[activeQuestIndex].topic}</p>
            {raidTimer === 0 ? (
                <button onClick={clearQuest} className="px-10 py-3 bg-system-blue text-black font-black uppercase shadow-[0_0_20px_#00f2ff]">COLLECT REWARD</button>
            ) : (
                <button onClick={() => setIsRaidActive(false)} className="text-gray-700 underline text-[10px] uppercase">Abandon Mission</button>
            )}
        </div>
      )}

      {/* COMPACT HUD HEADER */}
      <div className="flex justify-between items-center border-b border-gray-900 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <Logo size={40} />
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
              {playerData?.name} <span className="text-system-blue text-sm ml-2">LVL {playerData?.level}</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/library')} className="flex items-center gap-2 px-3 py-1.5 border border-gray-800 hover:border-system-blue transition-all bg-[#0a0a0a]">
            <Book size={14} className="text-system-blue" />
            <span className="text-[9px] font-black uppercase text-gray-500">Library</span>
          </button>
          <button onClick={() => navigate('/settings')} className="text-gray-600 hover:text-white"><Settings size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: LOGS & LEADERBOARD */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#080808] border border-gray-900 p-4">
             <h2 className="text-[9px] font-black text-system-blue uppercase tracking-widest mb-4 flex items-center gap-2"><Trophy size={12} /> Hall of Hunters</h2>
             <div className="space-y-3">
                {leaderboard.map((hunter, i) => (
                    <div key={hunter.id} className="flex justify-between items-center text-[10px] border-b border-gray-900 pb-2 last:border-0">
                        <span className="text-gray-500">0{i+1} {hunter.name}</span>
                        <span className="text-system-blue font-bold">LVL {hunter.level}</span>
                    </div>
                ))}
             </div>
          </div>
          <div className="bg-[#080808] border border-gray-900 p-4 max-h-48 overflow-y-auto custom-scrollbar">
             <h2 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4"><TrendingUp size={12} /> Record</h2>
             {playerData?.completedChapters?.slice().reverse().map((item, i) => (
                 <div key={i} className="text-[8px] border-l border-system-blue pl-2 py-1 mb-2 opacity-50">
                   <p className="text-white font-bold">{item.split(':')[1]}</p>
                 </div>
             ))}
          </div>
        </div>

        {/* CENTER: TACTICAL DIRECTIVES */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex justify-between items-end border-b border-gray-900 pb-2">
            <h2 className="text-sm font-black text-white flex items-center gap-2 uppercase italic"><Zap size={16} fill="currentColor" className="text-system-blue" /> Directives</h2>
            <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">RESET: {timeLeft}</span>
          </div>

          {dailyQuests.map((quest, i) => (
            <div key={i} className={`bg-[#0a0a0a] border ${quest.completed ? 'border-gray-900 opacity-30' : 'border-gray-800 hover:border-system-blue'} p-4 transition-all relative overflow-hidden group`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[8px] text-system-blue font-bold uppercase mb-1 tracking-widest">{quest.book.split(' - ')[0]}</p>
                  <h3 className={`text-lg font-black italic uppercase tracking-tighter ${quest.completed ? 'line-through text-gray-600' : 'text-white'}`}>{quest.topic}</h3>
                </div>
                {!quest.completed && (
                    <button onClick={() => startRaid(i)} className="flex items-center gap-2 border border-system-blue text-system-blue px-4 py-1.5 text-[9px] font-black uppercase hover:bg-system-blue hover:text-black">
                        <Sword size={12} /> Enter Dungeon
                    </button>
                )}
              </div>
              <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-system-blue/5 to-transparent skew-x-12 translate-x-12 group-hover:translate-x-6 transition-transform"></div>
            </div>
          ))}
        </div>

        {/* RIGHT: INVENTORY */}
        <div className="lg:col-span-3">
          <div className="bg-[#080808] border border-gray-900 p-4">
            <h2 className="text-[9px] font-black text-system-purple uppercase tracking-widest mb-4 flex items-center gap-2"><BookOpen size={12} /> Grimoires</h2>
            {playerData?.books?.map((b, i) => (
              <p key={i} className="text-[10px] text-gray-500 mb-2 border-b border-gray-900 pb-1 italic truncate">{b}</p>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;