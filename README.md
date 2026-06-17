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
- Panel headers now stay fixed at the top while only the body content scrolls.
- All panels save their size and position to the user's browser.
- All script panels use RWPH-style controls:
  - drag the top bar to move
  - resize from the bottom-right grip
  - scroll inside the panel
  - red **X** close button
  - saved panel size/position in the user's browser
- Launcher button uses the RWPH header slot.
- If the RWPH launcher exists, this button sits beside it.
- If the RWPH launcher is missing, this button still goes where RWPH would go, before/near Torn's **Faction Warfare** button.
- Floating launcher is only an emergency fallback if Torn's header slot cannot be found.
- API key is only required for Settings and the banker-side current balance panel, not for requesters sending requests.
- Vault Request panel with:
  - Blank **Name and Torn ID** field for first-time users
  - **Prefill** button beside the Name and Torn ID box
  - rejects bad labels like `View Profile`
  - if only the ID can be detected, it fills `[ID]` and asks the user to type their Torn name once
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
- The requester panel no longer has a **Check Vault Balance** button.
- Requests are not blocked by balance; bankers approve or deny manually.
- When a banker clicks **Open Faction Controls** in Discord, the banker panel opens and checks the requester’s current faction vault balance using a Torn API key.
- Banker panel has a **Save Banker API Key** button so the banker can save the key in their browser.
- Banker completion panel has a banker name/ID **Prefill** button.
- Banker completion panel has **Cancel - Unavailable Funds** to cancel a request and send the unavailable-funds notice.
- The API key is only required to access the Settings panel.
- Requesters do **not** check balance and do **not** need an API key to send requests.
- When the banker opens faction controls from the Discord button, the banker panel can use a Torn API key with faction access to show the requester’s current faction vault balance. It also supports labelled **Balance**, **Vault**, **Funds**, or **Available** columns/blocks.
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
6. Paste a Torn API key only to unlock the Settings panel. It is not needed for checking balances or sending requests.
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
7. Click **Make Request**.
8. If you do not have an API key saved, make sure the Torn faction/vault/controls page showing your balance is open/visible, then click **Check Vault Balance** again.
9. A banker clicks **Open Faction Controls** from Discord.
10. The banker panel checks your current faction vault balance using the banker’s API key.
11. If the request is higher than your available vault balance, the banker can deny it manually.
12. If the request is okay, the banker manually pays from Torn faction controls.
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
- Scroll inside the panel body when content is long. The header/logo/close bar stays at the top.
- Click the red **X** to close.
- Size and position are saved locally in the user's browser for each panel.

## Banker Balance Panel

The requester panel does not check or block vault balances.

When a banker clicks **Open Faction Controls** in the Discord request embed, the script opens the completion panel on Torn. That panel shows the requested user and amount, then checks the requester’s current faction vault balance using a Torn API key with faction access.

The banker can click **Prefill** beside the banker name/ID box to fill their Torn name and ID.

The banker can click **Save Banker API Key** to save the faction-access key in their browser, then click **Check Current Balance** any time.

The completion panel also has **Cancel - Unavailable Funds**. This cancels the request in the script, tries to edit the original Discord request to **Canceled**, and sends the user notice webhook saying the request was canceled due to unavailable vault funds.

The banker can then approve or deny manually. The script does not auto-pay, auto-confirm, or auto-deny.

## Removed Requester Balance Checking

Requester balance checking was removed. Requesters can send requests without an API key and without running a balance check.

The script can only check a vault balance if that balance is already visible somewhere on the current Torn page.

The fallback now has a dedicated Torn faction controls scanner. It looks for the matching Torn name/ID or profile link first, then reads the money value from that same member row/card. It also supports clearly labelled **Balance**, **Vault**, **Funds**, or **Available** values.

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


## Discord Message Resend Rule

Discord request/status messages are only sent once. If an admin deletes the original Discord request message, the script will not post a replacement message later.

For timeout, fulfilled, or canceled states, the script will try to edit the original Discord request message when a message ID is available. If the edit fails because the message was deleted, the script updates local status only and does not resend that main Discord message.

User notice webhook messages are also tracked locally so the same browser does not repeatedly send the same timeout, fulfilled, or canceled notice for the same request.


## Fulfilled Request Cleanup

When a banker marks a request fulfilled, that request is removed from the local pending request list and the panel updates immediately.

Because this is a no-backend script, this cleanup applies to the browser/local storage that performs or knows about the fulfilled action. Removing a pending request from a different user's browser automatically would require a shared backend or Discord bot.


## User Status Notifications And Pending Updates

Final request statuses now update the local request panel:

- **Fulfilled** sends the user notice webhook, adds a fulfilled notification, and removes the request from pending.
- **Canceled** sends the user notice webhook, adds a canceled notification, and removes the request from pending.
- **Timed out** sends the user timeout notice webhook when configured, adds a timed-out notification, and removes the request from pending.

Because this is still a no-backend userscript, these local pending-list updates apply to the browser that has the request state. A banker fulfilling/canceling from a different browser can send the Discord/user notice, but automatically changing another user's already-open local panel would require a shared backend or bot.


## Requester Panel Status Sync

A no-backend userscript cannot silently update another user's browser when a banker fulfills or cancels from a different browser.

To solve this without a backend, fulfilled, canceled, and timed-out user notice messages include an **Update My Request Panel** button. When the requester clicks it, Torn opens and the script:

- adds the fulfilled/canceled/timed-out notification to their request panel
- removes that request from their pending request list
- saves the final status locally so the same notice is not applied twice

For fully automatic cross-user panel updates without clicking the sync button, this project would need a small shared backend or Discord bot.


## Visible Status Sync Link

Some Discord webhook/client setups may not show link buttons. Status notice embeds now include both:

- an **Update My Request Panel** button when Discord displays webhook components
- a normal visible embed link named **Update My Request Panel**

If the button is missing, the requester can click the visible embed link instead. It performs the same update: removes the request from pending and adds the final fulfilled/canceled/timed-out notification locally.


## Main Panel Update / Refresh Button

The main request panel now has **Update / Refresh Request Panel** in the Request Status card.

This button:

- applies any Discord status-sync link that opened Torn
- removes fulfilled/canceled/timed-out requests from pending when the sync data is present
- checks local pending requests for 5-hour timeouts
- reloads saved pending requests/notifications from the browser
- redraws both the notifications list and pending request list

This is still no-backend: the button cannot pull hidden status changes from Discord by itself. It can apply the status data from the Discord sync link and refresh local browser data.


## Refresh Button Final-Status Check

The **Update / Refresh Request Panel** button now checks every local pending request.

When clicked, it will:

- remove requests that timed out locally
- check the original Discord request message when a Discord message ID is saved
- remove the pending request if the Discord message now says **Fulfilled**, **Canceled**, or **Expired/Timed out**
- add a matching local notification
- refresh the pending request list and notification list

If the original Discord request message was deleted by admins, the script does **not** guess the final status and does **not** repost it. The pending request is left alone unless a status-sync link is clicked or the request times out locally.


## Clear Notifications Button

The main request panel now has **Clear Notifications** instead of **Mark Notifications Read**.

Clicking **Clear Notifications** deletes all saved request notifications from that browser and refreshes the notifications area immediately.
