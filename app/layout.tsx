import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"


export const metadata: Metadata = {
  title: "Swipe Reader",
  description: "TikTok-style blog reader - swipe through articles",
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
