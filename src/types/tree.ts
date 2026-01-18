export interface TreeNodeModel {
    id: string
    name: string
    label?: string
    props?: Record<string, any>
    jsonProps?: string
    timestamp?: string
    children?: TreeNodeModel[]
    rootElement?: {
        tagName: string
        className?: string
        id?: string
        testId?: string
    }
    // Добавлено для RealPropsEditor
    componentUid?: string
    element?: {
        tagName: string
        className?: string
        id?: string
        testId?: string
    } | HTMLElement
    hasProps?: boolean
    propsCount?: number
}
