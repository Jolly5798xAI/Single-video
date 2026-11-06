import React from 'react';
import {Composition} from 'remotion';
import {Video} from './Video';
import TL from './timeline/timeline.json';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Main"
    component={Video}
    durationInFrames={Math.round(TL.duration * TL.fps)}
    fps={TL.fps}
    width={1080}
    height={1920}
    defaultProps={{withAudio: true}}
  />
);
