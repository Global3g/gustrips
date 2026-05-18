'use client';

import { useMemo } from 'react';
import {
  CAPTIONS,
  FILTERS,
  MUSIC,
  OVERLAY_THEMES,
  TRANSITIONS,
} from '@/lib/slideshow/presets';
import type {
  SlideshowPhoto,
  SlideshowSettings as SlideshowSettingsType,
} from '@/lib/slideshow/types';
import PhotoSelector from './PhotoSelector';
import CustomOrderStrip from './CustomOrderStrip';

interface SlideshowSettingsProps {
  pool: SlideshowPhoto[];
  settings: SlideshowSettingsType;
  setSettings: (next: SlideshowSettingsType) => void;
  selectedSet: Set<string>;
  onSelectAll: () => void;
  onClear: () => void;
}

/** Generic "card" wrapper used for every section. Keeps spacing/border
 *  consistent without copy-pasting the same class soup four times. */
function SectionCard({
  title,
  children,
  trailing,
}: {
  title: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-white/55 text-[11px] font-bold uppercase tracking-wider">{title}</p>
        {trailing}
      </div>
      {children}
    </div>
  );
}

export default function SlideshowSettings({
  pool,
  settings,
  setSettings,
  selectedSet,
  onSelectAll,
  onClear,
}: SlideshowSettingsProps) {
  // URL → thumbnail src map for the order strip. Cheap because pool
  // is bounded by the trip's photo count.
  const poolByUrl = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pool) m.set(p.url, p.url);
    return m;
  }, [pool]);

  // Helpers — every control just sets a single field on the settings
  // object. Doing it inline keeps the component readable.
  const update = <K extends keyof SlideshowSettingsType>(
    key: K,
    value: SlideshowSettingsType[K],
  ) => {
    setSettings({ ...settings, [key]: value });
  };

  const toggleSelected = (url: string) => {
    const has = selectedSet.has(url);
    let nextSelected: string[];
    if (has) {
      nextSelected = settings.selectedUrls.filter((u) => u !== url);
    } else {
      nextSelected = [...settings.selectedUrls, url];
    }
    // Keep customOrder in sync — removed photos leave, added photos
    // append to the end of the custom order.
    let nextCustom = settings.customOrder.filter((u) => nextSelected.includes(u));
    if (!has && !nextCustom.includes(url)) nextCustom = [...nextCustom, url];
    setSettings({
      ...settings,
      selectedUrls: nextSelected,
      customOrder: nextCustom,
    });
  };

  return (
    <div className="space-y-4">
      <PhotoSelector
        pool={pool}
        selected={selectedSet}
        onToggle={toggleSelected}
        onSelectAll={onSelectAll}
        onClear={onClear}
      />

      {/* ── Order ───────────────────────────────── */}
      <SectionCard title="Orden">
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { id: 'chrono',  label: 'Cronológico' },
            { id: 'shuffle', label: 'Aleatorio' },
            { id: 'custom',  label: 'Personalizado' },
          ] as const).map((opt) => {
            const active = settings.order === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => update('order', opt.id)}
                className={
                  'px-3 py-2 rounded-lg border text-xs font-bold transition-all ' +
                  (active
                    ? 'bg-emerald-400/15 border-emerald-300/60 text-emerald-100'
                    : 'bg-white/[0.04] border-white/10 text-white/75 hover:bg-white/[0.08]')
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {settings.order === 'shuffle' && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-white/45">
              Seed: {settings.shuffleSeed}
            </span>
            <button
              type="button"
              onClick={() => update('shuffleSeed', settings.shuffleSeed + 1)}
              className="px-3 py-1 rounded-md bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] text-xs font-semibold text-white"
            >
              Volver a barajar
            </button>
          </div>
        )}

        {settings.order === 'custom' && (
          <div className="mt-3">
            <p className="text-white/45 text-[10px] mb-2 uppercase tracking-wider">
              Arrastrá para reacomodar
            </p>
            <CustomOrderStrip
              order={settings.customOrder}
              poolByUrl={poolByUrl}
              onChange={(next) => update('customOrder', next)}
              onRemove={(url) => toggleSelected(url)}
            />
          </div>
        )}
      </SectionCard>

      {/* ── Duration ───────────────────────────── */}
      <SectionCard title={`Duración por foto · ${settings.durationPerSlide}s`}>
        <input
          type="range"
          min={1}
          max={15}
          step={1}
          value={settings.durationPerSlide}
          onChange={(e) => update('durationPerSlide', Number(e.target.value))}
          className="w-full accent-emerald-400"
        />
        <div className="flex justify-between text-[9px] text-white/35 uppercase tracking-wider mt-1">
          <span>1s · rápido</span>
          <span>15s · lento</span>
        </div>
      </SectionCard>

      {/* ── Transition ─────────────────────────── */}
      <SectionCard title="Transición">
        <div className="grid grid-cols-2 gap-1.5">
          {TRANSITIONS.map((t) => {
            const active = settings.transition === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => update('transition', t.id)}
                className={
                  'text-left p-2.5 rounded-xl border transition-all ' +
                  (active
                    ? 'bg-emerald-400/15 border-emerald-300/60 text-emerald-100'
                    : 'bg-white/[0.04] border-white/10 text-white/75 hover:bg-white/[0.08]')
                }
              >
                <p className={'text-sm font-bold leading-none ' + (active ? '' : 'text-white')}>
                  {t.label}
                </p>
                <p className="text-[10px] text-white/45 mt-1 leading-tight">{t.description}</p>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Filter ─────────────────────────────── */}
      <SectionCard title="Filtro">
        <div className="grid grid-cols-3 gap-1.5">
          {FILTERS.map((f) => {
            const active = settings.filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => update('filter', f.id)}
                className={
                  'px-2 py-2 rounded-lg border text-xs font-bold transition-all ' +
                  (active
                    ? 'bg-emerald-400/15 border-emerald-300/60 text-emerald-100'
                    : 'bg-white/[0.04] border-white/10 text-white/75 hover:bg-white/[0.08]')
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Music ──────────────────────────────── */}
      <SectionCard title="Música">
        <div className="space-y-1.5">
          {MUSIC.map((m) => {
            const active = settings.music === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => update('music', m.id)}
                className={
                  'w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-all ' +
                  (active
                    ? 'bg-emerald-400/15 border-emerald-300/60 text-emerald-100'
                    : 'bg-white/[0.04] border-white/10 text-white/75 hover:bg-white/[0.08]')
                }
              >
                <div>
                  <p className={'text-sm font-bold ' + (active ? '' : 'text-white')}>{m.label}</p>
                  <p className="text-[10px] text-white/45 mt-0.5">{m.description}</p>
                </div>
                {active && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>

        {settings.music !== 'none' && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
                Volumen
              </span>
              <span className="text-[10px] text-white/55 tabular-nums">{settings.musicVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.musicVolume}
              onChange={(e) => update('musicVolume', Number(e.target.value))}
              className="w-full accent-emerald-400"
            />
          </div>
        )}
      </SectionCard>

      {/* ── Captions ───────────────────────────── */}
      <SectionCard title="Subtítulos">
        <div className="grid grid-cols-3 gap-1.5">
          {CAPTIONS.map((c) => {
            const active = settings.caption === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => update('caption', c.id)}
                className={
                  'text-left p-2 rounded-lg border transition-all ' +
                  (active
                    ? 'bg-emerald-400/15 border-emerald-300/60 text-emerald-100'
                    : 'bg-white/[0.04] border-white/10 text-white/75 hover:bg-white/[0.08]')
                }
              >
                <p className={'text-xs font-bold leading-none ' + (active ? '' : 'text-white')}>
                  {c.label}
                </p>
                <p className="text-[9px] text-white/45 mt-1 leading-tight">{c.description}</p>
              </button>
            );
          })}
        </div>

        {settings.caption !== 'none' && (
          <>
            <p className="text-white/45 text-[10px] mt-3 mb-1.5 uppercase tracking-wider font-semibold">
              Tema del texto
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {OVERLAY_THEMES.map((th) => {
                const active = settings.overlayTheme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => update('overlayTheme', th.id)}
                    className={
                      'text-left p-2 rounded-lg border transition-all ' +
                      (active
                        ? 'bg-emerald-400/15 border-emerald-300/60 text-emerald-100'
                        : 'bg-white/[0.04] border-white/10 text-white/75 hover:bg-white/[0.08]')
                    }
                  >
                    <p className={'text-xs font-bold leading-none ' + (active ? '' : 'text-white')}>
                      {th.label}
                    </p>
                    <p className="text-[9px] text-white/45 mt-1 leading-tight">{th.description}</p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Playback ───────────────────────────── */}
      <SectionCard title="Reproducción">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-white text-sm font-semibold">Loop infinito</p>
            <p className="text-white/45 text-[10px] mt-0.5">Al terminar, vuelve a empezar</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.loop}
            onClick={() => update('loop', !settings.loop)}
            className={
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' +
              (settings.loop ? 'bg-emerald-400' : 'bg-white/15')
            }
          >
            <span
              className={
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' +
                (settings.loop ? 'translate-x-6' : 'translate-x-1')
              }
            />
          </button>
        </label>
        <p className="text-white/35 text-[10px] mt-3 leading-snug">
          Se pausa automáticamente cuando cambias de pestaña.
        </p>
      </SectionCard>
    </div>
  );
}
