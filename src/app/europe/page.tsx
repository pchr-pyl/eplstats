import type { Metadata } from 'next';
import { getClubIndex } from '@/lib/data';
import { getEuropeData } from '@/lib/europe';
import { EuropeClient } from '@/components/europe/EuropeClient';

export const metadata: Metadata = {
  title: 'Premier League in Europe — UCL, UEL & Conference League (2014–2027)',
  description:
    'Track every Premier League club in European competitions since 2014/15: Champions League, Europa League, Conference League & Super Cup participation matrix, finals roll of honor, match logs and all-time records.',
  alternates: { canonical: '/europe/' },
};

export default function EuropePage() {
  return <EuropeClient data={getEuropeData()} clubs={getClubIndex()} />;
}
