import { ref, computed } from 'vue';
import { Button } from '@/components/ui/button';
import { ExternalLink, Github, BookOpen, FileText, RefreshCw, Loader2 } from 'lucide-vue-next';
import { useRuntime } from '@/runtime';
import { fetchReleaseByTag, fetchLatestRelease, compareVersions, getGithubRepoUrl, getPublishedDocsIntroductionUrl, } from '@/services/githubReleaseService';
const __VLS_props = defineProps();
const emit = defineEmits();
const runtime = useRuntime();
const isExtension = computed(() => runtime.capabilities.mode === 'extension');
const appVersion = computed(() => {
    const manifest = runtime.getManifest();
    const version = manifest?.version;
    if (!version || version === '1.0.0') {
        return runtime.capabilities.mode === 'standalone' ? 'standalone_latest' : 'unknown';
    }
    return version;
});
const loadingReleaseNotes = ref(false);
const loadingCheckUpdates = ref(false);
const githubRepoUrl = getGithubRepoUrl();
const docsIntroductionUrl = getPublishedDocsIntroductionUrl();
async function handleReleaseNotes() {
    loadingReleaseNotes.value = true;
    try {
        let result;
        if (isExtension.value) {
            const version = runtime.getManifest()?.version;
            if (!version) {
                emit('show-release', {
                    type: 'release-notes',
                    body: '',
                    version: '',
                    downloadUrl: null,
                    error: 'Could not determine current version.',
                });
                return;
            }
            result = await fetchReleaseByTag(version);
        }
        else {
            result = await fetchLatestRelease();
        }
        if (result.error || !result.release) {
            emit('show-release', {
                type: 'release-notes',
                body: '',
                version: '',
                downloadUrl: null,
                error: result.error || 'No release data available.',
            });
            return;
        }
        emit('show-release', {
            type: 'release-notes',
            body: result.release.body || 'No release notes available.',
            version: result.release.tag_name.replace(/^v/, ''),
            downloadUrl: result.release.assets?.[0]?.browser_download_url ?? null,
        });
    }
    catch (error) {
        console.error('[settings/AboutSection] handleReleaseNotes failed:', error);
        emit('show-release', {
            type: 'release-notes',
            body: '',
            version: '',
            downloadUrl: null,
            error: error instanceof Error ? error.message : 'Failed to fetch release notes.',
        });
    }
    finally {
        loadingReleaseNotes.value = false;
    }
}
async function handleCheckUpdates() {
    loadingCheckUpdates.value = true;
    try {
        const result = await fetchLatestRelease();
        if (result.error || !result.release) {
            emit('show-release', {
                type: 'release-notes',
                body: '',
                version: '',
                downloadUrl: null,
                error: result.error || 'No release data available.',
            });
            return;
        }
        const remoteVersion = result.release.tag_name.replace(/^v/, '');
        const localVersion = runtime.getManifest()?.version || '0.0.0';
        const hasUpdate = compareVersions(remoteVersion, localVersion) > 0;
        emit('show-release', {
            type: hasUpdate ? 'update-available' : 'up-to-date',
            body: result.release.body || 'No release notes available.',
            version: remoteVersion,
            downloadUrl: result.release.assets?.[0]?.browser_download_url ?? null,
        });
    }
    catch (error) {
        console.error('[settings/AboutSection] handleCheckUpdates failed:', error);
        emit('show-release', {
            type: 'release-notes',
            body: '',
            version: '',
            downloadUrl: null,
            error: error instanceof Error ? error.message : 'Failed to check for updates.',
        });
    }
    finally {
        loadingCheckUpdates.value = false;
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let ___VLS_components;
let ___VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-3" },
});
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2 text-sm text-muted-foreground" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.appVersion);
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-3" },
});
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "justify-start h-8 gap-2" },
    disabled: (__VLS_ctx.loadingReleaseNotes),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    variant: "outline",
    size: "sm",
    ...{ class: "justify-start h-8 gap-2" },
    disabled: (__VLS_ctx.loadingReleaseNotes),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ click: {} },
    { onClick: (__VLS_ctx.handleReleaseNotes) });
/** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const { default: __VLS_7 } = __VLS_3.slots;
if (__VLS_ctx.loadingReleaseNotes) {
    let __VLS_8;
    /** @ts-ignore @type {typeof ___VLS_components.Loader2} */
    Loader2;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ class: "w-3.5 h-3.5 animate-spin" },
    }));
    const __VLS_10 = __VLS_9({
        ...{ class: "w-3.5 h-3.5 animate-spin" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
}
else {
    let __VLS_13;
    /** @ts-ignore @type {typeof ___VLS_components.FileText} */
    FileText;
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
        ...{ class: "w-3.5 h-3.5" },
    }));
    const __VLS_15 = __VLS_14({
        ...{ class: "w-3.5 h-3.5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
}
// @ts-ignore
[appVersion, loadingReleaseNotes, loadingReleaseNotes, handleReleaseNotes,];
var __VLS_3;
var __VLS_4;
if (__VLS_ctx.isExtension) {
    let __VLS_18;
    /** @ts-ignore @type {typeof ___VLS_components.Button} */
    Button;
    // @ts-ignore
    const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({
        ...{ 'onClick': {} },
        variant: "outline",
        size: "sm",
        ...{ class: "justify-start h-8 gap-2" },
        disabled: (__VLS_ctx.loadingCheckUpdates),
    }));
    const __VLS_20 = __VLS_19({
        ...{ 'onClick': {} },
        variant: "outline",
        size: "sm",
        ...{ class: "justify-start h-8 gap-2" },
        disabled: (__VLS_ctx.loadingCheckUpdates),
    }, ...__VLS_functionalComponentArgsRest(__VLS_19));
    let __VLS_23;
    const __VLS_24 = ({ click: {} },
        { onClick: (__VLS_ctx.handleCheckUpdates) });
    /** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    const { default: __VLS_25 } = __VLS_21.slots;
    if (__VLS_ctx.loadingCheckUpdates) {
        let __VLS_26;
        /** @ts-ignore @type {typeof ___VLS_components.Loader2} */
        Loader2;
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
            ...{ class: "w-3.5 h-3.5 animate-spin" },
        }));
        const __VLS_28 = __VLS_27({
            ...{ class: "w-3.5 h-3.5 animate-spin" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_27));
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
    }
    else {
        let __VLS_31;
        /** @ts-ignore @type {typeof ___VLS_components.RefreshCw} */
        RefreshCw;
        // @ts-ignore
        const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({
            ...{ class: "w-3.5 h-3.5" },
        }));
        const __VLS_33 = __VLS_32({
            ...{ class: "w-3.5 h-3.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_32));
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    }
    // @ts-ignore
    [isExtension, loadingCheckUpdates, loadingCheckUpdates, handleCheckUpdates,];
    var __VLS_21;
    var __VLS_22;
}
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "border-t border-border pt-4 space-y-3" },
});
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-border']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_36;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 justify-start gap-2" },
    as: "a",
    href: (__VLS_ctx.githubRepoUrl),
    target: "_blank",
    rel: "noopener noreferrer",
}));
const __VLS_38 = __VLS_37({
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 justify-start gap-2" },
    as: "a",
    href: (__VLS_ctx.githubRepoUrl),
    target: "_blank",
    rel: "noopener noreferrer",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const { default: __VLS_41 } = __VLS_39.slots;
let __VLS_42;
/** @ts-ignore @type {typeof ___VLS_components.Github} */
Github;
// @ts-ignore
const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
    ...{ class: "w-3.5 h-3.5 shrink-0" },
}));
const __VLS_44 = __VLS_43({
    ...{ class: "w-3.5 h-3.5 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_43));
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
let __VLS_47;
/** @ts-ignore @type {typeof ___VLS_components.ExternalLink} */
ExternalLink;
// @ts-ignore
const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({
    ...{ class: "w-3 h-3 ml-1 shrink-0 opacity-50" },
}));
const __VLS_49 = __VLS_48({
    ...{ class: "w-3 h-3 ml-1 shrink-0 opacity-50" },
}, ...__VLS_functionalComponentArgsRest(__VLS_48));
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
// @ts-ignore
[githubRepoUrl,];
var __VLS_39;
let __VLS_52;
/** @ts-ignore @type {typeof ___VLS_components.Button} */
Button;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 justify-start gap-2" },
    as: "a",
    href: (__VLS_ctx.docsIntroductionUrl),
    target: "_blank",
    rel: "noopener noreferrer",
}));
const __VLS_54 = __VLS_53({
    variant: "outline",
    size: "sm",
    ...{ class: "h-8 justify-start gap-2" },
    as: "a",
    href: (__VLS_ctx.docsIntroductionUrl),
    target: "_blank",
    rel: "noopener noreferrer",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const { default: __VLS_57 } = __VLS_55.slots;
let __VLS_58;
/** @ts-ignore @type {typeof ___VLS_components.BookOpen} */
BookOpen;
// @ts-ignore
const __VLS_59 = __VLS_asFunctionalComponent(__VLS_58, new __VLS_58({
    ...{ class: "w-3.5 h-3.5 shrink-0" },
}));
const __VLS_60 = __VLS_59({
    ...{ class: "w-3.5 h-3.5 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_59));
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
let __VLS_63;
/** @ts-ignore @type {typeof ___VLS_components.ExternalLink} */
ExternalLink;
// @ts-ignore
const __VLS_64 = __VLS_asFunctionalComponent(__VLS_63, new __VLS_63({
    ...{ class: "w-3 h-3 ml-1 shrink-0 opacity-50" },
}));
const __VLS_65 = __VLS_64({
    ...{ class: "w-3 h-3 ml-1 shrink-0 opacity-50" },
}, ...__VLS_functionalComponentArgsRest(__VLS_64));
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
// @ts-ignore
[docsIntroductionUrl,];
var __VLS_55;
__VLS_asFunctionalElement(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "border-t border-border pt-4 space-y-1.5 text-xs text-muted-foreground" },
});
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-border']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
__VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    href: "https://www.gnu.org/licenses/gpl-3.0.html",
    target: "_blank",
    rel: "noopener noreferrer",
    ...{ class: "text-foreground/90 underline-offset-4 hover:underline" },
});
/** @type {__VLS_StyleScopedClasses['text-foreground/90']} */ ;
/** @type {__VLS_StyleScopedClasses['underline-offset-4']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
//# sourceMappingURL=AboutSection.vue.js.map