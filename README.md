# 个人规划助手

本地优先的移动端个人规划 PWA：储蓄记账、锻炼打卡、长期技能目标与阅读进度，数据保存在浏览器 IndexedDB。

## 在线访问

Live: https://timeroulette.github.io/personal-planner/

若尚未启用：GitHub Settings → Pages → Source = Deploy from branch `gh-pages` / root。

## 技术栈

- Vite + React + TypeScript
- Dexie（IndexedDB）
- Recharts（图表）
- vite-plugin-pwa（Manifest + Service Worker）
- 简体中文 UI，底部 Tab 导航，安全区适配

## 快速开始

```bash
cd /workspace/personal-planner
npm install
npm run dev
```

开发服务器默认：`http://localhost:5173`（也可使用 bun：`bun install && bun run dev`）。

生产构建：

```bash
npm run build
npm run preview
```

## 功能概览

### 储蓄
- 总览：净资产、本月收支、储蓄率、预算剩余、趋势图（周/月/年）
- **周期储蓄目标**（周/月/季度/半年/年）：设定目标金额；进度 = 周期内净储蓄（收入−支出）÷ 目标，由流水自动汇总，总览进度条展示
- **自定义周期起始日**（储蓄页 → 目标周期）：`cycleStartDay` 默认 1（自然月）；设为 20 则「月」为每月 20 日～下月 19 日，季度/半年/年按自定义月叠加
- 流水：收入/支出（金额、分类、账户、日期、备注、标签）；按日期折叠分组（今天默认展开）
- **固定收支**：自定义固定收入/支出（名称、金额、分类/账户可选、入账日或周期起始日、启用开关）；每个计费周期幂等自动生成流水，可手动「生成本周期」
- 分类与账户（含默认项 + 自定义）
- 筛选：关键词/分类/账户/金额
- 月度总预算与分类预算、超支提示
- 图表：趋势、分类饼图、储蓄进度、账户分布
- JSON 导出/导入（在设置页）

### 锻炼
- 总览：本周打卡、时长、连续天数、计划完成率、热力图、目标进度
- 训练类型：跑步/慢跑/间歇跑、步行、骑行、游泳、力量分部位、HIIT、瑜伽/普拉提/拉伸、球类、跳绳、爬山、椭圆机/划船机、舞蹈、武术/搏击、攀岩、滑雪等 + 自定义
- **运动量目标**：选择运动类型 + 指标（距离/时长/次数）+ 周期；记录对应类型训练后进度自动累加
- **体重目标**：设定目标体重，由体重日志自动更新进度
- 每周计划模板（含休息日）
- 体重趋势

### 技能
- 学习成长目标：模板（阅读 / 语言 / 编程 / 考试）、阶段计划、打卡与反思笔记
- 进度洞察：连续天数、节奏 vs 计划、复习提醒、建议下一步
- 本地导入 TXT / EPUB；阅读器自动目录（EPUB nav/spine，TXT 章节启发式）

### 能量 / Emotion Ball（phase 7a）
- **今日能量卡**（储蓄总览 + 锻炼总览）：Emotion Ball + 摄入 / 消耗 / 预算 / 净摄入
- 饮食：储蓄「餐饮」等分类或勾选「记为饮食」→ 关键词估算或手填 kcal → 写入 `foodLogs`
- 消耗：锻炼按 MET×体重×时长估算（可手填），存 `workouts.caloriesBurned`
- 预算：设置 → 能量 / 热量（默认 2000 kcal）；体重用于估算
- 硬提醒：已超预算再加饮食 → 生气球强确认；摄入过低（&lt;60% 且晚间）→ 疲惫提醒
- 情绪映射：舒适 `02` · 开心 `10` · 满足 `19` · 接近上限 `17`/`13` · 超标 `21` · 过低 `15`/`12`
- 引擎：`public/emotion-ball/`（LICENSE / NOTICE / ATTRIBUTION，社区非商业许可）

### 设置 + AI
- 外观 / 数据 / AI 分区手风琴（默认折叠）
- 数据导出、导入、清空（已移除演示数据按钮）
- AI 服务商预设（OpenAI / DeepSeek / 通义 / Kimi / SiliconFlow / OpenRouter 等），选预设自动填 URL+模型
- API Key 使用 Web Crypto AES-GCM 本机加密（仍属客户端方案）
- AI 对话页，可选附带模块摘要上下文

## 数据模型（IndexedDB）

| 表 | 说明 |
|---|---|
| categories / accounts / transactions / budgets / savingsGoals / fixedItems | 储蓄（含固定收支） |
| workouts / weeklyPlan / bodyWeights / exerciseGoals | 锻炼 |
| skillGoals / skillStages / skillNotes / books / blobs | 技能、笔记与书籍（EPUB 二进制在 blobs） |
| chatMessages / kv | 对话与设置 |
| foodLogs / dailyEnergy | 饮食热量日志与日汇总 |

## SyncAdapter 与未来云同步

```ts
interface SyncAdapter {
  pull(): Promise<SyncPayload | null>
  push(payload: SyncPayload): Promise<void>
  getStatus(): Promise<SyncStatus>
}
```

- `LocalAdapter`：从 IndexedDB 拉取/写回完整 `SyncPayload`（导出导入也走此路径）
- `CloudAdapter`：占位实现，配置 endpoint 后可替换为真实云端 API，无需改业务页

v1 无登录，全部本地；接入云端时实现 `CloudAdapter.push/pull` 并在设置中切换即可。

## 目录结构（关键）

```
src/
  db/database.ts          # Dexie schema
  sync/                   # SyncAdapter / LocalAdapter / CloudAdapter
  types/                  # 类型定义
  pages/savings|exercise|skills|settings
  components/             # 底栏、弹层、空状态等
  hooks/ utils/ styles/
```

## 说明与限制（v1）

- 不做：高级 PDF 阅读、CSV 批量导入、分期账单、真实推送、真实云后端
- EPUB 依赖 epubjs，部分畸形文件可能无法打开
- PWA 安装与离线缓存需在支持的浏览器中通过 HTTPS 或 localhost 使用
