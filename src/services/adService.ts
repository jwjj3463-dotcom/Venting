/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { realmDB, RealmUser } from '../db/realmLocalDB';
import { fadfadahClient } from './fadfadahNetworkClient';

export interface AdConfig {
  enabled: boolean;
  banner_enabled: boolean;
  interstitial_enabled: boolean;
  rewarded_enabled: boolean;
  test_mode: boolean;
  ad_provider: 'adsense' | 'monetag' | 'custom' | 'admob';
  adsense_publisher_id: string;
  adsense_banner_slot_id: string;
  monetag_zone_id: string;
  custom_banner_code: string;
  rewarded_sponsor_url: string;
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
  rewarded_enabled: true,
  test_mode: true,
  ad_provider: 'adsense',
  adsense_publisher_id: '',
  adsense_banner_slot_id: '',
  monetag_zone_id: '',
  custom_banner_code: '',
  rewarded_sponsor_url: 'https://adsense.google.com',
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
        const data = await res.json();
        this.config = { ...this.config, ...data };
        this.notify();
      }
    } catch {
      // Use cached/default config
    }
    return this.config;
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
    if (user.is_premium || (user.premium_plan && user.premium_plan !== 'free')) {
      return false;
    }
    return true;
  }

  shouldShowBanner(user?: RealmUser | null): boolean {
    return this.shouldShowAds(user) && this.config.banner_enabled;
  }

  shouldShowRewarded(user?: RealmUser | null): boolean {
    return this.config.enabled && this.config.rewarded_enabled;
  }

  canShowInterstitial(user?: RealmUser | null): boolean {
    if (!this.shouldShowAds(user)) return false;
    if (!this.config.interstitial_enabled) return false;
    const now = Date.now();
    const cooldownMs = (this.config.interstitial_cooldown_seconds || 90) * 1000;
    return now - this.lastInterstitialTime >= cooldownMs;
  }

  recordInterstitialShown(): void {
    this.lastInterstitialTime = Date.now();
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
    const data = await res.json();
    this.config = { ...this.config, ...data.config };
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
      const data = await res.json();
      this.config = { ...this.config, ...data.config };
      this.notify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }
}

export const adService = new AdService();
