import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, CheckCircle, Shield, Lock } from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';

const Library = ({ user }) => {
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (!user?.uid) return;
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) setPlayerData(docSnap.data());
    } catch (e) { console.error("Archive Sync Error", e); }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, [user]);

  // MANUAL CHAPTER TOGGLE (Catch-up Feature)
  const toggleChapter = async (bookTitle, chapterTitle) => {
  const chapterId = `${bookTitle}:${chapterTitle}`;
  let newHistory = [...(playerData.completedChapters || [])];
  let currentXP = playerData.xp || 0;
  
  const isAdding = !newHistory.includes(chapterId);

  if (isAdding) {
    newHistory.push(chapterId);
    currentXP += 100; // Grant XP for manual completion
  } else {
    newHistory = newHistory.filter(id => id !== chapterId);
    currentXP = Math.max(0, currentXP - 100); // Penalty for removing completed status
  }

  // Recalculate Level based on new XP
  const newLvl = Math.floor(currentXP / 500) + 1;

  const userRef = doc(db, "users", user.uid);
  
  try {
    await updateDoc(userRef, { 
      completedChapters: newHistory,
      xp: currentXP,
      level: newLvl
    });
    
    // Update local state so UI reacts instantly
    setPlayerData({ 
      ...playerData, 
      completedChapters: newHistory, 
      xp: currentXP, 
      level: newLvl 
    });
  } catch (e) {
    console.error("Sync Failure:", e);
  }
};

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic text-2xl animate-pulse">
      DECRYPTING_ARCHIVES...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-10 select-none">
      
      {/* COMPACT HEADER */}
      <div className="flex justify-between items-center mb-8 border-b-2 border-gray-900 pb-4">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase">Archives</h1>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="text-gray-500 border border-gray-800 px-4 py-1.5 hover:text-system-blue hover:border-system-blue transition-all font-black uppercase text-[10px] tracking-widest bg-black"
        >
          Back to HUD
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {SYLLABUS_DATA.map((bookData) => {
          // --- THE UNIVERSAL UNLOCKER ---
          // This checks if any of your selected books match the subject or title keywords
          const isOwned = playerData?.books?.some(userBook => {
            const u = userBook.toLowerCase();
            const bTitle = bookData.title.toLowerCase();
            const bSub = bookData.subject.toLowerCase();
            return u.includes(bSub) || bTitle.includes(u.split(' ')[0]);
          });

          const completed = playerData?.completedChapters || [];
          const finished = bookData.chapters.filter(ch => 
            completed.some(entry => entry.includes(ch.title))
          ).length;
          
          const progress = Math.round((finished / bookData.chapters.length) * 100);

          return (
            <div key={bookData.title} className={`border-2 transition-all duration-500 ${isOwned ? 'border-gray-800 bg-[#080808] shadow-xl' : 'border-gray-900 opacity-20'}`}>
              
              {/* BOOK INFO BAR */}
              <div className="flex flex-col md:row justify-between items-start md:items-center p-5 border-b border-gray-900 bg-black/40">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-[8px] font-black uppercase tracking-[0.3em] px-2 py-0.5 border ${isOwned ? 'text-system-blue border-system-blue/30 bg-system-blue/5' : 'text-gray-700 border-gray-800'}`}>
                      {bookData.subject}
                    </span>
                    {!isOwned && <span className="text-[8px] text-red-900 font-bold uppercase tracking-widest flex items-center gap-1"><Lock size={8}/> Locked</span>}
                  </div>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">{bookData.title}</h2>
                </div>
                
                {isOwned && (
                  <div className="text-right mt-4 md:mt-0">
                    <p className="text-[8px] text-gray-500 font-black uppercase mb-1 tracking-widest italic">Conquest Rate</p>
                    <p className="text-3xl font-black text-system-blue tracking-tighter leading-none">{progress}%</p>
                  </div>
                )}
              </div>

              {/* CHAPTER GRID (MIDDLE PATH SIZE) */}
              {isOwned && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 bg-[#050505]">
                  {bookData.chapters.map((ch, idx) => {
                    // Smart Sync: Match based on chapter title string
                    const isDone = completed.some(entry => entry.includes(ch.title));
                    
                    return (
                      <div 
                        key={idx} 
                        onClick={() => toggleChapter(bookData.title, ch.title)}
                        className={`p-3 border transition-all cursor-pointer flex items-center justify-between group h-14 ${isDone ? 'border-system-blue/40 bg-system-blue/5 shadow-[0_0_10px_rgba(0,242,255,0.05)]' : 'border-gray-900 bg-black hover:border-gray-700'}`}
                      >
                        <div className="max-w-[80%]">
                          <p className="text-[7px] text-gray-600 font-bold mb-0.5 italic">INST: 0{idx + 1}</p>
                          <p className={`text-[9px] font-black uppercase italic leading-tight truncate ${isDone ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                            {ch.title}
                          </p>
                        </div>
                        {isDone ? (
                          <CheckCircle size={14} className="text-system-blue animate-in zoom-in duration-300" />
                        ) : (
                          <Shield size={12} className="text-gray-950 group-hover:text-gray-800 transition-colors" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Library;