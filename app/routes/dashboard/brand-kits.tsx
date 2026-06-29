import { useState } from "react";

import {
  FormActions,
  GradientThumbnail,
  MetricCard,
  PageHeader,
  SectionHeader,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { Modal, primaryButtonClass } from "~/components/dashboard/section";

export function meta() {
  return [{ title: "Brand Kits · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

interface BrandKit {
  id: string;
  name: string;
  projects: number;
  updatedAgo: string;
  colors: string[];
  fonts: { primary: string; secondary: string };
  isDefault?: boolean;
}

const MOCK_KITS: BrandKit[] = [
  {
    id: "bk1",
    name: "Kuvox Default",
    projects: 8,
    updatedAgo: "2 days ago",
    colors: ["#6C5CE7", "#00B894", "#FDCB6E", "#2D3436"],
    fonts: { primary: "Inter", secondary: "DM Sans" },
    isDefault: true,
  },
  {
    id: "bk2",
    name: "Studio Noir",
    projects: 3,
    updatedAgo: "1 week ago",
    colors: ["#1A1A2E", "#E94560", "#F5F5F5", "#533483"],
    fonts: { primary: "Playfair Display", secondary: "Source Sans 3" },
  },
  {
    id: "bk3",
    name: "Travel Channel",
    projects: 5,
    updatedAgo: "3 days ago",
    colors: ["#0984E3", "#00CEC9", "#FFEAA7", "#2D3436"],
    fonts: { primary: "Outfit", secondary: "Work Sans" },
  },
];



/* ── Sub-components ─────────────────────────────────────────────────────── */



function ColorSwatches({ colors }: { colors: string[] }) {
  return (
    <div className="flex gap-2">
      {colors.map((color) => (
        <div
          key={color}
          className="h-7 w-7 rounded-lg border border-outline-variant/50 shadow-sm"
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}

function BrandKitCard({ kit, index }: { kit: BrandKit; index: number }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30">
      <GradientThumbnail index={index} className="relative h-32">
        <ColorSwatches colors={kit.colors} />
        {kit.isDefault && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-2 py-0.5 text-label-sm font-bold text-on-primary">
            Default
          </span>
        )}
      </GradientThumbnail>
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-body-sm font-bold text-on-surface">{kit.name}</h3>
            <p className="mt-0.5 text-label-md text-on-surface-variant">
              {kit.projects} projects · Updated {kit.updatedAgo}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          </button>
        </div>
        <div className="space-y-2 text-label-sm text-on-surface-variant">
          <p>
            <span className="font-medium text-on-surface">Primary:</span> {kit.fonts.primary}
          </p>
          <p>
            <span className="font-medium text-on-surface">Secondary:</span> {kit.fonts.secondary}
          </p>
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-lg border border-outline-variant py-2 text-label-md font-medium text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface"
        >
          Edit brand kit
        </button>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function BrandKits() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <section className="space-y-10">
      <PageHeader title="Brand Kits" subtitle="Keep colors, fonts, and logos consistent across every project.">
        <button type="button" onClick={() => setCreateOpen(true)} className={primaryButtonClass()}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create brand kit
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="palette" label="Total Kits" value={MOCK_KITS.length} />
        <MetricCard icon="folder" label="Projects Using" value={16} tone="secondary" />
        <MetricCard icon="text_fields" label="Font Pairs" value={MOCK_KITS.length} tone="tertiary" />
        <MetricCard icon="color_lens" label="Color Palettes" value={MOCK_KITS.length * 4} />
      </div>

      <section>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-headline-md font-bold text-on-surface">Your Brand Kits</h2>
          <span className="text-label-md text-on-surface-variant">{MOCK_KITS.length} kits</span>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_KITS.map((kit, index) => (
            <BrandKitCard key={kit.id} kit={kit} index={index} />
          ))}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[32px]">add</span>
            <span className="mt-2 text-label-md font-medium">Create brand kit</span>
          </button>
        </div>
      </section>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create brand kit">
        <p className="mb-4 text-body-sm text-on-surface-variant">
          Define your brand colors and typography to apply across projects.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="kit-name" className="block text-label-md text-on-surface-variant">
              Kit name
            </label>
            <input
              id="kit-name"
              type="text"
              placeholder="My Brand"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="kit-primary-font" className="block text-label-md text-on-surface-variant">
              Primary font
            </label>
            <input
              id="kit-primary-font"
              type="text"
              placeholder="Inter"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <FormActions
            onCancel={() => setCreateOpen(false)}
            onSubmit={() => setCreateOpen(false)}
            submitLabel="Create"
            submitType="button"
          />
        </div>
      </Modal>
    </section>
  );
}
