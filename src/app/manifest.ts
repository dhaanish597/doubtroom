import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "DoubtRoom",
    short_name: "DoubtRoom",
    description: "Exam doubts answered in seconds, verified by seniors.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#3B2FC9",
    background_color: "#FFFFFF",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
