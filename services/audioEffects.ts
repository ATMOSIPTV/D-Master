import { AudioEffectPreset } from '../types';

/**
 * Cria uma resposta de impulso algorítmica estéreo para simular salas e arenas.
 */
function createReverbImpulse(
  ctx: BaseAudioContext,
  duration: number,
  decay: number,
  reverse: boolean = false
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = reverse ? length - i : i;
    // Curva de decaimento exponencial com dispersão estéreo
    const factor = Math.exp(-n / (sampleRate * decay));
    left[i] = (Math.random() * 2 - 1) * factor;
    right[i] = (Math.random() * 2 - 1) * factor;
  }

  return impulse;
}

/**
 * Cria uma curva de transferência não linear suave para saturação valvulada.
 */
function makeDistortionCurve(amount: number = 20): Float32Array {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;

  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export interface EqualizerSettings {
  bass: number; // -12dB a +12dB
  mid: number;  // -12dB a +12dB
  treble: number; // -12dB a +12dB
}

/**
 * Conecta a cadeia de efeitos de áudio em tempo real ou offline.
 * Retorna o nó de saída que deve ser conectado ao destino ou master.
 */
export function buildAudioEffectsChain(
  ctx: BaseAudioContext,
  sourceNode: AudioNode,
  preset: AudioEffectPreset,
  intensity: number = 100, // 0 a 100
  eq: EqualizerSettings = { bass: 0, mid: 0, treble: 0 }
): AudioNode {
  const normIntensity = Math.max(0, Math.min(100, intensity)) / 100;

  // 1. Equalizador de 3 bandas (sempre presente para ajuste de master)
  const lowFilter = ctx.createBiquadFilter();
  lowFilter.type = 'lowshelf';
  lowFilter.frequency.value = 120;
  lowFilter.gain.value = eq.bass;

  const midFilter = ctx.createBiquadFilter();
  midFilter.type = 'peaking';
  midFilter.frequency.value = 1500;
  midFilter.Q.value = 1.0;
  midFilter.gain.value = eq.mid;

  const highFilter = ctx.createBiquadFilter();
  highFilter.type = 'highshelf';
  highFilter.frequency.value = 8000;
  highFilter.gain.value = eq.treble;

  sourceNode.connect(lowFilter);
  lowFilter.connect(midFilter);
  midFilter.connect(highFilter);

  // Se preset for 'none' e intensidade 0, apenas o EQ vai para o output
  if (preset === 'none' || normIntensity <= 0) {
    return highFilter;
  }

  // 2. Nós para roteamento Wet / Dry (efeito processado vs sinal direto)
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const masterOut = ctx.createGain();

  dryGain.gain.value = 1 - normIntensity * 0.45;
  wetGain.gain.value = normIntensity;

  highFilter.connect(dryGain);
  dryGain.connect(masterOut);

  // 3. Processador específico por Preset
  switch (preset) {
    case 'broadcast_fm': {
      // Corte de graves subsônicos
      const rumbleCut = ctx.createBiquadFilter();
      rumbleCut.type = 'highpass';
      rumbleCut.frequency.value = 80;

      // Presença de voz e clareza
      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 3500;
      presence.gain.value = 4 * normIntensity;
      presence.Q.value = 1.2;

      // Brilho aéreo
      const air = ctx.createBiquadFilter();
      air.type = 'highshelf';
      air.frequency.value = 10000;
      air.gain.value = 2.5 * normIntensity;

      // Compressor dinâmico de broadcast
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 6;
      comp.ratio.value = 6;
      comp.attack.value = 0.005;
      comp.release.value = 0.12;

      highFilter.connect(rumbleCut);
      rumbleCut.connect(presence);
      presence.connect(air);
      air.connect(comp);
      comp.connect(wetGain);
      break;
    }

    case 'deep_bass': {
      // Reforço poderoso nos graves de locução
      const subBoost = ctx.createBiquadFilter();
      subBoost.type = 'lowshelf';
      subBoost.frequency.value = 110;
      subBoost.gain.value = 7.5 * normIntensity;

      const punchFilter = ctx.createBiquadFilter();
      punchFilter.type = 'peaking';
      punchFilter.frequency.value = 220;
      punchFilter.gain.value = 3 * normIntensity;
      punchFilter.Q.value = 1.4;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.01;
      comp.release.value = 0.2;

      highFilter.connect(subBoost);
      subBoost.connect(punchFilter);
      punchFilter.connect(comp);
      comp.connect(wetGain);
      break;
    }

    case 'radio_vintage': {
      // Efeito telefone / megafone / rádio AM
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1400;
      bandpass.Q.value = 1.8;

      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(25 * normIntensity) as any;
      shaper.oversample = '2x';

      const highCut = ctx.createBiquadFilter();
      highCut.type = 'lowpass';
      highCut.frequency.value = 3200;

      highFilter.connect(bandpass);
      bandpass.connect(shaper);
      shaper.connect(highCut);
      highCut.connect(wetGain);
      break;
    }

    case 'stadium_arena': {
      // Reverb grande de estádio / arena com eco
      const convolver = ctx.createConvolver();
      convolver.buffer = createReverbImpulse(ctx, 2.6, 1.8);

      const delay = ctx.createDelay();
      delay.delayTime.value = 0.18;

      const feedback = ctx.createGain();
      feedback.gain.value = 0.35 * normIntensity;

      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 3500;

      delay.connect(feedback);
      feedback.connect(delayFilter);
      delayFilter.connect(delay);

      highFilter.connect(convolver);
      highFilter.connect(delay);
      convolver.connect(wetGain);
      delay.connect(wetGain);
      break;
    }

    case 'studio_reverb': {
      // Reverb aveludado de estúdio quântico
      const convolver = ctx.createConvolver();
      convolver.buffer = createReverbImpulse(ctx, 1.4, 0.9);

      const damping = ctx.createBiquadFilter();
      damping.type = 'lowpass';
      damping.frequency.value = 5500;

      highFilter.connect(damping);
      damping.connect(convolver);
      convolver.connect(wetGain);
      break;
    }

    case 'delay_echo': {
      // Delay rítmico estéreo suave
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.22;

      const feedback = ctx.createGain();
      feedback.gain.value = 0.42 * normIntensity;

      const damping = ctx.createBiquadFilter();
      damping.type = 'lowpass';
      damping.frequency.value = 4000;

      delay.connect(feedback);
      feedback.connect(damping);
      damping.connect(delay);

      highFilter.connect(delay);
      delay.connect(wetGain);
      break;
    }

    case 'cyber_robot': {
      // Modulação Sci-Fi com chorus e ressonância metálica
      const combDelay = ctx.createDelay();
      combDelay.delayTime.value = 0.015;

      const combFeedback = ctx.createGain();
      combFeedback.gain.value = 0.75 * normIntensity;

      const resonantFilter = ctx.createBiquadFilter();
      resonantFilter.type = 'peaking';
      resonantFilter.frequency.value = 1800;
      resonantFilter.Q.value = 6;
      resonantFilter.gain.value = 8 * normIntensity;

      combDelay.connect(combFeedback);
      combFeedback.connect(combDelay);

      highFilter.connect(combDelay);
      combDelay.connect(resonantFilter);
      resonantFilter.connect(wetGain);
      break;
    }

    default:
      highFilter.connect(wetGain);
      break;
  }

  wetGain.connect(masterOut);
  return masterOut;
}

/**
 * Processa um AudioBuffer offline aplicando a cadeia de efeitos DSP selecionada.
 * Utilizado para exportar a Master WAV já com os efeitos embutidos.
 */
export async function processAudioBufferWithEffects(
  inputBuffer: AudioBuffer,
  preset: AudioEffectPreset,
  intensity: number = 100,
  eq: EqualizerSettings = { bass: 0, mid: 0, treble: 0 }
): Promise<AudioBuffer> {
  if (preset === 'none' && eq.bass === 0 && eq.mid === 0 && eq.treble === 0) {
    return inputBuffer;
  }

  const sampleRate = inputBuffer.sampleRate;
  const numChannels = inputBuffer.numberOfChannels;
  // Margem adicional para cauda de reverb/delay (1.5 segundos se houver espacialização)
  const tailDuration = preset === 'stadium_arena' ? 2.5 : preset === 'delay_echo' || preset === 'studio_reverb' ? 1.5 : 0.2;
  const totalLength = inputBuffer.length + Math.floor(sampleRate * tailDuration);

  const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineCtxClass) {
    return inputBuffer;
  }

  const offlineCtx = new OfflineCtxClass(numChannels, totalLength, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = inputBuffer;

  const effectOutput = buildAudioEffectsChain(offlineCtx, source, preset, intensity, eq);
  effectOutput.connect(offlineCtx.destination);

  source.start(0);
  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer;
}

/**
 * Converte um AudioBuffer diretamente em um Blob WAV 16-bit PCM de alta fidelidade.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const length = buffer.length;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Intercalar canais e converter Float32 para Int16
  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamping
      sample = Math.max(-1, Math.min(1, sample));
      const int16 = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

/* =========================================================================
   MESA DE EFEITOS SONOROS DE RÁDIO SINTETIZADOS (SFX SOUNDBOARD)
   Totalmente sintetizados no navegador via Web Audio API, sem depender de rede!
   ========================================================================= */

export interface RadioSfxTrigger {
  id: string;
  name: string;
  category: 'impact' | 'transition' | 'alert' | 'fun';
  icon: string;
  play: (ctx: AudioContext, volume?: number) => void;
}

/**
 * 1. Sub-Boom de Impacto Comercial
 */
export function playSfxImpact(ctx: AudioContext, volume: number = 0.8) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Pitch sweep rápido de sub-grave (160Hz caindo para 35Hz)
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(32, now + 0.6);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

  // Ruído percussivo no ataque
  const bufferSize = ctx.sampleRate * 0.15;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 400;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.7, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  noise.start(now);
  osc.stop(now + 0.85);
  noise.stop(now + 0.25);
}

/**
 * 2. Whoosh / Transição Estéreo Dinâmica
 */
export function playSfxWhoosh(ctx: AudioContext, volume: number = 0.65) {
  const now = ctx.currentTime;
  const duration = 0.6;
  const bufferSize = ctx.sampleRate * duration;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 3.0;
  filter.frequency.setValueAtTime(250, now);
  filter.frequency.exponentialRampToValueAtTime(3200, now + duration * 0.5);
  filter.frequency.exponentialRampToValueAtTime(300, now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(volume, now + duration * 0.45);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration + 0.05);
}

/**
 * 3. Bip de Alerta / Plantão Urgente
 */
export function playSfxAlert(ctx: AudioContext, volume: number = 0.6) {
  const now = ctx.currentTime;
  const beeps = [0, 0.12, 0.24];

  beeps.forEach(delay => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now + delay);
    osc.frequency.setValueAtTime(1600, now + delay + 0.04);

    gain.gain.setValueAtTime(volume, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.1);
  });
}

/**
 * 4. Laser / Sci-Fi Spark
 */
export function playSfxLaser(ctx: AudioContext, volume: number = 0.6) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(2400, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.25);

  gain.gain.setValueAtTime(volume * 0.8, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

/**
 * 5. Estática de Sintonia de Rádio (Radio Dial)
 */
export function playSfxStatic(ctx: AudioContext, volume: number = 0.55) {
  const now = ctx.currentTime;
  const duration = 0.45;
  const bufferSize = ctx.sampleRate * duration;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    // Ruído estático estalado
    const crackle = Math.random() > 0.93 ? (Math.random() * 2 - 1) * 1.5 : 0;
    data[i] = (Math.random() * 2 - 1) * 0.5 + crackle;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(1800, now);
  band.frequency.linearRampToValueAtTime(800, now + duration);
  band.Q.value = 2.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(band);
  band.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration + 0.05);
}

/**
 * 6. Palmas / Torcida de Arena & Rodeio
 */
export function playSfxApplause(ctx: AudioContext, volume: number = 0.7) {
  const now = ctx.currentTime;
  const duration = 1.2;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let i = 0; i < bufferSize; i++) {
    const decay = Math.sin((i / bufferSize) * Math.PI);
    const pop = Math.random() > 0.88 ? (Math.random() * 2 - 1) * 1.8 : (Math.random() * 2 - 1) * 0.3;
    left[i] = pop * decay;
    right[i] = (pop + (Math.random() * 0.2 - 0.1)) * decay;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1600;
  filter.Q.value = 1.2;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
  source.stop(now + duration + 0.1);
}

/**
 * 7. Caixa Registradora / Dinheiro / Oferta (Varejo)
 */
export function playSfxCash(ctx: AudioContext, volume: number = 0.65) {
  const now = ctx.currentTime;

  // Sino metálico duplo
  const freqs = [2093, 2793]; // C7, F7
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const delay = idx * 0.09;
    gain.gain.setValueAtTime(volume, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.7);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.75);
  });
}

/**
 * Lista de Gatilhos da Mesa de Efeitos Rápidos (Soundboard)
 */
export const RADIO_SFX_TRIGGERS: RadioSfxTrigger[] = [
  {
    id: 'impact',
    name: 'Impacto Sub',
    category: 'impact',
    icon: '💥',
    play: playSfxImpact
  },
  {
    id: 'whoosh',
    name: 'Whoosh / Passagem',
    category: 'transition',
    icon: '🚀',
    play: playSfxWhoosh
  },
  {
    id: 'alert',
    name: 'Bip Plantão',
    category: 'alert',
    icon: '🚨',
    play: playSfxAlert
  },
  {
    id: 'cash',
    name: 'Sino / Oferta',
    category: 'fun',
    icon: '🔔',
    play: playSfxCash
  },
  {
    id: 'static',
    name: 'Sintonia Dial',
    category: 'alert',
    icon: '📻',
    play: playSfxStatic
  },
  {
    id: 'applause',
    name: 'Palmas Arena',
    category: 'fun',
    icon: '👏',
    play: playSfxApplause
  },
  {
    id: 'laser',
    name: 'Laser Sci-Fi',
    category: 'transition',
    icon: '⚡',
    play: playSfxLaser
  }
];
