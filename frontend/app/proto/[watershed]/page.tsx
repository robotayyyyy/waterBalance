import { use } from 'react';
import { LangProvider } from '../../i18n/LangContext';
import ProtoLoader from '../ProtoLoader';

type Watershed = 'ping' | 'yom';

export default function ProtoPage({ params }: { params: Promise<{ watershed: string }> }) {
  const { watershed: raw } = use(params);
  const watershed: Watershed = raw === 'yom' ? 'yom' : 'ping';
  return (
    <LangProvider>
      <ProtoLoader watershed={watershed} />
    </LangProvider>
  );
}
