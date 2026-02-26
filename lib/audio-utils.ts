
/**
 * Wraps raw PCM data in a WAV container.
 * Assumes 16-bit signed integer PCM.
 * 
 * @param pcmData Raw PCM buffer
 * @param sampleRate Sample rate in Hz (default 24000)
 * @param numChannels Number of channels (default 1)
 * @returns Buffer containing the WAV file
 */
export function pcmToWav(pcmData: Buffer, sampleRate: number = 24000, numChannels: number = 1): Buffer {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * numChannels * 2; // 16-bit = 2 bytes
    const blockAlign = numChannels * 2;
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;
  
    // RIFF chunk descriptor
    header.write("RIFF", 0);
    header.writeUInt32LE(fileSize, 4);
    header.write("WAVE", 8);
  
    // fmt sub-chunk
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(16, 34); // BitsPerSample
  
    // data sub-chunk
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);
  
    return Buffer.concat([header, pcmData]);
}
