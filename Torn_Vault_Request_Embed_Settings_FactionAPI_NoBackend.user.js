// ==UserScript==
// @name         Torn Vault Request Embed Settings - Faction API Locked - No Backend
// @namespace    TornVaultRequestEmbedSettingsNoBackend
// @version      1.2.0
// @description  Torn vault request panel that sends Discord embeds with banker buttons. Settings are locked behind faction API access. No backend/server.
// @author       Evil_Panda_420
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      discord.com
// @connect      discordapp.com
// @connect      api.torn.com
// ==/UserScript==

(() => {
  'use strict';

  /*
    Torn Vault Request Embed Settings - Faction API Locked - No Backend

    Main features:
    - Clean RWPH-style launcher and panels.
    - Normal users can open the request panel and make a vault request.
    - Request amount supports: 1000000, 1m, 1b, 1t, 1.5m, $1,000,000.
    - Sends a Discord embedded message to the saved faction webhook.
    - Discord embed includes:
      - User name/id
      - Requested amount
      - Open Faction Controls button
      - Open Player Profile button
    - Faction controls link uses:
      https://www.torn.com/factions.php?step=your#/tab=controls&giveMoneyTo=USER_ID&money=AMOUNT
    - Banker still manually checks, clicks Give Money, then Confirm.

    Settings:
    - Settings button opens a locked API verification panel first.
    - User must provide a Torn API key that can successfully read faction data.
    - If faction API check fails, settings do not open.
    - Settings panel lets faction staff paste the Discord webhook URL.
    - Settings panel has preset buttons to change the embed style/message.
    - Settings are local to this browser because there is no backend/server.

    Optional sharing setup:
    - If you want to distribute a preconfigured copy, paste your faction webhook into
      DEFAULT_FACTION_WEBHOOK_URL below before sharing the script.
    - Do not publicly share a real webhook. Anyone with the webhook can post to that channel.
  */

  const APP = 'TVRES_FACTION_API_LOCK';
  const STORE_KEY = `${APP}:settings`;

  // Optional hard-coded webhook for your faction copy. Leave blank if using Settings panel.
  const DEFAULT_FACTION_WEBHOOK_URL = '';

  const DEFAULT_SETTINGS = {
    webhookUrl: DEFAULT_FACTION_WEBHOOK_URL,
    apiKey: '',
    userDisplay: '',
    amountInput: '',
    settingsUnlockedUntil: 0,

    embedTitle: 'New Vault Request',
    embedDescription: '**{user}** requested **{amount}** from the faction vault.',
    embedFooter: 'No backend/server. Manual banker approval required.',
    embedColor: 'e67300',
    embedPreset: 'default'
  };

  const PRESETS = {
    default: {
      name: 'Default',
      title: 'New Vault Request',
      description: '**{user}** requested **{amount}** from the faction vault.',
      footer: 'No backend/server. Manual banker approval required.',
      color: 'e67300'
    },
    rwph: {
      name: 'RWPH Style',
      title: 'Ranked War Vault Request',
      description: 'A faction member has submitted a money request.\n\n**Member:** {user}\n**Amount:** {amount}\n\nOpen faction controls below, check the details, then manually pay.',
      footer: 'RWPH-style request helper. Banker must confirm manually.',
      color: 'ffb347'
    },
    banker: {
      name: 'Banker Detailed',
      title: 'Banker Action Needed',
      description: '**{user}** needs **{amount}**.\n\nUse the button below to open faction controls with the user ID and amount prefilled.',
      footer: 'Please confirm the member and amount in Torn before sending.',
      color: '3ba55d'
    },
    compact: {
      name: 'Compact',
      title: 'Vault Request',
      description: '{user} → {amount}',
      footer: 'Manual payment required.',
      color: '5865f2'
    },
    urgent: {
      name: 'Urgent',
      title: 'URGENT Vault Request',
      description: '⚠️ **Vault request waiting**\n\n**User:** {user}\n**Amount:** {amount}\n\nBanker action required.',
      footer: 'Open controls, verify, then manually pay.',
      color: 'ed4245'
    }
  };

  let settings = loadSettings();
  let submitLocked = false;

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  }

  function $(id) {
    return document.getElementById(`${APP}-${id}`);
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function webhookLooksValid(url) {
    return /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+/i.test(String(url || '').trim());
  }

  function webhookUrlWithComponents(url) {
    const raw = String(url || '').trim();

    try {
      const u = new URL(raw);
      u.searchParams.set('with_components', 'true');
      return u.toString();
    } catch {
      const join = raw.includes('?') ? '&' : '?';
      return `${raw}${join}with_components=true`;
    }
  }

  function parseColor(value) {
    const raw = String(value || '').replace('#', '').trim();
    if (!/^[0-9a-f]{6}$/i.test(raw)) return 15105570;
    return parseInt(raw, 16);
  }

  function getWin() {
    try {
      return typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    } catch {
      return window;
    }
  }

  function gmRequest(options) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        fetch(options.url, {
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.data
        })
          .then(async res => {
            const text = await res.text();
            resolve({ status: res.status, responseText: text });
          })
          .catch(reject);
        return;
      }

      GM_xmlhttpRequest({
        method: options.method || 'GET',
        url: options.url,
        headers: options.headers || {},
        data: options.data,
        timeout: options.timeout || 30000,
        onload: resolve,
        onerror: () => reject(new Error(options.errorMessage || 'Request failed.')),
        ontimeout: () => reject(new Error(options.timeoutMessage || 'Request timed out.'))
      });
    });
  }

  function findSelfFromWindow() {
    const w = getWin();

    const candidates = [
      w?.user,
      w?.User,
      w?.Torn?.user,
      w?.torn?.user,
      w?.pageData?.user,
      w?.session?.user,
      w?.TornStats?.user,
      w?.__userdata,
      w?.__USER__,
      w?.USER
    ].filter(Boolean);

    for (const obj of candidates) {
      const name =
        obj.name ||
        obj.username ||
        obj.userName ||
        obj.playerName ||
        obj.login ||
        obj.displayName;

      const id =
        obj.id ||
        obj.userID ||
        obj.userId ||
        obj.player_id ||
        obj.playerId ||
        obj.XID ||
        obj.xid;

      if (name && id) {
        return { name: cleanText(name), id: String(id).replace(/[^\d]/g, '') };
      }
    }

    const globalName = w?.userName || w?.username || w?.playerName;
    const globalId = w?.userID || w?.userId || w?.playerId || w?.player_id || w?.XID;
    if (globalName && globalId) {
      return { name: cleanText(globalName), id: String(globalId).replace(/[^\d]/g, '') };
    }

    return null;
  }

  function findSelfFromScripts() {
    const scripts = Array.from(document.scripts || [])
      .map(s => s.textContent || '')
      .join('\n')
      .slice(0, 900000);

    const patterns = [
      /"name"\s*:\s*"([^"]{2,32})"[^{}]{0,250}"(?:userID|userId|id|player_id|playerId|XID)"\s*:\s*"?(\d+)"?/i,
      /"(?:userID|userId|id|player_id|playerId|XID)"\s*:\s*"?(\d+)"?[^{}]{0,250}"name"\s*:\s*"([^"]{2,32})"/i,
      /userName\s*[=:]\s*['"]([^'"]{2,32})['"][\s\S]{0,250}userID\s*[=:]\s*['"]?(\d+)['"]?/i,
      /userID\s*[=:]\s*['"]?(\d+)['"]?[\s\S]{0,250}userName\s*[=:]\s*['"]([^'"]{2,32})['"]/i
    ];

    for (const re of patterns) {
      const m = scripts.match(re);
      if (!m) continue;

      const a = m[1];
      const b = m[2];
      const firstIsId = /^\d+$/.test(a);
      const id = firstIsId ? a : b;
      const name = firstIsId ? b : a;

      if (name && id) return { name: cleanText(name), id: String(id).replace(/[^\d]/g, '') };
    }

    return null;
  }

  function scoreProfileLink(link) {
    const text = cleanText(link.textContent);
    const href = link.getAttribute('href') || '';
    let score = 0;

    const idMatch = href.match(/XID=(\d+)/i);
    if (idMatch) score += 5;
    if (text && text.length <= 40) score += 2;

    let node = link;
    for (let i = 0; node && i < 5; i++, node = node.parentElement) {
      const cls = String(node.className || '').toLowerCase();
      const id = String(node.id || '').toLowerCase();
      const blob = `${cls} ${id}`;

      if (/user|profile|sidebar|header|top|menu|avatar|person|account/.test(blob)) score += 3;
      if (/faction|member|enemy|attack|war|request|bank|vault/.test(blob)) score -= 4;
    }

    return score;
  }

  function findSelfFromDom() {
    const links = Array.from(document.querySelectorAll('a[href*="profiles.php?XID="], a[href*="/profiles.php?XID="]'))
      .map(link => {
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/XID=(\d+)/i);
        const id = idMatch ? idMatch[1] : '';
        const text = cleanText(link.textContent).replace(/\s*\[\d+\]\s*$/, '').trim();

        return { link, id, name: text, score: scoreProfileLink(link) };
      })
      .filter(x => x.id && x.name);

    links.sort((a, b) => b.score - a.score);

    if (links[0] && links[0].score > 0) {
      return { name: links[0].name, id: links[0].id };
    }

    return null;
  }

  function getCurrentUserDisplay() {
    if (settings.userDisplay) return settings.userDisplay;

    const found = findSelfFromWindow() || findSelfFromScripts() || findSelfFromDom();
    if (found?.name && found?.id) {
      return `${found.name} [${found.id}]`;
    }

    return '';
  }

  function parseUserDisplay(value) {
    const text = cleanText(value);
    const match = text.match(/^(.+?)\s*\[(\d+)\]\s*$/);
    if (match) {
      return {
        display: `${cleanText(match[1])} [${match[2]}]`,
        name: cleanText(match[1]),
        id: match[2]
      };
    }

    const idOnly = text.match(/\[(\d+)\]|\b(\d{3,12})\b/);
    return {
      display: text,
      name: text.replace(/\s*\[\d+\]\s*$/, '').trim() || 'Unknown',
      id: idOnly ? (idOnly[1] || idOnly[2]) : ''
    };
  }

  function parseAmount(input) {
    const raw = String(input || '').trim().toLowerCase();

    if (!raw) {
      return { ok: false, error: 'Enter a request amount.' };
    }

    const compact = raw
      .replace(/\$/g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, '');

    const multipliers = {
      k: 1_000,
      m: 1_000_000,
      mil: 1_000_000,
      million: 1_000_000,
      b: 1_000_000_000,
      bil: 1_000_000_000,
      billion: 1_000_000_000,
      t: 1_000_000_000_000,
      tril: 1_000_000_000_000,
      trillion: 1_000_000_000_000
    };

    const match = compact.match(/^(\d+(?:\.\d+)?)(k|m|mil|million|b|bil|billion|t|tril|trillion)?$/i);

    if (!match) {
      return { ok: false, error: 'Use numbers like 1000000, 1m, 1b, or 1t.' };
    }

    const number = Number(match[1]);
    const suffix = match[2] || '';
    const amount = Math.round(number * (multipliers[suffix] || 1));

    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Amount must be above $0.' };
    }

    if (amount > 9_000_000_000_000_000) {
      return { ok: false, error: 'Amount is too large.' };
    }

    return {
      ok: true,
      amount,
      raw: String(amount),
      formatted: `$${amount.toLocaleString('en-US')}`
    };
  }

  function makeFactionControlsGiveMoneyUrl(userId, amountRaw) {
    return `https://www.torn.com/factions.php?step=your#/tab=controls&giveMoneyTo=${encodeURIComponent(userId)}&money=${encodeURIComponent(amountRaw)}`;
  }

  function escapeDiscord(value) {
    return String(value || '')
      .replace(/`/g, "'")
      .replace(/@/g, '@\u200b')
      .slice(0, 2000);
  }

  function templateValue(template, user, amount, controlsUrl, profileUrl) {
    return String(template || '')
      .replaceAll('{user}', user.display || `${user.name} [${user.id}]`)
      .replaceAll('{name}', user.name || 'Unknown')
      .replaceAll('{id}', user.id || '')
      .replaceAll('{amount}', amount.formatted || '')
      .replaceAll('{raw}', amount.raw || '')
      .replaceAll('{profile}', profileUrl || '')
      .replaceAll('{controls}', controlsUrl || '');
  }

  function buildPayload(user, amount) {
    const profileUrl = user.id ? `https://www.torn.com/profiles.php?XID=${user.id}` : '';
    const controlsUrl = user.id ? makeFactionControlsGiveMoneyUrl(user.id, amount.raw) : 'https://www.torn.com/factions.php?step=your#/tab=controls';

    const title = templateValue(settings.embedTitle, user, amount, controlsUrl, profileUrl).slice(0, 256);
    const description = templateValue(settings.embedDescription, user, amount, controlsUrl, profileUrl).slice(0, 4000);
    const footer = templateValue(settings.embedFooter, user, amount, controlsUrl, profileUrl).slice(0, 2048);

    const fields = [
      { name: 'User', value: escapeDiscord(user.display || `${user.name} [${user.id}]`), inline: true },
      { name: 'Amount Requested', value: amount.formatted, inline: true },
      { name: 'Raw Amount', value: amount.raw, inline: true },
      { name: 'Banker Action', value: 'Open the button below, check the prefilled user and amount, then manually click **Give Money** and **Confirm** in Torn.', inline: false },
      { name: 'Torn Controls Link', value: controlsUrl, inline: false }
    ];

    if (profileUrl) {
      fields.splice(3, 0, { name: 'Profile', value: profileUrl, inline: false });
    }

    return {
      username: 'Torn Vault Request',
      avatar_url: 'https://www.torn.com/favicon.ico',
      content: '',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: escapeDiscord(title || 'New Vault Request'),
          description: escapeDiscord(description || `**${user.display}** requested **${amount.formatted}**.`),
          color: parseColor(settings.embedColor),
          fields,
          footer: { text: footer || 'No backend/server. Manual banker approval required.' },
          timestamp: new Date().toISOString()
        }
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: 'Open Faction Controls',
              url: controlsUrl
            },
            ...(profileUrl ? [{
              type: 2,
              style: 5,
              label: 'Open Player Profile',
              url: profileUrl
            }] : [])
          ]
        }
      ]
    };
  }

  async function postWebhook(payload) {
    if (!webhookLooksValid(settings.webhookUrl)) {
      throw new Error('Add a valid Discord webhook URL in Settings first.');
    }

    const res = await gmRequest({
      method: 'POST',
      url: webhookUrlWithComponents(settings.webhookUrl),
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
      errorMessage: 'Discord webhook request failed.',
      timeoutMessage: 'Discord webhook request timed out.'
    });

    if (!(res.status >= 200 && res.status < 300)) {
      throw new Error(`Discord returned HTTP ${res.status}. ${String(res.responseText || '').slice(0, 180)}`);
    }

    return res;
  }

  async function tornApiGet(url) {
    const res = await gmRequest({
      method: 'GET',
      url,
      errorMessage: 'Torn API request failed.',
      timeoutMessage: 'Torn API request timed out.'
    });

    let data = null;
    try {
      data = JSON.parse(res.responseText || '{}');
    } catch {
      throw new Error('Torn API returned an invalid response.');
    }

    return { status: res.status, data };
  }

  function looksLikeFactionResponse(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.error) return false;

    // Old API normally returns direct faction fields.
    if (data.ID || data.name || data.tag || data.leader || data.members || data.basic) return true;

    // V2-style wrappers vary; accept obvious faction-like content.
    if (data.faction || data.data?.faction || data.data?.name || data.data?.members) return true;

    return false;
  }

  function getApiError(data) {
    const err = data?.error || data?.errors?.[0];
    if (!err) return '';
    if (typeof err === 'string') return err;
    return [err.code ? `Code ${err.code}` : '', err.error || err.message || err.reason || ''].filter(Boolean).join(': ');
  }

  async function verifyFactionApiAccess(apiKey) {
    const key = cleanText(apiKey);

    if (!key || key.length < 8) {
      throw new Error('Paste a valid Torn API key first.');
    }

    // Old API is included because many Torn userscripts still rely on it.
    // V2 fallback is included in case old endpoint behavior changes.
    const urls = [
      `https://api.torn.com/faction/?selections=basic&key=${encodeURIComponent(key)}`,
      `https://api.torn.com/faction/?selections=&key=${encodeURIComponent(key)}`,
      `https://api.torn.com/v2/faction/basic?key=${encodeURIComponent(key)}`
    ];

    const errors = [];

    for (const url of urls) {
      try {
        const { data } = await tornApiGet(url);

        if (looksLikeFactionResponse(data)) {
          return data;
        }

        const msg = getApiError(data);
        if (msg) errors.push(msg);
      } catch (err) {
        errors.push(err.message || String(err));
      }
    }

    throw new Error(errors[0] || 'Faction API check failed. This key may not have faction API access.');
  }

  function isSettingsUnlocked() {
    return Number(settings.settingsUnlockedUntil || 0) > Date.now();
  }

  function unlockSettingsForOneHour() {
    settings.settingsUnlockedUntil = Date.now() + (60 * 60 * 1000);
    saveSettings();
  }

  function closePanel(id) {
    const el = document.getElementById(`${APP}-${id}`);
    if (el) el.remove();
  }

  function closeFloatingPanels(except) {
    for (const id of ['requestPanel', 'settingsGate', 'settingsPanel']) {
      if (id !== except) closePanel(id);
    }
  }

  function showToast(message, type = 'ok') {
    let toast = document.getElementById(`${APP}-toast`);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = `${APP}-toast`;
      document.body.appendChild(toast);
    }

    toast.className = `${APP}-toast ${type}`;
    toast.textContent = message;

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.remove(), 5000);
  }

  function addStyles() {
    if (document.getElementById(`${APP}-style`)) return;

    const style = document.createElement('style');
    style.id = `${APP}-style`;
    style.textContent = `
      :root {
        --${APP}-bg: #0e0b09;
        --${APP}-panel: #17110b;
        --${APP}-panel2: #21170d;
        --${APP}-line: #ffb347;
        --${APP}-text: #fff2d5;
        --${APP}-muted: #d2b78a;
        --${APP}-danger: #e25353;
        --${APP}-good: #4caf64;
        --${APP}-input: #080604;
      }

      #${APP}-launcher {
        position: fixed;
        right: 15px;
        bottom: 18px;
        z-index: 999999;
        border: 1px solid var(--${APP}-line);
        border-radius: 14px;
        background: linear-gradient(180deg, #36210c, #130d07);
        color: #ffe1ad;
        padding: 10px 15px;
        cursor: pointer;
        font: 900 13px Arial, sans-serif;
        box-shadow: 0 8px 28px rgba(0,0,0,.55);
      }

      .${APP}-panel {
        position: fixed;
        right: 15px;
        bottom: 68px;
        z-index: 1000000;
        width: min(460px, calc(100vw - 30px));
        max-height: min(740px, calc(100vh - 92px));
        overflow: auto;
        border: 1px solid var(--${APP}-line);
        border-radius: 18px;
        background:
          radial-gradient(circle at top left, rgba(255,179,71,.14), transparent 40%),
          linear-gradient(180deg, #1b1209, #0f0b08);
        color: var(--${APP}-text);
        padding: 14px;
        box-shadow: 0 18px 48px rgba(0,0,0,.68);
        font: 13px Arial, sans-serif;
        box-sizing: border-box;
      }

      .${APP}-panel * {
        box-sizing: border-box;
      }

      .${APP}-header {
        border: 1px solid rgba(255,179,71,.55);
        border-radius: 15px;
        background: rgba(0,0,0,.22);
        padding: 12px;
        margin-bottom: 12px;
      }

      .${APP}-headRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .${APP}-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .${APP}-logo {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(255,179,71,.7);
        background: linear-gradient(180deg, #3c250d, #0b0704);
        color: #ffcc7a;
        font-size: 20px;
        box-shadow: inset 0 0 16px rgba(255,179,71,.15);
      }

      .${APP}-title {
        font-size: 17px;
        font-weight: 900;
        color: #fff0d2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .${APP}-subtitle {
        font-size: 12px;
        color: var(--${APP}-muted);
        margin-top: 2px;
      }

      .${APP}-x {
        border: 1px solid #9e3838;
        border-radius: 10px;
        background: #3b1111;
        color: #ffd1d1;
        width: 32px;
        height: 32px;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        flex: 0 0 auto;
      }

      .${APP}-card {
        border: 1px solid rgba(255,179,71,.32);
        border-radius: 15px;
        background: rgba(255,179,71,.06);
        padding: 12px;
        margin-top: 10px;
      }

      .${APP}-cardTitle {
        color: #ffe0a8;
        font-weight: 900;
        margin-bottom: 8px;
      }

      .${APP}-panel label {
        display: block;
        margin: 10px 0 5px;
        color: #ffda9a;
        font-weight: 900;
      }

      .${APP}-panel input,
      .${APP}-panel textarea,
      .${APP}-panel select {
        width: 100%;
        border: 1px solid #6f4a22;
        border-radius: 11px;
        background: var(--${APP}-input);
        color: #fff;
        padding: 10px 11px;
        outline: none;
        font: 700 14px Arial, sans-serif;
      }

      .${APP}-panel textarea {
        min-height: 82px;
        resize: vertical;
        line-height: 1.35;
      }

      .${APP}-panel input:focus,
      .${APP}-panel textarea:focus,
      .${APP}-panel select:focus {
        border-color: var(--${APP}-line);
        box-shadow: 0 0 0 2px rgba(255,179,71,.08);
      }

      .${APP}-preview {
        margin-top: 7px;
        border-radius: 11px;
        padding: 8px 10px;
        font-weight: 900;
      }

      .${APP}-preview.ok {
        border: 1px solid var(--${APP}-good);
        background: rgba(76, 164, 93, .12);
        color: #baffc6;
      }

      .${APP}-preview.warn {
        border: 1px solid #a87933;
        background: rgba(255, 179, 71, .1);
        color: #ffd69b;
      }

      .${APP}-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .${APP}-btn {
        border: 1px solid var(--${APP}-line);
        border-radius: 11px;
        background: linear-gradient(180deg, #30200f, #160d05);
        color: #ffe1ad;
        padding: 10px 12px;
        cursor: pointer;
        font: 900 13px Arial, sans-serif;
        flex: 1 1 130px;
      }

      .${APP}-btn:hover,
      #${APP}-make:hover {
        filter: brightness(1.12);
      }

      .${APP}-btn.danger {
        border-color: #e25353;
        color: #ffd1d1;
        background: linear-gradient(180deg, #421515, #1a0707);
      }

      .${APP}-btn.good {
        border-color: var(--${APP}-good);
        color: #d9ffe1;
        background: linear-gradient(180deg, #1d4c2a, #0b1d10);
      }

      #${APP}-make {
        width: 100%;
        margin-top: 14px;
        border: 1px solid var(--${APP}-line);
        border-radius: 12px;
        background: linear-gradient(180deg, #70410f, #3a2108);
        color: #ffe1ad;
        padding: 12px;
        cursor: pointer;
        font: 900 15px Arial, sans-serif;
      }

      #${APP}-make:disabled {
        opacity: .55;
        cursor: wait;
      }

      .${APP}-note {
        margin: 10px 0 0;
        color: var(--${APP}-muted);
        line-height: 1.35;
      }

      .${APP}-tiny {
        font-size: 12px;
        color: #bfa579;
      }

      .${APP}-controlsPreview,
      .${APP}-embedPreview {
        margin-top: 8px;
        border: 1px solid rgba(255,179,71,.35);
        border-radius: 12px;
        background: rgba(255,179,71,.08);
        color: #ffe4b3;
        padding: 9px 10px;
        word-break: break-word;
        font-size: 12px;
        line-height: 1.35;
      }

      .${APP}-embedPreview {
        border-left: 5px solid var(--${APP}-line);
      }

      .${APP}-pillRow {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 9px;
      }

      .${APP}-pill {
        border: 1px solid rgba(255,179,71,.45);
        background: rgba(0,0,0,.25);
        color: #ffe1ad;
        border-radius: 999px;
        padding: 7px 10px;
        font: 900 12px Arial, sans-serif;
        cursor: pointer;
      }

      .${APP}-pill.active {
        background: #4b2c0c;
        border-color: var(--${APP}-line);
      }

      #${APP}-toast {
        position: fixed;
        right: 15px;
        bottom: 120px;
        z-index: 1000002;
        width: min(460px, calc(100vw - 30px));
        border-radius: 13px;
        background: #100a05;
        color: white;
        padding: 11px 13px;
        box-shadow: 0 10px 30px rgba(0,0,0,.6);
        font: 900 13px Arial, sans-serif;
      }

      #${APP}-toast.ok { border: 1px solid var(--${APP}-good); }
      #${APP}-toast.warn { border: 1px solid var(--${APP}-line); }
      #${APP}-toast.bad { border: 1px solid var(--${APP}-danger); }

      @media (max-width: 520px) {
        #${APP}-launcher {
          right: 10px;
          bottom: 12px;
          padding: 9px 11px;
        }
        .${APP}-panel {
          right: 10px;
          bottom: 58px;
          width: calc(100vw - 20px);
          padding: 12px;
        }
        .${APP}-title {
          font-size: 15px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function panelHeader(title, subtitle, icon, closeId) {
    return `
      <div class="${APP}-header">
        <div class="${APP}-headRow">
          <div class="${APP}-brand">
            <div class="${APP}-logo">${icon || '💰'}</div>
            <div>
              <div class="${APP}-title">${title}</div>
              <div class="${APP}-subtitle">${subtitle || ''}</div>
            </div>
          </div>
          <button type="button" class="${APP}-x" id="${APP}-${closeId}">×</button>
        </div>
      </div>
    `;
  }

  function updateAmountPreview() {
    const input = $('amount');
    const preview = $('amountPreview');
    if (!input || !preview) return;

    const parsed = parseAmount(input.value);

    if (parsed.ok) {
      preview.textContent = `Request amount: ${parsed.formatted}`;
      preview.className = `${APP}-preview ok`;
    } else {
      preview.textContent = parsed.error;
      preview.className = `${APP}-preview warn`;
    }
  }

  function updateControlsPreview() {
    const el = $('controlsPreview');
    if (!el) return;

    const user = parseUserDisplay($('user')?.value || '');
    const amount = parseAmount($('amount')?.value || '');

    if (user.id && amount.ok) {
      el.textContent = `Discord button will open Torn Controls prefilled with user ID ${user.id} and ${amount.formatted}. Banker still manually clicks Give Money and Confirm.`;
    } else if (!user.id) {
      el.textContent = 'Enter name and Torn ID like Evil_panda_420 [3236276] so the banker button can prefill the right player.';
    } else {
      el.textContent = 'Enter a valid amount so the banker button can prefill the money field.';
    }
  }

  function applyFormattedAmountToInput() {
    const input = $('amount');
    if (!input) return;

    const parsed = parseAmount(input.value);
    if (parsed.ok) {
      input.value = parsed.formatted;
      settings.amountInput = input.value;
      saveSettings();
    }

    updateAmountPreview();
    updateControlsPreview();
  }

  function fillRequestPanelValues() {
    $('user').value = getCurrentUserDisplay();
    $('amount').value = settings.amountInput || '';
    updateAmountPreview();
    updateControlsPreview();
  }

  function saveRequestFromPanel() {
    settings.userDisplay = cleanText($('user')?.value || '');
    settings.amountInput = cleanText($('amount')?.value || '');
    saveSettings();
  }

  async function makeRequest() {
    if (submitLocked) return;

    saveRequestFromPanel();

    const user = parseUserDisplay(settings.userDisplay);
    const amount = parseAmount(settings.amountInput);

    if (!user.display || !user.id) {
      showToast('Enter your name and Torn ID first, example: Evil_panda_420 [3236276].', 'warn');
      return;
    }

    if (!amount.ok) {
      showToast(amount.error, 'warn');
      return;
    }

    if (!webhookLooksValid(settings.webhookUrl)) {
      showToast('The faction webhook has not been set in Settings yet.', 'warn');
      return;
    }

    submitLocked = true;
    const btn = $('make');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }

    try {
      const payload = buildPayload(user, amount);
      await postWebhook(payload);
      showToast(`Request sent to Discord: ${amount.formatted}`, 'ok');

      $('amount').value = amount.formatted;
      settings.amountInput = amount.formatted;
      saveSettings();
      updateAmountPreview();
      updateControlsPreview();
    } catch (err) {
      console.error('[Torn Vault Request Maker]', err);
      showToast(err.message || 'Request failed.', 'bad');
    } finally {
      setTimeout(() => {
        submitLocked = false;
        const btn2 = $('make');
        if (btn2) {
          btn2.disabled = false;
          btn2.textContent = 'Make Request';
        }
      }, 1200);
    }
  }

  async function tryOpenSettings() {
    if (isSettingsUnlocked()) {
      openSettingsPanel();
      return;
    }

    if (settings.apiKey) {
      showToast('Checking faction API permission...', 'warn');

      try {
        await verifyFactionApiAccess(settings.apiKey);
        unlockSettingsForOneHour();
        showToast('Faction API access confirmed.', 'ok');
        openSettingsPanel();
        return;
      } catch (err) {
        showToast('Saved API key failed faction access check.', 'bad');
      }
    }

    openSettingsGate();
  }

  function openRequestPanel() {
    const existing = document.getElementById(`${APP}-requestPanel`);
    if (existing) {
      existing.remove();
      return;
    }

    closeFloatingPanels('requestPanel');

    const panel = document.createElement('div');
    panel.id = `${APP}-requestPanel`;
    panel.className = `${APP}-panel`;
    panel.innerHTML = `
      ${panelHeader('Vault Request', 'Send a Discord embed to faction bankers.', '💰', 'closeRequest')}

      <div class="${APP}-card">
        <div class="${APP}-cardTitle">Request Details</div>

        <label for="${APP}-user">Name and Torn ID</label>
        <input id="${APP}-user" type="text" placeholder="Evil_panda_420 [3236276]" autocomplete="off" />

        <label for="${APP}-amount">Request amount</label>
        <input id="${APP}-amount" type="text" inputmode="decimal" placeholder="1000000, 1m, 1b, or 1t" autocomplete="off" />
        <div id="${APP}-amountPreview" class="${APP}-preview warn">Enter a request amount.</div>
        <div id="${APP}-controlsPreview" class="${APP}-controlsPreview">Enter details to preview the banker button action.</div>

        <button type="button" id="${APP}-make">Make Request</button>
      </div>

      <div class="${APP}-row">
        <button type="button" class="${APP}-btn" id="${APP}-settingsBtn">Settings</button>
        <button type="button" class="${APP}-btn" id="${APP}-refreshUser">Refill Name/ID</button>
      </div>

      <p class="${APP}-note">
        The Discord embed includes an <b>Open Faction Controls</b> button.
        Banker still manually checks the details, clicks <b>Give Money</b>, then <b>Confirm</b>.
      </p>

      <p class="${APP}-note">
        Amount examples:
        <b>1000000</b> = $1,000,000,
        <b>1m</b> = $1,000,000,
        <b>1b</b> = $1,000,000,000,
        <b>1t</b> = $1,000,000,000,000.
      </p>
    `;

    document.body.appendChild(panel);
    fillRequestPanelValues();

    $('closeRequest').addEventListener('click', () => panel.remove());

    $('amount').addEventListener('input', () => {
      settings.amountInput = $('amount').value;
      updateAmountPreview();
      updateControlsPreview();
    });

    $('amount').addEventListener('blur', applyFormattedAmountToInput);

    $('user').addEventListener('input', () => {
      settings.userDisplay = cleanText($('user').value);
      updateControlsPreview();
    });

    $('user').addEventListener('change', () => {
      settings.userDisplay = cleanText($('user').value);
      saveSettings();
      updateControlsPreview();
    });

    $('make').addEventListener('click', makeRequest);
    $('settingsBtn').addEventListener('click', tryOpenSettings);

    $('refreshUser').addEventListener('click', () => {
      settings.userDisplay = '';
      saveSettings();
      $('user').value = getCurrentUserDisplay();
      settings.userDisplay = cleanText($('user').value);
      saveSettings();
      updateControlsPreview();
      showToast(settings.userDisplay ? 'Name/ID refilled.' : 'Could not detect name/ID. Type it manually.', settings.userDisplay ? 'ok' : 'warn');
    });
  }

  function openSettingsGate() {
    closeFloatingPanels('settingsGate');

    const panel = document.createElement('div');
    panel.id = `${APP}-settingsGate`;
    panel.className = `${APP}-panel`;
    panel.innerHTML = `
      ${panelHeader('Settings Locked', 'Faction API permission required.', '🔐', 'closeGate')}

      <div class="${APP}-card">
        <div class="${APP}-cardTitle">Verify Faction API Access</div>

        <label for="${APP}-apiKeyGate">Torn API key</label>
        <input id="${APP}-apiKeyGate" type="password" placeholder="Paste your Torn API key with faction access" autocomplete="off" value="${settings.apiKey ? '********' : ''}" />

        <p class="${APP}-note">
          The settings panel controls the faction Discord webhook and embed message.
          It only opens after this script confirms the key can read faction API data.
        </p>

        <div class="${APP}-row">
          <button type="button" class="${APP}-btn good" id="${APP}-verifyApi">Verify & Open Settings</button>
          <button type="button" class="${APP}-btn danger" id="${APP}-clearApi">Clear Saved API Key</button>
        </div>
      </div>

      <div class="${APP}-card">
        <div class="${APP}-cardTitle">API Safety</div>
        <p class="${APP}-note">
          Your API key is saved only in this browser's local storage.
          Do not share a copy of this script with your personal API key saved in it.
        </p>
      </div>
    `;

    document.body.appendChild(panel);

    $('closeGate').addEventListener('click', () => panel.remove());

    $('clearApi').addEventListener('click', () => {
      settings.apiKey = '';
      settings.settingsUnlockedUntil = 0;
      saveSettings();
      $('apiKeyGate').value = '';
      showToast('Saved API key cleared.', 'ok');
    });

    $('verifyApi').addEventListener('click', async () => {
      const inputValue = $('apiKeyGate').value.trim();
      const key = inputValue === '********' ? settings.apiKey : inputValue;

      if (!key || key.length < 8) {
        showToast('Paste a valid Torn API key first.', 'warn');
        return;
      }

      $('verifyApi').textContent = 'Checking...';
      $('verifyApi').disabled = true;

      try {
        await verifyFactionApiAccess(key);
        settings.apiKey = key;
        unlockSettingsForOneHour();
        saveSettings();
        showToast('Faction API access confirmed.', 'ok');
        panel.remove();
        openSettingsPanel();
      } catch (err) {
        console.error('[Torn Vault Request Maker] API check failed:', err);
        showToast(err.message || 'Faction API access check failed.', 'bad');
      } finally {
        const btn = $('verifyApi');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Verify & Open Settings';
        }
      }
    });
  }

  function applyPreset(presetId) {
    const preset = PRESETS[presetId];
    if (!preset) return;

    settings.embedPreset = presetId;
    settings.embedTitle = preset.title;
    settings.embedDescription = preset.description;
    settings.embedFooter = preset.footer;
    settings.embedColor = preset.color;
    saveSettings();

    if ($('embedTitle')) $('embedTitle').value = settings.embedTitle;
    if ($('embedDescription')) $('embedDescription').value = settings.embedDescription;
    if ($('embedFooter')) $('embedFooter').value = settings.embedFooter;
    if ($('embedColor')) $('embedColor').value = settings.embedColor;

    updatePresetPills();
    updateEmbedPreview();
    showToast(`${preset.name} embed preset applied.`, 'ok');
  }

  function updatePresetPills() {
    for (const id of Object.keys(PRESETS)) {
      const pill = $(`preset-${id}`);
      if (!pill) continue;
      pill.classList.toggle('active', settings.embedPreset === id);
    }
  }

  function saveSettingsFromSettingsPanel() {
    settings.webhookUrl = cleanText($('webhookUrl')?.value || '');
    settings.embedTitle = cleanText($('embedTitle')?.value || '');
    settings.embedDescription = String($('embedDescription')?.value || '').trim();
    settings.embedFooter = cleanText($('embedFooter')?.value || '');
    settings.embedColor = cleanText($('embedColor')?.value || '').replace('#', '');

    // If user manually edits, keep preset label but mark as custom.
    const matching = Object.entries(PRESETS).find(([_, p]) =>
      p.title === settings.embedTitle &&
      p.description === settings.embedDescription &&
      p.footer === settings.embedFooter &&
      p.color.toLowerCase() === settings.embedColor.toLowerCase()
    );
    settings.embedPreset = matching ? matching[0] : 'custom';

    saveSettings();
    updatePresetPills();
  }

  function updateEmbedPreview() {
    const preview = $('embedPreview');
    if (!preview) return;

    const user = parseUserDisplay($('previewUser')?.value || 'Evil_panda_420 [3236276]');
    const amount = parseAmount($('previewAmount')?.value || '1m');
    const controls = user.id && amount.ok ? makeFactionControlsGiveMoneyUrl(user.id, amount.raw) : '';
    const profile = user.id ? `https://www.torn.com/profiles.php?XID=${user.id}` : '';

    const tempSettings = {
      title: cleanText($('embedTitle')?.value || settings.embedTitle),
      description: String($('embedDescription')?.value || settings.embedDescription).trim(),
      footer: cleanText($('embedFooter')?.value || settings.embedFooter),
      color: cleanText($('embedColor')?.value || settings.embedColor)
    };

    const title = templateValue(tempSettings.title, user, amount.ok ? amount : parseAmount('1m'), controls, profile);
    const desc = templateValue(tempSettings.description, user, amount.ok ? amount : parseAmount('1m'), controls, profile);
    const footer = templateValue(tempSettings.footer, user, amount.ok ? amount : parseAmount('1m'), controls, profile);

    preview.innerHTML = `
      <div style="font-weight:900;font-size:14px;margin-bottom:6px;">${escapeHtml(title || 'New Vault Request')}</div>
      <div style="white-space:pre-wrap;margin-bottom:8px;">${escapeHtml(desc || '')}</div>
      <div class="${APP}-tiny">Embed colour: #${escapeHtml(tempSettings.color || 'e67300')}</div>
      <div class="${APP}-tiny">Footer: ${escapeHtml(footer || '')}</div>
      <div class="${APP}-tiny" style="margin-top:6px;">Buttons: Open Faction Controls + Open Player Profile</div>
    `;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function sendTestEmbed() {
    saveSettingsFromSettingsPanel();

    if (!webhookLooksValid(settings.webhookUrl)) {
      showToast('Paste a valid Discord webhook URL first.', 'warn');
      return;
    }

    const user = parseUserDisplay($('previewUser')?.value || 'Evil_panda_420 [3236276]');
    const amount = parseAmount($('previewAmount')?.value || '1m');

    if (!user.id) {
      showToast('Preview user needs a Torn ID like Name [123456].', 'warn');
      return;
    }

    if (!amount.ok) {
      showToast(amount.error, 'warn');
      return;
    }

    try {
      await postWebhook(buildPayload(user, amount));
      showToast('Test embed sent to Discord.', 'ok');
    } catch (err) {
      console.error('[Torn Vault Request Maker] Test failed:', err);
      showToast(err.message || 'Test failed.', 'bad');
    }
  }

  function openSettingsPanel() {
    if (!isSettingsUnlocked()) {
      openSettingsGate();
      return;
    }

    closeFloatingPanels('settingsPanel');

    const panel = document.createElement('div');
    panel.id = `${APP}-settingsPanel`;
    panel.className = `${APP}-panel`;
    panel.innerHTML = `
      ${panelHeader('Vault Request Settings', 'Webhook and embed message controls.', '⚙️', 'closeSettings')}

      <div class="${APP}-card">
        <div class="${APP}-cardTitle">Faction Discord Webhook</div>
        <label for="${APP}-webhookUrl">Discord webhook URL</label>
        <input id="${APP}-webhookUrl" type="password" placeholder="https://discord.com/api/webhooks/..." autocomplete="off" value="${escapeHtml(settings.webhookUrl || '')}" />
        <p class="${APP}-note">
          This webhook is where vault request embeds are sent. It is saved locally in this browser.
        </p>
      </div>

      <div class="${APP}-card">
        <div class="${APP}-cardTitle">Embed Message Presets</div>
        <div class="${APP}-pillRow">
          ${Object.entries(PRESETS).map(([id, preset]) => `
            <button type="button" class="${APP}-pill" id="${APP}-preset-${id}">${preset.name}</button>
          `).join('')}
        </div>

        <label for="${APP}-embedTitle">Embed title</label>
        <input id="${APP}-embedTitle" type="text" value="${escapeHtml(settings.embedTitle)}" />

        <label for="${APP}-embedDescription">Embed message</label>
        <textarea id="${APP}-embedDescription">${escapeHtml(settings.embedDescription)}</textarea>

        <label for="${APP}-embedFooter">Embed footer</label>
        <input id="${APP}-embedFooter" type="text" value="${escapeHtml(settings.embedFooter)}" />

        <label for="${APP}-embedColor">Embed colour hex</label>
        <input id="${APP}-embedColor" type="text" value="${escapeHtml(settings.embedColor)}" placeholder="e67300" />

        <p class="${APP}-note">
          Template codes: <b>{user}</b>, <b>{name}</b>, <b>{id}</b>, <b>{amount}</b>, <b>{raw}</b>, <b>{profile}</b>, <b>{controls}</b>
        </p>
      </div>

      <div class="${APP}-card">
        <div class="${APP}-cardTitle">Preview / Test</div>

        <label for="${APP}-previewUser">Preview user</label>
        <input id="${APP}-previewUser" type="text" value="Evil_panda_420 [3236276]" />

        <label for="${APP}-previewAmount">Preview amount</label>
        <input id="${APP}-previewAmount" type="text" value="1m" />

        <div id="${APP}-embedPreview" class="${APP}-embedPreview"></div>

        <div class="${APP}-row">
          <button type="button" class="${APP}-btn good" id="${APP}-saveSettings">Save Settings</button>
          <button type="button" class="${APP}-btn" id="${APP}-sendTest">Send Test Embed</button>
          <button type="button" class="${APP}-btn danger" id="${APP}-lockSettings">Lock Settings</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    $('closeSettings').addEventListener('click', () => panel.remove());

    for (const id of Object.keys(PRESETS)) {
      const btn = $(`preset-${id}`);
      if (btn) btn.addEventListener('click', () => applyPreset(id));
    }

    for (const id of ['webhookUrl', 'embedTitle', 'embedDescription', 'embedFooter', 'embedColor', 'previewUser', 'previewAmount']) {
      const el = $(id);
      if (!el) continue;
      el.addEventListener('input', () => {
        if (['embedTitle', 'embedDescription', 'embedFooter', 'embedColor'].includes(id)) {
          settings.embedPreset = 'custom';
          updatePresetPills();
        }
        updateEmbedPreview();
      });
    }

    $('saveSettings').addEventListener('click', () => {
      saveSettingsFromSettingsPanel();
      updateEmbedPreview();
      showToast('Settings saved locally.', 'ok');
    });

    $('sendTest').addEventListener('click', sendTestEmbed);

    $('lockSettings').addEventListener('click', () => {
      settings.settingsUnlockedUntil = 0;
      saveSettings();
      panel.remove();
      showToast('Settings locked.', 'ok');
    });

    updatePresetPills();
    updateEmbedPreview();
  }

  function addLauncher() {
    if (document.getElementById(`${APP}-launcher`)) return;

    const btn = document.createElement('button');
    btn.id = `${APP}-launcher`;
    btn.type = 'button';
    btn.textContent = 'Vault Request';
    btn.addEventListener('click', openRequestPanel);
    document.body.appendChild(btn);
  }

  function init() {
    addStyles();
    addLauncher();

    setTimeout(() => {
      if (!settings.userDisplay) {
        const detected = getCurrentUserDisplay();
        if (detected) {
          settings.userDisplay = detected;
          saveSettings();
        }
      }
    }, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
