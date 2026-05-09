'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { getCachedTile, putCachedTile } from '@/lib/tileCache';

/* 1x1 transparent PNG used as a placeholder when fetch+cache both fail */
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

interface CachedTileLayerProps {
  url: string;
  attribution?: string;
  subdomains?: string;
  maxZoom?: number;
  minZoom?: number;
}

interface CachedGridLayerOptions extends L.GridLayerOptions {
  url: string;
  subdomains: string;
  attribution?: string;
}

interface CachedGridLayerInstance extends L.GridLayer {
  options: CachedGridLayerOptions;
  getTileUrl(coords: L.Coords): string;
}

/* Custom GridLayer that pulls tiles from IndexedDB first, then network */
const CachedGridLayer = L.GridLayer.extend({
  createTile(this: CachedGridLayerInstance, coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img') as HTMLImageElement;
    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    const url = this.getTileUrl(coords);

    const setSrcFromBlob = (blob: Blob) => {
      const objectUrl = URL.createObjectURL(blob);
      tile.onload = () => {
        URL.revokeObjectURL(objectUrl);
      };
      tile.onerror = () => {
        URL.revokeObjectURL(objectUrl);
      };
      tile.src = objectUrl;
    };

    (async () => {
      try {
        const cached = await getCachedTile(url);
        if (cached) {
          setSrcFromBlob(cached);
          done(undefined, tile);
          return;
        }

        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`tile fetch ${r.status}`);
          const blob = await r.blob();
          // Fire and forget — don't block tile rendering
          void putCachedTile(url, blob);
          setSrcFromBlob(blob);
          done(undefined, tile);
        } catch (err) {
          tile.src = TRANSPARENT_PIXEL;
          done(err as Error, tile);
        }
      } catch (err) {
        tile.src = TRANSPARENT_PIXEL;
        done(err as Error, tile);
      }
    })();

    return tile;
  },

  getTileUrl(this: CachedGridLayerInstance, coords: L.Coords): string {
    const subs = this.options.subdomains || 'abcd';
    const sub = subs[Math.abs(coords.x + coords.y) % subs.length] || 'a';
    return this.options.url
      .replace('{s}', sub)
      .replace('{z}', String(coords.z))
      .replace('{x}', String(coords.x))
      .replace('{y}', String(coords.y));
  },
});

export default function CachedTileLayer({
  url,
  attribution,
  subdomains = 'abcd',
  maxZoom = 19,
  minZoom = 0,
}: CachedTileLayerProps) {
  const map = useMap();

  useEffect(() => {
    const LayerCtor = CachedGridLayer as unknown as new (
      options: CachedGridLayerOptions,
    ) => CachedGridLayerInstance;
    const layer = new LayerCtor({
      url,
      subdomains,
      attribution,
      maxZoom,
      minZoom,
    });
    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [map, url, attribution, subdomains, maxZoom, minZoom]);

  return null;
}
