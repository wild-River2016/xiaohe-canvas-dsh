/**
 * DeepSeek Harness 插件 - 小禾画布
 * 
 * 通过 Canvas Agent HTTP API 操作小禾画布
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { spawn, execSync, type ChildProcess } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { toolDefinitions } from './tools.js'

export const name = 'xiaohe-canvas'
export const inject = ['tools']

export interface Config {
  apiUrl: string
  timeout: number
  autoStartAgent: boolean
}

/** 从 Canvas Agent 配置文件读取 connect token */
function readCanvasAgentToken(): string {
  try {
    const configPath = join(homedir(), '.infinite-canvas', 'canvas-agent.json')
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    return config.token || ''
  } catch {
    return ''
  }
}

// 默认配置
const defaultConfig: Config = {
  apiUrl: 'http://127.0.0.1:17371',
  timeout: 30000,
  autoStartAgent: true,
}

let canvasAgentProcess: ChildProcess | null = null

/** 检查命令是否存在 */
function commandExists(cmd: string): boolean {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'ignore' })
    } else {
      execSync(`which ${cmd}`, { stdio: 'ignore' })
    }
    return true
  } catch {
    return false
  }
}

/** 查找 canvas-agent 的可执行路径 */
function findCanvasAgentPath(): string | null {
  // 1. 检查全局安装的 canvas-agent（npm -g 或 pnpm -g）
  const globalPaths = [
    // npm global on Windows
    join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@xiaohe-store', 'canvas-agent'),
    // pnpm global
    join(homedir(), '.local', 'share', 'pnpm', 'global', '5', 'node_modules', '@xiaohe-store', 'canvas-agent'),
    // macOS/Linux npm global
    '/usr/local/lib/node_modules/@xiaohe-store/canvas-agent',
    // 用户自定义安装位置
    join(homedir(), '.infinite-canvas', 'agent', 'node_modules', '@xiaohe-store', 'canvas-agent'),
  ]
  
  for (const p of globalPaths) {
    const binPath = join(p, 'dist', 'cli.js')
    if (existsSync(binPath)) {
      return binPath
    }
  }
  
  return null
}

/** 查找可用的 Node.js 可执行文件 */
function findNodeExecutable(): string | null {
  // 1. 检查系统 PATH 中的 node
  if (commandExists('node')) {
    return 'node'
  }
  
  // 2. 检查 DSH 自带的 runtime（官方客户端）
  // DSH 运行时通常在 process.execPath 的上级目录
  const execDir = dirname(process.execPath)
  const possibleRuntimePaths = [
    join(execDir, 'runtime', 'bin', 'node.cmd'),
    join(execDir, 'runtime', 'bin', 'node'),
    join(execDir, '..', 'runtime', 'bin', 'node.cmd'),
    join(execDir, '..', 'runtime', 'bin', 'node'),
    join(execDir, '..', '..', 'runtime', 'bin', 'node.cmd'),
    join(execDir, '..', '..', 'runtime', 'bin', 'node'),
  ]
  
  for (const p of possibleRuntimePaths) {
    if (existsSync(p)) {
      return p
    }
  }
  
  return null
}

/** 查找 npx 可执行文件 */
function findNpxExecutable(): string | null {
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  if (commandExists(npxCmd)) {
    return npxCmd
  }
  return null
}

interface StartResult {
  success: boolean
  method: 'local' | 'npx' | 'none'
  error?: string
}

/**
 * 启动 Canvas Agent
 * 
 * 按优先级尝试以下方式：
 * 1. 使用已安装的 canvas-agent（最快）
 * 2. 使用 npx 下载并运行（需要 npm 环境）
 */
async function startCanvasAgent(dshToken?: string): Promise<StartResult> {
  console.log('[xiaohe-canvas] 正在启动 Canvas Agent...')
  
  // 方式 1: 尝试使用已安装的 canvas-agent
  const agentPath = findCanvasAgentPath()
  const nodePath = findNodeExecutable()
  
  if (agentPath && nodePath) {
    console.log(`[xiaohe-canvas] 找到已安装的 canvas-agent: ${agentPath}`)
    const result = await spawnAgent(nodePath, [agentPath, '--skip-codex'], dshToken)
    if (result.success) {
      return { success: true, method: 'local' }
    }
    console.warn('[xiaohe-canvas] 本地 canvas-agent 启动失败，尝试其他方式...')
  }
  
  // 方式 2: 尝试使用 npx
  const npxPath = findNpxExecutable()
  if (npxPath) {
    console.log('[xiaohe-canvas] 使用 npx 启动 canvas-agent...')
    const args = ['-y', '@xiaohe-store/canvas-agent', '--skip-codex']
    const result = await spawnAgent(npxPath, args, dshToken)
    if (result.success) {
      return { success: true, method: 'npx' }
    }
    console.warn('[xiaohe-canvas] npx 启动失败')
  }
  
  // 所有方式都失败
  const errorMsg = buildStartupErrorMessage(nodePath, npxPath, agentPath)
  return { success: false, method: 'none', error: errorMsg }
}

/** 构建启动失败的错误提示 */
function buildStartupErrorMessage(nodePath: string | null, npxPath: string | null, agentPath: string | null): string {
  const lines = ['Canvas Agent 自动启动失败。']
  
  if (!nodePath) {
    lines.push('  - 未找到 Node.js 运行时')
  }
  if (!npxPath) {
    lines.push('  - 未找到 npx 命令（npm 未安装或不在 PATH 中）')
  }
  if (!agentPath) {
    lines.push('  - 未找到已安装的 @xiaohe-store/canvas-agent')
  }
  
  lines.push('')
  lines.push('解决方法：')
  lines.push('  方法 1: 全局安装 canvas-agent')
  lines.push('    npm install -g @xiaohe-store/canvas-agent')
  lines.push('  方法 2: 手动启动')
  lines.push('    npx @xiaohe-store/canvas-agent')
  lines.push('  方法 3: 安装 Node.js 并确保 npx 在系统 PATH 中')
  
  return lines.join('\n')
}

/** 执行 Agent 进程 */
function spawnAgent(cmd: string, args: string[], dshToken?: string): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    // 如果有 dsh token，通过命令行参数传递
    const finalArgs = dshToken ? [...args, `--dsh-token=${dshToken}`] : args
    
    console.log(`[xiaohe-canvas] 执行: ${cmd} ${finalArgs.join(' ')}`)
    
    canvasAgentProcess = spawn(cmd, finalArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    })
    
    let started = false
    let hasError = false
    
    const timeout = setTimeout(() => {
      if (!started && !hasError) {
        started = true
        // 超时但进程还在运行，可能正在下载依赖，认为成功
        if (canvasAgentProcess && !canvasAgentProcess.killed) {
          console.log('[xiaohe-canvas] Canvas Agent 启动中（等待初始化）...')
          resolve({ success: true })
        } else {
          resolve({ success: false })
        }
      }
    }, 15000)
    
    canvasAgentProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      console.log('[canvas-agent]', output.trim())
      
      // 检测启动成功
      if (output.includes('listening') || output.includes('17371') || output.includes('started')) {
        if (!started) {
          started = true
          clearTimeout(timeout)
          console.log('[xiaohe-canvas] Canvas Agent 启动成功')
          resolve({ success: true })
        }
      }
    })
    
    canvasAgentProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString()
      // 忽略 npm 的警告信息
      if (!output.includes('npm WARN') && !output.includes('deprecated')) {
        console.error('[canvas-agent]', output.trim())
      }
    })
    
    canvasAgentProcess.on('error', (err) => {
      clearTimeout(timeout)
      if (!started) {
        hasError = true
        console.error('[xiaohe-canvas] 进程启动错误:', err.message)
        resolve({ success: false })
      }
    })
    
    canvasAgentProcess.on('exit', (code) => {
      clearTimeout(timeout)
      if (!started) {
        hasError = true
        console.log(`[xiaohe-canvas] Canvas Agent 进程退出，代码: ${code}`)
        resolve({ success: false })
      } else {
        console.log(`[xiaohe-canvas] Canvas Agent 进程退出，代码: ${code}`)
      }
      canvasAgentProcess = null
    })
  })
}

/**
 * 检查 Canvas Agent 是否可用
 */
async function checkCanvasAgent(config: Config): Promise<boolean> {
  try {
    const response = await fetch(`${config.apiUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * 调用 Canvas Agent HTTP API
 */
async function callCanvasApi(config: Config, toolName: string, input: Record<string, unknown>): Promise<unknown> {
  // 先检查 Canvas Agent 是否可用
  const isAvailable = await checkCanvasAgent(config)
  if (!isAvailable) {
    throw new Error(
      `Canvas Agent 未运行或无法连接 (${config.apiUrl})。\n` +
      `请确保：\n` +
      `1. 小禾画布网页已打开\n` +
      `2. Canvas Agent 正在运行（端口 17371）\n` +
      `3. 如需手动启动：npx @xiaohe-store/canvas-agent\n` +
      `4. 或全局安装：npm install -g @xiaohe-store/canvas-agent`
    )
  }
  
  // 读取 Canvas Agent 的 connect token
  const token = readCanvasAgentToken()
  const url = token 
    ? `${config.apiUrl}/api/tools?token=${encodeURIComponent(token)}`
    : `${config.apiUrl}/api/tools`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: toolName, input }),
    signal: AbortSignal.timeout(config.timeout),
  })
  
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Canvas API error (${response.status}): ${text}`)
  }
  
  const data = await response.json()
  
  if (data.error) {
    throw new Error(`Canvas tool error: ${data.error}`)
  }
  
  return data.result
}

/**
 * 插件入口
 */
export async function apply(ctx: Context, config: Partial<Config> = {}) {
  const finalConfig: Config = { ...defaultConfig, ...config }
  
  console.log('[xiaohe-canvas] 插件加载中...')
  console.log(`[xiaohe-canvas] API 地址: ${finalConfig.apiUrl}`)
  console.log(`[xiaohe-canvas] 自动启动: ${finalConfig.autoStartAgent}`)
  
  // 获取 dsh token（从环境变量）
  const dshToken = process.env.DSH_TOKEN || ''
  
  // 根据配置决定是否自动启动 Canvas Agent
  if (finalConfig.autoStartAgent) {
    // 先检查是否已经在运行
    const alreadyRunning = await checkCanvasAgent(finalConfig)
    if (alreadyRunning) {
      console.log('[xiaohe-canvas] Canvas Agent 已在运行')
    } else {
      const result = await startCanvasAgent(dshToken)
      if (!result.success) {
        console.error('[xiaohe-canvas] ' + (result.error || 'Canvas Agent 启动失败'))
        console.error('[xiaohe-canvas] 工具调用时将尝试连接，请确保手动启动 Canvas Agent')
      } else {
        console.log(`[xiaohe-canvas] Canvas Agent 启动成功 (方式: ${result.method})`)
      }
    }
  } else {
    console.log('[xiaohe-canvas] 已禁用自动启动，请手动启动 Canvas Agent')
  }
  
  // 注册清理函数，插件卸载时自动停止 Canvas Agent
  ctx.effect(() => {
    return () => {
      if (canvasAgentProcess) {
        console.log('[xiaohe-canvas] 插件卸载，停止 Canvas Agent...')
        canvasAgentProcess.kill()
        canvasAgentProcess = null
      }
    }
  })
  
  // 注册所有画布工具
  for (const tool of toolDefinitions) {
    ctx.tools.register(defineTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as any,
      output: {
        schema: { type: 'object', additionalProperties: true } as any,
        render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(args: any) {
        try {
          const result = await callCanvasApi(finalConfig, tool.name, args as Record<string, unknown>)
          return result as any
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { error: message } as any
        }
      },
    } as any))
  }
  
  console.log(`[xiaohe-canvas] 已注册 ${toolDefinitions.length} 个工具`)
}
