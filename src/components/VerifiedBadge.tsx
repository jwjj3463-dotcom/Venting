import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { UserRole } from '../db/realmLocalDB';
import { AppLang } from '../i18n/translations';

interface VerifiedBadgeProps {
  role: UserRole;
  lang: AppLang;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ role, lang }) => {
  if (role !== 'owner' && role !== 'moderator') return null;

  const label =
    role === 'owner'
      ? lang === 'ar'
        ? 'الحساب الرسمي الموثق'
        : 'Verified official account'
      : lang === 'ar'
        ? 'حساب الإدارة الموثق'
        : 'Verified staff account';

  return (
    <span
      className="inline-flex shrink-0 text-sky-500"
      role="img"
      aria-label={label}
      title={label}
    >
      <BadgeCheck className="h-4 w-4 fill-sky-500/15" />
    </span>
  );
};
