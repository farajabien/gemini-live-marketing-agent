import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, Video } from 'remotion';
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont();

interface MagazineSceneProps {
    text: string;
    imageUrl: string | null;
    videoUrl?: string | null;
}

export const MagazineScene: React.FC<MagazineSceneProps> = ({ text, imageUrl, videoUrl }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Background Animation (Subtle Zoom)
    const scale = interpolate(frame, [0, 150], [1, 1.1], {
        extrapolateRight: "clamp"
    });

    // Content Parsing (Assuming text can be split into title and body)
    const lines = text.split('\n').filter(l => l.trim() !== '');
    const title = lines[0] || "";
    const body = lines.slice(1).join(' ') || "";

    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {/* Background Layer */}
            <AbsoluteFill style={{ transform: `scale(${scale})` }}>
                {videoUrl ? (
                    <Video
                        src={videoUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loop
                        muted
                    />
                ) : imageUrl ? (
                    <Img
                        src={imageUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #1a1a2e, #16213e)' }} />
                )}
                {/* Vignette/Gradients for Magazine Feel */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.7))',
                }} />
            </AbsoluteFill>

            {/* Layout Container */}
            <AbsoluteFill style={{
                padding: '100px 60px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                fontFamily
            }}>
                {/* Magazine Heading */}
                {title && (
                    <div style={{
                        overflow: 'hidden',
                        marginBottom: 20
                    }}>
                        <h2 style={{
                            color: '#fff',
                            fontSize: 90,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            lineHeight: 1,
                            margin: 0,
                            letterSpacing: '-2px',
                            opacity: spring({ frame: frame - 10, fps, config: { damping: 20 } }),
                            transform: `translateY(${interpolate(spring({ frame: frame - 10, fps }), [0, 1], [100, 0])}px)`,
                            textShadow: '0 10px 30px rgba(0,0,0,0.5)'
                        }}>
                            {title}
                        </h2>
                    </div>
                )}

                {/* Magazine Body / Text Box */}
                {body && (
                    <div style={{
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        padding: '30px 40px',
                        maxWidth: '85%',
                        boxShadow: '20px 20px 0px rgba(0,0,0,0.3)',
                        opacity: spring({ frame: frame - 25, fps, config: { damping: 20 } }),
                        transform: `translateX(${interpolate(spring({ frame: frame - 25, fps }), [0, 1], [-100, 0])}px)`
                    }}>
                        <p style={{
                            color: '#000',
                            fontSize: 32,
                            fontWeight: 500,
                            margin: 0,
                            lineHeight: 1.4,
                        }}>
                            {body}
                        </p>
                    </div>
                )}

                {/* Magazine Accent (Side bar or corner label) */}
                <div style={{
                    position: 'absolute',
                    top: 60,
                    right: 60,
                    writingMode: 'vertical-rl',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 18,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '4px'
                }}>
                    Issue No. 01 / Story Series
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
