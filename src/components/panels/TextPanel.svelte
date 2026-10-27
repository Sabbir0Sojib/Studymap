<script lang="ts">
  import { addText } from '../../lib/actions';
  import { t } from '../../lib/i18n.svelte';
</script>

<div class="list">
  <button class="t title" onclick={() => addText('title')}>{t('Add a title')}</button>
  <button class="t sub" onclick={() => addText('subtitle')}>{t('Add a subtitle')}</button>
  <button class="t label" onclick={() => addText('label')}>{t('Add a panel letter (a)')}</button>
  <button class="t note" onclick={() => addText('note')}>{t('Add a small note')}</button>
</div>
<p class="hint">{t('Text uses the map font (Design, Text): Arial, Times New Roman, Calibri, Cambria or Courier look-alikes, or your own. Fonts are embedded in PDFs.')}</p>

<style>
  .list { display: grid; gap: 8px; margin-bottom: 14px; }
  .t { text-align: left; border: 1px solid var(--line); background: var(--panel); border-radius: var(--r-card); padding: 12px 14px; font-family: Arimo, Arial, sans-serif; color: var(--ink); }
  .t:hover { border-color: var(--line-strong); background: var(--panel-2); }
  .title { font-size: 20px; font-weight: 700; }
  .sub { font-size: 16px; }
  .label { font-size: 14px; font-weight: 700; }
  .note { font-size: 12.5px; font-style: italic; color: var(--ink-2); }
</style>
