import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, CheckCircle, Lock, Book } from 'lucide-react';
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

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic">ACCESSING ARCHIVES...</div>;

  const completed = playerData?.completedChapters || [];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-system italic p-6 md:p-12">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-600 hover:text-system-blue mb-8 uppercase text-[10px] tracking-widest font-bold">
        <ArrowLeft size={14} /> Back to HUD
      </button>

      <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-10 border-b border-gray-900 pb-4">
        SYLLABUS <span className="text-system-blue text-2xl">ARCHIVES</span>
      </h1>

      <div className="grid grid-cols-1 gap-10">
        {SYLLABUS_DATA.map((bookData) => {
          const isOwned = playerData?.books?.includes(bookData.title);
          const finishedCount = bookData.chapters.filter(ch => completed.includes(`${bookData.title}:${ch.title}`)).length;
          const progress = Math.round((finishedCount / bookData.chapters.length) * 100);

          return (
            <div key={bookData.title} className={`border p-6 rounded-sm ${isOwned ? 'border-gray-800 bg-[#080808]' : 'border-gray-900 opacity-30'}`}>
              <div className="flex justify-between items-end mb-6">
                <div>
                  <p className="text-system-blue text-[8px] font-black tracking-widest uppercase mb-1">{bookData.subject}</p>
                  <h2 className="text-xl font-black italic uppercase">{bookData.title}</h2>
                </div>
                {!isOwned && <span className="text-[8px] border border-gray-700 px-2 text-gray-700">LOCKED_ITEM</span>}
                {isOwned && <p className="text-2xl font-black text-system-blue leading-none">{progress}%</p>}
              </div>

              {isOwned && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {bookData.chapters.map((ch, idx) => {
                    const isDone = completed.includes(`${bookData.title}:${ch.title}`);
                    return (
                      <div key={idx} className={`p-2 border text-[8px] font-bold uppercase flex items-center gap-2 ${isDone ? 'border-system-blue/30 text-white bg-system-blue/5' : 'border-gray-900 text-gray-700'}`}>
                        {isDone ? <CheckCircle size={10} className="text-system-blue" /> : <Lock size={10} />}
                        <span className="truncate">{ch.title}</span>
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