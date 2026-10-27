<script lang="ts">
  // Bold, italic and colour for one kind of text (legend entries, scale numbers, grid labels, names on the map...).
  // Values left unset keep that text's usual look, so "Reset" brings the map style's look back.
  import TextB from 'phosphor-svelte/lib/TextB';
  import TextItalic from 'phosphor-svelte/lib/TextItalic';
  import { look } from '../../lib/textstyle';
  import ColorPicker from '../ColorPicker.svelte';
  import type { TextDefaults, TextStyle } from '../../lib/textstyle';
  import { t } from '../../lib/i18n.svelte';

  interface Props {
    value: TextStyle | undefined;
    defaults: TextDefaults;
    onchange: (next: TextStyle | undefined) => void;
    /** what this text is, e.g. "Legend text" */
    label: string;
    /** offer a colour too (default on) */
    colour?: boolean;
    /** offer "Reset" once something was changed (default on); off where there is no map style look to go back to */
    reset?: boolean;
  }
  let { value, defaults, onchange, label, colour = true, reset = true }: Props = $props();
  const cur = $derived(look(value, defaults));
  const changed = $derived(!!value && (value.bold !== undefined || value.italic !== undefined || !!value.color));
  const set = (patch: TextStyle) => onchange({ ...(value ?? {}), ...patch });
</script>

<div class="tsr" role="group" aria-label={t(label)}>
  <span class="lbl">{t(label)}</span>
  <div class="tools">
    <button class="tb" aria-pressed={cur.bold} onclick={() => set({ bold: !cur.bold })} aria-label={t('Bold')} title={t('Bold')}><TextB size={16} weight="bold" /></button>
    <button class="tb" aria-pressed={cur.italic} onclick={() => set({ italic: !cur.italic })} aria-label={t('Italic')} title={t('Italic')}><TextItalic size={16} weight="bold" /></button>
    {#if colour}
      <ColorPicker value={cur.fill} onchange={(c) => set({ color: c })} label={t('{label} colour', { label: t(label) })} size={32} />
    {/if}
    {#if reset && changed}<button class="reset" aria-label={t('Reset {label}', { label: t(label) })} onclick={() => onchange(undefined)} title={t("Back to the map style's look")}>{t('Reset')}</button>{/if}
  </div>
</div>

<style>
  .tsr { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 36px; }
  .lbl { font-size: 12.5px; color: var(--ink-2); font-weight: 500; }
  .tools { display: flex; align-items: center; gap: 4px; }
  .tb { width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--panel); color: var(--ink-2); transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease; }
  .tb:hover { border-color: var(--line-strong); color: var(--ink); }
  .tb[aria-pressed='true'] { background: var(--accent-wash); border-color: var(--accent); color: var(--accent-ink); }
  .reset { border: 0; background: transparent; color: var(--accent-ink); font-size: 12.5px; font-weight: 600; padding: 4px 6px; border-radius: var(--r-chip); }
  .reset:hover { background: var(--accent-wash); }
  /* phones and tablets: 44 px to the finger */
  @media (pointer: coarse) {
    .tsr { min-height: 44px; }
    .tb { width: 44px; height: 44px; }
    .reset { min-height: 44px; padding: 4px 10px; }
  }
</style>
