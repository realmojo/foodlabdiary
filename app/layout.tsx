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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://foodlabdiary.com"

export const metadata: Metadata = {
  title: {
    default: "푸드랩다이어리 - 건강·식단 정보 매거진",
    template: "%s | 푸드랩다이어리",
  },
  description:
    "건강한 식생활을 위한 영양·식단 정보 매거진",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": [{ url: "/rss.xml", title: "푸드랩다이어리 RSS 피드" }],
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "푸드랩다이어리",
    title: "푸드랩다이어리 - 건강·식단 정보 매거진",
    description:
      "건강한 식생활을 위한 영양·식단 정보 매거진",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "푸드랩다이어리 - 건강·식단 정보 매거진",
    description:
      "건강한 식생활을 위한 영양·식단 정보 매거진",
  },
  verification: {
    other: {
      "naver-site-verification": "2529ba3b47acb83de3a2f84c4c57a7aa90495d77",
    },
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
        <link rel="preconnect" href="https://foodlabdiary.s3.ap-northeast-2.amazonaws.com" />
        <link rel="dns-prefetch" href="https://foodlabdiary.s3.ap-northeast-2.amazonaws.com" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#16A34A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="푸드랩다이어리" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="author" href="/about" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="푸드랩다이어리 RSS 피드"
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
