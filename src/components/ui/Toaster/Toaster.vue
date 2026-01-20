<script lang="ts" setup>
import { Toaster, type ToasterProps } from 'vue-sonner';

const props = defineProps<ToasterProps>();
</script>

<template>
  <Toaster
    class="!z-[60] pointer-events-auto max-w-[420px]"
    v-bind="props"
    :toast-options="{
      ...props.toastOptions,
      unstyled: true,
      classes: {
        toast: 'toast-slide-in group w-full cursor-default bg-background text-foreground rounded shadow-lg flex items-center gap-2 p-4 border border-border',
        description: 'text-muted-foreground',
      },
    }"
  />
</template>
