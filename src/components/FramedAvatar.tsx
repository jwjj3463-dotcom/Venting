import React, { useState } from 'react';
import {
  Check,
  Cloud,
  Gem,
  Moon,
  Sparkles,
  Sun,
  UserRound,
  Waves,
  type LucideIcon,
} from 'lucide-react';

export interface FrameDefinition {
  id: number;
  nameAr: string;
  nameEn: string;
  ringClass: string;
  costPoints: number;
  premiumOnly: boolean;
}

export const OfficialBadge: React.FC<{ role?: string }> = ({ role }) => {
  if (role !== 'owner' && role !== 'moderator') return null;

  const label = role === 'owner' ? 'مالك المنصة موثّق' : 'مشرف موثّق';
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-white align-middle"
    >
      <Check aria-hidden="true" className="h-[9px] w-[9px] stroke-[3]" />
    </span>
  );
};

export const PROFILE_FRAMES: FrameDefinition[] = [
  {
    id: 0,
    nameAr: 'الإطار القياسي',
    nameEn: 'Standard Slate',
    ringClass: 'border-2 border-slate-300 dark:border-slate-600 p-0.5 bg-slate-100 dark:bg-[#26223A]',
    costPoints: 0,
    premiumOnly: false,
  },
  {
    id: 1,
    nameAr: 'البنفسجي الهادئ',
    nameEn: 'Soft Violet',
    ringClass: 'border-2 border-[#8B5CF6] p-0.5 bg-[#8B5CF6]/15',
    costPoints: 0,
    premiumOnly: false,
  },
  {
    id: 2,
    nameAr: 'المجرة البنفسجية',
    nameEn: 'Cosmic Nebula',
    ringClass: 'p-[2px] bg-gradient-to-tr from-[#2D1B69] via-[#8B5CF6] to-fuchsia-400',
    costPoints: 150,
    premiumOnly: false,
  },
  {
    id: 3,
    nameAr: 'التاج الذهبي',
    nameEn: 'Royal Amber',
    ringClass: 'p-[2px] bg-gradient-to-tr from-amber-500 via-yellow-300 to-orange-500',
    costPoints: 250,
    premiumOnly: false,
  },
  {
    id: 4,
    nameAr: 'الزمرد الملكي (مميز)',
    nameEn: 'Royal Emerald (VIP)',
    ringClass: 'p-[2px] bg-gradient-to-tr from-emerald-600 via-teal-300 to-cyan-500',
    costPoints: 400,
    premiumOnly: true,
  },
  {
    id: 5,
    nameAr: 'شفق الألماس (مميز)',
    nameEn: 'Diamond Dusk (VIP)',
    ringClass: 'p-[2px] bg-gradient-to-tr from-rose-500 via-[#8B5CF6] to-indigo-400',
    costPoints: 500,
    premiumOnly: true,
  },
];

export const AVATAR_PRESETS = ['aurora', 'moon', 'sun', 'spark', 'cloud', 'wave', 'prism'] as const;

const AVATAR_PRESET_STYLES: Record<
  string,
  { Icon: LucideIcon; background: string; foreground: string }
> = {
  aurora: {
    Icon: UserRound,
    background: 'bg-gradient-to-br from-violet-500 to-indigo-950',
    foreground: 'text-violet-100',
  },
  moon: {
    Icon: Moon,
    background: 'bg-gradient-to-br from-indigo-400 to-slate-950',
    foreground: 'text-indigo-100',
  },
  sun: {
    Icon: Sun,
    background: 'bg-gradient-to-br from-amber-300 to-orange-600',
    foreground: 'text-white',
  },
  spark: {
    Icon: Sparkles,
    background: 'bg-gradient-to-br from-fuchsia-500 to-violet-950',
    foreground: 'text-fuchsia-100',
  },
  cloud: {
    Icon: Cloud,
    background: 'bg-gradient-to-br from-sky-300 to-slate-700',
    foreground: 'text-white',
  },
  wave: {
    Icon: Waves,
    background: 'bg-gradient-to-br from-teal-300 to-cyan-950',
    foreground: 'text-teal-50',
  },
  prism: {
    Icon: Gem,
    background: 'bg-gradient-to-br from-rose-400 via-violet-500 to-indigo-900',
    foreground: 'text-white',
  },
};

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

  const preset = AVATAR_PRESET_STYLES[avatarUrl] ?? AVATAR_PRESET_STYLES.aurora;
  const PresetIcon = preset.Icon;

  return (
    <div
      className={`${SIZE_MAP[size]} relative isolate box-border rounded-full shrink-0 flex items-center justify-center ${frame.ringClass}`}
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
          <div
            className={`w-full h-full flex items-center justify-center ${preset.background} ${preset.foreground}`}
          >
            <PresetIcon aria-hidden="true" className="h-[52%] w-[52%] stroke-[1.7]" />
          </div>
        )}
      </div>
    </div>
  );
};
