export type BattleLinesInteractionHandle = {
  destroy: () => void
}

export function attachBattleLinesInteraction(_canvas: HTMLCanvasElement): BattleLinesInteractionHandle {
  return {
    destroy() {
      // Reserved for hover / hit-test / drag interactions in a later PR.
    }
  }
}
