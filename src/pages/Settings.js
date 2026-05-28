import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Save, LogOut, RefreshCw } from 'lucide-react';

const Settings = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);

  const bookList = ["M. Laxmikant - Polity", "Spectrum - Modern History", "Ramesh Singh - Economy", "GC Leong - Geography"];

  useEffect(() => {
    const fetchData = async () => {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setFormData(docSnap.data());
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleBookToggle = (book) => {
    setFormData(prev => ({
      ...prev,
      books: prev.books.includes(book) ? prev.books.filter(b => b !== book) : [...prev.books, book]
    }));
  };

  const saveSettings = async () => {
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { ...formData });
      alert("SYSTEM UPDATED: Changes synchronized.");
      navigate('/dashboard');
    } catch (e) { alert(e.message); }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

  if (loading || !formData) return <div className="h-screen bg-black flex items-center justify-center text-system-blue font-system italic">ACCESSING SYSTEM CONFIG...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-system italic p-6 md:p-20">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-500 hover:text-system-blue mb-10 transition-colors uppercase text-xs tracking-widest font-bold">
          <ArrowLeft size={16} /> Return to HUD
        </button>

        <h1 className="text-6xl font-black italic tracking-tighter uppercase mb-12 border-b border-gray-900 pb-6">
          System <span className="text-system-purple text-4xl">Settings</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          <div className="space-y-8">
            <div>
              <label className="text-[10px] text-system-purple font-black uppercase tracking-[0.4em] mb-3 block">Player Alias</label>
              <input 
                type="text" 
                className="w-full bg-black border-b-2 border-gray-800 p-3 text-xl font-black italic outline-none focus:border-system-purple transition-all"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div>
              <label className="text-[10px] text-system-purple font-black uppercase tracking-[0.4em] mb-3 block">Daily Stamina (Hours)</label>
              <input 
                type="number" 
                className="w-full bg-black border-b-2 border-gray-800 p-3 text-xl font-black italic outline-none focus:border-system-purple"
                value={formData.studyHours}
                onChange={(e) => setFormData({...formData, studyHours: parseInt(e.target.value)})}
              />
            </div>

            <div>
              <label className="text-[10px] text-system-purple font-black uppercase tracking-[0.4em] mb-3 block">System Logic (Method)</label>
              <select 
                className="w-full bg-black border-b-2 border-gray-800 p-3 text-sm font-bold outline-none"
                value={formData.studyMethod}
                onChange={(e) => setFormData({...formData, studyMethod: e.target.value})}
              >
                <option value="all-subjects">All Subjects (Daily Mix)</option>
                <option value="subject-per-month">Subject Mastery (Focus One)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-system-purple font-black uppercase tracking-[0.4em] mb-4 block">Active Grimoires (Books)</label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-4 custom-scrollbar">
              {bookList.map(book => (
                <div 
                  key={book} 
                  onClick={() => handleBookToggle(book)} 
                  className={`p-4 text-xs font-bold cursor-pointer border transition-all ${formData.books.includes(book) ? 'border-system-purple bg-system-purple/10 text-white' : 'border-gray-900 text-gray-600'}`}
                >
                  {book}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 mt-20">
          <button 
            onClick={saveSettings}
            className="flex-1 bg-system-purple text-white py-4 font-black uppercase italic tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(112,0,255,0.3)]"
          >
            <Save size={18} /> Sync Changes
          </button>
          <button 
            onClick={handleLogout}
            className="px-10 border-2 border-red-900 text-red-900 py-4 font-black uppercase italic text-xs hover:bg-red-900 hover:text-white transition-all flex items-center justify-center gap-3"
          >
            <LogOut size={18} /> Terminate Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;