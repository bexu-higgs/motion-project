import { LegalView } from '@/components/LegalView';
import { TERMS } from '@/legal/content';

export default function TermsScreen() {
  return <LegalView docs={TERMS} />;
}
