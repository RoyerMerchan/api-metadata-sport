<script setup lang="ts">defineProps<{ loading?: boolean; error?: string; empty?: boolean }>(); defineEmits<{ retry: [] }>();</script>
<template>
  <div v-if="loading" class="state" role="status"><i aria-hidden="true" class="pi pi-spin pi-spinner" /> Cargando datos…</div>
  <div v-else-if="error" class="state error" role="alert"><i aria-hidden="true" class="pi pi-exclamation-circle" /><p>{{ error }}</p><button class="button subtle" @click="$emit('retry')">Reintentar</button></div>
  <div v-else-if="empty" class="state"><i aria-hidden="true" class="pi pi-database" /><p>Aún no hay datos para esta selección.</p></div>
</template>
