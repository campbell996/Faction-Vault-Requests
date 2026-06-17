// ==UserScript==
// @name         Torn Vault Request Embed Settings - Faction API Locked - No Backend
// @namespace    TornVaultRequestEmbedSettingsNoBackend
// @version      2.4.0
// @description  Torn vault request panel with balance checking, Discord embeds, 5-hour timeout tracking, safer vault balance detection, transparent FVR logo launcher and panel logos, fixed Torn name/ID prefill, per-user saved request info, RWPH-style panel controls, required Discord name, no-API visible-page balance fallback, second notification webhook, banker completion notices, banker buttons, RWPH-slot launcher, movable/resizable panels, and faction API-locked settings. No backend/server.
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
    - Requests are blocked if the requested amount is above that member's faction vault balance.
    - If the member balance cannot be confirmed, the request is not sent.
    - Request amount supports: 1000000, 1m, 1b, 1t, 1.5m, $1,000,000.
    - Sends a Discord embedded message to the saved faction webhook.
    - Discord embed includes user, requested amount, verified balance, and banker instructions.
    - Discord buttons contain the Torn links. Raw links are not printed inside the embed fields/message.
    - Faction controls button opens:
      https://www.torn.com/factions.php?step=your#/tab=controls&giveMoneyTo=USER_ID&money=AMOUNT
    - Banker still manually checks, clicks Give Money, then Confirm.

    Settings:
    - Settings button opens a locked API verification panel first.
    - User must provide a Torn API key that can successfully read faction data.
    - Settings panel lets faction staff paste the Discord webhook URL.
    - Settings panel has preset buttons to change the embed style/message.
    - Embed colour uses a colour picker and the preview updates live.
    - Settings are local to this browser because there is no backend/server.

    Optional sharing setup:
    - If you want to distribute a preconfigured copy, paste your faction webhook into
      DEFAULT_FACTION_WEBHOOK_URL below before sharing the script.
    - Do not publicly share a real webhook. Anyone with the webhook can post to that channel.
    - Do not publicly share a script with your API key saved in browser storage.
  */

  const APP = 'TVRES_FACTION_API_LOCK';
  const STORE_KEY = `${APP}:settings`;

  // Optional hard-coded webhook for your faction copy. Leave blank if using Settings panel.
  const DEFAULT_FACTION_WEBHOOK_URL = '';
  const REQUEST_TIMEOUT_MS = 5 * 60 * 60 * 1000;
  const REQUEST_CHECK_MS = 60 * 1000;
  const MAX_NOTIFICATIONS = 25;
  const MAX_PENDING_REQUESTS = 50;

  const DEFAULT_SETTINGS = {
    webhookUrl: DEFAULT_FACTION_WEBHOOK_URL,
    userNotifyWebhookUrl: '',
    apiKey: '',
    userDisplay: '',
    amountInput: '',
    settingsUnlockedUntil: 0,

    embedTitle: 'New Vault Request',
    embedDescription: '**{user}** requested **{amount}** from the faction vault.\n\nThis request expires {expires}.',
    embedFooter: 'No backend/server. Manual banker approval required.',
    embedColor: 'e67300',
    embedPreset: 'default',

    lastBalanceUserId: '',
    lastBalanceAmount: null,
    lastBalanceCheckedAt: 0,
    panelPositions: {},
    pendingRequests: [],
    requestNotifications: [],
    discordUserId: '',
    discordName: '',
    userProfiles: {},
    lastDetectedUserId: '',

    timeoutNotifyTitle: 'Vault Request Timed Out',
    timeoutNotifyMessage: '{user} your vault request for {amount} timed out before a banker could complete it.',
    timeoutNotifyFooter: 'Please make another request if you still need it.',
    timeoutNotifyColor: 'ed4245',

    fulfilledNotifyTitle: 'Vault Request Fulfilled',
    fulfilledNotifyMessage: '{user} your vault request for {amount} was fulfilled by {banker}.',
    fulfilledNotifyFooter: 'Completed by faction banker.',
    fulfilledNotifyColor: '3ba55d'
  };

  const PRESETS = {
    default: {
      name: 'Default',
      title: 'New Vault Request',
      description: '**{user}** requested **{amount}** from the faction vault.\n\nThis request expires {expires}.',
      footer: 'No backend/server. Manual banker approval required.',
      color: 'e67300'
    },
    rwph: {
      name: 'RWPH Style',
      title: 'Ranked War Vault Request',
      description: 'A faction member has submitted a money request.\n\n**Member:** {user}\n**Amount:** {amount}\n**Vault Balance:** {balance}\n**Expires:** {expires}\n\nBanker: open the button below, check the details, then manually pay.',
      footer: 'RWPH-style request helper. Banker must confirm manually.',
      color: 'ffb347'
    },
    banker: {
      name: 'Banker Detailed',
      title: 'Banker Action Needed',
      description: '**{user}** needs **{amount}**.\n\nVerified available vault balance: **{balance}**.\nExpires: **{expires}**.\n\nUse the button below to open faction controls with the user ID and amount prefilled.',
      footer: 'Please confirm the member and amount in Torn before sending.',
      color: '3ba55d'
    },
    compact: {
      name: 'Compact',
      title: 'Vault Request',
      description: '{user} → {amount}\nBalance checked: {balance}\nExpires: {expires}',
      footer: 'Manual payment required.',
      color: '5865f2'
    },
    urgent: {
      name: 'Urgent',
      title: 'URGENT Vault Request',
      description: '⚠️ **Vault request waiting**\n\n**User:** {user}\n**Amount:** {amount}\n**Verified Balance:** {balance}\n**Expires:** {expires}\n\nBanker action required.',
      footer: 'Open controls, verify, then manually pay.',
      color: 'ed4245'
    }
  };

  let settings = loadSettings();
  let submitLocked = false;
  let balanceCheckLocked = false;
  let balanceDebounceTimer = null;

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

  function ensureUserProfiles() {
    if (!settings.userProfiles || typeof settings.userProfiles !== 'object' || Array.isArray(settings.userProfiles)) {
      settings.userProfiles = {};
    }
    return settings.userProfiles;
  }

  function profileKeyFromUser(user) {
    const id = String(user?.id || '').replace(/[^\d]/g, '');
    return id ? `torn:${id}` : '';
  }

  function displayFromUser(user) {
    if (!user?.id || !user?.name) return '';
    return `${cleanText(user.name)} [${String(user.id).replace(/[^\d]/g, '')}]`;
  }

  function getProfileForUser(user) {
    const key = profileKeyFromUser(user);
    if (!key) return null;
    return ensureUserProfiles()[key] || null;
  }

  function saveProfileForUser(user, patch = {}) {
    const key = profileKeyFromUser(user);
    if (!key) return;

    const profiles = ensureUserProfiles();
    const current = profiles[key] || {};
    profiles[key] = {
      ...current,
      ...patch,
      tornName: user.name || current.tornName || '',
      tornId: String(user.id || current.tornId || ''),
      userDisplay: patch.userDisplay || current.userDisplay || displayFromUser(user),
      updatedAt: Date.now()
    };

    settings.lastDetectedUserId = String(user.id || '');
    saveSettings();
  }

  function getTypedUserFromPanelOrSettings() {
    const raw = $('user')?.value || settings.userDisplay || '';
    const parsed = parseUserDisplay(raw);
    return parsed?.id ? parsed : null;
  }

  function getCurrentUserProfileKey() {
    const typed = getTypedUserFromPanelOrSettings();
    if (typed?.id) return profileKeyFromUser(typed);

    const id = String(settings.lastDetectedUserId || '').replace(/[^\d]/g, '');
    return id ? `torn:${id}` : '';
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

  function formatMoney(amount) {
    const safe = Number(amount || 0);
    return `$${Math.max(0, Math.floor(safe)).toLocaleString('en-US')}`;
  }

  function webhookLooksValid(url) {
    return /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+/i.test(String(url || '').trim());
  }

  function webhookUrlWithParams(url, options = {}) {
    const raw = String(url || '').trim();
    const withComponents = options.withComponents !== false;
    const wait = !!options.wait;

    try {
      const u = new URL(raw);
      if (withComponents) u.searchParams.set('with_components', 'true');
      if (wait) u.searchParams.set('wait', 'true');
      return u.toString();
    } catch {
      const params = [];
      if (withComponents) params.push('with_components=true');
      if (wait) params.push('wait=true');
      const join = raw.includes('?') ? '&' : '?';
      return params.length ? `${raw}${join}${params.join('&')}` : raw;
    }
  }

  function getWebhookEditUrl(messageId) {
    const raw = String(settings.webhookUrl || '').trim();

    try {
      const u = new URL(raw);
      u.search = '';
      u.hash = '';
      return `${u.toString().replace(/\/$/, '')}/messages/${encodeURIComponent(messageId)}`;
    } catch {
      const clean = raw.split('?')[0].replace(/\/$/, '');
      return `${clean}/messages/${encodeURIComponent(messageId)}`;
    }
  }

  function makeRequestId(userId, amountRaw) {
    return `${Date.now()}-${String(userId || 'unknown')}-${String(amountRaw || '0')}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeDiscordUserId(value) {
    return String(value || '').replace(/[^\d]/g, '').trim();
  }

  function normalizeDiscordName(value) {
    return cleanText(value)
      .replace(/^@+/, '')
      .slice(0, 80);
  }

  function formatDiscordName(value) {
    const name = normalizeDiscordName(value);
    return name ? `@${name}` : '';
  }

  function getWebhookByKind(kind = 'request') {
    return kind === 'notify' ? settings.userNotifyWebhookUrl : settings.webhookUrl;
  }

  function formatTornMention(user) {
    const fallback = user?.display || user?.name || 'Unknown';
    const name = cleanText(fallback).replace(/\s*\[\d+\]\s*$/, '') || 'Unknown';
    const id = String(user?.id || '').replace(/[^\d]/g, '');
    return id ? `@${name} [${id}]` : `@${name}`;
  }

  function parseTornUserDisplay(value) {
    const parsed = parseUserDisplay(value);
    return {
      display: parsed.display || value || 'Unknown',
      name: parsed.name || 'Unknown',
      id: parsed.id || ''
    };
  }

  function readFvrParam(name) {
    const raw = `${location.search || ''}&${String(location.hash || '').replace(/^#/, '')}`;
    const match = raw.match(new RegExp(`[?&#]${name}=([^&#]*)`, 'i'));
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
  }

  function getCurrentPageRequestParams() {
    return {
      requestId: readFvrParam('fvrRequestId'),
      userId: readFvrParam('fvrUserId') || readFvrParam('giveMoneyTo'),
      userDisplay: readFvrParam('fvrUser'),
      userName: readFvrParam('fvrUserName'),
      amountRaw: String(readFvrParam('fvrAmountRaw') || readFvrParam('money')).replace(/[^\d]/g, ''),
      amountFormatted: readFvrParam('fvrAmountFormatted'),
      balanceFormatted: readFvrParam('fvrBalanceFormatted'),
      discordName: readFvrParam('fvrDiscordName'),
      createdAt: Number(readFvrParam('fvrCreatedAt') || 0),
      expiresAt: Number(readFvrParam('fvrExpiresAt') || 0)
    };
  }

  function parseBankerDisplay(value) {
    const parsed = parseUserDisplay(value);
    return {
      display: parsed.display || value || 'Unknown Banker',
      name: parsed.name || 'Unknown Banker',
      id: parsed.id || ''
    };
  }

  function cleanNoticeColor(value, fallback = '5865f2') {
    const raw = String(value || '').replace('#', '').trim();
    return /^[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : fallback;
  }

  function parseColor(value) {
    const raw = String(value || '').replace('#', '').trim();
    if (!/^[0-9a-f]{6}$/i.test(raw)) return 15105570;
    return parseInt(raw, 16);
  }

  function cleanHex(value) {
    const raw = String(value || '').replace('#', '').trim();
    return /^[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : 'e67300';
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

  function findSelfFromStorage() {
    const stores = [];

    try { stores.push(localStorage); } catch {}
    try { stores.push(sessionStorage); } catch {}

    const patterns = [
      /"name"\s*:\s*"([^"]{2,40})"[^{}]{0,350}"(?:userID|userId|id|player_id|playerId|XID|xid)"\s*:\s*"?(\d{3,12})"?/i,
      /"(?:userID|userId|id|player_id|playerId|XID|xid)"\s*:\s*"?(\d{3,12})"?[^{}]{0,350}"name"\s*:\s*"([^"]{2,40})"/i,
      /(?:userName|username|playerName|name)["']?\s*[:=]\s*["']([^"']{2,40})["'][\s\S]{0,350}(?:userID|userId|playerId|player_id|XID|xid|id)["']?\s*[:=]\s*["']?(\d{3,12})/i,
      /(?:userID|userId|playerId|player_id|XID|xid|id)["']?\s*[:=]\s*["']?(\d{3,12})["']?[\s\S]{0,350}(?:userName|username|playerName|name)["']?\s*[:=]\s*["']([^"']{2,40})["']/i
    ];

    for (const store of stores) {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        const value = `${key || ''} ${store.getItem(key) || ''}`;
        if (!/user|player|torn|profile|session|auth/i.test(value)) continue;

        for (const re of patterns) {
          const m = value.match(re);
          if (!m) continue;

          const a = m[1];
          const b = m[2];
          const firstIsId = /^\d+$/.test(a);
          const id = firstIsId ? a : b;
          const name = firstIsId ? b : a;

          if (name && id) return { name: cleanText(name), id: String(id).replace(/[^\d]/g, '') };
        }
      }
    }

    return null;
  }

  function findSelfFromHtml() {
    const html = String(document.documentElement?.innerHTML || '').slice(0, 1500000);

    const patterns = [
      /(?:userName|username|playerName|name)["']?\s*[:=]\s*["']([^"']{2,40})["'][\s\S]{0,500}(?:userID|userId|playerId|player_id|XID|xid|id)["']?\s*[:=]\s*["']?(\d{3,12})/i,
      /(?:userID|userId|playerId|player_id|XID|xid|id)["']?\s*[:=]\s*["']?(\d{3,12})["']?[\s\S]{0,500}(?:userName|username|playerName|name)["']?\s*[:=]\s*["']([^"']{2,40})["']/i,
      /profiles\.php\?XID=(\d{3,12})["'][^>]{0,500}>([^<]{2,40})</i
    ];

    for (const re of patterns) {
      const m = html.match(re);
      if (!m) continue;

      const a = m[1];
      const b = m[2];
      const firstIsId = /^\d+$/.test(a);
      const id = firstIsId ? a : b;
      const name = cleanText(firstIsId ? b : a).replace(/<[^>]*>/g, '');

      if (name && id && !/faction|bank|vault|warfare|points|merits/i.test(name)) {
        return { name, id: String(id).replace(/[^\d]/g, '') };
      }
    }

    return null;
  }

  function findSelfFromProfileLinksAggressive() {
    const links = Array.from(document.querySelectorAll('a[href*="profiles.php?XID="], a[href*="/profiles.php?XID="]'))
      .map(link => {
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/XID=(\d{3,12})/i);
        const id = idMatch ? idMatch[1] : '';
        let name = cleanText(link.textContent || link.getAttribute('title') || link.getAttribute('aria-label') || '');
        name = name.replace(/\s*\[\d+\]\s*$/, '').replace(/^(profile|view profile)\s*/i, '').trim();

        let score = scoreProfileLink(link);
        let node = link;
        for (let i = 0; node && i < 7; i++, node = node.parentElement) {
          const blob = `${node.id || ''} ${node.className || ''}`.toLowerCase();
          if (/sidebar|top|header|logged|account|user|profile|menu|status|bar/.test(blob)) score += 8;
          if (/faction|member|bank|vault|war|attack|enemy|list|table/.test(blob)) score -= 8;
        }

        const rect = link.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < 160) score += 12;
        if (rect.left >= 0 && rect.left < 420) score += 5;

        return { id, name, score };
      })
      .filter(x => x.id && x.name && x.name.length <= 40)
      .sort((a, b) => b.score - a.score);

    if (links[0] && links[0].score > 0) {
      return { name: links[0].name, id: links[0].id };
    }

    return null;
  }

  function detectCurrentTornUser() {
    const found =
      findSelfFromWindow() ||
      findSelfFromDom() ||
      findSelfFromProfileLinksAggressive() ||
      findSelfFromScripts() ||
      findSelfFromStorage() ||
      findSelfFromHtml();

    if (found?.name && found?.id) {
      const clean = {
        name: cleanText(found.name).replace(/\s*\[\d+\]\s*$/, '').trim(),
        id: String(found.id).replace(/[^\d]/g, '')
      };

      if (clean.name && clean.id) {
        settings.lastDetectedUserId = clean.id;
        return clean;
      }
    }

    return null;
  }

  function getCurrentUserDisplay() {
    const found = detectCurrentTornUser();
    return found ? displayFromUser(found) : '';
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
      formatted: formatMoney(amount)
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

  function escapeDiscordKeepAt(value) {
    return String(value || '')
      .replace(/`/g, "'")
      .slice(0, 2000);
  }

  function templateValue(template, user, amount, balance, request = {}) {
    const expiresAt = Number(request.expiresAt || 0);
    const expiresDiscord = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : '5 hours';
    const expiresFull = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:F>` : 'Not set';
    return String(template || '')
      .replaceAll('{user}', user.display || `${user.name} [${user.id}]`)
      .replaceAll('{name}', user.name || 'Unknown')
      .replaceAll('{id}', user.id || '')
      .replaceAll('{amount}', amount.formatted || '')
      .replaceAll('{raw}', amount.raw || '')
      .replaceAll('{balance}', balance?.formatted || 'Not checked')
      .replaceAll('{expires}', expiresDiscord)
      .replaceAll('{expiresFull}', expiresFull)
      .replaceAll('{status}', request.status || 'Pending');
  }

  function buildPayload(user, amount, balance, request = {}) {
    const profileUrl = user.id ? `https://www.torn.com/profiles.php?XID=${user.id}` : '';
    let controlsUrl = user.id ? makeFactionControlsGiveMoneyUrl(user.id, amount.raw) : 'https://www.torn.com/factions.php?step=your#/tab=controls';
    const expiresAt = Number(request.expiresAt || (Date.now() + REQUEST_TIMEOUT_MS));

    const fvrParams = new URLSearchParams({
      fvrRequestId: request.id || '',
      fvrUser: user.display || `${user.name} [${user.id}]`,
      fvrUserName: user.name || '',
      fvrUserId: user.id || '',
      fvrAmountRaw: amount.raw || '',
      fvrAmountFormatted: amount.formatted || '',
      fvrBalanceFormatted: balance?.formatted || '',
      fvrDiscordName: normalizeDiscordName(request.discordName || settings.discordName || ''),
      fvrCreatedAt: String(request.createdAt || Date.now()),
      fvrExpiresAt: String(expiresAt)
    });

    controlsUrl += `&${fvrParams.toString()}`;
    const expiresUnix = Math.floor(expiresAt / 1000);

    const templateRequest = {
      ...request,
      status: request.status || 'Pending',
      expiresAt
    };

    const title = templateValue(settings.embedTitle, user, amount, balance, templateRequest).slice(0, 256);
    const description = templateValue(settings.embedDescription, user, amount, balance, templateRequest).slice(0, 4000);
    const footer = templateValue(settings.embedFooter, user, amount, balance, templateRequest).slice(0, 2048);

    const fields = [
      { name: 'User', value: escapeDiscord(user.display || `${user.name} [${user.id}]`), inline: true },
      { name: 'Amount Requested', value: amount.formatted, inline: true },
      { name: 'Verified Vault Balance', value: balance?.formatted || 'Not checked', inline: true },
      { name: 'Status', value: request.status || 'Pending', inline: true },
      { name: 'Expires', value: `<t:${expiresUnix}:R>`, inline: true },
      { name: 'Expires At', value: `<t:${expiresUnix}:F>`, inline: false },
      { name: 'Banker Action', value: 'Use the button below, check the prefilled user and amount, then manually click **Give Money** and **Confirm** in Torn.', inline: false }
    ];

    const discordName = normalizeDiscordName(request.discordName || settings.discordName || '');

    if (discordName) {
      fields.splice(1, 0, { name: 'Discord Name', value: escapeDiscordKeepAt(formatDiscordName(discordName)), inline: true });
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

  function buildExpiredPayload(record) {
    const user = record.user || { display: 'Unknown', name: 'Unknown', id: '' };
    const amount = record.amount || { formatted: '$0', raw: '0' };
    const balance = record.balance || { formatted: 'Not checked' };
    const expiredAt = Number(record.expiresAt || Date.now());
    const discordName = normalizeDiscordName(record.discordName || '');

    return {
      username: 'Torn Vault Request',
      avatar_url: 'https://www.torn.com/favicon.ico',
      content: '',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: 'Vault Request Expired',
          description: `**${escapeDiscord(user.display || `${user.name} [${user.id}]`)}** requested **${amount.formatted}**, but the request timed out after 5 hours.`,
          color: 0x747f8d,
          fields: [
            { name: 'User', value: escapeDiscord(user.display || `${user.name} [${user.id}]`), inline: true },
            ...(discordName ? [{ name: 'Discord Name', value: escapeDiscordKeepAt(formatDiscordName(discordName)), inline: true }] : []),
            { name: 'Amount Requested', value: amount.formatted, inline: true },
            { name: 'Verified Vault Balance', value: balance.formatted || 'Not checked', inline: true },
            { name: 'Status', value: 'Expired', inline: true },
            { name: 'Expired At', value: `<t:${Math.floor(expiredAt / 1000)}:F>`, inline: false },
            { name: 'Next Step', value: 'The user needs to make another request if they still need funds.', inline: false }
          ],
          footer: { text: 'Request expired. Buttons removed.' },
          timestamp: new Date().toISOString()
        }
      ],
      components: []
    };
  }

  function noticeTemplateValue(template, record = {}, banker = {}) {
    const user = record.user || {};
    const amount = record.amount || { formatted: '$0', raw: '0' };
    const balance = record.balance || { formatted: 'Not checked' };
    const createdAt = Number(record.createdAt || Date.now());
    const expiresAt = Number(record.expiresAt || Date.now());
    const completedAt = Number(record.completedAt || Date.now());

    return String(template || '')
      .replaceAll('{user}', formatTornMention(user))
      .replaceAll('{tornname}', formatTornMention(user))
      .replaceAll('{name}', user.name || 'Unknown')
      .replaceAll('{id}', user.id || '')
      .replaceAll('{discord}', formatDiscordName(record.discordName || ''))
      .replaceAll('{discordName}', normalizeDiscordName(record.discordName || ''))
      .replaceAll('{amount}', amount.formatted || '$0')
      .replaceAll('{raw}', amount.raw || '0')
      .replaceAll('{balance}', balance.formatted || 'Not checked')
      .replaceAll('{banker}', banker?.display ? formatTornMention(banker) : '@Unknown Banker')
      .replaceAll('{bankerName}', banker?.name || 'Unknown Banker')
      .replaceAll('{bankerId}', banker?.id || '')
      .replaceAll('{createdAt}', `<t:${Math.floor(createdAt / 1000)}:F>`)
      .replaceAll('{expires}', `<t:${Math.floor(expiresAt / 1000)}:R>`)
      .replaceAll('{expiresFull}', `<t:${Math.floor(expiresAt / 1000)}:F>`)
      .replaceAll('{timedOutAt}', `<t:${Math.floor(Date.now() / 1000)}:F>`)
      .replaceAll('{completedAt}', `<t:${Math.floor(completedAt / 1000)}:F>`);
  }

  function buildUserTimeoutPayload(record) {
    const user = record.user || { display: 'Unknown', name: 'Unknown', id: '' };
    const amount = record.amount || { formatted: '$0', raw: '0' };
    const balance = record.balance || { formatted: 'Not checked' };
    const expiredAt = Number(record.expiresAt || Date.now());

    const title = noticeTemplateValue(settings.timeoutNotifyTitle, record).slice(0, 256) || 'Vault Request Timed Out';
    const description = noticeTemplateValue(settings.timeoutNotifyMessage, record).slice(0, 4000);
    const footer = noticeTemplateValue(settings.timeoutNotifyFooter, record).slice(0, 2048);

    return {
      username: 'Torn Vault Request Notice',
      avatar_url: 'https://www.torn.com/favicon.ico',
      content: '',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: escapeDiscord(title),
          description: escapeDiscordKeepAt(description || `${formatTornMention(user)} your vault request timed out before a banker could complete it.`),
          color: parseColor(settings.timeoutNotifyColor),
          fields: [
            { name: 'User', value: escapeDiscordKeepAt(formatTornMention(user)), inline: true },
            ...(record.discordName ? [{ name: 'Discord Name', value: escapeDiscordKeepAt(formatDiscordName(record.discordName)), inline: true }] : []),
            { name: 'Amount Requested', value: amount.formatted || '$0', inline: true },
            { name: 'Verified Vault Balance', value: balance.formatted || 'Not checked', inline: true },
            { name: 'Status', value: 'Timed out', inline: true },
            { name: 'Timed Out At', value: `<t:${Math.floor(expiredAt / 1000)}:F>`, inline: false },
            { name: 'What To Do', value: 'Please make another vault request if you still need the money.', inline: false }
          ],
          footer: { text: footer || 'Request timed out after 5 hours.' },
          timestamp: new Date().toISOString()
        }
      ],
      components: []
    };
  }

  function buildUserFulfilledPayload(record, banker) {
    const user = record.user || { display: 'Unknown', name: 'Unknown', id: '' };
    const amount = record.amount || { formatted: '$0', raw: '0' };
    const completedAt = Number(record.completedAt || Date.now());

    const title = noticeTemplateValue(settings.fulfilledNotifyTitle, record, banker).slice(0, 256) || 'Vault Request Fulfilled';
    const description = noticeTemplateValue(settings.fulfilledNotifyMessage, record, banker).slice(0, 4000);
    const footer = noticeTemplateValue(settings.fulfilledNotifyFooter, record, banker).slice(0, 2048);

    return {
      username: 'Torn Vault Request Notice',
      avatar_url: 'https://www.torn.com/favicon.ico',
      content: '',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: escapeDiscord(title),
          description: escapeDiscordKeepAt(description || `${formatTornMention(user)} your vault request was fulfilled by ${formatTornMention(banker)}.`),
          color: parseColor(settings.fulfilledNotifyColor),
          fields: [
            { name: 'User', value: escapeDiscordKeepAt(formatTornMention(user)), inline: true },
            ...(record.discordName ? [{ name: 'Discord Name', value: escapeDiscordKeepAt(formatDiscordName(record.discordName)), inline: true }] : []),
            { name: 'Amount', value: amount.formatted || '$0', inline: true },
            { name: 'Banker', value: escapeDiscordKeepAt(formatTornMention(banker)), inline: true },
            { name: 'Completed At', value: `<t:${Math.floor(completedAt / 1000)}:F>`, inline: false }
          ],
          footer: { text: footer || 'Completed by faction banker.' },
          timestamp: new Date().toISOString()
        }
      ],
      components: []
    };
  }

  function buildMainFulfilledPayload(record, banker) {
    const user = record.user || { display: 'Unknown', name: 'Unknown', id: '' };
    const amount = record.amount || { formatted: '$0', raw: '0' };
    const balance = record.balance || { formatted: 'Not checked' };
    const completedAt = Number(record.completedAt || Date.now());

    return {
      username: 'Torn Vault Request',
      avatar_url: 'https://www.torn.com/favicon.ico',
      content: '',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: 'Vault Request Fulfilled',
          description: `**${escapeDiscordKeepAt(formatTornMention(user))}** requested **${amount.formatted}** and it was fulfilled by **${escapeDiscordKeepAt(formatTornMention(banker))}**.`,
          color: parseColor(settings.fulfilledNotifyColor),
          fields: [
            { name: 'User', value: escapeDiscordKeepAt(formatTornMention(user)), inline: true },
            ...(record.discordName ? [{ name: 'Discord Name', value: escapeDiscordKeepAt(formatDiscordName(record.discordName)), inline: true }] : []),
            { name: 'Amount Requested', value: amount.formatted || '$0', inline: true },
            { name: 'Verified Vault Balance', value: balance.formatted || 'Not checked', inline: true },
            { name: 'Status', value: 'Fulfilled', inline: true },
            { name: 'Banker', value: escapeDiscordKeepAt(formatTornMention(banker)), inline: true },
            { name: 'Completed At', value: `<t:${Math.floor(completedAt / 1000)}:F>`, inline: false }
          ],
          footer: { text: 'Request fulfilled. Buttons removed.' },
          timestamp: new Date().toISOString()
        }
      ],
      components: []
    };
  }

  async function postWebhook(payload, options = {}) {
    const webhook = getWebhookByKind(options.kind || 'request');

    if (!webhookLooksValid(webhook)) {
      throw new Error(options.kind === 'notify'
        ? 'Add a valid user notification webhook URL in Settings first.'
        : 'Add a valid Discord webhook URL in Settings first.');
    }

    const res = await gmRequest({
      method: 'POST',
      url: webhookUrlWithParams(webhook, { withComponents: true, wait: !!options.wait }),
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

  async function editWebhookMessage(messageId, payload) {
    if (!messageId) throw new Error('Missing Discord message ID.');
    if (!webhookLooksValid(settings.webhookUrl)) {
      throw new Error('Add a valid Discord webhook URL in Settings first.');
    }

    const res = await gmRequest({
      method: 'PATCH',
      url: webhookUrlWithParams(getWebhookEditUrl(messageId), { withComponents: true, wait: false }),
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
      errorMessage: 'Discord webhook edit failed.',
      timeoutMessage: 'Discord webhook edit timed out.'
    });

    if (!(res.status >= 200 && res.status < 300)) {
      throw new Error(`Discord edit returned HTTP ${res.status}. ${String(res.responseText || '').slice(0, 180)}`);
    }

    return res;
  }

  async function tornApiGet(url, headers = {}) {
    const res = await gmRequest({
      method: 'GET',
      url,
      headers,
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

    if (data.ID || data.name || data.tag || data.leader || data.members || data.basic) return true;
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

    const stamp = Date.now();
    const urls = [
      `https://api.torn.com/faction/?selections=basic&key=${encodeURIComponent(key)}&timestamp=${stamp}`,
      `https://api.torn.com/faction/?selections=&key=${encodeURIComponent(key)}&timestamp=${stamp}`,
      `https://api.torn.com/v2/faction/basic?key=${encodeURIComponent(key)}&timestamp=${stamp}`
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

  function normalizeMoneyValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
    if (typeof value === 'string') {
      const cleaned = value.replace(/[$,\s]/g, '');
      if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Math.floor(Number(cleaned));
    }
    return null;
  }

  async function fetchFactionBalanceData(apiKey) {
    const key = cleanText(apiKey);

    if (!key || key.length < 8) {
      throw new Error('A saved Torn API key with faction access is required for balance checks.');
    }

    const stamp = Date.now();

    const attempts = [
      {
        url: `https://api.torn.com/v2/faction/balance?cat=all&timestamp=${stamp}`,
        headers: { Authorization: `ApiKey ${key}`, Accept: 'application/json' }
      },
      {
        url: `https://api.torn.com/v2/faction/balance?cat=all&key=${encodeURIComponent(key)}&timestamp=${stamp}`,
        headers: { Accept: 'application/json' }
      },
      {
        url: `https://api.torn.com/faction/?selections=balance&key=${encodeURIComponent(key)}&timestamp=${stamp}`,
        headers: { Accept: 'application/json' }
      },
      {
        url: `https://api.torn.com/faction/?selections=currency,basic&key=${encodeURIComponent(key)}&timestamp=${stamp}`,
        headers: { Accept: 'application/json' }
      },
      {
        url: `https://api.torn.com/faction/?selections=donations,basic&key=${encodeURIComponent(key)}&timestamp=${stamp}`,
        headers: { Accept: 'application/json' }
      }
    ];

    const errors = [];

    for (const attempt of attempts) {
      try {
        const { status, data } = await tornApiGet(attempt.url, attempt.headers);

        if (data?.error) {
          errors.push(getApiError(data) || 'Torn API returned an error.');
          continue;
        }

        if (status >= 200 && status < 300 && data && typeof data === 'object') {
          return data;
        }

        errors.push(`Torn API returned HTTP ${status}.`);
      } catch (err) {
        errors.push(err.message || String(err));
      }
    }

    throw new Error(errors[0] || 'Could not read faction vault balance data.');
  }

  function collectMemberBalanceCandidates(data, userId) {
    const target = String(userId || '').trim();
    const candidates = [];
    const seen = new WeakSet();

    const preferredFields = [
      'money',
      'balance',
      'money_balance',
      'vault_balance',
      'faction_balance',
      'faction_money',
      'funds',
      'cash',
      'amount',
      'available',
      'available_money',
      'current',
      'total'
    ];

    const idFields = [
      'id',
      'user_id',
      'userId',
      'torn_id',
      'tornId',
      'player_id',
      'playerId',
      'XID',
      'xid',
      'uid'
    ];

    function pathScore(path, field) {
      const p = path.join('.').toLowerCase();
      const f = String(field || '').toLowerCase();
      let score = 0;

      if (p.includes('balance')) score += 14;
      if (p.includes('balances')) score += 14;
      if (p.includes('member')) score += 10;
      if (p.includes('members')) score += 10;
      if (p.includes('vault')) score += 10;
      if (p.includes('faction')) score += 7;
      if (p.includes('bank')) score += 7;
      if (p.includes('money')) score += 5;
      if (p.includes('donation')) score += 3;

      if (f === 'money') score += 16;
      if (f.includes('balance')) score += 14;
      if (f.includes('vault')) score += 12;
      if (f.includes('faction')) score += 8;
      if (f.includes('available')) score += 8;
      if (f === 'cash' || f === 'funds') score += 5;
      if (f === 'amount' || f === 'total') score += 2;

      return score;
    }

    function objectHasMatchingId(obj, keyName) {
      if (String(keyName) === target) return true;

      for (const idField of idFields) {
        if (Object.prototype.hasOwnProperty.call(obj, idField) && String(obj[idField]) === target) {
          return true;
        }
      }

      return false;
    }

    function addCandidate(amount, field, path, scoreBoost = 0) {
      if (amount === null || !Number.isFinite(amount) || amount < 0) return;

      candidates.push({
        amount,
        field,
        path: path.join('.'),
        score: pathScore(path, field) + scoreBoost
      });
    }

    function addCandidatesFromObject(obj, path, keyName) {
      if (!obj || typeof obj !== 'object') return;
      if (!objectHasMatchingId(obj, keyName)) return;

      for (const field of preferredFields) {
        if (!Object.prototype.hasOwnProperty.call(obj, field)) continue;
        addCandidate(normalizeMoneyValue(obj[field]), field, path.concat(field), 0);
      }

      for (const wrapField of ['money', 'balance', 'balances', 'vault', 'faction', 'bank', 'member']) {
        const wrap = obj[wrapField];
        if (!wrap || typeof wrap !== 'object') continue;

        for (const field of preferredFields) {
          if (!Object.prototype.hasOwnProperty.call(wrap, field)) continue;
          addCandidate(normalizeMoneyValue(wrap[field]), `${wrapField}.${field}`, path.concat(wrapField, field), 4);
        }
      }
    }

    function walk(node, path = [], keyName = '') {
      if (node === null || node === undefined) return;

      if (typeof node !== 'object') {
        if (String(keyName) === target) {
          addCandidate(normalizeMoneyValue(node), keyName, path, 5);
        }
        return;
      }

      if (seen.has(node)) return;
      seen.add(node);

      if (Array.isArray(node)) {
        node.forEach((child, index) => walk(child, path.concat(String(index)), String(index)));
        return;
      }

      addCandidatesFromObject(node, path, keyName);

      for (const [key, value] of Object.entries(node)) {
        if (String(key) === target && typeof value !== 'object') {
          addCandidate(normalizeMoneyValue(value), key, path.concat(key), 4);
        }

        walk(value, path.concat(key), key);
      }
    }

    walk(data, [], '');

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  function parseMoneyTokensFromText(text) {
    const raw = String(text || '');
    const matches = [];

    const patterns = [
      /\$\s*[\d,]+(?:\.\d+)?/g,
      /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(raw))) {
        const amount = normalizeMoneyValue(match[0]);
        if (amount !== null && amount >= 0) {
          matches.push({
            amount,
            raw: match[0],
            index: match.index
          });
        }
      }
    }

    const seen = new Set();
    return matches.filter(item => {
      const key = `${item.amount}:${item.index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isGoodBalanceLabel(text) {
    return /\b(balance|vault|funds|available|available balance|money balance|bank balance|cash balance|member balance|faction balance)\b/i.test(String(text || ''));
  }

  function isBadBalanceLabel(text) {
    return /\b(request|requested|requesting|amount requested|give money|confirm|send|deposit|withdraw|paid|payment|fee|cost|price|total faction|faction total|vault total|bank total|total vault|total balance|networth|points|respect|bonus)\b/i.test(String(text || ''));
  }

  function rowContainsUser(text, user) {
    const lower = String(text || '').toLowerCase();
    const id = String(user?.id || '').trim();
    const name = cleanText(user?.name || user?.display || '')
      .replace(/\s*\[\d+\]\s*$/, '')
      .toLowerCase();

    return !!((id && lower.includes(id)) || (name && name.length >= 2 && lower.includes(name)));
  }

  function getTableHeadersForRow(row) {
    const table = row.closest('table');
    if (!table) return [];

    const allRows = Array.from(table.querySelectorAll('tr'));
    const headerRows = allRows.filter(r =>
      r !== row &&
      r.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING &&
      Array.from(r.children).some(c => c.matches('th') || /balance|vault|funds|available|member|user|name/i.test(c.textContent || ''))
    );

    const headerRow = headerRows[headerRows.length - 1] || table.querySelector('thead tr') || allRows.find(r => Array.from(r.children).some(c => c.matches('th')));

    if (!headerRow) return [];

    return Array.from(headerRow.children).map(c => cleanText(c.innerText || c.textContent || ''));
  }

  function scanTableRowsForVisibleBalance(user) {
    const candidates = [];

    for (const row of Array.from(document.querySelectorAll('tr'))) {
      if (!row || row.closest?.(`.${APP}-panel`)) continue;
      if (!isVisibleElement(row)) continue;

      const rowText = cleanText(row.innerText || row.textContent || '');
      if (!rowContainsUser(rowText, user)) continue;
      if (isBadBalanceLabel(rowText) && !isGoodBalanceLabel(rowText)) continue;

      const cells = Array.from(row.children).filter(c => isVisibleElement(c));
      if (!cells.length) continue;

      const headers = getTableHeadersForRow(row);

      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const cellText = cleanText(cell.innerText || cell.textContent || '');
        const moneyTokens = parseMoneyTokensFromText(cellText);

        if (!moneyTokens.length) continue;

        const headerText = cleanText(headers[i] || cell.getAttribute('data-title') || cell.getAttribute('aria-label') || '');
        const previousText = cleanText(cells[i - 1]?.innerText || cells[i - 1]?.textContent || '');
        const nextText = cleanText(cells[i + 1]?.innerText || cells[i + 1]?.textContent || '');
        const context = `${headerText} ${previousText} ${cellText} ${nextText} ${rowText}`;
        const strongLabel = isGoodBalanceLabel(`${headerText} ${previousText} ${nextText}`) || isGoodBalanceLabel(cell.getAttribute('class') || '');
        const badLabel = isBadBalanceLabel(`${headerText} ${previousText} ${nextText}`);

        for (const money of moneyTokens) {
          let score = 0;

          if (strongLabel) score += 120;
          if (isGoodBalanceLabel(context)) score += 55;
          if (badLabel) score -= 95;
          if (isBadBalanceLabel(cellText)) score -= 65;
          if (rowText.length < 700) score += 15;
          if (money.amount > 0) score += 5;

          candidates.push({
            amount: money.amount,
            formatted: formatMoney(money.amount),
            raw: money.raw,
            score,
            source: strongLabel ? 'visible-table-labelled-balance' : 'visible-table-row-balance',
            label: headerText,
            text: rowText
          });
        }
      }
    }

    return candidates;
  }

  function scanLabelledBlocksForVisibleBalance(user) {
    const candidates = [];
    const selectors = [
      'li',
      '[class*="member" i]',
      '[class*="balance" i]',
      '[class*="vault" i]',
      '[class*="bank" i]',
      '[class*="fund" i]',
      '[class*="available" i]',
      '[class*="money" i]'
    ];

    const seen = new Set();

    for (const el of Array.from(document.querySelectorAll(selectors.join(',')))) {
      if (!el || seen.has(el)) continue;
      seen.add(el);

      if (el.closest?.(`.${APP}-panel`)) continue;
      if (!isVisibleElement(el)) continue;

      const text = cleanText(el.innerText || el.textContent || '');
      if (!text || text.length < 10 || text.length > 900) continue;
      if (!rowContainsUser(text, user)) continue;

      const moneyTokens = parseMoneyTokensFromText(text);
      if (!moneyTokens.length) continue;

      for (const money of moneyTokens) {
        const lower = text.toLowerCase();
        const around = lower.slice(Math.max(0, money.index - 110), Math.min(lower.length, money.index + 110));
        const labelAround = isGoodBalanceLabel(around);
        const badAround = isBadBalanceLabel(around);

        if (!labelAround) continue;

        let score = 0;
        if (labelAround) score += 100;
        if (/vault|balance|funds|available|bank/i.test(String(el.className || '') + ' ' + String(el.id || ''))) score += 25;
        if (badAround) score -= 90;
        if (money.amount > 0) score += 5;

        candidates.push({
          amount: money.amount,
          formatted: formatMoney(money.amount),
          raw: money.raw,
          score,
          source: 'visible-labelled-block-balance',
          label: 'nearby balance label',
          text
        });
      }
    }

    return candidates;
  }

  function chooseSafestVisibleBalanceCandidate(candidates) {
    const filtered = candidates
      .filter(c => Number.isFinite(c.amount) && c.amount >= 0)
      .filter(c => c.score >= 95)
      .sort((a, b) => b.score - a.score);

    if (!filtered.length) return null;

    const best = filtered[0];
    const second = filtered[1];

    if (second && second.amount !== best.amount && (best.score - second.score) < 35) {
      console.warn('[Vault Request] Refused visible balance fallback because multiple balance candidates were too close:', filtered.slice(0, 4));
      return null;
    }

    return best;
  }

  function findVisibleVaultBalanceForUser(user) {
    const id = String(user?.id || '').trim();
    const name = cleanText(user?.name || user?.display || '').replace(/\s*\[\d+\]\s*$/, '').toLowerCase();

    if (!id && !name) return null;

    const candidates = [
      ...scanTableRowsForVisibleBalance(user),
      ...scanLabelledBlocksForVisibleBalance(user)
    ];

    const best = chooseSafestVisibleBalanceCandidate(candidates);

    if (best) {
      return {
        amount: best.amount,
        formatted: best.formatted,
        source: best.source,
        checkedAt: Date.now(),
        debugText: best.text,
        label: best.label || ''
      };
    }

    console.warn('[Vault Request] No safe visible balance candidate found. Candidates:', candidates.slice(0, 8));
    return null;
  }

  async function getMemberVaultBalance(userId, options = {}) {
    const key = cleanText(settings.apiKey);
    const user = options.user || { id: userId, name: '', display: String(userId || '') };
    const errors = [];

    if (key) {
      try {
        const data = await fetchFactionBalanceData(key);
        const candidates = collectMemberBalanceCandidates(data, userId);

        if (candidates.length) {
          const best = candidates[0];

          settings.lastBalanceUserId = String(userId);
          settings.lastBalanceAmount = best.amount;
          settings.lastBalanceCheckedAt = Date.now();
          saveSettings();

          return {
            amount: best.amount,
            formatted: formatMoney(best.amount),
            source: `api:${best.path}`,
            checkedAt: settings.lastBalanceCheckedAt
          };
        }

        if (options.debug) console.log('[Vault Request] Balance response:', data);
        errors.push('Could not find this member balance in the faction vault API response.');
      } catch (err) {
        console.warn('[Vault Request] API balance check failed, trying visible page fallback:', err);
        errors.push(err.message || String(err));
      }
    }

    const visibleBalance = findVisibleVaultBalanceForUser(user);

    if (visibleBalance) {
      settings.lastBalanceUserId = String(userId);
      settings.lastBalanceAmount = visibleBalance.amount;
      settings.lastBalanceCheckedAt = Date.now();
      saveSettings();

      return visibleBalance;
    }

    if (!key) {
      throw new Error('Could not safely confirm vault balance without an API key. Open the Torn faction vault/balance page where this member has a labelled Balance/Vault/Funds/Available amount visible, then click Check Vault Balance again.');
    }

    throw new Error(errors[0] || 'Could not confirm this member vault balance from the API or the visible Torn page.');
  }

  function getCachedBalanceForUser(userId) {
    if (String(settings.lastBalanceUserId || '') !== String(userId || '')) return null;
    if (settings.lastBalanceAmount === null || settings.lastBalanceAmount === undefined) return null;

    return {
      amount: Number(settings.lastBalanceAmount || 0),
      formatted: formatMoney(settings.lastBalanceAmount),
      checkedAt: Number(settings.lastBalanceCheckedAt || 0)
    };
  }

  function updateBalanceStatus(message, type = 'warn') {
    const el = $('balanceStatus');
    if (!el) return;

    el.textContent = message;
    el.className = `${APP}-preview ${type === 'ok' ? 'ok' : 'warn'}`;
  }

  function updateBalanceDisplay() {
    const user = parseUserDisplay($('user')?.value || '');
    const amount = parseAmount($('amount')?.value || '');

    if (!user.id) {
      updateBalanceStatus('Vault balance: enter a Torn ID to check balance.', 'warn');
      return;
    }

    const cached = getCachedBalanceForUser(user.id);

    if (!cached) {
      updateBalanceStatus('Vault balance: not checked yet. It will be checked before sending.', 'warn');
      return;
    }

    const ago = Math.max(0, Math.floor((Date.now() - cached.checkedAt) / 1000));

    if (!amount.ok) {
      updateBalanceStatus(`Vault balance: ${cached.formatted}. Checked ${ago}s ago.`, 'ok');
      return;
    }

    if (amount.amount <= cached.amount) {
      updateBalanceStatus(`Vault balance: ${cached.formatted}. Request is within available balance.`, 'ok');
    } else {
      updateBalanceStatus(`Vault balance: ${cached.formatted}. Request is too high.`, 'warn');
    }
  }

  async function refreshBalanceForCurrentUser(showToastOnSuccess = false) {
    if (balanceCheckLocked) return null;

    const user = parseUserDisplay($('user')?.value || settings.userDisplay || '');
    if (!user.id) {
      updateBalanceStatus('Vault balance: enter a Torn ID to check balance.', 'warn');
      return null;
    }

    balanceCheckLocked = true;
    updateBalanceStatus(settings.apiKey
      ? 'Vault balance: checking with API...'
      : 'Vault balance: checking visible Torn page for a labelled member balance...', 'warn');

    try {
      const balance = await getMemberVaultBalance(user.id, { user });
      updateBalanceDisplay();
      if (showToastOnSuccess) showToast(`Vault balance checked: ${balance.formatted}`, 'ok');
      return balance;
    } catch (err) {
      console.error('[Vault Request] Balance check failed:', err);
      updateBalanceStatus(err.message || 'Vault balance check failed.', 'warn');
      return null;
    } finally {
      balanceCheckLocked = false;
    }
  }

  function debounceBalanceCheck() {
    clearTimeout(balanceDebounceTimer);
    balanceDebounceTimer = setTimeout(() => {
      if (!document.getElementById(`${APP}-requestPanel`)) return;
      const user = parseUserDisplay($('user')?.value || '');
      if (user.id) refreshBalanceForCurrentUser(false);
      else updateBalanceDisplay();
    }, 900);
  }

  async function verifyRequestAgainstVaultBalance(user, amount) {
    const balance = await getMemberVaultBalance(user.id, { user });

    if (amount.amount > balance.amount) {
      throw new Error(`Request blocked. ${user.display} only has ${balance.formatted} available in the faction vault.`);
    }

    return balance;
  }


  function ensureRequestStores() {
    if (!Array.isArray(settings.pendingRequests)) settings.pendingRequests = [];
    if (!Array.isArray(settings.requestNotifications)) settings.requestNotifications = [];
    return settings;
  }

  function addRequestNotification(type, message, requestId = '') {
    ensureRequestStores();

    settings.requestNotifications.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      message,
      requestId,
      time: Date.now(),
      read: false
    });

    settings.requestNotifications = settings.requestNotifications.slice(0, MAX_NOTIFICATIONS);
    saveSettings();
    updateRequestNotificationsPanel();
  }

  function markRequestNotificationsRead() {
    ensureRequestStores();
    settings.requestNotifications = settings.requestNotifications.map(n => ({ ...n, read: true }));
    saveSettings();
    updateRequestNotificationsPanel();
  }

  function storePendingRequest(record) {
    ensureRequestStores();

    settings.pendingRequests.unshift(record);
    settings.pendingRequests = settings.pendingRequests.slice(0, MAX_PENDING_REQUESTS);
    saveSettings();
    updateRequestNotificationsPanel();
  }

  function updatePendingRequest(requestId, patch) {
    ensureRequestStores();

    settings.pendingRequests = settings.pendingRequests.map(req =>
      req.id === requestId ? { ...req, ...patch } : req
    );

    saveSettings();
    updateRequestNotificationsPanel();
  }

  function getPendingRequestSummary() {
    ensureRequestStores();
    return settings.pendingRequests
      .filter(req => req.status === 'pending')
      .slice(0, 5);
  }

  function notificationIcon(type) {
    if (type === 'expired') return '⏰';
    if (type === 'sent') return '✅';
    if (type === 'error') return '⚠️';
    return 'ℹ️';
  }

  function relativeTime(ms) {
    const diff = Math.max(0, Date.now() - Number(ms || Date.now()));
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1 minute ago';
    if (mins < 60) return `${mins} minutes ago`;
    const hours = Math.floor(mins / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  }

  function updateRequestNotificationsPanel() {
    const list = $('requestNotifications');
    const pendingEl = $('pendingRequests');
    if (!list && !pendingEl) return;

    ensureRequestStores();

    if (list) {
      const notifications = settings.requestNotifications.slice(0, 6);
      if (!notifications.length) {
        list.innerHTML = `<div class="${APP}-tiny">No request notifications yet.</div>`;
      } else {
        list.innerHTML = notifications.map(n => `
          <div class="${APP}-notice ${n.type || 'info'} ${n.read ? 'read' : 'unread'}">
            <div><b>${notificationIcon(n.type)} ${escapeHtml(n.message)}</b></div>
            <div class="${APP}-tiny">${relativeTime(n.time)}</div>
          </div>
        `).join('');
      }
    }

    if (pendingEl) {
      const pending = getPendingRequestSummary();
      if (!pending.length) {
        pendingEl.innerHTML = `<div class="${APP}-tiny">No pending requests.</div>`;
      } else {
        pendingEl.innerHTML = pending.map(req => {
          const expiresIn = Math.max(0, Number(req.expiresAt || 0) - Date.now());
          const mins = Math.ceil(expiresIn / 60000);
          return `
            <div class="${APP}-notice pending">
              <div><b>${escapeHtml(req.amount?.formatted || '$0')}</b> request pending</div>
              <div class="${APP}-tiny">Expires in about ${mins} minute${mins === 1 ? '' : 's'}.</div>
            </div>
          `;
        }).join('');
      }
    }
  }

  async function expireRequest(record) {
    if (!record || record.status !== 'pending') return;

    let editOk = false;
    let errorMessage = '';

    if (record.discordMessageId) {
      try {
        await editWebhookMessage(record.discordMessageId, buildExpiredPayload(record));
        editOk = true;
      } catch (err) {
        console.error('[Vault Request] Failed to edit expired Discord request:', err);
        errorMessage = err.message || String(err);
      }
    }

    if (!editOk) {
      try {
        await postWebhook(buildExpiredPayload(record), { wait: false });
        editOk = true;
      } catch (err) {
        console.error('[Vault Request] Failed to post expired Discord notification:', err);
        errorMessage = err.message || String(err);
      }
    }

    let userNoticeOk = false;

    if (webhookLooksValid(settings.userNotifyWebhookUrl)) {
      try {
        await postWebhook(buildUserTimeoutPayload(record), { kind: 'notify', wait: false });
        userNoticeOk = true;
      } catch (err) {
        console.error('[Vault Request] Failed to send user timeout webhook:', err);
        errorMessage = errorMessage || err.message || String(err);
      }
    }

    updatePendingRequest(record.id, {
      status: 'expired',
      expiredAt: Date.now(),
      expiryNotified: editOk,
      userTimeoutNoticeSent: userNoticeOk,
      expiryError: errorMessage
    });

    addRequestNotification(
      'expired',
      `Your ${record.amount?.formatted || ''} vault request timed out after 5 hours. Make another request if you still need it.`,
      record.id
    );

    showToast('Vault request timed out after 5 hours. Make another request if you still need it.', 'warn');
  }

  async function checkPendingRequestTimeouts() {
    ensureRequestStores();

    const now = Date.now();
    const due = settings.pendingRequests.filter(req =>
      req.status === 'pending' &&
      Number(req.expiresAt || 0) <= now &&
      !req.expiryCheckRunning
    );

    for (const req of due) {
      updatePendingRequest(req.id, { expiryCheckRunning: true });
      await expireRequest({ ...req, expiryCheckRunning: true });
    }

    updateRequestNotificationsPanel();
  }

  function startRequestTimeoutWatcher() {
    setTimeout(checkPendingRequestTimeouts, 2500);
    setInterval(checkPendingRequestTimeouts, REQUEST_CHECK_MS);
    setInterval(updateRequestNotificationsPanel, 60 * 1000);
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

  function isVisibleElement(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 8 && rect.height > 8 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function elementText(el) {
    return cleanText([
      el?.innerText || el?.textContent || '',
      el?.getAttribute?.('title') || '',
      el?.getAttribute?.('aria-label') || ''
    ].join(' '));
  }

  function findRwphLauncher() {
    const selectors = [
      '[id*="RWPH" i]',
      '[class*="RWPH" i]',
      '[id*="ranked-war-payout" i]',
      '[class*="ranked-war-payout" i]',
      'button',
      'a',
      '[role="button"]',
      'div'
    ];

    const nodes = Array.from(document.querySelectorAll(selectors.join(',')));
    const launcher = document.getElementById(`${APP}-launcher`);

    const scored = nodes
      .filter(el => el !== launcher && !el.closest?.(`.${APP}-panel`) && isVisibleElement(el))
      .map(el => {
        const txt = elementText(el).toLowerCase();
        const blob = `${el.id || ''} ${el.className || ''} ${txt}`.toLowerCase();
        let score = 0;

        if (blob.includes('rwph')) score += 80;
        if (blob.includes('ranked war payout helper')) score += 80;
        if (blob.includes('ranked war')) score += 30;
        if (blob.includes('payout helper')) score += 30;
        if (blob.includes('payment helper')) score += 10;
        if (blob.includes('vault request')) score -= 100;
        if (blob.includes(APP.toLowerCase())) score -= 100;

        const rect = el.getBoundingClientRect();
        if (rect.top < 120) score += 12;
        if (rect.left > 0 && rect.right < window.innerWidth) score += 5;

        return { el, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.el || null;
  }

  function findFactionWarfareButton() {
    const nodes = Array.from(document.querySelectorAll('button,a,[role="button"],div,span'));
    const scored = nodes
      .filter(el => !el.closest?.(`.${APP}-panel`) && isVisibleElement(el))
      .map(el => {
        const txt = elementText(el).toLowerCase();
        let score = 0;

        if (txt.includes('faction warfare')) score += 80;
        if (txt.includes('warfare')) score += 20;

        const rect = el.getBoundingClientRect();
        if (rect.top < 140) score += 8;

        return { el, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.el || null;
  }

  function placeLauncher(forceFallback = false) {
    const btn = document.getElementById(`${APP}-launcher`);
    if (!btn) return;

    const rwph = !forceFallback ? findRwphLauncher() : null;
    const warfare = !forceFallback ? findFactionWarfareButton() : null;

    try {
      btn.classList.remove(`${APP}-floatingLauncher`);
      btn.classList.add(`${APP}-inlineLauncher`);
      btn.style.position = '';
      btn.style.right = '';
      btn.style.bottom = '';
      btn.style.left = '';
      btn.style.top = '';
      btn.title = 'Vault Request';

      // Best case: RWPH exists, so sit directly beside it.
      if (rwph && rwph.parentElement) {
        if (rwph.nextElementSibling !== btn) {
          rwph.insertAdjacentElement('afterend', btn);
        }
        return;
      }

      // RWPH missing: use the same intended RWPH slot.
      // RWPH's slot is in the faction header/top button row, beside Faction Warfare.
      // Put this button BEFORE Faction Warfare so it occupies that RWPH-style position
      // instead of dropping to the floating fallback.
      if (warfare && warfare.parentElement) {
        if (warfare.previousElementSibling !== btn) {
          warfare.insertAdjacentElement('beforebegin', btn);
        }
        return;
      }

      // Last header-style fallback: try to locate the Torn faction/header control row
      // and append there. This keeps the launcher in the top Torn header area.
      const headerLike = Array.from(document.querySelectorAll(
        '[class*="faction" i], [class*="header" i], [class*="top" i], [class*="menu" i], [class*="content-title" i], [class*="tabs" i]'
      ))
        .filter(el => isVisibleElement(el) && el.getBoundingClientRect().top < 170)
        .sort((a, b) => {
          const ar = a.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          return (br.width * br.height) - (ar.width * ar.height);
        })[0];

      if (headerLike) {
        headerLike.appendChild(btn);
        return;
      }
    } catch (err) {
      console.warn('[Vault Request] Could not place launcher in RWPH slot:', err);
    }

    // Only use floating as an emergency fallback when Torn's header slot cannot be found.
    btn.classList.remove(`${APP}-inlineLauncher`);
    btn.classList.add(`${APP}-floatingLauncher`);

    if (btn.parentElement !== document.body) {
      document.body.appendChild(btn);
    }
  }

  function startLauncherWatcher() {
    let attempts = 0;

    const tryPlace = () => {
      attempts += 1;
      placeLauncher(false);

      if (attempts < 30) {
        setTimeout(tryPlace, 1000);
      }
    };

    tryPlace();

    const observer = new MutationObserver(() => {
      const btn = document.getElementById(`${APP}-launcher`);
      if (!btn) return;

      clearTimeout(observer._timer);
      observer._timer = setTimeout(() => placeLauncher(false), 350);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function getPanelStateKey(panel) {
    return String(panel?.id || '').replace(`${APP}-`, '') || 'panel';
  }

  function ensurePanelPositions() {
    if (!settings.panelPositions || typeof settings.panelPositions !== 'object') {
      settings.panelPositions = {};
    }
    return settings.panelPositions;
  }

  function applySavedPanelState(panel, key) {
    const saved = ensurePanelPositions()[key];
    if (!saved) return;

    if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      panel.style.left = `${Math.max(0, saved.left)}px`;
      panel.style.top = `${Math.max(0, saved.top)}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    }

    if (Number.isFinite(saved.width)) {
      panel.style.width = `${Math.max(300, saved.width)}px`;
    }

    if (Number.isFinite(saved.height)) {
      panel.style.height = `${Math.max(220, saved.height)}px`;
      panel.style.maxHeight = 'none';
    }
  }

  function savePanelState(panel, key) {
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const positions = ensurePanelPositions();

    positions[key] = {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };

    saveSettings();
  }

  function clampPanelToScreen(panel) {
    const rect = panel.getBoundingClientRect();
    const pad = 8;
    let left = rect.left;
    let top = rect.top;

    if (rect.right < pad) left = pad;
    if (rect.bottom < pad) top = pad;
    if (rect.left > window.innerWidth - pad) left = window.innerWidth - Math.min(rect.width, window.innerWidth - pad);
    if (rect.top > window.innerHeight - pad) top = window.innerHeight - Math.min(rect.height, window.innerHeight - pad);

    left = Math.max(pad, Math.min(left, Math.max(pad, window.innerWidth - Math.min(rect.width, window.innerWidth - pad))));
    top = Math.max(pad, Math.min(top, Math.max(pad, window.innerHeight - Math.min(rect.height, window.innerHeight - pad))));

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function makePanelMoveResize(panel) {
    if (!panel || panel.dataset.tvresInteractive === '1') return;

    panel.dataset.tvresInteractive = '1';

    const key = getPanelStateKey(panel);
    applySavedPanelState(panel, key);
    setTimeout(() => clampPanelToScreen(panel), 0);

    const header = panel.querySelector(`.${APP}-header`);
    let dragging = false;
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let startWidth = 0;
    let startHeight = 0;

    const pointFromEvent = (ev) => {
      const touch = ev.touches?.[0] || ev.changedTouches?.[0];
      return {
        clientX: touch ? touch.clientX : ev.clientX,
        clientY: touch ? touch.clientY : ev.clientY
      };
    };

    const onMove = (ev) => {
      if (!dragging && !resizing) return;

      ev.preventDefault();

      const point = pointFromEvent(ev);
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;
      const rect = panel.getBoundingClientRect();
      const pad = 8;

      if (dragging) {
        let left = startLeft + dx;
        let top = startTop + dy;

        left = Math.max(pad, Math.min(left, window.innerWidth - Math.min(rect.width, window.innerWidth - pad)));
        top = Math.max(pad, Math.min(top, window.innerHeight - Math.min(rect.height, window.innerHeight - pad)));

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
      }

      if (resizing) {
        const width = Math.max(320, Math.min(window.innerWidth - pad - rect.left, startWidth + dx));
        const height = Math.max(260, Math.min(window.innerHeight - pad - rect.top, startHeight + dy));

        panel.style.width = `${width}px`;
        panel.style.height = `${height}px`;
        panel.style.maxHeight = 'none';
      }
    };

    const onUp = () => {
      if (!dragging && !resizing) return;

      dragging = false;
      resizing = false;
      panel.classList.remove(`${APP}-dragging`);
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      document.removeEventListener('touchmove', onMove, true);
      document.removeEventListener('touchend', onUp, true);
      document.removeEventListener('touchcancel', onUp, true);
      savePanelState(panel, key);
    };

    const startDrag = (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (ev.target.closest('button,input,textarea,select,a')) return;

      const point = pointFromEvent(ev);
      const rect = panel.getBoundingClientRect();

      dragging = true;
      resizing = false;
      startX = point.clientX;
      startY = point.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      panel.classList.add(`${APP}-dragging`);
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';

      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
      document.addEventListener('touchmove', onMove, true);
      document.addEventListener('touchend', onUp, true);
      document.addEventListener('touchcancel', onUp, true);
      ev.preventDefault();
    };

    const startResize = (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;

      const point = pointFromEvent(ev);
      const rect = panel.getBoundingClientRect();

      dragging = false;
      resizing = true;
      startX = point.clientX;
      startY = point.clientY;
      startWidth = rect.width;
      startHeight = rect.height;

      panel.style.width = `${rect.width}px`;
      panel.style.height = `${rect.height}px`;
      panel.style.maxHeight = 'none';

      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
      document.addEventListener('touchmove', onMove, true);
      document.addEventListener('touchend', onUp, true);
      document.addEventListener('touchcancel', onUp, true);
      ev.preventDefault();
    };

    if (header) {
      header.addEventListener('mousedown', startDrag);
      header.addEventListener('touchstart', startDrag, { passive: false });
    }

    if (!panel.querySelector(`.${APP}-resizeGrip`)) {
      const grip = document.createElement('div');
      grip.className = `${APP}-resizeGrip`;
      grip.title = 'Resize';
      panel.appendChild(grip);
      grip.addEventListener('mousedown', startResize);
      grip.addEventListener('touchstart', startResize, { passive: false });
    }

    let resizeSaveTimer = null;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeSaveTimer);
      resizeSaveTimer = setTimeout(() => {
        clampPanelToScreen(panel);
        savePanelState(panel, key);
      }, 250);
    });

    resizeObserver.observe(panel);

    const closeBtn = panel.querySelector(`.${APP}-x`);
    if (closeBtn) {
      closeBtn.addEventListener('click', () => savePanelState(panel, key), { once: true });
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
        z-index: 999999;
        border: 0;
        border-radius: 12px;
        background: transparent;
        color: #ffe1ad;
        padding: 2px;
        cursor: pointer;
        font: 900 13px Arial, sans-serif;
        box-shadow: none;
        white-space: nowrap;
        line-height: 1.1;
      }

      #${APP}-launcher.${APP}-floatingLauncher {
        position: fixed;
        right: 15px;
        bottom: 18px;
      }

      #${APP}-launcher.${APP}-inlineLauncher {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        min-height: 32px;
        margin-left: 8px;
        margin-right: 4px;
        vertical-align: middle;
      }

      .${APP}-panel {
        position: fixed;
        right: 15px;
        bottom: 68px;
        z-index: 1000000;
        width: min(470px, calc(100vw - 30px));
        max-height: min(760px, calc(100vh - 92px));
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--${APP}-line) #120c07;
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
        resize: both;
        min-width: 320px;
        min-height: 260px;
      }

      .${APP}-panel::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      .${APP}-panel::-webkit-scrollbar-track {
        background: #120c07;
        border-radius: 999px;
      }

      .${APP}-panel::-webkit-scrollbar-thumb {
        background: #7a4d1d;
        border: 2px solid #120c07;
        border-radius: 999px;
      }

      .${APP}-resizeGrip {
        position: sticky;
        float: right;
        right: 2px;
        bottom: 2px;
        width: 18px;
        height: 18px;
        margin: 8px 0 0 auto;
        border-right: 3px solid rgba(255,179,71,.85);
        border-bottom: 3px solid rgba(255,179,71,.85);
        cursor: nwse-resize;
        opacity: .8;
      }

      .${APP}-panel.${APP}-dragging {
        user-select: none;
        cursor: grabbing;
      }

      .${APP}-panel * { box-sizing: border-box; }

      .${APP}-header {
        border: 1px solid rgba(255,179,71,.55);
        border-radius: 15px;
        background: rgba(0,0,0,.22);
        padding: 12px;
        margin-bottom: 12px;
        cursor: move;
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
        width: 46px;
        height: 46px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        border: 0;
        background: transparent;
        color: #ffcc7a;
        font-size: 20px;
        box-shadow: none;
        overflow: visible;
        flex: 0 0 auto;
      }

      .${APP}-logoSvg {
        display: block;
        background: transparent;
        pointer-events: none;
      }

      .${APP}-logoSvg.launcher {
        width: 40px;
        height: 40px;
      }

      .${APP}-logoSvg.panelLogo {
        width: 46px;
        height: 46px;
      }

      #${APP}-launcher:hover .${APP}-logoSvg {
        filter: brightness(1.18) drop-shadow(0 0 8px rgba(255,179,71,.65));
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

      .${APP}-panel input[type="color"] {
        height: 44px;
        padding: 5px;
        cursor: pointer;
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
        line-height: 1.35;
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

      .${APP}-inputBtnRow {
        display: flex;
        gap: 8px;
        align-items: stretch;
      }

      .${APP}-inputBtnRow input {
        flex: 1 1 auto;
        min-width: 0;
      }

      .${APP}-inlineBtn {
        flex: 0 0 auto;
        border: 1px solid var(--${APP}-line);
        border-radius: 11px;
        background: linear-gradient(180deg, #30200f, #160d05);
        color: #ffe1ad;
        padding: 0 12px;
        cursor: pointer;
        font: 900 12px Arial, sans-serif;
        min-width: 74px;
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
      #${APP}-make:hover { filter: brightness(1.12); }

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

      .${APP}-btn:disabled {
        opacity: .55;
        cursor: wait;
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

      .${APP}-notice {
        border: 1px solid rgba(255,179,71,.28);
        border-radius: 11px;
        background: rgba(0,0,0,.18);
        padding: 8px 10px;
        margin-top: 7px;
        line-height: 1.35;
      }

      .${APP}-notice.unread {
        border-color: rgba(255,179,71,.65);
        background: rgba(255,179,71,.08);
      }

      .${APP}-notice.sent {
        border-color: rgba(76,175,100,.55);
      }

      .${APP}-notice.expired {
        border-color: rgba(226,83,83,.65);
      }

      .${APP}-notice.pending {
        border-color: rgba(88,101,242,.55);
      }

      .${APP}-embedPreview {
        margin-top: 8px;
        border: 1px solid rgba(255,179,71,.35);
        border-left: 5px solid var(--${APP}-line);
        border-radius: 12px;
        background: rgba(255,179,71,.08);
        color: #ffe4b3;
        padding: 9px 10px;
        word-break: break-word;
        font-size: 12px;
        line-height: 1.35;
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
        width: min(470px, calc(100vw - 30px));
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
        #${APP}-launcher.${APP}-floatingLauncher {
          right: 10px;
          bottom: 12px;
        }

        #${APP}-launcher {
          padding: 2px;
        }

        .${APP}-logoSvg.launcher {
          width: 36px;
          height: 36px;
        }
        .${APP}-panel {
          right: 10px;
          bottom: 58px;
          width: calc(100vw - 20px);
          padding: 12px;
        }
        .${APP}-title { font-size: 15px; }
      }
    `;
    document.head.appendChild(style);
  }

  function fvrLogoSvg(mode = 'panel') {
    const isLauncher = mode === 'launcher';
    const cls = isLauncher ? `${APP}-logoSvg launcher` : `${APP}-logoSvg panelLogo`;
    return `
      <svg class="${cls}" viewBox="0 0 128 128" role="img" aria-label="Faction Vault Requests logo" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${APP}-lg1" x1="16" y1="12" x2="108" y2="118" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ffe3a6"/>
            <stop offset="0.45" stop-color="#ffb347"/>
            <stop offset="1" stop-color="#d66a00"/>
          </linearGradient>
          <linearGradient id="${APP}-lg2" x1="30" y1="24" x2="94" y2="104" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#2b1a08"/>
            <stop offset="1" stop-color="#050302"/>
          </linearGradient>
          <filter id="${APP}-glow" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="3.2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <path d="M64 8 112 26v38c0 30-19 47-48 58-29-11-48-28-48-58V26L64 8Z"
              fill="transparent"
              stroke="url(#${APP}-lg1)"
              stroke-width="7"
              stroke-linejoin="round"
              filter="url(#${APP}-glow)"/>

        <path d="M36 55h56v40H36V55Z"
              fill="url(#${APP}-lg2)"
              stroke="url(#${APP}-lg1)"
              stroke-width="5"
              stroke-linejoin="round"/>

        <path d="M46 55V43c0-11 8-20 18-20s18 9 18 20v12"
              fill="none"
              stroke="url(#${APP}-lg1)"
              stroke-width="7"
              stroke-linecap="round"/>

        <circle cx="64" cy="75" r="8" fill="#ffcc7a"/>
        <path d="M64 82v8" stroke="#ffcc7a" stroke-width="5" stroke-linecap="round"/>

        <text x="64" y="113"
              text-anchor="middle"
              font-family="Arial Black, Impact, Arial, sans-serif"
              font-size="24"
              font-weight="900"
              letter-spacing="1.5"
              fill="#fff1cf"
              stroke="#3a2108"
              stroke-width="2"
              paint-order="stroke">FVR</text>
      </svg>
    `;
  }

  function panelHeader(title, subtitle, icon, closeId) {
    const panelHint = subtitle ? `${subtitle} Drag this top bar to move. Resize from the bottom-right corner.` : 'Drag this top bar to move. Resize from the bottom-right corner.';
    return `
      <div class="${APP}-header">
        <div class="${APP}-headRow">
          <div class="${APP}-brand">
            <div class="${APP}-logo">${fvrLogoSvg('panel')}</div>
            <div>
              <div class="${APP}-title">${title}</div>
              <div class="${APP}-subtitle">${panelHint}</div>
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

    updateBalanceDisplay();
  }

  function applyFormattedAmountToInput() {
    const input = $('amount');
    if (!input) return;

    const parsed = parseAmount(input.value);
    if (parsed.ok) {
      input.value = parsed.formatted;
      settings.amountInput = input.value;
      saveRequestFromPanel();
    }

    updateAmountPreview();
  }

  function fillRequestPanelValues() {
    const detected = detectCurrentTornUser();
    const profile = detected ? getProfileForUser(detected) : null;

    if (profile) {
      $('user').value = profile.userDisplay || displayFromUser(detected);
      if ($('discordName')) $('discordName').value = profile.discordName || '';
      $('amount').value = profile.amountInput || '';
      settings.userDisplay = profile.userDisplay || displayFromUser(detected);
      settings.discordName = profile.discordName || '';
      settings.amountInput = profile.amountInput || '';
      settings.lastDetectedUserId = detected.id;
      saveSettings();
    } else {
      // First time for this Torn user: leave all user-filled fields blank.
      $('user').value = '';
      if ($('discordName')) $('discordName').value = '';
      $('amount').value = '';
      settings.userDisplay = '';
      settings.discordName = '';
      settings.amountInput = '';
      if (detected?.id) settings.lastDetectedUserId = detected.id;
      saveSettings();
    }

    updateAmountPreview();
    updateRequestNotificationsPanel();
    updateBalanceDisplay();

    const user = parseUserDisplay($('user')?.value || '');
    if (user.id) {
      refreshBalanceForCurrentUser(false);
    }
  }

  function saveRequestFromPanel() {
    settings.userDisplay = cleanText($('user')?.value || '');
    settings.discordName = normalizeDiscordName($('discordName')?.value || settings.discordName || '');
    settings.amountInput = cleanText($('amount')?.value || '');

    const user = parseUserDisplay(settings.userDisplay);
    if (user?.id) {
      saveProfileForUser(user, {
        userDisplay: settings.userDisplay,
        discordName: settings.discordName,
        amountInput: settings.amountInput
      });
    } else {
      saveSettings();
    }
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

    if (!normalizeDiscordName(settings.discordName)) {
      showToast('Enter your Discord name before making a request.', 'warn');
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
      btn.textContent = 'Checking balance...';
    }

    try {
      const balance = await verifyRequestAgainstVaultBalance(user, amount);
      updateBalanceDisplay();

      if (btn) btn.textContent = 'Sending...';

      const requestId = makeRequestId(user.id, amount.raw);
      const expiresAt = Date.now() + REQUEST_TIMEOUT_MS;
      const discordName = normalizeDiscordName(settings.discordName);
      const requestRecordBase = {
        id: requestId,
        user,
        amount,
        balance,
        discordName,
        createdAt: Date.now(),
        expiresAt,
        status: 'pending',
        expiryNotified: false
      };

      const payload = buildPayload(user, amount, balance, requestRecordBase);
      const res = await postWebhook(payload, { wait: true });

      let discordMessageId = '';
      try {
        const body = JSON.parse(res.responseText || '{}');
        discordMessageId = body.id || '';
      } catch {}

      storePendingRequest({
        ...requestRecordBase,
        discordMessageId
      });

      addRequestNotification(
        'sent',
        `Your ${amount.formatted} vault request was sent to the faction Discord channel. It expires in 5 hours.`,
        requestId
      );

      showToast(`Request sent to Discord: ${amount.formatted}. It expires in 5 hours.`, 'ok');

      $('amount').value = amount.formatted;
      settings.amountInput = amount.formatted;
      saveSettings();
      updateAmountPreview();
      updateBalanceDisplay();
      updateRequestNotificationsPanel();
    } catch (err) {
      console.error('[Torn Vault Request Maker]', err);
      showToast(err.message || 'Request failed.', 'bad');
      updateBalanceDisplay();
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


  function findPendingRequestForControls() {
    ensureRequestStores();

    const params = getCurrentPageRequestParams();

    if (params.requestId) {
      const byId = settings.pendingRequests.find(req => req.id === params.requestId);
      if (byId) return byId;
    }

    if (params.userId && params.amountRaw) {
      const local = settings.pendingRequests.find(req =>
        req.status === 'pending' &&
        String(req.user?.id || '') === String(params.userId) &&
        String(req.amount?.raw || '') === String(params.amountRaw)
      );
      if (local) return local;
    }

    const userDisplay = params.userDisplay || (params.userName && params.userId ? `${params.userName} [${params.userId}]` : (params.userId ? `User [${params.userId}]` : 'Unknown User'));
    const parsedUser = parseTornUserDisplay(userDisplay);
    if (!parsedUser.id && params.userId) parsedUser.id = params.userId;
    if (!parsedUser.name && params.userName) parsedUser.name = params.userName;

    return {
      id: params.requestId || makeRequestId(params.userId, params.amountRaw),
      user: parsedUser,
      amount: {
        raw: params.amountRaw || '0',
        amount: Number(params.amountRaw || 0),
        formatted: params.amountFormatted || formatMoney(params.amountRaw || 0)
      },
      balance: { formatted: params.balanceFormatted || 'Not checked' },
      discordName: normalizeDiscordName(params.discordName || settings.discordName || ''),
      createdAt: params.createdAt || Date.now(),
      expiresAt: params.expiresAt || (Date.now() + REQUEST_TIMEOUT_MS),
      status: 'pending',
      discordMessageId: ''
    };
  }

  function getCurrentBankerDisplay() {
    const found = findSelfFromWindow() || findSelfFromScripts() || findSelfFromDom();
    if (found?.name && found?.id) {
      return `${found.name} [${found.id}]`;
    }
    return '';
  }

  async function markCurrentRequestFulfilled(record, banker) {
    const completedRecord = {
      ...record,
      completedAt: Date.now(),
      status: 'fulfilled'
    };

    if (!webhookLooksValid(settings.userNotifyWebhookUrl)) {
      throw new Error('Add the User Notice Webhook URL in Settings before marking requests fulfilled.');
    }

    await postWebhook(buildUserFulfilledPayload(completedRecord, banker), { kind: 'notify', wait: false });

    if (record.discordMessageId && webhookLooksValid(settings.webhookUrl)) {
      try {
        await editWebhookMessage(record.discordMessageId, buildMainFulfilledPayload(completedRecord, banker));
      } catch (err) {
        console.warn('[Vault Request] Could not edit main request message after fulfilment:', err);
      }
    }

    updatePendingRequest(record.id, {
      status: 'fulfilled',
      completedAt: completedRecord.completedAt,
      banker
    });

    addRequestNotification(
      'sent',
      `${record.amount?.formatted || ''} vault request was marked fulfilled by ${formatTornMention(banker)}.`,
      record.id
    );

    return completedRecord;
  }

  function openFulfilledPanelIfNeeded() {
    if (!/factions\.php/i.test(location.pathname || '')) return;

    const params = getCurrentPageRequestParams();
    if (!params.userId || !params.amountRaw) return;
    if (!String(location.hash || location.href).includes('giveMoneyTo=')) return;
    if (document.getElementById(`${APP}-fulfillPanel`)) return;

    const record = findPendingRequestForControls();
    const userDisplay = record?.user?.display || params.userDisplay || `User [${params.userId}]`;
    const amountDisplay = record?.amount?.formatted || params.amountFormatted || formatMoney(params.amountRaw);
    const discordDisplay = normalizeDiscordName(record?.discordName || params.discordName || settings.discordName || '');

    const panel = document.createElement('div');
    panel.id = `${APP}-fulfillPanel`;
    panel.className = `${APP}-panel`;
    panel.innerHTML = `
      ${panelHeader('Vault Request Completion', 'After manually paying in Torn, mark the request fulfilled.', '✅', 'closeFulfill')}

      <div class="${APP}-card">
        <div class="${APP}-cardTitle">Request From Discord</div>
        <p class="${APP}-note"><b>User:</b> ${escapeHtml(userDisplay)}</p>
        <p class="${APP}-note"><b>Amount:</b> ${escapeHtml(amountDisplay)}</p>\n        ${discordDisplay ? `<p class="${APP}-note"><b>Discord:</b> ${escapeHtml(formatDiscordName(discordDisplay))}</p>` : ``}

        <label for="${APP}-bankerName">Banker name and Torn ID</label>
        <input id="${APP}-bankerName" type="text" placeholder="Banker_Name [123456]" value="${escapeHtml(getCurrentBankerDisplay())}" autocomplete="off" />

        <p class="${APP}-note">
          First manually complete the payment in Torn. Then click <b>Mark Request Fulfilled</b>.
          This sends the user notice webhook message with the banker name and completion timestamp.
        </p>

        <div class="${APP}-row">
          <button type="button" class="${APP}-btn good" id="${APP}-markFulfilled">Mark Request Fulfilled</button>
          <button type="button" class="${APP}-btn" id="${APP}-refreshBanker">Refill Banker Name</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    makePanelMoveResize(panel);

    $('closeFulfill').addEventListener('click', () => panel.remove());

    $('refreshBanker').addEventListener('click', () => {
      $('bankerName').value = getCurrentBankerDisplay();
    });

    $('markFulfilled').addEventListener('click', async () => {
      const banker = parseBankerDisplay($('bankerName')?.value || getCurrentBankerDisplay());

      if (!banker.display || !banker.name) {
        showToast('Enter banker name and Torn ID first.', 'warn');
        return;
      }

      const btn = $('markFulfilled');
      btn.disabled = true;
      btn.textContent = 'Sending notice...';

      try {
        await markCurrentRequestFulfilled(record, banker);
        showToast('Fulfilled notice sent to the user notice webhook.', 'ok');
        panel.remove();
      } catch (err) {
        console.error('[Vault Request] Mark fulfilled failed:', err);
        showToast(err.message || 'Could not send fulfilled notice.', 'bad');
      } finally {
        const liveBtn = $('markFulfilled');
        if (liveBtn) {
          liveBtn.disabled = false;
          liveBtn.textContent = 'Mark Request Fulfilled';
        }
      }
    });
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

  function prefillUserNameId(showResultToast = true) {
    const detected = detectCurrentTornUser();

    if (detected) {
      const display = displayFromUser(detected);
      const profile = getProfileForUser(detected);

      if ($('user')) $('user').value = display;
      settings.userDisplay = display;
      settings.lastDetectedUserId = detected.id;

      if (profile) {
        if ($('discordName')) $('discordName').value = profile.discordName || '';
        if ($('amount')) $('amount').value = profile.amountInput || '';
        settings.discordName = profile.discordName || '';
        settings.amountInput = profile.amountInput || '';
      }

      settings.lastBalanceUserId = '';
      settings.lastBalanceAmount = null;
      settings.lastBalanceCheckedAt = 0;

      saveProfileForUser(detected, {
        userDisplay: display,
        discordName: $('discordName')?.value || settings.discordName || '',
        amountInput: $('amount')?.value || settings.amountInput || ''
      });

      updateAmountPreview();
      updateBalanceDisplay();
      debounceBalanceCheck();
      if (showResultToast) showToast(profile ? 'Torn name/ID prefilled and your saved info loaded.' : 'Torn name and ID prefilled. Fill the rest once and it will be remembered for this user.', 'ok');
      return true;
    }

    if (showResultToast) showToast('Could not detect Torn name and ID. Type it manually once and it will be remembered for this user.', 'warn');
    return false;
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
        <div class="${APP}-inputBtnRow">
          <input id="${APP}-user" type="text" placeholder="Click Prefill or type: Evil_panda_420 [3236276]" autocomplete="off" />
          <button type="button" class="${APP}-inlineBtn" id="${APP}-prefillUserInline">Prefill</button>
        </div>

        <label for="${APP}-discordName">Discord name required</label>
        <input id="${APP}-discordName" type="text" placeholder="Example: discordname or discord.name" autocomplete="off" />

        <label for="${APP}-amount">Request amount</label>
        <input id="${APP}-amount" type="text" inputmode="decimal" placeholder="1000000, 1m, 1b, or 1t" autocomplete="off" />
        <div id="${APP}-amountPreview" class="${APP}-preview warn">Enter a request amount.</div>

        <label>Faction vault balance</label>
        <div id="${APP}-balanceStatus" class="${APP}-preview warn">Vault balance: not checked yet.</div>

        <div class="${APP}-row">
          <button type="button" class="${APP}-btn" id="${APP}-refreshBalance">Check Vault Balance</button>
        </div>

        <button type="button" id="${APP}-make">Make Request</button>
      </div>

      <div class="${APP}-row">
        <button type="button" class="${APP}-btn" id="${APP}-settingsBtn">Settings</button>
        <button type="button" class="${APP}-btn" id="${APP}-refreshUser">Refill Name/ID</button>
      </div>

      <div class="${APP}-card">
        <div class="${APP}-cardTitle">Request Status</div>
        <div id="${APP}-requestNotifications"></div>
        <div class="${APP}-row">
          <button type="button" class="${APP}-btn" id="${APP}-markNoticesRead">Mark Notifications Read</button>
        </div>
        <div class="${APP}-cardTitle" style="margin-top:12px;">Pending Requests</div>
        <div id="${APP}-pendingRequests"></div>
      </div>

      <div class="${APP}-card">
        <div class="${APP}-cardTitle">How To Make A Request</div>
        <p class="${APP}-note">
          1. Click <b>Prefill</b> beside the <b>Name and Torn ID</b> box, or type it manually. It should look like <b>Evil_panda_420 [3236276]</b>.
        </p>
        <p class="${APP}-note">
          2. Type the amount you want from your faction vault balance. You can use <b>1000000</b>, <b>1m</b>, <b>1b</b>, or <b>1t</b>.
        </p>
        <p class="${APP}-note">
          3. Click <b>Check Vault Balance</b> if you want to see your available balance first. The script also checks again when you click <b>Make Request</b>.
        </p>
        <p class="${APP}-note">
          4. Click <b>Make Request</b>. If the amount is inside your available vault balance, it sends the request to the faction Discord channel.
        </p>
        <p class="${APP}-note">
          5. The request stays pending for <b>5 hours</b>. If it times out, this panel will show a notification and you need to make another request.
        </p>
        <p class="${APP}-note">
          6. A banker/leader reviews the Discord embed and manually pays it from Torn faction controls.
        </p>
        <p class="${APP}-note">
          7. After paying, the banker can click <b>Mark Request Fulfilled</b> to send the fulfilled notice to the user notice webhook.
        </p>
        <p class="${APP}-note">
          Entering your Discord name is required so bankers can identify who the request belongs to in Discord. Webhooks cannot ping a Discord username by name alone.
        </p>
      </div>

      <p class="${APP}-note">
        The script checks your faction vault balance before sending. It uses the API key when available, or the visible Torn vault/balance page when no API key is saved. If the amount is higher than your available balance, the request is blocked.
      </p>
    `;

    document.body.appendChild(panel);
    makePanelMoveResize(panel);
    fillRequestPanelValues();

    $('closeRequest').addEventListener('click', () => panel.remove());

    $('prefillUserInline').addEventListener('click', () => prefillUserNameId(true));

    $('amount').addEventListener('input', () => {
      settings.amountInput = $('amount').value;
      saveRequestFromPanel();
      updateAmountPreview();
      updateBalanceDisplay();
    });

    $('discordName').addEventListener('input', () => {
      settings.discordName = normalizeDiscordName($('discordName').value);
      saveRequestFromPanel();
    });

    $('amount').addEventListener('blur', applyFormattedAmountToInput);

    $('user').addEventListener('input', () => {
      settings.userDisplay = cleanText($('user').value);
      saveRequestFromPanel();
      updateBalanceDisplay();
      debounceBalanceCheck();
    });

    $('user').addEventListener('change', () => {
      settings.userDisplay = cleanText($('user').value);
      saveRequestFromPanel();
      settings.lastBalanceUserId = '';
      settings.lastBalanceAmount = null;
      settings.lastBalanceCheckedAt = 0;
      saveSettings();
      updateBalanceDisplay();
      debounceBalanceCheck();
    });

    $('make').addEventListener('click', makeRequest);
    $('settingsBtn').addEventListener('click', tryOpenSettings);
    $('refreshBalance').addEventListener('click', () => refreshBalanceForCurrentUser(true));
    $('markNoticesRead').addEventListener('click', markRequestNotificationsRead);

    $('refreshUser').addEventListener('click', () => prefillUserNameId(true));
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
          Settings control the faction Discord webhook, embed message, and balance checks.
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
          It is used to check faction access and read faction vault balance data before sending a request.
        </p>
      </div>
    `;

    document.body.appendChild(panel);
    makePanelMoveResize(panel);

    $('closeGate').addEventListener('click', () => panel.remove());

    $('clearApi').addEventListener('click', () => {
      settings.apiKey = '';
      settings.settingsUnlockedUntil = 0;
      settings.lastBalanceUserId = '';
      settings.lastBalanceAmount = null;
      settings.lastBalanceCheckedAt = 0;
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
    if ($('embedColorPicker')) $('embedColorPicker').value = `#${cleanHex(settings.embedColor)}`;

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
    settings.userNotifyWebhookUrl = cleanText($('userNotifyWebhookUrl')?.value || '');
    settings.timeoutNotifyTitle = cleanText($('timeoutNotifyTitle')?.value || '');
    settings.timeoutNotifyMessage = String($('timeoutNotifyMessage')?.value || '').trim();
    settings.timeoutNotifyFooter = cleanText($('timeoutNotifyFooter')?.value || '');
    settings.timeoutNotifyColor = cleanNoticeColor($('timeoutNotifyColor')?.value || settings.timeoutNotifyColor, 'ed4245');
    settings.fulfilledNotifyTitle = cleanText($('fulfilledNotifyTitle')?.value || '');
    settings.fulfilledNotifyMessage = String($('fulfilledNotifyMessage')?.value || '').trim();
    settings.fulfilledNotifyFooter = cleanText($('fulfilledNotifyFooter')?.value || '');
    settings.fulfilledNotifyColor = cleanNoticeColor($('fulfilledNotifyColor')?.value || settings.fulfilledNotifyColor, '3ba55d');
    settings.embedTitle = cleanText($('embedTitle')?.value || '');
    settings.embedDescription = String($('embedDescription')?.value || '').trim();
    settings.embedFooter = cleanText($('embedFooter')?.value || '');
    settings.embedColor = cleanHex($('embedColorPicker')?.value || settings.embedColor);

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

  function updateNoticePreview() {
    const preview = $('noticePreview');
    if (!preview) return;

    const user = parseTornUserDisplay($('previewUser')?.value || 'Evil_panda_420 [3236276]');
    const banker = parseBankerDisplay('Banker_Name [123456]');
    const amount = parseAmount($('previewAmount')?.value || '1m');
    const record = {
      user,
      banker,
      amount: amount.ok ? amount : parseAmount('1m'),
      balance: { amount: 2500000, formatted: '$2,500,000' },
      discordName: 'discord.name',
      createdAt: Date.now(),
      expiresAt: Date.now() + REQUEST_TIMEOUT_MS,
      completedAt: Date.now()
    };

    const timeoutTitle = noticeTemplateValue($('timeoutNotifyTitle')?.value || settings.timeoutNotifyTitle, record);
    const timeoutMessage = noticeTemplateValue($('timeoutNotifyMessage')?.value || settings.timeoutNotifyMessage, record);
    const timeoutFooter = noticeTemplateValue($('timeoutNotifyFooter')?.value || settings.timeoutNotifyFooter, record);

    const fulfilledTitle = noticeTemplateValue($('fulfilledNotifyTitle')?.value || settings.fulfilledNotifyTitle, record, banker);
    const fulfilledMessage = noticeTemplateValue($('fulfilledNotifyMessage')?.value || settings.fulfilledNotifyMessage, record, banker);
    const fulfilledFooter = noticeTemplateValue($('fulfilledNotifyFooter')?.value || settings.fulfilledNotifyFooter, record, banker);

    preview.style.borderLeftColor = `#${cleanNoticeColor($('fulfilledNotifyColor')?.value || settings.fulfilledNotifyColor, '3ba55d')}`;
    preview.innerHTML = `
      <div style="font-weight:900;margin-bottom:7px;">User notice preview</div>
      <div style="border-left:4px solid #${cleanNoticeColor($('timeoutNotifyColor')?.value || settings.timeoutNotifyColor, 'ed4245')};padding-left:8px;margin-bottom:10px;">
        <div style="font-weight:900;">${escapeHtml(timeoutTitle)}</div>
        <div style="white-space:pre-wrap;">${escapeHtml(timeoutMessage)}</div>
        <div class="${APP}-tiny">Footer: ${escapeHtml(timeoutFooter)}</div>
      </div>
      <div style="border-left:4px solid #${cleanNoticeColor($('fulfilledNotifyColor')?.value || settings.fulfilledNotifyColor, '3ba55d')};padding-left:8px;">
        <div style="font-weight:900;">${escapeHtml(fulfilledTitle)}</div>
        <div style="white-space:pre-wrap;">${escapeHtml(fulfilledMessage)}</div>
        <div class="${APP}-tiny">Footer: ${escapeHtml(fulfilledFooter)}</div>
      </div>
    `;
  }

  function updateEmbedPreview() {
    const preview = $('embedPreview');
    if (!preview) return;

    const user = parseUserDisplay($('previewUser')?.value || 'Evil_panda_420 [3236276]');
    const amount = parseAmount($('previewAmount')?.value || '1m');
    const color = cleanHex($('embedColorPicker')?.value || settings.embedColor);
    const balance = { amount: 2500000, formatted: '$2,500,000' };
    const previewRequest = { status: 'Pending', expiresAt: Date.now() + REQUEST_TIMEOUT_MS };

    const tempSettings = {
      title: cleanText($('embedTitle')?.value || settings.embedTitle),
      description: String($('embedDescription')?.value || settings.embedDescription).trim(),
      footer: cleanText($('embedFooter')?.value || settings.embedFooter)
    };

    const title = templateValue(tempSettings.title, user, amount.ok ? amount : parseAmount('1m'), balance, previewRequest);
    const desc = templateValue(tempSettings.description, user, amount.ok ? amount : parseAmount('1m'), balance, previewRequest);
    const footer = templateValue(tempSettings.footer, user, amount.ok ? amount : parseAmount('1m'), balance, previewRequest);

    preview.style.borderLeftColor = `#${color}`;
    preview.innerHTML = `
      <div style="font-weight:900;font-size:14px;margin-bottom:6px;">${escapeHtml(title || 'New Vault Request')}</div>
      <div style="white-space:pre-wrap;margin-bottom:8px;">${escapeHtml(desc || '')}</div>
      <div class="${APP}-tiny">Embed colour: #${escapeHtml(color)}</div>
      <div class="${APP}-tiny">Footer: ${escapeHtml(footer || '')}</div>
      <div class="${APP}-tiny" style="margin-top:6px;">Buttons only: Open Faction Controls + Open Player Profile</div>
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
    const balance = { amount: 2500000, formatted: '$2,500,000' };

    if (!user.id) {
      showToast('Preview user needs a Torn ID like Name [123456].', 'warn');
      return;
    }

    if (!amount.ok) {
      showToast(amount.error, 'warn');
      return;
    }

    try {
      await postWebhook(buildPayload(user, amount, balance));
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
        <div class="${APP}-cardTitle">Faction Request Webhook</div>
        <label for="${APP}-webhookUrl">Discord webhook URL for banker requests</label>
        <input id="${APP}-webhookUrl" type="password" placeholder="https://discord.com/api/webhooks/..." autocomplete="off" value="${escapeHtml(settings.webhookUrl || '')}" />
        <p class="${APP}-note">
          This webhook is where banker request embeds are sent. It is saved locally in this browser.
        </p>

        <label for="${APP}-userNotifyWebhookUrl">User notice webhook URL</label>
        <input id="${APP}-userNotifyWebhookUrl" type="password" placeholder="https://discord.com/api/webhooks/..." autocomplete="off" value="${escapeHtml(settings.userNotifyWebhookUrl || '')}" />
        <p class="${APP}-note">
          This second webhook posts timeout and fulfilled notices for users. It can be a separate Discord channel.
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

        <label for="${APP}-embedColorPicker">Embed colour</label>
        <input id="${APP}-embedColorPicker" type="color" value="#${cleanHex(settings.embedColor)}" />

        <p class="${APP}-note">
          Template codes: <b>{user}</b>, <b>{name}</b>, <b>{id}</b>, <b>{amount}</b>, <b>{raw}</b>, <b>{balance}</b>, <b>{expires}</b>, <b>{expiresFull}</b>, <b>{status}</b>
        </p>
      </div>

      <div class="${APP}-card">
        <div class="${APP}-cardTitle">User Notice Messages</div>

        <label for="${APP}-timeoutNotifyTitle">Timeout notice title</label>
        <input id="${APP}-timeoutNotifyTitle" type="text" value="${escapeHtml(settings.timeoutNotifyTitle)}" />

        <label for="${APP}-timeoutNotifyMessage">Timeout notice message</label>
        <textarea id="${APP}-timeoutNotifyMessage">${escapeHtml(settings.timeoutNotifyMessage)}</textarea>

        <label for="${APP}-timeoutNotifyFooter">Timeout notice footer</label>
        <input id="${APP}-timeoutNotifyFooter" type="text" value="${escapeHtml(settings.timeoutNotifyFooter)}" />

        <label for="${APP}-timeoutNotifyColor">Timeout notice colour</label>
        <input id="${APP}-timeoutNotifyColor" type="color" value="#${cleanNoticeColor(settings.timeoutNotifyColor, 'ed4245')}" />

        <label for="${APP}-fulfilledNotifyTitle">Fulfilled notice title</label>
        <input id="${APP}-fulfilledNotifyTitle" type="text" value="${escapeHtml(settings.fulfilledNotifyTitle)}" />

        <label for="${APP}-fulfilledNotifyMessage">Fulfilled notice message</label>
        <textarea id="${APP}-fulfilledNotifyMessage">${escapeHtml(settings.fulfilledNotifyMessage)}</textarea>

        <label for="${APP}-fulfilledNotifyFooter">Fulfilled notice footer</label>
        <input id="${APP}-fulfilledNotifyFooter" type="text" value="${escapeHtml(settings.fulfilledNotifyFooter)}" />

        <label for="${APP}-fulfilledNotifyColor">Fulfilled notice colour</label>
        <input id="${APP}-fulfilledNotifyColor" type="color" value="#${cleanNoticeColor(settings.fulfilledNotifyColor, '3ba55d')}" />

        <p class="${APP}-note">
          Notice template codes: <b>{user}</b>, <b>{tornname}</b>, <b>{name}</b>, <b>{id}</b>, <b>{discord}</b>, <b>{discordName}</b>, <b>{amount}</b>, <b>{balance}</b>, <b>{banker}</b>, <b>{bankerName}</b>, <b>{bankerId}</b>, <b>{timedOutAt}</b>, <b>{completedAt}</b>
        </p>

        <div id="${APP}-noticePreview" class="${APP}-embedPreview"></div>
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
    makePanelMoveResize(panel);

    $('closeSettings').addEventListener('click', () => panel.remove());

    for (const id of Object.keys(PRESETS)) {
      const btn = $(`preset-${id}`);
      if (btn) btn.addEventListener('click', () => applyPreset(id));
    }

    for (const id of ['webhookUrl', 'userNotifyWebhookUrl', 'embedTitle', 'embedDescription', 'embedFooter', 'embedColorPicker', 'timeoutNotifyTitle', 'timeoutNotifyMessage', 'timeoutNotifyFooter', 'timeoutNotifyColor', 'fulfilledNotifyTitle', 'fulfilledNotifyMessage', 'fulfilledNotifyFooter', 'fulfilledNotifyColor', 'previewUser', 'previewAmount']) {
      const el = $(id);
      if (!el) continue;
      el.addEventListener('input', () => {
        if (['embedTitle', 'embedDescription', 'embedFooter', 'embedColorPicker'].includes(id)) {
          settings.embedPreset = 'custom';
          updatePresetPills();
        }
        updateEmbedPreview();
        updateNoticePreview();
      });
    }

    $('saveSettings').addEventListener('click', () => {
      saveSettingsFromSettingsPanel();
      updateEmbedPreview();
      updateNoticePreview();
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
    updateNoticePreview();
  }

  function addLauncher() {
    if (document.getElementById(`${APP}-launcher`)) return;

    const btn = document.createElement('button');
    btn.id = `${APP}-launcher`;
    btn.className = `${APP}-floatingLauncher`;
    btn.type = 'button';
    btn.innerHTML = fvrLogoSvg('launcher');
    btn.setAttribute('aria-label', 'Vault Request');
    btn.title = 'Vault Request';
    btn.addEventListener('click', openRequestPanel);
    document.body.appendChild(btn);

    placeLauncher(false);
  }

  function init() {
    addStyles();
    addLauncher();
    startLauncherWatcher();
    startRequestTimeoutWatcher();
    setTimeout(openFulfilledPanelIfNeeded, 1500);
    window.addEventListener('hashchange', () => setTimeout(openFulfilledPanelIfNeeded, 600));

    // Keep the Name and Torn ID box blank by default.
    // Users can click the Prefill button beside the box when they want it filled.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
