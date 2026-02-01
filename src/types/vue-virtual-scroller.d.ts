declare module 'vue-virtual-scroller' {
  import { DefineComponent } from 'vue'

  export interface RecycleScrollerProps {
    items: any[]
    itemSize?: number | null
    keyField?: string
    direction?: 'vertical' | 'horizontal'
    buffer?: number
    pageMode?: boolean
    prerender?: number
    emitUpdate?: boolean
    listTag?: string
    itemTag?: string
  }

  export const RecycleScroller: DefineComponent<RecycleScrollerProps>
  export const DynamicScroller: DefineComponent<any>
  export const DynamicScrollerItem: DefineComponent<any>
}
