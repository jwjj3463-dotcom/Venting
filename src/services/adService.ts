/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isRealmPremiumActive, realmDB, RealmUser } from '../db/realmLocalDB';
import { fadfadahClient } from './fadfadahNetworkClient';
import { Capacitor } from '@capacitor/core';
import { showAdMobInterstitial } from './nativeAdMob';

export interface AdConfig {
  enabled: boolean;
  banner_enabled: boolean;
  interstitial_enabled: boolean;
  rewarded_enabled: boolean;
  test_mode: boolean;
  admob_app_id: string;
  admob_banner_id: string;
  admob_interstitial_id: string;
  admob_rewarded_id: string;
  reward_points_amount: number;
  interstitial_cooldown_seconds: number;
}

export const DEFAULT_AD_CONFIG: AdConfig = {
  enabled: true,
  banner_enabled: true,
  interstitial_enabled: true,
  rewarded_enabled: false,
  test_mode: true,
  admob_app_id: 'ca-app-pub-3940256099942544~3347511713',
  admob_banner_id: 'ca-app-pub-3940256099942544/6300978111',
  admob_interstitial_id: 'ca-app-pub-3940256099942544/1033173712',
  admob_rewarded_id: 'ca-app-pub-3940256099942544/5224354917',
  reward_points_amount: 25,
  interstitial_cooldown_seconds: 90,
};

class AdService {
  private config: AdConfig = { ...DEFAULT_AD_CONFIG };
  private lastInterstitialTime = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.refreshConfig();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l();
      } catch (err) {
        console.error('AdService listener error:', err);
      }
    }
  }

  async refreshConfig(): Promise<AdConfig> {
    try {
      const serverUrl = fadfadahClient.getServerBaseUrl();
      const res = await fetch(`${serverUrl}/api/ads/config`);
      if (res.ok) {
        const data = (await res.json()) as Partial<AdConfig>;
        this.config = this.mergeConfig(data);
        this.notify();
      }
    } catch {
      // Use cached/default config
    }
    return this.config;
  }

  private mergeConfig(data: Partial<AdConfig>): AdConfig {
    return {
      enabled: data.enabled ?? this.config.enabled,
      banner_enabled: data.banner_enabled ?? this.config.banner_enabled,
      interstitial_enabled: data.interstitial_enabled ?? this.config.interstitial_enabled,
      rewarded_enabled: data.rewarded_enabled ?? this.config.rewarded_enabled,
      test_mode: data.test_mode ?? this.config.test_mode,
      admob_app_id: data.admob_app_id ?? this.config.admob_app_id,
      admob_banner_id: data.admob_banner_id ?? this.config.admob_banner_id,
      admob_interstitial_id:
        data.admob_interstitial_id ?? this.config.admob_interstitial_id,
      admob_rewarded_id: data.admob_rewarded_id ?? this.config.admob_rewarded_id,
      reward_points_amount: data.reward_points_amount ?? this.config.reward_points_amount,
      interstitial_cooldown_seconds:
        data.interstitial_cooldown_seconds ?? this.config.interstitial_cooldown_seconds,
    };
  }

  getConfig(): AdConfig {
    return { ...this.config };
  }

  /**
   * Core rule: VIP & Premium Subscribers NEVER see any ads.
   */
  shouldShowAds(user?: RealmUser | null): boolean {
    if (!this.config.enabled) return false;
    if (!user) return true;
    if (isRealmPremiumActive(user)) {
      return false;
    }
    return true;
  }

  shouldShowBanner(user?: RealmUser | null): boolean {
    return this.shouldShowAds(user) && this.config.banner_enabled;
  }

  shouldShowRewarded(user?: RealmUser | null): boolean {
    return false;
  }

  canShowInterstitial(user?: RealmUser | null): boolean {
    if (!this.shouldShowAds(user)) return false;
    if (!Capacitor.isNativePlatform()) return false;
    if (!this.config.interstitial_enabled) return false;
    const now = Date.now();
    const cooldownMs = (this.config.interstitial_cooldown_seconds || 90) * 1000;
    return now - this.lastInterstitialTime >= cooldownMs;
  }

  recordInterstitialShown(): void {
    this.lastInterstitialTime = Date.now();
  }

  async showInterstitial(): Promise<void> {
    if (
      !this.config.enabled ||
      !this.config.interstitial_enabled ||
      !this.config.admob_interstitial_id?.trim()
    ) {
      return;
    }
    if (!Capacitor.isNativePlatform()) return;
    await showAdMobInterstitial(
      this.config.admob_interstitial_id,
      this.config.test_mode
    );
  }

  /**
   * Watch Rewarded Ad -> Calls server API to verify and credit points securely
   */
  async claimRewardedAdReward(): Promise<{
    ok: boolean;
    pointsAwarded?: number;
    error?: string;
  }> {
    try {
      const serverUrl = fadfadahClient.getServerBaseUrl();
      const token = realmDB.getSettings().auth_token;
      if (!token) return { ok: false, error: 'NO_AUTH_TOKEN' };

      const res = await fetch(`${serverUrl}/api/ads/reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.message || data.error || 'Failed to claim reward' };
      }

      // Update local realm database with fresh user points & record transaction
      await realmDB.write((tx) => {
        if (data.selfUser) {
          tx.create('users', data.selfUser);
        }
        if (data.transaction) {
          tx.create('payment_transactions', data.transaction);
        }
      });

      return {
        ok: true,
        pointsAwarded: data.pointsAwarded ?? this.config.reward_points_amount,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  async getAdminConfig(): Promise<AdConfig> {
    const serverUrl = fadfadahClient.getServerBaseUrl();
    const token = realmDB.getSettings().auth_token;
    const res = await fetch(`${serverUrl}/api/admin/ads/config`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('FORBIDDEN');
    const data = (await res.json()) as { config: Partial<AdConfig> };
    this.config = this.mergeConfig(data.config);
    this.notify();
    return this.config;
  }

  async updateAdminConfig(updated: Partial<AdConfig>): Promise<{ ok: boolean; error?: string }> {
    try {
      const serverUrl = fadfadahClient.getServerBaseUrl();
      const token = realmDB.getSettings().auth_token;
      const res = await fetch(`${serverUrl}/api/admin/ads/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updated),
      });
      if (!res.ok) {
        const errData = await res.json();
        return { ok: false, error: errData.error || 'Update failed' };
      }
      const data = (await res.json()) as { config: Partial<AdConfig> };
      this.config = this.mergeConfig(data.config);
      this.notify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }
}

export const adService = new AdService();
