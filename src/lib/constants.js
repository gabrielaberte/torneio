export const GENDERS = { M: 'Masculino', F: 'Feminino' };

export const EVENT_TYPES = {
  ace:         { label: 'Ace',            emoji: '🔥', good: true,  stat: 'aces',        point: 'self' },
  attack:      { label: 'Ataque (ponto)', emoji: '💥', good: true,  stat: 'attacksGood', point: 'self' },
  block:       { label: 'Bloqueio',       emoji: '🧱', good: true,  stat: 'blocks',      point: 'self' },
  drop:        { label: 'Largada/Outros', emoji: '🎯', good: true,  stat: 'drops',       point: 'self' },
  attackError: { label: 'Erro de Ataque', emoji: '❌', good: false, stat: 'attacksBad',  point: 'opponent' },
  serveError:  { label: 'Erro de Saque',  emoji: '🚫', good: false, stat: 'serveErrors', point: 'opponent' },
  netTouch:    { label: 'Toque na Rede',  emoji: '🕸️', good: false, stat: 'netTouches',  point: 'opponent' }
};

export function emptyStats() {
  return { points: 0, aces: 0, attacksGood: 0, attacksBad: 0, blocks: 0, netTouches: 0, serveErrors: 0, mishits: 0, drops: 0, mvp: 0 };
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
