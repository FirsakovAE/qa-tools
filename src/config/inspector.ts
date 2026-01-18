export const InspectorConfig = {
    // Автообновление
    autoRefresh: {
        enabled: true,
        interval: 5000 // 5 секунд
    },

    // Логирование
    logging: {
        enabled: true,
        level: 'info' // 'debug', 'info', 'warn', 'error'
    },

    // Поиск
    search: {
        debounce: 300, // задержка в мс
        minLength: 2   // минимальная длина для поиска
    }
} as const