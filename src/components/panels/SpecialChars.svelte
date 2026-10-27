<script lang="ts">
  import { t } from '../../lib/i18n.svelte';
  // One-tap buttons for the signs a figure text needs (km², °C, 23°45′N): each puts its sign at the cursor of the text box.
  interface Props {
    /** the text box the signs go into */
    target: HTMLTextAreaElement | undefined;
  }
  let { target }: Props = $props();
  const SIGNS: [string, string][] = [['²', 'superscript two'], ['³', 'superscript three'], ['°', 'degree'], ['′', 'minute'], ['″', 'second'], ['±', 'plus or minus'], ['µ', 'micro'], ['–', 'dash']];

  /** Put the sign where the cursor is (or over the selected words) and tell the box, so the text is saved. */
  function put(ch: string) {
    const el = target;
    if (!el) return;
    el.focus();
    const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
    el.setRangeText(ch, a, b, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
</script>

<div class="field"><span id="chars-l">{t('Special characters')}</span>
  <div class="chars" role="group" aria-labelledby="chars-l">
    {#each SIGNS as [ch, name]}<button class="ch" onclick={() => put(ch)} aria-label={t('Insert {name}', { name: t(name) })} title={t(name)}>{ch}</button>{/each}
  </div>
</div>

<style>
  .chars { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; }
  .ch { height: 32px; min-width: 0; padding: 0; border: 1px solid var(--line); border-radius: var(--r-chip); background: var(--panel); color: var(--ink); font-size: 14px; font-family: Arimo, Arial, sans-serif; }
  .ch:hover { border-color: var(--line-strong); background: var(--panel-2); }
  .ch:active { transform: scale(0.97); }
  @media (pointer: coarse) { .ch { height: 44px; } }
</style>
