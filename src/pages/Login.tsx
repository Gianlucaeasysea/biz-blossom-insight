import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import companyLogo from '@/assets/company-logo.png';

const REMEMBER_KEY = 'easysea-remember';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Load remembered email
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const { email: savedEmail } = JSON.parse(saved);
        if (savedEmail) {
          setEmail(savedEmail);
          setRemember(true);
        }
      }
    } catch {}
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Email o password non validi'
        : authError.message);
      setLoading(false);
      return;
    }

    // Save or clear remember
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email }));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

    navigate('/');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setForgotError(error.message);
      setForgotLoading(false);
      return;
    }

    setForgotSent(true);
    setForgotLoading(false);
  };

  // Forgot password view
  if (showForgot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-3">
            <img src={companyLogo} alt="EasySea" className="h-16 w-auto mx-auto" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Recupera Password</h1>
              <p className="text-xs text-muted-foreground mt-1">Ti invieremo un link per reimpostare la password</p>
            </div>
          </div>

          {forgotSent ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Email inviata!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Controlla la tua casella di posta ({forgotEmail}) e segui il link per reimpostare la password.
                  </p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setShowForgot(false); setForgotSent(false); }}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Torna al login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="email@esempio.com"
                  required
                  autoComplete="email"
                />
              </div>

              {forgotError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  {forgotError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={forgotLoading}>
                {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                Invia link di recupero
              </Button>

              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowForgot(false)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Torna al login
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Login view
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <img src={companyLogo} alt="EasySea" className="h-16 w-auto mx-auto" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">EASYSEA ANALYTICS</h1>
            <p className="text-xs text-muted-foreground mt-1">Accedi al dashboard</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@esempio.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">Ricordami</span>
            </label>

            <button
              type="button"
              onClick={() => { setShowForgot(true); setForgotEmail(email); }}
              className="text-xs text-primary hover:underline"
            >
              Password dimenticata?
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
            Accedi
          </Button>
        </form>
      </div>
    </div>
  );
}
