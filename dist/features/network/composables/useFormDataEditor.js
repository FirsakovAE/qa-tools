import { ref, computed, watch } from 'vue';
import { copyToClipboard } from '@/utils/networkUtils';
import { addMedia, dataUriToBlob } from '@/settings/mediaStore';
const FILE_ID_PREFIX = '__fileId:';
export function useFormDataEditor(options) {
    const { entry, emitUpdateDraft, editableRequestBody, settings } = options;
    const bodyFormatMode = ref('raw');
    const editableFormData = ref([]);
    const copiedFormDataIndex = ref(null);
    const originalFileInfoByKey = ref({});
    watch(editableFormData, (entries) => {
        const newOriginals = {};
        for (const fd of entries) {
            if (fd.type === 'file' && fd.value === '(binary)' && fd.fileName) {
                newOriginals[fd.key] = {
                    fileName: fd.fileName,
                    fileSize: fd.fileSize,
                    fileType: fd.fileType,
                };
            }
        }
        if (Object.keys(newOriginals).length > 0) {
            originalFileInfoByKey.value = newOriginals;
        }
    });
    // ---------- serialization ----------
    function serializeFormDataToDraft() {
        return JSON.stringify({ __formData: true, entries: editableFormData.value });
    }
    function syncFormDataToDraft() {
        emitUpdateDraft({ requestBody: serializeFormDataToDraft() });
    }
    // ---------- field mutations ----------
    function updateFormDataField(index, field, value) {
        if (!editableFormData.value[index])
            return;
        editableFormData.value[index][field] = value;
        if (field === 'type') {
            editableFormData.value[index].value = '';
            editableFormData.value[index].fileName = undefined;
            editableFormData.value[index].fileSize = undefined;
            editableFormData.value[index].fileType = undefined;
        }
        syncFormDataToDraft();
    }
    function addFormDataEntry() {
        editableFormData.value.push({ key: '', type: 'text', value: '' });
        syncFormDataToDraft();
    }
    function removeFormDataEntry(index) {
        editableFormData.value.splice(index, 1);
        syncFormDataToDraft();
    }
    function removeAllFormDataEntries() {
        editableFormData.value = [];
        syncFormDataToDraft();
    }
    async function copyFormDataValue(fdEntry, index) {
        const text = fdEntry.type === 'file'
            ? fdEntry.fileName || fdEntry.value
            : fdEntry.value;
        const ok = await copyToClipboard(text);
        if (ok) {
            copiedFormDataIndex.value = index;
            setTimeout(() => { copiedFormDataIndex.value = null; }, 2000);
        }
    }
    function handleBodyFormatChange(mode) {
        bodyFormatMode.value = mode;
        if (mode === 'form-data') {
            if (editableFormData.value.length === 0) {
                editableFormData.value = [{ key: '', type: 'text', value: '' }];
            }
            syncFormDataToDraft();
        }
        else {
            emitUpdateDraft({ requestBody: editableRequestBody() });
        }
    }
    // ---------- file handling ----------
    function handleFileSelected(event, index) {
        const input = event.target;
        const file = input?.files?.[0];
        if (!file || !editableFormData.value[index])
            return;
        const reader = new FileReader();
        reader.onload = async () => {
            const dataUri = reader.result;
            const fd = editableFormData.value[index];
            if (!fd)
                return;
            fd.value = dataUri;
            fd.fileName = file.name;
            fd.fileType = file.type || 'application/octet-stream';
            fd.fileSize = file.size;
            syncFormDataToDraft();
            const s = settings();
            if (s?.autoSaveFiles) {
                const allFiles = getAllAvailableFiles();
                const alreadySaved = allFiles.some(f => f.name === file.name && f.size === file.size);
                if (!alreadySaved) {
                    try {
                        const fileId = generateId();
                        const blob = dataUriToBlob(dataUri);
                        await addMedia(fileId, blob);
                        s.savedFiles.push({
                            id: fileId,
                            name: file.name,
                            size: file.size,
                            mimeType: file.type || 'application/octet-stream',
                        });
                    }
                    catch (error) {
                        console.error('[network/useFormDataEditor] addMedia failed:', error);
                    }
                }
            }
        };
        reader.onerror = () => {
            console.error('[network/useFormDataEditor] FileReader failed:', reader.error);
        };
        reader.readAsDataURL(file);
        input.value = '';
    }
    function getFileDisplayLabel(fd) {
        if (!fd.value || fd.value === '')
            return 'Choose file';
        if (fd.value.startsWith(FILE_ID_PREFIX) && fd.fileName) {
            const sizeKb = fd.fileSize ? (fd.fileSize / 1024).toFixed(1) : '?';
            return `${fd.fileName} (${sizeKb} KB)`;
        }
        if (fd.value.startsWith('data:') && fd.fileName) {
            const sizeKb = fd.fileSize ? (fd.fileSize / 1024).toFixed(1) : '?';
            return `${fd.fileName} (${sizeKb} KB)`;
        }
        if (fd.value === '(binary)' && fd.fileName) {
            const sizeKb = fd.fileSize ? (fd.fileSize / 1024).toFixed(1) : '?';
            return `${fd.fileName} (${sizeKb} KB) — original`;
        }
        if (fd.value && fd.value !== '(binary)') {
            return fd.value.replace(/\\/g, '/').split('/').pop() || fd.value;
        }
        return '(binary)';
    }
    // ---------- dropdown options ----------
    // All available files: savedFiles + wallpapers (standalone stores image/video in wallpapers)
    function getAllAvailableFiles() {
        const s = settings();
        const saved = s?.savedFiles ?? [];
        const wallpapers = s?.customize?.image?.wallpapers ?? [];
        return [...saved, ...wallpapers];
    }
    function getFileOptions(fd) {
        const opts = [];
        const original = originalFileInfoByKey.value[fd.key];
        if (original) {
            const sizeKb = original.fileSize ? (original.fileSize / 1024).toFixed(1) : '?';
            opts.push({
                id: '__original__',
                label: `${original.fileName} (${sizeKb} KB) — original`,
            });
        }
        const allFiles = getAllAvailableFiles();
        for (const f of allFiles) {
            opts.push({
                id: f.id,
                label: `${f.name} (${((f.size || 0) / 1024).toFixed(1)} KB)`,
            });
        }
        if (fd.value.startsWith(FILE_ID_PREFIX)) {
            const fileId = fd.value.slice(FILE_ID_PREFIX.length);
            if (!allFiles.some(f => f.id === fileId)) {
                const sizeKb = fd.fileSize ? (fd.fileSize / 1024).toFixed(1) : '?';
                opts.push({
                    id: '__custom__',
                    label: `${fd.fileName || 'file'} (${sizeKb} KB) — current`,
                });
            }
        }
        if (fd.value.startsWith('data:') && fd.fileName) {
            const isSaved = allFiles.some(f => f.name === fd.fileName && f.size === fd.fileSize);
            if (!isSaved) {
                const sizeKb = fd.fileSize ? (fd.fileSize / 1024).toFixed(1) : '?';
                opts.push({
                    id: '__custom__',
                    label: `${fd.fileName} (${sizeKb} KB) — current`,
                });
            }
        }
        return opts;
    }
    function getSelectedFileOption(fd) {
        if (fd.value === '(binary)')
            return '__original__';
        if (fd.value.startsWith(FILE_ID_PREFIX)) {
            const fileId = fd.value.slice(FILE_ID_PREFIX.length);
            const allFiles = getAllAvailableFiles();
            return allFiles.some(f => f.id === fileId) ? fileId : '__custom__';
        }
        if (fd.value.startsWith('data:') && fd.fileName) {
            const allFiles = getAllAvailableFiles();
            const match = allFiles.find(f => f.name === fd.fileName && f.size === fd.fileSize);
            if (match)
                return match.id;
            return '__custom__';
        }
        return '';
    }
    function selectFileOption(index, optionId) {
        const fd = editableFormData.value[index];
        if (!fd)
            return;
        if (optionId === '__original__') {
            const original = originalFileInfoByKey.value[fd.key];
            if (original) {
                fd.value = '(binary)';
                fd.fileName = original.fileName;
                fd.fileSize = original.fileSize;
                fd.fileType = original.fileType;
            }
            syncFormDataToDraft();
            return;
        }
        if (optionId === '__custom__') {
            syncFormDataToDraft();
            return;
        }
        const allFiles = getAllAvailableFiles();
        const file = allFiles.find(f => f.id === optionId);
        if (!file) {
            const s = settings();
            if (s) {
                s.savedFiles = s.savedFiles.filter(sf => sf.id !== optionId);
            }
            const original = originalFileInfoByKey.value[fd.key];
            if (original) {
                fd.value = '(binary)';
                fd.fileName = original.fileName;
                fd.fileSize = original.fileSize;
                fd.fileType = original.fileType;
            }
            else {
                fd.value = '';
                fd.fileName = undefined;
                fd.fileSize = undefined;
                fd.fileType = undefined;
            }
            syncFormDataToDraft();
            return;
        }
        fd.value = FILE_ID_PREFIX + file.id;
        fd.fileName = file.name;
        fd.fileSize = file.size;
        fd.fileType = file.mimeType;
        syncFormDataToDraft();
    }
    const hasFileOptions = computed(() => {
        const allFiles = getAllAvailableFiles();
        return allFiles.length > 0;
    });
    // ---------- computed ----------
    const isFormDataBody = computed(() => {
        return !!entry().requestBody?.formData && entry().requestBody.formData.length > 0;
    });
    const readonlyFormData = computed(() => {
        return entry().requestBody?.formData || [];
    });
    return {
        bodyFormatMode,
        editableFormData,
        copiedFormDataIndex,
        isFormDataBody,
        readonlyFormData,
        hasFileOptions,
        serializeFormDataToDraft,
        syncFormDataToDraft,
        updateFormDataField,
        addFormDataEntry,
        removeFormDataEntry,
        removeAllFormDataEntries,
        copyFormDataValue,
        handleBodyFormatChange,
        handleFileSelected,
        getFileDisplayLabel,
        getFileOptions,
        getSelectedFileOption,
        selectFileOption,
    };
}
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
//# sourceMappingURL=useFormDataEditor.js.map