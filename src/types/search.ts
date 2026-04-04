export interface TreeSearchOptions {
    term: string
    byName: boolean
    byLabel: boolean
    byRootElement: boolean
    byKey: boolean
}

/** Filter Props to components within a specific root element (from Inspect picker) */
export interface TreeRootFilter {
    /** UID of the root component's element - only show this component and its descendants */
    rootElementUid: number
}
