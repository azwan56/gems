import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { MobileBottomNav } from "@/components/MobileBottomNav";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gems v3.0 — Financial Ontology & AI Quantitative Stock Screener",
  description: "Institutional-grade quantitative stock screening platform powered by a Three-Layer Financial Domain Ontology, 27-Sector RRG Rotation, and Walk-Forward AI Audit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-20 md:pb-0 print:pb-0">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('gems-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Gems v3.0 Financial Ontology Quantitative Screener",
              "description": "Institutional-grade quantitative stock screening platform powered by a Three-Layer Financial Domain Ontology and 27-Sector RRG.",
              "applicationCategory": "FinanceApplication",
              "operatingSystem": "All"
            }),
          }}
        />
        <AuthProvider>
          <LanguageProvider>
            <ThemeProvider>
              {children}
              <MobileBottomNav />
            </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
