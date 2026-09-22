/**
 * DeepSeek Harness 插件 - 小禾画布
 * 
 * 通过 Canvas Agent HTTP API 操作小禾画布
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { spawn, type ChildProcess } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { toolDefinitions } from './tools.js'

export const name = 'xiaohe-canvas'
export const inject = ['tools']

export interface Config {
  apiUrl: string
  timeout: number
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

// 不导出 Config schema，使用默认配置
const defaultConfig: Config = {
  apiUrl: 'http://127.0.0.1:17371',
  timeout: 30000,
}

let canvasAgentProcess: ChildProcess | null = null

/**
 * 启动 Canvas Agent
 */
async function startCanvasAgent(dshToken?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[xiaohe-canvas] 启动 Canvas Agent...')
    
    // 使用 npx 启动 canvas-agent，传入 --skip-codex 跳过 Codex 初始化
    // 不使用 shell 以避免安全警告
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const args = ['-y', '@xiaohe-store/canvas-agent', '--skip-codex']
    
    // 如果有 dsh token，通过命令行参数传递
    if (dshToken) {
      args.push(`--dsh-token=${dshToken}`)
    }
    
    canvasAgentProcess = spawn(npxCmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,  // Windows + Node 24 需要 shell: true 才能执行 .cmd 文件
    })
    
    let started = false
    const timeout = setTimeout(() => {
      if (!started) {
        started = true
        // 超时后警告用户
        console.warn('[xiaohe-canvas] ⚠️ Canvas Agent 启动超时（10秒）')
        console.warn('[xiaohe-canvas] 请检查：')
        console.warn('[xiaohe-canvas]   1. 小禾画布网页是否已打开')
        console.warn('[xiaohe-canvas]   2. 端口 17371 是否被占用')
        console.warn('[xiaohe-canvas]   3. 可手动运行: npx @xiaohe-store/canvas-agent')
        resolve()
      }
    }, 10000)
    
    canvasAgentProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      console.log('[canvas-agent]', output.trim())
      
      // 检测启动成功
      if (output.includes('listening') || output.includes('17371') || output.includes('started')) {
        if (!started) {
          started = true
          clearTimeout(timeout)
          console.log('[xiaohe-canvas] Canvas Agent 启动成功')
          resolve()
        }
      }
    })
    
    canvasAgentProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[canvas-agent]', data.toString().trim())
    })
    
    canvasAgentProcess.on('error', (err) => {
      clearTimeout(timeout)
      if (!started) {
        started = true
        console.error('[xiaohe-canvas] Canvas Agent 启动失败:', err.message)
        reject(err)
      }
    })
    
    canvasAgentProcess.on('exit', (code) => {
      console.log(`[xiaohe-canvas] Canvas Agent 退出，代码: ${code}`)
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
      `3. 如需手动启动：npx @xiaohe-store/canvas-agent`
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
  
  // 获取 dsh token（从环境变量）
  const dshToken = process.env.DSH_TOKEN || ''
  
  // 启动 Canvas Agent
  try {
    await startCanvasAgent(dshToken)
  } catch (err) {
    console.error('[xiaohe-canvas] Canvas Agent 启动失败，工具可能无法正常工作')
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
