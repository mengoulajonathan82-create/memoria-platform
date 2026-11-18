import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getBranding } from "@/lib/branding";
import { getDb } from "@/lib/db";
import { getModerationSettings } from "@/lib/settings";
import { saveBrandingAction, saveModerationAction } from "./actions";
import { BrandingForm, ModerationForm } from "./settings-forms";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const db = await getDb();
  const [branding, moderation] = await Promise.all([getBranding(db), getModerationSettings(db)]);

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Paramètres" description="Personnalisation des pages publiques et règles de modération." />
      <Card title="Identité de l'entreprise">
        <BrandingForm
          action={saveBrandingAction}
          hasLogo={Boolean(branding.logoPath)}
          initial={{
            companyName: branding.companyName,
            primaryColor: branding.primaryColor,
            welcomeText: branding.welcomeText,
            footerText: branding.footerText,
          }}
        />
      </Card>
      <Card title="Modération">
        <ModerationForm action={saveModerationAction} words={moderation.forbiddenWords} />
      </Card>
    </div>
  );
}
