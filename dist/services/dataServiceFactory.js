import { RealDataService } from './realDataService';
export class DataServiceFactory {
    static createService() {
        try {
            return new RealDataService();
        }
        catch (e) {
            console.error('[services/dataServiceFactory] createService failed:', e);
            throw e;
        }
    }
}
//# sourceMappingURL=dataServiceFactory.js.map