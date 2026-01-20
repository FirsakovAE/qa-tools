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
      <div class="toast-gradient-bg flex items-end justify-between w-fit max-w-md relative rounded-lg border border-white/20 shadow-lg p-4">
        <div class="flex flex-col flex-1 min-w-0 relative z-10">
          <div class="text-sm font-semibold text-white">
            {{ props.data.title }}
          </div>
          <div class="text-sm text-white/90">
            {{ props.data.description }} {{ props.data.version }}
          </div>
        </div>
        <div class="flex gap-2 ml-4 flex-shrink-0 relative z-10">
          <Button
            size="xs"
            class="bg-white/10 hover:bg-white/20 border-white/20 text-white"
            @click="props.data.onDownload"
          >
            Download
          </Button>
          <Button
            size="xs"
            variant="secondary"
            class="bg-black/10 hover:bg-black/20 border-white/20 text-white"
            @click="props.data.onDismiss"
          >
            {{ props.data.actionText }}
          </Button>
        </div>
      </div>
    </template>