"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string | null;
  href: string;
};

// The UK, roughly — this app's user base today (see geocode.ts's Nominatim
// usage and AffiliatesList's postcode fallback) — used only when there's no
// marker and no known viewer location to center on instead.
const UK_CENTER: [number, number] = [54.5, -3.5];
const UK_ZOOM = 5;

/**
 * A Leaflet + OpenStreetMap view for a Discover tab's results (Affiliates,
 * Events) — plain Leaflet rather than react-leaflet, since the latter's
 * React 19 support isn't established enough yet to depend on for this.
 * Always dynamically imported with `ssr: false` by its callers: Leaflet
 * touches `window` at module load and breaks server rendering otherwise.
 */
export function DiscoverMap({
  markers,
  myCoords,
  emptyMessage,
}: {
  markers: MapMarker[];
  myCoords?: { lat: number; lng: number } | null;
  emptyMessage: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    // Leaflet reads `window`/`document` at import time, so it's loaded here
    // rather than at module scope — this effect only ever runs client-side,
    // but a dynamic import keeps that true even if something upstream slips
    // and imports this file eagerly.
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      // Leaflet's default marker icon is built from relative image URLs
      // that resolve against its own package layout — under a bundler
      // (webpack/Next) those silently 404 and every marker renders
      // invisible. Sidestep that entirely with a brand-colored inline-SVG
      // pin (divIcon) instead of trying to repoint the bundler at Leaflet's
      // shipped PNGs.
      const pinIcon = L.divIcon({
        className: "",
        html: `<svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 23 13 23s13-13.25 13-23C26 5.8 20.2 0 13 0z" fill="#b8842a" stroke="#fff" stroke-width="1.5"/>
          <circle cx="13" cy="13" r="5" fill="#fff"/>
        </svg>`,
        iconSize: [26, 36],
        iconAnchor: [13, 36],
        popupAnchor: [0, -34],
      });
      L.Marker.prototype.options.icon = pinIcon;

      const initialCenter = markers[0] ? ([markers[0].lat, markers[0].lng] as [number, number]) : myCoords ? ([myCoords.lat, myCoords.lng] as [number, number]) : UK_CENTER;
      const initialZoom = markers.length > 0 || myCoords ? 11 : UK_ZOOM;

      map = L.map(containerRef.current!, { center: initialCenter, zoom: initialZoom });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const bounds = L.latLngBounds([]);

      if (myCoords) {
        const meIcon = L.divIcon({
          className: "",
          html: '<span style="display:block;width:14px;height:14px;border-radius:999px;background:#b8842a;border:2.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.25);"></span>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([myCoords.lat, myCoords.lng], { icon: meIcon, interactive: false, zIndexOffset: -1000 }).addTo(map);
        bounds.extend([myCoords.lat, myCoords.lng]);
      }

      for (const marker of markers) {
        const m = L.marker([marker.lat, marker.lng]).addTo(map);
        const popupHtml = `
          <div style="font-family: inherit; min-width: 160px;">
            <p style="margin: 0 0 2px; font-weight: 700; font-size: 13px; color: #232223;">${escapeHtml(marker.title)}</p>
            ${marker.subtitle ? `<p style="margin: 0 0 6px; font-size: 11.5px; color: rgba(35,34,35,0.6);">${escapeHtml(marker.subtitle)}</p>` : ""}
            <a href="${escapeAttr(marker.href)}" style="font-size: 12px; font-weight: 600; color: #b8842a;">View &rarr;</a>
          </div>
        `;
        m.bindPopup(popupHtml);
        bounds.extend([marker.lat, marker.lng]);
      }

      if (markers.length > 0 || myCoords) {
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
      }
    });

    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
    };
    // Markers/coords are server-computed per render of the owning Discover
    // tab (a fresh page load/search, not live client state), so re-running
    // this on every array identity change would just thrash the map —
    // intentionally only re-initializing on a real remount (e.g. switching
    // back into the Map tab).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (markers.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-b2b-purple/10 bg-b2b-card">
        <p className="px-6 text-center text-sm text-b2b-ink/40">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-96 w-full overflow-hidden rounded-xl border border-b2b-purple/10"
      style={{ background: "#e9e6df" }}
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
