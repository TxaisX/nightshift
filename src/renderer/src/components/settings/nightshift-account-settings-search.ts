import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'

export const getNightshiftAccountSettingsSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.nightshiftAccount.account', 'Nightshift account'),
    description: translate(
      'auto.components.settings.nightshiftAccount.searchDescription',
      'Sign in or out of the account used by Artifacts and Nightshift Relay.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.nightshiftAccount.keywordAccount',
        'account'
      ),
      ...translateSearchKeyword('auto.components.settings.nightshiftAccount.keywordLogin', 'login'),
      ...translateSearchKeyword(
        'auto.components.settings.nightshiftAccount.keywordLogout',
        'logout'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.nightshiftAccount.keywordSignIn',
        'sign in'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.nightshiftAccount.keywordSignOut',
        'sign out'
      ),
      ...translateSearchKeyword('auto.components.settings.nightshiftAccount.keywordRelay', 'relay'),
      ...translateSearchKeyword('auto.components.settings.nightshiftAccount.keywordCloud', 'cloud')
    ]
  }
])
