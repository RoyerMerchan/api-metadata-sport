<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { useRouter } from 'vue-router';
const online = ref(navigator.onLine); const router = useRouter();
const update = () => { online.value = navigator.onLine; };
onMounted(() => {
  document.documentElement.classList.add('dark');
  window.addEventListener('online', update); window.addEventListener('offline', update);
  if (Capacitor.isNativePlatform()) NativeApp.addListener('backButton', ({ canGoBack }) => { if (canGoBack && window.history.length > 1) router.back(); else NativeApp.minimizeApp(); });
});
onUnmounted(() => { window.removeEventListener('online', update); window.removeEventListener('offline', update); });
</script>
<template><div v-if="!online" class="offline" role="status">Sin conexión. Los cambios requieren conexión con FOOTLAB.</div><RouterView /></template>
