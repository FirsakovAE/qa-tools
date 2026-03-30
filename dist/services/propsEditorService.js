import { getRuntimeAdapter } from '@/runtime';
import { isExpectedExtensionError } from '@/utils/expectedErrors';
// Реализация для реальных данных (работает через runtime adapter)
export class RealPropsEditorService {
    async sendToContentScript(message) {
        const runtime = getRuntimeAdapter();
        if (!runtime)
            throw new Error('Runtime adapter not available');
        try {
            const response = await runtime.sendMessage(message);
            return response;
        }
        catch (e) {
            if (!isExpectedExtensionError(e))
                console.error('[services/propsEditorService] sendToContentScript failed:', message?.type, e);
            throw e;
        }
    }
    async getComponentProps(componentUid) {
        try {
            const response = await this.sendToContentScript({
                type: 'GET_COMPONENT_PROPS',
                componentUid
            });
            return response?.props || null;
        }
        catch (error) {
            console.error('[services/propsEditorService] getComponentProps failed:', componentUid, error);
            return null;
        }
    }
    async updateComponentProps(componentUid, props, options) {
        try {
            // Сериализуем props чтобы избежать DataCloneError при postMessage
            // (Vue reactive объекты, прокси и т.д. не могут быть клонированы)
            const serializedProps = JSON.parse(JSON.stringify(props));
            const response = await this.sendToContentScript({
                type: 'UPDATE_COMPONENT_PROPS',
                componentUid,
                props: serializedProps,
                options
            });
            const success = response?.success || false;
            return success;
        }
        catch (error) {
            console.error('[services/propsEditorService] updateComponentProps failed:', componentUid, error);
            return false;
        }
    }
    async findComponentByUid(uid) {
        try {
            const response = await this.sendToContentScript({
                type: 'FIND_COMPONENT_BY_UID',
                uid
            });
            return response?.component || null;
        }
        catch (error) {
            console.error('[services/propsEditorService] findComponentByUid failed:', uid, error);
            return null;
        }
    }
}
// Фабрика для создания сервиса
export class PropsEditorServiceFactory {
    static createService() {
        try {
            return new RealPropsEditorService();
        }
        catch (e) {
            console.error('[services/propsEditorService] PropsEditorServiceFactory.createService failed:', e);
            throw e;
        }
    }
}
//# sourceMappingURL=propsEditorService.js.map