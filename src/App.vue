<script setup lang="ts">
  import { Infusion } from '@/components/ui/infusion'
  import { useAutoUnhighlight } from '@/composables/useAutoUnhighlight'
  import { useUpdateChecker } from '@/composables/useUpdateChecker'
  import Navigation from '@/features/Navigation.vue'

  useAutoUnhighlight()
  useUpdateChecker()
  </script>
  
  <template>
    <div class="w-full h-full flex flex-col bg-background overflow-hidden">
      <Infusion class="custom-infuse" src=""/>
      <div class="relative z-10 flex-1 min-h-0 overflow-hidden">
        <Navigation />
      </div>
    </div>

    <!-- Toaster как overlay вне layout -->
    <Toaster
      position="bottom-right"
      :toast-options="{
        duration: 5000
      }"
    />
  </template>