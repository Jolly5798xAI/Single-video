import React, {useEffect, useState} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, Audio, continueRender, delayRender, getRemotionEnvironment, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import '@fontsource/montserrat/cyrillic-600.css';
import '@fontsource/montserrat/cyrillic-700.css';
import '@fontsource/montserrat/cyrillic-800.css';
import '@fontsource/montserrat/cyrillic-900.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/montserrat/latin-900.css';
import '@fontsource/russo-one/cyrillic-400.css';
import '@fontsource/russo-one/latin-400.css';
import {DebugCam, setDebugCam, Stage} from './scenes/Stage';
import {cameraAt} from './scenes/shots';
import {canvasFilter, FinalTitle, Grade, HookTitle, Subtitles, Timer} from './subtitles/Overlays';
import {FONT_SIGN, FONT_UI} from './components/textures';

/** Blocks rendering until the Cyrillic fonts are ready (canvas textures need them). */
const useFonts = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    const specs = ['600', '700', '800', '900'].map((w) => `${w} 40px "${FONT_UI}"`).concat([`40px "${FONT_SIGN}"`]);
    Promise.all(specs.map((s) => document.fonts.load(s, 'ЖЁабв0123'))).then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready;
};

export const Video: React.FC<{withAudio?: boolean; debugCam?: DebugCam}> = ({withAudio = true, debugCam = null}) => {
  setDebugCam(debugCam);
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const ready = useFonts();
  const {shot} = cameraAt(t);
  const env = getRemotionEnvironment();
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {withAudio && !env.isRendering ? <Audio src={staticFile('audio/mix.wav')} /> : null}
      {ready ? (
        <>
          <AbsoluteFill style={{filter: canvasFilter(t, shot)}}>
            <ThreeCanvas
              width={width}
              height={height}
              shadows={{type: THREE.PCFSoftShadowMap}}
              gl={{antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0, preserveDrawingBuffer: true}}
              camera={{fov: 45, near: 0.02, far: 900, position: [0, 2, 5]}}
            >
              <Stage t={t} />
            </ThreeCanvas>
          </AbsoluteFill>
          <Grade t={t} shot={shot} />
          <HookTitle t={t} />
          <Timer t={t} compact={shot.phone} />
          <FinalTitle t={t} />
          <Subtitles t={t} low={shot.phone || (shot.id === '03_phone_ots' && t > 8.2)} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
