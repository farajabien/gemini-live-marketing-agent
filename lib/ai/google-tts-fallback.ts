import textToSpeech from '@google-cloud/text-to-speech';
import { nanoid } from 'nanoid';

/**
 * Generate TTS audio using Google Cloud as a fallback.
 * @param text The text to synthesize
 * @param voice Optional: Google TTS voice config
 * @returns Buffer with MP3 audio
 */
export async function generateGoogleTTS(text: string, voice: any = {}) {
  const client: any = new textToSpeech.TextToSpeechClient();
  const request = {
    input: { text },
    // Use a default English voice, can be customized
    voice: {
      languageCode: 'en-US',
      name: 'en-US-Wavenet-D',
      ...voice,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
      pitch: 0,
      sampleRateHertz: 44100,
    },
  };
  const res: any = await client.synthesizeSpeech(request);
  const response = res[0];
  if (!response.audioContent) throw new Error('No audio content from Google TTS');
  return Buffer.from(response.audioContent as Buffer);
}
