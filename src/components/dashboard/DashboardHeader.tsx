import { RefreshCw, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import companyLogo from '@/assets/company-logo.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';

const LANGS: { code: Language; flag: string }[] = [
  { code: 'it', flag: '🇮🇹' },
  { code: 'en', flag: '🇬🇧' },
  { code: 'de', flag: '🇩🇪' },
];

interface DashboardHeaderProps {
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DashboardHeader({ onRefresh, isLoading }: DashboardHeaderProps) {
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-5">
        <img src={companyLogo} alt="EasySea Logo" className="h-14 w-auto" />
        <div className="h-8 w-px bg-border/50" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            EASYSEA ANALYTICS
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t('header.subtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Language switcher */}
        <div className="flex items-center rounded-lg bg-muted p-0.5 gap-0.5">
          {LANGS.map(({ code, flag }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              title={code.toUpperCase()}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                lang === code
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="text-sm leading-none">{flag}</span>
              <span className="uppercase tracking-wide">{code}</span>
            </button>
          ))}
        </div>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-destructive"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
