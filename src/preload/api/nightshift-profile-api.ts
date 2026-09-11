import type {
  ConnectCurrentNightshiftProfileResult,
  CreateCloudLinkedNightshiftProfileArgs,
  CreateCloudLinkedNightshiftProfileResult,
  CreateLocalNightshiftProfileArgs,
  CreateLocalNightshiftProfileResult,
  FindNightshiftProfileProjectsByPathArgs,
  FindNightshiftProfileProjectsByPathResult,
  NightshiftProfileAuthStatus,
  NightshiftProfileListResult,
  NightshiftProfileOrgInviteRevokeArgs,
  NightshiftProfileOrgMemberChangeRoleArgs,
  NightshiftProfileOrgMemberInviteArgs,
  NightshiftProfileOrgMemberMutationResult,
  NightshiftProfileOrgMemberRemoveArgs,
  NightshiftProfileOrgMembersListArgs,
  NightshiftProfileOrgMembersListResult,
  RefreshCurrentNightshiftProfileAuthResult,
  SelectNightshiftProfileOrgArgs,
  SelectNightshiftProfileOrgResult,
  SignOutCurrentNightshiftProfileResult,
  SwitchNightshiftProfileArgs,
  SwitchNightshiftProfileResult,
  TransferNightshiftProfileProjectArgs,
  TransferNightshiftProfileProjectResult
} from '../../shared/nightshift-profiles'

export type NightshiftProfileApi = {
  list: () => Promise<NightshiftProfileListResult>
  authStatus: () => Promise<NightshiftProfileAuthStatus>
  /** Fires when main changed the stored auth status on its own (e.g. a revoked session). */
  onAuthStatusChanged: (callback: () => void) => () => void
  createLocal: (
    args?: CreateLocalNightshiftProfileArgs
  ) => Promise<CreateLocalNightshiftProfileResult>
  createCloudLinked: (
    args?: CreateCloudLinkedNightshiftProfileArgs
  ) => Promise<CreateCloudLinkedNightshiftProfileResult>
  switchProfile: (args: SwitchNightshiftProfileArgs) => Promise<SwitchNightshiftProfileResult>
  transferProject: (
    args: TransferNightshiftProfileProjectArgs
  ) => Promise<TransferNightshiftProfileProjectResult>
  findProjectProfiles: (
    args: FindNightshiftProfileProjectsByPathArgs
  ) => Promise<FindNightshiftProfileProjectsByPathResult>
  connectCurrent: () => Promise<ConnectCurrentNightshiftProfileResult>
  refreshAuth: () => Promise<RefreshCurrentNightshiftProfileAuthResult>
  signOutCurrent: () => Promise<SignOutCurrentNightshiftProfileResult>
  selectOrg: (args: SelectNightshiftProfileOrgArgs) => Promise<SelectNightshiftProfileOrgResult>
  orgMembersList: (
    args: NightshiftProfileOrgMembersListArgs
  ) => Promise<NightshiftProfileOrgMembersListResult>
  orgMemberInvite: (
    args: NightshiftProfileOrgMemberInviteArgs
  ) => Promise<NightshiftProfileOrgMemberMutationResult>
  orgInviteRevoke: (
    args: NightshiftProfileOrgInviteRevokeArgs
  ) => Promise<NightshiftProfileOrgMemberMutationResult>
  orgMemberChangeRole: (
    args: NightshiftProfileOrgMemberChangeRoleArgs
  ) => Promise<NightshiftProfileOrgMemberMutationResult>
  orgMemberRemove: (
    args: NightshiftProfileOrgMemberRemoveArgs
  ) => Promise<NightshiftProfileOrgMemberMutationResult>
}
