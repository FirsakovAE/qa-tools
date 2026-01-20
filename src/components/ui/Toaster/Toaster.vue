<script lang="ts" setup>
import { Toaster, type ToasterProps } from 'vue-sonner';

const props = defineProps<ToasterProps>();
</script>

<template>
  <Toaster
    class="!fixed !bottom-4 !right-4 !z-[9999] pointer-events-auto max-w-[420px]"
    v-bind="props"
    :toast-options="{
      ...props.toastOptions,
      unstyled: true,
      classes: {
        toast: 'toast-slide-in group w-full cursor-default rounded-lg shadow-lg',
        description: 'text-muted-foreground',
      },
    }"
  />
</template>
