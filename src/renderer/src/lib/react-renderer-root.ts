import { createRoot, type Root } from 'react-dom/client'

type RendererRootHotData = {
  nightshiftRendererRoot?: Root
}

export function getOrCreateRendererRoot(
  container: HTMLElement,
  hotData?: RendererRootHotData
): Root {
  const existingRoot = hotData?.nightshiftRendererRoot
  if (existingRoot) {
    return existingRoot
  }
  const root = createRoot(container)
  if (hotData) {
    hotData.nightshiftRendererRoot = root
  }
  return root
}
