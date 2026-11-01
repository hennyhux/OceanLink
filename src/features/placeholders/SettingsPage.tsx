import { PlaceholderPage } from '@/components/MessagePages';
import { RequireRole } from '@/features/auth/guards';

export default function SettingsPage() {
  return (
    <RequireRole role="admin">
      <PlaceholderPage titleKey="nav.settings" purposeKey="placeholder.settings" />
    </RequireRole>
  );
}
