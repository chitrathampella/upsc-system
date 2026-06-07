import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, CheckCircle, Shield, Lock, RotateCw } from 'lucide-react';
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

  const toggleChapter = async (bookTitle, chapterTitle) => {
    const chapterId = `${bookTitle}:${chapterTitle}`;
    let newHistory = [...(playerData.completedChapters || [])];
    let currentXP = playerData.xp || 0;
    
    const isAdding = !newHistory.includes(chapterId);
    if (isAdding) { newHistory.push(chapterId); currentXP += 100; }
    else { newHistory = newHistory.filter(id => id !== chapterId); currentXP = Math.max(0, currentXP - 100); }

    const newLvl = Math.floor(currentXP / 500) + 1;
    await updateDoc(doc(db, "users", user.uid), { completedChapters: newHistory, xp: currentXP, level: newLvl });
    setPlayerData({ ...playerData, completedChapters: newHistory, xp: currentXP, level: newLvl });
  };

  const resetForRevision = async (bookTitle) => {
    if (!window.confirm(`ARISE this grimoire for Revision Cycle ${(playerData.revisions?.[bookTitle] || 0) + 1}?`)) return;
    const newRevisions = { ...(playerData.revisions || {}), [bookTitle]: (playerData.revisions?.[bookTitle] || 0) + 1 };
    const newHistory = (playerData.completedChapters || []).filter(id => !id.startsWith(bookTitle));
    await updateDoc(doc(db, "users", user.uid), { completedChapters: newHistory, revisions: newRevisions, xp: (playerData.xp || 0) + 500 });
    setPlayerData({ ...playerData, completedChapters: newHistory, revisions: newRevisions, xp: (playerData.xp || 0) + 500 });
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic text-2xl animate-pulse">OPENING ARCHIVES...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-10 select-none">
      <div className="flex justify-between items-center mb-8 border-b-2 border-gray-900 pb-4">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase">Archives</h1>
        <button onClick={() => navigate('/dashboard')} className="text-gray-500 border border-gray-800 px-6 py-1.5 hover:text-system-blue uppercase text-[10px] font-black">BACK TO HUD</button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {SYLLABUS_DATA.map((bookData) => {
          const isOwned = playerData?.books?.some(userBook => {
            const u = userBook.toLowerCase();
            const bTitle = bookData.title.toLowerCase();
            const bSub = bookData.subject.toLowerCase();
            return u.includes(bSub) || bTitle.includes(u.split(' ')[0]);
          });

          const completed = playerData?.completedChapters || [];
          const finished = bookData.chapters.filter(ch => completed.some(entry => entry.includes(ch.title))).length;
          const progress = Math.round((finished / bookData.chapters.length) * 100);
          const revCount = playerData?.revisions?.[bookData.title] || 0;

          return (
            <div key={bookData.title} className={`border-2 transition-all ${isOwned ? 'border-gray-800 bg-[#080808] shadow-xl' : 'border-gray-900 opacity-20'}`}>
              <div className="flex flex-col md:row justify-between items-start md:items-center p-5 border-b border-gray-900 bg-black/40">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-[8px] font-black uppercase tracking-[0.3em] px-2 py-0.5 border ${isOwned ? 'text-system-blue border-system-blue/30 bg-system-blue/5' : 'text-gray-700 border-gray-800'}`}>{bookData.subject}</span>
                    {revCount > 0 && <span className="bg-system-blue text-black text-[9px] px-2 font-black rounded-sm uppercase italic">Revision: {revCount}</span>}
                  </div>
                  <h2 className="text-lg font-black italic uppercase text-white tracking-tighter">{bookData.title}</h2>
                </div>
                {isOwned && (
                  <div className="flex items-center gap-6 mt-4 md:mt-0">
                    {progress === 100 && <button onClick={() => resetForRevision(bookData.title)} className="bg-system-blue/10 text-system-blue border border-system-blue px-4 py-1.5 text-[10px] font-black uppercase flex items-center gap-2"><RotateCw size={12}/> Arise Grimoire</button>}
                    <p className="text-3xl font-black text-system-blue tracking-tighter leading-none">{progress}%</p>
                  </div>
                )}
              </div>
              {isOwned && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 bg-[#050505]">
                  {bookData.chapters.map((ch, idx) => {
                    const isDone = completed.some(entry => entry.includes(ch.title));
                    return (
                      <div key={idx} onClick={() => toggleChapter(bookData.title, ch.title)} className={`p-3 border transition-all cursor-pointer flex items-center justify-between group h-14 ${isDone ? 'border-system-blue/40 bg-system-blue/5' : 'border-gray-900 bg-black hover:border-gray-700'}`}>
                        <div className="max-w-[80%]"><p className="text-[7px] text-gray-600 font-bold mb-0.5 italic">INST: 0{idx + 1}</p><p className={`text-[9px] font-black uppercase italic leading-tight truncate ${isDone ? 'text-white' : 'text-gray-500'}`}>{ch.title}</p></div>
                        {isDone ? <CheckCircle size={14} className="text-system-blue" /> : <Shield size={12} className="text-gray-950" />}
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