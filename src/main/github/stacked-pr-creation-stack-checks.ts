/**
 * Consistency checks against GitHub's stack API responses, split out of
 * `stacked-pr-creation.ts` to stay under the file's line budget. Pure move, no behaviour change.
 */
import type { CreateStackedHostedReviewResult } from '../../shared/hosted-review'
import { creationError } from './stacked-pr-creation'
import type { GitHubStack, NumberedHostedReviewSummary } from './github-stack-api-responses'

export function validateParentStack(
  parentReview: NumberedHostedReviewSummary,
  stacks: GitHubStack[]
): Extract<CreateStackedHostedReviewResult, { ok: false }> | null {
  if (stacks.length > 1) {
    return creationError('The selected parent pull request belongs to multiple stacks.')
  }
  const stack = stacks[0]
  if (!stack) {
    return null
  }
  if (!stack.open) {
    return creationError('The selected parent belongs to a closed stack.')
  }
  if (stack.pull_requests.at(-1)?.number !== parentReview.number) {
    return creationError(
      'Choose the top pull request in the stack as the base branch before adding another layer.'
    )
  }
  return null
}

export function registeredStackNumber(
  parentReview: NumberedHostedReviewSummary,
  currentReview: NumberedHostedReviewSummary,
  parentStacks: GitHubStack[],
  currentStacks: GitHubStack[]
): number | null {
  const parentStack = parentStacks[0]
  const currentStack = currentStacks[0]
  if (!parentStack || !currentStack || parentStack.number !== currentStack.number) {
    return null
  }
  const parentPosition = parentStack.pull_requests.findIndex(
    (pullRequest) => pullRequest.number === parentReview.number
  )
  // Why: a miss is -1, and -1 + 1 reads the first entry — which reports "already
  // registered" whenever the current PR heads a stack the parent has left.
  if (parentPosition === -1) {
    return null
  }
  return parentStack.pull_requests[parentPosition + 1]?.number === currentReview.number
    ? parentStack.number
    : null
}
