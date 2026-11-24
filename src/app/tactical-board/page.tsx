import type { Metadata } from 'next';
import { TacticalBoardStudio } from '@/components/tactical/TacticalBoardStudio';
import { getTacticalBootstrapData } from '@/lib/tactical/serverData';

export const metadata: Metadata = {
  title: 'Tactical Board & Match Analyzer',
  description:
    'Interactive Premier League Football Tactical Board: real club squads, formations, drawing tools, multi-scene animations, project storage and PNG/SVG/Video export.',
  alternates: { canonical: '/tactical-board/' },
};

export default function TacticalBoardPage() {
  const bootstrap = getTacticalBootstrapData();
  return (
    <div className="h-[100dvh] w-full">
      <TacticalBoardStudio bootstrap={bootstrap} />
    </div>
  );
}
