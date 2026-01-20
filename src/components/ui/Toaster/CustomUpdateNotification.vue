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

type Emits = {
  download: [];
  dismiss: [];
};

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div class="flex items-end justify-between bg-popover rounded-lg border border-border p-4 shadow-lg max-w-sm">
    <div class="flex flex-col flex-1">
      <div class="text-sm font-semibold text-popover-foreground">
        {{ props.data.title }}
      </div>
      <div class="text-sm text-muted-foreground">
        {{ props.data.description }} {{ props.data.version }}
      </div>
    </div>
    <div class="flex gap-2 ml-4">
      <Button
        size="xs"
        @click="emit('download')"
      >
        Download
      </Button>
      <Button
        size="xs"
        variant="secondary"
        @click="emit('dismiss')"
      >
        {{ props.data.actionText }}
      </Button>
    </div>
  </div>
</template>