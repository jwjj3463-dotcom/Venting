import React from 'react';

type ThreeDIconProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  color?: string;
  fill?: string;
  size?: number | string;
  strokeWidth?: number;
};

const icon = (asset: string): React.FC<ThreeDIconProps> => {
  const ThreeDIcon: React.FC<ThreeDIconProps> = ({
    className,
    color: _color,
    fill: _fill,
    size,
    strokeWidth: _strokeWidth,
    style,
    alt,
    ...imageProps
  }) => (
    <img
      {...imageProps}
      src={`/assets/3d-icons/${asset}.webp`}
      alt={alt ?? ''}
      aria-hidden={imageProps['aria-label'] ? undefined : true}
      className={className ?? 'h-6 w-6'}
      style={{
        ...(size === undefined ? {} : { width: size, height: size }),
        ...style,
      }}
      draggable={false}
    />
  );

  ThreeDIcon.displayName = `ThreeDIcon(${asset})`;
  return ThreeDIcon;
};

export const AlertTriangle = icon('ef4a90-bell');
export const ArrowLeft = icon('14180b-back');
export const ArrowRight = icon('923d52-forward');
export const Ban = icon('a6d2be-x');
export const BadgeCheck = icon('b91186-shield');
export const BarChart3 = icon('4a4275-chart');
export const Check = icon('1b714e-tick');
export const CheckCheck = icon('1b714e-tick');
export const CheckCircle2 = icon('1b714e-tick');
export const ChevronLeft = icon('14180b-back');
export const ChevronRight = icon('cdb20a-next');
export const Clock = icon('8ef1fa-clock');
export const Coins = icon('b801dc-3d-coin');
export const Compass = icon('a0330a-explorer');
export const Copy = icon('d3d0c8-copy');
export const CreditCard = icon('11463e-credit-card');
export const Crown = icon('634b4b-crown');
export const Database = icon('4f52f8-cube');
export const DollarSign = icon('421bcd-dollar');
export const Download = icon('176980-folder');
export const Eye = icon('b4a0af-zoom');
export const EyeOff = icon('457612-lock');
export const ExternalLink = icon('2d9fa2-link');
export const FileText = icon('65d841-file-text');
export const Flag = icon('e9828b-flag');
export const Gift = icon('3f0398-gift');
export const Globe = icon('8034f3-sphere');
export const Heart = icon('1acc3d-heart');
export const History = icon('8ef1fa-clock');
export const ImagePlus = icon('19312f-picture');
export const KeyRound = icon('778c78-key');
export const Layers = icon('4f52f8-cube');
export const Lock = icon('457612-lock');
export const Megaphone = icon('313578-megaphone');
export const MessageCircle = icon('6afbc7-chat');
export const MessageSquare = icon('eec43d-chat-bubble');
export const MessageSquarePlus = icon('f0f795-chat-text');
export const Play = icon('866e45-play');
export const Radar = icon('49b6f4-target');
export const Receipt = icon('65d841-file-text');
export const RefreshCw = icon('637858-flash');
export const Search = icon('b4a0af-zoom');
export const Send = icon('923d52-forward');
export const Server = icon('5f20be-computer');
export const Settings = icon('7e47be-setting');
export const Share2 = icon('2d9fa2-link');
export const ShieldAlert = icon('b91186-shield');
export const ShieldCheck = icon('b91186-shield');
export const Smile = icon('1acc3d-heart');
export const SkipForward = icon('923d52-forward');
export const SlidersHorizontal = icon('ff5be0-tools');
export const Smartphone = icon('1fded0-mobile');
export const Sparkles = icon('5cc402-magic-trick');
export const Trash2 = icon('add2ea-trash-can');
export const User = icon('a14880-boy');
export const Users = icon('a1d2c3-messanger');
export const X = icon('a6d2be-x');
export const XCircle = icon('a6d2be-x');
