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
- Launcher button uses the RWPH header slot.
- If the RWPH launcher exists, this button sits beside it.
- If the RWPH launcher is missing, this button still goes where RWPH would go, before/near Torn's **Faction Warfare** button.
- Floating launcher is only an emergency fallback if Torn's header slot cannot be found.
- Panels can be moved by dragging the top bar.
- Panels can be resized from the bottom-right corner.
- Panels keep the red **X** close button.
- Vault Request panel with:
  - Name and Torn ID field, example: `Evil_panda_420 [3236276]`
  - Optional Discord user ID for channel ping in the banker request channel
  - Request amount field
  - Faction vault balance status
  - Check Vault Balance button
  - Request Status notifications
  - Pending Requests list
  - User how-to guide
- Settings panel now has two webhook URLs:
  - **Faction Request Webhook** for banker request embeds
  - **User Notice Webhook** for timeout/fulfilled user notices
- Timeout notices post to the User Notice Webhook when a request times out.
- Fulfilled notices post to the User Notice Webhook when a banker clicks **Mark Request Fulfilled** after manually paying.
- User notice messages are editable in Settings:
  - Timeout notice title/message/footer/colour
  - Fulfilled notice title/message/footer/colour
- User notice templates support:
  - `{user}` / `{tornname}`
  - `{name}` / `{id}`
  - `{amount}` / `{balance}`
  - `{banker}` / `{bankerName}` / `{bankerId}`
  - `{timedOutAt}` / `{completedAt}`
- Requests are blocked if the requested amount is higher than the member's confirmed faction vault balance.
- Requests are also blocked if the member balance cannot be confirmed.
- Requests expire after **5 hours**.
- If the script/browser is running when the timeout happens, the Discord request message is edited to expired and the banker buttons are removed.
- If the browser is closed, the script catches up the next time it runs.
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
6. Paste a Torn API key that has faction access and can read vault/balance data.
7. Paste your **Faction Request Webhook URL**. This is where banker request embeds are sent.
8. Paste your **User Notice Webhook URL**. This is where timeout and fulfilled notices are sent.
9. Pick or edit the banker request embedded message style.
10. Edit the timeout and fulfilled user notice messages.
11. Choose the embedded message colours with the colour pickers.
12. Click **Save Settings**.
13. Use **Send Test Embed** to confirm the request embed posts to Discord.

## How Users Make Requests

1. Open Torn and click the **Vault Request** launcher button.
2. Check the **Name and Torn ID** box is correct. It should look like `Evil_panda_420 [3236276]`.
3. Optional: paste your Discord user ID if you want the banker request channel message to ping you. A normal webhook cannot send a private DM by itself.
4. Enter the amount you want to request from your faction vault balance.
5. You can type normal numbers or shortcuts:
   - `1000000` sends as `$1,000,000`
   - `1m` sends as `$1,000,000`
   - `1b` sends as `$1,000,000,000`
   - `1t` sends as `$1,000,000,000,000`
6. Click **Check Vault Balance** if you want to check your available balance first.
7. Click **Make Request**.
8. The script checks your vault balance again before sending.
9. If your request is higher than your available vault balance, it will be blocked.
10. If the request is allowed, it sends a Discord embed to the faction request webhook channel.
11. Your panel will show a notification that the request was sent.
12. The request expires after **5 hours**.
13. If the request times out, the User Notice Webhook sends a timeout notice telling you to make another request.
14. A leader/banker clicks the Discord button to open Torn faction controls, checks the details, then manually clicks **Give Money** and **Confirm**.
15. After manually paying, the banker clicks **Mark Request Fulfilled** in the userscript panel. This sends a fulfilled notice to the User Notice Webhook with the banker name and completion timestamp.

## No-Backend Limitation

This script has no server/backend. Timeout checking is done by whichever browser has the script and the pending request data. Fulfilled notices are sent when the banker clicks **Mark Request Fulfilled** after manually paying.

A normal Discord webhook cannot send a private DM by itself. The second webhook posts user notices into a Discord channel.

## Important

This script does **not** use a backend or server. Settings are saved locally in the browser.

Do not publicly share a version of the script with your real Discord webhook URL or API key saved in it.

The script does **not** automatically send Torn money. It only opens Torn faction controls with the user and amount prefilled. The banker must manually click **Give Money** and **Confirm**.
