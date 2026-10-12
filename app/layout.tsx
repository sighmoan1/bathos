import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"


export const metadata: Metadata = {
  title: "Bathos Reader",
  description: "Swipe through Bathos articles, save your favourites and read offline.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Bathos", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/apple-icon.png", sizes: "180x180", type: "image/png" }] },
    generator: 'v0.app'
}

// viewportFit: "cover" lets the layout reach under the notch and home
// indicator; the fixed bars pad themselves back out with env(safe-area-inset-*).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  )
}
