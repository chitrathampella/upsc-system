import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import {SYLLABUS_DATA} from '../data/syllabus';

const Onboarding = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    studentType: 'full-time', // full-time or part-time
    studyMethod: 'all-subjects', // all-subjects or subject-per-month
    studyHours: 4,
    books: []
  });

  const bookList = SYLLABUS_DATA.map(book => book.title);

  const handleBookToggle = (book) => {
    setFormData(prev => ({
      ...prev,
      books: prev.books.includes(book) ? prev.books.filter(b => b !== book) : [...prev.books, book]
    }));
  };

  const saveToSystem = async () => {
    if (!formData.name || formData.books.length === 0) return alert("Complete all fields, Hunter.");
    try {
      await setDoc(doc(db, "users", user.uid), {
        ...formData,
        level: 1,
        xp: 0,
        completedChapters: [], // Stores actual names of chapters finished
        setupComplete: true
      });
      setUser({ ...user, setupComplete: true });
      navigate('/dashboard');
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-system italic">
      <div className="bg-[#0a0a0a] border border-system-blue p-10 max-w-2xl w-full">
        <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-8 border-b border-gray-900 pb-4">Character Initialization</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] text-system-blue font-bold uppercase tracking-widest">Player Name</label>
              <input type="text" className="w-full bg-black border-b border-gray-800 p-2 text-white outline-none focus:border-system-blue" onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] text-system-blue font-bold uppercase tracking-widest">Study Method</label>
              <select className="w-full bg-black border-b border-gray-800 p-2 text-white outline-none" onChange={(e) => setFormData({...formData, studyMethod: e.target.value})}>
                <option value="all-subjects">All Subjects (Daily Mix)</option>
                <option value="subject-per-month">Subject Mastery (One by One)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-system-blue font-bold uppercase tracking-widest">Daily Stamina (Hours)</label>
              <input type="number" className="w-full bg-black border-b border-gray-800 p-2 text-white outline-none" placeholder="e.g. 4" onChange={(e) => setFormData({...formData, studyHours: parseInt(e.target.value)})} />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-system-blue font-bold uppercase tracking-widest block mb-4">Select Grimoires</label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {bookList.map(book => (
                <div key={book} onClick={() => handleBookToggle(book)} className={`p-3 text-[10px] cursor-pointer border transition-all ${formData.books.includes(book) ? 'border-system-blue bg-system-blue/10 text-white' : 'border-gray-900 text-gray-600'}`}>
                  {book}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button onClick={saveToSystem} className="w-full mt-10 bg-system-blue text-black font-black py-4 uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]">
          Begin Journey
        </button>
      </div>
    </div>
  );
};

export default Onboarding;