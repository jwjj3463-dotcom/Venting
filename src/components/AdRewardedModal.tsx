/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  Sparkles,
  Volume2,
  VolumeX,
  X,
  CheckCircle2,
  Gift,
  Coins,
  ShieldCheck,
  Play,
  RotateCw,
} from 'lucide-react';
import { adService, AdConfig } from '../services/adService';
import { AppLang } from '../i18n/translations';

interface AdRewardedModalProps {
  isOpen: boolean;
  lang: AppLang;
  onClose: () => void;
  onRewardClaimed?: (points: number) => void;
}

const REWARDED_ADS = [
  {
    brand: 'لعبة أساطير الشرق 3D',
    title: 'انضم لملايين اللاعبين في أضخم ملحمة جماعية مع أصدقائك!',
    rating: '★ 4.8 · 10M+ تنزيل',
    gradient: 'from-amber-600 via-purple-700 to-indigo-900',
    tag: 'ألعاب استراتيجية',
  },
  {
    brand: 'تطبيق رحلتي — حجز طيران وفنادق',
    title: 'خصم 35% على أول حجز فندقي لجميع المستخدمين الجدد!',
    rating: '★ 4.9 · موثوق ومضمون',
    gradient: 'from-sky-600 via-blue-700 to-slate-900',
    tag: 'سفر وسياحة',
  },
  {
    brand: 'منصة تعلّم البرمجة والذكاء الاصطناعي',
    title: 'احترف بايثون وتطوير الويب واصنع تطبيقاتك الخاصة مجاناً',
    rating: '★ 4.9 · شهادات معتمدة',
    gradient: 'from-emerald-600 via-teal-700 to-slate-900',
    tag: 'تعليم وتقنية',
  },
];

export const AdRewardedModal: React.FC<AdRewardedModalProps> = ({
  isOpen,
  lang,
  onClose,
  onRewardClaimed,
}) => {
  const [timeLeft, setTimeLeft] = useState(15);
  const [completed, setCompleted] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimedReward, setClaimedReward] = useState<number | null>(null);
  const [claimError, setClaimError] = useState('');
  const [muted, setMuted] = useState(true);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  const adConfig = adService.getConfig();
  const rewardPoints = adConfig.reward_points_amount || 25;

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(15);
      setCompleted(false);
      setClaiming(false);
      setClaimedReward(null);
      setClaimError('');
      return;
    }

    setCurrentAdIndex(Math.floor(Math.random() * REWARDED_ADS.length));
    setTimeLeft(15);
    setCompleted(false);
    setClaiming(false);
    setClaimedReward(null);
    setClaimError('');

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // When timer completes, automatically call server to credit the points!
  useEffect(() => {
    if (completed && !claimedReward && !claiming && !claimError) {
      setClaiming(true);
      adService.claimRewardedAdReward().then((res) => {
        setClaiming(false);
        if (res.ok) {
          const pts = res.pointsAwarded ?? rewardPoints;
          setClaimedReward(pts);
          if (onRewardClaimed) onRewardClaimed(pts);
        } else {
          setClaimError(res.error || 'فشل توثيق المكافأة.');
        }
      });
    }
  }, [completed, claimedReward, claiming, claimError, rewardPoints, onRewardClaimed]);

  if (!isOpen) return null;

  const ad = REWARDED_ADS[currentAdIndex] || REWARDED_ADS[0];
  const progressPercent = ((15 - timeLeft) / 15) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md rounded-3xl bg-[#1E1B2E] border border-white/10 shadow-2xl overflow-hidden flex flex-col relative text-white">
        {/* Top Header Bar */}
        <div className="px-4 py-3 bg-[#151221] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono-num font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
              AdMob Video Ad
            </span>
            {adConfig.test_mode && (
              <span className="text-[10px] text-slate-400 font-mono-num">
                (Test Ad)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {completed ? (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25 active:scale-95 transition-transform"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <div className="px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[11px] font-mono-num font-bold text-amber-300">
                {timeLeft}s
              </div>
            )}
          </div>
        </div>

        {/* Video Simulation Canvas */}
        <div
          className={`h-56 relative bg-gradient-to-br ${ad.gradient} p-6 flex flex-col justify-between overflow-hidden`}
        >
          {/* Animated decorative pulses */}
          <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/10 blur-2xl animate-pulse" />
          <div className="absolute -left-10 -top-10 w-44 h-44 rounded-full bg-purple-500/20 blur-2xl animate-pulse" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/40 backdrop-blur-sm text-white">
              {ad.tag}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-black/40 px-2 py-0.5 rounded-full">
              <Gift className="w-3.5 h-3.5" />
              <span>+{rewardPoints} {lang === 'ar' ? 'نقطة' : 'pts'}</span>
            </div>
          </div>

          <div className="relative z-10 space-y-2 text-center my-auto">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto shadow-inner border border-white/20">
              <Play className="w-7 h-7 text-white fill-white/80" />
            </div>
            <h3 className="text-base font-bold drop-shadow-md">{ad.brand}</h3>
            <p className="text-xs text-white/90 max-w-xs mx-auto drop-shadow-sm leading-relaxed">
              {ad.title}
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between text-[11px] text-white/80">
            <span>{ad.rating}</span>
            <span className="font-mono-num font-bold text-white">AdMob Interactive</span>
          </div>

          {/* Bottom Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40">
            <div
              className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Reward Status / Action Footer */}
        <div className="p-5 space-y-3 bg-[#1E1B2E]">
          {completed ? (
            <div className="text-center space-y-3 animate-fadeIn">
              {claiming ? (
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-400 py-2">
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>{lang === 'ar' ? 'جارٍ توثيق المكافأة في السيرفر...' : 'Verifying reward with server...'}</span>
                </div>
              ) : claimedReward ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-400">
                      {lang === 'ar' ? 'تهانينا! تمت إضافة النقاط بنجاح 🎉' : 'Reward Granted! 🎉'}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      {lang === 'ar'
                        ? `حصلت على +${claimedReward} نقطة مجاناً في حسابك!`
                        : `You earned +${claimedReward} points!`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-xs font-bold active:scale-[0.98] transition-transform shadow-md"
                  >
                    {lang === 'ar' ? 'متابعة واستخدام النقاط' : 'Done & Use Points'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-rose-400 font-bold">{claimError}</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full min-h-[40px] rounded-xl bg-white/10 text-white text-xs font-semibold"
                  >
                    {lang === 'ar' ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-300 font-medium">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>
                  {lang === 'ar'
                    ? `شاهد الإعلان حتى النهاية لكسب ${rewardPoints} نقطة مجاناً`
                    : `Watch until the end to claim ${rewardPoints} free points`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {lang === 'ar'
                  ? `ستفتح المكافأة خلال ${timeLeft} ثوانٍ...`
                  : `Reward unlocks in ${timeLeft}s...`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
