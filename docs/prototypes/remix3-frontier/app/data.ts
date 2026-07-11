// Sample editorial data, flavor-matched to the store's crate (ambient /
// neo-classical vinyl). Deliberately inline: the spike is self-contained and
// never touches the real frozen snapshot.

export interface Pick {
  title: string
  artist: string
  label: string
  year: number
  blurb: string
}

export const PICKS: Pick[] = [
  {
    title: 'Sleep',
    artist: 'Max Richter',
    label: 'Deutsche Grammophon',
    year: 2015,
    blurb: 'Eight hours of post-minimalist rest — the overnight landmark.',
  },
  {
    title: 'A Winged Victory for the Sullen',
    artist: 'A Winged Victory for the Sullen',
    label: 'Erased Tapes',
    year: 2011,
    blurb: 'Drone-leaning chamber ambient; strings breathe under tape hiss.',
  },
  {
    title: 'Immunity',
    artist: 'Jon Hopkins',
    label: 'Domino',
    year: 2013,
    blurb: 'Melodic techno that dissolves into piano and room tone.',
  },
  {
    title: 'Felt',
    artist: 'Nils Frahm',
    label: 'Erased Tapes',
    year: 2011,
    blurb: 'Close-miked felted piano — mechanism as instrument.',
  },
  {
    title: 'And Their Refinement of the Decline',
    artist: 'Stars of the Lid',
    label: 'Kranky',
    year: 2007,
    blurb: 'Two hours of orchestral drift; the genre’s reference weight.',
  },
]

export function clampPick(raw: string | null): number {
  const n = raw === null ? 0 : Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0) return 0
  return n % PICKS.length
}
