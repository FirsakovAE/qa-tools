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
    <div class="app-root">
      <Infusion
       class="custom-infuse absolute inset-0" src=""
       data-infuse="image" 
       :opacity="0.15"
       :opacityDark="0.2"
       :blur="72"
       :noiseIntensity="0.25"
       :noiseOpacity="0.03"
       />

      <div class="app-shell">
        <div class="w-full h-full flex flex-col bg-background relative overflow-hidden">
          <div class="relative z-10 flex-1 min-h-0 overflow-hidden">
            <div class="app-content h-full">
              <Navigation />
            </div>
          </div>
        </div>
        <Toaster :toast-options="{ duration: 5000 }" />
      </div>
    </div>
  </template>