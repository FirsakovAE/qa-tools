<script lang="ts" setup>
  import { Button } from '@/components/ui/button'
  import { useI18n } from '@/i18n'
  
  export type UpdateNotificationData = {
    id: number | string
    title: string
    description: string
    version?: string
    onPreview?: () => void
    onDismiss?: () => void
  }
  
  type Props = {
    data: UpdateNotificationData
  }
  
  const props = defineProps<Props>()
  const { t } = useI18n()
  </script>
  
  <template>
    <div
      class="
        toast-surface
        toast-slide-in
        flex items-end justify-between
        w-fit max-w-md
        rounded-lg
        border border-white/20
        shadow-lg
        p-4
      "
    >
      <div class="flex flex-col flex-1 min-w-0 relative z-10">
        <div class="text-sm font-semibold text-white">
          {{ props.data.title }}
        </div>
        <div class="text-sm text-white/90">
          {{ props.data.description }}
        </div>
      </div>
  
      <div v-if="props.data.onPreview || props.data.onDismiss" class="flex gap-2 ml-4 flex-shrink-0 relative z-10">
        <Button
          v-if="props.data.onPreview"
          size="xs"
          class="bg-white/10 hover:bg-white/20 border-white/20 text-white"
          @click="props.data.onPreview"
        >
          {{ t('update.preview') }}
        </Button>
  
        <Button
          v-if="props.data.onDismiss"
          size="xs"
          variant="secondary"
          class="bg-black/10 hover:bg-black/20 border-white/20 text-white"
          @click="props.data.onDismiss"
        >
          {{ t('update.later') }}
        </Button>
      </div>
    </div>
  </template>
