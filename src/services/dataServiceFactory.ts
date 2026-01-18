import { RealDataService } from './realDataService'
import type { TreeNodeModel } from '@/types/tree'
import type {TreeSearchOptions} from "../types/search.ts";

export interface DataService {
    getTreeData(search?: TreeSearchOptions): Promise<TreeNodeModel[]>
    refreshComponents?(): Promise<any[]>
}

export class DataServiceFactory {
    static createService(): DataService {
            return new RealDataService()
    }
}