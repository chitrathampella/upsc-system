import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Save, LogOut, Cpu, Shield, Zap, BookOpen } from 'lucide-react';
import { SYLLABUS_DATA } from '../data/syllabus';

const Settings = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) return;
      const docSnap = await getDoc(doc(db, "users", user.uid));
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
      navigate('/dashboard');
    } catch (e) { alert("Sync Failed: " + e.message); }
  };

  if (loading || !formData) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center text-system-purple font-system italic animate-pulse">
      <Cpu className="mb-4 animate-spin" />
      ACCESSING_CONFIG_CORE...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-system italic p-4 md:p-12 select-none overflow-x-hidden">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER NAVIGATION */}
        <div className="flex justify-between items-center mb-10">
          <button onClick={() => navigate('/dashboard')} className="group flex items-center gap-2 text-gray-600 hover:text-system-blue transition-all uppercase text-[10px] tracking-[0.4em] font-bold">
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> 
            HUD_RETURN
          </button>
          <div className="text-right">
             <p className="text-[8px] text-system-purple font-bold tracking-widest uppercase">Security Clearance</p>
             <p className="text-[10px] text-white font-black">LEVEL_0{formData.level}_MONARCH</p>
          </div>
        </div>

        <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-12 border-b-2 border-gray-900 pb-6 flex items-center gap-4">
          SYSTEM <span className="text-system-purple">SETTINGS</span>
          <div className="w-2 h-2 bg-system-purple animate-ping rounded-full ml-auto"></div>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* LEFT: CHARACTER TRAITS */}
          <div className="lg:col-span-5 space-y-10">
            <div className="relative group">
              <label className="text-[9px] text-system-purple font-black uppercase tracking-[0.5em] mb-3 block">Player Alias</label>
              <div className="absolute -left-2 top-8 w-1 h-10 bg-system-purple opacity-50"></div>
              <input 
                type="text" 
                className="w-full bg-black/40 border-b border-gray-800 p-4 text-2xl font-black italic outline-none focus:border-system-purple focus:bg-system-purple/5 transition-all uppercase tracking-tighter"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            // Inside your Settings component, add this to the Character Traits section:
<div className="relative group">
  <label className="text-[9px] text-system-purple font-black uppercase tracking-[0.5em] mb-3 block">Avatar Link (URL)</label>
  <div className="absolute -left-2 top-8 w-1 h-10 bg-system-purple opacity-50"></div>
  <input 
    type="text" 
    placeholder="Paste image address..."
    className="w-full bg-black/40 border-b border-gray-800 p-4 text-xs font-mono outline-none focus:border-system-purple transition-all"
    value={formData.photoURL || ''}
    onChange={(e) => setFormData({...formData, photoURL: e.target.value})}
  />
</div>

            <div className="relative group">
              <label className="text-[9px] text-system-purple font-black uppercase tracking-[0.5em] mb-3 block">Daily Stamina (Hours)</label>
              <div className="absolute -left-2 top-8 w-1 h-10 bg-system-purple opacity-50"></div>
              <input 
                type="number" 
                className="w-full bg-black/40 border-b border-gray-800 p-4 text-2xl font-black italic outline-none focus:border-system-purple focus:bg-system-purple/5 transition-all"
                value={formData.studyHours}
                onChange={(e) => setFormData({...formData, studyHours: parseInt(e.target.value)})}
              />
            </div>

            <div className="relative group">
              <label className="text-[9px] text-system-purple font-black uppercase tracking-[0.5em] mb-3 block">Extraction Logic (Method)</label>
              <div className="absolute -left-2 top-8 w-1 h-10 bg-system-purple opacity-50"></div>
              <select 
                className="w-full bg-black border-b border-gray-800 p-4 text-sm font-bold outline-none cursor-pointer hover:bg-gray-900 transition-all uppercase tracking-widest"
                value={formData.studyMethod}
                onChange={(e) => setFormData({...formData, studyMethod: e.target.value})}
              >
                <option value="all-subjects">All Subjects (Daily Mix)</option>
                <option value="subject-per-month">Subject Mastery (Focus One)</option>
              </select>
            </div>

            {/* STATUS BOX */}
            <div className="p-4 bg-system-purple/5 border border-system-purple/20 rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className="text-system-purple" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Logic Stability</span>
                </div>
                <p className="text-[9px] text-gray-500 font-mono leading-relaxed italic">
                  Changes to study method will recalculate all Active Directives in the next Chrono Sync (Midnight).
                </p>
            </div>
          </div>

          {/* RIGHT: GRIMOIRE SLOTS */}
          <div className="lg:col-span-7">
            <div className="flex justify-between items-end mb-6">
                <label className="text-[10px] text-system-purple font-black uppercase tracking-[0.5em] flex items-center gap-2">
                  <BookOpen size={14} /> Active grimoires
                </label>
                <span className="text-[9px] text-gray-600 font-bold uppercase">{formData.books.length} / 12 EQUIPPED</span>
            </div>
            
            <div className="bg-[#080808] border border-gray-900 p-2 space-y-2 max-h-[450px] overflow-y-auto custom-scrollbar">
              {SYLLABUS_DATA.map((book) => {
                const isSelected = formData.books.includes(book.title);
                return (
                  <div 
                    key={book.title} 
                    onClick={() => handleBookToggle(book.title)} 
                    className={`p-4 border transition-all cursor-pointer flex items-center justify-between group ${isSelected ? 'border-system-purple/50 bg-system-purple/10 shadow-[0_0_15px_rgba(112,0,255,0.1)]' : 'border-gray-900 bg-black hover:border-gray-700'}`}
                  >
                    <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rotate-45 transition-all ${isSelected ? 'bg-system-purple shadow-[0_0_8px_#7000ff]' : 'bg-gray-800'}`}></div>
                        <div>
                            <p className={`text-[11px] font-black uppercase tracking-tight transition-colors ${isSelected ? 'text-white' : 'text-gray-500'}`}>{book.title}</p>
                            <p className="text-[8px] text-gray-700 uppercase font-bold tracking-widest">{book.subject}</p>
                        </div>
                    </div>
                    {isSelected ? <Zap size={14} className="text-system-purple" fill="currentColor" /> : <div className="w-4" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-col md:flex-row gap-6 mt-16 pt-8 border-t border-gray-900">
          <button 
            onClick={saveSettings}
            className="flex-[2] bg-system-purple text-white py-5 font-black uppercase italic tracking-[0.3em] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-4 shadow-[0_0_30px_rgba(112,0,255,0.3)] active:scale-[0.98]"
          >
            <Save size={20} /> SYNCHRONIZE_CHANGES
          </button>
          
          <button 
            onClick={() => auth.signOut().then(() => navigate('/'))}
            className="flex-1 border-2 border-red-900/50 text-red-900 py-5 font-black uppercase italic text-xs hover:bg-red-900 hover:text-white transition-all flex items-center justify-center gap-3 opacity-50 hover:opacity-100"
          >
            <LogOut size={16} /> TERMINATE_SESSION
          </button>
        </div>

        <div className="mt-8 text-center">
            <p className="text-[8px] text-gray-700 font-mono tracking-[1em] uppercase">End of Configuration Terminal</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;