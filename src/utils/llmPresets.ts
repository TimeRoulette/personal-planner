export interface LlmModelOption {
  /** API model id */
  id: string
  /** UI label */
  label: string
}

export interface LlmVendor {
  id: string
  name: string
  baseUrl: string
  models: LlmModelOption[]
  /** 默认选中的 model id */
  defaultModel?: string
  hint?: string
}

/** 兼容旧字段名 */
export type LlmPreset = LlmVendor & { model: string }

/** 常见 OpenAI 兼容提供商（2026 年当前公开模型 ID） */
export const LLM_VENDORS: LlmVendor[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-6-astra',
    models: [
      { id: 'gpt-6-astra', label: 'GPT-6 Astra（旗舰）' },
      { id: 'gpt-5.6', label: 'GPT-5.6' },
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol（Pro）' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
      { id: 'gpt-5.5', label: 'GPT-5.5' },
      { id: 'o3', label: 'o3' },
      { id: 'o4-mini', label: 'o4-mini' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-flash',
    hint: '也可写 https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-flash', label: 'DeepSeek V4.1 Flash' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro（过渡路由）' },
      { id: 'deepseek-v4-flash', label: 'deepseek-v4-flash（别名）' },
    ],
  },
  {
    id: 'qwen',
    name: '通义千问 / DashScope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: [
      { id: 'qwen3.8-max', label: 'Qwen3.8 Max' },
      { id: 'qwen3.7-plus', label: 'Qwen3.7 Plus' },
      { id: 'qwen3.8-flash', label: 'Qwen3.8 Flash' },
      { id: 'qwen3-max', label: 'Qwen3 Max' },
      { id: 'qwen-plus', label: 'Qwen Plus' },
      { id: 'qwen-max', label: 'Qwen Max' },
      { id: 'qwen-flash', label: 'Qwen Flash' },
      { id: 'qwen-turbo', label: 'Qwen Turbo' },
    ],
  },
  {
    id: 'moonshot',
    name: 'Moonshot / Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k3',
    hint: '国际站也可试 https://api.moonshot.ai/v1',
    models: [
      { id: 'kimi-k3', label: 'Kimi K3' },
      { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code' },
      { id: 'kimi-k2.7-code-highspeed', label: 'Kimi K2.7 Code 高速' },
      { id: 'kimi-k2.6', label: 'Kimi K2.6' },
    ],
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4.5',
    models: [
      { id: 'glm-4.5', label: 'GLM-4.5' },
      { id: 'glm-4.5-air', label: 'GLM-4.5 Air' },
      { id: 'glm-4.6', label: 'GLM-4.6' },
      { id: 'glm-4.7', label: 'GLM-4.7' },
      { id: 'glm-5', label: 'GLM-5' },
      { id: 'glm-5.1', label: 'GLM-5.1' },
      { id: 'glm-5.2', label: 'GLM-5.2' },
      { id: 'glm-4-flash', label: 'GLM-4 Flash' },
    ],
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow 硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3.1',
    models: [
      { id: 'deepseek-ai/DeepSeek-V3.1', label: 'DeepSeek V3.1' },
      { id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1' },
      { id: 'moonshotai/Kimi-K2-Instruct', label: 'Kimi K2 Instruct' },
      { id: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3-235B-A22B' },
      { id: 'THUDM/GLM-4.5', label: 'GLM-4.5' },
      { id: 'THUDM/GLM-4.5-Air', label: 'GLM-4.5 Air' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-6-astra',
    models: [
      { id: 'openai/gpt-6-astra', label: 'OpenAI GPT-6 Astra' },
      { id: 'openai/gpt-6-astra-pro', label: 'OpenAI GPT-6 Astra Pro' },
      { id: 'moonshotai/kimi-k3', label: 'Moonshot Kimi K3' },
      { id: 'deepseek/deepseek-chat-v3.1', label: 'DeepSeek Chat V3.1' },
      { id: 'qwen/qwen3-max', label: 'Qwen3 Max' },
      { id: 'z-ai/glm-4.5', label: 'Z.ai GLM-4.5' },
      { id: 'z-ai/glm-4.5-air', label: 'Z.ai GLM-4.5 Air' },
      { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
    ],
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    models: [],
  },
]

/** @deprecated 使用 LLM_VENDORS；保留兼容旧引用 */
export const LLM_PRESETS: LlmPreset[] = LLM_VENDORS.map((v) => ({
  ...v,
  model: v.defaultModel || v.models[0]?.id || '',
}))

export function findVendor(id: string | undefined): LlmVendor | undefined {
  return LLM_VENDORS.find((v) => v.id === id)
}

/** @deprecated */
export function findPreset(id: string | undefined): LlmPreset | undefined {
  const v = findVendor(id)
  if (!v) return undefined
  return { ...v, model: v.defaultModel || v.models[0]?.id || '' }
}

export function defaultModelForVendor(v: LlmVendor): string {
  return v.defaultModel || v.models[0]?.id || ''
}
