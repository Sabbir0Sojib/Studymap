<script lang="ts">
  // A small tab bar for a panel with several parts, so only one part shows at a time.
  // The parent draws the matching panel: role="tabpanel" id="{prefix}-panel" aria-labelledby="{prefix}-tab-{value}".
  // Arrow keys, Home and End move between tabs (the tab you land on opens straight away).
  import { tick } from 'svelte';
  import { t } from '../../lib/i18n.svelte';

  interface Tab { id: string; label: string }
  interface Props { tabs: Tab[]; value: string; label: string; prefix: string }
  let { tabs, value = $bindable(), label, prefix }: Props = $props();

  const btns: HTMLButtonElement[] = [];

  async function onkey(e: KeyboardEvent) {
    const i = tabs.findIndex((tb) => tb.id === value);
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    value = tabs[n].id;
    await tick();
    btns[n]?.focus();
  }
</script>

<div class="subtabs" role="tablist" aria-label={t(label)} tabindex="-1" style="--n:{tabs.length}" onkeydown={onkey}>
  {#each tabs as tb, i (tb.id)}
    {@const on = value === tb.id}
    <button
      bind:this={btns[i]}
      class="tab" class:on
      role="tab" type="button"
      id="{prefix}-tab-{tb.id}"
      aria-selected={on}
      aria-controls="{prefix}-panel"
      tabindex={on ? 0 : -1}
      onclick={() => (value = tb.id)}
    >
      <span>{t(tb.label)}</span>
    </button>
  {/each}
</div>

<style>
  /* a ruled index across the leaf: words only, the open one underlined in ruling blue */
  .subtabs {
    /* each word takes the width it needs, so no tab name is cut short */
    display: flex; justify-content: space-between; gap: 6px;
    margin: 2px 20px 12px; padding: 0;
    border-bottom: 1px solid var(--line);
  }
  .tab {
    display: grid; justify-items: center; align-content: center; gap: 3px;
    min-height: 40px; padding: 6px 2px 8px; flex: 0 1 auto; min-width: 28px; margin-bottom: -1px;
    border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent;
    color: var(--ink-2); font-size: 12.5px; font-weight: 500; line-height: 1.15; letter-spacing: -0.01em; white-space: nowrap; text-align: center;
    cursor: pointer; transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
  }
  .tab span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .tab:hover { color: var(--ink); border-bottom-color: var(--line-strong); }
  .tab.on { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }
  .tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  /* the narrower 300 px panel: the caption size and narrower margins, so all five names (Map parts has Essentials, On the map,
     Inset maps, Add, Layers) still show whole */
  @media (max-width: 1100px) and (min-width: 761px) {
    .subtabs { gap: 2px; margin-inline: 14px; }
    .tab { font-size: 11.5px; letter-spacing: -0.01em; padding-inline: 2px; }
  }
  @media (max-width: 760px) {
    /* the sheet is short: labels only, one row, and the bar stays put above the scrolling content */
    .subtabs { margin: 0 16px 6px; }
    .tab { min-height: 36px; font-size: 12.5px; }
  }
</style>
