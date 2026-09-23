
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
  ScriptOutput, 
  VoiceName, 
  AVAILABLE_VOICES, 
  getGeminiVoiceName,
  NARRATIVE_STYLES, 
  DURATIONS,
  TONES, 
  EMOTIONS,
  PERSONAS,
  AudioEffectPreset,
  AUDIO_EFFECT_PRESETS,
  SfxProfile,
  SFX_PROFILES
} from './types';
import { decode, decodeAudioData, createWavBlob } from './services/audioUtils';
import {
  buildAudioEffectsChain,
  processAudioBufferWithEffects,
  audioBufferToWavBlob,
  RADIO_SFX_TRIGGERS,
  EqualizerSettings
} from './services/audioEffects';
import { 
  Zap, 
  Gem, 
  Flame, 
  BookOpen, 
  Headphones, 
  Gift, 
  MessageSquare, 
  Smartphone, 
  ShoppingBag,
  Megaphone,
  Settings,
  Play,
  Pause,
  Download,
  FileText,
  Volume2,
  VolumeX,
  ChevronRight,
  Sparkles,
  Radio,
  Clock,
  User,
  Users,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  RotateCcw,
  Info,
  ImagePlus,
  Trash2,
  Upload,
  Key,
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  Sliders,
  SlidersHorizontal,
  Wand2,
  Music,
  Disc,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STYLE_ICONS: Record<string, React.ReactNode> = {
  hard_sell: <Zap className="w-5 h-5" />,
  luxury: <Gem className="w-5 h-5" />,
  motivational: <Flame className="w-5 h-5" />,
  storytelling: <BookOpen className="w-5 h-5" />,
  cool: <Headphones className="w-5 h-5" />,
  promo: <Gift className="w-5 h-5" />,
  sound_truck: <Megaphone className="w-5 h-5" />,
  youtube: <Smartphone className="w-5 h-5" />,
  dynamic_retail: <ShoppingBag className="w-5 h-5" />
};

const App: React.FC = () => {
  const [theme, setTheme] = useState('');
  // App Mode State (Reverted to Studio only)
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState<ScriptOutput | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<Uint8Array | null>(null);
  
  // Customization States
  const [narrativeStyle, setNarrativeStyle] = useState(NARRATIVE_STYLES[0].id);
  const [intensity, setIntensity] = useState(70); // 0-100
  const [targetDuration, setTargetDuration] = useState(30);
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0].id);
  const [singleSpeaker, setSingleSpeaker] = useState(false);

  // Audio Effects & Master DSP States
  const [sfxProfile, setSfxProfile] = useState<SfxProfile>('radio_standard');
  const [activeAudioEffect, setActiveAudioEffect] = useState<AudioEffectPreset>('broadcast_fm');
  const [effectIntensity, setEffectIntensity] = useState<number>(85);
  const [effectBypass, setEffectBypass] = useState<boolean>(false);
  const [eqSettings, setEqSettings] = useState<EqualizerSettings>({
    bass: 2.5,
    mid: 1.5,
    treble: 2.0
  });
  const [showEffectsModal, setShowEffectsModal] = useState<boolean>(false);
  const [activeSfxTriggerId, setActiveSfxTriggerId] = useState<string | null>(null);
  const [exportingWav, setExportingWav] = useState<boolean>(false);
  
  // Voice Settings
  const [dutraVoice, setDutraVoice] = useState<VoiceName>('Charon');
  const [sadaltagerVoice, setSadaltagerVoice] = useState<VoiceName>('Kore');
  
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showApiHelp, setShowApiHelp] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialTab, setTutorialTab] = useState<'quickstart' | 'personas' | 'effects' | 'image' | 'faq'>('quickstart');
  const [testingApi, setTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aboutTab, setAboutTab] = useState<'map' | 'recipes' | 'tips' | 'engine'>('map');
  const [campaignImage, setCampaignImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const getApiKey = () => {
    return (
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      (typeof window !== 'undefined' && (window as any).__GEMINI_API_KEY__) ||
      ''
    );
  };

  const parseApiError = (err: any): string => {
    const raw = (err?.message || err?.statusText || String(err)).toLowerCase();
    if (raw.includes('permission_denied') || raw.includes('403') || raw.includes('caller does not have permission') || raw.includes('api negada')) {
      return "API Negada (Erro 403 / Permissão): A chave de API não possui permissão para a Generative Language API ou possui restrições ativas. Clique em 'Como Resolver' para o guia detalhado.";
    }
    if (raw.includes('api key not valid') || raw.includes('api_key_invalid') || raw.includes('invalid api key')) {
      return "Chave Inválida: A chave GEMINI_API_KEY configurada não é válida ou foi revogada.";
    }
    if (raw.includes('quota') || raw.includes('resource_exhausted') || raw.includes('429')) {
      return "Cota de API Excedida (Erro 429): Limite de requisições por minuto atingido. Aguarde 1 minuto e tente novamente.";
    }
    if (raw.includes('não encontrada no ambiente') || raw.includes('chave de api')) {
      return "Chave de API não encontrada: Configure GEMINI_API_KEY nas variáveis de ambiente ou arquivo .env.";
    }
    return err?.message || "Erro desconhecido na comunicação com a API Google Gemini.";
  };

  const testApiConnection = async () => {
    setTestingApi(true);
    setTestResult(null);
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error("Chave GEMINI_API_KEY não foi encontrada no ambiente (.env).");
      }
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'Responda com apenas uma palavra: OK',
      });
      if (res.text) {
        setTestResult({
          success: true,
          message: "Conexão com a API Google Gemini validada com sucesso! A chave está autorizada e pronta para produzir."
        });
        addLog("Teste de API Gemini bem-sucedido.", "success");
      } else {
        throw new Error("A API respondeu mas sem conteúdo.");
      }
    } catch (e: any) {
      const friendly = parseApiError(e);
      setTestResult({
        success: false,
        message: friendly
      });
      addLog("Falha no teste de conexão da API.", "warn");
    } finally {
      setTestingApi(false);
    }
  };

  // System Logs State
  const [logs, setLogs] = useState<{ id: number; msg: string; type: 'info' | 'warn' | 'success' }[]>([]);
  const logIdRef = useRef(0);

  const addLog = (msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    const id = ++logIdRef.current;
    setLogs(prev => [{ id, msg, type }, ...prev].slice(0, 5));
  };

  // Waveform State
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: 20 }, () => 10));
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (playing) {
      waveformIntervalRef.current = setInterval(() => {
        setWaveform(Array.from({ length: 20 }, () => Math.floor(Math.random() * 60) + 10));
      }, 100);
    } else {
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
      setWaveform(Array.from({ length: 20 }, () => 10));
    }
    return () => {
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
    };
  }, [playing]);

  // Data Visualization Mock Data
  const activityData = useMemo(() => Array.from({ length: 12 }, () => Math.floor(Math.random() * 100)), []);
  const connectionLines = useMemo(() => Array.from({ length: 5 }, () => ({
    x1: Math.random() * 100,
    y1: Math.random() * 100,
    x2: Math.random() * 100,
    y2: Math.random() * 100,
  })), []);

  useEffect(() => {
    const savedDutra = localStorage.getItem('dutraVoice') as VoiceName;
    const savedSadaltager = localStorage.getItem('sadaltagerVoice') as VoiceName;
    if (savedDutra && AVAILABLE_VOICES.some(v => v.name === savedDutra)) setDutraVoice(savedDutra);
    if (savedSadaltager && AVAILABLE_VOICES.some(v => v.name === savedSadaltager)) setSadaltagerVoice(savedSadaltager);
  }, []);

  useEffect(() => {
    localStorage.setItem('dutraVoice', dutraVoice);
    localStorage.setItem('sadaltagerVoice', sadaltagerVoice);
  }, [dutraVoice, sadaltagerVoice]);

  // Enforce opposite sex for Special Modes (60s or Sound Truck)
  useEffect(() => {
    const isSpecialMode = targetDuration === 60 || narrativeStyle === 'sound_truck';
    if (isSpecialMode) {
      const g1 = AVAILABLE_VOICES.find(v => v.name === dutraVoice)?.gender;
      const g2 = AVAILABLE_VOICES.find(v => v.name === sadaltagerVoice)?.gender;
      if (g1 === g2) {
        const oppositeGender = g1 === 'M' ? 'F' : 'M';
        const newSadaltager = AVAILABLE_VOICES.find(v => v.gender === oppositeGender)?.name;
        if (newSadaltager) {
          setSadaltagerVoice(newSadaltager);
          setNotification("Modo Especial: Ajustado para vozes de sexos opostos.");
          setTimeout(() => setNotification(null), 3000);
        }
      }
    }
  }, [targetDuration, narrativeStyle, dutraVoice, sadaltagerVoice]);

  const showSuccess = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  const personaLabel = PERSONAS.find(p => p.id === selectedPersona)?.label;
  const styleLabel = NARRATIVE_STYLES.find(s => s.id === narrativeStyle)?.label;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Imagem muito grande. Limite de 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCampaignImage(reader.result as string);
        addLog("Imagem da campanha carregada.", "info");
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setCampaignImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    addLog("Imagem da campanha removida.", "info");
  };

  const triggerSoundEffect = (trigger: (ctx: AudioContext) => void, id: string) => {
    try {
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      trigger(ctx);
      setActiveSfxTriggerId(id);
      setTimeout(() => setActiveSfxTriggerId(null), 700);
      addLog(`Efeito sonoro disparado: ${id.toUpperCase()}`, "info");
    } catch (e) {
      console.error("Erro ao disparar SFX:", e);
    }
  };

  const generateScript = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    setError(null);
    setScript(null);
    setGeneratedAudio(null);
    
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error("Chave de API (GEMINI_API_KEY) não encontrada no ambiente.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const durationLabel = targetDuration === 0 ? "Tempo Livre" : `${targetDuration} segundos`;
      
      const selectedSfx = SFX_PROFILES.find(p => p.id === sfxProfile) || SFX_PROFILES[0];
      const sfxInstructions = `- PERFIL DE EFEITOS SONOROS (SFX): ${selectedSfx.label}.
        Estilo de Sonoplastia: ${selectedSfx.description}.
        Tags de efeitos recomendadas para sfx_hints e sfx_tag: ${selectedSfx.tags.map(t => `[SFX: ${t}]`).join(', ')}.
        O campo sfx_hints DEVE conter sugestões alinhadas a este estilo de efeitos e transições sonoras.`;

      addLog(`Iniciando síntese D' MASTER PRODUTORA...`, "info");
      addLog(`Estilo: ${styleLabel} | Persona: ${personaLabel} | SFX: ${selectedSfx.label}`, "info");

      const personaInstructions = selectedPersona === 'caipira' 
        ? "- Use dialeto caipira autêntico (ex: 'uai', 'sô', 'trem', 'r' retroflexo/puxado, gírias do interior)."
        : selectedPersona === 'rodeio'
        ? "- Use o estilo épico de LOCUTOR DE RODEIO. Mantenha a potência e a emoção, mas com um fluxo vocal PREMIUM e fluido. Evite excesso de pontuação que fragmente a locução. Use pausas naturais apenas para impacto, focando em uma interpretação contínua e profissional."
        : selectedPersona === 'evangelico'
        ? "- Use tom inspirador, respeitoso, espiritual e acolhedor (ex: 'Paz do Senhor', 'Abençoado', 'Glória', tom de testemunho ou convite)."
        : selectedPersona === 'humorista'
        ? "- Use tom cômico, piadas rápidas, trocadilhos e uma entrega caricata e divertida (ex: imitações leves, risadas, tom de stand-up)."
        : selectedPersona === 'executive'
        ? "- Use tom formal, direto, corporativo e sóbrio."
        : "- Use tom profissional padrão de rádio.";

      const styleInstructions = narrativeStyle === 'sound_truck'
        ? "- ESTILO CARRO DE SOM (PREMIUM): Use uma locução vibrante e impactante, mas mantendo um fluxo natural e profissional. Evite o ritmo 'picotado'; prefira frases completas com entonações que guiem a atenção sem interrupções artificiais."
        : "";

      const prompt = `Atue como um REDATOR DE RÁDIO E TV PREMIADO. Crie um roteiro de alta conversão.
        TEMA: "${theme}"
        ${campaignImage ? "Analise também a imagem enviada para entender melhor o produto ou contexto da campanha." : ""}
        ESTILO: ${styleLabel}
        PERSONA DO LOCUTOR: ${personaLabel}
        INTENSIDADE: ${intensity}%
        DURAÇÃO: ${durationLabel}.
        LOCUÇÃO: ${singleSpeaker ? 'APENAS DUTRA' : 'DUTRA e SADALTAGER'}

        REGRAS DE OURO (Siga rigorosamente):
        ${singleSpeaker ? `- Use APENAS o locutor DUTRA com a persona ${personaLabel}.` : `- Use os dois locutores para contraste. O locutor principal (DUTRA) DEVE usar a persona ${personaLabel}.`}
        ${personaInstructions}
        ${styleInstructions}
        ${sfxInstructions}
        - Use GATILHOS MENTAIS.
        - Use o campo 'direction' para descrever detalhadamente a INTENCIONALIDADE, EMOÇÃO e VARIAÇÃO DE VOLUME (ex: [Gritando com empolgação], [Sussurrando oferta secreta], [Subindo o tom gradualmente]).
        - REGRAS DE TEXTO: Mantenha a grafia correta das palavras. NUNCA alongue vogais artificialmente (evite 'Promoçãaaaao'). A emoção deve vir da interpretação, não da escrita deformada.
        - PONTUAÇÃO PREMIUM: Pontue o texto de forma natural. Evite o uso excessivo de vírgulas ou reticências. O objetivo é uma locução FLUÍDA, contínua e elegante, como nos melhores comerciais de TV de luxo. Use a técnica 'Legato' vocal: as palavras devem se conectar suavemente.
        - VARIAÇÃO DE TIMBRE: Alterne a intensidade emocional entre os blocos para que a voz não fique linear.
        - O roteiro deve ter apenas o que está no áudio (sem nomes de clientes ou explicações).
        - Inclua:
          1. Sincronia (Timestamps): [00:00.0 - 00:00.0]
          2. Identificadores de Efeito (Tags): SFX vinculados aos blocos de tempo.
          3. Clareza de Ação: Instruções para fundo musical (ex: "Baixar fundo", "Subir impacto").
          4. Consistência: A duração total deve bater com a duração do áudio.`;

      const contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
      
      if (campaignImage) {
        const mimeType = campaignImage.split(';')[0].split(':')[1];
        const base64Data = campaignImage.split(',')[1];
        contents[0].parts.push({
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: base64Data
          }
        });
        addLog("Analisando imagem da campanha...", "info");
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              bgm_suggestion: { type: Type.STRING },
              sfx_hints: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Lista de efeitos sonoros sugeridos"
              },
              total_duration: { type: Type.STRING },
              lines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: { type: Type.STRING, enum: ['DUTRA', 'Sadaltager'] },
                    text: { type: Type.STRING },
                    direction: { type: Type.STRING },
                    timestamp: { type: Type.STRING },
                    sfx_tag: { type: Type.STRING },
                    action_instruction: { type: Type.STRING }
                  },
                  required: ["speaker", "text", "direction", "timestamp"]
                }
              }
            },
            required: ["title", "lines", "bgm_suggestion", "total_duration", "sfx_hints"]
          }
        }
      });

      if (!response.text) throw new Error("Resposta vazia da IA.");
      
      // Limpeza robusta de JSON (remove blocos de código markdown se existirem)
      const cleanJson = response.text.replace(/```json\n?|```/g, "").trim();
      const data = JSON.parse(cleanJson) as ScriptOutput;
      
      setScript(data);
      addLog("Roteiro sintetizado com sucesso!", "success");
      showSuccess("Roteiro Criativo Gerado!");
    } catch (err: any) {
      console.error("Erro no generateScript:", err);
      const friendly = parseApiError(err);
      setError(friendly);
      addLog("Falha na síntese do roteiro.", "warn");
    } finally {
      setLoading(false);
    }
  };

  const resetConsole = () => {
    setTheme('');
    setScript(null);
    setGeneratedAudio(null);
    setError(null);
    setSfxProfile('radio_standard');
    setActiveAudioEffect('broadcast_fm');
    setEffectIntensity(85);
    setEffectBypass(false);
    setEqSettings({ bass: 2.5, mid: 1.5, treble: 2.0 });
    addLog("Console reinicializado.", "info");
  };

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {
        console.error("Erro ao parar áudio:", e);
      }
      sourceRef.current = null;
    }
    setPlaying(false);
  };

  const playScript = async () => {
    if (!script) return;
    if (playing) {
      stopAudio();
      return;
    }
    
    if (generatedAudio) {
      setPlaying(true);
      try {
        const ctx = initAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        let audioBuffer: AudioBuffer;
        try {
          const copy = generatedAudio.buffer.slice(generatedAudio.byteOffset, generatedAudio.byteOffset + generatedAudio.byteLength);
          audioBuffer = await ctx.decodeAudioData(copy);
        } catch {
          audioBuffer = await decodeAudioData(generatedAudio, ctx, 24000, 1);
        }
        const source = ctx.createBufferSource();
        sourceRef.current = source;
        source.buffer = audioBuffer;
        
        // Roteamento pelo processador de efeitos DSP
        const effectOutput = buildAudioEffectsChain(
          ctx,
          source,
          effectBypass ? 'none' : activeAudioEffect,
          effectIntensity,
          eqSettings
        );
        effectOutput.connect(ctx.destination);

        source.onended = () => {
          setPlaying(false);
          sourceRef.current = null;
        };
        source.start();
      } catch (e) {
        console.error("Erro ao reproduzir áudio cacheado:", e);
        setPlaying(false);
      }
      return;
    }

    setPlaying(true);
    setError(null);
    addLog("Iniciando renderização de áudio...", "info");
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error("Chave de API (GEMINI_API_KEY) não encontrada no ambiente.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const validLines = script.lines.filter(l => l && l.text && l.text.trim().length > 0);
      if (validLines.length === 0) {
        throw new Error("O roteiro não contém linhas de texto para locução.");
      }

      const uniqueSpeakers = Array.from(new Set(validLines.map(l => l.speaker)));
      const isMultiSpeaker = !singleSpeaker && uniqueSpeakers.length > 1;

      const styleDescription = [
        narrativeStyle === 'dynamic_retail' ? 'Comercial dinâmico, alta energia e persuasivo' : '',
        narrativeStyle === 'motivational' ? 'Inspirador e elegante' : '',
        narrativeStyle === 'sound_truck' ? 'Locução de alto impacto, dicção limpa e potente' : '',
        selectedPersona === 'rodeio' ? 'Locutor épico de rodeio, potente e contínuo' : '',
        selectedPersona === 'caipira' ? 'Sotaque caipira autêntico' : '',
      ].filter(Boolean).join(', ') || 'Locução profissional fluida';

      let pcmBytes: Uint8Array;

      if (isMultiSpeaker) {
        addLog("Renderizando áudio multi-voz com 2 locutores (DUTRA e Sadaltager)...", "info");

        // Construir cada parte com speech_metadata explícito para cada locutor
        const parts = validLines.map(line => {
          const speakerName = line.speaker === 'Sadaltager' ? 'Sadaltager' : 'DUTRA';
          const lineStyle = [line.direction, styleDescription].filter(Boolean).join('. ');
          return {
            text: `${speakerName}: ${line.text}`,
            speech_metadata: {
              speaker: speakerName,
              style: lineStyle
            },
            speechMetadata: {
              speaker: speakerName,
              style: lineStyle
            }
          };
        });

        // Garantir que ambos os locutores estejam presentes para cumprir a validação da API
        const hasDutra = parts.some(p => p.speech_metadata.speaker === 'DUTRA');
        const hasSadaltager = parts.some(p => p.speech_metadata.speaker === 'Sadaltager');
        if (!hasDutra && parts.length > 0) {
          parts[0].speech_metadata.speaker = 'DUTRA';
          parts[0].speechMetadata.speaker = 'DUTRA';
          parts[0].text = `DUTRA: ${validLines[0].text}`;
        }
        if (!hasSadaltager && parts.length > 1) {
          parts[1].speech_metadata.speaker = 'Sadaltager';
          parts[1].speechMetadata.speaker = 'Sadaltager';
          parts[1].text = `Sadaltager: ${validLines[1].text}`;
        }

        const requestBody = {
          contents: [
            {
              role: "user",
              parts: parts
            }
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: 'DUTRA',
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: getGeminiVoiceName(dutraVoice) } }
                  },
                  {
                    speaker: 'Sadaltager',
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: getGeminiVoiceName(sadaltagerVoice) } }
                  }
                ]
              }
            }
          }
        };

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        const responseData = await res.json();
        if (!res.ok) {
          const errObj = responseData?.error || responseData;
          throw new Error(errObj?.message || JSON.stringify(errObj));
        }

        const candidateParts = responseData.candidates?.[0]?.content?.parts || [];
        const audioParts = candidateParts.filter((p: any) => p.inlineData?.data);
        if (audioParts.length === 0) {
          throw new Error("Falha na renderização do áudio: nenhum bloco de áudio retornado pelo modelo.");
        }

        const decodedChunks = audioParts.map((p: any) => decode(p.inlineData.data));
        const totalLength = decodedChunks.reduce((acc: number, cur: Uint8Array) => acc + cur.length, 0);
        pcmBytes = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of decodedChunks) {
          pcmBytes.set(chunk, offset);
          offset += chunk.length;
        }
      } else {
        // Modo 1 locutor (individual)
        addLog("Renderizando áudio com 1 locutor...", "info");
        const fullScriptText = validLines.map(l => l.text).join(' ');
        
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash-lite-tts",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: fullScriptText,
                  speechMetadata: {
                    style: styleDescription
                  }
                }
              ]
            }
          ] as any,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: getGeminiVoiceName(dutraVoice) }
              }
            }
          }
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("Falha na renderização do áudio.");
        pcmBytes = decode(base64Audio);
      }

      addLog("Áudio renderizado com sucesso. Iniciando reprodução.", "success");
      setGeneratedAudio(pcmBytes);

      const ctx = initAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      let audioBuffer: AudioBuffer;
      try {
        const copy = pcmBytes.buffer.slice(pcmBytes.byteOffset, pcmBytes.byteOffset + pcmBytes.byteLength);
        audioBuffer = await ctx.decodeAudioData(copy);
      } catch {
        audioBuffer = await decodeAudioData(pcmBytes, ctx, 24000, 1);
      }

      const source = ctx.createBufferSource();
      sourceRef.current = source;
      source.buffer = audioBuffer;

      // Roteamento pelo processador de efeitos DSP
      const effectOutput = buildAudioEffectsChain(
        ctx,
        source,
        effectBypass ? 'none' : activeAudioEffect,
        effectIntensity,
        eqSettings
      );
      effectOutput.connect(ctx.destination);

      source.onended = () => {
        setPlaying(false);
        sourceRef.current = null;
      };
      source.start();
    } catch (err: any) {
      console.error("Erro no playScript:", err);
      const friendly = parseApiError(err);
      setError(friendly);
      addLog("Falha na geração de áudio.", "warn");
      setPlaying(false);
    }
  };

  const downloadAudio = async (withEffects: boolean = true) => {
    if (!generatedAudio || !script) return;
    setExportingWav(true);
    try {
      if (!withEffects || effectBypass || (activeAudioEffect === 'none' && eqSettings.bass === 0 && eqSettings.mid === 0 && eqSettings.treble === 0)) {
        const blob = createWavBlob(generatedAudio, 24000);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SPOT_${script.title.replace(/\s+/g, '_')}_CLEAN.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess("Master Clean exportada em WAV!");
        return;
      }

      addLog(`Masterizando WAV com efeito ${activeAudioEffect.toUpperCase()}...`, "info");
      const ctx = initAudioContext();
      let audioBuffer: AudioBuffer;
      try {
        const copy = generatedAudio.buffer.slice(generatedAudio.byteOffset, generatedAudio.byteOffset + generatedAudio.byteLength);
        audioBuffer = await ctx.decodeAudioData(copy);
      } catch {
        audioBuffer = await decodeAudioData(generatedAudio, ctx, 24000, 1);
      }

      const processedBuffer = await processAudioBufferWithEffects(
        audioBuffer,
        activeAudioEffect,
        effectIntensity,
        eqSettings
      );
      const wavBlob = audioBufferToWavBlob(processedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SPOT_${script.title.replace(/\s+/g, '_')}_MASTER_${activeAudioEffect.toUpperCase()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Master WAV com efeito ${activeAudioEffect.toUpperCase()} exportada!`);
    } catch (err: any) {
      console.error("Erro ao exportar com efeitos:", err);
      const blob = createWavBlob(generatedAudio, 24000);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SPOT_${script.title.replace(/\s+/g, '_')}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess("Master exportada em WAV!");
    } finally {
      setExportingWav(false);
    }
  };

  const exportScript = () => {
    if (!script) return;
    
    const styleLabel = NARRATIVE_STYLES.find(s => s.id === narrativeStyle)?.label;
    
    let content = `********************************************************************************\n`;
    content += `                 D' MASTER PRODUTORA - ROTEIRO TÉCNICO DE PRODUÇÃO\n`;
    content += `********************************************************************************\n\n`;
    
    content += `TÍTULO: ${script.title.toUpperCase()}\n`;
    content += `DATA: ${new Date().toLocaleDateString('pt-BR')}\n`;
    content += `DURAÇÃO TOTAL: ${script.total_duration}\n`;
    content += `MODO: D' MASTER PRODUTORA\n`;
    content += `ESTILO: ${styleLabel?.toUpperCase()}\n\n`;
    
    content += `--------------------------------------------------------------------------------\n`;
    content += `DIRETRIZES DE ÁUDIO (SONOPLASTIA & EFEITOS)\n`;
    content += `--------------------------------------------------------------------------------\n`;
    content += `TRILHA: ${script.bgm_suggestion.toUpperCase()}\n`;
    const sfxOption = SFX_PROFILES.find(p => p.id === sfxProfile);
    const effectOption = AUDIO_EFFECT_PRESETS.find(p => p.id === activeAudioEffect);
    content += `PERFIL DE SFX: ${sfxOption?.label.toUpperCase() || 'PADRÃO'}\n`;
    content += `PROCESSAMENTO MASTER: ${effectOption?.label.toUpperCase() || 'PADRÃO'} (${effectIntensity}% WET)\n`;
    content += `TAGS SUGERIDAS: ${script.sfx_hints.join(', ').toUpperCase()}\n\n`;
    
    content += `--------------------------------------------------------------------------------\n`;
    content += `TEXTO E LOCUÇÃO\n`;
    content += `--------------------------------------------------------------------------------\n\n`;
    
    script.lines.forEach((line, index) => {
      const speakerLabel = line.speaker === 'DUTRA' ? `LOC 1 (DUTRA - ${dutraVoice})` : `LOC 2 (SADALTAGER - ${sadaltagerVoice})`;
      content += `[${line.timestamp}] ${speakerLabel}\n`;
      content += `[AÇÃO: ${line.action_instruction?.toUpperCase() || 'N/A'}]\n`;
      content += `[SFX: ${line.sfx_tag?.toUpperCase() || 'N/A'}]\n`;
      content += `>> "${line.text}"\n\n`;
      
      if (index < script.lines.length - 1) {
        content += `--------------------------------------------------------------------------------\n\n`;
      }
    });
    
    content += `\n********************************************************************************\n`;
    content += `NOTAS TÉCNICAS DE ESTÚDIO:\n`;
    content += `- Manter compressão de voz alta para impacto de rádio comercial.\n`;
    content += `- Equalização com brilho nos agudos (Air EQ) e graves presentes.\n`;
    content += `- Transições de trilha devem ser rítmicas acompanhando a locução.\n`;
    content += `********************************************************************************\n`;
    content += `\nGerado por D' MASTER PRODUTORA Motor - Inteligência Artificial para Varejo`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ROTEIRO_TECNICO_${script.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess("Roteiro Técnico exportado!");
  };

  const exportManualTab = (tab: string) => {
    let content = `D' MASTER PRODUTORA - MANUAL TÁTICO DE ELITE\n`;
    content += `==============================================\n\n`;
    content += `Este guia foi gerado para auxiliar sua jornada criativa. Use-o como um mapa para extrair a alma de cada locução.\n\n`;

    if (tab === 'map') {
      content += `[ MENTORIA: FLUXO DE OPERAÇÃO ]\n`;
      content += `Para que o áudio final tenha o DNA D' MASTER, lembre-se que a nossa ordem visual não é por acaso.\n\n`;
      content += `1. DNA NARRATIVO: Comece dando um rosto e uma alma para sua marca. A voz é a primeira impressão.\n`;
      content += `2. ENERGIA: Ajuste a voltagem. Um varejo sem energia é apenas leitura; um institucional com energia demais perde a confiança.\n`;
      content += `3. BRIEFING: Aqui é onde a mágica acontece. Não apenas mande dados, conte uma intenção. Eu interpreto sua vontade.\n`;
      content += `4. MASTER: O motor finaliza e faz a mágica da síntese.\n\n`;
      content += `DICA DE MESTRE: O caminho do áudio perfeito é uma construção em camadas. Respeite cada etapa e veja a diferença no resultado final.`;
    } else if (tab === 'recipes') {
      content += `[ MENTORIA: GUIA DE RECEITAS DE OURO ]\n`;
      content += `Existem caminhos que já foram trilhados e que trazem resultados garantidos. Aqui estão minhas favoritas:\n\n`;
      content += `• VAREJO EXPLOSIVO: Tente Hard Sell + Charon (90% Energy). É para quando você quer que o cliente pare o que está fazendo e compre agora.\n`;
      content += `• NARRAÇÃO PREMIUM: Use Luxury + DUTRA (60% Energy). Menos é mais. O tom deve ser de herança e valor inabalável.\n`;
      content += `• IMPACTO POPULAR: Sound Truck + Persona Rodeio (100% Energy). Para dominar a praça, a rua e a arena.\n`;
      content += `• INSTITUCIONAL SUAVE: Storytelling + Zephyr (55% Energy). Construa pontes de confiança. É a voz da amizade e da parceria.\n\n`;
      content += `O segredo não está apenas na receita, mas em como você tempera com o seu Briefing.`;
    } else if (tab === 'tips') {
      content += `[ MENTORIA: O BRIEFING SUPREMO ]\n`;
      content += `A qualidade do áudio que eu te entrego é diretamente proporcional à clareza da sua intenção.\n\n`;
      content += `• SEJA CIRÚRGICO: Marcas, ofertas e preços precisam estar claros. Eu cuido do resto, mas os fatos precisam estar lá.\n`;
      content += `• DEFINA O CLIMA: Use adjetivos. "Festivo", "Urgente", "Sombrio", "Inspirador". Isso muda minha síntese quântica.\n`;
      content += `• DIALOGUE COMIGO: "Eu quero que o locutor fale como se estivesse segredando uma oportunidade única para o cliente". Essa instrução vale ouro.\n\n`;
      content += `Exemplo de Sucesso: "Promoção relâmpago de smartphones. Use um tom de segredo compartilhado, focado na exclusividade da oferta apenas para hoje."`;
    } else if (tab === 'engine') {
      content += `[ MENTORIA: SOBRE O MOTOR D' MASTER ]\n`;
      content += `O que você tem nas mãos não é um simples gerador. É o motor v6.5.2-PRO, treinado na alma do rádio brasileiro.\n\n`;
      content += `• FLUXO PREMIUM: Nós tratamos o roteiro com elegância. As vozes são fluidas e contínuas, garantindo uma audição agradável e profissional.\n`;
      content += `• MULTI-PERSONA: Nossas vozes entendem sotaques, gírias técnicas e o calor humano necessário para cada região.\n`;
      content += `• MASTERIZAÇÃO WAV: A saída é profissional, em alta fidelidade, pronta para as grandes emissoras.\n\n`;
      content += `Trate cada produção como uma obra de arte. Nós cuidamos da engenharia, você cuida da emoção.`;
    }

    content += `\n\n----------------------------------------------\n`;
    content += `D' MASTER PRODUTORA - TECNOLOGIA E ALMA EM SINTONIA`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GUIA_MESTRE_${tab.toUpperCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess(`Guia de Mestre (${tab.toUpperCase()}) exportado!`);
  };

  return (
    <div className="min-h-screen bg-[#020617] relative overflow-hidden font-sans text-white selection:bg-cyber-blue selection:text-deep-navy">
      {/* Scanline Effect */}
      <div className="scanline"></div>

      {/* Background Abstract Shapes - Futuristic Monitoring Style */}
      <div className="absolute top-[-5%] right-[-5%] w-[60%] aspect-square bg-[#001f3f] rounded-full blur-[120px] pointer-events-none opacity-40"></div>
      <div className="absolute top-[15%] left-[-10%] w-[120%] h-[40%] bg-cyber-blue/5 rounded-[100%] rotate-[-15deg] pointer-events-none opacity-20 blur-[80px]"></div>
      <div className="absolute bottom-[10%] left-[-5%] w-[50%] aspect-square bg-blue-900/20 rounded-full pointer-events-none opacity-30 blur-[100px]"></div>
      
      {/* Global Map Visualization with Connection Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-10 overflow-hidden">
        <svg viewBox="0 0 1000 600" className="w-full h-full">
          <path 
            d="M150,200 Q300,100 450,250 T750,200" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="0.5" 
            className="text-cyber-blue"
          />
          {connectionLines.map((line, i) => (
            <motion.line
              key={i}
              x1={`${line.x1}%`}
              y1={`${line.y1}%`}
              x2={`${line.x2}%`}
              y2={`${line.y2}%`}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-cyber-cyan"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}
          {[...Array(20)].map((_, i) => (
            <motion.circle
              key={i}
              cx={`${Math.random() * 100}%`}
              cy={`${Math.random() * 100}%`}
              r="1.5"
              fill="currentColor"
              className="text-cyber-blue"
              animate={{
                opacity: [0.2, 1, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 5,
              }}
            />
          ))}
        </svg>
      </div>

      {/* Concentric Circles from image */}
      <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] pointer-events-none opacity-10">
        <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {[...Array(12)].map((_, i) => (
            <circle 
              key={i}
              cx="500" 
              cy="500" 
              r={80 + i * 50} 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1" 
              className="text-cyber-blue"
              opacity={0.8 - i * 0.06}
            />
          ))}
        </svg>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8 relative z-10">
        {/* Header Profissional */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-white/10 pb-8">
          <div className="flex items-center gap-5">
            <motion.div 
              initial={{ rotate: -6, scale: 0.9 }}
              animate={{ rotate: 0, scale: 1 }}
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="relative group cursor-pointer"
              onClick={() => setShowAbout(true)}
              title="D' MASTER PRODUTORA - Clique para saber mais"
            >
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,242,255,0.45)] border-2 border-cyber-blue/50 relative bg-black">
                <img 
                  src="/src/assets/images/app_radio_icon_1790193192690.jpg" 
                  alt="Ícone D' MASTER PRODUTORA" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-cyber-cyan rounded-full border-2 border-[#020617] animate-pulse shadow-[0_0_10px_rgba(0,212,255,0.8)]"></div>
            </motion.div>
            <div>
              <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] flex items-center gap-3 font-display">
                D' MASTER PRODUTORA
              </h1>
              <p className="text-cyber-blue font-display text-[11px] font-black tracking-[0.4em] uppercase opacity-80">
                Inteligência e Produção de Rádio de Próxima Geração
              </p>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button 
              onClick={() => setShowTutorial(true)}
              className={cn(
                "px-5 py-3 rounded-2xl border-t border-white/20 flex items-center gap-2.5 transition-all font-black text-xs uppercase tracking-widest shadow-lg",
                showTutorial 
                  ? "bg-cyber-blue text-deep-navy shadow-[0_0_30px_rgba(0,242,255,0.6)]" 
                  : "bg-cyber-blue/20 border-cyber-blue/40 text-cyber-cyan hover:bg-cyber-blue/30 hover:border-cyber-blue"
              )}
              title="Manual Completo & Como Usar o Sistema Passo a Passo"
            >
              <BookOpen className="h-4 w-4 text-cyber-blue" />
              <span>Como Usar (Tutorial)</span>
            </button>
            <button 
              onClick={() => setShowEffectsModal(true)}
              className={cn(
                "px-5 py-3 rounded-2xl border-t border-white/20 flex items-center gap-2.5 transition-all font-black text-xs uppercase tracking-widest",
                showEffectsModal 
                  ? "bg-cyber-blue text-deep-navy shadow-[0_0_30px_rgba(0,242,255,0.4)]" 
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/30"
              )}
              title="Mesa de Efeitos Sonoros, Rack DSP e Masterização"
            >
              <Sliders className="h-4 w-4 text-cyber-blue" />
              <span>Efeitos & Master</span>
              <span className="text-[9px] bg-cyber-blue/20 text-cyber-cyan px-2 py-0.5 rounded-full border border-cyber-blue/30 uppercase font-mono">
                {AUDIO_EFFECT_PRESETS.find(p => p.id === activeAudioEffect)?.label.split(' ')[0] || 'FX'}
              </span>
            </button>
            <button 
              onClick={() => setShowApiHelp(true)}
              className={cn(
                "px-5 py-3 rounded-2xl border-t border-white/20 flex items-center gap-2.5 transition-all font-black text-xs uppercase tracking-widest",
                showApiHelp 
                  ? "bg-cyber-blue text-deep-navy shadow-[0_0_30px_rgba(0,242,255,0.4)]" 
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/30"
              )}
              title="Diagnóstico de Conexão e Como Resolver Erro de API Negada"
            >
              <Key className="h-4 w-4 text-cyber-blue" />
              <span>Status da API</span>
            </button>
            <button 
              onClick={() => setShowAbout(!showAbout)}
              className={cn(
                "px-6 py-3 rounded-2xl border-t border-white/20 flex items-center gap-3 transition-all font-black text-xs uppercase tracking-widest",
                showAbout 
                  ? "bg-cyber-blue text-deep-navy shadow-[0_0_30px_rgba(0,242,255,0.4)]" 
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/30"
              )}
            >
              <Info className="h-5 w-5" />
              Sobre o App
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "px-6 py-3 rounded-2xl border-t border-white/20 flex items-center gap-3 transition-all font-black text-xs uppercase tracking-widest",
                showSettings 
                  ? "bg-cyber-blue text-deep-navy shadow-[0_0_30px_rgba(0,242,255,0.4)]" 
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/30"
              )}
            >
              <Settings className={cn("h-5 w-5 transition-transform duration-700", showSettings && "rotate-180")} />
              Configuração do Console
            </button>
          </div>
        </header>

        <motion.section 
          key="studio"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          className="glass-3d rounded-[3rem] p-10 mb-12 border-t border-white/20"
        >
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-[12px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
              <span className="w-3 h-3 bg-cyber-blue rounded-full animate-ping shadow-[0_0_15px_rgba(0,242,255,1)]"></span>
              Console de DNA Narrativo
            </h3>
            <div className="flex items-center gap-3 px-4 py-2 bg-cyber-blue/10 rounded-full border border-cyber-blue/30">
              <Sparkles className="w-4 h-4 text-cyber-cyan" />
              <span className="text-[10px] font-black text-cyber-cyan uppercase tracking-widest">Motor Quântico Ativo</span>
            </div>
          </div>

          {/* Banner de Como Usar em 4 Passos Rápidos */}
          <div className="mb-10 p-5 md:p-6 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-blue-950/40 border border-cyber-blue/30 rounded-3xl relative overflow-hidden shadow-[0_0_30px_rgba(0,242,255,0.12)]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyber-blue/20 border border-cyber-blue/40 flex items-center justify-center text-cyber-blue font-black text-xs shadow-[0_0_10px_rgba(0,242,255,0.4)]">
                  ⚡
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                    Como Criar seu Spot em 4 Passos Rápidos
                    <span className="text-[9px] bg-cyber-blue/20 text-cyber-cyan px-2 py-0.5 rounded-full border border-cyber-blue/30 font-mono">
                      FLUXO SIMPLES
                    </span>
                  </h4>
                  <p className="text-[11px] text-white/50">
                    Siga o passo a passo abaixo para criar roteiros persuasivos e áudios com qualidade de rádio profissional.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTutorial(true)}
                className="px-4 py-2 rounded-xl bg-cyber-blue/15 hover:bg-cyber-blue/25 border border-cyber-blue/40 text-cyber-cyan text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 self-end md:self-auto cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Ver Manual Completo</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-1.5 hover:border-cyber-blue/30 transition-all">
                <div className="flex items-center gap-2 text-cyber-blue font-black text-xs uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-cyber-blue/20 border border-cyber-blue/40 flex items-center justify-center text-[10px] font-mono">1</span>
                  <span>Briefing ou Foto</span>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Digite as promoções ou clique no ícone da câmera para enviar a foto do panfleto/encarte.
                </p>
              </div>

              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-1.5 hover:border-cyber-blue/30 transition-all">
                <div className="flex items-center gap-2 text-cyber-blue font-black text-xs uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-cyber-blue/20 border border-cyber-blue/40 flex items-center justify-center text-[10px] font-mono">2</span>
                  <span>Persona & Estilo</span>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Escolha a voz (ex: Varejão, Dutra Clássico, Caipira), o tempo (ex: 30s) e os efeitos sonoros.
                </p>
              </div>

              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-1.5 hover:border-cyber-blue/30 transition-all">
                <div className="flex items-center gap-2 text-cyber-blue font-black text-xs uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-cyber-blue/20 border border-cyber-blue/40 flex items-center justify-center text-[10px] font-mono">3</span>
                  <span>Gerar Spot</span>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Clique no botão azul central. A IA escreve o roteiro com gatilhos mentais e sintetiza o áudio.
                </p>
              </div>

              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-1.5 hover:border-cyber-blue/30 transition-all">
                <div className="flex items-center gap-2 text-cyber-blue font-black text-xs uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-cyber-blue/20 border border-cyber-blue/40 flex items-center justify-center text-[10px] font-mono">4</span>
                  <span>Efeitos & Master</span>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Ouça com o processador DSP (ex: Rádio FM, Grave Titânico) e baixe a Master WAV final.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Style Selector */}
            <div className="space-y-6">
              <label className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                <Sparkles className="w-4 h-4 text-cyber-blue" /> Estilo de DNA da Campanha
              </label>
              <div className="grid grid-cols-1 gap-3 max-h-[380px] overflow-y-auto pr-3 custom-scrollbar">
                {NARRATIVE_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setNarrativeStyle(style.id)}
                    className={cn(
                      "flex items-center gap-5 px-6 py-5 rounded-2xl border transition-all text-left group relative overflow-hidden",
                      narrativeStyle === style.id 
                        ? "bg-gradient-to-r from-blue-600 to-blue-900 border-blue-400 text-white shadow-[0_10px_30px_rgba(0,242,255,0.3)]" 
                        : "bg-white/5 border-white/5 text-white/40 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    {narrativeStyle === style.id && (
                      <motion.div 
                        layoutId="active-style-bg"
                        className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none"
                      />
                    )}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500",
                      narrativeStyle === style.id 
                        ? "bg-white/20 border border-white/30 rotate-3 shadow-lg" 
                        : "bg-black/40 border border-white/10 group-hover:rotate-6"
                    )}>
                      {STYLE_ICONS[style.id] || <Sparkles className="w-6 h-6" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-base font-black tracking-tight uppercase font-display italic">{style.label}</span>
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Protocolo {style.id.toUpperCase()}</span>
                    </div>
                    {narrativeStyle === style.id && (
                      <ChevronRight className="w-5 h-5 ml-auto text-white/50 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity & Duration */}
            <div className="space-y-10">
              {/* Activity Meter (Vertical Bar Graph) */}
              <div className="space-y-4">
                <label className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                  <Zap className="w-4 h-4 text-cyber-blue" /> Atividade do Sistema
                </label>
                <div className="flex items-end gap-1 h-20 px-2">
                  {activityData.map((val, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${val}%` }}
                      transition={{ duration: 1, delay: i * 0.05 }}
                      className="flex-1 bg-gradient-to-t from-blue-900 to-cyber-blue rounded-t-sm opacity-60"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end mb-2">
                  <label className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                    <Flame className="w-4 h-4 text-cyber-blue" /> Intensidade Narrativa
                  </label>
                  <span className="cyan-text-3d text-2xl">{intensity}%</span>
                </div>
                <div className="relative pt-4">
                  <input 
                    type="range" min="0" max="100" value={intensity} 
                    onChange={(e) => setIntensity(parseInt(e.target.value))}
                    className="w-full h-2 bg-black/60 rounded-full appearance-none cursor-pointer accent-cyber-blue shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                  />
                  <div className="flex justify-between mt-4 text-[10px] text-white/20 font-black uppercase tracking-[0.2em]">
                    <span>Sutil</span>
                    <span>Equilibrado</span>
                    <span>Agressivo</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                  <Clock className="w-4 h-4 text-cyber-blue" /> Janela Temporal
                </label>
                <div className="relative">
                  <select 
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                    className="input-3d w-full text-base font-black uppercase tracking-widest appearance-none cursor-pointer"
                  >
                    {DURATIONS.map(d => <option key={d.value} value={d.value} className="bg-black text-white">{d.label}</option>)}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-cyber-blue">
                    <ChevronRight className="w-5 h-5 rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                  <Users className="w-4 h-4 text-cyber-blue" /> Configuração de Locução
                </label>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSingleSpeaker(true)}
                    className={cn(
                      "flex-1 py-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                      singleSpeaker 
                        ? "bg-cyber-blue/20 border-cyber-blue text-cyber-cyan shadow-[0_0_20px_rgba(0,212,255,0.2)]" 
                        : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                    )}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">1 Locutor</span>
                  </button>
                  <button 
                    onClick={() => setSingleSpeaker(false)}
                    className={cn(
                      "flex-1 py-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                      !singleSpeaker 
                        ? "bg-cyber-blue/20 border-cyber-blue text-cyber-cyan shadow-[0_0_20px_rgba(0,212,255,0.2)]" 
                        : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                    )}
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">2 Locutores</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                  <User className="w-4 h-4 text-cyber-blue" /> Persona do Locutor
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {PERSONAS.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setSelectedPersona(p.id)}
                      className={cn(
                        "py-3 px-4 rounded-xl border transition-all flex items-center gap-3",
                        selectedPersona === p.id 
                          ? "bg-cyber-blue/20 border-cyber-blue text-cyber-cyan shadow-[0_0_20px_rgba(0,212,255,0.2)]" 
                          : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                      )}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest truncate">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Theme Input & Circular Progress */}
            <div className="space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                    <FileText className="w-4 h-4 text-cyber-blue" /> Objeto da Campanha
                  </label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "p-2 rounded-xl border transition-all flex items-center gap-2",
                        campaignImage 
                          ? "bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue" 
                          : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                      )}
                      title="Adicionar imagem do produto/campanha"
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Imagem</span>
                    </button>
                    {/* Circular Progress Indicator */}
                    <div className="relative w-8 h-8 ml-2">
                      <svg className="w-full h-full" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/10" strokeWidth="2" />
                        <motion.circle 
                          cx="18" cy="18" r="16" fill="none" 
                          className="stroke-cyber-blue" 
                          strokeWidth="2" 
                          strokeDasharray="100"
                          initial={{ strokeDashoffset: 100 }}
                          animate={{ strokeDashoffset: 100 - (theme.length / 500) * 100 }}
                        />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="relative group">
                  <textarea 
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="Ex: Liquidação de iPhones com 30% de desconto, só até amanhã na Loja do Centro."
                    className={cn(
                      "input-3d w-full transition-all text-lg font-medium placeholder:text-white/10 resize-none",
                      campaignImage ? "h-32" : "h-48"
                    )}
                  />
                  {campaignImage && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute bottom-16 right-6 group/img"
                    >
                      <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-cyber-blue shadow-[0_0_20px_rgba(0,242,255,0.3)]">
                        <img src={campaignImage} alt="Campaign" className="w-full h-full object-cover" />
                        <button 
                          onClick={removeImage}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-red-400"
                        >
                          <Trash2 className="w-6 h-6" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                  <div className="absolute bottom-5 right-6 text-[10px] font-black text-white/20 uppercase tracking-widest">
                    {theme.length} caracteres
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={resetConsole}
                  className="w-16 h-full bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all text-white/40"
                  title="Resetar Console"
                >
                  <RotateCcw className="w-6 h-6" />
                </button>
                <button 
                  onClick={generateScript}
                  disabled={loading || !theme.trim()}
                  className="btn-3d-blue flex-1 flex items-center justify-center gap-4 group disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center gap-4">
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="uppercase tracking-[0.2em] text-sm">Sintetizando...</span>
                    </div>
                  ) : (
                    <>
                      <Zap className="h-6 w-6 group-hover:animate-pulse" />
                      <span className="text-xl uppercase tracking-[0.25em]">Sintetizar DNA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Painel Central de Opções de Efeitos, Sonoplastia e Masterização DSP */}
          <div className="mt-10 pt-8 border-t border-white/10 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-[0.2em] font-display flex items-center gap-2">
                    Rack de Efeitos & Sonoplastia de Estúdio
                    <span className="text-[9px] bg-cyber-blue/20 text-cyber-blue px-2 py-0.5 rounded-full border border-cyber-blue/30 font-mono">
                      DSP ENGINE
                    </span>
                  </h4>
                  <p className="text-[11px] text-white/50">
                    Defina o estilo dos efeitos sonoros (SFX) e o processamento de voz em tempo real.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setEffectBypass(!effectBypass)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                    effectBypass
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                      : "bg-white/5 border-white/10 text-white/40 hover:text-white"
                  )}
                  title="Desativar temporariamente todos os efeitos de processamento DSP (Bypass)"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Bypass FX: {effectBypass ? 'ATIVO (CLEAN)' : 'DESLIGADO'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEffectsModal(true)}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue hover:bg-cyber-blue/20 transition-all flex items-center gap-2"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Ajustes Finos</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 1. Perfil de SFX do Roteiro */}
              <div className="space-y-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-cyber-blue uppercase tracking-[0.2em] flex items-center gap-2">
                    <Music className="w-4 h-4" /> 1. Perfil de Sonoplastia (SFX Pack)
                  </label>
                  <span className="text-[9px] font-mono text-white/30 uppercase">Roteiro Inteligente</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SFX_PROFILES.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => {
                        setSfxProfile(profile.id);
                        addLog(`Perfil de SFX selecionado: ${profile.label.toUpperCase()}`, "info");
                      }}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2",
                        sfxProfile === profile.id
                          ? "bg-cyber-blue/15 border-cyber-blue text-white shadow-[0_0_20px_rgba(0,242,255,0.2)]"
                          : "bg-black/40 border-white/5 text-white/50 hover:bg-white/5 hover:text-white/80"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{profile.icon}</span>
                        <span className="text-[11px] font-black uppercase tracking-wider text-white">
                          {profile.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40 line-clamp-2 leading-relaxed">
                        {profile.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {profile.tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 text-cyber-cyan/80 border border-white/10"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Processamento DSP de Voz & Master */}
              <div className="space-y-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-cyber-blue uppercase tracking-[0.2em] flex items-center gap-2">
                    <Radio className="w-4 h-4" /> 2. Efeito DSP de Voz & Master
                  </label>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-white/50">
                    <span>Intensidade:</span>
                    <span className="text-cyber-blue font-bold">{effectIntensity}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AUDIO_EFFECT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setActiveAudioEffect(preset.id);
                        addLog(`Efeito DSP Master alterado para: ${preset.label.toUpperCase()}`, "info");
                      }}
                      className={cn(
                        "p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5",
                        activeAudioEffect === preset.id
                          ? "bg-cyber-blue/20 border-cyber-blue text-white shadow-[0_0_20px_rgba(0,242,255,0.25)]"
                          : "bg-black/40 border-white/5 text-white/40 hover:bg-white/5 hover:text-white/80"
                      )}
                      title={preset.description}
                    >
                      <span className="text-lg">{preset.icon}</span>
                      <span className="text-[9px] font-black uppercase tracking-wider truncate w-full">
                        {preset.label.replace(/\(.*\)/, '').trim()}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Slider de Intensidade Wet/Dry */}
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/40">
                    <span>Mix do Efeito (Wet / Dry)</span>
                    <span className="text-cyber-blue font-mono">{effectIntensity}% WET</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={effectIntensity}
                    onChange={(e) => setEffectIntensity(Number(e.target.value))}
                    disabled={effectBypass}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyber-blue disabled:opacity-30"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-white/20">
                    <span>0% (Áudio Puro)</span>
                    <span>50% (Equilibrado)</span>
                    <span>100% (Processamento Máximo)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Mesa de Disparo Rápido de Efeitos (Instant SFX Cartwall / Soundboard) */}
            <div className="p-6 bg-black/40 border border-white/10 rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Disc className="w-4 h-4 text-cyber-blue animate-spin" style={{ animationDuration: '8s' }} />
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
                    Mesa de Disparo Rápido de Efeitos (Cartwall Instantâneo)
                  </span>
                </div>
                <span className="text-[9px] font-mono text-white/30 uppercase">
                  Sintetizado via Web Audio API • Clique para testar
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                {RADIO_SFX_TRIGGERS.map((sfx) => {
                  const isTriggered = activeSfxTriggerId === sfx.id;
                  return (
                    <button
                      key={sfx.id}
                      type="button"
                      onClick={() => triggerSoundEffect(sfx.play, sfx.id)}
                      className={cn(
                        "p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 group active:scale-95",
                        isTriggered
                          ? "bg-cyber-blue text-deep-navy border-cyber-blue shadow-[0_0_25px_rgba(0,242,255,0.8)] scale-105"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-cyber-blue/40"
                      )}
                      title={`Disparar efeito: ${sfx.name}`}
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">
                        {sfx.icon}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-center line-clamp-1">
                        {sfx.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.section>

    {/* System Logs Console */}
    <div className="mt-10 p-6 bg-black/60 border border-white/10 rounded-3xl overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 bg-cyber-blue rounded-full animate-pulse"></div>
        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Logs do Sistema de Monitoramento</span>
      </div>
      <div className="space-y-2 h-24 overflow-y-auto custom-scrollbar">
        <AnimatePresence initial={false}>
          {logs.map(log => (
            <motion.div 
              key={log.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="flex items-center gap-3 text-[10px] font-mono"
            >
              <span className="text-white/20">[{new Date().toLocaleTimeString()}]</span>
              <span className={cn(
                log.type === 'info' && "text-cyber-blue",
                log.type === 'warn' && "text-orange-400",
                log.type === 'success' && "text-green-400"
              )}>
                {log.msg.toUpperCase()}
              </span>
            </motion.div>
          ))}
          {logs.length === 0 && (
            <div className="text-[10px] font-mono text-white/10 uppercase tracking-widest">Aguardando entrada de dados...</div>
          )}
        </AnimatePresence>
      </div>
    </div>

    {/* Loading Progress Bar - Futuristic Cyan Style */}
    <AnimatePresence>
      {loading && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mt-20 space-y-8 max-w-2xl mx-auto overflow-hidden"
        >
          <div className="relative h-2 bg-white/5 rounded-full overflow-visible border border-white/10">
            {/* Tooltip with percentage */}
            <motion.div 
              initial={{ left: '0%' }}
              animate={{ left: '45%' }}
              className="absolute bottom-full mb-5 bg-cyber-blue text-deep-navy text-[11px] font-black px-4 py-2 rounded-xl shadow-[0_0_25px_rgba(0,242,255,0.5)] border-t border-white/30"
            >
              45% SINC
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-[8px] border-transparent border-t-cyber-blue"></div>
            </motion.div>
            {/* Progress fill */}
            <motion.div 
              initial={{ width: '0%' }}
              animate={{ width: '45%' }}
              className="h-full bg-gradient-to-r from-cyber-blue to-blue-400 rounded-full shadow-[0_0_25px_rgba(0,242,255,0.7)] relative"
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.3)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.3)_75%,transparent_75%,transparent)] bg-[length:24px_24px] animate-progress-stripes" />
            </motion.div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-cyber-blue rounded-full animate-ping"></div>
              <p className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic">Síntese de Roteiro Quântico em Progresso</p>
            </div>
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <motion.div 
                  key={i}
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 1, 0.3],
                    backgroundColor: ['#ffffff', '#00f2ff', '#ffffff']
                  }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.15 }}
                  className="w-1.5 h-1.5 rounded-full"
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Footer info from image */}
        <footer className="mt-12 flex justify-end">
          <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Versão do Sistema 6.5.2/6.3.5</p>
        </footer>

        {/* Voice Settings Modal/Overlay */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="glass-3d rounded-[3.5rem] p-12 max-w-2xl w-full border-t border-white/20"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-cyber-blue rounded-full shadow-[0_0_15px_rgba(0,242,255,0.8)]"></div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-widest font-display italic">Configuração do Console</h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10">
                  <X className="h-5 w-5 text-white/40" />
                </button>
              </div>
              <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-6 rounded-full relative transition-colors cursor-pointer",
                    singleSpeaker ? "bg-white/10" : "bg-cyber-blue"
                  )} onClick={() => setSingleSpeaker(!singleSpeaker)}>
                    <motion.div 
                      animate={{ x: singleSpeaker ? 4 : 28 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">Modo de Locução</span>
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                      {singleSpeaker ? 'Locutor Único (DUTRA)' : 'Duplo Locutor (DUTRA + Sadaltager)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-4">
                  <label className="text-[11px] font-black text-cyber-blue uppercase tracking-[0.2em] block ml-2">Unidade de Voz Primária</label>
                  <select 
                    value={dutraVoice}
                    onChange={(e) => setDutraVoice(e.target.value as VoiceName)}
                    className="input-3d w-full"
                  >
                    {AVAILABLE_VOICES.map(v => <option key={v.name} value={v.name} className="bg-black text-white">{v.description}</option>)}
                  </select>
                </div>
                <div className={`space-y-4 transition-opacity ${singleSpeaker ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                  <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] block ml-2">Unidade de Voz Auxiliar</label>
                  <select 
                    value={sadaltagerVoice}
                    onChange={(e) => setSadaltagerVoice(e.target.value as VoiceName)}
                    className="input-3d w-full"
                  >
                    {AVAILABLE_VOICES.map(v => <option key={v.name} value={v.name} className="bg-black text-white">{v.description}</option>)}
                  </select>
                </div>
              </div>

              {/* Opções de Efeitos no Console de Configuração */}
              <div className="mt-8 pt-8 border-t border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyber-blue" />
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
                      Processamento de Efeitos Master & Sonoplastia
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEffectBypass(!effectBypass)}
                    className={cn(
                      "px-3 py-1 rounded-xl text-[9px] font-mono uppercase font-bold border transition-all",
                      effectBypass
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-white/5 border-white/10 text-white/40 hover:text-white"
                    )}
                  >
                    Bypass: {effectBypass ? 'Ativo' : 'Desligado'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-cyber-blue uppercase tracking-wider block">
                      Perfil de Efeitos do Roteiro (SFX)
                    </label>
                    <select
                      value={sfxProfile}
                      onChange={(e) => setSfxProfile(e.target.value as SfxProfile)}
                      className="input-3d w-full"
                    >
                      {SFX_PROFILES.map(p => (
                        <option key={p.id} value={p.id} className="bg-black text-white">
                          {p.icon} {p.label} - {p.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-cyber-blue uppercase tracking-wider block">
                      Preset de Efeito DSP de Voz
                    </label>
                    <select
                      value={activeAudioEffect}
                      onChange={(e) => setActiveAudioEffect(e.target.value as AudioEffectPreset)}
                      className="input-3d w-full"
                    >
                      {AUDIO_EFFECT_PRESETS.map(preset => (
                        <option key={preset.id} value={preset.id} className="bg-black text-white">
                          {preset.icon} {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-white/50 tracking-wider">
                    <span>Intensidade de Efeito (Wet / Dry):</span>
                    <span className="text-cyber-blue font-mono">{effectIntensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={effectIntensity}
                    onChange={(e) => setEffectIntensity(Number(e.target.value))}
                    disabled={effectBypass}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyber-blue disabled:opacity-30"
                  />
                </div>
              </div>

              <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-cyber-blue opacity-50"></div>
                <p className="text-[11px] text-white/60 font-medium uppercase tracking-widest leading-relaxed italic">
                  <span className="text-cyber-blue font-black mr-2">AVISO DO SISTEMA:</span> 
                  Para varejo de alto impacto, use <span className="text-white font-bold">Charon</span>. 
                  Para narrativa cinematográfica, <span className="text-white font-bold">DUTRA</span> + <span className="text-white font-bold">Zephyr</span> oferece profundidade narrativa ideal.
                </p>
              </div>
              {(targetDuration === 60 || narrativeStyle === 'sound_truck') && (
                <div className="mt-6 flex items-center justify-center gap-3 py-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-cyan-500" />
                  <p className="text-[10px] text-cyan-500 font-black uppercase tracking-widest">
                    Protocolo Carro de Som Ativo: Sincronia Multi-Gênero Habilitada
                  </p>
                </div>
              )}
              <button 
                onClick={() => setShowSettings(false)}
                className="btn-3d-blue w-full mt-12 uppercase tracking-[0.3em] text-sm"
              >
                Confirmar Configuração
              </button>
            </motion.div>
          </div>
        )}

        {/* About Modal */}
        {showAbout && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="glass-3d rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-12 max-w-4xl w-full border-t border-white/20 my-auto shadow-[0_0_100px_rgba(0,242,255,0.2)]"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-cyber-blue/40 shadow-[0_0_20px_rgba(0,242,255,0.4)] shrink-0 bg-black">
                    <img 
                      src="/src/assets/images/app_radio_icon_1790193192690.jpg" 
                      alt="Ícone do Aplicativo" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest font-display italic">Manual Tático D' MASTER</h2>
                    <p className="text-[10px] text-cyber-blue font-mono uppercase tracking-widest">Identidade Visual & Diretrizes do Sistema</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowAbout(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10">
                    <X className="h-5 w-5 text-white/40" />
                  </button>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex flex-wrap gap-2 mb-8 p-1.5 bg-black/40 rounded-2xl border border-white/5">
                {[
                  { id: 'map', label: 'Mapa de Operação', icon: <Radio className="w-4 h-4" /> },
                  { id: 'recipes', label: 'Guia de Receitas', icon: <Gem className="w-4 h-4" /> },
                  { id: 'tips', label: 'Dicas de Mestre', icon: <Zap className="w-4 h-4" /> },
                  { id: 'engine', label: 'Sobre o Motor', icon: <Flame className="w-4 h-4" /> }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setAboutTab(tab.id as any)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      aboutTab === tab.id 
                        ? "bg-cyber-blue text-deep-navy shadow-[0_0_20px_rgba(0,242,255,0.3)]" 
                        : "text-white/40 hover:text-white/70 hover:bg-white/5"
                    )}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="min-h-[400px]">
                <AnimatePresence mode="wait">
                  {aboutTab === 'map' && (
                    <motion.div 
                      key="map"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-8"
                    >
                      <div className="text-center mb-10">
                        <p className="text-cyber-blue font-black text-[10px] uppercase tracking-[0.4em] mb-2">Fluxo de Produção</p>
                        <h3 className="text-2xl font-bold text-white tracking-tight">O Caminho do Áudio Perfeito</h3>
                      </div>

                      <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Connection Line (Desktop) */}
                        <div className="hidden md:block absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyber-blue/30 to-transparent -translate-y-1/2 z-0"></div>
                        
                        {[
                          { step: '01', title: 'DNA NARRATIVO', desc: 'Defina Estilo e Persona. É a alma da locução.', icon: <Sparkles className="w-6 h-6" /> },
                          { step: '02', title: 'ENERGIA', desc: 'Ajuste Intensidade e Tempo. A voltagem da entrega.', icon: <Zap className="w-6 h-6" /> },
                          { step: '03', title: 'BRIEFING', desc: 'Descreva sua ideia. A IA interpreta sua intenção.', icon: <FileText className="w-6 h-6" /> },
                          { step: '04', title: 'MASTER', desc: 'O Motor sintetiza e entrega a peça final.', icon: <Play className="w-6 h-6" /> }
                        ].map((item, i) => (
                          <div key={i} className="relative z-10 flex flex-col items-center text-center group">
                            <div className="w-16 h-16 rounded-2xl bg-black border border-cyber-blue/20 flex items-center justify-center mb-4 group-hover:border-cyber-blue group-hover:shadow-[0_0_20px_rgba(0,242,255,0.3)] transition-all duration-500">
                              <div className="text-cyber-blue">{item.icon}</div>
                            </div>
                            <span className="text-[10px] font-black text-cyber-blue/50 mb-1">{item.step}</span>
                            <h4 className="text-xs font-black text-white uppercase tracking-widest mb-2">{item.title}</h4>
                            <p className="text-[11px] text-white/40 leading-relaxed px-2">{item.desc}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-12 p-6 bg-cyber-blue/5 border border-cyber-blue/20 rounded-3xl flex items-center gap-6">
                        <div className="w-12 h-12 rounded-full bg-cyber-blue/10 flex items-center justify-center shrink-0">
                          <Info className="w-6 h-6 text-cyber-blue" />
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed italic">
                          <span className="text-cyber-blue font-black">DICA PARA VETERANOS:</span> O sistema foi desenhado para respeitar a hierarquia de produção clássica. Siga a ordem visual para garantir que a IA tenha todo o contexto necessário antes de gerar o roteiro.
                        </p>
                      </div>

                      <div className="flex justify-center mt-8">
                        <button 
                          onClick={() => exportManualTab('map')}
                          className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue text-xs font-black uppercase tracking-widest hover:bg-cyber-blue/20 transition-all group"
                        >
                          <Download className="w-5 h-5 group-hover:animate-bounce" />
                          Exportar Guia de Operação
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {aboutTab === 'recipes' && (
                    <motion.div 
                      key="recipes"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { name: 'Varejo Explosivo', style: 'Hard Sell', voice: 'Charon', energy: '90%', result: 'Impacto Máximo de Vendas', icon: '🍕' },
                          { name: 'Narração Premium', style: 'Luxury', voice: 'DUTRA', energy: '60%', result: 'Sofisticação e Valor', icon: '💎' },
                          { name: 'Impacto Popular', style: 'Sound Truck', voice: 'Rodeio', energy: '100%', result: 'Domínio de Rua e Arena', icon: '📢' },
                          { name: 'Institucional Suave', style: 'Storytelling', voice: 'Zephyr', energy: '50%', result: 'Conexão e Confiança', icon: '📖' },
                          { name: 'Promoção Jovem', style: 'Cool', voice: 'Puck', energy: '75%', result: 'Engajamento e Dinamismo', icon: '🎧' },
                          { name: 'Gospel Inspirador', style: 'Motivational', voice: 'Kore', energy: '70%', result: 'Fé e Emoção Profunda', icon: '🙏' }
                        ].map((recipe, i) => (
                          <div key={i} className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{recipe.icon}</span>
                                <div>
                                  <h4 className="text-sm font-black text-white uppercase tracking-tight">{recipe.name}</h4>
                                  <span className="text-[9px] font-bold text-cyber-blue uppercase tracking-widest">{recipe.result}</span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[9px] font-black uppercase tracking-widest text-white/30">
                              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                                <span className="block text-white/20 mb-1">Estilo</span>
                                <span className="text-white/60">{recipe.style}</span>
                              </div>
                              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                                <span className="block text-white/20 mb-1">Voz</span>
                                <span className="text-white/60">{recipe.voice}</span>
                              </div>
                              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                                <span className="block text-white/20 mb-1">Energia</span>
                                <span className="text-white/60">{recipe.energy}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-center mt-8">
                        <button 
                          onClick={() => exportManualTab('recipes')}
                          className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue text-xs font-black uppercase tracking-widest hover:bg-cyber-blue/20 transition-all group"
                        >
                          <Download className="w-5 h-5 group-hover:animate-bounce" />
                          Exportar Guia de Receitas
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {aboutTab === 'tips' && (
                    <motion.div 
                      key="tips"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-8 bg-gradient-to-br from-blue-900/20 to-black/40 border border-cyber-blue/20 rounded-[2rem]">
                          <h4 className="text-cyber-blue font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-3">
                            <MessageSquare className="w-5 h-5" /> O Briefing Perfeito
                          </h4>
                          <ul className="space-y-4">
                            {[
                              { label: 'Seja Específico', desc: 'Inclua nome da marca, oferta principal e o preço exato.' },
                              { label: 'Defina o Clima', desc: 'Diga se quer algo "festivo", "urgente" ou "emocional".' },
                              { label: 'Público Alvo', desc: 'Mencione para quem você está falando (ex: "donas de casa", "jovens").' }
                            ].map((tip, i) => (
                              <li key={i} className="flex gap-4">
                                <div className="w-1.5 h-1.5 bg-cyber-blue rounded-full mt-1.5 shrink-0"></div>
                                <div>
                                  <span className="block text-[11px] font-black text-white uppercase tracking-widest mb-1">{tip.label}</span>
                                  <p className="text-[11px] text-white/40 leading-relaxed">{tip.desc}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-8 bg-black/40 border border-white/10 rounded-[2rem]">
                          <h4 className="text-white font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-400" /> Exemplo de Sucesso
                          </h4>
                          <div className="bg-black/60 p-6 rounded-2xl border border-white/5 italic text-sm text-white/60 leading-relaxed relative">
                            <div className="absolute -top-3 -left-2 text-4xl text-cyber-blue/20">"</div>
                            Promoção de Inverno na Loja Master. Casacos com 50% de desconto. Use um tom urgente e animado, focando na economia e na qualidade das peças. Termine com o endereço da loja no centro.
                          </div>
                          <p className="mt-6 text-[10px] text-white/20 font-bold uppercase tracking-widest leading-relaxed">
                            Note como o exemplo dá liberdade para a IA criar os diálogos, mas mantém as informações comerciais fixas.
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-center mt-8">
                        <button 
                          onClick={() => exportManualTab('tips')}
                          className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue text-xs font-black uppercase tracking-widest hover:bg-cyber-blue/20 transition-all group"
                        >
                          <Download className="w-5 h-5 group-hover:animate-bounce" />
                          Exportar Dicas de Mestre
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {aboutTab === 'engine' && (
                    <motion.div 
                      key="engine"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-8"
                    >
                      <div className="p-8 bg-cyber-blue/10 border border-cyber-blue/30 rounded-[2.5rem] relative overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-center gap-6 mb-6 relative z-10">
                          <div className="relative group shrink-0">
                            <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-cyber-blue/50 shadow-[0_0_35px_rgba(0,242,255,0.45)] bg-black">
                              <img 
                                src="/src/assets/images/app_radio_icon_1790193192690.jpg" 
                                alt="Ícone Oficial D' MASTER PRODUTORA" 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                            <a 
                              href="/src/assets/images/app_radio_icon_1790193192690.jpg" 
                              download="icone_dmaster_produtora.jpg"
                              className="absolute -bottom-2 -right-2 p-2 bg-cyber-blue text-deep-navy rounded-xl shadow-lg border border-white/20 hover:scale-110 transition-transform"
                              title="Baixar Ícone Oficial em Alta Resolução"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          <div>
                            <h3 className="text-cyber-blue font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                              <Gem className="w-4 h-4" /> Identidade Visual & Motor Exclusivo
                            </h3>
                            <p className="text-sm md:text-base text-white/90 leading-relaxed font-medium italic">
                              O "DNA D' MASTER PRODUTORA" combina inteligência de roteirização neural com estética futurista de broadcast. O ícone oficial sintetiza o microfone clássico de estúdio com ondas sonoras quânticas.
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                          <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                            <span className="block text-[10px] font-black text-cyber-blue uppercase mb-2">Fluxo Premium</span>
                            <p className="text-[10px] text-white/40">O roteiro é interpretado com fluidez e naturalidade, garantindo uma audição elegante e profissional sem interrupções artificiais.</p>
                          </div>
                          <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                            <span className="block text-[10px] font-black text-cyber-blue uppercase mb-2">Multi-Persona</span>
                            <p className="text-[10px] text-white/40">Vozes que mudam de sotaque e tom conforme o contexto regional e social.</p>
                          </div>
                          <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                            <span className="block text-[10px] font-black text-cyber-blue uppercase mb-2">Masterização WAV</span>
                            <p className="text-[10px] text-white/40">Saída de áudio em alta fidelidade pronta para ir ao ar no rádio ou TV.</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center px-4">
                        <div className="flex gap-4">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Versão do Motor</span>
                            <span className="text-xs font-mono text-white/40">v6.5.2-PRO</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Status da Rede</span>
                            <span className="text-xs font-mono text-green-500/60">ONLINE</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">D' MASTER PRODUTORA © 2026</p>
                      </div>

                      <div className="flex justify-center mt-8">
                        <button 
                          onClick={() => exportManualTab('engine')}
                          className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue text-xs font-black uppercase tracking-widest hover:bg-cyber-blue/20 transition-all group"
                        >
                          <Download className="w-5 h-5 group-hover:animate-bounce" />
                          Exportar Guia do Motor
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => setShowAbout(false)}
                className="btn-3d-blue w-full mt-12 uppercase tracking-[0.3em] text-sm"
              >
                Entendido, Vamos Produzir
              </button>
            </motion.div>
          </div>
        )}

        {/* Roteiro e Playback */}
        {script && (
          <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 pb-24">
            <div className="glass-3d rounded-[3.5rem] border-t border-white/20 overflow-hidden">
              
              {/* Playback Header */}
              <div className="p-10 bg-white/5 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-6">
                  <div className="w-4 h-4 bg-cyber-blue rounded-full animate-ping shadow-[0_0_25px_rgba(0,242,255,1)]"></div>
                  <h2 className="text-4xl font-black text-white tracking-tighter font-display uppercase italic drop-shadow-lg">{script.title}</h2>
                </div>
                
                {/* Audio Waveform Visualizer */}
                <div className="flex items-center gap-1 h-12">
                  {waveform.map((h, i) => (
                    <motion.div 
                      key={i}
                      animate={{ height: h }}
                      className="w-1 waveform-bar"
                    />
                  ))}
                </div>

                <div className="flex flex-wrap gap-4 justify-center md:justify-end">
                  <button 
                    onClick={playScript}
                    className={cn(
                      "btn-3d-blue !py-4 !px-8 flex items-center gap-3",
                      playing && "bg-red-500/20 border-red-500/50 text-red-400"
                    )}
                  >
                    {playing ? (
                      <>
                        <Pause className="h-6 w-6 fill-current" />
                        <span className="uppercase tracking-[0.2em] text-sm">Parar Áudio</span>
                      </>
                    ) : (
                      <>
                        {generatedAudio ? <RotateCcw className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
                        <span className="uppercase tracking-[0.2em] text-sm">{generatedAudio ? 'Repetir Master' : 'Renderizar Master'}</span>
                      </>
                    )}
                  </button>
                  {generatedAudio && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => downloadAudio(true)}
                        disabled={exportingWav}
                        className="btn-3d-blue !py-4 !px-6 flex items-center gap-3"
                        title="Exportar Master em alta fidelidade WAV com a cadeia de efeitos DSP aplicada"
                      >
                        <Download className={cn("h-5 w-5", exportingWav && "animate-bounce")} />
                        <span className="uppercase tracking-[0.2em] text-xs font-black">
                          {exportingWav ? 'Processando...' : 'Exportar Master (FX)'}
                        </span>
                      </button>
                      <button 
                        onClick={() => downloadAudio(false)}
                        className="btn-3d-glass !py-4 !px-4 flex items-center gap-2 text-white/70 hover:text-white"
                        title="Exportar áudio limpo de estúdio sem processamento (Clean WAV)"
                      >
                        <Volume2 className="h-4 w-4 text-cyber-blue" />
                        <span className="uppercase tracking-[0.2em] text-[10px] font-black">WAV Clean</span>
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={exportScript}
                    className="btn-3d-glass !py-4 !px-8 flex items-center gap-3"
                  >
                    <FileText className="h-6 w-6" />
                    <span className="uppercase tracking-[0.2em] text-sm">Copiar Roteiro</span>
                  </button>
                </div>
              </div>

              {/* Rack de Masterização & Efeitos DSP do Spot */}
              <div className="p-6 md:p-8 bg-black/40 border-b border-white/10 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                        Rack de Efeitos DSP do Spot
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30">
                          {effectBypass ? 'BYPASS (DESLIGADO)' : AUDIO_EFFECT_PRESETS.find(p => p.id === activeAudioEffect)?.label}
                        </span>
                      </h4>
                      <p className="text-[10px] text-white/40">
                        {AUDIO_EFFECT_PRESETS.find(p => p.id === activeAudioEffect)?.description}
                      </p>
                    </div>
                  </div>

                  {/* Controles de Bypass e Intensidade */}
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setEffectBypass(!effectBypass)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-2",
                        effectBypass
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                          : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                      )}
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Bypass: {effectBypass ? 'LIGADO (SEM EFEITOS)' : 'DESLIGADO'}</span>
                    </button>

                    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                      <span className="text-[10px] font-black uppercase text-white/40 tracking-wider">Mix Wet/Dry:</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={effectIntensity}
                        onChange={(e) => setEffectIntensity(Number(e.target.value))}
                        disabled={effectBypass}
                        className="w-24 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyber-blue disabled:opacity-30"
                      />
                      <span className="text-xs font-mono font-bold text-cyber-blue">{effectIntensity}%</span>
                    </div>
                  </div>
                </div>

                {/* Seletor Rápido de Presets DSP */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {AUDIO_EFFECT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setActiveAudioEffect(preset.id);
                        addLog(`Efeito do player alterado para: ${preset.label.toUpperCase()}`, "info");
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1",
                        activeAudioEffect === preset.id
                          ? "bg-cyber-blue/20 border-cyber-blue text-white shadow-[0_0_15px_rgba(0,242,255,0.3)]"
                          : "bg-black/50 border-white/5 text-white/40 hover:bg-white/5 hover:text-white/80"
                      )}
                    >
                      <span className="text-base">{preset.icon}</span>
                      <span className="text-[8px] font-black uppercase tracking-wider truncate w-full">
                        {preset.label.replace(/\(.*\)/, '').trim()}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Equalizador de Master de 3 Bandas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between bg-black/30 px-3.5 py-2 rounded-xl border border-white/5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-white/40">Grave (120Hz)</span>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={eqSettings.bass}
                      onChange={(e) => setEqSettings(s => ({ ...s, bass: Number(e.target.value) }))}
                      className="w-24 h-1 bg-white/10 rounded accent-cyber-blue"
                    />
                    <span className="text-[10px] font-mono text-cyber-blue font-bold w-12 text-right">
                      {eqSettings.bass > 0 ? `+${eqSettings.bass}` : eqSettings.bass}dB
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-black/30 px-3.5 py-2 rounded-xl border border-white/5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-white/40">Médio (1.5kHz)</span>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={eqSettings.mid}
                      onChange={(e) => setEqSettings(s => ({ ...s, mid: Number(e.target.value) }))}
                      className="w-24 h-1 bg-white/10 rounded accent-cyber-blue"
                    />
                    <span className="text-[10px] font-mono text-cyber-blue font-bold w-12 text-right">
                      {eqSettings.mid > 0 ? `+${eqSettings.mid}` : eqSettings.mid}dB
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-black/30 px-3.5 py-2 rounded-xl border border-white/5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-white/40">Agudo (8kHz)</span>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={eqSettings.treble}
                      onChange={(e) => setEqSettings(s => ({ ...s, treble: Number(e.target.value) }))}
                      className="w-24 h-1 bg-white/10 rounded accent-cyber-blue"
                    />
                    <span className="text-[10px] font-mono text-cyber-blue font-bold w-12 text-right">
                      {eqSettings.treble > 0 ? `+${eqSettings.treble}` : eqSettings.treble}dB
                    </span>
                  </div>
                </div>

                {/* Cartwall de Efeitos Rápidos no Player */}
                <div className="flex items-center gap-2 pt-2 overflow-x-auto custom-scrollbar pb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/30 shrink-0 mr-2 flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-cyber-blue" /> Disparos SFX:
                  </span>
                  {RADIO_SFX_TRIGGERS.map((sfx) => {
                    const isTriggered = activeSfxTriggerId === sfx.id;
                    return (
                      <button
                        key={sfx.id}
                        type="button"
                        onClick={() => triggerSoundEffect(sfx.play, sfx.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 active:scale-95",
                          isTriggered
                            ? "bg-cyber-blue text-deep-navy border-cyber-blue shadow-[0_0_15px_rgba(0,242,255,0.7)]"
                            : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                        )}
                        title={`Tocar efeito ${sfx.name}`}
                      >
                        <span>{sfx.icon}</span>
                        <span>{sfx.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Production Notes */}
              <div className="px-8 py-4 bg-white/5 border-b border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Trilha Sugerida:</span>
                  <span className="text-xs text-blue-300 font-mono">{script.bgm_suggestion}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Efeitos:</span>
                  <div className="flex gap-2">
                    {script.sfx_hints.map((sfx, i) => (
                      <span key={i} className="text-[9px] bg-white/5 px-2 py-0.5 rounded border border-white/10 text-white/40">[{sfx}]</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Script Dialogue */}
              <div className="p-12 space-y-12 custom-scrollbar">
                {script.lines.map((line, idx) => (
                  <div key={idx} className={`flex flex-col ${line.speaker === 'Sadaltager' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-4 mb-3 ${line.speaker === 'Sadaltager' ? 'flex-row-reverse' : ''}`}>
                      <span className={`text-[11px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-xl border-t border-white/20 shadow-lg ${line.speaker === 'DUTRA' ? 'bg-cyber-blue text-deep-navy' : 'bg-white/10 text-white/60'}`}>
                        {line.speaker === 'DUTRA' ? `UNIDADE: ${dutraVoice} (${personaLabel})` : `UNIDADE: ${sadaltagerVoice}`}
                      </span>
                      <span className="text-[10px] font-mono text-white/30 uppercase italic tracking-widest">[{line.direction}]</span>
                    </div>
                    <div className={`relative max-w-[85%] p-8 rounded-[2.5rem] text-2xl leading-relaxed font-medium shadow-[0_20px_40px_rgba(0,0,0,0.4)] font-display border-t border-white/10 ${
                      line.speaker === 'DUTRA' 
                        ? 'bg-gradient-to-br from-blue-950/60 to-black/60 rounded-tl-none text-white italic' 
                        : 'bg-white/5 backdrop-blur-md rounded-tr-none text-white/90 text-right'
                    }`}>
                      {line.text}
                      <div className={`absolute -top-6 ${line.speaker === 'DUTRA' ? '-left-3' : '-right-3'} text-6xl text-white/5 font-serif pointer-events-none`}>"</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-6 bg-black/40 border-t border-white/10 text-center">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                  Gerado via D' MASTER PRODUTORA Motor • {targetDuration === 0 ? 'Tempo Livre' : `${targetDuration}s`} • Intensidade {intensity}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* API Diagnostics & Resolution Modal */}
        {showApiHelp && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[150] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="glass-3d rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 max-w-3xl w-full border-t border-white/20 my-auto"
            >
              <div className="flex justify-between items-center mb-8 pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue shadow-[0_0_20px_rgba(0,242,255,0.3)]">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest font-display italic">
                      Diagnóstico da API Gemini
                    </h2>
                    <p className="text-[11px] font-mono text-cyber-blue uppercase tracking-widest">
                      Como resolver erro de API Negada (403 / Permissão)
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowApiHelp(false)} 
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10 text-white/60 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Real-time Status Card */}
              <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full animate-pulse",
                      getApiKey() ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" : "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]"
                    )}></div>
                    <span className="text-xs font-black uppercase tracking-widest text-white">
                      Status da Variável GEMINI_API_KEY:
                    </span>
                    <span className={cn(
                      "text-xs font-mono font-bold px-3 py-1 rounded-full",
                      getApiKey() ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30"
                    )}>
                      {getApiKey() ? `Presente (${getApiKey().substring(0, 6)}...${getApiKey().slice(-4)})` : 'Não Detectada'}
                    </span>
                  </div>
                  <button
                    onClick={testApiConnection}
                    disabled={testingApi}
                    className="btn-3d-blue !py-2.5 !px-5 text-xs flex items-center justify-center gap-2 self-start sm:self-auto disabled:opacity-50"
                  >
                    {testingApi ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>{testingApi ? 'Testando...' : 'Testar Conexão'}</span>
                  </button>
                </div>

                {testResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-4 rounded-2xl text-xs font-mono border",
                      testResult.success 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
                        : "bg-red-500/10 border-red-500/30 text-red-300"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Step-by-Step Resolution Guide */}
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-2">
                  Passo a Passo para Desbloquear a API
                </h3>

                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-6 h-6 rounded-full bg-cyber-blue text-deep-navy font-black text-xs flex items-center justify-center">1</span>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Ativar a Generative Language API no Google Cloud</h4>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed pl-9">
                    No Google Cloud Console, toda chave de API precisa que a <strong className="text-white">Generative Language API</strong> esteja ativada no projeto. Se estiver desativada, qualquer chamada é bloqueada com <code className="text-cyber-cyan bg-white/5 px-1 py-0.5 rounded">403 PERMISSION_DENIED</code>.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-6 h-6 rounded-full bg-cyber-blue text-deep-navy font-black text-xs flex items-center justify-center">2</span>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Verificar Restrições da Chave (Credentials)</h4>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed pl-9">
                    No painel de Credenciais do Google Cloud: se a chave tiver <strong className="text-white">Restrições de API</strong>, verifique se a Generative Language API está permitida. Se tiver <strong className="text-white">Restrições de Aplicativo (HTTP Referrers / IP)</strong>, remova temporariamente para testar se a restrição é a causa do bloqueio.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.03] border border-cyber-blue/30 bg-cyber-blue/5 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-6 h-6 rounded-full bg-cyber-blue text-deep-navy font-black text-xs flex items-center justify-center">3</span>
                    <h4 className="text-sm font-bold text-cyber-blue uppercase tracking-wider">Criar Chave Direta no Google AI Studio (Mais Fácil)</h4>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed pl-9">
                    A forma mais rápida e garantida de evitar conflitos de permissão é gerar uma chave limpa direto no <strong className="text-white">Google AI Studio</strong> (aistudio.google.com/apikey) clicando em <em className="text-cyber-cyan">Create API key</em>. Essas chaves vêm pré-configuradas e prontas para uso.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-6 h-6 rounded-full bg-cyber-blue text-deep-navy font-black text-xs flex items-center justify-center">4</span>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Configurar a Variável no .env</h4>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed pl-9">
                    Insira a chave no arquivo <code className="text-cyber-cyan bg-white/5 px-1 py-0.5 rounded">.env</code> na raiz do projeto:
                  </p>
                  <pre className="mt-2 ml-9 p-3 bg-black/60 rounded-xl text-[11px] font-mono text-emerald-400 border border-white/10 overflow-x-auto">
GEMINI_API_KEY=AIzaSySuaChaveAquiSemEspacos
                  </pre>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setShowApiHelp(false)}
                  className="btn-3d-glass !py-3 !px-8 text-xs uppercase tracking-widest font-black"
                >
                  Entendido / Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Efeitos Sonoros, Sonoplastia e Masterização DSP */}
        {showEffectsModal && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[150] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="glass-3d rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 max-w-4xl w-full border-t border-white/20 my-auto space-y-8"
            >
              {/* Header do Modal */}
              <div className="flex justify-between items-center pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue shadow-[0_0_20px_rgba(0,242,255,0.3)]">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest font-display italic">
                      Mesa de Efeitos Sonoros & Master DSP
                    </h2>
                    <p className="text-[11px] font-mono text-cyber-blue uppercase tracking-widest">
                      Processamento de Áudio Broadcast, Equalização e Disparo Instantâneo
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEffectsModal(false)} 
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10 text-white/60 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 1. Presets de Efeitos de Voz & Master */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyber-blue" /> Presets de Processamento DSP de Voz
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEffectBypass(!effectBypass)}
                      className={cn(
                        "px-3 py-1 rounded-xl text-[10px] font-mono font-bold uppercase border transition-all",
                        effectBypass
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : "bg-white/5 border-white/10 text-white/40 hover:text-white"
                      )}
                    >
                      Bypass: {effectBypass ? 'ATIVADO' : 'DESATIVADO'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {AUDIO_EFFECT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setActiveAudioEffect(preset.id);
                        addLog(`Preset de efeito selecionado: ${preset.label.toUpperCase()}`, "info");
                      }}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 group",
                        activeAudioEffect === preset.id
                          ? "bg-cyber-blue/15 border-cyber-blue text-white shadow-[0_0_20px_rgba(0,242,255,0.25)]"
                          : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl group-hover:scale-110 transition-transform">{preset.icon}</span>
                        {activeAudioEffect === preset.id && (
                          <span className="w-2 h-2 rounded-full bg-cyber-blue animate-ping"></span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-white">
                          {preset.label}
                        </div>
                        <div className="text-[10px] text-white/40 mt-1 line-clamp-2 leading-relaxed">
                          {preset.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Equalizador de Master & Slider de Wet/Dry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white/[0.02] border border-white/10 rounded-3xl">
                {/* Wet/Dry Mix */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-wider text-white/70">
                      Mix de Intensidade (Wet / Dry)
                    </span>
                    <span className="text-xs font-mono font-bold text-cyber-blue">
                      {effectIntensity}% Processado
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={effectIntensity}
                    onChange={(e) => setEffectIntensity(Number(e.target.value))}
                    disabled={effectBypass}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyber-blue disabled:opacity-30"
                  />
                  <p className="text-[10px] text-white/40 leading-relaxed">
                    Controla a proporção entre o sinal puro do locutor (Dry) e a reverberação/compressão broadcast (Wet).
                  </p>
                </div>

                {/* Equalizador 3 Bandas */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-wider text-white/70">
                      Equalizador Master (EQ 3 Bandas)
                    </span>
                    <button
                      type="button"
                      onClick={() => setEqSettings({ bass: 2.5, mid: 1.5, treble: 2.0 })}
                      className="text-[9px] font-mono text-cyber-blue hover:underline"
                    >
                      Restaurar Padrão FM
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-white/40">Grave (120Hz):</span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        value={eqSettings.bass}
                        onChange={(e) => setEqSettings(s => ({ ...s, bass: Number(e.target.value) }))}
                        className="w-32 h-1 bg-white/10 rounded accent-cyber-blue"
                      />
                      <span className="text-cyber-blue font-bold w-12 text-right">
                        {eqSettings.bass > 0 ? `+${eqSettings.bass}` : eqSettings.bass}dB
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-white/40">Médio (1.5kHz):</span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        value={eqSettings.mid}
                        onChange={(e) => setEqSettings(s => ({ ...s, mid: Number(e.target.value) }))}
                        className="w-32 h-1 bg-white/10 rounded accent-cyber-blue"
                      />
                      <span className="text-cyber-blue font-bold w-12 text-right">
                        {eqSettings.mid > 0 ? `+${eqSettings.mid}` : eqSettings.mid}dB
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-white/40">Agudo (8kHz):</span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        value={eqSettings.treble}
                        onChange={(e) => setEqSettings(s => ({ ...s, treble: Number(e.target.value) }))}
                        className="w-32 h-1 bg-white/10 rounded accent-cyber-blue"
                      />
                      <span className="text-cyber-blue font-bold w-12 text-right">
                        {eqSettings.treble > 0 ? `+${eqSettings.treble}` : eqSettings.treble}dB
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Disparador de Cartwall Instantâneo */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                    <Disc className="w-4 h-4 text-cyber-blue" /> Disparo de Efeitos Instantâneos (Cartwall)
                  </label>
                  <span className="text-[10px] font-mono text-white/30">Testar áudio dos efeitos</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                  {RADIO_SFX_TRIGGERS.map((sfx) => {
                    const isTriggered = activeSfxTriggerId === sfx.id;
                    return (
                      <button
                        key={sfx.id}
                        type="button"
                        onClick={() => triggerSoundEffect(sfx.play, sfx.id)}
                        className={cn(
                          "p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 group active:scale-95",
                          isTriggered
                            ? "bg-cyber-blue text-deep-navy border-cyber-blue shadow-[0_0_25px_rgba(0,242,255,0.8)] scale-105"
                            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-cyber-blue/40"
                        )}
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">
                          {sfx.icon}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-center line-clamp-1">
                          {sfx.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                <span className="text-[11px] text-white/40 font-mono">
                  Efeito ativo: <strong className="text-cyber-blue">{AUDIO_EFFECT_PRESETS.find(p => p.id === activeAudioEffect)?.label}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShowEffectsModal(false)}
                  className="btn-3d-blue !py-3 !px-8 text-xs uppercase tracking-widest font-black"
                >
                  Concluir & Aplicar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Tutorial & Guia Passo a Passo Completo */}
        {showTutorial && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[160] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="glass-3d rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 max-w-5xl w-full border-t border-white/20 my-auto space-y-6 max-h-[92vh] flex flex-col"
            >
              {/* Header do Tutorial */}
              <div className="flex justify-between items-center pb-6 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyber-blue/15 border border-cyber-blue/40 flex items-center justify-center text-cyber-blue shadow-[0_0_20px_rgba(0,242,255,0.4)]">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest font-display italic">
                      Manual Completo: Como Usar a Produtora
                    </h2>
                    <p className="text-[11px] font-mono text-cyber-blue uppercase tracking-widest">
                      Guia Detalhado de Cada Função • Do Briefing à Master WAV de Rádio
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTutorial(false)} 
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10 text-white/60 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Abas de Navegação do Tutorial */}
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 shrink-0">
                {[
                  { id: 'quickstart', label: '1. Passo a Passo Rápido', icon: '🚀' },
                  { id: 'personas', label: '2. Locutores & Personas', icon: '🎙️' },
                  { id: 'effects', label: '3. Efeitos Sonoros & Master DSP', icon: '🎛️' },
                  { id: 'image', label: '4. Leitura de Panfletos (IA)', icon: '🖼️' },
                  { id: 'faq', label: '5. Dicas de Ouro & FAQ', icon: '💡' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTutorialTab(tab.id as any)}
                    className={cn(
                      "px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0",
                      tutorialTab === tab.id
                        ? "bg-cyber-blue text-deep-navy border-cyber-blue shadow-[0_0_20px_rgba(0,242,255,0.4)]"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Conteúdo Dinâmico das Abas */}
              <div className="overflow-y-auto custom-scrollbar pr-2 space-y-6 flex-1 text-white/80">
                {/* ABA 1: PASSO A PASSO RÁPIDO */}
                {tutorialTab === 'quickstart' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-2xl bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-cyan text-xs leading-relaxed flex items-center gap-3">
                      <Sparkles className="w-5 h-5 shrink-0 text-cyber-blue" />
                      <span>
                        <strong>Visão Geral:</strong> O sistema cria roteiros com persuasão comercial avançada e gera a locução sintetizada em áudio de alta fidelidade com efeitos sonoros e processamento master broadcast.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Passo 1 */}
                      <div className="p-6 bg-white/[0.03] border border-white/10 rounded-3xl space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-cyber-blue/20 border border-cyber-blue/40 text-cyber-blue flex items-center justify-center font-black text-sm">1</span>
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">
                            Insira o Tema ou Suba a Foto
                          </h4>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          No campo principal <strong>"Briefing Criativo da Campanha"</strong>, escreva o que você quer anunciar.
                        </p>
                        <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[11px] font-mono text-cyber-blue/90 space-y-1">
                          <span className="text-white/40 block text-[9px] uppercase font-sans">Exemplo de briefing:</span>
                          <em>"Supermercado São Bento: Fim de semana da carne. Picanha R$ 39,90, cerveja lata R$ 2,49. Ofertas válidas sexta e sábado."</em>
                        </div>
                        <p className="text-[11px] text-white/50">
                          📸 <strong>Dica:</strong> Se você já tiver o panfleto impresso ou encarte, basta clicar no botão com o ícone de câmera para carregar a imagem. A IA lerá tudo automaticamente.
                        </p>
                      </div>

                      {/* Passo 2 */}
                      <div className="p-6 bg-white/[0.03] border border-white/10 rounded-3xl space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-cyber-blue/20 border border-cyber-blue/40 text-cyber-blue flex items-center justify-center font-black text-sm">2</span>
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">
                            Escolha a Persona & Efeitos Sonoros
                          </h4>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Selecione como a propaganda deve soar:
                        </p>
                        <ul className="text-xs space-y-2 text-white/70">
                          <li className="flex items-start gap-2">
                            <span className="text-cyber-blue font-bold">•</span>
                            <span><strong>Persona:</strong> Escolha <em>Locutor de Varejão</em> (comerciais agressivos), <em>Dutra Clássico</em> (comercial padrão), <em>Caipira</em> (interior/agro), etc.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-cyber-blue font-bold">•</span>
                            <span><strong>Perfil de SFX:</strong> Escolha <em>Varejo & Impacto</em> para vinhetas fortes, ou <em>Rádio FM</em> para som moderno de rádio.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-cyber-blue font-bold">•</span>
                            <span><strong>Tempo do Spot:</strong> 15s (rápido), 30s (padrão de rádio), 45s ou 60s.</span>
                          </li>
                        </ul>
                      </div>

                      {/* Passo 3 */}
                      <div className="p-6 bg-white/[0.03] border border-white/10 rounded-3xl space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-cyber-blue/20 border border-cyber-blue/40 text-cyber-blue flex items-center justify-center font-black text-sm">3</span>
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">
                            Gere o Roteiro & o Áudio
                          </h4>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Você tem duas opções no painel:
                        </p>
                        <div className="space-y-2">
                          <div className="p-3 bg-cyber-blue/10 border border-cyber-blue/30 rounded-xl">
                            <span className="text-xs font-black text-white uppercase block">Botão Azul "Gerar Spot Completo" (Recomendado):</span>
                            <span className="text-[11px] text-white/60">Gera o roteiro de rádio e, logo em seguida, já produz a gravação de áudio automaticamente.</span>
                          </div>
                          <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                            <span className="text-xs font-black text-white/70 uppercase block">Botão "Apenas Roteiro":</span>
                            <span className="text-[11px] text-white/50">Cria somente o texto para você revisar ou imprimir antes de gravar.</span>
                          </div>
                        </div>
                      </div>

                      {/* Passo 4 */}
                      <div className="p-6 bg-white/[0.03] border border-white/10 rounded-3xl space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-cyber-blue/20 border border-cyber-blue/40 text-cyber-blue flex items-center justify-center font-black text-sm">4</span>
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">
                            Ouça, Masterize & Baixe em WAV
                          </h4>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Assim que o áudio terminar de ser gerado, o <strong>Player Master</strong> aparecerá com o controle completo:
                        </p>
                        <ul className="text-xs space-y-2 text-white/70">
                          <li className="flex items-start gap-2">
                            <span className="text-cyber-blue font-bold">•</span>
                            <span><strong>Play/Pause:</strong> Ouça com os efeitos aplicados em tempo real (Rádio FM, Grave Titânico, Arena, etc.).</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-cyber-blue font-bold">•</span>
                            <span><strong>Exportar Master (FX):</strong> Baixa o arquivo <code>.WAV</code> pronto para veicular no rádio ou carro de som com toda a compressão e processamento.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-cyber-blue font-bold">•</span>
                            <span><strong>WAV Clean:</strong> Baixa a voz pura de estúdio sem filtros para quem vai fazer a mixagem final em Reaper/Audacity/Pro Tools.</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* Botão de Exemplo Prático */}
                    <div className="p-5 bg-gradient-to-r from-blue-900/40 to-slate-900 border border-cyber-blue/30 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <h5 className="text-xs font-black text-white uppercase tracking-wider">
                          Quer ver na prática como funciona?
                        </h5>
                        <p className="text-[11px] text-white/50">
                          Preencha um briefing de exemplo automaticamente para testar a geração em 1 clique.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTheme("Supermercado Estrela D'Alva: Festival de Carnes e Cervejas. Picanha Grill Fatiada de R$ 69,90 por apenas R$ 39,90 o quilo! Cerveja Heineken lata 350ml por R$ 4,19. Arroz Tio João 5kg só R$ 22,90. É só neste sábado e domingo ou enquanto durar o estoque. Corra pro Estrela D'Alva!");
                          setSelectedPersona('varejao');
                          setNarrativeStyle('retail_aggressive');
                          setSfxProfile('retail_impact');
                          setActiveAudioEffect('broadcast_fm');
                          setTargetDuration(30);
                          setShowTutorial(false);
                          showSuccess("Exemplo carregado no estúdio! Clique em 'Gerar Spot Completo'.");
                        }}
                        className="btn-3d-blue !py-2.5 !px-6 text-xs uppercase font-black tracking-widest shrink-0"
                      >
                        Carregar Exemplo de Varejo
                      </button>
                    </div>
                  </div>
                )}

                {/* ABA 2: LOCUTORES & PERSONAS */}
                {tutorialTab === 'personas' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs leading-relaxed space-y-2">
                      <h4 className="font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyber-blue" />
                        Quem são os locutores?
                      </h4>
                      <p className="text-white/60">
                        O sistema conta com dois locutores virtuais que podem atuar em <strong>Dueto</strong> (conversando ou fazendo coro) ou em <strong>Locutor Único</strong> (apenas a voz principal).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 bg-black/40 border border-cyber-blue/30 rounded-3xl space-y-2">
                        <div className="flex items-center gap-2 text-cyber-blue font-black text-xs uppercase tracking-wider">
                          <User className="w-4 h-4" /> Locutor Principal (DUTRA)
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed">
                          É a voz líder do spot. Responsável pela abertura impactante, pelas ofertas centrais e pelo fechamento da chamada para ação (CTA). Assume a persona selecionada abaixo.
                        </p>
                      </div>

                      <div className="p-5 bg-black/40 border border-white/10 rounded-3xl space-y-2">
                        <div className="flex items-center gap-2 text-white/60 font-black text-xs uppercase tracking-wider">
                          <Users className="w-4 h-4" /> Segunda Voz (SAMUCA)
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed">
                          Usado no modo Dueto para dar dinamismo, fazer perguntas, reforçar preços ou criar diálogo descontraído com o locutor principal.
                        </p>
                      </div>
                    </div>

                    {/* Personas Explicadas */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-cyber-blue">
                        Guia das 6 Personas Disponíveis:
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { name: 'Dutra Clássico', icon: '🎙️', desc: 'Voz padrão de rádio comercial. Equilibrada, autoritária, confiável. Ideal para comércios em geral, prestadores de serviços e rádio diária.' },
                          { name: 'Locutor de Varejão', icon: '📢', desc: 'Estilo feirão e hipermercado. Rápido, enérgico, enfático, com chamada para preços imperdíveis e senso de urgência máxima.' },
                          { name: 'Institucional Elegante', icon: '💎', desc: 'Tom aveludado, suave e requintado. Perfeito para concessionárias, joalherias, clínicas, imobiliárias de luxo e marcas nobres.' },
                          { name: 'Locutor Caipira / Agro', icon: '🌾', desc: 'Sotaque acolhedor do interior ("uai", "sô", "trem bão"). Excelente para agropecuárias, casas de ração, rodeios e feirões rurais.' },
                          { name: 'Sensacionalista / Plantão', icon: '🚨', desc: 'Estilo "urgente / breaking news". Tom alarmante para promoções relâmpago que o cliente não pode perder de jeito nenhum.' },
                          { name: 'Descontraído / Jovem', icon: '🔥', desc: 'Linguagem solta, informal e moderna. Ideal para hamburguerias, eventos universitários, lojas de roupas e tecnologia.' },
                        ].map((p, idx) => (
                          <div key={idx} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                            <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wide">
                              <span>{p.icon}</span>
                              <span>{p.name}</span>
                            </div>
                            <p className="text-[11px] text-white/50 leading-relaxed">{p.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chave Locutor Único */}
                    <div className="p-4 bg-cyber-blue/10 border border-cyber-blue/20 rounded-2xl flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-black text-white uppercase block">
                          Prefere apenas 1 locutor falando?
                        </span>
                        <span className="text-[11px] text-white/60">
                          Basta marcar a opção <strong>"Locutor Único (Apenas Dutra)"</strong> na coluna de Personas.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA 3: EFEITOS SONOROS & MASTER DSP */}
                {tutorialTab === 'effects' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs leading-relaxed space-y-1">
                      <h4 className="font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-cyber-blue" />
                        O que é o Processamento DSP e a Sonoplastia?
                      </h4>
                      <p className="text-white/60">
                        A produtora possui uma <strong>cadeia de processamento de áudio em tempo real</strong> (Digital Signal Processing) construída em Web Audio API. Ela simula processadores profissionais de estúdio como Orban Optimod e Omnia FM.
                      </p>
                    </div>

                    {/* Presets Explicados */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-cyber-blue">
                        1. Presets de Voz & Master:
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { name: 'Voz Direta (Clean)', icon: '🎙️', desc: 'Áudio original de estúdio sem alterações, para quem quer o som natural.' },
                          { name: 'Rádio FM Broadcast', icon: '📻', desc: 'Compressor óptico com reforço de brilho e presença. O clássico som de emissora FM.' },
                          { name: 'Grave Titânico', icon: '💥', desc: 'Reforço ultra-pesado de sub-graves. A voz fica profunda como em trailers de cinema.' },
                          { name: 'Megafone / Carro de Som', icon: '📣', desc: 'Filtro passa-banda telefônico e de corneta, com distorção característica de rua.' },
                          { name: 'Arena & Rodeio', icon: '🏟️', desc: 'Reverb espacial com reflexões longas, simulando estádio, arena ou exposição.' },
                          { name: 'Reverb Quântico', icon: '✨', desc: 'Ambiência suave de estúdio tratado acusticamente para dar vida à locução.' },
                          { name: 'Eco de Vinheta (Delay)', icon: '🔁', desc: 'Repetições estéreo sincopadas para gerar o efeito de eco típico de rádio jovem.' },
                          { name: 'Cyber Robótico', icon: '🤖', desc: 'Filtro comb e modulação metálica para anúncios futuristas e tecnológicos.' },
                        ].map((item, idx) => (
                          <div key={idx} className="p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                            <div className="flex items-center gap-2 text-xs font-black text-white uppercase">
                              <span className="text-base">{item.icon}</span>
                              <span className="truncate">{item.name}</span>
                            </div>
                            <p className="text-[10px] text-white/40 leading-relaxed line-clamp-3">{item.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Controles de Mesa */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-1">
                        <span className="text-xs font-black text-cyber-blue uppercase block">Mix Wet / Dry</span>
                        <p className="text-[11px] text-white/50 leading-relaxed">
                          Define quanto do efeito você quer misturar com a voz original (0% = áudio puro; 85% = padrão equilibrado; 100% = efeito total).
                        </p>
                      </div>

                      <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-1">
                        <span className="text-xs font-black text-cyber-blue uppercase block">Botão Bypass</span>
                        <p className="text-[11px] text-white/50 leading-relaxed">
                          Permite comparar o áudio com e sem efeitos na hora (comparação A/B instantânea) sem perder suas regulagens.
                        </p>
                      </div>

                      <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-1">
                        <span className="text-xs font-black text-cyber-blue uppercase block">Equalizador 3 Bandas</span>
                        <p className="text-[11px] text-white/50 leading-relaxed">
                          Regule Graves (120Hz), Médios (1.5kHz) e Agudos (8kHz) em decibéis (-12dB a +12dB) no player ou no modal de efeitos.
                        </p>
                      </div>
                    </div>

                    {/* Cartwall */}
                    <div className="p-4 bg-black/50 border border-white/10 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black text-white uppercase">
                        <Disc className="w-4 h-4 text-cyber-blue" />
                        2. Mesa de Disparo Rápido (Cartwall Soundboard):
                      </div>
                      <p className="text-[11px] text-white/60 leading-relaxed">
                        No console e no player, você tem botões como <strong>💥 Impacto</strong>, <strong>🚀 Whoosh</strong>, <strong>🚨 Alerta</strong> e <strong>🔔 Sino</strong>. Eles são sons sintetizados na hora no seu navegador para você testar ideias de sonoplastia durante a produção.
                      </p>
                    </div>
                  </div>
                )}

                {/* ABA 4: LEITURA DE IMAGEM */}
                {tutorialTab === 'image' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-2xl bg-cyber-blue/10 border border-cyber-blue/30 text-xs text-cyber-cyan leading-relaxed">
                      <strong>Tecnologia Multimodal Gemini:</strong> Você não precisa digitar toda a lista de preços do seu cliente! Basta tirar uma foto do panfleto, tabloide de ofertas ou card do Instagram.
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                        Como usar a leitura por imagem passo a passo:
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                          <span className="text-lg font-mono text-cyber-blue font-bold">Passo 1</span>
                          <h5 className="text-xs font-black text-white uppercase">Localize o Botão da Câmera</h5>
                          <p className="text-[11px] text-white/50 leading-relaxed">
                            No painel central, junto ao campo do briefing, clique no botão azul com o ícone de <strong>Câmera / Imagem</strong>.
                          </p>
                        </div>

                        <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                          <span className="text-lg font-mono text-cyber-blue font-bold">Passo 2</span>
                          <h5 className="text-xs font-black text-white uppercase">Selecione o Arquivo</h5>
                          <p className="text-[11px] text-white/50 leading-relaxed">
                            Suba um arquivo JPG, PNG ou WEBP do encarte de supermercado, panfleto da loja ou card de promoção.
                          </p>
                        </div>

                        <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                          <span className="text-lg font-mono text-cyber-blue font-bold">Passo 3</span>
                          <h5 className="text-xs font-black text-white uppercase">Clique em Gerar</h5>
                          <p className="text-[11px] text-white/50 leading-relaxed">
                            A IA lê os nomes das marcas, valores monetários e datas no encarte e monta um texto de alta conversão pronto para rádio.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] text-white/60 space-y-1">
                      <span className="text-white font-bold uppercase block text-xs">💡 Dica para fotos:</span>
                      <p>
                        Tire a foto em ambiente bem iluminado e certifique-se de que os números de preços estão visíveis e nítidos para melhor precisão da IA.
                      </p>
                    </div>
                  </div>
                )}

                {/* ABA 5: DICAS DE OURO & FAQ */}
                {tutorialTab === 'faq' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-cyber-blue">
                        Perguntas Frequentes & Melhores Práticas:
                      </h4>

                      <div className="space-y-3">
                        <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-1">
                          <span className="text-xs font-black text-white uppercase block">
                            Quanto tempo dura cada spot e quantas palavras ele tem?
                          </span>
                          <p className="text-[11px] text-white/50 leading-relaxed">
                            • <strong>15 segundos:</strong> Cerca de 30 a 35 palavras (ideal para chamadas relâmpago).<br/>
                            • <strong>30 segundos (Mais usado):</strong> Cerca de 60 a 70 palavras (equilíbrio perfeito entre ofertas e assinatura).<br/>
                            • <strong>45 segundos:</strong> Cerca de 95 a 105 palavras.<br/>
                            • <strong>60 segundos:</strong> Cerca de 130 a 140 palavras (spots com muitas ofertas ou histórias institucionais).
                          </p>
                        </div>

                        <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-1">
                          <span className="text-xs font-black text-white uppercase block">
                            Qual a diferença entre "Exportar Master (FX)" e "WAV Clean"?
                          </span>
                          <p className="text-[11px] text-white/50 leading-relaxed">
                            • <strong>Exportar Master (FX):</strong> Renderiza o áudio WAV com o preset escolhido (ex: Rádio FM, Grave Titânico) e o equalizador aplicados diretamente no arquivo. Pronto para tocar.<br/>
                            • <strong>WAV Clean:</strong> Baixa apenas a voz sintetizada limpa sem nenhum efeito master, perfeito para produtores que montam trilhas e efeitos em programas como Reaper, Cubase ou Pro Tools.
                          </p>
                        </div>

                        <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-1">
                          <span className="text-xs font-black text-white uppercase block">
                            O que fazer se aparecer o erro "API Negada (Erro 403 / Permissão)"?
                          </span>
                          <p className="text-[11px] text-white/50 leading-relaxed">
                            Clique no botão <strong>"Status da API"</strong> no cabeçalho. Lá você pode testar a conexão em tempo real e ver se a sua chave do Google AI Studio tem acesso habilitado à <em>Generative Language API</em>.
                          </p>
                        </div>

                        <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-1">
                          <span className="text-xs font-black text-white uppercase block">
                            Como salvar o texto do roteiro?
                          </span>
                          <p className="text-[11px] text-white/50 leading-relaxed">
                            Ao lado do botão de áudio, clique em <strong>"Exportar TXT"</strong>. Ele salva um documento profissional com divisões de falas, indicações de sonoplastia (SFX) e sugestões de trilha sonora para seu arquivo de gravações.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé do Modal */}
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                <span className="text-[11px] text-white/40 font-mono">
                  D' MASTER PRODUTORA • Suporte & Operação Inteligente
                </span>
                <button
                  type="button"
                  onClick={() => setShowTutorial(false)}
                  className="btn-3d-blue !py-2.5 !px-8 text-xs uppercase tracking-widest font-black"
                >
                  Entendi, ir para o Estúdio!
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Floating Errors */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="fixed top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 md:px-8 py-4 rounded-2xl shadow-[0_0_50px_rgba(0,242,255,0.4)] z-[200] border border-cyber-blue/40 flex items-center gap-4 max-w-2xl w-[90%]"
            >
              <AlertCircle className="w-6 h-6 text-cyber-blue shrink-0" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyber-blue">Diagnóstico da Operação</span>
                <span className="text-xs md:text-sm font-bold tracking-tight text-white/90 truncate">{error}</span>
              </div>
              <button 
                onClick={() => { setShowApiHelp(true); setError(null); }}
                className="px-3 py-1.5 rounded-xl bg-cyber-blue text-deep-navy text-[11px] font-black uppercase tracking-wider hover:bg-cyber-cyan transition-all shrink-0 shadow-sm"
              >
                Como Resolver
              </button>
              <button onClick={() => setError(null)} className="hover:opacity-60 transition-opacity text-white/50 hover:text-white shrink-0">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default App;
