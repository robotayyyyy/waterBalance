'use client';

import dynamic from 'next/dynamic';

const BasinMap = dynamic(() => import('./BasinMap'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#94a3b8', fontFamily: 'sans-serif' }}>
      Loading map…
    </div>
  ),
});

export default function BasinMapLoader() {
  return <BasinMap />;
}
