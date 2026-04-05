import { use } from 'react';
import { LangProvider } from '../../i18n/LangContext';
import ForecastMapLoader from '../ForecastMapLoader';

type Watershed = 'ping' | 'yom';

export default function WatershedPage({ params }: { params: Promise<{ watershed: string }> }) {
  const { watershed: raw } = use(params);
  const watershed: Watershed = raw === 'yom' ? 'yom' : 'ping';
  return (
    <LangProvider>
      <ForecastMapLoader watershed={watershed} />
    </LangProvider>
  );
}
