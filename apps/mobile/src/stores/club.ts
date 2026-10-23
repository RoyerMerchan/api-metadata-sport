import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../services/api';
interface Membership { organization: { id: string; name: string; isDemo: boolean }; role: { key: string; permissions: { key: string }[] } }
export const useClub = defineStore('club', () => {
  const memberships = ref<Membership[]>([]), selectedId = ref(''), sessionId = ref(''), loaded = ref(false), changing = ref(false);
  let generation = 0;
  const selected = computed(() => memberships.value.find(m => m.organization.id === selectedId.value));
  const params = computed(() => selectedId.value ? { organizationId: selectedId.value } : {});
  async function select(value: string) {
    if (!memberships.value.some(m => m.organization.id === value)) throw new Error('Equipo no disponible');
    const requestGeneration = generation; changing.value = true;
    try { const { data } = await api.post('/auth/session/workspace', { organizationId: value }); if (requestGeneration === generation) { selectedId.value = data.activeOrganizationId; sessionId.value = data.id; } }
    finally { if (requestGeneration === generation) changing.value = false; }
  }
  function can(permission: string) { return selected.value?.role.permissions.some(p => p.key === permission) ?? false; }
  async function load() {
    const requestGeneration = ++generation;
    const [organizations, session] = await Promise.all([api.get('/organizations'), api.get('/auth/session')]);
    if (requestGeneration !== generation) return;
    memberships.value = organizations.data; sessionId.value = session.data.id;
    selectedId.value = memberships.value.some(m => m.organization.id === session.data.activeOrganizationId) ? session.data.activeOrganizationId : '';
    if (!selectedId.value && memberships.value.length) await select(memberships.value[0]!.organization.id);
    if (requestGeneration === generation) loaded.value = true;
  }
  function reset() { generation++; memberships.value = []; selectedId.value = ''; sessionId.value = ''; loaded.value = false; changing.value = false; sessionStorage.removeItem('footlab.club'); }
  return { memberships, selectedId, sessionId, selected, params, loaded, changing, select, can, load, reset };
});
