import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, CheckCircle, Lock } from 'lucide-react'; // REMOVED 'Book' HERE
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
    <div className="min-h-screen bg-[#050505] text-white font-system italic p-6 md:p-20">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-500 hover:text-system-blue mb-10 uppercase text-xs tracking-widest font-bold">
        <ArrowLeft size={16} /> Return to HUD
      </button>

      <h1 className="text-6xl font-black italic tracking-tighter uppercase mb-16 border-b border-gray-900 pb-6">
        Grimoire <span className="text-system-blue text-4xl">Library</span>
      </h1>

      <div className="grid grid-cols-1 gap-12">
        {playerData?.books?.map((bookTitle) => {
          const bookData = SYLLABUS_DATA.find(b => b.title === bookTitle);
          if (!bookData) return null;

          const totalChapters = bookData.chapters.length;
          const finishedCount = bookData.chapters.filter(ch => completed.includes(`${bookTitle}:${ch.title}`)).length;
          const progress = Math.round((finishedCount / totalChapters) * 100);

          return (
            <div key={bookTitle} className="border border-gray-900 bg-[#080808] p-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                  <p className="text-system-blue text-[10px] font-black tracking-[0.4em] uppercase mb-2">Subject: {bookData.subject}</p>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">{bookTitle}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Conquest Rate</p>
                  <p className="text-4xl font-black text-system-blue leading-none">{progress}%</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1 w-full bg-gray-900 mb-10 overflow-hidden">
                <div className="h-full bg-system-blue shadow-[0_0_10px_#00f2ff]" style={{ width: `${progress}%` }}></div>
              </div>

              {/* Chapter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bookData.chapters.map((ch, idx) => {
                  const isDone = completed.includes(`${bookTitle}:${ch.title}`);
                  return (
                    <div key={idx} className={`p-4 border ${isDone ? 'border-system-blue/30 bg-system-blue/5' : 'border-gray-900 bg-black'} flex items-center justify-between group`}>
                      <div>
                        <p className="text-[8px] text-gray-600 font-bold mb-1">CH: {idx + 1}</p>
                        <p className={`text-[10px] font-bold uppercase italic ${isDone ? 'text-white' : 'text-gray-500'}`}>{ch.title}</p>
                      </div>
                      {isDone ? <CheckCircle size={14} className="text-system-blue shadow-sm" /> : <Lock size={12} className="text-gray-800" />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Library;