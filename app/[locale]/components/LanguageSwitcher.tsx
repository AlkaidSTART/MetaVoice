'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const tLanguage = useTranslations('language');
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const locales = [
    { code: 'zh', name: tLanguage('zh'), flag: '🇨🇳' },
    { code: 'en', name: tLanguage('en'), flag: '🇺🇸' },
  ];

  const currentLocale = locales.find((l) => l.code === locale) || locales[0];

  // 切换语言
  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as 'zh' | 'en' });
    setIsOpen(false);
  };

  // 下拉菜单动画
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      gsap.fromTo(
        dropdownRef.current,
        { opacity: 0, y: -10, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: 'power2.out' }
      );
    }
  }, [isOpen]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative z-[100]">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface/80 hover:bg-sakura-light/20 border border-sakura/10 transition-all"
        aria-label={tLanguage('switcherLabel')}
        aria-expanded={isOpen}
      >
        <Globe className="w-4 h-4 text-sakura" />
        <span className="text-sm font-medium text-text-primary">
          {currentLocale.flag} {currentLocale.name}
        </span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 right-0 bg-white rounded-xl border border-sakura/10 shadow-lg overflow-hidden z-[100]"
        >
          {locales.map((l) => (
            <button
              key={l.code}
              onClick={() => handleLocaleChange(l.code)}
              className={`w-full flex items-center gap-2 px-4 py-3 text-sm transition-all ${
                l.code === locale
                  ? 'bg-sakura-light/30 text-sakura font-medium'
                  : 'hover:bg-sakura-light/20 text-text-primary'
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
