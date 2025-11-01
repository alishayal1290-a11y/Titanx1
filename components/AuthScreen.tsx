
import React, { useState } from 'react';
import { AnimatedButton } from './common/AnimatedButton';

interface AuthScreenProps {
  onLogin: (email: string, pass: string) => void;
  onSignUp: (name: string, email: string, pass: string, refCode?: string) => void;
  error?: string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onSignUp, error }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      onLogin(email, password);
    } else {
      onSignUp(name, email, password, referralCode);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-800">Titans <span className="text-amber-500">X</span></h1>
            <p className="text-gray-500 mt-2">Your Ultimate Tournament Platform</p>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-lg">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{isLogin ? 'Welcome Back!' : 'Create Account'}</h2>
            <p className="text-gray-500">{isLogin ? 'Sign in to continue' : 'Join the community'}</p>
          </div>
          
          {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</p>}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition"/>
            )}
            <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition"/>
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition"/>
            {!isLogin && (
              <input type="text" placeholder="Referral Code (Optional)" value={referralCode} onChange={e => setReferralCode(e.target.value)} 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition"/>
            )}
            <AnimatedButton type="submit" className="w-full">
              {isLogin ? 'Login' : 'Sign Up'}
            </AnimatedButton>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => setIsLogin(!isLogin)} className="font-semibold text-amber-600 hover:underline ml-1">
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};