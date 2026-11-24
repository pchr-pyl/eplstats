'use client';

import {
  PITCH_H,
  PITCH_W,
  type PitchOrientation,
  type PitchTheme,
  type ZoneOverlay,
} from '@/lib/tactical/types';
import { PITCH_PAD } from '@/lib/tactical/geometry';

interface PitchPalette {
  surround: string;
  stripeA: string;
  stripeB: string;
  line: string;
  lineMuted: string;
  goalNet: string;
  zoneLine: string;
  zoneText: string;
  halfSpaceTint: string;
  zone14Fill: string;
  zone14Stroke: string;
  trapFill: string;
  trapStroke: string;
}

export const PITCH_THEMES: Record<PitchTheme, PitchPalette> = {
  emerald: {
    surround: '#0a2717',
    stripeA: '#134e2a',
    stripeB: '#165a31',
    line: 'rgba(255,255,255,0.88)',
    lineMuted: 'rgba(255,255,255,0.28)',
    goalNet: 'rgba(255,255,255,0.24)',
    zoneLine: 'rgba(255,255,255,0.26)',
    zoneText: 'rgba(255,255,255,0.44)',
    halfSpaceTint: 'rgba(56,189,248,0.09)',
    zone14Fill: 'rgba(250,204,21,0.18)',
    zone14Stroke: 'rgba(250,204,21,0.75)',
    trapFill: 'rgba(244,63,94,0.14)',
    trapStroke: 'rgba(251,113,133,0.68)',
  },
  'dark-slate': {
    surround: '#080c12',
    stripeA: '#0f1722',
    stripeB: '#131d2b',
    line: 'rgba(148,163,184,0.64)',
    lineMuted: 'rgba(148,163,184,0.22)',
    goalNet: 'rgba(148,163,184,0.22)',
    zoneLine: 'rgba(56,189,248,0.26)',
    zoneText: 'rgba(125,211,252,0.45)',
    halfSpaceTint: 'rgba(56,189,248,0.08)',
    zone14Fill: 'rgba(250,204,21,0.16)',
    zone14Stroke: 'rgba(250,204,21,0.72)',
    trapFill: 'rgba(244,63,94,0.13)',
    trapStroke: 'rgba(251,113,133,0.65)',
  },
  blueprint: {
    surround: '#071120',
    stripeA: '#0c1c36',
    stripeB: '#0f2242',
    line: 'rgba(186,230,253,0.76)',
    lineMuted: 'rgba(125,211,252,0.25)',
    goalNet: 'rgba(125,211,252,0.26)',
    zoneLine: 'rgba(56,189,248,0.32)',
    zoneText: 'rgba(125,211,252,0.52)',
    halfSpaceTint: 'rgba(56,189,248,0.1)',
    zone14Fill: 'rgba(250,204,21,0.16)',
    zone14Stroke: 'rgba(250,204,21,0.75)',
    trapFill: 'rgba(244,63,94,0.14)',
    trapStroke: 'rgba(251,113,133,0.68)',
  },
  broadcast: {
    surround: '#0d361b',
    stripeA: '#1a6834',
    stripeB: '#1f773c',
    line: 'rgba(255,255,255,0.92)',
    lineMuted: 'rgba(255,255,255,0.32)',
    goalNet: 'rgba(255,255,255,0.28)',
    zoneLine: 'rgba(255,255,255,0.26)',
    zoneText: 'rgba(255,255,255,0.46)',
    halfSpaceTint: 'rgba(56,189,248,0.09)',
    zone14Fill: 'rgba(250,204,21,0.2)',
    zone14Stroke: 'rgba(250,204,21,0.8)',
    trapFill: 'rgba(244,63,94,0.15)',
    trapStroke: 'rgba(251,113,133,0.7)',
  },
  'light-tactical': {
    surround: '#e2e8f0',
    stripeA: '#f4f8f5',
    stripeB: '#ebf2ee',
    line: 'rgba(15,23,42,0.65)',
    lineMuted: 'rgba(15,23,42,0.24)',
    goalNet: 'rgba(15,23,42,0.1)',
    zoneLine: 'rgba(14,116,144,0.32)',
    zoneText: 'rgba(15,23,42,0.48)',
    halfSpaceTint: 'rgba(2,132,199,0.08)',
    zone14Fill: 'rgba(217,119,6,0.14)',
    zone14Stroke: 'rgba(217,119,6,0.78)',
    trapFill: 'rgba(225,29,72,0.1)',
    trapStroke: 'rgba(225,29,72,0.65)',
  },
};

export function PitchSvg({
  theme,
  orientation,
  zoneOverlay,
}: {
  theme: PitchTheme;
  orientation: PitchOrientation;
  zoneOverlay: ZoneOverlay;
}) {
  const pal = PITCH_THEMES[theme] ?? PITCH_THEMES.emerald;
  const stripes = 14;
  const stripeW = PITCH_W / stripes;

  // FIFA proportions (10px = 1m)
  const penW = 165;
  const penH = 403.2;
  const penY = (PITCH_H - penH) / 2; // 138.4
  const sixW = 55;
  const sixH = 183.2;
  const sixY = (PITCH_H - sixH) / 2; // 248.4
  const goalH = 73.2;
  const goalY = (PITCH_H - goalH) / 2;
  const goalD = 22;
  const penSpot = 110;
  const arcR = 91.5;
  const arcDy = Math.sqrt(arcR * arcR - (penW - penSpot) ** 2); // ~73.12

  const groupTransform =
    orientation === 'vertical'
      ? `translate(0, ${PITCH_W}) rotate(-90)`
      : undefined;

  return (
    <g transform={groupTransform}>
      {/* Surround apron */}
      <rect
        x={-PITCH_PAD}
        y={-PITCH_PAD}
        width={PITCH_W + PITCH_PAD * 2}
        height={PITCH_H + PITCH_PAD * 2}
        fill={pal.surround}
      />

      {/* Grass stripes */}
      <g>
        {Array.from({ length: stripes }).map((_, i) => (
          <rect
            key={i}
            x={i * stripeW}
            y={0}
            width={stripeW + 0.6}
            height={PITCH_H}
            fill={i % 2 === 0 ? pal.stripeA : pal.stripeB}
          />
        ))}
      </g>

      {/* Subtle perimeter shadow */}
      <rect
        x={0}
        y={0}
        width={PITCH_W}
        height={PITCH_H}
        fill="none"
        stroke="rgba(0,0,0,0.16)"
        strokeWidth={10}
      />

      {/* Tactical Zone Overlays */}
      {zoneOverlay === 'channels' && (
        <g pointerEvents="none">
          {/* Subtle tinted Left & Right Half-Space lanes */}
          <rect
            x={0}
            y={penY}
            width={PITCH_W}
            height={sixY - penY}
            fill={pal.halfSpaceTint}
          />
          <rect
            x={0}
            y={sixY + sixH}
            width={PITCH_W}
            height={penY + penH - (sixY + sixH)}
            fill={pal.halfSpaceTint}
          />
          {[penY, sixY, sixY + sixH, penY + penH].map((y, idx) => (
            <line
              key={idx}
              x1={0}
              y1={y}
              x2={PITCH_W}
              y2={y}
              stroke={pal.zoneLine}
              strokeWidth={1.6}
              strokeDasharray="7 7"
            />
          ))}
          {[
            { label: 'LEFT FLANK', y: penY / 2 },
            { label: 'LEFT HALF-SPACE', y: (penY + sixY) / 2 },
            { label: 'CENTRAL CORRIDOR', y: PITCH_H / 2 },
            { label: 'RIGHT HALF-SPACE', y: (sixY + sixH + penY + penH) / 2 },
            { label: 'RIGHT FLANK', y: (penY + penH + PITCH_H) / 2 },
          ].map((ch) => (
            <text
              key={ch.label}
              x={PITCH_W / 2}
              y={ch.y + 4}
              textAnchor="middle"
              fill={pal.zoneText}
              fontSize={11}
              fontWeight={700}
              letterSpacing="1.6"
            >
              {ch.label}
            </text>
          ))}
        </g>
      )}

      {zoneOverlay === 'thirds' && (
        <g pointerEvents="none">
          {[PITCH_W / 3, (PITCH_W * 2) / 3].map((x, idx) => (
            <line
              key={idx}
              x1={x}
              y1={0}
              x2={x}
              y2={PITCH_H}
              stroke={pal.zoneLine}
              strokeWidth={1.8}
              strokeDasharray="8 8"
            />
          ))}
          {[
            { label: 'DEFENSIVE THIRD (BUILD-UP)', x: PITCH_W / 6 },
            { label: 'MIDDLE THIRD (PROGRESSION)', x: PITCH_W / 2 },
            { label: 'FINAL THIRD (CREATION)', x: (PITCH_W * 5) / 6 },
          ].map((th) => (
            <text
              key={th.label}
              x={th.x}
              y={26}
              textAnchor="middle"
              fill={pal.zoneText}
              fontSize={10.5}
              fontWeight={700}
              letterSpacing="1.4"
            >
              {th.label}
            </text>
          ))}
        </g>
      )}

      {zoneOverlay === 'grid-18' && (
        <g pointerEvents="none">
          {/* Highlight Zone 14 (Col 4, Row 1 -> right outside attacking box!) */}
          <rect
            x={(PITCH_W / 6) * 4}
            y={PITCH_H / 3}
            width={PITCH_W / 6}
            height={PITCH_H / 3}
            fill={pal.zone14Fill}
            stroke={pal.zone14Stroke}
            strokeWidth={2}
          />
          {[1, 2, 3, 4, 5].map((i) => (
            <line
              key={`v-${i}`}
              x1={(PITCH_W / 6) * i}
              y1={0}
              x2={(PITCH_W / 6) * i}
              y2={PITCH_H}
              stroke={pal.zoneLine}
              strokeWidth={1.3}
              strokeDasharray="5 6"
            />
          ))}
          {[1, 2].map((j) => (
            <line
              key={`h-${j}`}
              x1={0}
              y1={(PITCH_H / 3) * j}
              x2={PITCH_W}
              y2={(PITCH_H / 3) * j}
              stroke={pal.zoneLine}
              strokeWidth={1.3}
              strokeDasharray="5 6"
            />
          ))}
          {Array.from({ length: 18 }).map((_, idx) => {
            // Standard 18-zone numbering: col 0..5 left-to-right, row 0..2 top-to-bottom => zone = col*3 + row + 1
            const col = Math.floor(idx / 3);
            const row = idx % 3;
            const zoneNum = idx + 1;
            const isZ14 = zoneNum === 14;
            return (
              <g key={zoneNum}>
                <text
                  x={(col + 0.5) * (PITCH_W / 6)}
                  y={(row + 0.5) * (PITCH_H / 3) + (isZ14 ? -4 : 5)}
                  textAnchor="middle"
                  fill={isZ14 ? pal.zone14Stroke : pal.zoneText}
                  fontSize={isZ14 ? 15 : 13}
                  fontWeight={800}
                >
                  Z{zoneNum}
                </text>
                {isZ14 && (
                  <text
                    x={(col + 0.5) * (PITCH_W / 6)}
                    y={(row + 0.5) * (PITCH_H / 3) + 14}
                    textAnchor="middle"
                    fill={pal.zone14Stroke}
                    fontSize={9.5}
                    fontWeight={700}
                    letterSpacing="1"
                  >
                    GOLDEN ZONE
                  </text>
                )}
              </g>
            );
          })}
        </g>
      )}

      {/* Juego de Posición (Pep Guardiola 20-Zone Positional Play Grid) */}
      {zoneOverlay === 'jdp-20' && (
        <g pointerEvents="none">
          {/* Shaded Half-Spaces across pitch */}
          <rect
            x={0}
            y={penY}
            width={PITCH_W}
            height={sixY - penY}
            fill={pal.halfSpaceTint}
          />
          <rect
            x={0}
            y={sixY + sixH}
            width={PITCH_W}
            height={penY + penH - (sixY + sixH)}
            fill={pal.halfSpaceTint}
          />
          {/* Zone 14 Golden Pocket inside attacking half */}
          <rect
            x={PITCH_W * 0.68}
            y={sixY}
            width={PITCH_W - penW - PITCH_W * 0.68}
            height={sixH}
            fill={pal.zone14Fill}
            stroke={pal.zone14Stroke}
            strokeWidth={1.6}
            strokeDasharray="5 4"
          />
          {/* 5 Vertical Channels */}
          {[penY, sixY, sixY + sixH, penY + penH].map((y, idx) => (
            <line
              key={`jdp-h-${idx}`}
              x1={0}
              y1={y}
              x2={PITCH_W}
              y2={y}
              stroke={pal.zoneLine}
              strokeWidth={1.5}
              strokeDasharray="6 6"
            />
          ))}
          {/* Horizontal Positional Lines: Box Edge (165), Build-up (345), Halfway (525), Pocket (705), Opp Box (885) */}
          {[penW, PITCH_W * 0.34, PITCH_W * 0.68, PITCH_W - penW].map(
            (x, idx) => (
              <line
                key={`jdp-v-${idx}`}
                x1={x}
                y1={0}
                x2={x}
                y2={PITCH_H}
                stroke={pal.zoneLine}
                strokeWidth={1.5}
                strokeDasharray="6 6"
              />
            ),
          )}
          {/* Labels */}
          {[
            { label: 'BUILD-UP', x: (penW + PITCH_W * 0.34) / 2 },
            { label: 'PIVOT / PROG', x: (PITCH_W * 0.34 + PITCH_W / 2) / 2 },
            { label: 'BETWEEN LINES', x: (PITCH_W / 2 + PITCH_W * 0.68) / 2 },
            { label: 'POCKETS / Z14', x: (PITCH_W * 0.68 + (PITCH_W - penW)) / 2 },
          ].map((col) => (
            <text
              key={col.label}
              x={col.x}
              y={20}
              textAnchor="middle"
              fill={pal.zoneText}
              fontSize={9.5}
              fontWeight={700}
              letterSpacing="1.2"
            >
              {col.label}
            </text>
          ))}
          <text
            x={(PITCH_W * 0.68 + (PITCH_W - penW)) / 2}
            y={PITCH_H / 2 + 4}
            textAnchor="middle"
            fill={pal.zone14Stroke}
            fontSize={11}
            fontWeight={800}
            letterSpacing="1.2"
          >
            ZONE 14
          </text>
          <text
            x={(PITCH_W * 0.68 + (PITCH_W - penW)) / 2}
            y={(penY + sixY) / 2 + 4}
            textAnchor="middle"
            fill={pal.zoneText}
            fontSize={10}
            fontWeight={700}
          >
            LHS POCKET
          </text>
          <text
            x={(PITCH_W * 0.68 + (PITCH_W - penW)) / 2}
            y={(sixY + sixH + penY + penH) / 2 + 4}
            textAnchor="middle"
            fill={pal.zoneText}
            fontSize={10}
            fontWeight={700}
          >
            RHS POCKET
          </text>
        </g>
      )}

      {/* Zone 14, Half-Space Pockets & Wide Pressing Traps */}
      {zoneOverlay === 'zone-14' && (
        <g pointerEvents="none">
          {/* Zone 14 Golden Box */}
          <rect
            x={PITCH_W - penW - 155}
            y={sixY}
            width={155}
            height={sixH}
            rx={8}
            fill={pal.zone14Fill}
            stroke={pal.zone14Stroke}
            strokeWidth={2}
          />
          <text
            x={PITCH_W - penW - 77.5}
            y={PITCH_H / 2 - 2}
            textAnchor="middle"
            fill={pal.zone14Stroke}
            fontSize={13}
            fontWeight={800}
          >
            ZONE 14
          </text>
          <text
            x={PITCH_W - penW - 77.5}
            y={PITCH_H / 2 + 14}
            textAnchor="middle"
            fill={pal.zone14Stroke}
            fontSize={9}
            fontWeight={700}
          >
            KEY ASSIST ZONE
          </text>

          {/* Left & Right Half-Space Pockets (Z13 & Z15) */}
          <rect
            x={PITCH_W - penW - 155}
            y={penY}
            width={155}
            height={sixY - penY}
            rx={6}
            fill={pal.halfSpaceTint}
            stroke={pal.zoneLine}
            strokeWidth={1.6}
            strokeDasharray="5 4"
          />
          <text
            x={PITCH_W - penW - 77.5}
            y={(penY + sixY) / 2 + 4}
            textAnchor="middle"
            fill={pal.zoneText}
            fontSize={10.5}
            fontWeight={700}
          >
            Z13 · LEFT HS
          </text>

          <rect
            x={PITCH_W - penW - 155}
            y={sixY + sixH}
            width={155}
            height={penY + penH - (sixY + sixH)}
            rx={6}
            fill={pal.halfSpaceTint}
            stroke={pal.zoneLine}
            strokeWidth={1.6}
            strokeDasharray="5 4"
          />
          <text
            x={PITCH_W - penW - 77.5}
            y={(sixY + sixH + penY + penH) / 2 + 4}
            textAnchor="middle"
            fill={pal.zoneText}
            fontSize={10.5}
            fontWeight={700}
          >
            Z15 · RIGHT HS
          </text>

          {/* Touchline Pressing Trap Zones (Left & Right Flanks in Middle/Attacking Third) */}
          {[
            { y: 12, label: 'PRESSING TRAP' },
            { y: PITCH_H - penY + 12, label: 'PRESSING TRAP' },
          ].map((trap, idx) => (
            <g key={idx}>
              <rect
                x={PITCH_W * 0.48}
                y={trap.y}
                width={215}
                height={penY - 24}
                rx={10}
                fill={pal.trapFill}
                stroke={pal.trapStroke}
                strokeWidth={1.6}
                strokeDasharray="6 5"
              />
              <text
                x={PITCH_W * 0.48 + 107.5}
                y={trap.y + (penY - 24) / 2 + 4}
                textAnchor="middle"
                fill={pal.trapStroke}
                fontSize={10}
                fontWeight={800}
                letterSpacing="1.2"
              >
                {trap.label}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* Main FIFA Pitch Lines */}
      <g
        fill="none"
        stroke={pal.line}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      >
        <rect x={0} y={0} width={PITCH_W} height={PITCH_H} />
        <line x1={PITCH_W / 2} y1={0} x2={PITCH_W / 2} y2={PITCH_H} />
        <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={arcR} />
        <circle
          cx={PITCH_W / 2}
          cy={PITCH_H / 2}
          r={4}
          fill={pal.line}
          stroke="none"
        />

        {/* Left Penalty Area & 6-yard Box */}
        <rect x={0} y={penY} width={penW} height={penH} />
        <rect x={0} y={sixY} width={sixW} height={sixH} />
        <circle
          cx={penSpot}
          cy={PITCH_H / 2}
          r={3.5}
          fill={pal.line}
          stroke="none"
        />
        <path
          d={`M ${penW} ${PITCH_H / 2 - arcDy} A ${arcR} ${arcR} 0 0 1 ${penW} ${PITCH_H / 2 + arcDy}`}
        />

        {/* Right Penalty Area & 6-yard Box */}
        <rect x={PITCH_W - penW} y={penY} width={penW} height={penH} />
        <rect x={PITCH_W - sixW} y={sixY} width={sixW} height={sixH} />
        <circle
          cx={PITCH_W - penSpot}
          cy={PITCH_H / 2}
          r={3.5}
          fill={pal.line}
          stroke="none"
        />
        <path
          d={`M ${PITCH_W - penW} ${PITCH_H / 2 - arcDy} A ${arcR} ${arcR} 0 0 0 ${PITCH_W - penW} ${PITCH_H / 2 + arcDy}`}
        />

        {/* Corner Arcs */}
        <path d="M 0 15 A 15 15 0 0 0 15 0" />
        <path d={`M ${PITCH_W - 15} 0 A 15 15 0 0 0 ${PITCH_W} 15`} />
        <path d={`M 0 ${PITCH_H - 15} A 15 15 0 0 1 15 ${PITCH_H}`} />
        <path
          d={`M ${PITCH_W - 15} ${PITCH_H} A 15 15 0 0 1 ${PITCH_W} ${PITCH_H - 15}`}
        />
      </g>

      {/* Left & Right Goals with net detail */}
      <g pointerEvents="none">
        <rect
          x={-goalD}
          y={goalY}
          width={goalD}
          height={goalH}
          fill={pal.goalNet}
          stroke={pal.line}
          strokeWidth={2.4}
        />
        {[1, 2, 3, 4, 5].map((i) => (
          <line
            key={`lgh-${i}`}
            x1={-goalD}
            y1={goalY + (goalH / 6) * i}
            x2={0}
            y2={goalY + (goalH / 6) * i}
            stroke={pal.lineMuted}
            strokeWidth={0.9}
          />
        ))}
        {[1, 2].map((i) => (
          <line
            key={`lgv-${i}`}
            x1={(-goalD / 3) * i}
            y1={goalY}
            x2={(-goalD / 3) * i}
            y2={goalY + goalH}
            stroke={pal.lineMuted}
            strokeWidth={0.9}
          />
        ))}

        <rect
          x={PITCH_W}
          y={goalY}
          width={goalD}
          height={goalH}
          fill={pal.goalNet}
          stroke={pal.line}
          strokeWidth={2.4}
        />
        {[1, 2, 3, 4, 5].map((i) => (
          <line
            key={`rgh-${i}`}
            x1={PITCH_W}
            y1={goalY + (goalH / 6) * i}
            x2={PITCH_W + goalD}
            y2={goalY + (goalH / 6) * i}
            stroke={pal.lineMuted}
            strokeWidth={0.9}
          />
        ))}
        {[1, 2].map((i) => (
          <line
            key={`rgv-${i}`}
            x1={PITCH_W + (goalD / 3) * i}
            y1={goalY}
            x2={PITCH_W + (goalD / 3) * i}
            y2={goalY + goalH}
            stroke={pal.lineMuted}
            strokeWidth={0.9}
          />
        ))}
      </g>
    </g>
  );
}
