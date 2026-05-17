'use client';

import dynamic from 'next/dynamic';
import { useLang } from '../i18n/LangContext';
import { theme } from './theme';

type Watershed = 'ping' | 'yom';

function LoadingScreen() {
  const { t } = useLang();
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: theme.color.subtleBg, fontFamily: 'sans-serif', color: theme.color.textLabel }}>
      {t.app.loading}
    </div>
  );
}

const ForecastMap = dynamic(() => import('./ForecastMap'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function ForecastMapLoader({ watershed }: { watershed: Watershed }) {
  return <ForecastMap watershed={watershed} />;
}
