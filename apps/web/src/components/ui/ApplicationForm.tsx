'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Application } from '@deployforge/shared'

type EnvEntry = { key: string; value: string }

function envToEntries(env: Record<string, string>): EnvEntry[] {
  return Object.entries(env).map(([key, value]) => ({ key, value }))
}

function entriesToEnv(entries: EnvEntry[]): Record<string, string> {
  return Object.fromEntries(entries.filter((e) => e.key.trim()).map((e) => [e.key.trim(), e.value]))
}

export function ApplicationForm({ initialData }: { initialData?: Application }) {
  const router = useRouter()
  const isEdit = !!initialData

  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    dockerImage: initialData?.dockerImage ?? '',
    containerName: initialData?.containerName ?? '',
    internalPort: String(initialData?.internalPort ?? 80),
    externalPort: String(initialData?.externalPort ?? 8080),
    webhookSecret: '',
  })
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>(
    initialData?.environment ? envToEntries(initialData.environment) : [],
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function addEnvRow() {
    setEnvEntries((e) => [...e, { key: '', value: '' }])
  }

  function updateEnvRow(i: number, field: 'key' | 'value', value: string) {
    setEnvEntries((e) => e.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  }

  function removeEnvRow(i: number) {
    setEnvEntries((e) => e.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        dockerImage: form.dockerImage,
        containerName: form.containerName,
        internalPort: parseInt(form.internalPort, 10),
        externalPort: parseInt(form.externalPort, 10),
        environment: entriesToEnv(envEntries),
        ...(form.webhookSecret ? { webhookSecret: form.webhookSecret } : {}),
      }
      if (isEdit) {
        await api.applications.update(initialData.id, payload)
        router.push(`/applications/${initialData.id}`)
      } else {
        const app = await api.applications.create(payload)
        router.push(`/applications/${app.id}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-400 bg-red-950 border border-red-800 rounded p-3">{error}</div>
      )}

      <Field label="Name" required>
        <input
          className="input"
          value={form.name}
          onChange={set('name')}
          placeholder="my-app"
          pattern="[a-z0-9-]+"
          required
          disabled={isEdit}
        />
      </Field>

      <Field label="Description">
        <textarea
          className="input resize-none"
          rows={2}
          value={form.description}
          onChange={set('description')}
          placeholder="Optional"
        />
      </Field>

      <Field label="Docker Image" required>
        <input
          className="input font-mono text-sm"
          value={form.dockerImage}
          onChange={set('dockerImage')}
          placeholder="nginx:latest"
          required
        />
      </Field>

      <Field label="Container Name" required>
        <input
          className="input font-mono text-sm"
          value={form.containerName}
          onChange={set('containerName')}
          placeholder="my-app-container"
          pattern="[a-z0-9_-]+"
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Internal Port" required>
          <input className="input" type="number" value={form.internalPort} onChange={set('internalPort')} required />
        </Field>
        <Field label="External Port" required>
          <input className="input" type="number" value={form.externalPort} onChange={set('externalPort')} required />
        </Field>
      </div>

      <Field label="Webhook Secret (optional)">
        <input
          className="input font-mono text-sm"
          value={form.webhookSecret}
          onChange={set('webhookSecret')}
          placeholder="Min 16 characters"
          minLength={16}
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-zinc-400">Environment Variables</label>
          <button type="button" onClick={addEnvRow} className="text-xs text-blue-400 hover:text-blue-300">
            + Add
          </button>
        </div>
        {envEntries.map((row, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              className="input flex-1 font-mono text-xs"
              placeholder="KEY"
              value={row.key}
              onChange={(e) => updateEnvRow(i, 'key', e.target.value)}
            />
            <input
              className="input flex-1 font-mono text-xs"
              placeholder="value"
              value={row.value}
              onChange={(e) => updateEnvRow(i, 'value', e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeEnvRow(i)}
              className="text-zinc-600 hover:text-red-400 text-sm"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Application'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-400 text-sm rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1">
        {label}{required && <span className="text-zinc-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
