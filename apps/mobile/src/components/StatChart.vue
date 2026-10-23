<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { use } from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { init } from 'echarts/core';
use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
const props = defineProps<{ labels: string[]; series: { name: string; data: (number | null)[] }[]; type?: 'bar' | 'line'; label?: string }>();
const el = ref<HTMLElement>(); let chart: ReturnType<typeof init> | undefined; let observer: ResizeObserver | undefined;
function render() { chart?.setOption({ backgroundColor: 'transparent', color: ['#b2f66c', '#7cb7f4'], textStyle: { fontFamily: 'system-ui' }, tooltip: { trigger: 'axis' }, legend: { textStyle: { color: '#a3b0b5' }, bottom: 0 }, grid: { left: 40, right: 20, top: 20, bottom: 65 }, xAxis: { type: 'category', data: props.labels, axisLabel: { color: '#8fa0a9', hideOverlap: true }, axisLine: { lineStyle: { color: '#263239' } } }, yAxis: { type: 'value', axisLabel: { color: '#8fa0a9' }, splitLine: { lineStyle: { color: '#1d292f' } } }, series: props.series.map(s => ({ ...s, type: props.type ?? 'bar', barMaxWidth: 34, smooth: false, itemStyle: { borderRadius: [4, 4, 0, 0] } })) }, true); }
onMounted(() => { if (el.value) { chart = init(el.value); observer = new ResizeObserver(() => chart?.resize()); observer.observe(el.value); render(); } });
watch(() => [props.labels, props.series, props.type], render, { deep: true });
onUnmounted(() => { observer?.disconnect(); chart?.dispose(); });
</script>
<template><div ref="el" class="chart" role="img" :aria-label="label ?? 'Gráfico estadístico'" /></template>
