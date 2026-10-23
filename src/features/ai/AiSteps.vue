<script setup lang="ts">
import AiThought from './AiThought.vue'
import { isShownThought } from './format'
import type { AiStep } from './types'

defineProps<{ steps: AiStep[] }>()
</script>

<template>
  <ul class="space-y-0.5">
    <template v-for="(step, i) in steps" :key="i">
      <li v-if="isShownThought(step)"><AiThought :text="step.summary" /></li>
      <li v-else-if="!step.thought" class="font-mono truncate" :class="{ 'line-through opacity-60': step.declined }" :title="step.summary">
        <span class="text-foreground/70">{{ step.tool }}</span> {{ step.summary }}<span v-if="step.declined"> (not allowed)</span>
      </li>
    </template>
  </ul>
</template>
