// Login.tsx
import { useState, useEffect } from 'react';
import { Lock, Sparkles, Eye, EyeOff, Shield, AlertTriangle } from 'lucide-react';

interface LoginProps {
  onLogin: (password: string) => void;
  isLockScreenEnabled: boolean;
  onToggleLockScreen: (enabled: boolean) => void;
}

const CORRECT_PASSWORD = 'EPANDLABS';

export default function Login({ onLogin, isLockScreenEnabled, onToggleLockScreen }: LoginProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter password');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    setTimeout(() => {
      if (password === CORRECT_PASSWORD) {
        onLogin(password);
        setError('');
      } else {
        setError('Invalid password. Please try again.');
        setPassword('');
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{
      background: 'radial-gradient(ellipse at 20% 30%, #0a0a2e, #02020f)'
    }}>
      {/* Animated background grid */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(100,100,200,0.15) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}/>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl animate-pulse"/>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl animate-pulse" style={{animationDelay: '1s'}}/>
        </div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="rounded-3xl shadow-2xl overflow-hidden" style={{
          background: 'rgba(13, 13, 26, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(25, 25, 112, 0.3)'
        }}>
          {/* Header */}
          <div className="relative p-8 text-center border-b" style={{borderColor: 'rgba(25, 25, 112, 0.2)'}}>            
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-xl" style={{
                  background: 'linear-gradient(135deg, #191970, #3232a0)',
                  opacity: 0.5
                }}/>
                <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center">
                  <img 
                        src="https://files.catbox.moe/pr9eng.png" 
                        alt="icon"
                        className="w-20 h-20 object-contain"
                      />
                </div>
              </div>
            </div>
            
            <h1 className="text-2xl font-bold mb-2" style={{
              background: 'linear-gradient(135deg, #fff, #a0a0ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              BlueGPT
            </h1>
            <p className="text-sm" style={{color: '#a0a0cc'}}>Enter password to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-xs font-medium mb-2" style={{color: '#a0a0cc'}}>
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Lock className="w-4 h-4" style={{color: '#6666aa'}}/>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-xl outline-none transition-all text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: error ? '1.5px solid #ef4444' : '1.5px solid rgba(25, 25, 112, 0.3)',
                    color: '#f0f0ff'
                  }}
                  placeholder="Enter your password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{color: '#6666aa'}}
                >
                  {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
              {error && (
                <p className="text-xs mt-2 flex items-center gap-1" style={{color: '#ef4444'}}>
                  <AlertTriangle className="w-3 h-3"/>
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #191970, #3232a0)',
                boxShadow: '0 4px 20px rgba(25, 25, 112, 0.4)'
              }}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  Verifying...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4"/>
                  Unlock
                </>
              )}
            </button>

            {/* Lock Screen Toggle Info */}
            <div className="pt-2 text-center">
              <div className="flex items-center justify-center gap-2 text-xs" style={{color: '#6666aa'}}>
                <Shield className="w-3 h-3"/>
                <span>Lock screen is {isLockScreenEnabled ? 
                  <span style={{color: '#10b981'}}>ENABLED</span> : 
                  <span style={{color: '#ef4444'}}>DISABLED</span>
                }</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}