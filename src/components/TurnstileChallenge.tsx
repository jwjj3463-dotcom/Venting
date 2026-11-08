import React, { useEffect, useRef } from 'react';

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileChallengeProps {
  siteKey: string;
  onToken: (token: string) => void;
}

export const TurnstileChallenge: React.FC<TurnstileChallengeProps> = ({
  siteKey,
  onToken,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let active = true;
    let widgetId: string | null = null;
    const renderWidget = () => {
      if (!active || !containerRef.current || !window.turnstile) return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(''),
        'error-callback': () => onTokenRef.current(''),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.querySelector<HTMLScriptElement>('#cloudflare-turnstile-script');
      if (!script) {
        script = document.createElement('script');
        script.id = 'cloudflare-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderWidget);
      return () => {
        active = false;
        script?.removeEventListener('load', renderWidget);
        if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
        onTokenRef.current('');
      };
    }

    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      onTokenRef.current('');
    };
  }, [siteKey]);

  return <div ref={containerRef} className="min-h-16" />;
};
