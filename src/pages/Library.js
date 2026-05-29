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
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, [user]);

  // MANUAL CHAPTER TOGGLE (The Catch-up Feature)
  const toggleChapter = async (bookTitle, chapterTitle) => {
    const chapterId = `${bookTitle}:${chapterTitle}`;
    let newHistory = [...(playerData.completedChapters || [])];
    
    if (newHistory.includes(chapterId)) {
      newHistory = newHistory.filter(id => id !== chapterId);
    } else {
      newHistory.push(chapterId);
    }

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { completedChapters: newHistory });
    setPlayerData({ ...playerData, completedChapters: newHistory });
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic text-2xl animate-pulse">OPENING ARCHIVES...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-6 md:p-12 select-none">
      <div className="flex justify-between items-center mb-12 border-b-2 border-gray-900 pb-8">
        <h1 className="text-6xl font-black italic tracking-tighter uppercase">Archives</h1>
        <button onClick={() => navigate('/dashboard')} className="text-gray-500 border-2 border-gray-800 px-6 py-2.5 hover:text-system-blue hover:border-system-blue transition-all font-black uppercase text-xs tracking-widest">Back to HUD</button>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {SYLLABUS_DATA.map((bookData) => {
          const isOwned = playerData?.books?.some(userBook => 
            userBook.toLowerCase().includes(bookData.title.split(' - ')[0].toLowerCase())
          );
          const finished = bookData.chapters.filter(ch => (playerData.completedChapters || []).includes(`${bookData.title}:${ch.title}`)).length;
          const progress = Math.round((finished / bookData.chapters.length) * 100);

          return (
            <div key={bookData.title} className={`border-2 p-8 transition-all ${isOwned ? 'border-gray-800 bg-[#080808] shadow-2xl' : 'border-gray-900 opacity-25'}`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
                <div>
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-system-blue text-[10px] font-black uppercase tracking-[0.4em] border border-system-blue/30 px-3 py-1 bg-system-blue/5">{bookData.subject}</span>
                    {!isOwned && <span className="text-[9px] text-red-500 font-bold uppercase tracking-widest border border-red-900 px-2 flex items-center gap-1"><Lock size={10}/> Data_locked</span>}
                  </div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">{bookData.title}</h2>
                </div>
                {isOwned && (
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 font-black uppercase mb-1 tracking-widest italic">Conquest rate</p>
                    <p className="text-5xl font-black text-system-blue tracking-tighter leading-none">{progress}%</p>
                  </div>
                )}
              </div>

              {isOwned && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-10">
                  {bookData.chapters.map((ch, idx) => {
                    const isDone = (playerData.completedChapters || []).includes(`${bookData.title}:${ch.title}`);
                    return (
                      <div 
                        key={idx} 
                        onClick={() => toggleChapter(bookData.title, ch.title)}
                        className={`p-4 border-2 transition-all cursor-pointer flex items-center justify-between group ${isDone ? 'border-system-blue/50 bg-system-blue/5 shadow-[0_0_15px_rgba(0,242,255,0.05)]' : 'border-gray-900 bg-black hover:border-gray-700'}`}
                      >
                        <div className="max-w-[85%]">
                          <p className="text-[9px] text-gray-600 font-bold mb-1 italic">Instance: 0{idx + 1}</p>
                          <p className={`text-[11px] font-black uppercase italic leading-tight ${isDone ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>{ch.title}</p>
                        </div>
                        {isDone ? <CheckCircle size={20} className="text-system-blue" /> : <Shield size={18} className="text-gray-900 group-hover:text-gray-700" />}
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