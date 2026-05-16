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
        {/* Instant boot splash — injected into <body> by JS so it lives OUTSIDE
            the React tree, avoiding hydration mismatches (React-18+ rejects
            unexpected children inside <body> and crashes the whole app with
            error #418). The same script removes the splash once the page
            finishes loading or after 1.5s as a hard safety. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function mount(){if(document.getElementById('gustrips-boot-splash'))return;" +
              "var s=document.createElement('div');s.id='gustrips-boot-splash';s.setAttribute('aria-hidden','true');" +
              "s.style.cssText='position:fixed;inset:0;background:radial-gradient(circle at 50% 35%,#14253d 0%,#0a1628 60%,#07101f 100%);display:flex;align-items:center;justify-content:center;z-index:9999;pointer-events:none;transition:opacity 280ms ease-out';" +
              "var m=document.createElement('div');" +
              "m.style.cssText='width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#f59e0b,#f43f5e);box-shadow:0 10px 40px rgba(245,158,11,0.35);display:flex;align-items:center;justify-content:center;font-family:system-ui;color:#fff;font-weight:800;font-size:28px;letter-spacing:-0.02em';" +
              "m.textContent='G';s.appendChild(m);document.body.appendChild(s);}" +
              "function off(){var s=document.getElementById('gustrips-boot-splash');if(!s)return;s.style.opacity='0';setTimeout(function(){s.remove()},320)}" +
              "if(document.body){mount()}else{document.addEventListener('DOMContentLoaded',mount)}" +
              "if(document.readyState==='complete'){requestAnimationFrame(off)}" +
              "else{window.addEventListener('load',function(){requestAnimationFrame(off)})}" +
              "setTimeout(off,1500);})();",
          }}
        />
      </head>
      <body className={`${dmSans.variable} antialiased`}>
        <ServiceWorkerRegistration />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
