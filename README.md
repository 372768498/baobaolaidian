# 宝宝来电（BaobaoLaidian）

> **一款面向独居年轻人的 AI 主动来电陪伴 App**
> 第一版只做"它会在什么时候主动出现、怎么接住独居用户的情绪"，不是万能陪聊。

---

## 产品一句话定位

在夜晚低落、下班空窗、情绪下坠时，AI 主动发起一通 App 内短电话，帮助用户恢复情绪状态——被主动想起、被温柔接住、从低落里缓慢恢复。

---

## 第一版只做两个场景

| 场景 | 触发方式 | 时长 | 目标 |
|------|---------|------|------|
| **睡前安抚来电** | 用户设定的每日固定时间窗（默认 22:00–23:00） | 3–6 分钟 | 从散乱情绪过渡到平静 |
| **情绪急救来电** | 用户点击"我现在很难受" | 5–8 分钟 | 10 秒内接通，稳住当下情绪 |

**不做：** 真实手机号外呼、恋爱养成、社区广场、医疗诊断、未成年人模式。

---

## 目标用户

**22–35 岁，独居，夜晚情绪波动明显，不想频繁打扰真人朋友，接受 AI 语音陪伴。**

种子用户特征：下班后空窗感强 · 有表达欲但不想找真人倾诉 · 愿意为稳定陪伴感付小额订阅。

---

## 产品原则（开发时必须遵守）

1. **主动，但不骚扰** — 用户自己设置时间窗和频率，每晚最多来电 1 次 + 补拨 1 次
2. **温柔，但不制造依赖** — 每次通话控制在 10 分钟内，不鼓励无限陪伴
3. **共情，但不扮演治疗师** — 不能出现任何治愈焦虑/抑郁/失眠的表述
4. **拟人，但必须披露是 AI** — 每次通话页固定显示"你正在与 AI 互动"
5. **默认只服务成年人** — Onboarding 强制年龄门槛 + 声明
6. **高风险内容切换安全流** — 见风控模块

---

## 项目目录结构

```
baobao-laidan/
├── apps/
│   ├── mobile/                     # React Native / Expo 前端
│   │   ├── app/                    # expo-router 页面
│   │   │   ├── (auth)/             # 登录 / 注册
│   │   │   ├── (onboarding)/       # 5 步 onboarding
│   │   │   ├── (app)/              # 主应用（首页、历史、设置）
│   │   │   ├── call/
│   │   │   │   ├── incoming.tsx    # 拟真来电界面
│   │   │   │   └── [sessionId].tsx # 通话中界面
│   │   │   ├── recap/
│   │   │   │   └── [sessionId].tsx # 通话后小结
│   │   │   └── safety.tsx          # 安全帮助页
│   │   ├── components/             # 通用 UI 组件
│   │   ├── hooks/                  # useWebSocket, useCallState 等
│   │   ├── lib/                    # api.ts, auth.ts, constants.ts
│   │   ├── store/                  # Zustand 状态
│   │   └── assets/
│   │
│   └── backend/                    # FastAPI 后端
│       ├── app/
│       │   ├── routers/            # auth, calls, memory, recap, ws, users
│       │   ├── services/
│       │   │   ├── call_scheduler.py          # 来电调度
│       │   │   ├── persona_engine.py          # 人设管理
│       │   │   ├── conversation_orchestrator.py # 通话编排
│       │   │   ├── memory_service.py          # 记忆读写
│       │   │   ├── post_call_summary.py       # 通话后小结
│       │   │   └── risk_guard.py              # 风控拦截
│       │   ├── models/             # SQLAlchemy ORM 模型
│       │   ├── schemas/            # Pydantic 数据模型
│       │   ├── main.py
│       │   ├── config.py
│       │   ├── database.py
│       │   └── auth.py
│       ├── migrations/             # Alembic 数据库迁移
│       ├── requirements.txt
│       └── Dockerfile
│
├── docker-compose.yml              # 本地一键启动（PostgreSQL + Redis + Backend）
├── .env.example
└── README.md
```

---

## 数据库 Schema

### users
```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone       VARCHAR(20) UNIQUE,             -- 手机号（可选，初版可用邮箱）
    email       VARCHAR(255) UNIQUE,
    nickname    VARCHAR(50),                    -- 用户希望 AI 叫自己的称呼
    age_verified BOOLEAN DEFAULT FALSE,         -- 年龄核验标志
    ai_disclosed BOOLEAN DEFAULT FALSE,         -- 已同意 AI 披露
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### personas
```sql
CREATE TABLE personas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL,           -- 例如：小暖、小橙、小沐
    style       VARCHAR(20) NOT NULL,           -- gentle | energetic | calm
    description TEXT,
    system_prompt TEXT NOT NULL,               -- 注入 LLM 的基础人设 prompt
    is_active   BOOLEAN DEFAULT TRUE
);
```

### call_preferences
```sql
CREATE TABLE call_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    persona_id      UUID REFERENCES personas(id),
    purpose         VARCHAR(30) NOT NULL,       -- bedtime | after_work | emergency
    window_start    TIME NOT NULL,              -- 例如 22:00
    window_end      TIME NOT NULL,              -- 例如 23:00
    frequency       VARCHAR(20) DEFAULT 'daily', -- daily | weekdays | custom
    timezone        VARCHAR(50) DEFAULT 'Asia/Shanghai',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### conversation_sessions
```sql
CREATE TABLE conversation_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    persona_id      UUID REFERENCES personas(id),
    session_type    VARCHAR(20) NOT NULL,        -- scheduled | emergency
    status          VARCHAR(20) DEFAULT 'pending', -- pending | ringing | active | completed | missed | declined
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_seconds INT,
    risk_level      VARCHAR(10) DEFAULT 'normal', -- normal | elevated | critical
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### conversation_messages
```sql
CREATE TABLE conversation_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID REFERENCES conversation_sessions(id),
    role        VARCHAR(10) NOT NULL,            -- user | assistant | system
    content     TEXT NOT NULL,
    stage       VARCHAR(30),                    -- open | empathy | expression | close | action | confirm
    audio_url   TEXT,                           -- TTS 音频存储路径（可选）
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### memory_items
```sql
CREATE TABLE memory_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    category    VARCHAR(30) NOT NULL,           -- nickname | concern | trigger | comfort_style
    content     TEXT NOT NULL,
    source_session_id UUID REFERENCES conversation_sessions(id),
    confidence  FLOAT DEFAULT 1.0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### post_call_recaps
```sql
CREATE TABLE post_call_recaps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES conversation_sessions(id) UNIQUE,
    user_id         UUID REFERENCES users(id),
    summary_text    TEXT NOT NULL,              -- 一句话总结
    micro_action    TEXT,                       -- 微行动建议
    followup_point  TEXT,                       -- 下次回访点
    emotion_tag     VARCHAR(50),               -- 本次主要情绪标签
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### risk_events
```sql
CREATE TABLE risk_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES conversation_sessions(id),
    user_id         UUID REFERENCES users(id),
    risk_type       VARCHAR(50) NOT NULL,       -- self_harm | suicidal | other_harm | minor | substance
    trigger_content TEXT,                       -- 触发风控的原始文本（脱敏后存储）
    action_taken    VARCHAR(50),               -- redirect | escalate | end_session
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### call_events（来电调度日志）
```sql
CREATE TABLE call_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    session_id  UUID REFERENCES conversation_sessions(id),
    event_type  VARCHAR(30) NOT NULL,           -- scheduled | pushed | answered | missed | declined | retry
    scheduled_at TIMESTAMPTZ,
    fired_at    TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 页面路由与组件树

### 路由结构（expo-router）

```
/                       → 重定向到 /(auth)/login 或 /(app)/home
/(auth)/login           → 登录
/(auth)/register        → 注册
/(onboarding)/step1     → 选择使用目的
/(onboarding)/step2     → 选择人设
/(onboarding)/step3     → 设置称呼
/(onboarding)/step4     → 设置来电时间窗
/(onboarding)/step5     → AI 披露 + 声明确认
/(app)/home             → 首页（主入口）
/(app)/history          → 通话历史 + 情绪趋势
/(app)/settings         → 设置页
/call/incoming          → 拟真来电界面
/call/[sessionId]       → 通话中界面
/recap/[sessionId]      → 通话后小结
/safety                 → 安全帮助页（危机资源）
```

### 关键组件树

```
App
├── AuthProvider (Zustand authStore)
├── (auth)/login
│   └── PhoneInput → OTPInput → LoginButton
├── (onboarding)/
│   ├── Step1: PurposeSelector (bedtime|after_work|emergency)
│   ├── Step2: PersonaCard × 3 (gentle|energetic|calm)
│   ├── Step3: NicknameInput
│   ├── Step4: TimeWindowPicker
│   └── Step5: DisclosureCheckbox × 3 → ConfirmButton
├── (app)/home
│   ├── NextCallCard (下次来电时间)
│   ├── EmergencyButton ("我现在很难受")
│   ├── LastRecapCard (最近一次小结)
│   └── MemoryCard (AI 记住的内容)
├── (app)/history
│   ├── EmotionTrendChart
│   └── RecapList → RecapItem
├── /call/incoming
│   ├── AIBadge ("你正在与 AI 互动")
│   ├── PersonaAvatar + AnimatedRing
│   ├── CallerName
│   └── ActionRow: [接听] [稍后] [今晚不接]
├── /call/[sessionId]
│   ├── AIBadge (固定显示)
│   ├── CallTimer
│   ├── SubtitleStream (实时字幕，WebSocket)
│   ├── WaveformVisualizer
│   └── ControlRow: [静音] [挂断]
└── /recap/[sessionId]
    ├── SummaryText
    ├── MicroActionCard
    └── FollowupPoint
```

---

## 核心模块说明

### 1. call_scheduler（来电调度）

**职责：** 按用户偏好时间窗触发来电，管理补拨逻辑。

```
输入：call_preferences 表 + 当前时间
输出：触发 WebSocket 推送给对应用户 → 创建 conversation_sessions 记录
逻辑：
  - 每分钟扫描需要触发的用户（或用 Redis sorted set 精准调度）
  - 发送 Push Notification（提前 1–3 分钟）
  - 触发 App 内来电界面
  - 若 90 秒未接听 → 标记 missed
  - missed 后 10 分钟补拨一次（最多 1 次）
```

### 2. persona_engine（人设管理）

**职责：** 管理 AI 通话时的角色设定和语气。

```
输入：persona_id + user memory_items
输出：注入 LLM 的完整 system prompt
人设类型：
  - gentle（温柔型）：语速慢，多停顿，善用"嗯"/"我在"
  - energetic（元气型）：语气积极，偶尔幽默，不过分热情
  - calm（冷静型）：低情绪色彩，陈述式，给空间
```

### 3. conversation_orchestrator（通话编排）

**职责：** 控制每次通话的结构，不允许完全自由散聊。

```
通话结构（6 阶段，每阶段对应 stage 字段）：
  open      → "今天像是很累的一天，对吗？"（确认当前状态）
  empathy   → 共情命名，不评判，不急着解决
  expression → "你不需要把所有事讲清楚，只说现在最堵的一点就行"
  close     → 收束，不拉长，3–4 句内结束深聊
  action    → 给一个当晚可执行的微行动（喝水/放下手机/做 3 次深呼吸）
  confirm   → "今晚我们先到这里，你感觉好一点了吗？"

时长控制：
  - scheduled 类型：目标 4–6 分钟，超 8 分钟强制收束
  - emergency 类型：目标 5–8 分钟，超 10 分钟强制收束
```

### 4. memory_service（记忆系统）

**职责：** 每次通话结束后提取并更新用户记忆。

```
记忆类别（category 字段）：
  - nickname：用户希望被叫的称呼
  - concern：最近提到的困扰主题（最多保留 3 条，滚动更新）
  - trigger：常见情绪触发点（例如：工作压力/家人关系）
  - comfort_style：用户喜欢的安抚方式（聆听型 vs 建议型）

读取时机：通话开场前，注入 persona prompt
写入时机：通话结束后，由 LLM 从对话中提取，存入 memory_items
```

### 5. risk_guard（风控系统）

**职责：** 实时拦截高风险内容，切换安全流程。

```
触发词类型（risk_type）：
  - self_harm：自伤表述
  - suicidal：轻生/不想活了/结束一切
  - other_harm：明显他伤意图
  - minor：识别到未成年人
  - substance：高危药物滥用

触发后动作（严格按此顺序）：
  1. 立即中断当前对话生成
  2. AI 明确说："我是 AI，不是人类，也不是心理医生"
  3. 引导："我现在最想让你知道，有真正能帮到你的人，我给你看一下"
  4. 推送 /safety 页面（含危机热线）
  5. 写入 risk_events 记录（内容脱敏）
  6. 该 session 标记 risk_level = critical，不可继续普通通话

实现方式：
  - 第一层：关键词匹配（延迟 < 50ms）
  - 第二层：LLM 分类（异步，用于标记，不阻塞响应）
```

### 6. post_call_summary_service（通话后小结）

**职责：** 每次通话结束后生成结构化小结。

```
输入：完整 conversation_messages（本次通话）
输出：post_call_recaps 一条记录，包含：
  - summary_text：一句话，格式"你今晚聊到了[主题]，感觉[情绪状态]"
  - micro_action：今晚可做的一件小事
  - followup_point：下次通话可以回访的点
  - emotion_tag：主要情绪标签（tired/anxious/lonely/angry/okay）

生成方式：通话结束后异步调用 LLM，3 秒内推送到前端展示
```

---

## API 接口清单

### 认证
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
```

### 用户与偏好
```
GET  /api/users/me
PUT  /api/users/me
GET  /api/users/me/call-preferences
POST /api/users/me/call-preferences
PUT  /api/users/me/call-preferences/{id}
```

### 通话
```
POST /api/calls/emergency          # 触发情绪急救来电
POST /api/calls/{sessionId}/answer # 接听
POST /api/calls/{sessionId}/decline
POST /api/calls/{sessionId}/snooze # 稍后
POST /api/calls/{sessionId}/end
GET  /api/calls/history
```

### WebSocket
```
WS /ws/call/{sessionId}            # 通话双向流（STT 输入 + TTS 输出 + 字幕）
WS /ws/notify/{userId}             # 来电推送通知
```

### 记忆与小结
```
GET /api/memory                    # 获取当前记忆卡片
GET /api/recap/{sessionId}         # 获取通话小结
GET /api/recap/list                # 历史小结列表
```

---

## 环境变量（参考 .env.example）

```env
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/baobaolaidian

# Redis
REDIS_URL=redis://localhost:6379

# JWT
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=60

# LLM
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# TTS（低延迟首选）
TTS_PROVIDER=cartesia                # cartesia | elevenlabs | azure
TTS_API_KEY=

# STT
STT_PROVIDER=deepgram               # deepgram | azure
STT_API_KEY=

# 推送通知
EXPO_ACCESS_TOKEN=

# 对象存储（音频归档，可选）
S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## 本地启动

```bash
# 1. 启动基础服务
docker-compose up -d        # PostgreSQL + Redis

# 2. 初始化数据库
cd apps/backend
pip install -r requirements.txt
alembic upgrade head
python init_db.py           # 写入 3 个默认人设

# 3. 启动后端
uvicorn app.main:app --reload --port 8000

# 4. 启动前端
cd apps/mobile
npm install
npx expo start
```

---

## 开发顺序（4 周计划）

| 周次 | 目标 | 验收标准 |
|------|------|---------|
| **第 1 周** | 项目初始化、数据库、onboarding、首页、设置页、来电调度框架 | 用户可完成注册 → onboarding → 首页展示下次来电时间 |
| **第 2 周** | 来电界面、通话页、WebSocket 链路、基础语音接通 | 点击"立即来电"→ 进入来电界面 → 接听 → 听到 AI 说话 |
| **第 3 周** | 通话编排 6 阶段、通话后小结、记忆系统 | 完成一次完整通话 → 看到小结 → 第二次通话 AI 记得上次内容 |
| **第 4 周** | 风控系统、埋点、灰度测试、合规检查 | 测试风控触发 → 跳转安全页 → 关键指标可采集 |

---

## 第一阶段验收指标

| 指标 | 目标值（内测 200 人，2 周） |
|------|--------------------------|
| 来电接通率 | ≥ 60% |
| 次日复接率 | ≥ 40% |
| 7 日留存 | ≥ 25% |
| 每周平均通话次数 | ≥ 3 次/人 |
| 通话后正向反馈率 | ≥ 70% |
| 免费 → 付费转化 | ≥ 5%（内测期参考值） |

**第一阶段核心判断标准：用户会不会期待它明晚继续打来。**

---

## 合规清单（上线前必须 100% 完成）

- [ ] Onboarding 第一屏明确展示"你正在与 AI 互动"
- [ ] 每次通话页固定显示 AI 标识（不可关闭）
- [ ] 年龄门槛弹窗（声明 18 岁以上）
- [ ] 医疗免责声明（不是心理医生，不提供医疗建议）
- [ ] 危机帮助入口（首页 + 通话页均可一键进入）
- [ ] 隐私政策页（含数据使用说明 + 删除账号功能）
- [ ] 中国上线：AI 生成内容标识符合《人工智能生成合成内容标识办法》（2025 年 9 月实施）
- [ ] App Store 审核：Health & Wellness 类目附加说明，说明不提供医疗服务

---

## 商业模式

| 版本 | 内容 | 价格 |
|------|------|------|
| **免费版** | 每日 1 次睡前来电，1 个人设，基础记忆，每周 2 次急救来电 | 免费 |
| **Pro 版** | 无限急救来电，多人设，强化记忆，自定义策略，7/14 天陪伴计划 | 中国 ¥29–49/月，海外 $7.99–12.99/月 |
