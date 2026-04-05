<script setup lang="ts">
import { computed } from 'vue'
import type { NetworkHeaderLinkRule } from '@/types/inspector'
import { buildHeaderLinkUrl } from '@/utils/networkHeaderLinks'

const props = defineProps<{
  value: string
  linkRule?: NetworkHeaderLinkRule | null
}>()

const href = computed(() => {
  if (!props.linkRule || !String(props.value ?? '').trim()) return null
  return buildHeaderLinkUrl(
    props.linkRule.urlTemplate,
    props.value,
    props.linkRule.valueExtractRegex,
    props.linkRule.valueTransform,
  )
})
</script>

<template>
  <a
    v-if="href"
    :href="href"
    class="font-mono text-xs text-primary underline underline-offset-2 hover:text-primary/90 break-all whitespace-pre-wrap"
    target="_blank"
    rel="noopener noreferrer"
    @click.stop
  >
    {{ value }}
  </a>
  <span
    v-else
    class="font-mono text-xs break-all whitespace-pre-wrap"
  >
    {{ value }}
  </span>
</template>
