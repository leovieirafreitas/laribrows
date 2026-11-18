import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { getClientUser } from "@/lib/client-auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [s, client] = await Promise.all([getSettings(), getClientUser()]);
  return (
    <div className="bg-aura flex min-h-screen flex-col">
      <SiteHeader s={s} loggedIn={!!client} />
      <main className="flex-1">{children}</main>
      <SiteFooter s={s} />
    </div>
  );
}
