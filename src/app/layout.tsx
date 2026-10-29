import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai_Looped, Trirong, Sarabun } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { I18nProvider } from '@/i18n/I18nContext';
import { FeedbackButton } from '@/components/FeedbackButton';
import { TrackView } from '@/components/TrackView';

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
  metadataBase: new URL('https://eplstats.pages.dev'),
  title: {
    default: 'EPL Stats — Premier League Club Analytics',
    template: '%s — EPL Stats',
  },
  description:
    'Free Premier League analytics: season-by-season goals, xG/xGA, goalkeeping, squad wages, manager eras and match logs for every PL club since 2014.',
  openGraph: {
    siteName: 'EPL Stats',
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'th_TH',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'EPL Stats — Premier League club analytics' }],
  },
  twitter: { card: 'summary_large_image' },
};

const themeInitScript = `
  (function() {
    try {
      var theme = localStorage.getItem('mu-theme');
      document.documentElement.dataset.theme =
        theme === 'dark' || theme === 'light' ? theme : 'light';
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
      lang="en"
      data-theme="light"
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
          <I18nProvider>
            {children}
            <FeedbackButton />
            <TrackView />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
