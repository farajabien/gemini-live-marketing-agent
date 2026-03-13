"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveAPIConfig {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
  onMessage?: (message: any) => void;
  onConnected?: () => void;
  onReady?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onAudioData?: (base64Audio: string) => void;
}

export function useLiveAPI({
  apiKey,
  model = "models/gemini-2.0-flash-exp", 
  systemInstruction,
  onMessage,
  onConnected,
  onReady,
  onDisconnected,
  onError,
  onAudioData,
}: LiveAPIConfig) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [volume, setVolume] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);

  const playPCMData = useCallback((base64: string) => {
    if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 }); // Google uses 24kHz for output
    }
    const ctx = audioContextRef.current;
    
    // Convert base64 to Float32
    const binary = atob(base64);
    const pcm = new Int16Array(new ArrayBuffer(binary.length));
    const bytes = new Uint8Array(pcm.buffer);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const float32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      float32[i] = pcm[i] / 0x7FFF;
    }
    
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
  }, []);

  const connect = useCallback(async () => {
    if (wsRef.current || isConnecting) return;

    setIsConnecting(true);
    try {
      if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please check your environment variables.");
      }

      // Switching to v1alpha as v1beta is rejecting 2.0 Flash models currently
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      console.log("Director: Connecting to", url.split('?')[0]); 
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        onConnected?.();

        // v1beta BidiGenerateContent setup
        const setup: any = {
          setup: {
            model: "models/gemini-2.0-flash-exp", 
            generation_config: {
              response_modalities: ["TEXT", "AUDIO"]
            }
          }
        };

        if (systemInstruction) {
          setup.setup.system_instruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        console.log("Director: Sending setup message:", setup.setup.model);
        ws.send(JSON.stringify(setup));
      };

      ws.onmessage = (event) => {
        if (event.data instanceof Blob) {
          // If we receive a Blob, it's likely binary audio data.
          return;
        }

        try {
          console.log("Director Socket Raw:", event.data.substring(0, 100));
          const message = JSON.parse(event.data);
          console.log("Director Message Parsed:", JSON.stringify(message).substring(0, 200));
          
          if (message.setupComplete || message.setup_complete) {
            setIsReady(true);
            console.log("Director Ready");
            onReady?.();
            return;
          }

          // Handle server content from model turn (handle both camel and snake variations)
          const sc = message.serverContent || message.server_content;
          const mt = sc?.modelTurn || sc?.model_turn;
          
          if (mt?.parts?.[0]?.inlineData?.data || mt?.parts?.[0]?.inline_data?.data) {
            const base64Audio = mt.parts[0].inlineData?.data || mt.parts[0].inline_data?.data;
            playPCMData(base64Audio);
          }
          
          // Handle text responses
          const text = mt?.parts?.find((p: any) => p.text)?.text;
          if (text) {
             console.log("Director Text Response:", text);
          }

          // Handle interrupts
          if (sc?.interrupted) {
            nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
          }

          onMessage?.(message);
        } catch (e) {
          console.error("Failed to parse socket message:", e);
        }
      };

      ws.onclose = (event) => {
        console.warn(`WebSocket Closed. Code: ${event.code}, Reason: ${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);
        setIsReady(false);
        wsRef.current = null;
        onDisconnected?.();
        stopAudio();
      };

      ws.onerror = (event) => {
        console.error("WebSocket Error Observed:", event);
        const error = new Error("Director connection failed. Please check your API key and permissions.");
        onError?.(error);
        setIsConnecting(false);
      };

    } catch (err) {
      onError?.(err as Error);
      setIsConnecting(false);
    }
  }, [apiKey, model, onConnected, onDisconnected, onMessage, onError, onAudioData]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    stopAudio();
  }, []);

  const sendText = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    // Use snake_case for the wire format in BidiGenerateContent
    const message = {
      client_content: {
        turns: [{
          role: "user",
          parts: [{ text }]
        }],
        turn_complete: true
      }
    };
    wsRef.current.send(JSON.stringify(message));
  }, []);

  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for UI
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
        }
        setVolume(Math.sqrt(sum / inputData.length));

        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        // Send as base64 - more robust conversion for chunks
        if (wsRef.current?.readyState === WebSocket.OPEN && isReady) {
          const bytes = new Uint8Array(pcmData.buffer);
          let binary = "";
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          
          wsRef.current.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: "audio/pcm;rate=16000",
                data: base64
              }]
            }
          }));
        }
      };
    } catch (err) {
      console.error("Failed to start audio capture:", err);
      onError?.(err as Error);
    }
  }, [onError]);

  const stopAudio = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      stopAudio();
    };
  }, [stopAudio]);

  return {
    isConnected,
    isConnecting,
    isReady,
    volume,
    connect,
    disconnect,
    sendText,
    startAudio,
    stopAudio,
  };
}
