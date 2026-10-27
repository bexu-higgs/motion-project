import { LegalView } from '@/components/LegalView';
import { PRIVACY } from '@/legal/content';

export default function PrivacyScreen() {
  return <LegalView docs={PRIVACY} />;
}
