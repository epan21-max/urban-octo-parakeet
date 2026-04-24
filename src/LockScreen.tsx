import { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, Shield, Sparkles } from 'lucide-react';

const LOCK_PASSWORD = '0412';
const STORAGE_KEY = 'chatai_web_unlocked';

interface LockScreenProps {
  onUnlock: () => void;
}

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (locked && lockTimer > 0) {
      timerRef.current = setInterval(() => {
        setLockTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setLocked(false);
            setAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [locked, lockTimer]);

  const handleSubmit = () => {
    if (locked) return;
    if (input === LOCK_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      onUnlock();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(true);
      setShake(true);
      setInput('');
      setTimeout(() => { setShake(false); setError(false); }, 600);
      if (newAttempts >= 5) {
        setLocked(true);
        setLockTimer(30);
      }
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const dots = Array.from({ length: 4 });

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #1a1a4e 0%, #0a0a1a 50%, #000005 100%)',
        zIndex: 9999,
      }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(80,80,210,0.18) 1.5px, transparent 1.5px),
            linear-gradient(90deg, rgba(80,80,210,0.18) 1.5px, transparent 1.5px),
            linear-gradient(rgba(60,60,180,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(60,60,180,0.08) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px, 50px 50px',
        }}
      />

      {/* Glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '600px', height: '600px',
          background: 'radial-gradient(ellipse, rgba(25,25,112,0.35) 0%, transparent 70%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Floating particles */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: Math.random() * 4 + 2 + 'px',
            height: Math.random() * 4 + 2 + 'px',
            background: `rgba(${100 + i * 10}, ${100 + i * 5}, 255, ${0.3 + Math.random() * 0.4})`,
            left: `${5 + i * 8}%`,
            top: `${10 + (i % 5) * 18}%`,
            animation: `float ${3 + i * 0.5}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}

      {/* Card */}
      <div
        className={`relative w-full max-w-sm mx-4 rounded-3xl p-8 flex flex-col items-center gap-6 ${shake ? 'animate-shake' : ''}`}
        style={{
          background: 'rgba(10,10,30,0.85)',
          backdropFilter: 'blur(40px)',
          border: error ? '1.5px solid rgba(239,68,68,0.5)' : '1.5px solid rgba(80,80,210,0.3)',
          boxShadow: error
            ? '0 0 40px rgba(239,68,68,0.2), 0 20px 60px rgba(0,0,0,0.5)'
            : '0 0 40px rgba(25,25,112,0.3), 0 20px 60px rgba(0,0,0,0.5)',
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div 
            className="rounded-3xl flex items-center justify-center"
                    >
                      <img 
                        src="https://files.catbox.moe/pr9eng.png" 
                        alt="icon"
                        className="w-22 h-22 object-contain"
                      />
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)',
              }}
            />
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: '#7b7bff' }} />
              <span className="text-lg font-bold text-white tracking-wide">BlueGPT</span>
              <Sparkles className="w-4 h-4" style={{ color: '#7b7bff' }} />
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              This web is locked
            </p>
          </div>
        </div>

        {/* PIN dots display */}
        <div className="flex gap-3">
          {dots.map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-200"
              style={{
                background: i < input.length
                  ? (error ? '#ef4444' : '#4444cc')
                  : 'rgba(255,255,255,0.15)',
                boxShadow: i < input.length
                  ? (error ? '0 0 8px rgba(239,68,68,0.6)' : '0 0 8px rgba(68,68,204,0.6)')
                  : 'none',
                transform: i < input.length ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Input field */}
        <div className="w-full relative">
          <div
            className="w-full rounded-2xl flex items-center gap-3 px-4 py-3.5 transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: error
                ? '1.5px solid rgba(239,68,68,0.6)'
                : 'focus-within:1.5px solid rgba(80,80,210,0.6)',
              borderColor: error ? 'rgba(239,68,68,0.6)' : 'rgba(80,80,210,0.3)',
            }}
          >
            <Shield className="w-4 h-4 flex-shrink-0" style={{ color: error ? '#ef4444' : '#7b7bff' }} />
            <input
              ref={inputRef}
              type={showPw ? 'text' : 'password'}
              value={input}
              onChange={e => {
                if (locked) return;
                const val = e.target.value;
                if (val.length <= 4) setInput(val);
              }}
              onKeyDown={handleKey}
              placeholder="Enter key..."
              maxLength={4}
              disabled={locked}
              className="flex-1 bg-transparent outline-none text-center text-white text-xl font-mono tracking-[0.5em] placeholder:tracking-normal placeholder:text-sm"
              style={{
                color: error ? '#ef4444' : 'white',
                caretColor: '#7b7bff',
              }}
            />
            <button
              onClick={() => setShowPw(p => !p)}
              className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              {showPw
                ? <EyeOff className="w-4 h-4 text-white" />
                : <Eye className="w-4 h-4 text-white" />
              }
            </button>
          </div>
        </div>

        {/* Error / Locked message */}
        {error && !locked && (
          <p
            className="text-xs font-medium"
            style={{ color: '#ef4444', animation: 'fadeIn 0.2s ease' }}
          >
            ❌ Incorrect key. {5 - attempts} attempt{5 - attempts !== 1 ? 's' : ''} remaining.
          </p>
        )}
        {locked && (
          <div
            className="w-full rounded-2xl p-3 text-center"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>
              🔒 Too many attempts
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Try again in <span className="font-bold text-white">{lockTimer}s</span>
            </p>
          </div>
        )}

        {/* Unlock button */}
        <button
          onClick={handleSubmit}
          disabled={locked || input.length === 0}
          className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            background: locked || input.length === 0
              ? 'rgba(255,255,255,0.07)'
              : 'linear-gradient(135deg, #191970, #2a2aad, #4444cc)',
            boxShadow: locked || input.length === 0
              ? 'none'
              : '0 4px 20px rgba(25,25,112,0.5)',
            opacity: locked || input.length === 0 ? 0.5 : 1,
            cursor: locked || input.length === 0 ? 'not-allowed' : 'pointer',
            transform: locked || input.length === 0 ? 'none' : 'translateY(0)',
          }}
        >
          <Lock className="w-4 h-4" />
          Unlock
        </button>

        {/* Footer */}
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Protected by BlueGPT Security
        </p>
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(25,25,112,0.6), 0 0 80px rgba(25,25,112,0.3); }
          50% { box-shadow: 0 0 60px rgba(68,68,204,0.8), 0 0 120px rgba(25,25,112,0.5); }
        }
        @keyframes float {
          from { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
          to { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}

export function useWebLock() {
  const [isLocked, setIsLocked] = useState(() => {
    return sessionStorage.getItem('chatai_web_unlocked') !== 'true';
  });
  const unlock = () => setIsLocked(false);
  return { isLocked, unlock };
}
