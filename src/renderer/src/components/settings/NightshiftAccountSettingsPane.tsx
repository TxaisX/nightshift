import { useState } from 'react'
import { BookOpen, Check, CircleUserRound, Files, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNightshiftProfileAuthStatusRefresh } from '@/hooks/use-nightshift-profile-auth-status-refresh'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { NightshiftProfileSignOutConfirmDialog } from '../nightshift-profiles/NightshiftProfileSignOutConfirmDialog'

function accountStatusCopy(
  state: 'local' | 'unconfigured' | 'connected' | 'reconnect-required' | undefined,
  email: string | undefined
): string {
  if (state === 'connected') {
    return email ?? translate('auto.components.settings.nightshiftAccount.connected', 'Connected')
  }
  if (state === 'reconnect-required') {
    return translate(
      'auto.components.settings.nightshiftAccount.reconnectRequired',
      'Your session expired. Sign in again to use cloud features.'
    )
  }
  if (state === 'unconfigured') {
    return translate(
      'auto.components.settings.nightshiftAccount.unavailable',
      'Nightshift sign-in is unavailable in this build.'
    )
  }
  if (state === 'local') {
    return translate(
      'auto.components.settings.nightshiftAccount.signedOut',
      'Sign in to extend Nightshift with cloud features, including Artifacts and Nightshift Relay.'
    )
  }
  return translate(
    'auto.components.settings.nightshiftAccount.checking',
    'Checking account status…'
  )
}

function AccountBenefit({
  icon: Icon,
  title,
  description,
  className
}: {
  icon: typeof Files
  title: string
  description: string
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function NightshiftAccountSettingsPane(): React.JSX.Element {
  const authStatus = useAppStore((state) => state.nightshiftProfileAuthStatus)
  const connecting = useAppStore((state) => state.nightshiftProfileConnecting)
  const connect = useAppStore((state) => state.connectCurrentNightshiftProfile)
  const signOut = useAppStore((state) => state.signOutCurrentNightshiftProfile)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const connected = authStatus?.state === 'connected'
  const canConnect = authStatus?.configured === true

  useNightshiftProfileAuthStatusRefresh()

  const confirmSignOut = async (): Promise<void> => {
    if (signingOut) {
      return
    }
    setSigningOut(true)
    const result = await signOut()
    setSigningOut(false)
    if (result) {
      setSignOutOpen(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CircleUserRound className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">
                {authStatus?.cloud?.displayName?.trim() ||
                  translate(
                    'auto.components.settings.nightshiftAccount.account',
                    'Nightshift account'
                  )}
              </p>
              {connected ? (
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  <Check />
                  {translate('auto.components.settings.nightshiftAccount.connected', 'Connected')}
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {accountStatusCopy(authStatus?.state, authStatus?.cloud?.email)}
            </p>
          </div>
          {connected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={signingOut}
              onClick={() => setSignOutOpen(true)}
            >
              {translate('auto.components.settings.nightshiftAccount.signOut', 'Sign out')}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!canConnect || connecting}
              onClick={() => void connect()}
            >
              {connecting
                ? translate('auto.components.settings.nightshiftAccount.signingIn', 'Signing in…')
                : authStatus?.state === 'reconnect-required'
                  ? translate(
                      'auto.components.settings.nightshiftAccount.signInAgain',
                      'Sign in again'
                    )
                  : translate(
                      'auto.components.settings.nightshiftAccount.signIn',
                      'Sign in to Nightshift'
                    )}
            </Button>
          )}
        </div>

        <div className="space-y-4 border-t border-border/60 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {translate(
              'auto.components.settings.nightshiftAccount.benefitsTitle',
              'Included with your account'
            )}
          </p>
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2 md:gap-0 md:divide-x md:divide-border/60">
              <AccountBenefit
                icon={Files}
                className="md:pr-6"
                title={translate(
                  'auto.components.settings.nightshiftAccount.artifactsTitle',
                  'Artifact sharing'
                )}
                description={translate(
                  'auto.components.settings.nightshiftAccount.artifactsDescription',
                  'Publish HTML and Markdown files, then manage every shared link from Nightshift.'
                )}
              />
              <AccountBenefit
                icon={Smartphone}
                className="md:pl-6"
                title={translate(
                  'auto.components.settings.nightshiftAccount.relayTitle',
                  'Nightshift Relay'
                )}
                description={translate(
                  'auto.components.settings.nightshiftAccount.relayDescription',
                  'Connect Nightshift Mobile to this desktop across cellular or any Wi-Fi.'
                )}
              />
            </div>
            {/* Why: a third column would squeeze all three; a full-width row
                below keeps the pair's divider and reads as one list. */}
            <AccountBenefit
              icon={BookOpen}
              className="border-t border-border/60 pt-5"
              title={translate(
                'auto.components.settings.nightshiftAccount.skillsTitle',
                'Skill sharing'
              )}
              description={translate(
                'auto.components.settings.nightshiftAccount.skillsDescription',
                'Share one skill or a whole set behind an unlisted link, and install them on any machine you use.'
              )}
            />
          </div>
        </div>
      </div>

      <NightshiftProfileSignOutConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        onConfirm={() => void confirmSignOut()}
        signingOut={signingOut}
      />
    </>
  )
}
