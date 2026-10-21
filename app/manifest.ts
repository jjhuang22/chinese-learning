import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "日常 · Everyday Chinese",
    short_name: "日常",
    description: "Your daily Chinese reading and review",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5ef",
    theme_color: "#f6f5ef",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
