<script setup lang="ts">
  import { Infusion } from '@/components/ui/infusion'
  import { useAutoUnhighlight } from '@/composables/useAutoUnhighlight'
  import { useUpdateChecker } from '@/composables/useUpdateChecker'
  import Navigation from '@/features/Navigation.vue'
  import { Toaster } from '@/components/ui/Toaster'
  import backgroundImage from '@/assets/background1.jpg'

  useAutoUnhighlight()
  useUpdateChecker()
  </script>

  <template>
    <div class="relative h-screen overflow-hidden">
      <Infusion
      :src="backgroundImage"
      :opacity="0.2"
      :opacityDark="0.3"
      :zIndex="100"
      :blur="34"
      :noiseIntensity="0.5"
      :noiseScale="1"
      :noiseOpacity="0.05"
      blendMode="normal"
      :relative="true"
      type="image"
      />

      <div class="relative z-10 h-full">
        <div class="app-shell h-full">
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
    </div>
  </template>