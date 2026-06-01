export type AppStatus = 'stopped' | 'running' | 'error' | 'deploying'
export type DeploymentStatus = 'pending' | 'running' | 'success' | 'failed'
export type TriggerType = 'manual' | 'webhook' | 'system'
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface Application {
  id: string
  name: string
  description?: string | null
  dockerImage: string
  containerName: string
  internalPort: number
  externalPort: number
  environment: Record<string, string>
  status: AppStatus
  webhookSecret?: string | null
  createdAt: string
  updatedAt: string
  _count?: { deployments: number }
}

export interface Deployment {
  id: string
  applicationId: string
  status: DeploymentStatus
  triggerType: TriggerType
  startedAt: string
  finishedAt?: string | null
  summary?: string | null
  errorMessage?: string | null
  application?: { name: string }
}

export interface DeploymentLog {
  id: string
  deploymentId: string
  level: LogLevel
  message: string
  timestamp: string
}

export interface MonitoringSummary {
  totalApps: number
  runningApps: number
  stoppedApps: number
  errorApps: number
  failedDeployments: number
  runningContainers: number
  recentDeployments: Deployment[]
}
