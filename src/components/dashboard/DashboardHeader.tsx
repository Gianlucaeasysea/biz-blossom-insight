import { RefreshCw, LogOut, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
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
    <header className="flex items-center justify-between mb-4 sm:mb-8 gap-2">
      {/* Logo + Title */}
      <div className="flex items-center gap-2 sm:gap-5 min-w-0">
        <img src={companyLogo} alt="EasySea Logo" className="h-8 sm:h-14 w-auto shrink-0" />
        <div className="hidden sm:block h-8 w-px bg-border/50" />
        <div className="min-w-0">
          <h1 className="text-sm sm:text-xl font-bold tracking-tight text-foreground truncate">
            EASYSEA ANALYTICS
          </h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 hidden xs:block">{t('header.subtitle')}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        {/* Language switcher */}
        <div className="flex items-center rounded-lg bg-muted p-0.5 gap-0.5">
          {LANGS.map(({ code, flag }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              title={code.toUpperCase()}
              className={`flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                lang === code
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="text-xs sm:text-sm leading-none">{flag}</span>
              <span className="uppercase tracking-wide hidden sm:inline">{code}</span>
            </button>
          ))}
        </div>

        {/* Refresh */}
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading} className="text-muted-foreground hover:text-foreground h-8 w-8">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>

        {/* Logout */}
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive h-8 w-8" title="Logout">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
