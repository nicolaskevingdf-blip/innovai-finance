import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Innovai Finance", short_name: "Innovai", description: "Gestão financeira inteligente para pessoas e empresas.",
    start_url: "/inicio", display: "standalone", background_color: "#0B0B0B", theme_color: "#0B0B0B", lang: "pt-BR", orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
