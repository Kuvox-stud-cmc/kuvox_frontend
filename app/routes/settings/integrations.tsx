import { useState } from "react";

import {
  secondarySettingsButton,
  SettingsHeader,
  SettingsNotice,
  SettingsPanel,
} from "./settings-ui";
import type { Route } from "./+types/integrations";

const integrations = [
  {
    id: "google-drive",
    name: "Google Drive",
    icon: "add_to_drive",
    description: "Import media from shared Drive folders.",
    status: "Available mock",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    icon: "deployed_code",
    description: "Sync project source folders from Dropbox.",
    status: "Available mock",
  },
  {
    id: "slack",
    name: "Slack",
    icon: "forum",
    description: "Send review updates to production channels.",
    status: "Available mock",
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "smart_display",
    description: "Publish approved exports to a channel.",
    status: "Available mock",
  },
];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Integrations - Kuvox" }];
}

export default function Integrations() {
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  return (
    <section className="space-y-6">
      <SettingsHeader
        title="Integrations"
        subtitle="Preview external service connection points. These cards use mock state only."
      />

      <SettingsNotice>
        Integrations are intentionally mock-only in this pass and do not call the backend.
      </SettingsNotice>

      <SettingsPanel title="Available integrations" description="Local UI state for product exploration.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {integrations.map((integration) => {
            const isConnected = connected[integration.id] ?? false;
            return (
              <article
                key={integration.id}
                className="rounded-xl border border-outline-variant bg-surface-container p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[22px]">{integration.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-body-sm font-semibold text-on-surface">{integration.name}</h2>
                    <p className="mt-1 text-label-md text-on-surface-variant">{integration.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-surface-container-high px-2 py-1 text-label-sm font-semibold text-on-surface-variant">
                    {isConnected ? "Connected locally" : integration.status}
                  </span>
                  <button
                    type="button"
                    className={secondarySettingsButton}
                    onClick={() =>
                      setConnected((current) => ({
                        ...current,
                        [integration.id]: !isConnected,
                      }))
                    }
                  >
                    {isConnected ? "Disconnect" : "Connect"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </SettingsPanel>
    </section>
  );
}
