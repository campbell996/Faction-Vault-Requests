# Torn Vault Request Embed Settings

A no-backend Torn userscript that lets faction members send vault money requests to Discord webhooks as embedded messages.

## Install / Update

<p align="center">
  <a href="https://www.tampermonkey.net/script_installation.php#url=https://github.com/campbell996/Faction-Vault-Requests/raw/refs/heads/main/Torn_Vault_Request_Embed_Settings_FactionAPI_NoBackend.user.js">
    <img src="https://img.shields.io/badge/Install%20%2F%20Update%20Script-Tampermonkey-orange?style=for-the-badge" alt="Install / Update Script">
  </a>
</p>

Click the button above to install or update the userscript through Tampermonkey.

## Script File

<p align="center">
  <a href="https://github.com/campbell996/Faction-Vault-Requests/raw/refs/heads/main/Torn_Vault_Request_Embed_Settings_FactionAPI_NoBackend.user.js">
    <img src="https://img.shields.io/badge/Open%20Raw%20Userscript-.user.js-blue?style=for-the-badge" alt="Open Raw Userscript">
  </a>
</p>

## Features

- Clean RWPH-style dark panels.
- All script panels use RWPH-style controls:
  - drag the top bar to move
  - resize from the bottom-right grip
  - scroll inside the panel
  - red **X** close button
  - saved panel size/position
- Launcher button uses the RWPH header slot.
- If the RWPH launcher exists, this button sits beside it.
- If the RWPH launcher is missing, this button still goes where RWPH would go, before/near Torn's **Faction Warfare** button.
- Floating launcher is only an emergency fallback if Torn's header slot cannot be found.
- Vault Request panel with:
  - Blank **Name and Torn ID** field for first-time users
  - **Prefill** button beside the Name and Torn ID box
  - Per-user saved request info
  - **Discord name required**
  - Request amount field
  - Faction vault balance status
  - Check Vault Balance button
  - Request Status notifications
  - Pending Requests list
  - User how-to guide
- Each Torn user fills everything in themselves the first time.
- After the first time, the script remembers that user's:
  - Torn name and ID
  - Discord name
  - last entered request amount
- Saved request info is stored per Torn ID in this browser.
- The Discord name is shown in request, timeout, and fulfilled embeds as `@discordname`.
- Discord usernames are not real Discord mentions unless you use a Discord user ID. This script asks for Discord name only.
- **Check Vault Balance** works without a Torn API key only when a clearly labelled member balance is visible on the current Torn faction/vault/controls page.
- If an API key is saved, the script tries the API first.
- If no API key is saved, the script scans the visible Torn page for the member row and a nearby/column-labelled **Balance**, **Vault**, **Funds**, or **Available** amount.
- If the balance cannot be confirmed from the API or the visible page, the request is blocked.
- Settings panel has two webhook URLs:
  - **Faction Request Webhook** for banker request embeds
  - **User Notice Webhook** for timeout/fulfilled user notices
- Timeout notices post to the User Notice Webhook when a request times out.
- Fulfilled notices post to the User Notice Webhook when a banker clicks **Mark Request Fulfilled** after manually paying.
- User notice messages are editable in Settings.
- User notice templates support:
  - `{user}` / `{tornname}`
  - `{discord}` / `{discordName}`
  - `{name}` / `{id}`
  - `{amount}` / `{balance}`
  - `{banker}` / `{bankerName}` / `{bankerId}`
  - `{timedOutAt}` / `{completedAt}`
- Requests are blocked if the requested amount is higher than the member's confirmed faction vault balance.
- Requests expire after **5 hours**.
- Amount shortcuts:
  - `1000000` = `$1,000,000`
  - `1m` = `$1,000,000`
  - `1b` = `$1,000,000,000`
  - `1t` = `$1,000,000,000,000`
- Raw Torn links are not printed inside the embedded message.
- Discord buttons include:
  - Open Faction Controls
  - Open Player Profile
- Faction controls button prefills:
  - `giveMoneyTo`
  - `money`
- Banker still manually checks the details, clicks **Give Money**, then **Confirm**.

## Leader/Banker Setup

1. Click **Install / Update Script** above.
2. Install the script in Tampermonkey.
3. Open Torn.
4. Click **Vault Request**.
5. Click **Settings**.
6. Paste a Torn API key if you want API-based balance checking and settings access.
7. Paste your **Faction Request Webhook URL**. This is where banker request embeds are sent.
8. Paste your **User Notice Webhook URL**. This is where timeout and fulfilled notices are sent.
9. Pick or edit the banker request embedded message style.
10. Edit the timeout and fulfilled user notice messages.
11. Choose the embedded message colours with the colour pickers.
12. Click **Save Settings**.
13. Use **Send Test Embed** to confirm the request embed posts to Discord.

## How Users Make Requests

1. Open Torn and click the **Vault Request** launcher button.
2. The **Name and Torn ID** box starts blank the first time.
3. Click **Prefill** beside the Name and Torn ID box to fill your Torn name and ID, or type it manually. It should look like `Evil_panda_420 [3236276]`.
4. Enter your **Discord name**. This is required.
5. Enter the amount you want to request from your faction vault balance.
6. You can type normal numbers or shortcuts:
   - `1000000` sends as `$1,000,000`
   - `1m` sends as `$1,000,000`
   - `1b` sends as `$1,000,000,000`
   - `1t` sends as `$1,000,000,000,000`
7. Click **Check Vault Balance**.
8. If you do not have an API key saved, make sure the Torn faction/vault/controls page showing your balance is open/visible, then click **Check Vault Balance** again.
9. Click **Make Request**.
10. The script checks your vault balance again before sending.
11. If your request is higher than your available vault balance, it will be blocked.
12. If the request is allowed, it sends a Discord embed to the faction request webhook channel.
13. The request expires after **5 hours**.
14. If the request times out, the User Notice Webhook sends a timeout notice telling you to make another request.
15. A leader/banker clicks the Discord button to open Torn faction controls, checks the details, then manually clicks **Give Money** and **Confirm**.
16. After manually paying, the banker clicks **Mark Request Fulfilled** in the userscript panel. This sends a fulfilled notice to the User Notice Webhook with the banker name and completion timestamp.

## Per-User Saved Info

Each Torn user must fill in their own request details the first time.

Once a user has filled their details, the script remembers them under that Torn ID in this browser. If another Torn user logs in on the same browser, they get their own saved details instead of someone else's.

## Panel Controls

All main panels support the RWPH-style controls:

- Drag the top bar to move the panel.
- Drag the bottom-right grip to resize the panel.
- Scroll inside the panel when content is long.
- Click the red **X** to close.
- Size and position are remembered locally.

## No-API Balance Checking

Without an API key, the script can only check a vault balance if that balance is already visible somewhere on the current Torn page.

The fallback now uses a stricter safety check. It looks for the matching Torn name/ID and a clearly labelled **Balance**, **Vault**, **Funds**, or **Available** money value in the same member row/block.

If it sees multiple possible money values or cannot clearly identify the balance, it refuses to use the visible-page fallback. It will not guess and will not send the request.

## Discord Name Limitation

The script requires a Discord name, not a Discord user ID.

Discord webhooks cannot create a real user ping from a username alone, so the script displays the Discord name as text in the embeds, for example `@discordname`.

## No-Backend Limitation

This script has no server/backend. Timeout checking is done by whichever browser has the script and the pending request data. Fulfilled notices are sent when the banker clicks **Mark Request Fulfilled** after manually paying.

A normal Discord webhook cannot send a private DM by itself. The second webhook posts user notices into a Discord channel.

## Important

This script does **not** use a backend or server. Settings are saved locally in the browser.

Do not publicly share a version of the script with your real Discord webhook URL or API key saved in it.

The script does **not** automatically send Torn money. It only opens Torn faction controls with the user and amount prefilled. The banker must manually click **Give Money** and **Confirm**.
