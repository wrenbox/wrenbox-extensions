/**
 * The toolbar popup. Opening it is a click on Huefinch's icon, which grants
 * activeTab, so the popup also runs the filter on this tab when automatic
 * mode is off.
 */
import { canRunOn, isOffOn, siteOf, withSite } from '../shared/hostname';
import { ALL_SITES, hasAllSites, type ActivateResult, type WorkerRequest } from '../shared/messages';
import { applyChanges, loadSettings, saveSettings, type Settings } from '../shared/settings';
import { $, h } from '../shared/ui/dom';
import { gearIcon, pickerIcon } from '../shared/ui/icons';
import { keyLabel, toggleShortcut } from '../shared/ui/keys';
import { switchControl, visionControls } from '../shared/ui/controls';

let settings: Settings = await loadSettings();
let tab: chrome.tabs.Tab | undefined;
let site: string | null = null;
let runnable = false;
let activation: ActivateResult | null = null;
let auto = false;

/** popup.html?tab=<id> targets a given tab (used by the tests and screenshots). */
async function targetTab(): Promise<chrome.tabs.Tab | undefined> {
  const forced = new URLSearchParams(location.search).get('tab');
  if (forced) return chrome.tabs.get(Number(forced)).catch(() => undefined);
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

const send = <T>(msg: WorkerRequest): Promise<T> => chrome.runtime.sendMessage(msg) as Promise<T>;

// --- Controls ---------------------------------------------------------------------

const master = switchControl('master', 'Huefinch', (on) => void saveSettings({ enabled: on }));
$('#master').replaceWith(master.el);

const vision = visionControls('popup', (patch) => {
  settings = { ...settings, ...patch };
  vision.update(settings);
  void saveSettings(patch);
});
$('#vision').replaceWith(vision.el);

const siteSwitch = switchControl('site', 'On for this site', (on) => {
  if (!site) return;
  settings = { ...settings, offSites: withSite(settings.offSites, site, on) };
  void saveSettings({ offSites: settings.offSites });
});
$('#site').replaceWith(siteSwitch.el);

const identifyBtn = $<HTMLButtonElement>('#identify');
identifyBtn.append(pickerIcon(), 'Identify a color');
identifyBtn.addEventListener('click', async () => {
  if (!tab?.id) return;
  const r = await send<ActivateResult>({ type: 'identify', tabId: tab.id });
  if (r.ok) window.close();
  else showNote();
});

const settingsBtn = $<HTMLButtonElement>('#settings');
settingsBtn.append(gearIcon(), 'Settings');
settingsBtn.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
  window.close();
});

// --- Rendering --------------------------------------------------------------------

function render(): void {
  master.set(settings.enabled);
  vision.update(settings);
  siteSwitch.set(!!site && !isOffOn(settings.offSites, site), !site || !runnable);
  $('#site-host').textContent = site ?? '';
  identifyBtn.disabled = !runnable;
  showNote();
}

function showNote(): void {
  const note = $('#note');
  note.replaceChildren();
  const add = (...nodes: Node[]) => {
    note.append(...nodes);
    note.hidden = false;
  };
  note.hidden = true;
  if (!tab) return;
  if (!runnable) {
    add(
      h(
        'p',
        null,
        tab.url === undefined
          ? 'Huefinch can’t reach this tab. Click its icon while you’re on a web page.'
          : 'Chrome doesn’t let extensions change this page. Huefinch works on websites.',
      ),
    );
    return;
  }
  if (!settings.enabled) {
    add(h('p', null, 'Huefinch is off everywhere. Use the switch above to turn it back on.'));
    return;
  }
  if (activation && !activation.ok) {
    add(h('p', null, 'Huefinch couldn’t start on this page. Reload the page and try again.'));
    return;
  }
  if (!auto) {
    add(
      h('p', null, 'Huefinch is on for this tab until you leave the page.'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn small primary',
          // The popup may close while Chrome asks; the service worker finishes the setup.
          onclick: () => void chrome.permissions.request({ origins: ALL_SITES }).then(refreshAccess),
        },
        'Turn on for all websites',
      ),
      h('p', { class: 'muted' }, 'Then it works on every page automatically, and never reads them.'),
    );
  }
}

async function refreshAccess(): Promise<void> {
  auto = await hasAllSites();
  render();
}

async function hints(): Promise<void> {
  const toggle = await toggleShortcut();
  const line = (key: string, text: string) => h('p', null, h('kbd', null, key), ` ${text}`);
  $('#hints').replaceChildren(
    line(keyLabel('Alt+Shift+C'), 'to name any color'),
    line(`Hold ${keyLabel('Alt+Shift+X')}`, 'to see original colors'),
    toggle ? line(toggle, 'to turn Huefinch on or off') : h('p', null, 'Set an on/off shortcut in Settings'),
  );
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  settings = applyChanges(settings, changes);
  render();
});
chrome.permissions.onAdded.addListener(() => void refreshAccess());
chrome.permissions.onRemoved.addListener(() => void refreshAccess());

render();
void hints();
tab = await targetTab();
site = siteOf(tab?.url);
runnable = canRunOn(tab?.url);
auto = await hasAllSites();
render();
if (runnable && tab?.id !== undefined) {
  activation = await send<ActivateResult>({ type: 'activate', tabId: tab.id });
  render();
}
