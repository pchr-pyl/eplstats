import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai_Looped, Trirong, Sarabun } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { I18nProvider } from '@/i18n/I18nContext';

const ibmPlex = IBM_Plex_Sans_Thai_Looped({
  variable: '--font-ibm-plex',
  weight: ['400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
});

const trirong = Trirong({
  variable: '--font-trirong',
  weight: ['500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
});

const sarabun = Sarabun({
  variable: '--font-sarabun',
  weight: ['400', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Manchester United — Season Analytics',
  description: 'Season-by-season Manchester United analytics dashboard',
};

const themeInitScript = `
  (function() {
    try {
      var theme = localStorage.getItem('mu-theme');
      document.documentElement.dataset.theme =
        theme === 'dark' || theme === 'light' ? theme : 'dark';
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      data-theme="dark"
      className={`${ibmPlex.variable} ${trirong.variable} ${sarabun.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-bg text-primary font-body">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
