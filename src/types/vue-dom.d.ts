// Расширяем тип HTMLElement для Vue-инстансов
interface HTMLElement {
    __vue__?: any        // Vue 2
    __vue_app__?: {
        _instance?: any
        _container?: HTMLElement
    }                     // Vue 3
    _vnode?: any
}

// Глобальные объекты для инспекторов и редакторов пропсов
interface Window {
    __VUE_ELEMENT_INSPECTOR?: any
    __VUE_PROPS_EDITOR?: any
}
