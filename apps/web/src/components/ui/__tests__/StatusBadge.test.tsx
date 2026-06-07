import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="running" />)
    expect(screen.getByText('running')).toBeInTheDocument()
  })

  it('applies green classes for running status', () => {
    render(<StatusBadge status="running" />)
    const badge = screen.getByText('running')
    expect(badge.className).toContain('green')
  })

  it('applies green classes for success status', () => {
    render(<StatusBadge status="success" />)
    const badge = screen.getByText('success')
    expect(badge.className).toContain('green')
  })

  it('applies red classes for error status', () => {
    render(<StatusBadge status="error" />)
    const badge = screen.getByText('error')
    expect(badge.className).toContain('red')
  })

  it('applies red classes for failed status', () => {
    render(<StatusBadge status="failed" />)
    const badge = screen.getByText('failed')
    expect(badge.className).toContain('red')
  })

  it('applies yellow classes for pending status', () => {
    render(<StatusBadge status="pending" />)
    const badge = screen.getByText('pending')
    expect(badge.className).toContain('yellow')
  })

  it('applies blue classes for deploying status', () => {
    render(<StatusBadge status="deploying" />)
    const badge = screen.getByText('deploying')
    expect(badge.className).toContain('blue')
  })

  it('applies zinc (neutral) classes for stopped status', () => {
    render(<StatusBadge status="stopped" />)
    const badge = screen.getByText('stopped')
    expect(badge.className).toContain('zinc')
  })

  it('falls back gracefully for unknown status', () => {
    render(<StatusBadge status="unknown-state" />)
    expect(screen.getByText('unknown-state')).toBeInTheDocument()
  })
})
