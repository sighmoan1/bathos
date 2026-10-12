import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Posts · Bathos",
  description: "Write, edit and publish your Bathos posts from your phone.",
  manifest: "/manage/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Bathos Posts", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/manage/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/manage/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: false, follow: false },
}
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f4f3f5",
}
export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<noscript>Enable JavaScript to use the post manager.</noscript></>
}
