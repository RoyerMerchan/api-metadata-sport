export function matchDate(match: { kickoff: string; kickoffTimezoneKnown?: boolean }, withTime = false) {
  return new Date(match.kickoff).toLocaleString('es', { day: 'numeric', month: 'short', ...(withTime ? { year: 'numeric', hour: '2-digit', minute: '2-digit' } : {}), ...(match.kickoffTimezoneKnown === false ? { timeZone: 'UTC' } : {}) });
}
