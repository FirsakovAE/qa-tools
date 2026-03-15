import { RealDataService } from './realDataService'
import type { TreeNodeModel } from '@/types/tree'
import type {TreeSearchOptions} from "../types/search.ts";

export interface TreeDataOptions {
    blacklist?: { active: string[]; inactive: string[] }
}

export interface DataService {
    getTreeData(search?: TreeSearchOptions, forceRefresh?: boolean, options?: TreeDataOptions): Promise<TreeNodeModel[]>
    refreshComponents?(): Promise<any[]>
}

export class DataServiceFactory {
    static createService(): DataService {
            return new RealDataService()
    }
}