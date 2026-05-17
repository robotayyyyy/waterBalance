'use client';

import dynamic from 'next/dynamic';
import { useLang } from '../i18n/LangContext';
import { theme } from '../forecast/theme';

type Watershed = 'ping' | 'yom';

function LoadingScreen() {
  const { t } = useLang();
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: theme.color.subtleBg, fontFamily: 'sans-serif', color: theme.color.textLabel }}>
      {t.app.loading}
    </div>
  );
}

const ProtoLayout = dynamic(() => import('./ProtoLayout'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function ProtoLoader({ watershed }: { watershed: Watershed }) {
  return <ProtoLayout watershed={watershed} />;
}
