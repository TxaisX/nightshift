// Sample Nightshift plugin worker entry. Runs inside the out-of-process plugin
// worker (plain Node, no Electron), forked lazily on the first trigger. The
// default export receives the `nightshift` API: command registration, event
// handlers, and the capability-gated host API.
export default function activate(nightshift) {
  nightshift.commands.register('hello-ping', async (args) => {
    const stored = await nightshift.host.call('storage.get', { key: 'pings' })
    const count = (typeof stored?.value === 'number' ? stored.value : 0) + 1
    await nightshift.host.call('storage.set', { key: 'pings', value: count })
    return { pong: true, count, args: args ?? null }
  })

  nightshift.events.on('worktree.created', async (payload) => {
    nightshift.log(`worktree created: ${payload.worktreeId} at ${payload.path}`)
    await nightshift.host.call('notifications.show', {
      title: 'Worktree created',
      body: payload.path
    })
  })

  nightshift.events.on('agent.status.changed', (payload) => {
    nightshift.log(`agent status: ${payload.state} in ${payload.worktreeId ?? 'unknown worktree'}`)
  })
}
