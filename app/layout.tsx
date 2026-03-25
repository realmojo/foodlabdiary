import { Geist_Mono, Noto_Sans } from "next/font/google"
import type { Metadata } from "next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { cn } from "@/lib/utils"

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://petpawpaw.net"

export const metadata: Metadata = {
  title: {
    default: "포우포우 - 반려동물 정보 매거진",
    template: "%s | 포우포우",
  },
  description:
    "강아지, 고양이, 반려동물과 함께하는 더 나은 일상을 위한 정보 매거진",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": [{ url: "/rss.xml", title: "포우포우 RSS 피드" }],
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "포우포우",
    title: "포우포우 - 반려동물 정보 매거진",
    description:
      "강아지, 고양이, 반려동물과 함께하는 더 나은 일상을 위한 정보 매거진",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "포우포우 - 반려동물 정보 매거진",
    description:
      "강아지, 고양이, 반려동물과 함께하는 더 나은 일상을 위한 정보 매거진",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        notoSans.variable
      )}
    >
      <head>
        <link rel="author" href="/about" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="포우포우 RSS 피드"
          href="/rss.xml"
        />
      </head>
      <body className="flex min-h-svh flex-col">
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
