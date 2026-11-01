import React, { useState } from 'react';

export interface FrameDefinition {
  id: number;
  nameAr: string;
  nameEn: string;
  ringClass: string;
  costPoints: number;
  premiumOnly: boolean;
}

export const PROFILE_FRAMES: FrameDefinition[] = [
  {
    id: 0,
    nameAr: 'الإطار القياسي',
    nameEn: 'Standard Slate',
    ringClass: 'ring-2 ring-slate-300 dark:ring-slate-600 p-0.5 bg-slate-100 dark:bg-[#26223A]',
    costPoints: 0,
    premiumOnly: false,
  },
  {
    id: 1,
    nameAr: 'البنفسجي الهادئ',
    nameEn: 'Soft Violet',
    ringClass: 'ring-2 ring-[#8B5CF6] p-0.5 bg-[#8B5CF6]/15',
    costPoints: 0,
    premiumOnly: false,
  },
  {
    id: 2,
    nameAr: 'المجرة البنفسجية',
    nameEn: 'Cosmic Nebula',
    ringClass: 'p-[3px] bg-gradient-to-tr from-[#2D1B69] via-[#8B5CF6] to-fuchsia-400 shadow-sm',
    costPoints: 150,
    premiumOnly: false,
  },
  {
    id: 3,
    nameAr: 'التاج الذهبي',
    nameEn: 'Royal Amber',
    ringClass: 'p-[3px] bg-gradient-to-tr from-amber-500 via-yellow-300 to-orange-500 shadow-sm',
    costPoints: 250,
    premiumOnly: false,
  },
  {
    id: 4,
    nameAr: 'الزمرد الملكي (مميز)',
    nameEn: 'Royal Emerald (VIP)',
    ringClass: 'p-[3px] bg-gradient-to-tr from-emerald-600 via-teal-300 to-cyan-500 shadow-sm',
    costPoints: 400,
    premiumOnly: true,
  },
  {
    id: 5,
    nameAr: 'شفق الألماس (مميز)',
    nameEn: 'Diamond Dusk (VIP)',
    ringClass: 'p-[3px] bg-gradient-to-tr from-rose-500 via-[#8B5CF6] to-indigo-400 shadow-sm',
    costPoints: 500,
    premiumOnly: true,
  },
];

export const AVATAR_PRESETS = ['aurora', 'moon', 'sun', 'spark', 'cloud', 'wave', 'prism'] as const;

interface FramedAvatarProps {
  avatarUrl: string;
  frameId: number;
  nickname: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_MAP = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export const FramedAvatar: React.FC<FramedAvatarProps> = ({
  avatarUrl,
  frameId,
  nickname,
  size = 'md',
}) => {
  const [imgError, setImgError] = useState(false);
  const frame = PROFILE_FRAMES.find((f) => f.id === frameId) ?? PROFILE_FRAMES[0];
  const isCustomDataImage = avatarUrl.startsWith('data:image/') && !imgError;

  const renderPresetSvg = (preset: string) => {
    switch (preset) {
      case 'moon':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect width="64" height="64" fill="#2D1B69" />
            <circle cx="34" cy="30" r="16" fill="#A78BFA" />
            <circle cx="40" cy="26" r="14" fill="#2D1B69" />
            <circle cx="20" cy="20" r="2" fill="#FDE68A" />
            <circle cx="46" cy="44" r="1.8" fill="#FDE68A" />
          </svg>
        );
      case 'sun':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect width="64" height="64" fill="#FEF3C7" />
            <circle cx="32" cy="32" r="15" fill="#F59E0B" />
            <circle cx="32" cy="32" r="9" fill="#FBBF24" />
          </svg>
        );
      case 'spark':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect width="64" height="64" fill="#3B1D7A" />
            <path d="M32 12L37 27L52 32L37 37L32 52L27 37L12 32L27 27Z" fill="#C4B5FD" />
          </svg>
        );
      case 'cloud':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect width="64" height="64" fill="#1E293B" />
            <path
              d="M22 42H43C47.4 42 51 38.4 51 34C51 29.9 47.9 26.5 43.9 26.1C42.4 20.3 37.2 16 31 16C23.8 16 18 21.8 18 29C14.7 29.8 12 32.8 12 36.5C12 39.5 14.5 42 17.5 42H22Z"
              fill="#94A3B8"
            />
          </svg>
        );
      case 'wave':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect width="64" height="64" fill="#0F4C5C" />
            <path d="M0 36 Q16 24 32 36 T64 36 L64 64 L0 64 Z" fill="#2EC4B6" />
            <circle cx="44" cy="20" r="7" fill="#FFBF69" />
          </svg>
        );
      case 'prism':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <rect width="64" height="64" fill="#1E1B2E" />
            <polygon points="32,12 50,46 14,46" fill="#8B5CF6" />
            <polygon points="32,20 43,42 21,42" fill="#DDD6FE" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <defs>
              <linearGradient id="avAurora" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#2D1B69" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill="url(#avAurora)" />
            <circle cx="32" cy="25" r="10" fill="#F3E8FF" />
            <path d="M16 52C16 43.2 23.2 36 32 36C40.8 36 48 43.2 48 52" fill="#DDD6FE" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`${SIZE_MAP[size]} rounded-full shrink-0 flex items-center justify-center ${frame.ringClass}`}
      title={nickname}
    >
      <div className="w-full h-full rounded-full overflow-hidden bg-[#2D1B69] flex items-center justify-center">
        {isCustomDataImage ? (
          <img
            src={avatarUrl}
            alt={nickname}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          renderPresetSvg(avatarUrl)
        )}
      </div>
    </div>
  );
};
