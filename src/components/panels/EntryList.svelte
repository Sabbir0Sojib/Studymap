<script module lang="ts">
  export interface EntryRow {
    id: string;
    /** the name as written now */
    value: string;
    shown: boolean;
    /** names for screen readers: the eye ("Show Rivers in the legend") and the text field ("Legend text for Rivers") */
    eyeLabel: string;
    textLabel: string;
    swatch?: { fill: string; stroke: string };
  }
</script>

<script lang="ts">
  // A ruled list of names, one 34 px row each, laid out like the Layers list: an optional colour swatch, the name as plain
  // text that turns into a field when it is clicked or reached with Tab, and an eye that shows or hides it.
  import Eye from 'phosphor-svelte/lib/Eye';
  import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
  import { t } from '../../lib/i18n.svelte';

  interface Props {
    rows: EntryRow[];
    ontoggle: (id: string) => void;
    onedit: (id: string, value: string) => void;
  }
  let { rows, ontoggle, onedit }: Props = $props();
</script>

<ul class="entries">
  {#each rows as r (r.id)}
    <li class:off={!r.shown} class:plain={!r.swatch}>
      {#if r.swatch}<span class="sw" aria-hidden="true" class:line={r.swatch.fill === 'none'} style="--f:{r.swatch.fill === 'none' ? 'transparent' : r.swatch.fill};--s:{r.swatch.stroke === 'none' ? 'transparent' : r.swatch.stroke}"></span>{/if}
      <input class="nm" type="text" value={r.value} disabled={!r.shown} aria-label={r.textLabel} oninput={(e) => onedit(r.id, (e.target as HTMLInputElement).value)} />
      <button class="eye" onclick={() => ontoggle(r.id)} aria-label={r.eyeLabel} aria-pressed={r.shown} title={r.shown ? t('Hide') : t('Show')}>
        {#if r.shown}<Eye size={16} />{:else}<EyeSlash size={16} />{/if}
      </button>
    </li>
  {/each}
</ul>

<style>
  /* the list scrolls inside itself when it is long; a hairline above every row but the first, no box */
  .entries { list-style: none; margin: 0; padding: 0; display: grid; max-height: 272px; overflow-y: auto; }
  li { display: grid; grid-template-columns: 22px minmax(0, 1fr) 28px; align-items: center; gap: 2px; min-height: 34px; padding: 0 6px; background: var(--panel); }
  li.plain { grid-template-columns: minmax(0, 1fr) 28px; }
  li + li { border-top: 1px solid var(--line); }
  li:hover { background: var(--panel-2); }
  .sw { width: 20px; height: 14px; border-radius: 3px; background: var(--f); box-shadow: inset 0 0 0 1.5px var(--s); }
  .sw.line { background: transparent; box-shadow: none; position: relative; }
  .sw.line::after { content: ''; position: absolute; left: 0; right: 0; top: 6px; height: 2px; background: var(--s); }
  /* plain text at rest; a field (white, edged, blue ring) once it has focus */
  .nm { width: 100%; min-width: 0; height: 28px; padding: 0 6px; border: 1px solid transparent; border-radius: var(--r-chip); background: transparent; font-size: 14px; font-weight: 500; text-overflow: ellipsis; cursor: text; transition: border-color 120ms ease, box-shadow 120ms ease; }
  .nm:focus-visible { outline: 2px solid transparent; background: var(--panel); border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  li.off .nm { color: var(--ink-3); }
  .eye { width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: var(--r-chip); background: transparent; color: var(--ink-3); }
  .eye:hover { background: var(--panel); color: var(--ink); }
  /* touch: 44 px rows, a 44 px eye, 16 px text so the page does not zoom */
  @media (pointer: coarse) {
    li { min-height: 44px; grid-template-columns: 22px minmax(0, 1fr) 44px; }
    li.plain { grid-template-columns: minmax(0, 1fr) 44px; }
    .nm { height: 44px; }
    .eye { width: 44px; height: 44px; }
  }
</style>
