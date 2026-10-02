/**
 * 小禾画布工具定义
 * 
 * 从 canvas-agent/src/canvas/schemas.ts 转换而来
 */

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, ParameterDefinition>
}

export interface ParameterDefinition {
  type: string
  required?: boolean
  description?: string
  enum?: string[]
  items?: { type: string; additionalProperties?: boolean }
  properties?: Record<string, ParameterDefinition>
  additionalProperties?: boolean
}

export const toolDefinitions: ToolDefinition[] = [
  // ========== 导航工具 ==========
  {
    name: 'site_navigate',
    description: '跳转网站页面。path 可为 / (首页)、/canvas (我的画布)、/canvas/:id (指定画布)、/canvas?mode=new (创建新画布并进入)、/canvas?mode=recent (打开最近画布)、/image (生图工作台)、/video (视频创作台)、/prompts (提示词库)、/assets (我的素材)、/config (配置)。当没有已连接画布时，用 /canvas?mode=new 创建新画布。',
    parameters: {
      path: { type: 'string', required: true, description: '目标页面路径' },
    },
  },

  // ========== 画布列表 ==========
  {
    name: 'canvas_list_projects',
    description: '列出用户全部画布（仅标题、创建/更新时间、节点数、连线数，不含完整数据），支持 keyword 搜索和 page/pageSize 分页。返回的 id 可配合 site_navigate 跳转到 /canvas/:id 打开对应画布。',
    parameters: {
      keyword: { type: 'string', description: '搜索关键词' },
      page: { type: 'number', description: '页码' },
      pageSize: { type: 'number', description: '每页数量' },
    },
  },

  // ========== 画布状态 ==========
  {
    name: 'canvas_get_state',
    description: '读取当前网页画布的节点、连线、选区和视口。',
    parameters: {},
  },
  {
    name: 'canvas_get_selection',
    description: '读取当前网页画布选中的节点。',
    parameters: {},
  },
  {
    name: 'canvas_export_snapshot',
    description: '导出当前画布快照，用于理解布局。',
    parameters: {},
  },

  // ========== 批量操作 ==========
  {
    name: 'canvas_apply_ops',
    description: `批量操作当前网页画布。ops 支持 add_node、update_node、delete_node、delete_connections、connect_nodes、set_viewport、select_nodes、run_generation。

**节点类型**：
- sticker - 便签，用于说明和标注（详细的操作步骤说明）
- image - 图片节点，用于上传或生成图片（180×220）
- video - 视频节点，用于生成视频（180×220）

**提示词位置**：
- 图片/视频节点：提示词放在 metadata.prompt
- 文本节点：内容放在 metadata.content（不是 prompt）
示例：{"type":"image","title":"穿着效果","metadata":{"prompt":"8岁小男孩穿着..."}}
示例：{"type":"text","title":"分镜脚本","metadata":{"content":"镜头1：开场..."}}

**便签内容要详细**，说明具体操作步骤：
{"type":"sticker","metadata":{"content":"【第一步：上传素材】\\n在下方图片框中上传你的服装平铺图\\n建议白底、服装展开、高清图片","stickerTheme":"yellow"}}

**便签颜色**（每步不同）：yellow→blue→green→pink→purple→gray

**便签尺寸自适应**（确保完整显示）：
- 宽度 = 最长行字符数 × 14 + 32（最小120，最大400）
- 高度 = 行数 × 24 + 24（最小50）
- 快速估算：1-2行短文本180×60，3-4行240×100，超过5行300×150

**布局原则**：从左到右分层，同层竖排
- 层间距（水平）：350px
- 同层节点间距（垂直）：240px（220高度+20间距）
- 便签在该阶段第一个节点正上方，y 间距 10px
- 便签的 x 坐标 = 该阶段节点的 x 坐标（便签间距自然为 350px）

**坐标示例**（6套服装工作流）：
第1步 x=50：便签(x=50,y=10)，模特(x=50,y=120)
第2步 x=400：便签(x=400,y=10)，服装1-6(x=400,y=120,360,600,840,1080,1320)
第3步 x=750：便签(x=750,y=10)，场景(x=750,y=120)
第4步 x=1100：便签(x=1100,y=10)，穿版图1-6(x=1100,y=120,360,600,840,1080,1320)
第5步 x=1450：便签(x=1450,y=10)，参考视频(x=1450,y=120)
第6步 x=1800：便签(x=1800,y=10)，输出视频(x=1800,y=120)

**视口设置**：
- 节点较少时：{"x":20,"y":20,"k":1}
- 节点较多（高度超800）时：{"x":20,"y":80,"k":0.6} 或更小`,
    parameters: {
      ops: {
        type: 'array',
        required: true,
        description: '操作列表',
        items: { type: 'object', additionalProperties: true },
      },
    },
  },

  // ========== 创建节点 ==========
  {
    name: 'canvas_create_node',
    description: '创建任意类型节点：text、image、config、video、audio。适合创建占位图、媒体占位、配置节点或自定义 metadata 节点。',
    parameters: {
      nodeType: { type: 'string', required: true, enum: ['image', 'text', 'config', 'video', 'audio', 'sticker'], description: '节点类型' },
      title: { type: 'string', description: '节点标题' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
      width: { type: 'number', description: '宽度' },
      height: { type: 'number', description: '高度' },
      metadata: { type: 'object', description: '节点元数据', additionalProperties: true },
    },
  },
  {
    name: 'canvas_create_attachment_nodes',
    description: '把当前对话中用户上传的图片附件创建成真实画布图片节点。attachmentIds 使用本轮附件清单中的 ID；返回的节点 ID 可传给 canvas_create_generation_flow.referenceNodeIds 作为生成参考图。',
    parameters: {
      attachmentIds: { type: 'array', required: true, items: { type: 'string' }, description: '附件 ID 列表' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
      gap: { type: 'number', description: '节点间距' },
      direction: { type: 'string', enum: ['row', 'column'], description: '排列方向' },
    },
  },
  {
    name: 'canvas_create_text_node',
    description: '在当前画布创建单个文本节点。',
    parameters: {
      text: { type: 'string', description: '文本内容' },
      title: { type: 'string', description: '节点标题' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
      width: { type: 'number', description: '宽度' },
      height: { type: 'number', description: '高度' },
    },
  },
  {
    name: 'canvas_create_text_nodes',
    description: '批量创建文本节点，适合生成标题、段落、脚本、说明等内容块。',
    parameters: {
      items: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: '文本节点列表' },
      x: { type: 'number', description: '起始 x 坐标' },
      y: { type: 'number', description: '起始 y 坐标' },
      gap: { type: 'number', description: '节点间距' },
      direction: { type: 'string', enum: ['row', 'column'], description: '排列方向' },
    },
  },
  {
    name: 'canvas_create_config_node',
    description: '创建生成配置节点，可指定 text/image/video/audio 模式和生成参数，可选择立即触发生成。',
    parameters: {
      prompt: { type: 'string', description: '提示词' },
      mode: { type: 'string', enum: ['text', 'image', 'video', 'audio'], description: '生成模式' },
      title: { type: 'string', description: '节点标题' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
      width: { type: 'number', description: '宽度' },
      height: { type: 'number', description: '高度' },
      autoRun: { type: 'boolean', description: '是否立即运行' },
      model: { type: 'string', description: '模型' },
      size: { type: 'string', description: '尺寸' },
      quality: { type: 'string', description: '质量' },
      count: { type: 'number', description: '数量' },
    },
  },

  // ========== 生成流程 ==========
  {
    name: 'canvas_create_image_prompt_flow',
    description: '创建提示词文本节点和图片生成配置节点，并自动连线，可选择立即触发生图。',
    parameters: {
      prompt: { type: 'string', required: true, description: '提示词' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
      autoRun: { type: 'boolean', description: '是否立即运行' },
      model: { type: 'string', description: '模型' },
      size: { type: 'string', description: '尺寸' },
      quality: { type: 'string', description: '质量' },
      count: { type: 'number', description: '数量' },
    },
  },
  {
    name: 'canvas_create_generation_flow',
    description: '创建通用生成流程：提示词文本节点、生成配置节点、参考节点连线，可用于文案、生图、视频或音频。',
    parameters: {
      prompt: { type: 'string', required: true, description: '提示词' },
      title: { type: 'string', description: '节点标题' },
      mode: { type: 'string', enum: ['text', 'image', 'video', 'audio'], description: '生成模式' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
      referenceNodeIds: { type: 'array', items: { type: 'string' }, description: '参考节点 ID' },
      autoRun: { type: 'boolean', description: '是否立即运行' },
    },
  },
  {
    name: 'canvas_generate_text',
    description: '创建通用文本生成流程并立即触发生成。',
    parameters: {
      prompt: { type: 'string', required: true, description: '提示词' },
      title: { type: 'string', description: '节点标题' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
      referenceNodeIds: { type: 'array', items: { type: 'string' }, description: '参考节点 ID' },
    },
  },
  {
    name: 'canvas_generate_image',
    description: '创建通用图片生成流程并立即触发生成。',
    parameters: {
      prompt: { type: 'string', required: true, description: '提示词' },
      title: { type: 'string', description: '节点标题' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
      referenceNodeIds: { type: 'array', items: { type: 'string' }, description: '参考节点 ID' },
      model: { type: 'string', description: '模型' },
      size: { type: 'string', description: '尺寸' },
      quality: { type: 'string', description: '质量' },
      count: { type: 'number', description: '数量' },
    },
  },
  {
    name: 'canvas_generate_video',
    description: '创建通用视频生成流程并立即触发生成。',
    parameters: {
      prompt: { type: 'string', required: true, description: '提示词' },
      title: { type: 'string', description: '节点标题' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
      referenceNodeIds: { type: 'array', items: { type: 'string' }, description: '参考节点 ID' },
      model: { type: 'string', description: '模型' },
      size: { type: 'string', description: '尺寸' },
      seconds: { type: 'string', description: '时长' },
    },
  },
  {
    name: 'canvas_generate_audio',
    description: '创建通用音频生成流程并立即触发生成。',
    parameters: {
      prompt: { type: 'string', required: true, description: '提示词' },
      title: { type: 'string', description: '节点标题' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
      referenceNodeIds: { type: 'array', items: { type: 'string' }, description: '参考节点 ID' },
      audioVoice: { type: 'string', description: '音色' },
      audioFormat: { type: 'string', description: '格式' },
      audioSpeed: { type: 'string', description: '语速' },
    },
  },

  // ========== 节点操作 ==========
  {
    name: 'canvas_update_node',
    description: '更新节点基础字段或 metadata。',
    parameters: {
      id: { type: 'string', required: true, description: '节点 ID' },
      patch: { type: 'object', description: '基础字段更新', additionalProperties: true },
      metadata: { type: 'object', description: '元数据更新', additionalProperties: true },
    },
  },
  {
    name: 'canvas_update_node_text',
    description: '更新文本节点内容和标题。',
    parameters: {
      id: { type: 'string', required: true, description: '节点 ID' },
      text: { type: 'string', required: true, description: '文本内容' },
      title: { type: 'string', description: '节点标题' },
    },
  },
  {
    name: 'canvas_move_nodes',
    description: '移动一个或多个节点，支持绝对坐标或 dx/dy 偏移。',
    parameters: {
      items: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: '移动项列表' },
    },
  },
  {
    name: 'canvas_resize_node',
    description: '调整节点尺寸。',
    parameters: {
      id: { type: 'string', required: true, description: '节点 ID' },
      width: { type: 'number', required: true, description: '宽度' },
      height: { type: 'number', required: true, description: '高度' },
      freeResize: { type: 'boolean', description: '自由调整' },
    },
  },
  {
    name: 'canvas_delete_nodes',
    description: '删除指定节点及相关连线。',
    parameters: {
      ids: { type: 'array', required: true, items: { type: 'string' }, description: '节点 ID 列表' },
    },
  },
  {
    name: 'canvas_connect_nodes',
    description: '批量连接节点。',
    parameters: {
      connections: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: '连接列表' },
    },
  },
  {
    name: 'canvas_select_nodes',
    description: '设置当前选中节点。',
    parameters: {
      ids: { type: 'array', required: true, items: { type: 'string' }, description: '节点 ID 列表' },
    },
  },
  {
    name: 'canvas_set_viewport',
    description: '调整画布视口。',
    parameters: {
      viewport: { type: 'object', required: true, description: '视口配置 {x, y, k}', additionalProperties: true },
    },
  },
  {
    name: 'canvas_run_generation',
    description: '触发指定节点生成，通常用于配置节点或文本/图片/视频/音频节点。',
    parameters: {
      nodeId: { type: 'string', required: true, description: '节点 ID' },
      mode: { type: 'string', enum: ['text', 'image', 'video', 'audio'], description: '生成模式' },
      prompt: { type: 'string', description: '覆盖提示词' },
    },
  },

  // ========== 生成状态 ==========
  {
    name: 'generation_get_status',
    description: '查询当前活动网页的生成任务状态。默认返回画布、生图工作台和视频工作台最近任务；可用 scope 过滤来源，用 taskId 查询工作台任务，用 nodeIds 查询画布节点。',
    parameters: {
      scope: { type: 'string', enum: ['all', 'canvas', 'image', 'video'], description: '查询范围' },
      taskId: { type: 'string', description: '任务 ID' },
      nodeIds: { type: 'array', items: { type: 'string' }, description: '节点 ID 列表' },
      limit: { type: 'number', description: '返回数量限制' },
    },
  },

  // ========== 工作台 ==========
  {
    name: 'workbench_image_get_config',
    description: '读取生图工作台的当前参数和可选项（可用模型、质量、尺寸/宽高比、张数范围），在调用 workbench_image_generate 前先了解可选值。',
    parameters: {},
  },
  {
    name: 'workbench_image_generate',
    description: '在生图工作台填入提示词并按需设置 model、quality、size（如 1:1 或 1024x1024）、count，run 默认 true 会自动点击生成按钮。会自动跳转到生图工作台。生成为异步过程，提交后返回 taskId，可用 generation_get_status 查询状态。',
    parameters: {
      prompt: { type: 'string', required: true, description: '提示词' },
      model: { type: 'string', description: '模型' },
      quality: { type: 'string', description: '质量' },
      size: { type: 'string', description: '尺寸' },
      count: { type: 'number', description: '数量' },
      run: { type: 'boolean', description: '是否立即运行' },
    },
  },
  {
    name: 'workbench_video_get_config',
    description: '读取视频创作台的当前参数和可选项（可用模型、尺寸/比例、时长、清晰度/分辨率、是否生成声音与水印）。',
    parameters: {},
  },
  {
    name: 'workbench_video_generate',
    description: '在视频创作台填入提示词并按需设置 model、size、seconds、resolution、generateAudio、watermark，run 默认 true 会自动点击生成按钮。会自动跳转到视频创作台。生成为异步过程，提交后返回 taskId，可用 generation_get_status 查询状态。',
    parameters: {
      prompt: { type: 'string', required: true, description: '提示词' },
      model: { type: 'string', description: '模型' },
      size: { type: 'string', description: '尺寸' },
      seconds: { type: 'string', description: '时长' },
      resolution: { type: 'string', description: '分辨率' },
      generateAudio: { type: 'boolean', description: '是否生成音频' },
      watermark: { type: 'boolean', description: '是否添加水印' },
      run: { type: 'boolean', description: '是否立即运行' },
    },
  },

  // ========== 提示词库 ==========
  {
    name: 'prompts_search',
    description: '搜索提示词库（第三方提示词合集），支持 keyword、category、tags 过滤和 page/pageSize 分页，返回标题、提示词、分类、标签、封面等。',
    parameters: {
      keyword: { type: 'string', description: '搜索关键词' },
      category: { type: 'string', description: '分类' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签' },
      page: { type: 'number', description: '页码' },
      pageSize: { type: 'number', description: '每页数量' },
    },
  },

  // ========== 素材库 ==========
  {
    name: 'assets_list',
    description: '列出用户「我的素材」，支持 kind（text/image/video）过滤、keyword 搜索和 page/pageSize 分页。为控制体积不返回图片/视频原始 data，仅返回封面与元信息。',
    parameters: {
      kind: { type: 'string', enum: ['all', 'text', 'image', 'video'], description: '素材类型' },
      keyword: { type: 'string', description: '搜索关键词' },
      page: { type: 'number', description: '页码' },
      pageSize: { type: 'number', description: '每页数量' },
    },
  },
  {
    name: 'assets_add',
    description: '向「我的素材」新增素材。kind=text 时用 content 传文本内容；kind=image 时用 imageUrl 传图片地址或 dataURL。',
    parameters: {
      kind: { type: 'string', required: true, enum: ['text', 'image'], description: '素材类型' },
      title: { type: 'string', required: true, description: '标题' },
      content: { type: 'string', description: '文本内容' },
      imageUrl: { type: 'string', description: '图片地址' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签' },
      source: { type: 'string', description: '来源' },
      note: { type: 'string', description: '备注' },
    },
  },

  // ========== 模板库 ==========
  {
    name: 'templates_search',
    description: `搜索画布模板库。

**参数**：query（关键词）、category（分类）、tags（标签）、limit（数量，默认10）

**分类**：服装鞋包、美妆护理、美味食品、家具家装、数码家电、珠宝首饰、宠物带货、剧情带货、海外电商、童装带货、母婴用品、美景旅游、汽车用品、贴身内衣、医疗健康、创意应用

**使用指南**：
1. 搜索后分析各模板的 nodeCount 差异
2. 调用 templates_get 获取候选模板详情
3. 分析各模板的工作流程差异（节点类型、处理阶段）
4. 用流程箭头展示各方案，让用户选择数字

**回复格式示例**：
有 3 种方案：
1.（5节点）：上传服装 → 生成穿版图 → 生成视频
2.（7节点）：上传服装+场景 → 场景融合 → 生成视频
3.（21节点）：固定模特+6套服装+场景 → 6张穿版图 → 换装视频
你想用哪个？回复 1、2 或 3

**展示规则**：
- ❌ 不要说"找到几个模板"
- ❌ 不要展示原始模板名称（爬取数据，可能不通顺）
- ❌ 不要展示查看量、解锁量等内部数据
- ✅ 用自己的语言描述模板特点和适用场景
- ✅ 如果只有一个合适的模板，直接推荐并询问是否创建`,
    parameters: {
      query: { type: 'string', description: '搜索关键词' },
      category: { type: 'string', description: '分类' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签' },
      limit: { type: 'number', description: '返回数量' },
    },
  },
  {
    name: 'templates_get',
    description: `获取模板详情，含完整画布数据（graph）。返回的 graph 为外部平台格式。

**模板创作原则**：
- 模板是参考，不是终点
- 分析模板的结构和逻辑，结合用户的具体产品和场景生成定制化内容

**基于模板创建工作流的步骤**：
1. 解析 graph 字段的 JSON
2. 分析模板结构：节点数量、类型分布、连线关系、工作流阶段
3. 保留模板的核心工作流结构（节点数量和连线逻辑），不要过度简化
4. 根据用户需求调整提示词内容（如风格、场景、产品特点）
5. 添加便签说明每个步骤的操作方法

**禁止过度简化**：
- 模板有 7 个节点，创建的工作流也应该有相近数量的节点
- 模板有多阶段处理（如：原图→平铺图→模特图→合成→视频），必须保留这些阶段
- 不能把复杂工作流简化成"上传→生成→完成"的简单三步

**两种场景**：
1. 用户需求明确 → 基于模板结构，定制提示词生成工作流
2. 用户需求不明确 → 使用 templates_import_to_canvas 直接导入模板`,
    parameters: {
      id: { type: 'string', required: true, description: '模板 ID' },
    },
  },
  {
    name: 'templates_categories',
    description: '获取所有模板分类列表，含分类名称、描述和模板数量。',
    parameters: {},
  },
  {
    name: 'templates_import_to_canvas',
    description: '将模板导入当前画布。会自动转换格式并在指定位置（默认画布右侧）创建模板中的所有节点和连线。仅在用户明确说「导入」时使用。',
    parameters: {
      id: { type: 'string', required: true, description: '模板 ID' },
      x: { type: 'number', description: 'x 坐标' },
      y: { type: 'number', description: 'y 坐标' },
    },
  },
]
