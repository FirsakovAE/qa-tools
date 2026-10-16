<script setup lang="ts">
import { computed } from 'vue'
import type { BodyContent } from '@/types/network'

const props = defineProps<{
  body: BodyContent
}>()

const previewUrl = computed(() => {
  const url = props.body.media?.dataUrl
  return url && url.startsWith('data:image/') ? url : ''
})
</script>

<template>
  <img
    v-if="previewUrl"
    :src="previewUrl"
    alt=""
    class="max-h-[480px] max-w-full rounded border border-border bg-muted/30 object-contain"
  />
  <div v-else class="flex flex-col gap-1 text-sm">
    <div class="font-medium text-foreground">Preview unavailable</div>
    <div class="text-muted-foreground">Preview is not supported for this file format.</div>
  </div>
</template>
