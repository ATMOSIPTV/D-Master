
export interface ScriptLine {
  speaker: 'DUTRA' | 'Sadaltager';
  text: string;
  direction?: string; // Instrução de atuação
  timestamp: string; // Ex: [00:00.0 - 00:05.0]
  sfx_tag?: string; // Tag de efeito sonoro vinculada
  action_instruction?: string; // Ex: "Baixar fundo", "Subir impacto"
}

export interface ScriptOutput {
  title: string;
  bgm_suggestion: string;
  sfx_hints: string[];
  total_duration: string; // Duração total esperada
  lines: ScriptLine[];
}

export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'DUTRA' | 'Zephyr';

export const AVAILABLE_VOICES: { name: VoiceName; description: string; gender: 'M' | 'F' }[] = [
  { name: 'Charon', description: '1. MASCULINA SUPER GRAVE (Impacto, Autoridade e Motivação)', gender: 'M' },
  { name: 'DUTRA', description: '2. MASCULINA APOIO/PAPÉIS (Vendedor e Testemunhal)', gender: 'M' },
  { name: 'Kore', description: '3. FEMININA CLARA (Aspectos Femininos e Inspiração)', gender: 'F' },
  { name: 'Puck', description: '4. MASCULINA VERSÁTIL (Interpretação e Apoio)', gender: 'M' },
  { name: 'Zephyr', description: '5. MASCULINA SUAVE (Narração, Naturalidade e Reflexão)', gender: 'M' },
];

export const PERSONAS = [
  { id: 'standard', label: 'Padrão / Profissional', icon: '🎙️' },
  { id: 'caipira', label: 'Caipira / Interior', description: 'Sotaque do interior, tom amigável e simples', icon: '🤠' },
  { id: 'rodeio', label: 'Locutor de Rodeio (Marcos Brasil)', description: 'Voz potente, versos emocionantes e ritmo de arena', icon: '🐂' },
  { id: 'evangelico', label: 'Evangélico / Gospel', description: 'Tom inspirador, respeitoso e espiritual', icon: '🙏' },
  { id: 'humorista', label: 'Humorista / Engraçado', description: 'Tom cômico, piadas rápidas e caricato', icon: '🤡' },
  { id: 'executive', label: 'Executivo / Sóbrio', description: 'Tom de negócios, sério e direto', icon: '💼' }
];

export const NARRATIVE_STYLES = [
  { id: 'hard_sell', label: 'Venda Direta (Varejo)', icon: '⚡' },
  { id: 'luxury', label: 'Premium / Sofisticado', icon: '💎' },
  { id: 'motivational', label: 'Motivacional / Inspirador', icon: '🔥' },
  { id: 'storytelling', label: 'Narrativo / Storytelling', icon: '📖' },
  { id: 'cool', label: 'Estilo Despojado / Jovem', icon: '🎧' },
  { id: 'promo', label: 'Promoção / Sorteio', icon: '🎁' },
  { id: 'sound_truck', label: 'Carro de Som / Ofertas', icon: '📢' },
  { id: 'youtube', label: 'Conteúdo Digital / Social', icon: '📱' },
  { id: 'dynamic_retail', label: 'Comercial Dinâmico (Varejo)', icon: '🍕' }
];

export const DURATIONS = [
  { label: '15 Segundos (Flash)', value: 15 },
  { label: '30 Segundos (Padrão)', value: 30 },
  { label: '60 Segundos (Testemunhal)', value: 60 },
  { label: 'Tempo Livre (Sem Limite)', value: 0 }
];

export const TONES = ['Vendedor', 'Institucional', 'Informativo', 'Sensacionalista', 'Descontraído'];
export const EMPHASES = ['Velocidade Máxima', 'Pausas Dramáticas', 'Intensidade de Volume', 'Ritmo Musical'];
export const EMOTIONS = ['Empolgado', 'Sério', 'Confiante', 'Amigável', 'Urgente'];
