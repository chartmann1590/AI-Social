/**
 * Curated MediaPipe-compatible `.task` bundles from Hugging Face (LiteRT community).
 * URLs use `resolve/main` for direct downloads (Git LFS).
 *
 * License: follow each model card on Hugging Face (Apache-2.0 / MIT / Gemma terms).
 */
export type OnDeviceModelFamily =
  | 'gemma4'
  | 'gemma3'
  | 'qwen'
  | 'deepseek-r1'
  | 'sd15';

export interface OnDeviceModelEntry {
  id: string;
  family: OnDeviceModelFamily;
  /** Short label in UI */
  name: string;
  description: string;
  /** Hugging Face direct file URL */
  downloadUrl: string;
  /** Stable filename under app document dir */
  filename: string;
  approxSizeBytes: number;
  /** Model card for terms / docs */
  hfRepoUrl: string;
}

const HF = 'https://huggingface.co';

export const ON_DEVICE_MODEL_CATALOG: OnDeviceModelEntry[] = [
  {
    id: 'sd-v1-5-pruned',
    family: 'sd15',
    name: 'Stable Diffusion v1.5 (fp16 safetensors)',
    description:
      'Base Stable Diffusion v1.5 checkpoint for local image generation pipelines. Large download, intended for advanced devices.',
    downloadUrl: `${HF}/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors`,
    filename: 'v1-5-pruned-emaonly.safetensors',
    approxSizeBytes: 4_260_000_000,
    hfRepoUrl: `${HF}/runwayml/stable-diffusion-v1-5`,
  },
  {
    id: 'gemma4-e2b-litertlm',
    family: 'gemma4',
    name: 'Gemma 4 E2B IT (.litertlm, ~2.6 GB)',
    description:
      'Gemma 4 E2B instruction-tuned, LiteRT-LM native bundle. Latest Gemma generation — strong quality. Requires a phone with ~3–4 GB free RAM.',
    downloadUrl: `${HF}/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm`,
    filename: 'gemma-4-E2B-it.litertlm',
    approxSizeBytes: 2_580_000_000,
    hfRepoUrl: `${HF}/litert-community/gemma-4-E2B-it-litert-lm`,
  },
  {
    id: 'gemma4-e4b-litertlm',
    family: 'gemma4',
    name: 'Gemma 4 E4B IT (.litertlm, ~3.7 GB)',
    description:
      'Gemma 4 E4B instruction-tuned, LiteRT-LM native bundle. Largest Gemma 4 on-device bundle — best quality, requires a phone with ~5–6 GB free RAM.',
    downloadUrl: `${HF}/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm`,
    filename: 'gemma-4-E4B-it.litertlm',
    approxSizeBytes: 3_650_000_000,
    hfRepoUrl: `${HF}/litert-community/gemma-4-E4B-it-litert-lm`,
  },
  {
    id: 'gemma3-1b-q4',
    family: 'gemma3',
    name: 'Gemma 3 1B IT (q4, 1280 ctx)',
    description:
      'Gemma 3 1B instruction-tuned, q4 quantized. Smallest Gemma bundle — loads on entry-level phones where Gemma 4 E2B is too large.',
    downloadUrl: `${HF}/litert-community/Gemma3-1B-IT/resolve/main/Gemma3-1B-IT_multi-prefill-seq_q4_block32_ekv1280.task`,
    filename: 'Gemma3-1B-IT_multi-prefill-seq_q4_block32_ekv1280.task',
    approxSizeBytes: 660_000_000,
    hfRepoUrl: `${HF}/litert-community/Gemma3-1B-IT`,
  },
  {
    id: 'gemma3-1b-q8',
    family: 'gemma3',
    name: 'Gemma 3 1B IT (q8, 1280 ctx)',
    description:
      'Gemma 3 1B instruction-tuned, q8 quantized. Higher quality than q4, ~1.1 GB.',
    downloadUrl: `${HF}/litert-community/Gemma3-1B-IT/resolve/main/Gemma3-1B-IT_multi-prefill-seq_q8_ekv1280.task`,
    filename: 'Gemma3-1B-IT_multi-prefill-seq_q8_ekv1280.task',
    approxSizeBytes: 1_060_000_000,
    hfRepoUrl: `${HF}/litert-community/Gemma3-1B-IT`,
  },
  {
    id: 'gemma3-4b-q4-web',
    family: 'gemma3',
    name: 'Gemma 3 4B IT (q4, web .task)',
    description:
      'Gemma 3 4B instruction-tuned, q4 quantized. Much better quality — requires a phone with ~4 GB free RAM.',
    downloadUrl: `${HF}/litert-community/Gemma3-4B-IT/resolve/main/gemma3-4b-it-int4-web.task`,
    filename: 'gemma3-4b-it-int4-web.task',
    approxSizeBytes: 2_600_000_000,
    hfRepoUrl: `${HF}/litert-community/Gemma3-4B-IT`,
  },
  {
    id: 'qwen-0.5b-q8',
    family: 'qwen',
    name: 'Qwen 2.5 0.5B Instruct (q8, 1280 ctx)',
    description: 'Compact Qwen 2.5 instruct model; good default for testing downloads and on-device JSON.',
    downloadUrl: `${HF}/litert-community/Qwen2.5-0.5B-Instruct/resolve/main/Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task`,
    filename: 'Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task',
    approxSizeBytes: 546_660_344,
    hfRepoUrl: `${HF}/litert-community/Qwen2.5-0.5B-Instruct`,
  },
  {
    id: 'qwen-1.5b-q8-seq128',
    family: 'qwen',
    name: 'Qwen 2.5 1.5B Instruct (q8, seq128)',
    description: 'Larger Qwen 2.5 1.5B instruct bundle; stronger quality, ~1.5 GB.',
    downloadUrl: `${HF}/litert-community/Qwen2.5-1.5B-Instruct/resolve/main/Qwen2.5-1.5B-Instruct_seq128_q8_ekv1280.task`,
    filename: 'Qwen2.5-1.5B-Instruct_seq128_q8_ekv1280.task',
    approxSizeBytes: 1_567_364_648,
    hfRepoUrl: `${HF}/litert-community/Qwen2.5-1.5B-Instruct`,
  },
  {
    id: 'r1-distill-1.5b-q8',
    family: 'deepseek-r1',
    name: 'DeepSeek R1 Distill Qwen 1.5B (q8)',
    description:
      'Small DeepSeek-R1–distilled reasoning model in MediaPipe task form (~1.8 GB).',
    downloadUrl: `${HF}/litert-community/DeepSeek-R1-Distill-Qwen-1.5B/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B_multi-prefill-seq_q8_ekv1280.task`,
    filename: 'DeepSeek-R1-Distill-Qwen-1.5B_multi-prefill-seq_q8_ekv1280.task',
    approxSizeBytes: 1_861_094_737,
    hfRepoUrl: `${HF}/litert-community/DeepSeek-R1-Distill-Qwen-1.5B`,
  },
  {
    id: 'r1-distill-1.5b-q8-alt',
    family: 'deepseek-r1',
    name: 'DeepSeek R1 Distill Qwen 1.5B (q8 alt bundle)',
    description:
      'Alternate q8 bundle from the same repo (slightly different packaging); use if the primary file fails to load.',
    downloadUrl: `${HF}/litert-community/DeepSeek-R1-Distill-Qwen-1.5B/resolve/main/deepseek_q8_ekv1280.task`,
    filename: 'deepseek_q8_ekv1280.task',
    approxSizeBytes: 1_860_686_856,
    hfRepoUrl: `${HF}/litert-community/DeepSeek-R1-Distill-Qwen-1.5B`,
  },
];

export function formatApproxSize(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(0)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function modelsByFamily(family: OnDeviceModelFamily): OnDeviceModelEntry[] {
  return ON_DEVICE_MODEL_CATALOG.filter((m) => m.family === family);
}
