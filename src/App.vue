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
    </div>

    <!-- Toaster как настоящий overlay вне layout -->
    <div class="fixed inset-0 pointer-events-none z-50">
      <Toaster
        position="bottom-right"
        class="pointer-events-auto"
        :toast-options="{ duration: 5000 }"
      />
    </div>
  </template>
  
  