import type { TreeNodeModel } from '@/types/tree'
import { getRuntimeAdapter } from '@/runtime'

// Интерфейс для редактирования пропсов
export interface PropsEditorService {
    // Получить пропсы компонента
    getComponentProps(componentUid: string): Promise<Record<string, any> | null>

    // Обновить пропсы компонента
    updateComponentProps(
        componentUid: string,
        props: Record<string, any>,
        options?: UpdateOptions
    ): Promise<boolean>

    // Найти компонент по UID
    findComponentByUid(uid: string): Promise<any | null>
}

export interface UpdateOptions {
    silent?: boolean // Не показывать уведомления
    deepUpdate?: boolean // Попытаться обновить вложенные объекты
}

// Реализация для реальных данных (работает через runtime adapter)
export class RealPropsEditorService implements PropsEditorService {
    private async sendToContentScript(message: any): Promise<any> {
        const runtime = getRuntimeAdapter()
        if (!runtime) {
            throw new Error('Runtime adapter not available')
        }
        const response = await runtime.sendMessage(message)
        return response
    }

    async getComponentProps(componentUid: string): Promise<Record<string, any> | null> {
        try {
            const response = await this.sendToContentScript({
                type: 'GET_COMPONENT_PROPS',
                componentUid
            })

            return response?.props || null
        } catch (error) {
            return null
        }
    }

    async updateComponentProps(
        componentUid: string,
        props: Record<string, any>,
        options?: UpdateOptions
    ): Promise<boolean> {
        
        try {
            // Сериализуем props чтобы избежать DataCloneError при postMessage
            // (Vue reactive объекты, прокси и т.д. не могут быть клонированы)
            const serializedProps = JSON.parse(JSON.stringify(props))
            
            const response = await this.sendToContentScript({
                type: 'UPDATE_COMPONENT_PROPS',
                componentUid,
                props: serializedProps,
                options
            })

            const success = response?.success || false
            
            return success
        } catch (error) {
            return false
        }
    }

    async findComponentByUid(uid: string): Promise<any | null> {
        try {
            const response = await this.sendToContentScript({
                type: 'FIND_COMPONENT_BY_UID',
                uid
            })

            return response?.component || null
        } catch (error) {
            return null
        }
    }
}


// Фабрика для создания сервиса
export class PropsEditorServiceFactory {
    static createService(): PropsEditorService {
        return new RealPropsEditorService()
    }
}