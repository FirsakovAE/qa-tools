<script setup lang="ts">
import { ScrollArea } from '@/components/ui/scroll-area'
import { Infusion } from '@/components/ui/infusion'
import { useAutoUnhighlight } from '@/composables/useAutoUnhighlight'
import Navigation from '@/features/Navigation.vue'

useAutoUnhighlight()
</script>

<template>
  <div class="w-full h-full flex flex-col bg-background">
    <!-- ФОН -->
    <Infusion class="custom-infuse" src=""/>

    <!-- КОНТЕНТ -->
    <ScrollArea class="relative z-10 flex-1 min-h-0">
      <div class="p-2">
        <Navigation />
      </div>
    </ScrollArea>
  </div>
</template>

