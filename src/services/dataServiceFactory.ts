import { RealDataService } from './realDataService'
import type { TreeNodeModel } from '@/types/tree'
import type { TreeSearchOptions, TreeRootFilter } from '../types/search'

export interface TreeDataOptions {
    blacklist?: { active: string[]; inactive: string[] }
    rootFilter?: TreeRootFilter
}

export interface DataService {
    getTreeData(search?: TreeSearchOptions, forceRefresh?: boolean, options?: TreeDataOptions): Promise<TreeNodeModel[]>
    refreshComponents?(): Promise<any[]>
}

export class DataServiceFactory {
    static createService(): DataService {
        try {
            return new RealDataService()
        } catch (e) {
            console.error('[services/dataServiceFactory] createService failed:', e)
            throw e
        }
    }
}