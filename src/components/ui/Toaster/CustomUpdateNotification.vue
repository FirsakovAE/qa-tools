<script lang="ts" setup>
import { Button } from '@/components/ui/button';

export type UpdateNotificationData = {
  id: number | string;
  title: string;
  description: string;
  version: string;
  actionText: string;
  onDownload: () => void;
  onDismiss: () => void;
};

type Props = {
  data: UpdateNotificationData;
};

const props = defineProps<Props>();
</script>

<template>
  <div class="flex items-end justify-between bg-popover rounded-lg border border-border p-4 shadow-lg w-fit max-w-md">
    <div class="flex flex-col flex-1 min-w-0">
      <div class="text-sm font-semibold text-popover-foreground">
        {{ props.data.title }}
      </div>
      <div class="text-sm text-muted-foreground">
        {{ props.data.description }} {{ props.data.version }}
      </div>
    </div>
    <div class="flex gap-2 ml-4 flex-shrink-0">
      <Button
        size="xs"
        @click="props.data.onDownload"
      >
        Download
      </Button>
      <Button
        size="xs"
        variant="secondary"
        @click="props.data.onDismiss"
      >
        {{ props.data.actionText }}
      </Button>
    </div>
  </div>
</template>