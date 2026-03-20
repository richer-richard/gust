/**
 * PostEffects - Post-processing pipeline for cinematic look.
 * Bloom for lit windows and LEDs, tone mapping, vignette.
 */
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { SceneTheme } from '../../lib/theme';

interface PostEffectsProps {
  theme: SceneTheme;
}

export function PostEffects({ theme }: PostEffectsProps) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={theme.post.bloomIntensity}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.22} darkness={theme.post.vignetteDarkness} />
    </EffectComposer>
  );
}
