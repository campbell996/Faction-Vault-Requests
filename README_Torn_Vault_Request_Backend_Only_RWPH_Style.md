# Torn Vault Request - Backend Only RWPH Style

This is the backend-only version.

## Main changes

- No no-backend fallback.
- Members do not need Discord webhook URLs.
- Backend URL is automatic in the userscript using `DEFAULT_BACKEND_URL`.
- Banker/leader settings use an `ADMIN_KEY` from the backend `.env`, like the RWPH backend style.
- Discord request webhook and user notice webhook are saved to the backend only.
- Requests, fulfilled/canceled/timed-out status, and pending refresh checks use backend routes.

## Setup order

1. Deploy the `torn-vault-request-backend` folder.
2. Set backend `.env`:
   - `ADMIN_KEY`
   - `PUBLIC_BACKEND_URL`
   - `PORT` if your host needs it
3. Open `Torn_Vault_Request_Backend_Only_RWPH_Style.user.js`.
4. Replace:

```js
const DEFAULT_BACKEND_URL = 'https://REPLACE-WITH-YOUR-RWPH-STYLE-BACKEND.example.com';
```

with your real backend URL.

5. Install the userscript.
6. Banker/leader opens Settings, unlocks with Torn faction API key, pastes `ADMIN_KEY`, pastes Discord webhooks, then clicks **Save Webhooks To Backend**.
7. Members use the same userscript. They only need the automatic backend URL already built into it.

## Member flow

- Member clicks Vault Request.
- Member enters/prefills name, Discord name, and amount.
- Script sends request to backend.
- Backend posts Discord embed to bankers.
- Member pending requests refresh from backend.

## Banker flow

- Banker clicks Discord **Open Faction Controls**.
- Banker checks member balance from Torn API in the completion panel.
- Banker manually pays in Torn.
- Banker clicks **Mark Request Fulfilled** or **Cancel - Unavailable Funds**.
- Backend edits Discord request and sends user notice.

## Important

If you share the userscript before replacing `DEFAULT_BACKEND_URL`, members cannot make requests.


## Start backend on Windows

Inside the backend folder, double-click:

```text
START_SERVER_WINDOW.bat
```

It starts the backend in a server window, installs packages if needed, and keeps the console open for errors.
