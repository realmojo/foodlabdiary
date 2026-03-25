import { Geist_Mono, Noto_Sans } from "next/font/google"
import type { Metadata } from "next"
import Script from "next/script"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PwaInstall } from "@/components/pwa-install"
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
    "max-video-preview": -1,
    "max-image-preview": "large" as const,
    "max-snippet": -1,
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F59E0B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="포우포우" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="author" href="/about" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="포우포우 RSS 피드"
          href="/rss.xml"
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-Y0GVNHGVDC"
          strategy="afterInteractive"
        />
        <Script id="google-gtag" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-Y0GVNHGVDC');`}
        </Script>
        <Script
          src="//wcs.pstatic.net/wcslog.js"
          strategy="beforeInteractive"
        />
        <Script id="naver-wcs" strategy="beforeInteractive">
          {`if(!wcs_add) var wcs_add = {};
wcs_add["wa"] = "184a8e4ccf7e900";
if(window.wcs) { wcs_do(); }`}
        </Script>
      </head>
      <body className="flex min-h-svh flex-col">
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <PwaInstall />
        </ThemeProvider>
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`}
        </Script>
      </body>
    </html>
  )
}
