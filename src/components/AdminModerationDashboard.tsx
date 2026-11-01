import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  BarChart3,
  Users,
  FileText,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  ArrowRight,
  ArrowLeft,
  Crown,
  History,
  Megaphone,
  Play,
  Gift,
  Sparkles,
  DollarSign,
  Globe,
  ExternalLink,
  Layers,
} from 'lucide-react';
import {
  AdminStatsDTO,
  fadfadahClient,
} from '../services/fadfadahNetworkClient';
import {
  RealmPaymentTransaction,
  RealmReportModeration,
  RealmUser,
} from '../db/realmLocalDB';
import { FramedAvatar, OfficialBadge } from './FramedAvatar';
import { AppLang, TRANSLATIONS } from '../i18n/translations';
import { adService, AdConfig, DEFAULT_AD_CONFIG } from '../services/adService';
import { AdBanner } from './AdBanner';
import { AdInterstitialModal } from './AdInterstitialModal';

interface AdminModerationDashboardProps {
  selfUser: RealmUser;
  lang: AppLang;
  onBack: () => void;
}

type AdminTab = 'overview' | 'reports' | 'audit_logs' | 'users' | 'ledger' | 'ads';

export const AdminModerationDashboard: React.FC<AdminModerationDashboardProps> = ({
  selfUser,
  lang,
  onBack,
}) => {
  const t = TRANSLATIONS[lang];
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  // Overview Stats
  const [stats, setStats] = useState<AdminStatsDTO | null>(null);

  // Reports
  const [reports, setReports] = useState<RealmReportModeration[]>([]);
  const [reportFilter, setReportFilter] = useState<'ALL' | 'PENDING' | 'ACTION_TAKEN' | 'DISMISSED'>('PENDING');
  const [selectedReport, setSelectedReport] = useState<RealmReportModeration | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [suspensionHours, setSuspensionHours] = useState<number>(24);
  const [executingAction, setExecutingAction] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Users Management
  const [userQuery, setUserQuery] = useState('');
  const [usersList, setUsersList] = useState<any[]>([]);

  // Financial Ledger
  const [transactions, setTransactions] = useState<RealmPaymentTransaction[]>([]);

  // Ads & AdMob Management
  const [adConfig, setAdConfig] = useState<AdConfig>(() => adService.getConfig());
  const [savingAds, setSavingAds] = useState(false);
  const [testInterstitialOpen, setTestInterstitialOpen] = useState(false);

  const loadCurrentData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      if (activeTab === 'overview') {
        const s = await fadfadahClient.getAdminStats();
        setStats(s);
      } else if (activeTab === 'reports') {
        const reps = await fadfadahClient.getAdminReports();
        setReports(reps);
        if (selectedReport) {
          const fresh = reps.find((r) => r.id === selectedReport.id);
          if (fresh) setSelectedReport(fresh);
        }
      } else if (activeTab === 'audit_logs') {
        const logs = await fadfadahClient.getAdminAuditLogs();
        setAuditLogs(logs);
      } else if (activeTab === 'users') {
        const u = await fadfadahClient.getAdminUsers(userQuery);
        setUsersList(u);
      } else if (activeTab === 'ledger') {
        const txs = await fadfadahClient.getAdminPayments();
        setTransactions(txs);
      } else if (activeTab === 'ads') {
        const cfg = await adService.getAdminConfig();
        setAdConfig(cfg);
      }
    } catch {
      setErrorMessage(
        lang === 'ar'
          ? 'تم رفض الوصول: هذه اللوحة مقتصرة حصرياً على المالك والمشرفين المصرح لهم.'
          : 'Access denied: Staff and Admin only.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAds(true);
    setErrorMessage('');
    const res = await adService.updateAdminConfig(adConfig);
    setSavingAds(false);
    if (!res.ok) {
      setErrorMessage(res.error || 'فشل حفظ إعدادات الإعلانات.');
      return;
    }
    setActionNotice(
      lang === 'ar'
        ? 'تم حفظ وتفعيل إعدادات الإعلانات وAdMob بنجاح على السيرفر!'
        : 'Ad settings updated and active!'
    );
  };

  useEffect(() => {
    loadCurrentData();
  }, [activeTab]);

  const handleTakeAction = async (action: 'WARN' | 'RESTRICT' | 'SUSPEND' | 'BAN' | 'RESOLVE' | 'DISMISS') => {
    if (!selectedReport) return;
    setExecutingAction(true);
    setActionNotice('');
    const res = await fadfadahClient.takeModerationAction(selectedReport.id, {
      action,
      reason: actionReason.trim() || undefined,
      duration_hours: action === 'SUSPEND' ? suspensionHours : undefined,
      note: actionReason.trim() || undefined,
    });
    setExecutingAction(false);
    if (!res.ok) {
      setErrorMessage(res.error || 'فشل تطبيق الإجراء.');
      return;
    }
    setActionNotice(
      lang === 'ar'
        ? `تم تنفيذ الإجراء (${action}) وتوثيقه في سجل الإشراف ومزامنة حالة الحساب.`
        : `Action (${action}) applied and logged successfully.`
    );
    setActionReason('');
    await loadCurrentData();
  };

  const handleDirectUserStatus = async (
    userId: string,
    action: 'ACTIVATE' | 'WARN' | 'RESTRICT' | 'SUSPEND' | 'BAN',
    role?: 'owner' | 'moderator' | 'user'
  ) => {
    setLoading(true);
    await fadfadahClient.updateAdminUserStatus(userId, {
      action,
      role,
      reason: 'تحديث حالة الحساب المباشر من لوحة الإدارة',
    });
    await loadCurrentData();
    setActionNotice(lang === 'ar' ? 'تم تحديث الحساب بنجاح.' : 'User status updated.');
  };

  const filteredReports = reports.filter((r) => {
    if (reportFilter === 'ALL') return true;
    return r.status === reportFilter;
  });

  const parseEvidence = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  };

  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA] dark:bg-[#151221] text-slate-900 dark:text-slate-100">
      {/* Top Bar */}
      <header className="px-4 py-3 bg-[#2D1B69] text-white flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="min-h-[44px] min-w-[44px] -mx-2 rounded-full flex items-center justify-center active:bg-white/15"
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-300" />
              <h1 className="text-base font-bold">{t.adminPanelTitle}</h1>
            </div>
            <p className="text-[11px] text-purple-200">
              {lang === 'ar'
                ? `المسؤول: ${selfUser.nickname} (${selfUser.role === 'owner' ? t.roleOwner : t.roleModerator})`
                : `Staff: ${selfUser.nickname} (${selfUser.role})`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadCurrentData}
          disabled={loading}
          className="min-h-[44px] min-w-[44px] rounded-full active:bg-white/15 flex items-center justify-center text-purple-200"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Sub Tabs */}
      <div className="bg-white dark:bg-[#1E1B2E] border-b border-slate-200 dark:border-white/10 px-3 flex items-center gap-1.5 overflow-x-auto shrink-0">
        {[
          { id: 'reports' as AdminTab, label: t.reportsTab, icon: ShieldAlert },
          { id: 'overview' as AdminTab, label: lang === 'ar' ? 'الإحصائيات' : 'Overview', icon: BarChart3 },
          { id: 'audit_logs' as AdminTab, label: t.auditLogsTab, icon: History },
          { id: 'users' as AdminTab, label: t.usersTab, icon: Users },
          { id: 'ledger' as AdminTab, label: t.paymentsLedgerTab, icon: CreditCard },
          { id: 'ads' as AdminTab, label: lang === 'ar' ? 'الإعلانات وAdMob' : 'Ads & AdMob', icon: Megaphone },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedReport(null);
              }}
              className={`min-h-[48px] px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-[#8B5CF6] text-[#8B5CF6]'
                  : 'border-transparent text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback Messages */}
      {actionNotice && (
        <div className="m-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <span>{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice('')} className="p-1 font-bold">
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="m-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. REPORTS MANAGEMENT CENTER */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'PENDING', label: lang === 'ar' ? 'قيد المراجعة' : 'Pending' },
                { id: 'ALL', label: lang === 'ar' ? 'كافة البلاغات' : 'All Reports' },
                { id: 'ACTION_TAKEN', label: lang === 'ar' ? 'تم اتخاذ إجراء' : 'Action Taken' },
                { id: 'DISMISSED', label: lang === 'ar' ? 'مرفوضة' : 'Dismissed' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setReportFilter(pill.id as typeof reportFilter)}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                    reportFilter === pill.id
                      ? 'bg-[#2D1B69] text-white'
                      : 'bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {pill.label} ({reports.filter((r) => pill.id === 'ALL' || r.status === pill.id).length})
                </button>
              ))}
            </div>

            {filteredReports.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-8 text-center text-xs text-slate-500">
                {lang === 'ar' ? 'لا توجد بلاغات تطابق هذا الفلتر حالياً.' : 'No reports in this view.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Reports List */}
                <div className={`${selectedReport ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-2.5`}>
                  {filteredReports.map((rep) => {
                    const isSelected = selectedReport?.id === rep.id;
                    return (
                      <div
                        key={rep.id}
                        onClick={() => setSelectedReport(rep)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E1B2E] active:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rep.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : rep.status === 'ACTION_TAKEN'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                            }`}
                          >
                            {rep.status === 'PENDING'
                              ? 'قيد المراجعة'
                              : rep.status === 'ACTION_TAKEN'
                              ? `تم الإجراء (${rep.action_taken || 'إشرافي'})`
                              : 'مرفوض'}
                          </span>
                          <span className="text-[11px] font-mono-num text-slate-400">
                            {new Date(rep.created_at).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {rep.reported_user_nickname}
                        </p>
                        <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                          {rep.reason}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                          {lang === 'ar' ? `المُبلّغ: ${rep.reporter_nickname}` : `Reporter: ${rep.reporter_nickname}`}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Report Details & Evidence & Action Panel */}
                {selectedReport && (
                  <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {lang === 'ar' ? 'تفاصيل البلاغ والأدلة' : 'Report & Evidence Details'}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono-num">ID: {selectedReport.id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedReport(null)}
                        className="lg:hidden p-2 text-xs font-semibold text-slate-500"
                      >
                        {lang === 'ar' ? 'إغلاق' : 'Close'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-[#151221] p-3 rounded-2xl">
                      <div>
                        <span className="text-slate-400 block">{lang === 'ar' ? 'الحساب المُبلّغ عنه:' : 'Reported User:'}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{selectedReport.reported_user_nickname}</span>
                        <span className="block text-[10px] text-slate-400 font-mono-num">{selectedReport.reported_user_id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{lang === 'ar' ? 'المُبلّغ:' : 'Reporter:'}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{selectedReport.reporter_nickname}</span>
                        <span className="block text-[10px] text-slate-400 font-mono-num">{selectedReport.reporter_id}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === 'ar' ? 'سبب البلاغ والملاحظات:' : 'Reason & Notes:'}</span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#151221] p-3 rounded-2xl leading-relaxed">
                        <strong className="text-rose-600 block mb-1">{selectedReport.reason}</strong>
                        {selectedReport.details || (lang === 'ar' ? 'لا توجد تفاصيل إضافية من المستخدم.' : 'No extra details.')}
                      </p>
                    </div>

                    {/* AI Safety Summary */}
                    {selectedReport.ai_summary && (
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-[#8B5CF6]">{lang === 'ar' ? 'الملخص الذكي للبلاغ والأدلة:' : 'AI Summary:'}</span>
                        <p className="text-xs text-slate-700 dark:text-slate-300 bg-purple-50 dark:bg-purple-950/30 p-3 rounded-2xl border border-purple-200/50 dark:border-purple-800/30 leading-relaxed">
                          {selectedReport.ai_summary}
                        </p>
                      </div>
                    )}

                    {/* Evidence Snapshot (Messages / Vent content logged at report time) */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === 'ar' ? 'الأدلة الموثقة (سجل المحادثة):' : 'Documented Evidence Log:'}
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-2 p-3 rounded-2xl bg-slate-100 dark:bg-[#151221] border border-slate-200/80 dark:border-white/5">
                        {parseEvidence(selectedReport.evidence_snapshot).length === 0 ? (
                          <p className="text-xs text-slate-400">{lang === 'ar' ? 'لا يوجد سجل رسائل محفوظ في هذا البلاغ.' : 'No message log.'}</p>
                        ) : (
                          parseEvidence(selectedReport.evidence_snapshot).map((item: any, idx: number) => (
                            <div key={idx} className="text-xs bg-white dark:bg-[#1E1B2E] p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{item.sender}: </span>
                              <span className="text-slate-700 dark:text-slate-300">{item.content}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Resolution status info */}
                    {selectedReport.status !== 'PENDING' && (
                      <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#151221] text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <p>
                          <strong>{lang === 'ar' ? 'المشرف المسؤول:' : 'Moderator:'}</strong> {selectedReport.resolved_by_name || 'طاقم الإشراف'}
                        </p>
                        {selectedReport.resolution_note && (
                          <p>
                            <strong>{lang === 'ar' ? 'قرار الإشراف:' : 'Decision Note:'}</strong> {selectedReport.resolution_note}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Moderator Action Buttons Form */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-3">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === 'ar' ? 'اتخاذ قرار إشرافي رسمي:' : 'Moderation Action:'}
                      </label>
                      <input
                        type="text"
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        placeholder={lang === 'ar' ? 'اكتب سبب العقوبة أو ملخص القرار...' : 'Action reason or decision notes...'}
                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                      />

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{lang === 'ar' ? 'مدة التعليق المؤقت:' : 'Suspend hours:'}</span>
                        <select
                          value={suspensionHours}
                          onChange={(e) => setSuspensionHours(Number(e.target.value))}
                          className="h-9 px-2 rounded-lg bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs"
                        >
                          <option value={24}>24 ساعة (يوم)</option>
                          <option value={72}>72 ساعة (3 أيام)</option>
                          <option value={168}>168 ساعة (أسبوع)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        <button
                          type="button"
                          disabled={executingAction}
                          onClick={() => handleTakeAction('WARN')}
                          className="min-h-[42px] px-3 rounded-xl bg-amber-500 active:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{t.actionWarn}</span>
                        </button>

                        <button
                          type="button"
                          disabled={executingAction}
                          onClick={() => handleTakeAction('RESTRICT')}
                          className="min-h-[42px] px-3 rounded-xl bg-orange-600 active:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{t.actionRestrict}</span>
                        </button>

                        <button
                          type="button"
                          disabled={executingAction}
                          onClick={() => handleTakeAction('SUSPEND')}
                          className="min-h-[42px] px-3 rounded-xl bg-purple-700 active:bg-purple-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{t.actionSuspend}</span>
                        </button>

                        <button
                          type="button"
                          disabled={executingAction}
                          onClick={() => handleTakeAction('BAN')}
                          className="min-h-[42px] px-3 rounded-xl bg-rose-600 active:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{t.actionBan}</span>
                        </button>

                        <button
                          type="button"
                          disabled={executingAction}
                          onClick={() => handleTakeAction('RESOLVE')}
                          className="min-h-[42px] px-3 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t.actionResolve}</span>
                        </button>

                        <button
                          type="button"
                          disabled={executingAction}
                          onClick={() => handleTakeAction('DISMISS')}
                          className="min-h-[42px] px-3 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <span>{t.actionDismiss}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. OVERVIEW & ANALYTICS */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { title: lang === 'ar' ? 'المستخدمون المسجلون' : 'Total Users', val: stats.totalUsers },
                { title: lang === 'ar' ? 'المتصلون بالسيرفر' : 'Online Now', val: stats.onlineUsers, color: 'text-emerald-500' },
                { title: lang === 'ar' ? 'غرف المحادثة' : 'Chat Rooms', val: stats.activeChatRooms },
                { title: lang === 'ar' ? 'الرسائل المرسلة' : 'Messages Sent', val: stats.totalMessages },
                { title: lang === 'ar' ? 'بلاغات قيد المراجعة' : 'Pending Reports', val: stats.pendingReports, color: 'text-amber-500' },
                { title: lang === 'ar' ? 'بلاغات تم التعامل معها' : 'Resolved Reports', val: stats.resolvedReports, color: 'text-emerald-500' },
                { title: lang === 'ar' ? 'الحسابات المحظورة' : 'Banned Users', val: stats.bannedUsers, color: 'text-rose-500' },
                { title: lang === 'ar' ? 'الحسابات المقيدة/المعلقة' : 'Restricted/Suspended', val: stats.restrictedUsers + stats.suspendedUsers },
                { title: lang === 'ar' ? 'المشتركون المميزون' : 'VIP Subscribers', val: stats.premiumUsers, color: 'text-amber-400' },
                { title: lang === 'ar' ? 'إجمالي المدفوعات' : 'Total Revenue', val: `$${stats.totalRevenueUsd}`, color: 'text-[#8B5CF6]' },
                { title: lang === 'ar' ? 'عمليات الدفع المؤكدة' : 'Completed Transactions', val: stats.totalTransactions },
                { title: lang === 'ar' ? 'الفضفضات العامة' : 'Public Vents', val: stats.totalVents },
              ].map((card, i) => (
                <div key={i} className="rounded-2xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-4 space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{card.title}</p>
                  <p className={`text-xl font-bold font-mono-num ${card.color || 'text-slate-900 dark:text-white'}`}>
                    {card.val}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. MODERATION AUDIT LOGS */}
        {activeTab === 'audit_logs' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white px-1">
              {lang === 'ar' ? 'سجل جميع قرارات المشرفين والمالك المؤرخة' : 'Official Staff Moderation Audit Trail'}
            </h3>

            {auditLogs.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-8 text-center text-xs text-slate-500">
                {lang === 'ar' ? 'لا توجد إجراءات إشرافية مسجلة بعد.' : 'No audit entries yet.'}
              </div>
            ) : (
              <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="p-4 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#8B5CF6]">
                        {log.moderator_name} ({log.moderator_role === 'owner' ? t.roleOwner : t.roleModerator})
                      </span>
                      <span className="text-slate-400 font-mono-num">
                        {new Date(log.created_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-bold">
                        {log.action_type}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {lang === 'ar' ? `المستهدف: ${log.target_user_nickname}` : `Target: ${log.target_user_nickname}`}
                      </span>
                      {log.duration_hours && (
                        <span className="text-amber-500 font-mono-num">({log.duration_hours}h)</span>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      <strong>{lang === 'ar' ? 'السبب:' : 'Reason:'}</strong> {log.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. USERS & ROLES MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder={lang === 'ar' ? 'البحث بالاسم المستعار أو المعرّف...' : 'Search users...'}
                  className="w-full h-11 pr-10 pl-3.5 rounded-xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={loadCurrentData}
                className="min-h-[44px] px-4 rounded-xl bg-[#8B5CF6] text-white text-xs font-bold"
              >
                {lang === 'ar' ? 'بحث' : 'Search'}
              </button>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
              {usersList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {lang === 'ar' ? 'لا يوجد مستخدمون مطابقون.' : 'No users found.'}
                </div>
              ) : (
                usersList.map((u) => (
                  <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <FramedAvatar avatarUrl={u.avatar_url} frameId={0} nickname={u.nickname} size="sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{u.nickname}</span>
                          <OfficialBadge role={u.role} />
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8B5CF6]/15 text-[#8B5CF6]">
                            {u.role === 'owner' ? t.roleOwner : u.role === 'moderator' ? t.roleModerator : t.roleUser}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.status === 'banned'
                                ? 'bg-rose-500 text-white'
                                : u.status === 'suspended'
                                ? 'bg-purple-600 text-white'
                                : u.status === 'restricted'
                                ? 'bg-orange-500 text-white'
                                : u.status === 'warned'
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-500 text-white'
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono-num mt-0.5">
                          {u.country} · {u.points} {lang === 'ar' ? 'نقطة' : 'pts'} · {u.is_premium ? 'VIP' : 'Free'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {u.status !== 'active' && (
                        <button
                          type="button"
                          onClick={() => handleDirectUserStatus(u.id, 'ACTIVATE')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                        >
                          {t.actionUnban}
                        </button>
                      )}
                      {u.status === 'active' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDirectUserStatus(u.id, 'WARN')}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold"
                          >
                            {t.actionWarn}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDirectUserStatus(u.id, 'RESTRICT')}
                            className="px-2.5 py-1.5 rounded-lg bg-orange-600 text-white text-[11px] font-bold"
                          >
                            {t.actionRestrict}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDirectUserStatus(u.id, 'BAN')}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold"
                          >
                            {t.actionBan}
                          </button>
                        </>
                      )}
                      {selfUser.role === 'owner' && u.id !== selfUser.id && (
                        u.role === 'moderator' ? (
                          <button
                            type="button"
                            onClick={() => handleDirectUserStatus(u.id, 'ACTIVATE', 'user')}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[11px] font-semibold"
                          >
                            {lang === 'ar' ? 'إلغاء الإشراف' : 'Demote'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDirectUserStatus(u.id, 'ACTIVATE', 'moderator')}
                            className="px-2.5 py-1.5 rounded-lg bg-[#2D1B69] text-white text-[11px] font-bold"
                          >
                            {lang === 'ar' ? 'تعيين كمشرف' : 'Make Moderator'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 5. FINANCIAL & TRANSACTIONS LEDGER */}
        {activeTab === 'ledger' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white px-1">
              {lang === 'ar' ? 'سجل العمليات والاشتراكات المؤكدة بالسيرفر' : 'Platform Financial Ledger'}
            </h3>

            {transactions.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-8 text-center text-xs text-slate-500">
                {lang === 'ar' ? 'لا توجد معاملات بعد.' : 'No transactions recorded.'}
              </div>
            ) : (
              <div className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
                {transactions.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{tx.item_title}</p>
                      <p className="text-slate-500 font-mono-num text-[11px] mt-0.5">
                        {tx.user_nickname} · Order: {tx.order_id}
                      </p>
                      <p className="text-slate-400 font-mono-num text-[10px]">
                        {new Date(tx.created_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                      </p>
                    </div>

                    <div className="text-end">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono-num text-sm">
                        {tx.amount_usd > 0 ? `$${tx.amount_usd}` : `${tx.points_delta} pts`}
                      </p>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {t.verifiedPaymentNotice}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. ADS & REAL MONETIZATION MANAGEMENT */}
        {activeTab === 'ads' && (
          <div className="space-y-5 max-w-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>{lang === 'ar' ? 'إدارة الإعلانات والأرباح الحقيقية' : 'Real In-App Monetization & Ads'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'ar'
                    ? 'اربط تطبيقك بشبكات إعلانية رسمية ومجانية (Google AdSense أو Monetag أو AdMob) لتحقيق أرباح حقيقية من الزوار.'
                    : 'Connect your app to official free ad networks (Google AdSense, Monetag, or AdMob) to generate real revenue.'}
                </p>
              </div>

              {adConfig.test_mode ? (
                <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-mono-num shrink-0">
                  {lang === 'ar' ? 'وضع الاختبار مفعل' : 'Test Mode Active'}
                </span>
              ) : (
                <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 font-mono-num shrink-0 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {lang === 'ar' ? 'الإعلانات الحية مفعلة' : 'Live Ads Active'}
                </span>
              )}
            </div>

            {/* Quick Live Testing Sandbox */}
            <div className="rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-slate-900/40 border border-purple-500/30 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h4 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'أدوات التجربة والاختبار الفوري' : 'Live Ad Testing Sandbox'}
                </h4>
              </div>
              <p className="text-xs text-purple-200/80">
                {lang === 'ar'
                  ? 'يمكنك تجربة ظهور الإعلانات بنفس الشكل الذي يراه المستخدم العادي قبل نشر التطبيق في المتجر:'
                  : 'Preview banners and test interstitial ads before release:'}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setTestInterstitialOpen(true)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-transform"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تجربة الإعلان البيني (Interstitial)' : 'Test Interstitial Ad'}</span>
                </button>
              </div>

              {/* Banner Live Preview */}
              <div className="pt-2">
                <p className="text-[11px] font-bold text-purple-200 mb-1.5">
                  {lang === 'ar' ? 'معاينة البانر الإعلاني المباشر داخل التطبيق:' : 'Live Banner Preview:'}
                </p>
                <AdBanner selfUser={null} lang={lang} position="inline" />
              </div>
            </div>

            {/* Step-by-Step Educational Guide for Real Revenue */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-3xl bg-blue-950/30 border border-blue-500/25 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-400" />
                    1. Google AdSense (شبكة جوجل الرسمية)
                  </span>
                  <a
                    href="https://adsense.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>التسجيل مجاناً</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  الشبكة الأكثر موثوقية في العالم للمواقع وتطبيقات الويب وPWA. التسجيل مجاني 100%، وترسل لك جوجل أرباحك شهرياً عبر التحويل البنكي. انسخ معرّف الناشر <code className="text-amber-300 bg-black/40 px-1 rounded font-mono">ca-pub-XXXXXXXXXXXX</code> وضعه بالأسفل.
                </p>
              </div>

              <div className="p-4 rounded-3xl bg-emerald-950/30 border border-emerald-500/25 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    2. Monetag أو Adsterra (قبول فوري ومجاني)
                  </span>
                  <a
                    href="https://monetag.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>فتح حساب فوري</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  أفضل خيار للمواقع والتطبيقات الجديدة، القبول فوري 100% بدون مراجعة دومين، يعطيك شفرة إعلان مباشرة تنسخها وتلصقها هنا لتبدأ الإعلانات الحقيقية بالظهور على الفور، والدفع عبر PayPal أو البنك أو USDT.
                </p>
              </div>
            </div>

            {/* Ads Configuration Form */}
            <form
              onSubmit={handleSaveAdsConfig}
              className="rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-5"
            >
              {/* Ad Provider Choice */}
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white mb-2">
                  {lang === 'ar' ? 'اختر شبكة الإعلانات الأساسية للتطبيق:' : 'Select Primary Ad Network:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'adsense', label: 'Google AdSense (جوجل)' },
                    { id: 'monetag', label: 'Monetag (قبول فوري)' },
                    { id: 'custom', label: 'كود إعلاني مخصص' },
                    { id: 'admob', label: 'Google AdMob (أندرويد)' },
                  ].map((prov) => {
                    const isSelected = (adConfig.ad_provider || 'adsense') === prov.id;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => setAdConfig({ ...adConfig, ad_provider: prov.id as any })}
                        className={`p-3 rounded-2xl text-xs font-bold border transition-all text-center ${
                          isSelected
                            ? 'bg-[#8B5CF6]/15 border-[#8B5CF6] text-[#8B5CF6]'
                            : 'bg-slate-50 dark:bg-[#151221] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        {prov.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Network Specific Settings */}
              {adConfig.ad_provider === 'adsense' && (
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Google AdSense Publisher ID (معرّف الناشر الرسمي في جوجل)
                    </label>
                    <input
                      type="text"
                      value={adConfig.adsense_publisher_id || ''}
                      onChange={(e) => setAdConfig({ ...adConfig, adsense_publisher_id: e.target.value })}
                      placeholder="ca-pub-1234567890123456"
                      dir="ltr"
                      className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-mono-num text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-500">
                      ستجده في لوحة تحكم AdSense تحت الحساب {'>'} الإعدادات {'>'} معلومات الحساب.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      AdSense Banner Slot ID (معرّف الوحدة الإعلانية - اختياري)
                    </label>
                    <input
                      type="text"
                      value={adConfig.adsense_banner_slot_id || ''}
                      onChange={(e) => setAdConfig({ ...adConfig, adsense_banner_slot_id: e.target.value })}
                      placeholder="9876543210"
                      dir="ltr"
                      className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-mono-num text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {(adConfig.ad_provider === 'monetag' || adConfig.ad_provider === 'custom') && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      كود أو شفرة الإعلان المباشرة (HTML / Script / Iframe Ad Tag)
                    </label>
                    <textarea
                      rows={4}
                      value={adConfig.custom_banner_code || ''}
                      onChange={(e) => setAdConfig({ ...adConfig, custom_banner_code: e.target.value })}
                      placeholder={`<script type="text/javascript"> ... </script> أو كود البانر من Monetag / Adsterra`}
                      dir="ltr"
                      className="w-full p-3 rounded-xl bg-white dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-500">
                      انسخ كود البانر من شبكتك الإعلانية والصقه هنا، وسيتم تضمينه وتشغيله بأمان داخل مساحات البانر.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      رابط العرض المباشر أو SmartLink لإعلانات المكافأة
                    </label>
                    <input
                      type="url"
                      value={adConfig.rewarded_sponsor_url || ''}
                      onChange={(e) => setAdConfig({ ...adConfig, rewarded_sponsor_url: e.target.value })}
                      placeholder="https://..."
                      dir="ltr"
                      className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Toggles */}
              <h4 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-white/10">
                {lang === 'ar' ? 'مفاتيح التفعيل والتعطيل' : 'Feature Toggles'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {lang === 'ar' ? 'تفعيل الإعلانات بالكامل' : 'Master Ads Switch'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {lang === 'ar' ? 'إظهار أو إخفاء كل إعلانات التطبيق' : 'Global toggle for all in-app ads'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={adConfig.enabled}
                    onChange={(e) => setAdConfig({ ...adConfig, enabled: e.target.checked })}
                    className="w-5 h-5 accent-[#8B5CF6] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {lang === 'ar' ? 'وضع الاختبار التجريبي (Test Mode)' : 'Ad Test Mode'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {lang === 'ar' ? 'استخدمه لتجربة الإعلانات قبل إطلاق البث المباشر' : 'Use test slots before live'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={adConfig.test_mode}
                    onChange={(e) => setAdConfig({ ...adConfig, test_mode: e.target.checked })}
                    className="w-5 h-5 accent-[#8B5CF6] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {lang === 'ar' ? 'الإعلانات الشريطية (Banner)' : 'Banner Ads'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {lang === 'ar' ? 'تظهر أسفل المحادثات وجدار الفضفضة' : 'Bottom and in-feed banner units'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={adConfig.banner_enabled}
                    onChange={(e) => setAdConfig({ ...adConfig, banner_enabled: e.target.checked })}
                    className="w-5 h-5 accent-[#8B5CF6] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {lang === 'ar' ? 'إعلانات الفيديو بمكافأة (متوقفة)' : 'Rewarded Video Ads (disabled)'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {lang === 'ar' ? 'تتطلب التحقق الآمن من AdMob قبل منح النقاط' : 'Requires secure AdMob verification before points can be awarded'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    className="w-5 h-5 accent-[#8B5CF6] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 cursor-pointer sm:col-span-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {lang === 'ar' ? 'الإعلانات البينية (Interstitial)' : 'Interstitial Ads'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {lang === 'ar' ? 'تظهر بفاصل زمني محدد بين الشاشات' : 'Full screen ads between transitions'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={adConfig.interstitial_enabled}
                    onChange={(e) => setAdConfig({ ...adConfig, interstitial_enabled: e.target.checked })}
                    className="w-5 h-5 accent-[#8B5CF6] rounded"
                  />
                </label>
              </div>

              {/* Google AdMob Unit IDs (for Android Native APK Packaging) */}
              <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2 pb-2 border-b border-slate-100 dark:border-white/10 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>{lang === 'ar' ? 'وحدات إعلانات Google AdMob' : 'Google AdMob Ad Units'}</span>
              </h4>

              <p className="text-[11px] text-slate-500">
                {lang === 'ar'
                  ? 'معرّف تطبيق AdMob يُضبط في GitHub Actions عبر المتغير ADMOB_APP_ID، ثم يلزم إعادة بناء APK. أدخل هنا معرّفات وحدات الإعلانات فقط.'
                  : 'Set the AdMob App ID in GitHub Actions as ADMOB_APP_ID and rebuild the APK. Enter ad unit IDs here.'}
              </p>

              <div className="space-y-3.5">
                <div className="grid grid-cols-1 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Banner Ad Unit ID (معرّف الوحدة الشريطية)
                    </label>
                    <input
                      type="text"
                      value={adConfig.admob_banner_id}
                      onChange={(e) => setAdConfig({ ...adConfig, admob_banner_id: e.target.value })}
                      placeholder="ca-app-pub-xxxxxxxxxxxxxxxx/6300978111"
                      dir="ltr"
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-mono-num text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Interstitial Unit ID (معرّف الإعلان البيني)
                    </label>
                    <input
                      type="text"
                      value={adConfig.admob_interstitial_id}
                      onChange={(e) => setAdConfig({ ...adConfig, admob_interstitial_id: e.target.value })}
                      placeholder="ca-app-pub-xxxxxxxxxxxxxxxx/1033173712"
                      dir="ltr"
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-mono-num text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {lang === 'ar' ? 'فاصل الإعلانات البينية (بالثواني)' : 'Interstitial Cooldown (sec)'}
                    </label>
                    <input
                      type="number"
                      min={30}
                      max={600}
                      value={adConfig.interstitial_cooldown_seconds}
                      onChange={(e) =>
                        setAdConfig({
                          ...adConfig,
                          interstitial_cooldown_seconds: Number(e.target.value) || 90,
                        })
                      }
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-xs font-mono-num text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingAds}
                  className="w-full min-h-[46px] rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white text-xs font-bold shadow-md active:scale-[0.99] transition-transform"
                >
                  {savingAds
                    ? lang === 'ar'
                      ? 'جارٍ حفظ الإعدادات في السيرفر...'
                      : 'Saving...'
                    : lang === 'ar'
                    ? 'حفظ وتفعيل إعدادات الإعلانات فوراً'
                    : 'Save & Deploy Ad Settings'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Test Modals */}
      <AdInterstitialModal
        isOpen={testInterstitialOpen}
        lang={lang}
        onClose={() => setTestInterstitialOpen(false)}
      />
    </div>
  );
};
