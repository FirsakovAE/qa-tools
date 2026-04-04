<script lang="ts" setup>
/**
 * Link to repo root landing (`/{repo}/index.html`), outside VitePress `…/docs/`.
 * Registered globally; use nav `{ component: 'VPNavBarRootLandingLink', props: { text: '…' } }`
 * (nav `link` is always rewritten with `base` by VPLink).
 */
import { computed, inject, useAttrs } from 'vue'
import { useData } from 'vitepress'
import { resolveRootLandingHref } from '../rootLandingNav'

defineOptions({ inheritAttrs: false })

defineProps<{
  text: string
}>()

const attrs = useAttrs()
const { site } = useData()
const href = computed(() => resolveRootLandingHref(site.value.base))

const isScreenMenu = computed(
  () => attrs.screenMenu === true || attrs.screenMenu === '',
)

const closeScreen = inject<(() => void) | undefined>('close-screen', undefined)

function onClick() {
  closeScreen?.()
}
</script>

<template>
  <a
    class="VPLink link"
    :class="isScreenMenu ? 'VPNavScreenMenuLink' : 'VPNavBarMenuLink'"
    :href="href"
    target="_self"
    rel="noopener"
    tabindex="0"
    @click="onClick"
  >
    <span v-html="text"></span>
  </a>
</template>

<style scoped>
.VPNavBarMenuLink {
  display: flex;
  align-items: center;
  padding: 0 12px;
  line-height: var(--vp-nav-height);
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  transition: color 0.25s;
}

.VPNavBarMenuLink:hover {
  color: var(--vp-c-brand-1);
}

.VPNavScreenMenuLink {
  display: block;
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 12px 0 11px;
  line-height: 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  transition:
    border-color 0.25s,
    color 0.25s;
}

.VPNavScreenMenuLink:hover {
  color: var(--vp-c-brand-1);
}
</style>
