import { useCallback, useEffect, useState } from 'react';

/** Web has no share extension; accept ?url= on load for deep links. */
export function useShareIntent(_options = {}) {
  const [shareIntent, setShareIntent] = useState(null);
  const [hasShareIntent, setHasShareIntent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url') || params.get('sharedUrl');
    if (url && /^https?:\/\//i.test(url)) {
      setShareIntent({ webUrl: url, text: url });
      setHasShareIntent(true);
    }
  }, []);

  const resetShareIntent = useCallback(() => {
    setShareIntent(null);
    setHasShareIntent(false);
  }, []);

  return { hasShareIntent, shareIntent, resetShareIntent };
}
