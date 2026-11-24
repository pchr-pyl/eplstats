import {
  PITCH_H,
  PITCH_W,
  type BoardPlayer,
  type CustomFormationPreset,
  type FormationId,
  type PlayerRoleGroup,
  type RosterPlayer,
  type TacticalPhasePresetId,
  type TeamSide,
  type ZoneOverlay,
} from './types';

export interface FormationSlot {
  role: string;
  group: PlayerRoleGroup;
  /** Preferred sub-positions from real squad data for smart auto-assignment */
  preferredSubPos?: string[];
  /** Home side attacking L -> R (logical 0..1050, 0..680) */
  x: number;
  y: number;
}

export interface FormationDef {
  id: FormationId;
  label: string;
  description: string;
  slots: FormationSlot[];
}

export const FORMATIONS: FormationDef[] = [
  {
    id: '4-3-3',
    label: '4-3-3',
    description: 'Back four, single pivot, two 8s, front three',
    slots: [
      { role: 'GK', group: 'GK', preferredSubPos: ['GK'], x: 72, y: 340 },
      { role: 'LB', group: 'DF', preferredSubPos: ['LB', 'LWB'], x: 215, y: 112 },
      { role: 'LCB', group: 'DF', preferredSubPos: ['CB'], x: 185, y: 262 },
      { role: 'RCB', group: 'DF', preferredSubPos: ['CB'], x: 185, y: 418 },
      { role: 'RB', group: 'DF', preferredSubPos: ['RB', 'RWB'], x: 215, y: 568 },
      { role: 'DM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 328, y: 340 },
      { role: 'LCM', group: 'MF', preferredSubPos: ['CM', 'AM'], x: 392, y: 210 },
      { role: 'RCM', group: 'MF', preferredSubPos: ['CM', 'AM'], x: 392, y: 470 },
      { role: 'LW', group: 'FW', preferredSubPos: ['LW', 'LM', 'AM'], x: 468, y: 132 },
      { role: 'ST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 492, y: 340 },
      { role: 'RW', group: 'FW', preferredSubPos: ['RW', 'RM', 'AM'], x: 468, y: 548 },
    ],
  },
  {
    id: '4-2-3-1',
    label: '4-2-3-1',
    description: 'Back four, double pivot, three AMs, lone striker',
    slots: [
      { role: 'GK', group: 'GK', preferredSubPos: ['GK'], x: 72, y: 340 },
      { role: 'LB', group: 'DF', preferredSubPos: ['LB', 'LWB'], x: 210, y: 112 },
      { role: 'LCB', group: 'DF', preferredSubPos: ['CB'], x: 182, y: 262 },
      { role: 'RCB', group: 'DF', preferredSubPos: ['CB'], x: 182, y: 418 },
      { role: 'RB', group: 'DF', preferredSubPos: ['RB', 'RWB'], x: 210, y: 568 },
      { role: 'LDM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 318, y: 258 },
      { role: 'RDM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 318, y: 422 },
      { role: 'LAM', group: 'FW', preferredSubPos: ['LW', 'LM', 'AM'], x: 422, y: 140 },
      { role: 'CAM', group: 'MF', preferredSubPos: ['AM', 'CM'], x: 420, y: 340 },
      { role: 'RAM', group: 'FW', preferredSubPos: ['RW', 'RM', 'AM'], x: 422, y: 540 },
      { role: 'ST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 496, y: 340 },
    ],
  },
  {
    id: '4-4-2',
    label: '4-4-2',
    description: 'Classic two banks of four with twin strikers',
    slots: [
      { role: 'GK', group: 'GK', preferredSubPos: ['GK'], x: 72, y: 340 },
      { role: 'LB', group: 'DF', preferredSubPos: ['LB'], x: 205, y: 112 },
      { role: 'LCB', group: 'DF', preferredSubPos: ['CB'], x: 182, y: 262 },
      { role: 'RCB', group: 'DF', preferredSubPos: ['CB'], x: 182, y: 418 },
      { role: 'RB', group: 'DF', preferredSubPos: ['RB'], x: 205, y: 568 },
      { role: 'LM', group: 'MF', preferredSubPos: ['LW', 'LM', 'AM'], x: 356, y: 118 },
      { role: 'LCM', group: 'MF', preferredSubPos: ['CM', 'DM'], x: 340, y: 268 },
      { role: 'RCM', group: 'MF', preferredSubPos: ['CM', 'DM'], x: 340, y: 412 },
      { role: 'RM', group: 'MF', preferredSubPos: ['RW', 'RM', 'AM'], x: 356, y: 562 },
      { role: 'LST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 482, y: 262 },
      { role: 'RST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 482, y: 418 },
    ],
  },
  {
    id: '3-4-3',
    label: '3-4-3',
    description: 'Back three, high wingbacks, double pivot, front three',
    slots: [
      { role: 'GK', group: 'GK', preferredSubPos: ['GK'], x: 72, y: 340 },
      { role: 'LCB', group: 'DF', preferredSubPos: ['CB', 'LB'], x: 188, y: 185 },
      { role: 'CCB', group: 'DF', preferredSubPos: ['CB'], x: 174, y: 340 },
      { role: 'RCB', group: 'DF', preferredSubPos: ['CB', 'RB'], x: 188, y: 495 },
      { role: 'LWB', group: 'DF', preferredSubPos: ['LB', 'LWB', 'LW'], x: 340, y: 98 },
      { role: 'LCM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 328, y: 265 },
      { role: 'RCM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 328, y: 415 },
      { role: 'RWB', group: 'DF', preferredSubPos: ['RB', 'RWB', 'RW'], x: 340, y: 582 },
      { role: 'LW', group: 'FW', preferredSubPos: ['LW', 'AM'], x: 454, y: 182 },
      { role: 'ST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 495, y: 340 },
      { role: 'RW', group: 'FW', preferredSubPos: ['RW', 'AM'], x: 454, y: 498 },
    ],
  },
  {
    id: '3-5-2',
    label: '3-5-2',
    description: 'Back three, wingbacks, midfield triangle, front pair',
    slots: [
      { role: 'GK', group: 'GK', preferredSubPos: ['GK'], x: 72, y: 340 },
      { role: 'LCB', group: 'DF', preferredSubPos: ['CB'], x: 188, y: 185 },
      { role: 'CCB', group: 'DF', preferredSubPos: ['CB'], x: 174, y: 340 },
      { role: 'RCB', group: 'DF', preferredSubPos: ['CB'], x: 188, y: 495 },
      { role: 'LWB', group: 'DF', preferredSubPos: ['LB', 'LWB'], x: 344, y: 96 },
      { role: 'DM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 306, y: 340 },
      { role: 'LCM', group: 'MF', preferredSubPos: ['CM', 'AM'], x: 382, y: 224 },
      { role: 'RCM', group: 'MF', preferredSubPos: ['CM', 'AM'], x: 382, y: 456 },
      { role: 'RWB', group: 'DF', preferredSubPos: ['RB', 'RWB'], x: 344, y: 584 },
      { role: 'LST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 484, y: 256 },
      { role: 'RST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 484, y: 424 },
    ],
  },
  {
    id: '4-1-4-1',
    label: '4-1-4-1',
    description: 'Compact midfield four ahead of a dedicated holding 6',
    slots: [
      { role: 'GK', group: 'GK', preferredSubPos: ['GK'], x: 72, y: 340 },
      { role: 'LB', group: 'DF', preferredSubPos: ['LB'], x: 204, y: 112 },
      { role: 'LCB', group: 'DF', preferredSubPos: ['CB'], x: 182, y: 262 },
      { role: 'RCB', group: 'DF', preferredSubPos: ['CB'], x: 182, y: 418 },
      { role: 'RB', group: 'DF', preferredSubPos: ['RB'], x: 204, y: 568 },
      { role: 'DM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 298, y: 340 },
      { role: 'LM', group: 'MF', preferredSubPos: ['LW', 'LM'], x: 398, y: 116 },
      { role: 'LCM', group: 'MF', preferredSubPos: ['CM', 'AM'], x: 392, y: 260 },
      { role: 'RCM', group: 'MF', preferredSubPos: ['CM', 'AM'], x: 392, y: 420 },
      { role: 'RM', group: 'MF', preferredSubPos: ['RW', 'RM'], x: 398, y: 564 },
      { role: 'ST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 496, y: 340 },
    ],
  },
  {
    id: '4-4-2-diamond',
    label: '4-4-2 Diamond',
    description: 'Narrow midfield diamond with #10 behind two strikers',
    slots: [
      { role: 'GK', group: 'GK', preferredSubPos: ['GK'], x: 72, y: 340 },
      { role: 'LB', group: 'DF', preferredSubPos: ['LB'], x: 215, y: 108 },
      { role: 'LCB', group: 'DF', preferredSubPos: ['CB'], x: 182, y: 262 },
      { role: 'RCB', group: 'DF', preferredSubPos: ['CB'], x: 182, y: 418 },
      { role: 'RB', group: 'DF', preferredSubPos: ['RB'], x: 215, y: 572 },
      { role: 'DM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 298, y: 340 },
      { role: 'LCM', group: 'MF', preferredSubPos: ['CM'], x: 358, y: 216 },
      { role: 'RCM', group: 'MF', preferredSubPos: ['CM'], x: 358, y: 464 },
      { role: 'CAM', group: 'MF', preferredSubPos: ['AM'], x: 424, y: 340 },
      { role: 'LST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 490, y: 250 },
      { role: 'RST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 490, y: 430 },
    ],
  },
  {
    id: '3-4-2-1',
    label: '3-4-2-1',
    description: 'Box midfield with two interior 10s in the half-spaces',
    slots: [
      { role: 'GK', group: 'GK', preferredSubPos: ['GK'], x: 72, y: 340 },
      { role: 'LCB', group: 'DF', preferredSubPos: ['CB'], x: 188, y: 185 },
      { role: 'CCB', group: 'DF', preferredSubPos: ['CB'], x: 174, y: 340 },
      { role: 'RCB', group: 'DF', preferredSubPos: ['CB'], x: 188, y: 495 },
      { role: 'LWB', group: 'DF', preferredSubPos: ['LB', 'LWB'], x: 340, y: 98 },
      { role: 'LDM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 320, y: 266 },
      { role: 'RDM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 320, y: 414 },
      { role: 'RWB', group: 'DF', preferredSubPos: ['RB', 'RWB'], x: 340, y: 582 },
      { role: 'LAM', group: 'FW', preferredSubPos: ['AM', 'LW'], x: 428, y: 222 },
      { role: 'RAM', group: 'FW', preferredSubPos: ['AM', 'RW'], x: 428, y: 458 },
      { role: 'ST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 498, y: 340 },
    ],
  },
  {
    id: '5-3-2',
    label: '5-3-2',
    description: 'Low-block back five with counter-attacking front two',
    slots: [
      { role: 'GK', group: 'GK', preferredSubPos: ['GK'], x: 72, y: 340 },
      { role: 'LWB', group: 'DF', preferredSubPos: ['LB', 'LWB'], x: 226, y: 98 },
      { role: 'LCB', group: 'DF', preferredSubPos: ['CB'], x: 184, y: 215 },
      { role: 'CCB', group: 'DF', preferredSubPos: ['CB'], x: 174, y: 340 },
      { role: 'RCB', group: 'DF', preferredSubPos: ['CB'], x: 184, y: 465 },
      { role: 'RWB', group: 'DF', preferredSubPos: ['RB', 'RWB'], x: 226, y: 582 },
      { role: 'LCM', group: 'MF', preferredSubPos: ['CM', 'DM'], x: 356, y: 218 },
      { role: 'CM', group: 'MF', preferredSubPos: ['DM', 'CM'], x: 332, y: 340 },
      { role: 'RCM', group: 'MF', preferredSubPos: ['CM', 'DM'], x: 356, y: 462 },
      { role: 'LST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 480, y: 256 },
      { role: 'RST', group: 'FW', preferredSubPos: ['CF', 'ST'], x: 480, y: 424 },
    ],
  },
];

export function getFormation(id: FormationId): FormationDef {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}

export function mirrorSlotForAway(slot: FormationSlot): FormationSlot {
  return {
    ...slot,
    x: PITCH_W - slot.x,
    y: PITCH_H - slot.y,
  };
}

export function getSlotsForSide(
  formationId: FormationId,
  side: TeamSide,
  customSlots?: { role: string; group: PlayerRoleGroup; x: number; y: number }[],
): FormationSlot[] {
  const base: FormationSlot[] = customSlots ?? getFormation(formationId).slots;
  return side === 'home' ? base : base.map(mirrorSlotForAway);
}

/**
 * Matches real club roster players into the 11 formation slots by natural position
 * and real-season starts/minutes. Never fabricates players — if a roster has fewer
 * than 11 players, only available real players are placed (or clearly labeled Empty Slot).
 */
export function buildLineupFromRoster(
  roster: RosterPlayer[],
  formationId: FormationId,
  side: TeamSide,
  customSlots?: { role: string; group: PlayerRoleGroup; x: number; y: number }[],
): BoardPlayer[] {
  const slots = getSlotsForSide(formationId, side, customSlots);
  // Prioritize active starters by real minutes / starts
  const pool = [...roster].sort(
    (a, b) => (b.starts ?? -1) - (a.starts ?? -1) || (b.min ?? -1) - (a.min ?? -1),
  );
  const used = new Set<string>();

  const pickBest = (slot: FormationSlot): RosterPlayer | null => {
    // 1. Exact subPos match
    if (slot.preferredSubPos?.length) {
      const exact = pool.find(
        (p) =>
          !used.has(p.id) &&
          p.subPos &&
          slot.preferredSubPos!.includes(p.subPos.toUpperCase()),
      );
      if (exact) return exact;
    }
    // 2. Role group match
    const byGroup = pool.find((p) => !used.has(p.id) && p.pos === slot.group);
    if (byGroup) return byGroup;
    // 3. Outfield fallback (never pick a second GK for outfield if outfielders exist)
    if (slot.group !== 'GK') {
      const outfield = pool.find((p) => !used.has(p.id) && p.pos !== 'GK');
      if (outfield) return outfield;
    }
    return pool.find((p) => !used.has(p.id)) ?? null;
  };

  return slots.map((slot, idx) => {
    const picked = pickBest(slot);
    if (picked) {
      used.add(picked.id);
      return {
        id: `${side}-slot-${idx}`,
        rosterId: picked.id,
        team: side,
        name: picked.name,
        shortName: picked.shortName,
        number: picked.number,
        pos: picked.pos,
        slotRole: slot.role,
        x: slot.x,
        y: slot.y,
        size: 1,
        isGk: slot.group === 'GK',
        source: picked.source,
      };
    }
    return {
      id: `${side}-slot-${idx}`,
      rosterId: null,
      team: side,
      name: `${slot.role} (Empty)`,
      shortName: slot.role,
      number: '',
      pos: slot.group,
      slotRole: slot.role,
      x: slot.x,
      y: slot.y,
      size: 1,
      isGk: slot.group === 'GK',
      source: 'custom',
    };
  });
}

/**
 * Repositions an existing team's on-pitch players into a new formation
 * preserving player IDs so scene animations continue smoothly!
 */
export function applyFormationToExistingPlayers(
  existing: BoardPlayer[],
  formationId: FormationId,
  side: TeamSide,
  customSlots?: { role: string; group: PlayerRoleGroup; x: number; y: number }[],
): BoardPlayer[] {
  const slots = getSlotsForSide(formationId, side, customSlots);
  const teamPlayers = existing.filter((p) => p.team === side);
  const otherPlayers = existing.filter((p) => p.team !== side);

  const used = new Set<string>();
  const repositioned: BoardPlayer[] = [];

  for (const slot of slots) {
    const match =
      teamPlayers.find(
        (p) => !used.has(p.id) && p.slotRole === slot.role,
      ) ??
      teamPlayers.find(
        (p) => !used.has(p.id) && p.isGk === (slot.group === 'GK') && p.pos === slot.group,
      ) ??
      teamPlayers.find(
        (p) => !used.has(p.id) && p.isGk === (slot.group === 'GK'),
      ) ??
      teamPlayers.find((p) => !used.has(p.id));

    if (match) {
      used.add(match.id);
      repositioned.push({
        ...match,
        slotRole: slot.role,
        isGk: slot.group === 'GK',
        x: slot.x,
        y: slot.y,
      });
    }
  }

  // Keep any extra players (>11) where they are
  for (const p of teamPlayers) {
    if (!used.has(p.id)) repositioned.push(p);
  }

  return [...otherPlayers, ...repositioned];
}

const CUSTOM_FORMATIONS_KEY = 'epl-tactical-custom-formations-v1';

export function loadCustomFormations(): CustomFormationPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_FORMATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomFormation(preset: CustomFormationPreset): CustomFormationPreset[] {
  const current = loadCustomFormations().filter((p) => p.id !== preset.id);
  const next = [...current, preset];
  if (typeof window !== 'undefined') {
    localStorage.setItem(CUSTOM_FORMATIONS_KEY, JSON.stringify(next));
  }
  return next;
}

export function deleteCustomFormation(id: string): CustomFormationPreset[] {
  const next = loadCustomFormations().filter((p) => p.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem(CUSTOM_FORMATIONS_KEY, JSON.stringify(next));
  }
  return next;
}

export interface TacticalPhasePreset {
  id: TacticalPhasePresetId;
  label: string;
  tag: string;
  description: string;
  recommendedOverlay: ZoneOverlay;
  slots: FormationSlot[];
}

/**
 * Modern tactical phase shapes (Juego de Posición / Rest-Defense / Pressing)
 * aligned directly with the 5 Vertical Channels & Zone 14 geometry.
 */
export const TACTICAL_PHASE_PRESETS: TacticalPhasePreset[] = [
  {
    id: 'buildup-325',
    label: '3-2-5 Build-up',
    tag: 'In-Possession',
    description:
      'Inverted FB joins pivot (3-2 rest-defense); 5 attackers occupy Left Flank, Left HS, Central, Right HS & Right Flank.',
    recommendedOverlay: 'jdp-20',
    slots: [
      { role: 'GK', group: 'GK', x: 88, y: 340 },
      { role: 'LCB', group: 'DF', x: 285, y: 175 },
      { role: 'CCB', group: 'DF', x: 265, y: 340 },
      { role: 'RCB', group: 'DF', x: 285, y: 505 },
      { role: 'LDM', group: 'MF', x: 438, y: 245 },
      { role: 'RDM', group: 'MF', x: 438, y: 435 },
      { role: 'LW', group: 'FW', x: 655, y: 74 },
      { role: 'LHS', group: 'MF', x: 642, y: 205 },
      { role: 'ST', group: 'FW', x: 745, y: 340 },
      { role: 'RHS', group: 'MF', x: 642, y: 475 },
      { role: 'RW', group: 'FW', x: 655, y: 606 },
    ],
  },
  {
    id: 'attack-235',
    label: '2-3-5 Rest-Defense',
    tag: 'Final Third',
    description:
      '2 CBs + 3-man counter-press screen behind a 5-lane front line pinning opposition back four.',
    recommendedOverlay: 'channels',
    slots: [
      { role: 'GK', group: 'GK', x: 115, y: 340 },
      { role: 'LCB', group: 'DF', x: 350, y: 245 },
      { role: 'RCB', group: 'DF', x: 350, y: 435 },
      { role: 'L-INV', group: 'DF', x: 515, y: 185 },
      { role: 'DM', group: 'MF', x: 500, y: 340 },
      { role: 'R-INV', group: 'DF', x: 515, y: 495 },
      { role: 'LW', group: 'FW', x: 740, y: 72 },
      { role: 'LHS', group: 'MF', x: 715, y: 202 },
      { role: 'ST', group: 'FW', x: 815, y: 340 },
      { role: 'RHS', group: 'MF', x: 715, y: 478 },
      { role: 'RW', group: 'FW', x: 740, y: 608 },
    ],
  },
  {
    id: 'high-press-442',
    label: '4-4-2 High Press',
    tag: 'Pressing Trap',
    description:
      'Two strikers curve runs to block central pivot and funnel opposition into touchline pressing traps.',
    recommendedOverlay: 'zone-14',
    slots: [
      { role: 'GK', group: 'GK', x: 165, y: 340 },
      { role: 'LB', group: 'DF', x: 455, y: 122 },
      { role: 'LCB', group: 'DF', x: 430, y: 265 },
      { role: 'RCB', group: 'DF', x: 430, y: 415 },
      { role: 'RB', group: 'DF', x: 455, y: 558 },
      { role: 'LM', group: 'MF', x: 625, y: 115 },
      { role: 'LCM', group: 'MF', x: 600, y: 268 },
      { role: 'RCM', group: 'MF', x: 600, y: 412 },
      { role: 'RM', group: 'MF', x: 625, y: 565 },
      { role: 'LST', group: 'FW', x: 785, y: 245 },
      { role: 'RST', group: 'FW', x: 785, y: 435 },
    ],
  },
  {
    id: 'low-block-541',
    label: '5-4-1 Low Block',
    tag: 'Protect Z14',
    description:
      'Compact 5-4 defensive shell denying Zone 14 & Half-Space pockets while keeping a central outlet.',
    recommendedOverlay: 'zone-14',
    slots: [
      { role: 'GK', group: 'GK', x: 58, y: 340 },
      { role: 'LWB', group: 'DF', x: 165, y: 120 },
      { role: 'LCB', group: 'DF', x: 145, y: 228 },
      { role: 'CCB', group: 'DF', x: 138, y: 340 },
      { role: 'RCB', group: 'DF', x: 145, y: 452 },
      { role: 'RWB', group: 'DF', x: 165, y: 560 },
      { role: 'LM', group: 'MF', x: 278, y: 160 },
      { role: 'LCM', group: 'MF', x: 264, y: 278 },
      { role: 'RCM', group: 'MF', x: 264, y: 402 },
      { role: 'RM', group: 'MF', x: 278, y: 520 },
      { role: 'ST', group: 'FW', x: 415, y: 340 },
    ],
  },
];

export function getTacticalPhasePreset(
  id: TacticalPhasePresetId,
): TacticalPhasePreset | undefined {
  return TACTICAL_PHASE_PRESETS.find((p) => p.id === id);
}

