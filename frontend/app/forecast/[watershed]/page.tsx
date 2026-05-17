import { use } from 'react';
import { LangProvider } from '../../i18n/LangContext';
import ForecastProtoLoader from '../ForecastProtoLoader';

type Watershed = 'ping' | 'yom';

export default function ForecastPage({ params }: { params: Promise<{ watershed: string }> }) {
  const { watershed: raw } = use(params);
  const watershed: Watershed = raw === 'yom' ? 'yom' : 'ping';
  return (
    <LangProvider>
      <ForecastProtoLoader watershed={watershed} />
    </LangProvider>
  );
}
