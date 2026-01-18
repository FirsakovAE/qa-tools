export interface PiniaStoreNode {
  id: string
  name: string
  stateCount: number
  getterKeys: number
  hasState: boolean
  hasGetters: boolean
  data: {
    id: string
    state: Record<string, any>
    getters: Record<string, any>
    piniaMethods: string[]
  }
}
