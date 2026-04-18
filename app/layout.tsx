import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ui/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SorSU Document Request System",
  description: "Secure online document request system for Sorsogon State University students",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SorSU Docs",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "SorSU Document Request System",
    title: "SorSU Document Request System",
    description: "Secure online document request system for Sorsogon State University students",
  },
  twitter: {
    card: "summary",
    title: "SorSU Document Request System",
    description: "Secure online document request system for Sorsogon State University students",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${playfairDisplay.variable} antialiased`}
      >
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
