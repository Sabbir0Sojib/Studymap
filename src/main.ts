import { mount } from 'svelte';
import './app.css';
import Root from './Root.svelte';

export default mount(Root, { target: document.getElementById('app')! });

// Works offline after the first visit, and can be installed like an app (see public/sw.js)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is a bonus */ }); });
}
