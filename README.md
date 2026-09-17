# xiaohe-canvas-dsh

DeepSeek Harness 插件 - 小禾画布 AI 创作助手

让 DeepSeek Harness 能够操作小禾画布，帮助用户创作电商内容（图片、视频、工作流）。

## 功能

- 🎨 **画布操作**：创建、编辑、删除节点，管理连线和布局
- 📦 **模板库**：搜索和使用电商模板（服装、美妆、食品等 16 个分类）
- 🖼️ **AI 生成**：生成图片、视频、音频、文案
- 📚 **素材管理**：管理用户素材库

## 安装

```bash
# DSH Web 版
dsh plugin --profile web add xiaohe-canvas-dsh

# DSH Desktop 版
dsh plugin --profile desktop add xiaohe-canvas-dsh
```

> ⚠️ **注意**：安装完成后需要**重启 DSH**（不是刷新界面），插件才会生效。

## 使用

### 1. 启动 DeepSeek Harness

```bash
npx @deepseek-ai/dsh web
```

插件会自动启动 Canvas Agent。

### 2. 打开小禾画布

在浏览器中打开小禾画布网页，Canvas Agent 会自动连接。

### 3. 开始对话

在 DeepSeek Harness 中输入：

```
我是淘宝店主，主要卖童装，帮我创建一个带货视频的工作流
```

## 配置

插件配置在 `~/.dsh/profiles/web/cordis.patch.yml` 中：

```yaml
- insert:
    - id: xiaohe-canvas
      name: 'xiaohe-canvas-dsh'
      config:
        apiUrl: 'http://127.0.0.1:17371'
        timeout: 30000
        autoStartAgent: true
```

## 工具列表

插件提供 42 个工具，包括：

- 画布操作：创建/更新/删除节点、连线、布局
- AI 生成：图片、视频、音频、文案
- 模板库：搜索、导入模板
- 素材管理：列出、添加素材

## 卸载

```bash
dsh plugin --profile web remove xiaohe-canvas-dsh
```

## 相关项目

- [小禾画布](https://github.com/wild-River2016/drawspace) - AI 创作画布
- [Canvas Agent](https://www.npmjs.com/package/@xiaohe-store/canvas-agent) - 画布 MCP 服务
- [DeepSeek Harness](https://github.com/deepseek-ai/dsh) - DeepSeek 官方 Agent 运行时

## 许可证

MIT
