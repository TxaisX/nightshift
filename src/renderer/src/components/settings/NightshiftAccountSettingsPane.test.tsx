// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  fetchAuthStatus: vi.fn(),
  signOut: vi.fn(),
  state: {
    nightshiftProfileAuthStatus: {
      configured: true,
      state: 'connected',
      cloud: { displayName: 'Ada Lovelace', email: 'ada@example.com' }
    } as Record<string, unknown> | null,
    nightshiftProfileConnecting: false
  }
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      ...mocks.state,
      connectCurrentNightshiftProfile: mocks.connect,
      fetchNightshiftProfileAuthStatus: mocks.fetchAuthStatus,
      signOutCurrentNightshiftProfile: mocks.signOut
    })
}))

vi.mock('../nightshift-profiles/NightshiftProfileSignOutConfirmDialog', () => ({
  NightshiftProfileSignOutConfirmDialog: ({
    open,
    onConfirm
  }: {
    open: boolean
    onConfirm: () => void
    children?: ReactNode
  }) => (open ? <button onClick={onConfirm}>Confirm sign out</button> : null)
}))

import { NightshiftAccountSettingsPane } from './NightshiftAccountSettingsPane'

describe('NightshiftAccountSettingsPane', () => {
  beforeEach(() => {
    mocks.connect.mockReset()
    mocks.fetchAuthStatus.mockReset()
    mocks.signOut.mockReset()
    mocks.signOut.mockResolvedValue({ status: 'signed-out' })
    mocks.state.nightshiftProfileAuthStatus = {
      configured: true,
      state: 'connected',
      cloud: { displayName: 'Ada Lovelace', email: 'ada@example.com' }
    }
    mocks.state.nightshiftProfileConnecting = false
  })

  afterEach(cleanup)

  it('shows the connected identity and confirms sign out', async () => {
    const user = userEvent.setup()
    render(<NightshiftAccountSettingsPane />)

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('Artifact sharing')).toBeInTheDocument()
    expect(screen.getByText('Nightshift Relay')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await user.click(screen.getByRole('button', { name: 'Confirm sign out' }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('offers sign in for a local profile', async () => {
    const user = userEvent.setup()
    mocks.state.nightshiftProfileAuthStatus = { configured: true, state: 'local' }
    render(<NightshiftAccountSettingsPane />)

    expect(
      screen.getByText(
        'Sign in to extend Nightshift with cloud features, including Artifacts and Nightshift Relay.'
      )
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign in to Nightshift' }))
    expect(mocks.connect).toHaveBeenCalledOnce()
  })

  it('loads account status when it is not hydrated yet', () => {
    mocks.state.nightshiftProfileAuthStatus = null
    render(<NightshiftAccountSettingsPane />)

    expect(mocks.fetchAuthStatus).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Sign in to Nightshift' })).toBeDisabled()
  })
})
