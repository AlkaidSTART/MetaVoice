// Global type extensions for VoiceCanvas

// Voice cursor animation function type
export type VoiceCursorAnimateFn = (
  selector: string,
  onClick?: () => void
) => void;

// Extend Window interface for voice cursor functionality
declare global {
  interface Window {
    __voiceCursorAnimate?: VoiceCursorAnimateFn;
  }
}
