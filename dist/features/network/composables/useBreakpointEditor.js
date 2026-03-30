import { ref, computed, watch } from 'vue';
import { formatJson } from '../utils';
export function useBreakpointEditor(options) {
    const { entry, breakpointMode, breakpointTrigger, breakpointDraft, emitUpdateDraft, bodyFormatMode, editableFormData, serializeFormDataToDraft, } = options;
    // Editable refs
    const editableMethod = ref('');
    const editableScheme = ref('');
    const editableHost = ref('');
    const editablePath = ref('');
    const editableParams = ref([]);
    const editableRequestHeaders = ref([]);
    const editableResponseHeaders = ref([]);
    const editableRequestBody = ref('');
    const editableResponseBody = ref('');
    const initializedEntryId = ref(null);
    const activeSection = ref('response');
    // Initialize editable data from DRAFT once when entering breakpoint mode
    watch(() => [breakpointMode(), entry()?.id, breakpointDraft()?.entryId], () => {
        const draft = breakpointDraft();
        if (breakpointMode() && draft && initializedEntryId.value !== entry()?.id) {
            initializedEntryId.value = entry()?.id || null;
            editableMethod.value = draft.method || '';
            editableScheme.value = draft.scheme || '';
            editableHost.value = draft.host || '';
            editablePath.value = draft.path || '';
            editableParams.value = JSON.parse(JSON.stringify(draft.params || []));
            editableRequestHeaders.value = JSON.parse(JSON.stringify(draft.requestHeaders || []));
            editableResponseHeaders.value = JSON.parse(JSON.stringify(draft.responseHeaders || []));
            const hasFormData = entry().requestBody?.formData && entry().requestBody.formData.length > 0;
            if (hasFormData) {
                bodyFormatMode.value = 'form-data';
                editableFormData.value = JSON.parse(JSON.stringify(entry().requestBody.formData));
                editableRequestBody.value = '';
            }
            else {
                bodyFormatMode.value = 'raw';
                editableFormData.value = [];
                editableRequestBody.value = formatJson(draft.requestBody);
            }
            editableResponseBody.value = formatJson(draft.responseBody);
            if (breakpointTrigger() === 'response') {
                activeSection.value = 'response';
            }
            else if (breakpointTrigger() === 'request') {
                activeSection.value = 'request';
            }
        }
        if (!breakpointMode()) {
            initializedEntryId.value = null;
            bodyFormatMode.value = 'raw';
            editableFormData.value = [];
        }
    }, { immediate: true });
    // Computed
    const canEditRequest = computed(() => {
        return breakpointMode() && (breakpointTrigger() === 'request' || breakpointTrigger() === undefined);
    });
    const methodAllowsBody = computed(() => {
        const method = (canEditRequest.value ? editableMethod.value : entry().method)?.toUpperCase();
        return method !== 'GET' && method !== 'HEAD';
    });
    const canEditResponse = computed(() => {
        return breakpointMode() && breakpointTrigger() === 'response';
    });
    const paramsQueryString = computed(() => {
        if (!editableParams.value || editableParams.value.length === 0)
            return '';
        const params = editableParams.value.filter(p => p.key);
        if (params.length === 0)
            return '';
        const searchParams = new URLSearchParams();
        params.forEach(p => searchParams.append(p.key, p.value));
        return '?' + searchParams.toString();
    });
    const fullUrlPreview = computed(() => {
        const scheme = editableScheme.value || 'https';
        const host = editableHost.value || '';
        let path = editablePath.value || '/';
        const idx = path.indexOf('?');
        if (idx !== -1)
            path = path.substring(0, idx);
        return `${scheme}://${host}${path}${paramsQueryString.value}`;
    });
    const displayMethod = computed(() => {
        if (canEditRequest.value && editableMethod.value)
            return editableMethod.value;
        return entry().method;
    });
    const displayUrl = computed(() => {
        if (canEditRequest.value)
            return fullUrlPreview.value;
        return entry().url;
    });
    // Handlers
    function updateUrlField(field, newValue) {
        const fieldRef = {
            method: editableMethod,
            scheme: editableScheme,
            host: editableHost,
            path: editablePath,
        };
        fieldRef[field].value = newValue;
        emitUpdateDraft({ [field]: newValue });
    }
    function updateRequestHeader(index, field, newValue) {
        if (editableRequestHeaders.value[index]) {
            editableRequestHeaders.value[index][field] = String(newValue ?? '');
            emitUpdateDraft({ requestHeaders: JSON.parse(JSON.stringify(editableRequestHeaders.value)) });
        }
    }
    function updateResponseHeader(index, field, newValue) {
        if (editableResponseHeaders.value[index]) {
            editableResponseHeaders.value[index][field] = String(newValue ?? '');
            emitUpdateDraft({ responseHeaders: JSON.parse(JSON.stringify(editableResponseHeaders.value)) });
        }
    }
    function updateParam(index, field, newValue) {
        if (editableParams.value[index]) {
            editableParams.value[index][field] = String(newValue ?? '');
            emitUpdateDraft({ params: JSON.parse(JSON.stringify(editableParams.value)) });
        }
    }
    function addParam() {
        editableParams.value.push({ key: '', value: '' });
        emitUpdateDraft({ params: JSON.parse(JSON.stringify(editableParams.value)) });
    }
    function removeParam(index) {
        editableParams.value.splice(index, 1);
        emitUpdateDraft({ params: JSON.parse(JSON.stringify(editableParams.value)) });
    }
    function removeAllParams() {
        editableParams.value = [];
        emitUpdateDraft({ params: [] });
    }
    function addRequestHeader() {
        editableRequestHeaders.value.push({ name: '', value: '' });
        emitUpdateDraft({ requestHeaders: JSON.parse(JSON.stringify(editableRequestHeaders.value)) });
    }
    function removeRequestHeader(index) {
        editableRequestHeaders.value.splice(index, 1);
        emitUpdateDraft({ requestHeaders: JSON.parse(JSON.stringify(editableRequestHeaders.value)) });
    }
    function removeAllRequestHeaders() {
        editableRequestHeaders.value = [];
        emitUpdateDraft({ requestHeaders: [] });
    }
    function updateRequestBody(value) {
        editableRequestBody.value = value;
        emitUpdateDraft({ requestBody: value });
    }
    function updateResponseBody(value) {
        editableResponseBody.value = value;
        emitUpdateDraft({ responseBody: value });
    }
    function buildApplyData() {
        const requestBody = bodyFormatMode.value === 'form-data'
            ? serializeFormDataToDraft()
            : (editableRequestBody.value || null);
        return {
            entryId: entry().id,
            method: editableMethod.value,
            scheme: editableScheme.value,
            host: editableHost.value,
            path: editablePath.value,
            params: editableParams.value,
            requestHeaders: editableRequestHeaders.value,
            requestBody,
            responseHeaders: editableResponseHeaders.value,
            responseBody: editableResponseBody.value || null,
        };
    }
    return {
        // Refs
        activeSection,
        editableMethod,
        editableScheme,
        editableHost,
        editablePath,
        editableParams,
        editableRequestHeaders,
        editableResponseHeaders,
        editableRequestBody,
        editableResponseBody,
        // Computed
        canEditRequest,
        canEditResponse,
        methodAllowsBody,
        displayMethod,
        displayUrl,
        fullUrlPreview,
        paramsQueryString,
        // Methods
        updateUrlField,
        updateRequestHeader,
        updateResponseHeader,
        updateParam,
        addParam,
        removeParam,
        removeAllParams,
        addRequestHeader,
        removeRequestHeader,
        removeAllRequestHeaders,
        updateRequestBody,
        updateResponseBody,
        buildApplyData,
    };
}
//# sourceMappingURL=useBreakpointEditor.js.map