'use client';

import dynamic from 'next/dynamic';

const ForecastMap = dynamic(() => import('./ForecastMap'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontFamily: 'sans-serif', color: '#64748b' }}>
      Loading map...
    </div>
  ),
});

export default function ForecastMapLoader() {
  return <ForecastMap />;
}
