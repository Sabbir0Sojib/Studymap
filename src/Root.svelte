<script lang="ts">
  // Safety net around the whole app: if anything fails while drawing, the user gets a calm screen with a way out
  // (reload, keep a backup of the map, or start fresh) instead of a broken page.
  import App from './App.svelte';

  const KEY = 'studymap.autosave.v1';
  function backup() {
    try {
      const s = localStorage.getItem(KEY);
      if (!s) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([s], { type: 'application/json' }));
      a.download = `StudyMap_backup_${new Date().toISOString().slice(0, 10)}.studymap.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch { /* nothing saved */ }
  }
  function fresh() {
    backup();
    try {
      const s = localStorage.getItem(KEY);
      if (s) localStorage.setItem('studymap.backup.v1', s);
      localStorage.removeItem(KEY);
    } catch { /* storage blocked */ }
    setTimeout(() => location.reload(), 1200); // let the backup download start first
  }
</script>

<svelte:boundary onerror={(e) => console.error('StudyMap stopped:', e)}>
  <App />
  {#snippet failed(error, reset)}
    <div class="crash" role="alert">
      <div class="card">
        <h1>Something went wrong</h1>
        <p>StudyMap hit a problem and stopped drawing. Your map is still saved in this browser.</p>
        <div class="row">
          <button class="btn primary" onclick={() => location.reload()}>Reload the page</button>
          <button class="btn" onclick={reset}>Try again</button>
        </div>
        <p class="small">Still broken after reloading? Start a new map. Your current map is first downloaded as a backup file you can open later with File, Open a project file.</p>
        <div class="row">
          <button class="btn" onclick={backup}>Download my map as a backup</button>
          <button class="btn ghost" onclick={fresh}>Start a new map</button>
        </div>
        <details><summary>Technical details</summary><pre>{String((error as Error)?.message ?? error)}</pre></details>
      </div>
    </div>
  {/snippet}
</svelte:boundary>

<style>
  .crash { position: fixed; inset: 0; display: grid; place-items: center; background: var(--desk); padding: 16px; }
  .card { max-width: 480px; display: grid; gap: 14px; padding: 28px; background: var(--panel); border-radius: 14px; box-shadow: var(--shadow-2), 0 0 0 1px var(--line); }
  h1 { margin: 0; font-size: 20px; }
  p { margin: 0; color: var(--ink-2); line-height: 1.5; }
  .small { font-size: 12.5px; color: var(--ink-3); }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  pre { white-space: pre-wrap; font-size: 11.5px; color: var(--ink-3); }
</style>
