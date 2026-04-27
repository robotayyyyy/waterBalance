'use client';

import dynamic from 'next/dynamic';
import { useLang } from '../i18n/LangContext';

type Watershed = 'ping' | 'yom';

function LoadingScreen() {
  const { t } = useLang();
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontFamily: 'sans-serif', color: '#64748b' }}>
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
