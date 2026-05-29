import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, CheckCircle, Lock, Shield } from 'lucide-react';
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

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic text-xl animate-pulse">SYNCHRONIZING ARCHIVES...</div>;

  const completed = playerData?.completedChapters || [];

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-system italic p-4 md:p-10">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-600 hover:text-system-blue mb-6 transition-all uppercase text-[9px] tracking-widest font-bold border border-gray-900 px-3 py-1 bg-black">
        <ArrowLeft size={12} /> BACK TO HUD
      </button>

      <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-8 border-b border-gray-900 pb-4">
        SYLLABUS <span className="text-system-blue text-xl ml-1">ARCHIVES</span>
      </h1>

      <div className="grid grid-cols-1 gap-6">
        {SYLLABUS_DATA.map((bookData) => {
          // FUZZY MATCH LOGIC: This fixes the "LOCKED" bug by checking if keywords exist
          const isOwned = playerData?.books?.some(userBook => {
            const u = userBook.toLowerCase();
            const b = bookData.title.toLowerCase();
            // Match if either string contains part of the other (Polity, Laxmikant, etc.)
            return u.includes(bookData.subject.toLowerCase()) || 
                   b.includes(u.split(' - ')[0]) || 
                   u.includes(b.split(' - ')[0]);
          });

          const finished = bookData.chapters.filter(ch => completed.includes(`${bookData.title}:${ch.title}`)).length;
          const progress = Math.round((finished / bookData.chapters.length) * 100);

          return (
            <div key={bookData.title} className={`border transition-all ${isOwned ? 'border-gray-800 bg-[#080808] shadow-md shadow-black' : 'border-gray-900 opacity-25'}`}>
              <div className="flex justify-between items-center p-4 border-b border-gray-900/50">
                <div className="flex items-center gap-4">
                  <span className={`text-[8px] font-black tracking-widest border px-2 py-0.5 ${isOwned ? 'text-system-blue border-system-blue/30 bg-system-blue/5' : 'text-gray-700 border-gray-800'}`}>
                    {bookData.subject.toUpperCase()}
                  </span>
                  <h2 className="text-sm font-black italic uppercase text-white tracking-tight">{bookData.title}</h2>
                </div>
                {isOwned ? (
                  <div className="flex items-center gap-4">
                     <span className="text-[8px] text-gray-500 uppercase font-bold tracking-tighter">Conquest Rate:</span>
                     <span className="text-lg font-black text-system-blue italic leading-none">{progress}%</span>
                  </div>
                ) : (
                  <span className="text-[8px] text-red-900 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Lock size={10}/> Data Locked
                  </span>
                )}
              </div>

              {isOwned && (
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {bookData.chapters.map((ch, idx) => {
  // --- THE DEEP SCANNER LOGIC ---
  // This checks if any entry in your completed list contains this chapter's title
  const isDone = completed.some(entry => {
    const savedTitle = entry.split(':')[1]; // Get the chapter part of "Book:Chapter"
    return savedTitle === ch.title;
  });

  return (
    <div key={idx} className={`p-2 border transition-all flex items-center justify-between group ${isDone ? 'border-system-blue/40 bg-system-blue/5' : 'border-gray-900 bg-black'}`}>
      <div className="max-w-[80%]">
        <p className={`text-[9px] font-black uppercase italic leading-none truncate ${isDone ? 'text-white' : 'text-gray-700'}`}>
          {idx + 1}. {ch.title}
        </p>
      </div>
      {isDone ? <CheckCircle size={10} className="text-system-blue" /> : <Shield size={9} className="text-gray-950" />}
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