import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, User, Mail, Scissors, Sparkles, SlidersHorizontal, Calendar, Quote, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const FeatureItem = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="flex items-center gap-5 group">
    <div className="w-14 h-14 rounded-2xl border border-white/10 bg-black/40/5 backdrop-blur-md flex items-center justify-center transition-colors group-hover:bg-black/40/5">
      <Icon className="w-5 h-5 text-white/80" strokeWidth={1.5} />
    </div>
    <div>
      <h4 className="text-[13px] font-semibold text-white tracking-wide mb-1">{title}</h4>
      <p className="text-[11px] text-white/50">{desc}</p>
    </div>
  </div>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Login successful! Redirecting...', {
        duration: 1000,
        style: { background: '#F4E3C5', color: '#000000', borderRadius: '12px', fontWeight: 'bold' },
        iconTheme: { primary: '#000000', secondary: '#F4E3C5' },
      });
      setTimeout(() => {
        navigate('/');
      }, 500);
    } catch (err: any) {
      toast.error(err.message || 'Invalid credentials. Please try again.', {
        style: { background: '#EF4444', color: '#fff', borderRadius: '12px', fontWeight: 'bold' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-black font-sans selection:bg-[#F4E3C5] selection:text-black flex flex-col justify-between">
      {/* Background Image Setup */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-black/40 z-10"></div>
        <img
          src="/bg-waves.png"
          alt="Luxury Background"
          className="w-full h-full object-cover object-center opacity-80"
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-8 w-full max-w-[1400px] mx-auto px-6 py-4 lg:px-12 lg:py-0">

        {/* Left Column */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden lg:flex w-full lg:w-[30%] flex-col gap-8"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md mb-8">
              <Sparkles className="w-3.5 h-3.5 text-[#F4E3C5]" />
              <span className="text-[11px] font-medium text-white/90 tracking-wide">Welcome Back</span>
            </div>
            <h2 className="text-white/70 text-2xl font-light mb-1 tracking-wide">Welcome to</h2>
            <h1 className="text-6xl xl:text-7xl font-serif text-[#F4E3C5] tracking-wide mb-5">WOW SALON</h1>
            <p className="text-white/60 text-[13px] tracking-wide">Manage your salon. Elevate every experience.</p>
          </div>

          <div className="space-y-6">
            <FeatureItem icon={SlidersHorizontal} title="Smart Dashboard" desc="Real-time insights at a glance" />
            <FeatureItem icon={User} title="Customer First" desc="Build stronger relationships" />
            <FeatureItem icon={Calendar} title="Grow Your Business" desc="Data-driven decisions that matter" />
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/40/5 backdrop-blur-md p-7 relative mt-4">
            <Quote className="absolute top-5 left-5 w-5 h-5 text-white/20" />
            <Quote className="absolute bottom-5 right-5 w-5 h-5 text-white/20 rotate-180" />
            <p className="text-white/80 text-[13px] leading-relaxed mb-4 relative z-10 px-6 pt-2">
              Excellence is not an act,<br />but a habit.
            </p>
            <p className="text-white/40 text-[11px] px-6 pb-2">– Aristotle</p>
          </div>
        </motion.div>

        {/* Center Column: Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="w-full max-w-md lg:w-[40%] flex justify-center py-6 lg:py-10"
        >
          <div className="w-full bg-black/40 border border-white/10 backdrop-blur-3xl rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.8)]">

            <div className="text-center mb-8 relative z-10">
              <div className="mx-auto w-[72px] h-[72px] bg-[#F4E3C5] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(244,227,197,0.3)]">
                <Scissors className="text-black w-8 h-8 transform -rotate-45" strokeWidth={1.5} />
              </div>
              <h1 className="text-3xl tracking-tight text-white mb-3">WOW <span className="font-bold">SALON</span></h1>
              <p className="text-[#F4E3C5]/80 text-[9px] uppercase tracking-[0.35em] font-bold">Exclusive Access</p>

              {/* Thin glowing line */}
              <div className="mt-4 flex justify-center">
                <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-[#F4E3C5]/40 to-transparent"></div>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6 relative z-10">
              <div className="space-y-2.5">
                <label className="text-[9px] font-bold text-white/60 uppercase tracking-[0.15em] pl-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-white/40 group-focus-within:text-[#F4E3C5] transition-colors duration-300" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white placeholder-white/20 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-[#F4E3C5]/40 transition-all duration-300 text-[13px]"
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-[9px] font-bold text-white/60 uppercase tracking-[0.15em] pl-1">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-white/40 group-focus-within:text-[#F4E3C5] transition-colors duration-300" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white placeholder-white/20 rounded-2xl pl-12 pr-12 py-4 focus:outline-none focus:border-[#F4E3C5]/40 transition-all duration-300 text-[13px]"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-white/30 hover:text-white transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>



              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 bg-[#F4E3C5] hover:bg-[#eadebe] text-black font-bold tracking-[0.15em] py-4 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-[11px] shadow-[0_0_30px_rgba(244,227,197,0.15)] hover:shadow-[0_0_40px_rgba(244,227,197,0.3)] hover:-translate-y-0.5 active:translate-y-0"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    <span>AUTHORIZING...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>SIGN IN</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </button>
            </form>

            <div className="mt-8 text-center relative z-10">
              <p className="text-[9px] text-white/40 uppercase tracking-[0.2em] font-medium">DATA IS SECURED</p>
            </div>
          </div>
        </motion.div>

        {/* Empty Right Column for Balance */}
        <div className="hidden lg:block w-[30%]"></div>

      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="relative z-10 w-full flex justify-center pb-8"
      >
        <div className="inline-flex items-center gap-6 px-8 py-3.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-[11px] text-white/50 tracking-wide">
          <span className="flex items-center gap-2">
            <Lock className="w-3 h-3 text-white/40" />
            © 2026 WOW Salon. All rights reserved.
          </span>
          <span className="w-px h-3 bg-black/40/20"></span>
          <span className="flex gap-4">
            <span className="text-white/80 font-medium cursor-default">Powered by Duokarma</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}
