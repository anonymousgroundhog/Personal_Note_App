import { useUiStore } from '../stores/uiStore'

export interface SectionDef {
  id: string
  label: string
  description?: string
  defaultVisible?: boolean
}

export function useSectionVisibility(namespace: string, sections: SectionDef[]) {
  const { hiddenPanels, setPanelHidden, resetPanels } = useUiStore()

  function isVisible(id: string): boolean {
    const def = sections.find(s => s.id === id)
    const defaultVisible = def?.defaultVisible ?? true
    const key = `${namespace}:${id}`
    if (hiddenPanels.includes(key)) return false
    return defaultVisible
  }

  function toggle(id: string) {
    const key = `${namespace}:${id}`
    setPanelHidden(key, isVisible(id))
  }

  return {
    isVisible,
    toggle,
    resetAll: () => resetPanels(namespace),
    sections,
    namespace,
  }
}
