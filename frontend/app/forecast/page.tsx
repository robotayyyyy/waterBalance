import { LangProvider } from '../i18n/LangContext';
import ForecastMapLoader from './ForecastMapLoader';

export default function ForecastPage() {
  return (
    <LangProvider>
      <ForecastMapLoader />
    </LangProvider>
  );
}
