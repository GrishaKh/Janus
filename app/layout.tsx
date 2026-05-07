import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "Janus — Entry Control",
  description:
    "RFID + fingerprint entry control with real-time monitoring, breach detection, and per-device modes. Standalone competition build.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={cn("relative font-sans antialiased min-h-screen bg-slate-950 text-slate-100", inter.variable)}>
        {children}
      </body>
    </html>
  )
}
