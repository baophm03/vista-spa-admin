const RANK_CARD_ART: Record<string, string> = {
  vip: 'gold',
  gold: 'gold',
  'kim cuong': 'diamond',
  diamond: 'diamond',
  'ruby vista': 'ruby-vista',
  'rubi vista': 'ruby-vista',
  rubivista: 'ruby-vista',
}

export function getRankCardArt(name?: string) {
  const key = name?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  return key && Object.prototype.hasOwnProperty.call(RANK_CARD_ART, key) ? RANK_CARD_ART[key] : undefined
}
