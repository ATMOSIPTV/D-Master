
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

export const getGeminiVoiceName = (voice: VoiceName): string => {
  if (voice === 'DUTRA') return 'Fenrir';
  return voice;
};

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

export type AudioEffectPreset =
  | 'none'
  | 'broadcast_fm'
  | 'radio_vintage'
  | 'stadium_arena'
  | 'studio_reverb'
  | 'deep_bass'
  | 'delay_echo'
  | 'cyber_robot';

export interface EffectPresetOption {
  id: AudioEffectPreset;
  label: string;
  category: 'broadcast' | 'spatial' | 'creative';
  description: string;
  icon: string;
  recommendedFor: string;
}

export const AUDIO_EFFECT_PRESETS: EffectPresetOption[] = [
  {
    id: 'none',
    label: 'Voz Direta (Clean Studio)',
    category: 'broadcast',
    description: 'Áudio original limpo de estúdio, sem coloração artificial.',
    icon: '🎙️',
    recommendedFor: 'Locuções institucionais e podcasts'
  },
  {
    id: 'broadcast_fm',
    label: 'Rádio FM Broadcast',
    category: 'broadcast',
    description: 'Compressão dinâmica com punch, presença cristalina e brilho de alta frequência.',
    icon: '📻',
    recommendedFor: 'Comerciais de rádio FM e spots de varejo'
  },
  {
    id: 'deep_bass',
    label: 'Grave Titânico (Bass Booster)',
    category: 'broadcast',
    description: 'Reforço potente nos sub-graves para voz com autoridade máxima e peso.',
    icon: '🔊',
    recommendedFor: 'Spots de impacto, cinema e ofertas urgentes'
  },
  {
    id: 'radio_vintage',
    label: 'Megafone / Carro de Som',
    category: 'creative',
    description: 'Filtro passa-faixa com saturação harmônica e timbre metálico característico.',
    icon: '📢',
    recommendedFor: 'Carro de som de rua, anúncios populares e humor'
  },
  {
    id: 'stadium_arena',
    label: 'Arena & Rodeio (Estádio)',
    category: 'spatial',
    description: 'Grande reverb aberto com reflexões longas simulando som de arena esportiva.',
    icon: '🏟️',
    recommendedFor: 'Festas de peão, eventos esportivos e shows'
  },
  {
    id: 'studio_reverb',
    label: 'Reverb Quântico de Sala',
    category: 'spatial',
    description: 'Ambiência aveludada de estúdio de gravação de primeira linha.',
    icon: '✨',
    recommendedFor: 'Comerciais de luxo, marcas e mensagens motivacionais'
  },
  {
    id: 'delay_echo',
    label: 'Eco de Vinheta (Delay Rítmico)',
    category: 'spatial',
    description: 'Repetições estéreo suaves para criação de vinhetas e assinaturas de rádio.',
    icon: '🌊',
    recommendedFor: 'Vinhetas de rádio e transições de impacto'
  },
  {
    id: 'cyber_robot',
    label: 'Cyber Modulator (Robótico)',
    category: 'creative',
    description: 'Modulação metálica futurista com ambiência espacial.',
    icon: '🤖',
    recommendedFor: 'Spots de tecnologia, games e ficção'
  }
];

export type SfxProfile =
  | 'radio_standard'
  | 'heavy_impact'
  | 'sound_truck'
  | 'news_flash'
  | 'acoustic_clean';

export interface SfxProfileOption {
  id: SfxProfile;
  label: string;
  description: string;
  icon: string;
  tags: string[];
}

export const SFX_PROFILES: SfxProfileOption[] = [
  {
    id: 'radio_standard',
    label: 'Rádio FM Padrão',
    description: 'Whooshes de passagem, batidas de abertura e transições dinâmicas de rádio.',
    icon: '📻',
    tags: ['WHOOSH', 'TRANSITION', 'SWEEP']
  },
  {
    id: 'heavy_impact',
    label: 'Impacto Cinema & Varejo',
    description: 'Sub-bass drops pesados, risers metálicos e impactos para chamar atenção total.',
    icon: '💥',
    tags: ['SUB_BOOM', 'METAL_HIT', 'EXPLOSION']
  },
  {
    id: 'sound_truck',
    label: 'Carro de Som & Arena',
    description: 'Sirenes curtas, fanfarras, aplausos e sinos de anúncio popular.',
    icon: '📢',
    tags: ['SIREN', 'FANFARE', 'BELLS']
  },
  {
    id: 'news_flash',
    label: 'Plantão / Urgente',
    description: 'Bips estilo código morse, pulso de urgência e alerta dramático.',
    icon: '🚨',
    tags: ['MORSE_BEEP', 'EMERGENCY_ALARM', 'URGENT_DRUM']
  },
  {
    id: 'acoustic_clean',
    label: 'Clean & Sofisticado',
    description: 'Sem ruídos agressivos; transições suaves com sinos discretos e pads.',
    icon: '✨',
    tags: ['SOFT_CHIME', 'AMBIENT_SWELL', 'MINIMAL']
  }
];

