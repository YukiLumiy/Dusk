export type FlagValue = string | number | boolean;
export type Flags = Record<string, FlagValue>;

export type Preset =
  | { id: string; label: string; hint: string; kind: "toggle"; flags: Flags }
  | { id: string; label: string; hint: string; kind: "choice"; options: { label: string; flags: Flags }[] };

/**
 * Flag names follow the ones used by Bloxstrap-style launchers. Roblox renames
 * and removes flags now and then, so a preset that stops working just needs its
 * entry here updated. An option with no flags is "Default" (everything removed).
 */
export const PRESETS: Preset[] = [
  {
    id: "fps", kind: "choice", label: "FPS limit",
    hint: "Raises the frame rate cap past the default 60.",
    options: [
      { label: "Default", flags: {} },
      ...[60, 144, 165, 240, 360].map((n) => ({ label: String(n), flags: { DFIntTaskSchedulerTargetFps: n } })),
      { label: "Unlimited", flags: { DFIntTaskSchedulerTargetFps: 9999 } },
    ],
  },
  {
    id: "api", kind: "choice", label: "Graphics API",
    hint: "Which graphics API Roblox is asked to use.",
    options: [
      { label: "Default", flags: {} },
      { label: "Direct3D 11", flags: { FFlagDebugGraphicsPreferD3D11: true } },
      { label: "Vulkan", flags: { FFlagDebugGraphicsPreferVulkan: true } },
      { label: "OpenGL", flags: { FFlagDebugGraphicsPreferOpenGL: true } },
    ],
  },
  {
    id: "lighting", kind: "choice", label: "Lighting",
    hint: "Forces a lighting technology in every game.",
    options: [
      { label: "Default", flags: {} },
      { label: "Voxel", flags: { DFFlagDebugRenderForceTechnologyVoxel: true } },
      { label: "ShadowMap", flags: { FFlagDebugForceFutureIsBrightPhase2: true } },
      { label: "Future", flags: { FFlagDebugForceFutureIsBrightPhase3: true } },
    ],
  },
  {
    id: "textures", kind: "choice", label: "Texture quality",
    hint: "Overrides the in-game texture quality setting.",
    options: [
      { label: "Default", flags: {} },
      ...["Lowest", "Low", "Medium", "High"].map((label, i) => ({
        label,
        flags: { DFFlagTextureQualityOverrideEnabled: true, DFIntTextureQualityOverride: i },
      })),
    ],
  },
  { id: "sky", kind: "toggle", label: "Gray sky", hint: "Replaces the sky with plain gray.", flags: { FFlagDebugSkyGray: true } },
  { id: "postfx", kind: "toggle", label: "Disable post-processing", hint: "Turns off bloom, blur and other screen effects.", flags: { FFlagDisablePostFx: true } },
  { id: "msaa", kind: "toggle", label: "Disable anti-aliasing", hint: "Turns MSAA off for a small speed-up.", flags: { FIntDebugForceMSAASamples: 0 } },
  { id: "shadows", kind: "toggle", label: "Hide player shadows", hint: "Sets the shadow intensity to zero.", flags: { FIntRenderShadowIntensity: 0 } },
];
