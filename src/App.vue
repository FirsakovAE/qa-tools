<script setup lang="ts">
  import { Infusion } from '@/components/ui/infusion'
  import { useAutoUnhighlight } from '@/composables/useAutoUnhighlight'
  import { useUpdateChecker } from '@/composables/useUpdateChecker'
  import Navigation from '@/features/Navigation.vue'
  import { Toaster } from '@/components/ui/Toaster'
  
  useAutoUnhighlight()
  useUpdateChecker()
  </script>
  
  <template>
    <div class="w-full h-full flex flex-col bg-background relative">
      <Infusion class="custom-infuse" src="" />
  
      <div class="relative z-10 flex-1 min-h-0 overflow-hidden">
        <Navigation />
      </div>
  
      <!-- overlay ЖИВЁТ ВНУТРИ APP -->
      <div id="overlay-root">
        <Toaster
          position="bottom-right"
          :toast-options="{ duration: 5000 }"
        />
      </div>
    </div>
  </template>
  
  