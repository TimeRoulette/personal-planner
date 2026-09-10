export interface LlmPreset {
  id: string
  name: string
  baseUrl: string
  model: string
  hint?: string
}

/** 常见 OpenAI 兼容提供商（端点与默认模型为公开文档常用值） */
export const LLM_PRESETS: LlmPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    hint: '也可写 https://api.deepseek.com/v1',
  },
  {
    id: 'qwen',
    name: '通义千问（兼容模式）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    id: 'moonshot',
    name: 'Moonshot / Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow 硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM（兼容）',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    model: '',
  },
]

export function findPreset(id: string | undefined): LlmPreset | undefined {
  return LLM_PRESETS.find((p) => p.id === id)
}
