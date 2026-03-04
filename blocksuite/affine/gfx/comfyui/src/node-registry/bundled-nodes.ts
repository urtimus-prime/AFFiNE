import type { ComfyNodeDefinition } from './registry.js';

/**
 * Bundled core ComfyUI node definitions.
 * These are available offline — no running ComfyUI instance required.
 * Based on ComfyUI's standard node set.
 */
export const BUNDLED_NODE_DEFINITIONS: ComfyNodeDefinition[] = [
  // === Loaders ===
  {
    classType: 'CheckpointLoaderSimple',
    category: 'loaders',
    displayName: 'Load Checkpoint',
    inputs: {
      required: {
        ckpt_name: ['COMBO', { options: [] }],
      },
    },
    outputs: [
      { name: 'MODEL', type: 'MODEL' },
      { name: 'CLIP', type: 'CLIP' },
      { name: 'VAE', type: 'VAE' },
    ],
  },
  {
    classType: 'LoRALoader',
    category: 'loaders',
    displayName: 'Load LoRA',
    inputs: {
      required: {
        model: ['MODEL'],
        clip: ['CLIP'],
        lora_name: ['COMBO', { options: [] }],
        strength_model: ['FLOAT', { default: 1.0, min: -20.0, max: 20.0, step: 0.01 }],
        strength_clip: ['FLOAT', { default: 1.0, min: -20.0, max: 20.0, step: 0.01 }],
      },
    },
    outputs: [
      { name: 'MODEL', type: 'MODEL' },
      { name: 'CLIP', type: 'CLIP' },
    ],
  },
  {
    classType: 'VAELoader',
    category: 'loaders',
    displayName: 'Load VAE',
    inputs: {
      required: {
        vae_name: ['COMBO', { options: [] }],
      },
    },
    outputs: [{ name: 'VAE', type: 'VAE' }],
  },
  {
    classType: 'ControlNetLoader',
    category: 'loaders',
    displayName: 'Load ControlNet',
    inputs: {
      required: {
        control_net_name: ['COMBO', { options: [] }],
      },
    },
    outputs: [{ name: 'CONTROL_NET', type: 'CONTROL_NET' }],
  },
  {
    classType: 'CLIPLoader',
    category: 'loaders',
    displayName: 'Load CLIP',
    inputs: {
      required: {
        clip_name: ['COMBO', { options: [] }],
        type: ['COMBO', { options: ['stable_diffusion', 'stable_cascade', 'sd3', 'stable_audio'] }],
      },
    },
    outputs: [{ name: 'CLIP', type: 'CLIP' }],
  },
  {
    classType: 'UNETLoader',
    category: 'loaders',
    displayName: 'Load Diffusion Model',
    inputs: {
      required: {
        unet_name: ['COMBO', { options: [] }],
        weight_dtype: ['COMBO', { options: ['default', 'fp8_e4m3fn', 'fp8_e5m2'] }],
      },
    },
    outputs: [{ name: 'MODEL', type: 'MODEL' }],
  },
  {
    classType: 'DualCLIPLoader',
    category: 'loaders',
    displayName: 'Load Dual CLIP',
    inputs: {
      required: {
        clip_name1: ['COMBO', { options: [] }],
        clip_name2: ['COMBO', { options: [] }],
        type: ['COMBO', { options: ['sdxl', 'sd3', 'flux'] }],
      },
    },
    outputs: [{ name: 'CLIP', type: 'CLIP' }],
  },
  {
    classType: 'UpscaleModelLoader',
    category: 'loaders',
    displayName: 'Load Upscale Model',
    inputs: {
      required: {
        model_name: ['COMBO', { options: [] }],
      },
    },
    outputs: [{ name: 'UPSCALE_MODEL', type: 'UPSCALE_MODEL' }],
  },
  {
    classType: 'StyleModelLoader',
    category: 'loaders',
    displayName: 'Load Style Model',
    inputs: {
      required: {
        style_model_name: ['COMBO', { options: [] }],
      },
    },
    outputs: [{ name: 'STYLE_MODEL', type: 'STYLE_MODEL' }],
  },
  {
    classType: 'GLIGENLoader',
    category: 'loaders',
    displayName: 'Load GLIGEN',
    inputs: {
      required: {
        gligen_name: ['COMBO', { options: [] }],
      },
    },
    outputs: [{ name: 'GLIGEN', type: 'GLIGEN' }],
  },

  // === Conditioning ===
  {
    classType: 'CLIPTextEncode',
    category: 'conditioning',
    displayName: 'CLIP Text Encode (Prompt)',
    inputs: {
      required: {
        text: ['STRING', { multiline: true }],
        clip: ['CLIP'],
      },
    },
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
  },
  {
    classType: 'ConditioningCombine',
    category: 'conditioning',
    displayName: 'Conditioning Combine',
    inputs: {
      required: {
        conditioning_1: ['CONDITIONING'],
        conditioning_2: ['CONDITIONING'],
      },
    },
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
  },
  {
    classType: 'ConditioningSetArea',
    category: 'conditioning',
    displayName: 'Conditioning Set Area',
    inputs: {
      required: {
        conditioning: ['CONDITIONING'],
        width: ['INT', { default: 64, min: 64, max: 4096, step: 8 }],
        height: ['INT', { default: 64, min: 64, max: 4096, step: 8 }],
        x: ['INT', { default: 0, min: 0, max: 4096, step: 8 }],
        y: ['INT', { default: 0, min: 0, max: 4096, step: 8 }],
        strength: ['FLOAT', { default: 1.0, min: 0.0, max: 10.0, step: 0.01 }],
      },
    },
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
  },
  {
    classType: 'ConditioningAverage',
    category: 'conditioning',
    displayName: 'Conditioning Average',
    inputs: {
      required: {
        conditioning_to: ['CONDITIONING'],
        conditioning_from: ['CONDITIONING'],
        conditioning_to_strength: ['FLOAT', { default: 1.0, min: 0.0, max: 1.0, step: 0.01 }],
      },
    },
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
  },
  {
    classType: 'ControlNetApply',
    category: 'conditioning',
    displayName: 'Apply ControlNet',
    inputs: {
      required: {
        conditioning: ['CONDITIONING'],
        control_net: ['CONTROL_NET'],
        image: ['IMAGE'],
        strength: ['FLOAT', { default: 1.0, min: 0.0, max: 10.0, step: 0.01 }],
      },
    },
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
  },
  {
    classType: 'ControlNetApplyAdvanced',
    category: 'conditioning',
    displayName: 'Apply ControlNet (Advanced)',
    inputs: {
      required: {
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        control_net: ['CONTROL_NET'],
        image: ['IMAGE'],
        strength: ['FLOAT', { default: 1.0, min: 0.0, max: 10.0, step: 0.01 }],
        start_percent: ['FLOAT', { default: 0.0, min: 0.0, max: 1.0, step: 0.001 }],
        end_percent: ['FLOAT', { default: 1.0, min: 0.0, max: 1.0, step: 0.001 }],
      },
    },
    outputs: [
      { name: 'positive', type: 'CONDITIONING' },
      { name: 'negative', type: 'CONDITIONING' },
    ],
  },
  {
    classType: 'CLIPSetLastLayer',
    category: 'conditioning',
    displayName: 'CLIP Set Last Layer',
    inputs: {
      required: {
        clip: ['CLIP'],
        stop_at_clip_layer: ['INT', { default: -1, min: -24, max: -1, step: 1 }],
      },
    },
    outputs: [{ name: 'CLIP', type: 'CLIP' }],
  },

  // === Sampling ===
  {
    classType: 'KSampler',
    category: 'sampling',
    displayName: 'KSampler',
    inputs: {
      required: {
        model: ['MODEL'],
        seed: ['INT', { default: 0, min: 0, max: 0xffffffffffffffff }],
        steps: ['INT', { default: 20, min: 1, max: 10000 }],
        cfg: ['FLOAT', { default: 8.0, min: 0.0, max: 100.0, step: 0.1 }],
        sampler_name: ['COMBO', { options: ['euler', 'euler_ancestral', 'heun', 'heunpp2', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpm_fast', 'dpm_adaptive', 'dpmpp_2s_ancestral', 'dpmpp_sde', 'dpmpp_sde_gpu', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_2m_sde_gpu', 'dpmpp_3m_sde', 'dpmpp_3m_sde_gpu', 'ddpm', 'lcm', 'ddim', 'uni_pc', 'uni_pc_bh2'] }],
        scheduler: ['COMBO', { options: ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform', 'beta'] }],
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        latent_image: ['LATENT'],
        denoise: ['FLOAT', { default: 1.0, min: 0.0, max: 1.0, step: 0.01 }],
      },
    },
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
  },
  {
    classType: 'KSamplerAdvanced',
    category: 'sampling',
    displayName: 'KSampler (Advanced)',
    inputs: {
      required: {
        model: ['MODEL'],
        add_noise: ['COMBO', { options: ['enable', 'disable'] }],
        noise_seed: ['INT', { default: 0, min: 0, max: 0xffffffffffffffff }],
        steps: ['INT', { default: 20, min: 1, max: 10000 }],
        cfg: ['FLOAT', { default: 8.0, min: 0.0, max: 100.0 }],
        sampler_name: ['COMBO', { options: ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpmpp_2s_ancestral', 'dpmpp_sde', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_3m_sde', 'ddpm', 'lcm', 'ddim', 'uni_pc', 'uni_pc_bh2'] }],
        scheduler: ['COMBO', { options: ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform', 'beta'] }],
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        latent_image: ['LATENT'],
        start_at_step: ['INT', { default: 0, min: 0, max: 10000 }],
        end_at_step: ['INT', { default: 10000, min: 0, max: 10000 }],
        return_with_leftover_noise: ['COMBO', { options: ['disable', 'enable'] }],
      },
    },
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
  },
  {
    classType: 'SamplerCustom',
    category: 'sampling/custom_sampling',
    displayName: 'SamplerCustom',
    inputs: {
      required: {
        model: ['MODEL'],
        add_noise: ['BOOLEAN', { default: true }],
        noise_seed: ['INT', { default: 0, min: 0, max: 0xffffffffffffffff }],
        cfg: ['FLOAT', { default: 8.0, min: 0.0, max: 100.0 }],
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        sampler: ['SAMPLER'],
        sigmas: ['SIGMAS'],
        latent_image: ['LATENT'],
      },
    },
    outputs: [
      { name: 'output', type: 'LATENT' },
      { name: 'denoised_output', type: 'LATENT' },
    ],
  },
  {
    classType: 'KSamplerSelect',
    category: 'sampling/custom_sampling/samplers',
    displayName: 'KSamplerSelect',
    inputs: {
      required: {
        sampler_name: ['COMBO', { options: ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpmpp_2s_ancestral', 'dpmpp_sde', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_3m_sde', 'ddpm', 'lcm', 'ddim', 'uni_pc', 'uni_pc_bh2'] }],
      },
    },
    outputs: [{ name: 'SAMPLER', type: 'SAMPLER' }],
  },
  {
    classType: 'BasicScheduler',
    category: 'sampling/custom_sampling/schedulers',
    displayName: 'BasicScheduler',
    inputs: {
      required: {
        model: ['MODEL'],
        scheduler: ['COMBO', { options: ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform', 'beta'] }],
        steps: ['INT', { default: 20, min: 1, max: 10000 }],
        denoise: ['FLOAT', { default: 1.0, min: 0.0, max: 1.0, step: 0.01 }],
      },
    },
    outputs: [{ name: 'SIGMAS', type: 'SIGMAS' }],
  },
  {
    classType: 'BasicGuider',
    category: 'sampling/custom_sampling/guiders',
    displayName: 'BasicGuider',
    inputs: {
      required: {
        model: ['MODEL'],
        conditioning: ['CONDITIONING'],
      },
    },
    outputs: [{ name: 'GUIDER', type: 'GUIDER' }],
  },
  {
    classType: 'RandomNoise',
    category: 'sampling/custom_sampling/noise',
    displayName: 'RandomNoise',
    inputs: {
      required: {
        noise_seed: ['INT', { default: 0, min: 0, max: 0xffffffffffffffff }],
      },
    },
    outputs: [{ name: 'NOISE', type: 'NOISE' }],
  },
  {
    classType: 'SamplerCustomAdvanced',
    category: 'sampling/custom_sampling',
    displayName: 'SamplerCustomAdvanced',
    inputs: {
      required: {
        noise: ['NOISE'],
        guider: ['GUIDER'],
        sampler: ['SAMPLER'],
        sigmas: ['SIGMAS'],
        latent_image: ['LATENT'],
      },
    },
    outputs: [
      { name: 'output', type: 'LATENT' },
      { name: 'denoised_output', type: 'LATENT' },
    ],
  },

  // === Latent ===
  {
    classType: 'EmptyLatentImage',
    category: 'latent',
    displayName: 'Empty Latent Image',
    inputs: {
      required: {
        width: ['INT', { default: 512, min: 16, max: 16384, step: 8 }],
        height: ['INT', { default: 512, min: 16, max: 16384, step: 8 }],
        batch_size: ['INT', { default: 1, min: 1, max: 4096 }],
      },
    },
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
  },
  {
    classType: 'LatentUpscale',
    category: 'latent',
    displayName: 'Upscale Latent',
    inputs: {
      required: {
        samples: ['LATENT'],
        upscale_method: ['COMBO', { options: ['nearest-exact', 'bilinear', 'area', 'bicubic', 'bislerp'] }],
        width: ['INT', { default: 512, min: 0, max: 16384, step: 8 }],
        height: ['INT', { default: 512, min: 0, max: 16384, step: 8 }],
        crop: ['COMBO', { options: ['disabled', 'center'] }],
      },
    },
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
  },
  {
    classType: 'LatentUpscaleBy',
    category: 'latent',
    displayName: 'Upscale Latent By',
    inputs: {
      required: {
        samples: ['LATENT'],
        upscale_method: ['COMBO', { options: ['nearest-exact', 'bilinear', 'area', 'bicubic', 'bislerp'] }],
        scale_by: ['FLOAT', { default: 1.5, min: 0.01, max: 8.0, step: 0.01 }],
      },
    },
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
  },
  {
    classType: 'LatentComposite',
    category: 'latent',
    displayName: 'Latent Composite',
    inputs: {
      required: {
        samples_to: ['LATENT'],
        samples_from: ['LATENT'],
        x: ['INT', { default: 0, min: 0, max: 16384, step: 8 }],
        y: ['INT', { default: 0, min: 0, max: 16384, step: 8 }],
        feather: ['INT', { default: 0, min: 0, max: 16384, step: 8 }],
      },
    },
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
  },
  {
    classType: 'SetLatentNoiseMask',
    category: 'latent/inpaint',
    displayName: 'Set Latent Noise Mask',
    inputs: {
      required: {
        samples: ['LATENT'],
        mask: ['MASK'],
      },
    },
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
  },

  // === Image ===
  {
    classType: 'VAEDecode',
    category: 'latent',
    displayName: 'VAE Decode',
    inputs: {
      required: {
        samples: ['LATENT'],
        vae: ['VAE'],
      },
    },
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
  },
  {
    classType: 'VAEEncode',
    category: 'latent',
    displayName: 'VAE Encode',
    inputs: {
      required: {
        pixels: ['IMAGE'],
        vae: ['VAE'],
      },
    },
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
  },
  {
    classType: 'VAEEncodeForInpaint',
    category: 'latent/inpaint',
    displayName: 'VAE Encode (for Inpainting)',
    inputs: {
      required: {
        pixels: ['IMAGE'],
        vae: ['VAE'],
        mask: ['MASK'],
        grow_mask_by: ['INT', { default: 6, min: 0, max: 64, step: 1 }],
      },
    },
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
  },
  {
    classType: 'SaveImage',
    category: 'image',
    displayName: 'Save Image',
    inputs: {
      required: {
        images: ['IMAGE'],
        filename_prefix: ['STRING', { default: 'ComfyUI' }],
      },
    },
    outputs: [],
  },
  {
    classType: 'PreviewImage',
    category: 'image',
    displayName: 'Preview Image',
    inputs: {
      required: {
        images: ['IMAGE'],
      },
    },
    outputs: [],
  },
  {
    classType: 'LoadImage',
    category: 'image',
    displayName: 'Load Image',
    inputs: {
      required: {
        image: ['COMBO', { options: [] }],
        upload: ['COMBO', { options: ['image'] }],
      },
    },
    outputs: [
      { name: 'IMAGE', type: 'IMAGE' },
      { name: 'MASK', type: 'MASK' },
    ],
  },
  {
    classType: 'ImageScale',
    category: 'image/upscaling',
    displayName: 'Upscale Image',
    inputs: {
      required: {
        image: ['IMAGE'],
        upscale_method: ['COMBO', { options: ['nearest-exact', 'bilinear', 'area', 'bicubic', 'lanczos'] }],
        width: ['INT', { default: 512, min: 0, max: 16384, step: 1 }],
        height: ['INT', { default: 512, min: 0, max: 16384, step: 1 }],
        crop: ['COMBO', { options: ['disabled', 'center'] }],
      },
    },
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
  },
  {
    classType: 'ImageScaleBy',
    category: 'image/upscaling',
    displayName: 'Upscale Image By',
    inputs: {
      required: {
        image: ['IMAGE'],
        upscale_method: ['COMBO', { options: ['nearest-exact', 'bilinear', 'area', 'bicubic', 'lanczos'] }],
        scale_by: ['FLOAT', { default: 1.5, min: 0.01, max: 8.0, step: 0.01 }],
      },
    },
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
  },
  {
    classType: 'ImageUpscaleWithModel',
    category: 'image/upscaling',
    displayName: 'Upscale Image (using Model)',
    inputs: {
      required: {
        upscale_model: ['UPSCALE_MODEL'],
        image: ['IMAGE'],
      },
    },
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
  },
  {
    classType: 'ImageInvert',
    category: 'image',
    displayName: 'Invert Image',
    inputs: {
      required: {
        image: ['IMAGE'],
      },
    },
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
  },
  {
    classType: 'ImageBatch',
    category: 'image',
    displayName: 'Batch Images',
    inputs: {
      required: {
        image1: ['IMAGE'],
        image2: ['IMAGE'],
      },
    },
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
  },
  {
    classType: 'ImagePadForOutpaint',
    category: 'image',
    displayName: 'Pad Image for Outpainting',
    inputs: {
      required: {
        image: ['IMAGE'],
        left: ['INT', { default: 0, min: 0, max: 16384, step: 8 }],
        top: ['INT', { default: 0, min: 0, max: 16384, step: 8 }],
        right: ['INT', { default: 0, min: 0, max: 16384, step: 8 }],
        bottom: ['INT', { default: 0, min: 0, max: 16384, step: 8 }],
        feathering: ['INT', { default: 40, min: 0, max: 16384, step: 1 }],
      },
    },
    outputs: [
      { name: 'IMAGE', type: 'IMAGE' },
      { name: 'MASK', type: 'MASK' },
    ],
  },

  // === Mask ===
  {
    classType: 'MaskToImage',
    category: 'mask',
    displayName: 'Convert Mask to Image',
    inputs: {
      required: {
        mask: ['MASK'],
      },
    },
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }],
  },
  {
    classType: 'ImageToMask',
    category: 'mask',
    displayName: 'Convert Image to Mask',
    inputs: {
      required: {
        image: ['IMAGE'],
        channel: ['COMBO', { options: ['red', 'green', 'blue', 'alpha'] }],
      },
    },
    outputs: [{ name: 'MASK', type: 'MASK' }],
  },
  {
    classType: 'InvertMask',
    category: 'mask',
    displayName: 'Invert Mask',
    inputs: {
      required: {
        mask: ['MASK'],
      },
    },
    outputs: [{ name: 'MASK', type: 'MASK' }],
  },
  {
    classType: 'CropMask',
    category: 'mask',
    displayName: 'Crop Mask',
    inputs: {
      required: {
        mask: ['MASK'],
        x: ['INT', { default: 0, min: 0, max: 16384, step: 1 }],
        y: ['INT', { default: 0, min: 0, max: 16384, step: 1 }],
        width: ['INT', { default: 512, min: 1, max: 16384, step: 1 }],
        height: ['INT', { default: 512, min: 1, max: 16384, step: 1 }],
      },
    },
    outputs: [{ name: 'MASK', type: 'MASK' }],
  },

  // === Model ===
  {
    classType: 'ModelMergeSimple',
    category: 'advanced/model_merging',
    displayName: 'ModelMergeSimple',
    inputs: {
      required: {
        model1: ['MODEL'],
        model2: ['MODEL'],
        ratio: ['FLOAT', { default: 1.0, min: 0.0, max: 1.0, step: 0.01 }],
      },
    },
    outputs: [{ name: 'MODEL', type: 'MODEL' }],
  },
  {
    classType: 'CLIPVisionLoader',
    category: 'loaders',
    displayName: 'Load CLIP Vision',
    inputs: {
      required: {
        clip_name: ['COMBO', { options: [] }],
      },
    },
    outputs: [{ name: 'CLIP_VISION', type: 'CLIP_VISION' }],
  },
  {
    classType: 'CLIPVisionEncode',
    category: 'conditioning',
    displayName: 'CLIP Vision Encode',
    inputs: {
      required: {
        clip_vision: ['CLIP_VISION'],
        image: ['IMAGE'],
      },
    },
    outputs: [{ name: 'CLIP_VISION_OUTPUT', type: 'CLIP_VISION_OUTPUT' }],
  },

  // === Utility ===
  {
    classType: 'CLIPTextEncodeSDXL',
    category: 'advanced/conditioning',
    displayName: 'CLIPTextEncodeSDXL',
    inputs: {
      required: {
        width: ['INT', { default: 1024, min: 0, max: 16384 }],
        height: ['INT', { default: 1024, min: 0, max: 16384 }],
        crop_w: ['INT', { default: 0, min: 0, max: 16384 }],
        crop_h: ['INT', { default: 0, min: 0, max: 16384 }],
        target_width: ['INT', { default: 1024, min: 0, max: 16384 }],
        target_height: ['INT', { default: 1024, min: 0, max: 16384 }],
        text_g: ['STRING', { multiline: true }],
        clip: ['CLIP'],
        text_l: ['STRING', { multiline: true }],
      },
    },
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
  },
  {
    classType: 'FluxGuidance',
    category: 'advanced/conditioning/flux',
    displayName: 'FluxGuidance',
    inputs: {
      required: {
        conditioning: ['CONDITIONING'],
        guidance: ['FLOAT', { default: 3.5, min: 0.0, max: 100.0, step: 0.1 }],
      },
    },
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
  },
];
