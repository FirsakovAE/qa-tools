export interface TreeNodeModel {
    id: string
    name: string
    label?: string
    props?: Record<string, any>
    /** Raw props (declared) for Declared section - all keys including undefined */
    rawProps?: Record<string, any>
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
    /** Count of props with defined values (passed), for display as passed/declared */
    propsCountPassed?: number
}
