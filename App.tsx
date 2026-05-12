
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
  ScriptOutput, 
  VoiceName, 
  AVAILABLE_VOICES, 
  NARRATIVE_STYLES, 
  DURATIONS,
  TONES, 
  EMOTIONS,
  PERSONAS
} from './types';
import { decode, decodeAudioData, createWavBlob } from './services/audioUtils';
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
  Upload
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
  
  // Voice Settings
  const [dutraVoice, setDutraVoice] = useState<VoiceName>('Charon');
  const [sadaltagerVoice, setSadaltagerVoice] = useState<VoiceName>('Kore');
  
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [aboutTab, setAboutTab] = useState<'map' | 'recipes' | 'tips' | 'engine'>('map');
  const [campaignImage, setCampaignImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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

  const generateScript = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    setError(null);
    setScript(null);
    setGeneratedAudio(null);
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Chave de API (GEMINI_API_KEY) não encontrada no ambiente.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const durationLabel = targetDuration === 0 ? "Tempo Livre" : `${targetDuration} segundos`;
      
      addLog(`Iniciando síntese D' MASTER PRODUTORA...`, "info");
      addLog(`Estilo: ${styleLabel} | Persona: ${personaLabel}`, "info");

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
        model: 'gemini-3-flash-preview',
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
      setError(`Erro na síntese: ${err.message || "Erro desconhecido"}`);
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
        const audioBuffer = await decodeAudioData(generatedAudio, ctx, 24000, 1);
        const source = ctx.createBufferSource();
        sourceRef.current = source;
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
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
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Chave de API não encontrada.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const isDynamic = narrativeStyle === 'dynamic_retail';
      const isMotivational = narrativeStyle === 'motivational';
      
      // Se for locutor único, removemos os nomes dos locutores do prompt para evitar confusão
      const ttsPrompt = `Interprete este roteiro com EMOÇÃO HUMANA, FLUIDEZ PREMIUM e RESPIRAÇÃO NATURAL.
      Busque uma entrega natural e contínua (Legato), evitando pausas artificiais. A pontuação deve ser interpretada como inflexão vocal, não como interrupção de fluxo.
      ${isDynamic ? 'Use uma voz de comercial de rádio profissional, alta energia e persuasiva, mas muito fluida.' : ''}
      ${isMotivational ? 'Use um tom inspirador e elegante, com passagens suaves entre os sentimentos.' : ''}
      ${narrativeStyle === 'sound_truck' ? 'Use uma voz de alto impacto, mas com dicção limpa e fluxo contínuo.' : ''}
      ${selectedPersona === 'rodeio' ? 'Use uma voz épica e potente, mantendo o fôlego e a conexão entre as frases.' : ''}
      
      Roteiro:
      ` + script.lines.map(line => {
        const speakerPart = singleSpeaker ? "" : `${line.speaker}: `;
        return `${speakerPart}(Direção: ${line.direction}) ${line.text}`;
      }).join('\n');

      const speechConfig: any = {};
      if (singleSpeaker) {
        speechConfig.voiceConfig = {
          prebuiltVoiceConfig: { voiceName: dutraVoice }
        };
      } else {
        speechConfig.multiSpeakerVoiceConfig = {
          speakerVoiceConfigs: [
            {
              speaker: 'DUTRA',
              voiceConfig: { prebuiltVoiceConfig: { voiceName: dutraVoice } }
            },
            {
              speaker: 'Sadaltager',
              voiceConfig: { prebuiltVoiceConfig: { voiceName: sadaltagerVoice } }
            }
          ]
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("Falha na renderização do áudio.");

      addLog("Áudio renderizado. Iniciando reprodução.", "success");
      const pcmBytes = decode(base64Audio);
      setGeneratedAudio(pcmBytes);

      const ctx = initAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const audioBuffer = await decodeAudioData(pcmBytes, ctx, 24000, 1);
      const source = ctx.createBufferSource();
      sourceRef.current = source;
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setPlaying(false);
        sourceRef.current = null;
      };
      source.start();
    } catch (err: any) {
      console.error("Erro no playScript:", err);
      setError(err.message || "Erro na interpretação de áudio.");
      setPlaying(false);
    }
  };

  const downloadAudio = () => {
    if (!generatedAudio || !script) return;
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
    content += `DIRETRIZES DE ÁUDIO (SONOPLASTIA)\n`;
    content += `--------------------------------------------------------------------------------\n`;
    content += `TRILHA: ${script.bgm_suggestion.toUpperCase()}\n\n`;
    
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
              initial={{ rotate: -10, scale: 0.9 }}
              animate={{ rotate: 3, scale: 1 }}
              className="relative"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-cyber-blue to-blue-800 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-950/50 border border-white/30 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                <Radio className="h-8 w-8 text-white relative z-10" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-cyber-cyan rounded-full border-2 border-[#020617] animate-pulse shadow-[0_0_10px_rgba(0,212,255,0.5)]"></div>
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

          <div className="flex gap-3">
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
                  <div className="w-3 h-3 bg-cyber-blue rounded-full shadow-[0_0_15px_rgba(0,242,255,0.8)]"></div>
                  <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest font-display italic">Manual Tático D' MASTER</h2>
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
                        <div className="absolute top-0 right-0 p-6 opacity-10">
                          <Radio className="w-32 h-32 text-cyber-blue" />
                        </div>
                        <h3 className="text-cyber-blue font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Gem className="w-4 h-4" /> Diferencial Exclusivo
                        </h3>
                        <p className="text-lg text-white/90 leading-relaxed font-medium italic mb-6 relative z-10">
                          O "DNA D' MASTER PRODUTORA" não é apenas um gerador de texto. É um motor que entende a alma do rádio brasileiro, gírias técnicas e oferece uma interpretação humana com variações de timbre e ritmo.
                        </p>
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
                    <button 
                      onClick={downloadAudio}
                      className="btn-3d-glass !py-4 !px-8 flex items-center gap-3"
                    >
                      <Download className="h-6 w-6" />
                      <span className="uppercase tracking-[0.2em] text-sm">Exportar WAV</span>
                    </button>
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

        {/* Floating Errors */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="fixed top-10 left-1/2 -translate-x-1/2 bg-cyber-blue text-deep-navy px-8 py-4 rounded-2xl shadow-[0_0_40px_rgba(0,242,255,0.5)] z-[200] border-t border-white/30 flex items-center gap-4"
            >
              <AlertCircle className="w-6 h-6" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Mau Funcionamento do Sistema</span>
                <span className="text-sm font-bold tracking-tight">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="ml-4 hover:opacity-60 transition-opacity">
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
