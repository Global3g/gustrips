import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a1628',
};

export const metadata: Metadata = {
  title: "GusTrips | Organizador de Viajes",
  description: "Organiza tus viajes en grupo de forma colaborativa. Itinerarios, documentos, checklists y más.",
  keywords: ["viajes", "organizador", "itinerario", "grupo", "colaborativo"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GusTrips",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#0a1628" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Preconnect to Firebase services so the first auth + db RTT starts
            during HTML parse instead of after JS hydration. */}
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
      </head>
      <body className={`${dmSans.variable} antialiased`}>
        {/* Instant splash that renders before React hydrates. Removed by an
            inline script as soon as the body becomes interactive (or after
            React paints anything). Keeps the user looking at *something*
            during the JS parse + Firebase init window. */}
        <div
          id="gustrips-boot-splash"
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 35%, #14253d 0%, #0a1628 60%, #07101f 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none',
            transition: 'opacity 280ms ease-out',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(135deg,#f59e0b,#f43f5e)',
              boxShadow: '0 10px 40px rgba(245,158,11,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'system-ui',
              color: '#fff',
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: '-0.02em',
            }}
          >
            G
          </div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var s=document.getElementById('gustrips-boot-splash');" +
              "if(!s)return;var off=function(){s.style.opacity='0';" +
              "setTimeout(function(){s.remove()},320)};" +
              // Drop the splash on first paint signal we can catch.
              "if(document.readyState==='complete'){requestAnimationFrame(off)}" +
              "else{window.addEventListener('load',function(){requestAnimationFrame(off)})}" +
              // Hard safety: never sit longer than 1.5s no matter what.
              "setTimeout(off,1500);})();",
          }}
        />
        <ServiceWorkerRegistration />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
