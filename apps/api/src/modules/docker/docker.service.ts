import { execFile } from 'child_process'
import { promisify } from 'util'
import type { PrismaClient, Application } from '@prisma/client'

const execFileAsync = promisify(execFile)

// Safe wrapper — only fixed templates, never raw user strings in shell position
async function dockerCmd(...args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('docker', args, { timeout: 60_000 })
}

export class DockerService {
  constructor(private prisma: PrismaClient) {}

  private async log(deploymentId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string) {
    await this.prisma.deploymentLog.create({
      data: { deploymentId, level, message },
    })
  }

  async deploy(application: Application, deploymentId: string, isRestart = false) {
    const { containerName, dockerImage, externalPort, internalPort, environment } = application

    const addLog = (level: 'info' | 'warn' | 'error' | 'debug', msg: string) =>
      this.log(deploymentId, level, msg)

    try {
      await addLog('info', `Starting deploy of ${dockerImage}`)

      // Pull image
      await addLog('info', `Pulling image: ${dockerImage}`)
      await dockerCmd('pull', dockerImage)
      await addLog('info', 'Image pulled successfully')

      // Stop + remove existing container if present
      try {
        await dockerCmd('stop', containerName)
        await dockerCmd('rm', containerName)
        await addLog('info', `Removed existing container: ${containerName}`)
      } catch {
        // container may not exist — ignore
      }

      // Build env args from stored JSON record
      const envRecord = (typeof environment === 'object' && environment !== null)
        ? environment as Record<string, string>
        : {}

      const envArgs = Object.entries(envRecord).flatMap(([k, v]) => ['-e', `${k}=${v}`])

      // Run container
      await addLog('info', `Starting container: ${containerName}`)
      await dockerCmd(
        'run', '-d',
        '--name', containerName,
        '-p', `${externalPort}:${internalPort}`,
        '--restart', 'unless-stopped',
        ...envArgs,
        dockerImage,
      )
      await addLog('info', 'Container started successfully')

      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'success', finishedAt: new Date(), summary: 'Deployed successfully' },
      })
      await this.prisma.application.update({
        where: { id: application.id },
        data: { status: 'running' },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await addLog('error', `Deploy failed: ${message}`)
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'failed', finishedAt: new Date(), errorMessage: message },
      })
      await this.prisma.application.update({
        where: { id: application.id },
        data: { status: 'error' },
      })
    }
  }

  async stop(application: Application) {
    const { containerName } = application
    try {
      await dockerCmd('stop', containerName)
      await this.prisma.application.update({
        where: { id: application.id },
        data: { status: 'stopped' },
      })
      return { success: true, message: `Container ${containerName} stopped` }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message }
    }
  }

  async inspect(containerName: string) {
    try {
      const { stdout } = await dockerCmd('inspect', containerName)
      return JSON.parse(stdout)[0] ?? null
    } catch {
      return null
    }
  }

  async containerStats() {
    try {
      const { stdout } = await dockerCmd(
        'stats', '--no-stream', '--format',
        '{{json .}}',
      )
      return stdout.trim().split('\n').map((line) => JSON.parse(line))
    } catch {
      return []
    }
  }

  async listRunningContainers(): Promise<string[]> {
    try {
      const { stdout } = await dockerCmd('ps', '--format', '{{.Names}}')
      return stdout.trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }
}
