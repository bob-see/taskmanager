import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaskManager",
    short_name: "TaskManager",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF7F0",
    theme_color: "#FAF7F0",
    icons: [
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
