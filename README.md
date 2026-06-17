# Torn Vault Request Embed Settings

A no-backend Torn userscript that lets faction members send vault money requests to a Discord webhook as an embedded message.

## Install / Update

### Direct install link

[Install / Update Script](./Torn_Vault_Request_Embed_Settings_FactionAPI_NoBackend.user.js)

Click the link above after downloading/extracting this package, or open the `.user.js` file with Tampermonkey, Violentmonkey, or TornPDA.

### GitHub raw install link template

When you upload the script to GitHub, replace `YOUR_USERNAME` and `YOUR_REPO` with your real details:

[Install / Update Script](https://github.com/YOUR_USERNAME/YOUR_REPO/raw/main/Torn_Vault_Request_Embed_Settings_FactionAPI_NoBackend.user.js)

## Features

- Clean RWPH-style dark panels.
- Vault Request launcher button.
- Request panel with:
  - Name and Torn ID field, example: `Evil_panda_420 [3236276]`
  - Request amount field
  - Amount shortcuts:
    - `1000000` = `$1,000,000`
    - `1m` = `$1,000,000`
    - `1b` = `$1,000,000,000`
    - `1t` = `$1,000,000,000,000`
- Sends a Discord embedded message to your faction webhook.
- Discord embed includes:
  - Requested user
  - Requested amount
  - Open Faction Controls button
  - Open Player Profile button
- Faction controls link prefills:
  - `giveMoneyTo`
  - `money`
- Banker still manually checks the details, clicks **Give Money**, then **Confirm**.
- Settings panel is locked behind a Torn faction API permission check.
- Settings panel can change:
  - Discord webhook URL
  - Embed title
  - Embed message
  - Embed footer
  - Embed colour
  - Message presets

## Setup

1. Install the script.
2. Open Torn.
3. Click **Vault Request**.
4. Click **Settings**.
5. Paste a Torn API key that has faction API access.
6. Paste your faction Discord webhook URL.
7. Pick or edit the embedded message style.
8. Click **Save Settings**.
9. Use **Send Test Embed** to confirm it posts to Discord.

## Important

This script does **not** use a backend or server. Settings are saved locally in the browser.

Do not publicly share a version of the script with your real Discord webhook URL or API key saved in it.

The script does **not** automatically send Torn money. It only opens Torn faction controls with the user and amount prefilled. The banker must manually click **Give Money** and **Confirm**.
