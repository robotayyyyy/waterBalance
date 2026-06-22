import { use } from 'react';
import { notFound } from 'next/navigation';
import { LangProvider } from '../../i18n/LangContext';
import ProtoLoader from '../ProtoLoader';
import { ENABLE_PROTO } from '../../forecast/config';

type Watershed = 'ping' | 'yom';

export default function ProtoPage({ params }: { params: Promise<{ watershed: string }> }) {
  if (!ENABLE_PROTO) notFound();
  const { watershed: raw } = use(params);
  const watershed: Watershed = raw === 'yom' ? 'yom' : 'ping';
  return (
    <LangProvider>
      <ProtoLoader watershed={watershed} />
    </LangProvider>
  );
}
