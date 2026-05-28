import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const Login = ({ setUser }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async () => {
    try {
      let userCredential;
      if (isRegistering) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      setUser(userCredential.user);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-black font-system">
      <div className="text-center p-8 border border-system-blue/30 bg-system-card relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-system-blue animate-pulse"></div>
        <h1 className="text-5xl font-black text-white italic mb-2 tracking-tighter">UPSC SYSTEM</h1>
        <p className="text-system-blue text-[10px] tracking-[0.5em] mb-10 uppercase italic">Initializing Player Authentication...</p>
        
        <div className="space-y-4">
          <input 
            type="email" placeholder="IDENTITY (EMAIL)"
            className="block w-80 mx-auto bg-black border border-gray-800 p-3 text-white text-xs focus:border-system-blue outline-none transition-all"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" placeholder="SECRET CODE (PASSWORD)"
            className="block w-80 mx-auto bg-black border border-gray-800 p-3 text-white text-xs focus:border-system-blue outline-none transition-all"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button 
            onClick={handleAuth}
            className="w-80 bg-system-blue text-black py-3 font-black uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(0,242,255,0.4)]"
          >
            {isRegistering ? 'Create Hunter Profile' : 'Access System'}
          </button>
          <p 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-[10px] text-gray-500 cursor-pointer hover:text-system-blue mt-4 uppercase tracking-widest"
          >
            {isRegistering ? 'Already have a profile? Login' : 'New Hunter? Register Here'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;