import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, Scissors, Sparkles, SlidersHorizontal, Calendar, User, Quote, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const FeatureItem = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="flex items-center gap-5 group">
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-105"
      style={{ background: 'rgba(214,193,163,0.08)', border: '1px solid rgba(214,193,163,0.15)' }}
    >
      <Icon className="w-4 h-4" style={{ color: '#D6C1A3' }} strokeWidth={1.5} />
    </div>
    <div>
      <h4 className="text-[13px] font-semibold tracking-wide mb-0.5" style={{ color: '#F7F3EE' }}>{title}</h4>
      <p className="text-[11px]" style={{ color: 'rgba(207,199,188,0.5)' }}>{desc}</p>
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
        style: { background: '#D6C1A3', color: '#0E0E0E', borderRadius: '12px', fontWeight: 'bold' },
        iconTheme: { primary: '#0E0E0E', secondary: '#D6C1A3' },
      });
      setTimeout(() => {
        navigate('/');
      }, 500);
    } catch (err: any) {
      toast.error(err.message || 'Invalid credentials. Please try again.', {
        style: { background: '#2a1a1a', color: '#D1A2A2', borderRadius: '12px', fontWeight: 'bold', border: '1px solid rgba(209,162,162,0.2)' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden font-sans flex flex-col justify-between"
      style={{ background: '#0E0E0E', color: '#F7F3EE' }}
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 z-10" style={{ background: 'rgba(14,14,14,0.55)' }} />
        <img
          src="/bg-waves.png"
          alt="Luxury Background"
          className="w-full h-full object-cover object-center opacity-60"
        />
      </div>

      {/* Subtle ambient glows */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(214,193,163,0.04) 0%, transparent 70%)' }}
      />

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-8 w-full max-w-[1400px] mx-auto px-6 py-4 lg:px-12 lg:py-0">

        {/* Left Column */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex w-full lg:w-[30%] flex-col gap-10"
        >
          <div>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-10"
              style={{ background: 'rgba(214,193,163,0.08)', border: '1px solid rgba(214,193,163,0.15)' }}
            >
              <Sparkles className="w-3 h-3" style={{ color: '#D6C1A3' }} />
              <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'rgba(214,193,163,0.8)' }}>
                Welcome Back
              </span>
            </div>
            <p className="text-sm font-light mb-2 tracking-[0.12em] uppercase" style={{ color: 'rgba(207,199,188,0.5)' }}>
              Welcome to
            </p>
            <h1
              className="text-7xl xl:text-8xl mb-5 leading-none"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#D6C1A3', fontWeight: 400, letterSpacing: '-0.02em' }}
            >
              TENS11
            </h1>
            <p className="text-[11px] font-light tracking-[0.2em] uppercase" style={{ color: 'rgba(207,199,188,0.4)' }}>
              Luxury Salon Operating System
            </p>
          </div>

          <div className="space-y-6">
            <FeatureItem icon={SlidersHorizontal} title="Smart Dashboard" desc="Real-time insights at a glance" />
            <FeatureItem icon={User} title="Customer First" desc="Build stronger relationships" />
            <FeatureItem icon={Calendar} title="Grow Your Business" desc="Data-driven decisions that matter" />
          </div>

          <div
            className="rounded-[2rem] p-7 relative"
            style={{ background: 'rgba(214,193,163,0.05)', border: '1px solid rgba(214,193,163,0.1)' }}
          >
            <Quote className="absolute top-5 left-5 w-4 h-4" style={{ color: 'rgba(214,193,163,0.2)' }} />
            <Quote className="absolute bottom-5 right-5 w-4 h-4 rotate-180" style={{ color: 'rgba(214,193,163,0.2)' }} />
            <p className="text-[13px] leading-relaxed mb-4 px-6 pt-2" style={{ color: 'rgba(247,243,238,0.7)' }}>
              Excellence is not an act,<br />but a habit.
            </p>
            <p className="text-[11px] px-6 pb-2" style={{ color: 'rgba(207,199,188,0.35)' }}>– Aristotle</p>
          </div>
        </motion.div>

        {/* Center Column: Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="w-full max-w-md lg:w-[40%] flex justify-center py-6 lg:py-10"
        >
          <div
            className="w-full rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 32px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Card glow */}
            <div
              className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(214,193,163,0.04) 0%, transparent 70%)' }}
            />

            <div className="text-center mb-10 relative z-10">
              <div className="mx-auto w-24 h-24 mb-6 rounded-full overflow-hidden shadow-2xl border border-[#D6C1A3]/20">
                <img src="/logo.png" alt="TENS11 Logo" className="w-full h-full object-cover" />
              </div>
              <h1
                className="text-4xl mb-2 leading-none"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#F7F3EE', fontWeight: 400 }}
              >
                TENS11
              </h1>
              <p className="text-[9px] uppercase tracking-[0.35em] font-bold" style={{ color: 'rgba(214,193,163,0.6)' }}>
                Exclusive Access
              </p>

              {/* Thin glowing separator */}
              <div className="mt-5 flex justify-center">
                <div
                  className="h-px w-20"
                  style={{ background: 'linear-gradient(to right, transparent, rgba(214,193,163,0.35), transparent)' }}
                />
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5 relative z-10">
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-[0.15em] pl-1" style={{ color: 'rgba(207,199,188,0.5)' }}>
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 transition-colors duration-300" style={{ color: 'rgba(207,199,188,0.4)' }} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="!pl-11 !pr-4 !py-4 !rounded-2xl"
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-[0.15em] pl-1" style={{ color: 'rgba(207,199,188,0.5)' }}>
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 transition-colors duration-300" style={{ color: 'rgba(207,199,188,0.4)' }} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="!pl-11 !pr-12 !py-4 !rounded-2xl"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center transition-colors focus:outline-none"
                    style={{ color: 'rgba(207,199,188,0.3)' }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-4 btn-primary !py-4 !rounded-2xl !text-[11px] tracking-[0.15em]"
                style={{ fontSize: '11px', letterSpacing: '0.15em' }}
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
              <p className="text-[9px] uppercase tracking-[0.2em] font-medium" style={{ color: 'rgba(207,199,188,0.3)' }}>
                Data Is Secured
              </p>
            </div>
          </div>
        </motion.div>

        {/* Empty Right Column for Balance */}
        <div className="hidden lg:block w-[30%]" />
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="relative z-10 w-full flex justify-center pb-8"
      >
        <div
          className="inline-flex items-center gap-6 px-8 py-3.5 rounded-full text-[11px] tracking-wide"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(207,199,188,0.4)' }}
        >
          <span className="flex items-center gap-2">
            <Lock className="w-3 h-3" style={{ color: 'rgba(207,199,188,0.3)' }} />
            © 2026 TENS11 Salon. All rights reserved.
          </span>
          <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <span className="font-medium cursor-default" style={{ color: 'rgba(214,193,163,0.7)' }}>
            Powered by Duokarma
          </span>
        </div>
      </motion.div>
    </div>
  );
}
