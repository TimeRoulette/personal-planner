import type { SkillType } from '../types'

export type SkillTemplateCategory =
  | '阅读学习'
  | '语言表达'
  | '编程技术'
  | '职业发展'
  | '健康运动'
  | '艺术创作'
  | '生活习惯'
  | '理财副业'
  | '家庭成长'

export interface SkillTemplate {
  id: string
  name: string
  type: SkillType
  category: SkillTemplateCategory
  title: string
  unit: string
  targetQuantity: number
  expectedPace: number
  stages: string[]
  notes: string
  /** 建议复习间隔（天），用于打卡提醒 */
  reviewIntervals: number[]
}

export const SKILL_TEMPLATE_CATEGORIES: SkillTemplateCategory[] = [
  '阅读学习',
  '语言表达',
  '编程技术',
  '职业发展',
  '健康运动',
  '艺术创作',
  '生活习惯',
  '理财副业',
  '家庭成长',
]

export const SKILL_TEMPLATES: SkillTemplate[] = [
  // —— 阅读学习 ——
  {
    id: 'reading',
    name: '阅读计划',
    type: '阅读',
    category: '阅读学习',
    title: '读完一本书',
    unit: '页',
    targetQuantity: 300,
    expectedPace: 10,
    stages: ['浏览目录与前言', '读完前 1/3', '读完 2/3', '读完并写短评'],
    notes: '每天固定时段阅读；读完一章可写一句感想。',
    reviewIntervals: [1, 3, 7],
  },
  {
    id: 'exam',
    name: '考试备考',
    type: '学习',
    category: '阅读学习',
    title: '考试冲刺',
    unit: '小时',
    targetQuantity: 60,
    expectedPace: 2,
    stages: ['梳理考点大纲', '第一轮刷题', '错题本巩固', '模拟卷限时', '考前回顾'],
    notes: '错题按间隔复习；每周至少一套模拟。',
    reviewIntervals: [1, 2, 4, 7],
  },
  {
    id: 'math-drill',
    name: '数学刷题',
    type: '学习',
    category: '阅读学习',
    title: '数学刷题计划',
    unit: '题',
    targetQuantity: 200,
    expectedPace: 8,
    stages: ['基础公式回顾', '专题分类刷题', '错题二次攻克', '限时套卷', '查漏补缺'],
    notes: '每题标注考点和错因；同类错题隔日再做。',
    reviewIntervals: [1, 3, 7],
  },
  {
    id: 'thesis-research',
    name: '论文科研',
    type: '项目',
    category: '阅读学习',
    title: '论文 / 课题推进',
    unit: '%',
    targetQuantity: 100,
    expectedPace: 3,
    stages: ['选题与文献综述', '方法与实验设计', '数据采集分析', '初稿写作', '修改投稿'],
    notes: '每周固定写作块；文献用标签管理，避免只搜不写。',
    reviewIntervals: [3, 7, 14],
  },
  {
    id: 'diary-review',
    name: '日记复盘',
    type: '习惯',
    category: '阅读学习',
    title: '每日日记与周复盘',
    unit: '天',
    targetQuantity: 30,
    expectedPace: 1,
    stages: ['建立晚间 10 分钟书写', '加入情绪/事件标签', '周末写周复盘', '提炼可行动改进'],
    notes: '不必长文；三句话：今天发生、感受、明日一件事。',
    reviewIntervals: [1, 7],
  },

  // —— 语言表达 ——
  {
    id: 'language',
    name: '语言学习',
    type: '学习',
    category: '语言表达',
    title: '外语打卡',
    unit: '小时',
    targetQuantity: 40,
    expectedPace: 0.5,
    stages: ['发音与基础词汇', '听力精听 20 篇', '口语跟读', '模拟对话 / 作文'],
    notes: '结合间隔复习：生词当天、第 3 天、第 7 天再看。',
    reviewIntervals: [1, 3, 7, 14],
  },
  {
    id: 'speech',
    name: '演讲表达',
    type: '学习',
    category: '语言表达',
    title: '演讲与当众表达',
    unit: '次',
    targetQuantity: 12,
    expectedPace: 0.3,
    stages: ['结构模板（开场-三点-收束）', '录视频自我复盘', '小范围试讲', '正式场合演讲'],
    notes: '每次只练一个点：眼神 / 停顿 / 故事开头。',
    reviewIntervals: [2, 7],
  },
  {
    id: 'writing',
    name: '写作练笔',
    type: '习惯',
    category: '语言表达',
    title: '写作练笔',
    unit: '篇',
    targetQuantity: 20,
    expectedPace: 0.5,
    stages: ['日更短文 300 字', '完成 5 篇叙事', '完成 5 篇观点', '选 2 篇深度改稿', '发布或分享'],
    notes: '先写完再改；建「素材箱」收集金句与案例。',
    reviewIntervals: [3, 7],
  },
  {
    id: 'interview-prep',
    name: '面试准备',
    type: '学习',
    category: '语言表达',
    title: '面试冲刺',
    unit: '小时',
    targetQuantity: 30,
    expectedPace: 1,
    stages: ['岗位 JD 拆解', '项目故事 STAR 化', '高频题库演练', '模拟面试录音', '复盘话术'],
    notes: '每个项目准备 1 个亮点故事；录音听停顿与逻辑。',
    reviewIntervals: [1, 3, 7],
  },

  // —— 编程技术 ——
  {
    id: 'coding',
    name: '编程项目',
    type: '项目',
    category: '编程技术',
    title: '完成一个小项目',
    unit: '%',
    targetQuantity: 100,
    expectedPace: 5,
    stages: ['需求与技术选型', '搭好骨架可运行', '核心功能完成', '测试与文档', '发布 / 复盘'],
    notes: '每天至少提交一次；卡住超过 1 天就写反思笔记。',
    reviewIntervals: [2, 5, 10],
  },
  {
    id: 'opensource',
    name: '开源贡献',
    type: '项目',
    category: '编程技术',
    title: '向开源仓库贡献',
    unit: 'PR',
    targetQuantity: 5,
    expectedPace: 0.15,
    stages: ['选仓库读 CONTRIBUTING', '修文档 / typo 热身', '认领 good-first-issue', '提交并跟进 review', '总结贡献笔记'],
    notes: '小步 PR 更易合入；沟通礼貌、描述复现步骤。',
    reviewIntervals: [3, 7],
  },
  {
    id: 'data-analysis',
    name: '数据分析',
    type: '学习',
    category: '编程技术',
    title: '数据分析入门到实战',
    unit: '小时',
    targetQuantity: 40,
    expectedPace: 1,
    stages: ['SQL / 表格基础', '清洗与可视化', '完成一个业务分析案例', '写结论与建议', '作品集整理'],
    notes: '每个案例先写「问题→指标→结论」再动代码。',
    reviewIntervals: [2, 7, 14],
  },
  {
    id: 'ai-tools',
    name: 'AI 工具应用',
    type: '学习',
    category: '编程技术',
    title: 'AI 工具工作流',
    unit: '小时',
    targetQuantity: 20,
    expectedPace: 0.5,
    stages: ['提示词基础与结构化输出', '写作 / 编程辅助场景', '搭建个人知识库问答', '自动化小流程', '安全与隐私规范'],
    notes: '每次记录有效提示模板；敏感数据不上传。',
    reviewIntervals: [3, 7],
  },
  {
    id: 'product-design',
    name: '产品设计',
    type: '项目',
    category: '编程技术',
    title: '产品设计练习',
    unit: '%',
    targetQuantity: 100,
    expectedPace: 4,
    stages: ['用户问题访谈 / 假设', '用户旅程与需求优先级', '线框与交互说明', '可用性走查', '迭代复盘'],
    notes: '用「谁-场景-痛点-方案」写清每个需求。',
    reviewIntervals: [3, 7],
  },

  // —— 职业发展 ——
  {
    id: 'cert-exam',
    name: '职业技能考证',
    type: '学习',
    category: '职业发展',
    title: '职业考证备考',
    unit: '小时',
    targetQuantity: 80,
    expectedPace: 1.5,
    stages: ['大纲与教材拆分', '章节精读+笔记', '真题两轮', '薄弱模块攻坚', '考前模拟'],
    notes: '按大纲建清单；真题按考点归类。',
    reviewIntervals: [1, 3, 7, 14],
  },
  {
    id: 'side-project',
    name: '副业项目',
    type: '项目',
    category: '职业发展',
    title: '副业最小可行产品',
    unit: '%',
    targetQuantity: 100,
    expectedPace: 3,
    stages: ['选方向与目标用户', '验证需求（访谈/预售）', '做出 MVP', '首批用户反馈', '定价与推广试验'],
    notes: '先验证再加功能；每周固定「副业时间块」。',
    reviewIntervals: [7, 14],
  },

  // —— 健康运动 ——
  {
    id: 'fitness-checkin',
    name: '健身打卡',
    type: '习惯',
    category: '健康运动',
    title: '健身训练打卡',
    unit: '次',
    targetQuantity: 24,
    expectedPace: 0.5,
    stages: ['制定分化计划', '掌握主要动作模式', '连续打卡 2 周', '逐步加重量/容量', '阶段测评'],
    notes: '睡眠与蛋白同步关注；疼痛立即减量。',
    reviewIntervals: [2, 7],
  },
  {
    id: 'meditation',
    name: '冥想正念',
    type: '习惯',
    category: '健康运动',
    title: '冥想正念练习',
    unit: '天',
    targetQuantity: 30,
    expectedPace: 1,
    stages: ['每天 5 分钟呼吸觉察', '延长到 10–15 分钟', '加入行走冥想', '情绪来时标注练习'],
    notes: '走神是正常的；温和把注意力带回呼吸。',
    reviewIntervals: [1, 7],
  },
  {
    id: 'health-rehab',
    name: '健康康复',
    type: '习惯',
    category: '健康运动',
    title: '康复 / 体态训练',
    unit: '次',
    targetQuantity: 20,
    expectedPace: 0.5,
    stages: ['评估痛点与禁忌', '日常激活与拉伸', '核心稳定训练', '逐步回归运动', '维持方案'],
    notes: '遵医嘱；疼痛加重立即停止并复诊。',
    reviewIntervals: [2, 7],
  },
  {
    id: 'dance',
    name: '舞蹈练习',
    type: '习惯',
    category: '健康运动',
    title: '舞蹈跟练',
    unit: '小时',
    targetQuantity: 20,
    expectedPace: 0.5,
    stages: ['基础律动与节奏', '分解动作慢练', '连贯小段', '完整曲目', '录视频纠姿'],
    notes: '热身不可省；分段练比一遍糊弄有效。',
    reviewIntervals: [2, 5],
  },
  {
    id: 'driving',
    name: '驾驶练习',
    type: '学习',
    category: '健康运动',
    title: '驾驶技能提升',
    unit: '小时',
    targetQuantity: 30,
    expectedPace: 1,
    stages: ['科目理论巩固', '场地基本功', '道路实操', '夜间/雨天适应', '安全习惯清单'],
    notes: '安全第一；每次练后记录易错点。',
    reviewIntervals: [1, 3, 7],
  },

  // —— 艺术创作 ——
  {
    id: 'drawing-design',
    name: '绘画设计',
    type: '习惯',
    category: '艺术创作',
    title: '绘画 / 设计练习',
    unit: '幅',
    targetQuantity: 30,
    expectedPace: 1,
    stages: ['线条与形练习', '明暗与色彩', '临摹 10 幅', '原创小稿 10 幅', '作品集挑选'],
    notes: '每天哪怕速写 10 分钟；保留过程图。',
    reviewIntervals: [3, 7],
  },
  {
    id: 'music-instrument',
    name: '音乐乐器',
    type: '习惯',
    category: '艺术创作',
    title: '乐器练习',
    unit: '小时',
    targetQuantity: 40,
    expectedPace: 0.5,
    stages: ['姿势与基本功', '音阶/指法', '练习曲 3 首', '曲目完整演奏', '录音自评'],
    notes: '慢练准确比快练糊弄重要；用节拍器。',
    reviewIntervals: [1, 3, 7],
  },
  {
    id: 'photo-edit',
    name: '摄影剪辑',
    type: '项目',
    category: '艺术创作',
    title: '摄影与剪辑作品',
    unit: '条',
    targetQuantity: 8,
    expectedPace: 0.2,
    stages: ['构图与光线基础', '拍摄素材积累', '剪辑节奏与配乐', '调色与字幕', '发布 1 条成品'],
    notes: '先讲清一个故事再追求特效。',
    reviewIntervals: [3, 7],
  },
  {
    id: 'calligraphy',
    name: '书法临帖',
    type: '习惯',
    category: '艺术创作',
    title: '书法练习',
    unit: '天',
    targetQuantity: 40,
    expectedPace: 1,
    stages: ['选帖与执笔', '基本笔画', '单字结构', '连贯篇章', '对比原帖复盘'],
    notes: '每天一页即可；注重结构而非数量。',
    reviewIntervals: [2, 7],
  },

  // —— 生活习惯 ——
  {
    id: 'habit-build',
    name: '习惯养成',
    type: '习惯',
    category: '生活习惯',
    title: '微习惯 21 天',
    unit: '天',
    targetQuantity: 21,
    expectedPace: 1,
    stages: ['选一个微习惯（≤2 分钟）', '固定触发场景', '连续 7 天不中断', '连续 21 天', '决定保持或升级'],
    notes: '失败不归零：漏一天就从「继续」开始，别自我惩罚。',
    reviewIntervals: [1, 7],
  },
  {
    id: 'cooking',
    name: '厨艺进阶',
    type: '习惯',
    category: '生活习惯',
    title: '厨艺练习',
    unit: '道',
    targetQuantity: 15,
    expectedPace: 0.3,
    stages: ['刀工与基础调味', '家常菜 5 道', '一份汤/主食', '宴客菜单彩排', '总结失败菜谱'],
    notes: '一次只改一个变量（火候/盐量）；记菜谱卡。',
    reviewIntervals: [3, 7],
  },
  {
    id: 'game-rank',
    name: '游戏段位',
    type: '习惯',
    category: '生活习惯',
    title: '游戏段位冲分（有节制）',
    unit: '局',
    targetQuantity: 50,
    expectedPace: 2,
    stages: ['明确弱点（意识/操作）', '录像复盘 5 局', '专项训练模式', '排位稳定发挥', '设定止损局数'],
    notes: '设定每日上限；倾斜时立刻停，保护作息。',
    reviewIntervals: [2, 5],
  },
  {
    id: 'travel-guide',
    name: '旅行攻略学习',
    type: '学习',
    category: '生活习惯',
    title: '旅行规划与攻略',
    unit: '%',
    targetQuantity: 100,
    expectedPace: 5,
    stages: ['目的地调研', '交通住宿草案', '日程与预算', '必备清单与备份方案', '行后复盘笔记'],
    notes: '留弹性半天；证件与保险优先确认。',
    reviewIntervals: [7],
  },

  // —— 理财副业 ——
  {
    id: 'finance-learn',
    name: '理财投资学习',
    type: '学习',
    category: '理财副业',
    title: '理财投资基础',
    unit: '小时',
    targetQuantity: 25,
    expectedPace: 0.5,
    stages: ['收支与应急金', '风险与资产配置概念', '指数基金入门阅读', '模拟组合跟踪', '投资纪律清单'],
    notes: '先学习再实盘；不借钱投资，警惕保本承诺。',
    reviewIntervals: [3, 7, 14],
  },

  // —— 家庭成长 ——
  {
    id: 'parenting',
    name: '育儿知识',
    type: '学习',
    category: '家庭成长',
    title: '育儿知识学习',
    unit: '小时',
    targetQuantity: 20,
    expectedPace: 0.4,
    stages: ['年龄段发展特点', '沟通与情绪引导', '日常照护清单', '边界与规则', '记录实践反馈'],
    notes: '选可信来源；理论要落到具体场景练习。',
    reviewIntervals: [3, 7],
  },
]

export function templatesByCategory(): Record<SkillTemplateCategory, SkillTemplate[]> {
  const map = {} as Record<SkillTemplateCategory, SkillTemplate[]>
  for (const c of SKILL_TEMPLATE_CATEGORIES) map[c] = []
  for (const t of SKILL_TEMPLATES) {
    map[t.category].push(t)
  }
  return map
}

export function nextReviewDate(lastCheckIn: string | undefined, intervals: number[]): string | null {
  if (!intervals.length) return null
  const base = lastCheckIn ? new Date(lastCheckIn + 'T00:00:00') : new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const elapsed = Math.max(0, Math.round((today.getTime() - base.getTime()) / 86400000))
  const nextInterval = intervals.find((d) => d > elapsed) ?? intervals[intervals.length - 1]
  const d = new Date(base)
  d.setDate(d.getDate() + nextInterval)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
