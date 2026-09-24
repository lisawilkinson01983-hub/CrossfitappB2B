import type { MetadataRoute } from "next";

// Makes the site installable as a home-screen app ("Add to Home Screen" on
// iPhone, "Install app" on Android) that opens full-screen without browser
// chrome. Icons are generated from the logo mark in src/components/Logo.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Box 2 Box",
    short_name: "Box 2 Box",
    description: "Connecting CrossFit Athletes",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
