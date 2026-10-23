<script setup lang="ts">
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
export interface EditorField { key: string; label: string; type?: string; required?: boolean; min?: number; max?: number; options?: { value: string; label: string }[] }
const props = defineProps<{ visible: boolean; title: string; fields: EditorField[]; initial?: Record<string, any>; busy?: boolean; error?: string }>();
const emit = defineEmits<{ close: []; save: [values: Record<string, any>] }>(); const values = ref<Record<string, any>>({});
watch(() => [props.visible, props.initial], () => { values.value = { ...props.initial }; }, { immediate: true });
function submit() { const result: Record<string, any> = {}; for (const f of props.fields) { const v = values.value[f.key]; if (v !== '' && v !== undefined && v !== null) result[f.key] = f.type === 'number' ? Number(v) : v; } emit('save', result); }
</script>
<template><Dialog :visible="visible" modal :header="title" :style="{ width: 'min(94vw, 560px)' }" @update:visible="emit('close')"><form class="editor-form" @submit.prevent="submit"><label v-for="f in fields" :key="f.key">{{ f.label }}<select v-if="f.options" v-model="values[f.key]" :required="f.required"><option value="">Seleccionar</option><option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option></select><textarea v-else-if="f.type === 'textarea'" v-model="values[f.key]" :required="f.required" maxlength="4000" /><input v-else v-model="values[f.key]" :type="f.type ?? 'text'" :required="f.required" :min="f.min" :max="f.max" maxlength="120"></label><p v-if="error" class="alert error" role="alert">{{ error }}</p><div class="form-actions"><button type="button" class="button subtle" @click="emit('close')">Cancelar</button><Button type="submit" class="button primary" label="Guardar" :loading="busy" /></div></form></Dialog></template>
