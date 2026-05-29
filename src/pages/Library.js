import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, CheckCircle, Lock, Shield, Target } from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';

const Library = ({ user }) => {
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.uid) return;
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) setPlayerData(docSnap.data());
      setLoading(false);
    };
    fetchStats();
  }, [user]);

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic text-2xl">OPENING ARCHIVES...</div>;

  const completed = playerData?.completedChapters || [];

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-6 md:p-12">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-600 hover:text-system-blue mb-10 transition-colors uppercase text-[10px] tracking-widest font-bold border border-gray-800 px-4 py-2 bg-black">
        <ArrowLeft size={14} /> Back to HUD
      </button>

      <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-12 border-b-2 border-gray-900 pb-6">
        SYLLABUS <span className="text-system-blue text-3xl ml-2">ARCHIVES</span>
      </h1>

      <div className="grid grid-cols-1 gap-12">
        {SYLLABUS_DATA.map((bookData) => {
          const isOwned = playerData?.books?.includes(bookData.title);
          const finished = bookData.chapters.filter(ch => completed.includes(`${bookData.title}:${ch.title}`)).length;
          const progress = Math.round((finished / bookData.chapters.length) * 100);

          return (
            <div key={bookData.title} className={`border-2 p-8 transition-all ${isOwned ? 'border-gray-800 bg-[#080808] shadow-lg shadow-black' : 'border-gray-900 opacity-20'}`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-system-blue text-[10px] font-black tracking-[0.4em] uppercase border border-system-blue/30 px-3 py-0.5 bg-system-blue/5">{bookData.subject}</span>
                    {!isOwned && <span className="text-[9px] text-red-500 font-bold uppercase tracking-widest border border-red-900 px-2 flex items-center gap-1"><Lock size={10}/> Locked</span>}
                  </div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">{bookData.title}</h2>
                </div>
                {isOwned && (
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 font-black uppercase mb-1 tracking-widest">Completion Rate</p>
                    <p className="text-5xl font-black text-system-blue tracking-tighter">{progress}%</p>
                  </div>
                )}
              </div>

              {isOwned && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {bookData.chapters.map((ch, idx) => {
                    const isDone = completed.includes(`${bookData.title}:${ch.title}`);
                    return (
                      <div key={idx} className={`p-4 border-2 transition-all flex items-center justify-between group ${isDone ? 'border-system-blue/40 bg-system-blue/5' : 'border-gray-900 bg-black hover:border-gray-700'}`}>
                        <div className="max-w-[85%]">
                          <p className="text-[8px] text-gray-600 font-bold mb-1">CH: {idx + 1}</p>
                          <p className={`text-[11px] font-black uppercase italic leading-tight ${isDone ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>{ch.title}</p>
                        </div>
                        {isDone ? <CheckCircle size={16} className="text-system-blue" /> : <Shield size={14} className="text-gray-900" />}
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